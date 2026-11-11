#!/usr/bin/env node
/**
 * Install deploy-check hooks into the current user's agent configs (idempotent).
 *
 *   node scripts/install-hooks.mjs              # install / repair
 *   node scripts/install-hooks.mjs --uninstall  # remove only our entries
 *
 * Writes a command pointing at *this* package, never at another machine's path.
 *   macOS / Linux: hooks/run.sh (finds Node even when GUI hosts lack it on PATH)
 *   Windows:       node "<pkg>/hooks/bridge.mjs" — runs unchanged in PowerShell, cmd and Git Bash
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRAP = path.join(ROOT, 'hooks', 'run.sh');
const BRIDGE = path.join(ROOT, 'hooks', 'bridge.mjs');
const HOME = os.homedir();
const PLATFORM = process.env.DEPLOY_CHECK_PLATFORM || process.platform;
const IS_WIN = PLATFORM === 'win32';
const CMD = IS_WIN ? `node "${BRIDGE.split(path.sep).join('/')}"` : WRAP;

function ensureExec(file) {
  fs.chmodSync(file, 0o755);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak.${Date.now()}`);
  }
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function isOurs(command) {
  const c = String(command || '');
  return (
    c.includes('deploy-check') ||
    c.includes('premiseguard') ||
    c.includes('hooks/run.sh') ||
    c.includes('hooks/bridge.mjs')
  );
}

function upsertPreTool(settings, matcher, command) {
  settings.hooks = settings.hooks || {};
  const key = settings.hooks.PreToolUse ? 'PreToolUse' : settings.hooks.preToolUse ? 'preToolUse' : 'PreToolUse';
  settings.hooks[key] = settings.hooks[key] || [];
  const list = settings.hooks[key];
  let changed = false;
  for (const g of list) {
    const hooks = g.hooks || (g.command ? [g] : []);
    for (const h of hooks) {
      if (isOurs(h.command) && h.command !== command) {
        h.command = command;
        changed = true;
      }
    }
  }
  const exists = list.some((g) => (g.hooks || [g]).some((h) => isOurs(h.command)));
  if (!exists) {
    list.push({
      matcher,
      hooks: [{ type: 'command', command, timeout: 30 }],
    });
    return 'added';
  }
  return changed ? 'rewritten' : 'ok';
}

function upsertCursorEvent(list, command, extra = {}) {
  let status = 'ok';
  let found = false;
  for (const h of list) {
    if (!isOurs(h.command)) continue;
    found = true;
    if (h.command !== command) {
      h.command = command;
      status = 'rewritten';
    }
    for (const [k, v] of Object.entries(extra)) {
      if (h[k] !== v) {
        h[k] = v;
        if (status === 'ok') status = 'rewritten';
      }
    }
  }
  if (!found) {
    list.push({ command, ...extra });
    status = 'added';
  }
  return status;
}

function installCursor() {
  const file = path.join(HOME, '.cursor', 'hooks.json');
  const j = readJson(file, { version: 1, hooks: {} });
  j.version = j.version || 1;
  j.hooks = j.hooks || {};
  j.hooks.beforeShellExecution = j.hooks.beforeShellExecution || [];
  j.hooks.stop = j.hooks.stop || [];
  j.hooks.preToolUse = j.hooks.preToolUse || [];
  const a = upsertCursorEvent(j.hooks.beforeShellExecution, CMD, { failClosed: false });
  const b = upsertCursorEvent(j.hooks.stop, CMD, { loop_limit: 3 });
  const c = upsertCursorEvent(j.hooks.preToolUse, CMD, { matcher: 'Write|StrReplace|Edit|Delete' });
  const status = [a, b, c].includes('added') ? 'added' : [a, b, c].includes('rewritten') ? 'rewritten' : 'ok';
  if (status !== 'ok') writeJson(file, j);
  return status;
}

function upsertStop(settings, command) {
  settings.hooks = settings.hooks || {};
  settings.hooks.Stop = settings.hooks.Stop || [];
  const list = settings.hooks.Stop;
  let changed = false;
  for (const g of list) {
    for (const h of g.hooks || []) {
      if (isOurs(h.command) && h.command !== command) {
        h.command = command;
        changed = true;
      }
    }
  }
  const exists = list.some((g) => (g.hooks || []).some((h) => isOurs(h.command)));
  if (!exists) {
    list.push({ hooks: [{ type: 'command', command, timeout: 30 }] });
    return 'added';
  }
  return changed ? 'rewritten' : 'ok';
}

function installClaude() {
  const file = path.join(HOME, '.claude', 'settings.json');
  const j = readJson(file, {});
  const matcher = 'Bash|Edit|Write|MultiEdit|NotebookEdit';
  let status = upsertPreTool(j, matcher, CMD);
  for (const g of j.hooks?.PreToolUse || []) {
    if ((g.hooks || []).some((h) => isOurs(h.command)) && g.matcher !== matcher) {
      g.matcher = matcher;
      if (status === 'ok') status = 'rewritten';
    }
  }
  const stop = upsertStop(j, CMD);
  if (stop === 'added' || stop === 'rewritten') status = status === 'ok' ? stop : status;
  if (status !== 'ok') writeJson(file, j);
  return status;
}

function installCodex() {
  const file = path.join(HOME, '.codex', 'hooks.json');
  const j = readJson(file, { hooks: {} });
  let status = upsertPreTool(j, 'Bash', CMD);
  if (IS_WIN) {
    for (const g of j.hooks.PreToolUse || j.hooks.preToolUse || []) {
      for (const h of g.hooks || []) {
        if (isOurs(h.command) && h.commandWindows !== CMD) {
          h.commandWindows = CMD;
          if (status === 'ok') status = 'rewritten';
        }
      }
    }
  }
  if (status !== 'ok') writeJson(file, j);
  return status;
}

function installTrae() {
  const results = {};
  for (const dir of ['.trae', '.trae-cn']) {
    const file = path.join(HOME, dir, 'hooks.json');
    const j = readJson(file, { version: 1, hooks: {} });
    j.version = 1;
    j.hooks = j.hooks || {};
    j.hooks.PreToolUse = j.hooks.PreToolUse || [];
    const status = upsertPreTool(j, 'RunCommand', CMD);
    // Trae matcher must stay RunCommand even if an older install used Bash
    for (const g of j.hooks.PreToolUse) {
      if ((g.hooks || []).some((h) => isOurs(h.command))) g.matcher = 'RunCommand';
    }
    if (status !== 'ok' || !fs.existsSync(file)) writeJson(file, j);
    results[dir] = status === 'ok' && fs.existsSync(file) ? 'ok' : status;
  }
  return results;
}

function installQoder() {
  const file = path.join(HOME, '.qoder', 'settings.json');
  const j = readJson(file, {});
  const status = upsertPreTool(j, 'Bash', CMD);
  if (status !== 'ok') writeJson(file, j);
  return status;
}

function installCopilot() {
  const file = path.join(HOME, '.copilot', 'hooks', 'deploy-check.json');
  const j = {
    version: 1,
    hooks: {
      preToolUse: [
        {
          type: 'command',
          matcher: 'bash|Bash|powershell',
          command: CMD,
          timeoutSec: 30,
        },
      ],
    },
  };
  writeJson(file, j);
  return 'written';
}

function installDsh() {
  const file = path.join(HOME, '.dsh', 'hooks.json');
  const j = readJson(file, { version: 1, hooks: {} });
  j.version = j.version || 1;
  const status = upsertPreTool(j, 'Bash|bash|pwsh|shell', CMD);
  if (status !== 'ok') writeJson(file, j);
  return `${status} (needs DSH hooks bridge or Claude-Code hook import to take effect)`;
}

/** Remove only our entries; leave every other hook the user configured. */
function uninstallFrom(file, eventKeys) {
  if (!fs.existsSync(file)) return 'absent';
  const j = readJson(file, null);
  if (!j?.hooks) return 'ok';
  let changed = false;
  for (const key of eventKeys) {
    const list = j.hooks[key];
    if (!Array.isArray(list)) continue;
    const kept = [];
    for (const g of list) {
      if (Array.isArray(g.hooks)) {
        const hooks = g.hooks.filter((h) => !isOurs(h.command));
        if (hooks.length !== g.hooks.length) changed = true;
        if (hooks.length) kept.push({ ...g, hooks });
      } else if (isOurs(g.command)) {
        changed = true;
      } else {
        kept.push(g);
      }
    }
    if (kept.length) j.hooks[key] = kept;
    else delete j.hooks[key];
  }
  if (changed) writeJson(file, j);
  return changed ? 'removed' : 'ok';
}

