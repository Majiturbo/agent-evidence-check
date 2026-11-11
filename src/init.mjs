/**
 * Scaffold deploy-check into any consumer git repo (portable; no author paths).
 *
 * Writes:
 *   deploy-units.json          — from examples/deploy-units.example.json (lang adjustable)
 *   AGENTS.md                  — appends examples/AGENTS.fragment.md if missing a deploy-check section
 *   .github/hooks/deploy-check.json (optional, --with-copilot-hook) with placeholder command
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readPkgExample(rel) {
  return fs.readFileSync(path.join(PKG_ROOT, rel), 'utf8');
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
    .replace(/^# Deploy checks.*\n+/, '')
    .trim();
  const section = `\n\n## Deploy checks (deploy-check)\n\n${fragment}\n`;
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(
      agentsPath,
      `# Agent notes\n\nProject-specific agent instructions live here.\n${section}`,
    );
    actions.push({ file: 'AGENTS.md', status: 'written' });
  } else {
    const existing = fs.readFileSync(agentsPath, 'utf8');
    if (/deploy-check|Deploy checks/i.test(existing) && !force) {
      actions.push({ file: 'AGENTS.md', status: 'skipped', reason: 'already mentions deploy-check' });
    } else if (/deploy-check|Deploy checks/i.test(existing) && force) {
      actions.push({
        file: 'AGENTS.md',
        status: 'skipped',
        reason: 'already mentions deploy-check (refusing to duplicate even with --force; edit manually)',
      });
    } else {
      fs.appendFileSync(agentsPath, section);
      actions.push({ file: 'AGENTS.md', status: 'appended' });
    }
  }

  if (opts.withCopilotHook) {
    const hookDir = path.join(cwd, '.github', 'hooks');
    const hookFile = path.join(hookDir, 'deploy-check.json');
    if (fs.existsSync(hookFile) && !force) {
      actions.push({ file: '.github/hooks/deploy-check.json', status: 'skipped', reason: 'exists' });
    } else {
      fs.mkdirSync(hookDir, { recursive: true });
      const body = {
        version: 1,
        hooks: {
          preToolUse: [
            {
              type: 'command',
              matcher: 'bash|Bash|powershell',
              command: '/ABS/PATH/TO/deploy-check/hooks/run.sh',
              timeoutSec: 30,
            },
          ],
        },
        _comment:
          'Replace the command with your clone of deploy-check (hooks/run.sh on Unix, or node ".../hooks/bridge.mjs" on Windows). Prefer user-level install: npx deploy-check-install-hooks',
      };
      fs.writeFileSync(hookFile, JSON.stringify(body, null, 2) + '\n');
      actions.push({ file: '.github/hooks/deploy-check.json', status: 'written' });
    }
  }

  actions.push({
    file: '_next',
    status: 'info',
    steps: [
      'Edit deploy-units.json: set your unit ids and observe blocks (see docs/verify.md)',
      'Link or vendor docs/rules/deploy-check.md from the deploy-check package (rules 7–9: direction, loop, done)',
      'Optional: npx deploy-check-install-hooks  (from a deploy-check clone/package)',
      'Optional: configure MCP — docs/mcp.md / examples/mcp.*.json',
      'Smoke: npx deploy-check --cwd . --shadow && npx deploy-check done --cwd . && npx deploy-check verify --cwd .',
    ],
  });

  return { cwd, lang, packageRoot: PKG_ROOT, actions };
}
