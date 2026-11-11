/**
 * Entry: check(event, context) → verdict
 *
 * event.type: 'pre-deploy' | 'post-deploy' | 'direction' | 'loop' | 'done'
 * event.commit / targetCommit / observed / drift / command / checkIds
 * context.git / context.config / context.customChecks / context.mode
 */

import './dirty_tree.mjs';
import './deploy_from_commit.mjs';
import './unpushed.mjs';
import './units_declared.mjs';
import './units_match.mjs';
import './hotpatch_drift.mjs';
import './direction_review.mjs';
import './loop_escape.mjs';
import './done_evidence.mjs';
import './tests_untampered.mjs';
import { resolveChecks, listCheckIds } from './registry.mjs';
import { toMcpElicitation } from '../card/mcp.mjs';
import { toAguiInterrupt } from '../card/agui.mjs';
import { resolveLang } from '../i18n.mjs';

export { listCheckIds, getCheck, registerCustom } from './registry.mjs';

/**
 * @param {object} event
 * @param {object} context
 */
export function check(event, context = {}) {
  if (!event?.type || !['pre-deploy', 'post-deploy', 'direction', 'loop', 'done'].includes(event.type)) {
    throw new Error('event.type must be pre-deploy, post-deploy, direction, loop, or done');
  }
  const mode = context.mode === 'block' ? 'block' : context.mode === 'shadow' ? 'shadow' : 'advisory';
  const lang = resolveLang(context.lang ?? context.config?.lang);
  const ctx = { ...context, lang };
  const custom = context.customChecks || new Map();
  const checks = resolveChecks(event.checkIds, custom).filter(
    (c) => c.phase === 'any' || c.phase === event.type,
  );

  const cards = [];
  for (const c of checks) {
    const card = c.run(event, ctx);
    if (card) cards.push(card);
  }

  const wouldBlock = cards.some((c) => c.severity === 'block');
  const verdict = {
    ok: !wouldBlock,
    mode,
    eventType: event.type,
    /** shadow: record what would have fired, never intervene */
    shadow: mode === 'shadow',
    findings: cards.map((c) => ({
      checkId: c.checkId,
      severity: c.severity,
      premise: c.premise,
      evidence: c.evidence,
      forbidden: c.forbidden,
    })),
    lang,
    cards,
    mcp: cards.map((c) => toMcpElicitation(c, lang)),
    agui: cards.map((c) => toAguiInterrupt(c, lang)),
    /** for hooks: shadow/advisory never veto; block mode vetoes only on block-level cards */
    allow: mode === 'block' ? !wouldBlock : true,
  };
  return verdict;
}

/**
 * Default deploy-command patterns. A repo can replace them with `deployCommands` (regex strings) in deploy-units.json.
 * ssh excludes ssh-keygen / ssh-add etc. and `ssh -T git@…` connectivity tests.
 */
const DEPLOY_RE =
  /(?<![\w.-])(scp|rsync|kubectl|helm|flyctl|capistrano)(?=\s|$)|(?<![\w.-])ssh(?=\s|$)(?![^;&|]*\bgit@)|\bdocker\s+compose\b|\bdocker\s+stack\b|\b(npm|pnpm|yarn)\s+run\s+[^\n]*deploy\b|\b(ansible-playbook|terraform\s+apply)\b|\b(gh\s+workflow\s+run)\b/i;

export function looksLikeDeployCommand(command, patterns) {
  const s = String(command || '');
  if (Array.isArray(patterns) && patterns.length) return patterns.some((p) => new RegExp(p, 'i').test(s));
  return DEPLOY_RE.test(s);
}

const GIT = String.raw`\bgit(?:\s+-C\s+\S+)?\s+`;
const STASH_RE = new RegExp(`${GIT}stash(?:\\s+(\\S+))?`, 'gi');
const STASH_READONLY = new Set(['list', 'show', 'apply', 'pop', 'branch', 'create', 'store']);
const OTHER_CLEAR_RE = new RegExp(
  `${GIT}(?:checkout\\s+(?:HEAD\\s+)?--(?:\\s|$)|checkout\\s+\\.(?:\\s|$)|reset\\s+--hard\\b|clean\\s+-[a-z]*f)`,
  'i',
);
const RESTORE_RE = new RegExp(`${GIT}restore\\b([^;&|]*)`, 'gi');

/** git commands that discard or hide working-tree changes (read-only subcommands and restore --staged excluded) */
export function looksLikeClearWorkspace(command) {
  const s = String(command || '');
  if (OTHER_CLEAR_RE.test(s)) return true;
  for (const m of s.matchAll(STASH_RE)) {
    const sub = (m[1] || '').toLowerCase();
    if (!STASH_READONLY.has(sub)) return true;
  }
  for (const m of s.matchAll(RESTORE_RE)) {
    const args = m[1] || '';
    const stagedOnly = /(^|\s)(--staged|-S)(\s|$)/.test(args) && !/(^|\s)(--worktree|-W)(\s|$)/.test(args);
    if (!stagedOnly) return true;
  }
  return false;
}

export { DEPLOY_RE };