function uninstall() {
  const pre = ['PreToolUse', 'preToolUse'];
  const copilot = path.join(HOME, '.copilot', 'hooks', 'deploy-check.json');
  const copilotStatus = fs.existsSync(copilot) ? (fs.rmSync(copilot), 'removed') : 'absent';
  return {
    cursor: uninstallFrom(path.join(HOME, '.cursor', 'hooks.json'), ['beforeShellExecution', 'stop', 'preToolUse']),
    claude: uninstallFrom(path.join(HOME, '.claude', 'settings.json'), [...pre, 'Stop']),
    codex: uninstallFrom(path.join(HOME, '.codex', 'hooks.json'), pre),
    trae: uninstallFrom(path.join(HOME, '.trae', 'hooks.json'), pre),
    traeCn: uninstallFrom(path.join(HOME, '.trae-cn', 'hooks.json'), pre),
    qoder: uninstallFrom(path.join(HOME, '.qoder', 'settings.json'), pre),
    copilot: copilotStatus,
    dsh: uninstallFrom(path.join(HOME, '.dsh', 'hooks.json'), pre),
  };
}

if (process.argv.includes('--uninstall')) {
  console.log(JSON.stringify(uninstall(), null, 2));
  process.exit(0);
}

if (!IS_WIN) {
  ensureExec(WRAP);
  ensureExec(path.join(ROOT, 'bin', 'check-deploy.mjs'));
}

const report = {
  packageRoot: ROOT,
  platform: PLATFORM,
  command: CMD,
  node: process.execPath,
  cursor: installCursor(),
  claude: installClaude(),
  codex: installCodex(),
  trae: installTrae(),
  qoder: installQoder(),
  copilot: installCopilot(),
  dsh: installDsh(),
};

console.log(JSON.stringify(report, null, 2));
console.log(`
Hooks only act in repos that contain deploy-units.json; every other repo is untouched.

Next (per tool UI, once):
  - Trae: Settings → Hooks → enable; Rules → Include AGENTS.md
  - VS Code: Copilot Agent hooks (Preview)
  - DSH: import Claude Code hooks, or install a hooks bridge plugin
  - Put deploy-units.json in each app repo you deploy from
Undo: node scripts/install-hooks.mjs --uninstall
${IS_WIN ? 'Windows: `node` must be on PATH for GUI apps too (the Node.js installer does this by default).\n' : ''}`);
