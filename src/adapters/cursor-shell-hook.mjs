/**
 * beforeShell logic (pure, testable). hooks/bridge.mjs normalizes each host's stdin and calls this.
 *
 * Input { command, cwd, mode, context: { git, config: { units, deployCommands, lang } } };
 * returns { permission: 'allow'|'deny'|'ask', verdict?, reason? }.
 *
 * Callers only invoke this for enrolled repos (deploy-units.json present).
 *   advisory (default): ask on block-level findings
 *   shadow: attach verdict, always allow
 *   block: deny on block-level findings
 */

import { check, looksLikeDeployCommand, looksLikeClearWorkspace } from '../checks/index.mjs';
import { createLocalGit } from '../git/local.mjs';
import { loadDeployUnits } from '../config.mjs';
import { resolveLang, t } from '../i18n.mjs';

/**
 * @param {{ command: string, cwd?: string, mode?: string, event?: object, context?: object }} input
 */
export function beforeShell(input) {
  const command = String(input.command || '');
  const cwd = input.cwd || process.cwd();
  const mode = input.mode || 'advisory';
  const config = input.context?.config || pick(loadDeployUnits(cwd));
  const lang = resolveLang(input.context?.lang ?? config.lang);

  const isClear = looksLikeClearWorkspace(command);
  const isDeploy = looksLikeDeployCommand(command, config.deployCommands);

  if (!isClear && !isDeploy) {
    return { permission: 'allow' };
  }

  const git = input.context?.git || createLocalGit(cwd);
  const context = { ...(input.context || {}), mode, git, config, lang };

  if (isClear) {
    const verdict = check({ type: 'pre-deploy', checkIds: ['dirty_tree'] }, context);
    if (!git.status().clean) return pack(mode, verdict, t(lang, 'hook.clear_dirty'));
    const reason = t(lang, 'hook.clear_clean');
    if (mode === 'block') return { permission: 'deny', reason, verdict };
    return { permission: 'allow', reason, verdict };
  }

  const commit = input.event?.commit || guessCommit(command, git) || git.resolve('HEAD');
  const event = {
    type: 'pre-deploy',
    commit,
    command,
    ...(input.event || {}),
  };
  const verdict = check(event, context);
  return pack(mode, verdict, verdict.ok ? t(lang, 'hook.ok') : summarize(verdict));
}

function pick({ units, deployCommands, lang }) {
  return { units, deployCommands, lang };
}

function pack(mode, verdict, reason) {
  if (mode === 'shadow') return { permission: 'allow', reason, verdict };
  if (mode === 'block' && !verdict.allow) return { permission: 'deny', reason, verdict };
  if (!verdict.ok) return { permission: 'ask', reason, verdict };
  return { permission: 'allow', reason, verdict };
}

function summarize(verdict) {
  return verdict.cards.map((c) => `[${c.checkId}] ${c.message}`).join('\n\n');
}

/** First hex token in the command that actually resolves to a commit; otherwise null (use HEAD). */
function guessCommit(command, git) {
  for (const m of String(command).matchAll(/\b([0-9a-f]{7,40})\b/gi)) {
    const sha = git.resolve(m[1]);
    if (sha) return sha;
  }
  return null;
}

export default beforeShell;
