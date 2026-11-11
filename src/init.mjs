/**
 * Scaffold agent-evidence-check into any consumer git repo (portable; no author paths).
 *
 * Writes:
 *   deploy-units.json          — from examples/deploy-units.example.json (lang adjustable; name kept for compatibility)
 *   AGENTS.md                  — appends examples/AGENTS.fragment.md if missing a product section
 *   .github/hooks/agent-evidence-check.json (optional, --with-copilot-hook) with placeholder command
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readPkgExample(rel) {
  return fs.readFileSync(path.join(PKG_ROOT, rel), 'utf8');
}

function mentionsProduct(text) {
  return /agent-evidence-check|deploy-check|Agent evidence checks|Deploy checks/i.test(text);
}

/**
 * @param {{ cwd?: string, lang?: string, force?: boolean, withCopilotHook?: boolean }} opts
 * @returns {{ cwd: string, actions: object[] }}
 */
export function initConsumer(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const lang = opts.lang === 'zh' ? 'zh' : 'en';
  const force = Boolean(opts.force);
  const actions = [];

  fs.mkdirSync(cwd, { recursive: true });

  const unitsPath = path.join(cwd, 'deploy-units.json');
  if (fs.existsSync(unitsPath) && !force) {
    actions.push({ file: 'deploy-units.json', status: 'skipped', reason: 'exists (pass --force to overwrite)' });
  } else {
    const raw = JSON.parse(readPkgExample('examples/deploy-units.example.json'));
    raw.lang = lang;
    fs.writeFileSync(unitsPath, JSON.stringify(raw, null, 2) + '\n');
    actions.push({ file: 'deploy-units.json', status: force && fs.existsSync(unitsPath) ? 'overwritten' : 'written' });
  }

  const agentsPath = path.join(cwd, 'AGENTS.md');
  const fragment = readPkgExample('examples/AGENTS.fragment.md')
    .replace(/^# .*\n+/, '')
    .trim();
  const section = `\n\n## Agent evidence checks (agent-evidence-check)\n\n${fragment}\n`;
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(
      agentsPath,
      `# Agent notes\n\nProject-specific agent instructions live here.\n${section}`,
    );
    actions.push({ file: 'AGENTS.md', status: 'written' });
  } else {
    const existing = fs.readFileSync(agentsPath, 'utf8');
    if (mentionsProduct(existing) && !force) {
      actions.push({ file: 'AGENTS.md', status: 'skipped', reason: 'already mentions agent-evidence-check / deploy-check' });
    } else if (mentionsProduct(existing) && force) {
      actions.push({
        file: 'AGENTS.md',
        status: 'skipped',
        reason: 'already mentions product (refusing to duplicate even with --force; edit manually)',
      });
    } else {
      fs.appendFileSync(agentsPath, section);
      actions.push({ file: 'AGENTS.md', status: 'appended' });
    }
  }

  if (opts.withCopilotHook) {
    const hookDir = path.join(cwd, '.github', 'hooks');
    const hookFile = path.join(hookDir, 'agent-evidence-check.json');
    if (fs.existsSync(hookFile) && !force) {
      actions.push({ file: '.github/hooks/agent-evidence-check.json', status: 'skipped', reason: 'exists' });
    } else {
      fs.mkdirSync(hookDir, { recursive: true });
      const body = {
        version: 1,
        hooks: {
          preToolUse: [
            {
              type: 'command',
              matcher: 'bash|Bash|powershell',
              command: '/ABS/PATH/TO/agent-evidence-check/hooks/run.sh',
              timeoutSec: 30,
            },
          ],
        },
        _comment:
          'Replace the command with your clone of agent-evidence-check (hooks/run.sh on Unix, or node ".../hooks/bridge.mjs" on Windows). Prefer user-level install: npx agent-evidence-check-install-hooks',
      };
      fs.writeFileSync(hookFile, JSON.stringify(body, null, 2) + '\n');
      actions.push({ file: '.github/hooks/agent-evidence-check.json', status: 'written' });
    }
  }

  actions.push({
    file: '_next',
    status: 'info',
    steps: [
      'Edit deploy-units.json: set your unit ids and observe blocks (see docs/verify.md)',
      'Link or vendor docs/rules/agent-evidence-check.md from the agent-evidence-check package (rules 7–9: direction, loop, done)',
      'Optional: npx agent-evidence-check-install-hooks',
      'Optional: configure MCP — docs/mcp.md / examples/mcp.*.json',
      'Smoke: npx agent-evidence-check --cwd . --shadow && npx agent-evidence-check done --cwd . && npx agent-evidence-check verify --cwd .',
    ],
  });

  return { cwd, lang, packageRoot: PKG_ROOT, actions };
}
