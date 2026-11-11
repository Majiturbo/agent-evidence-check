/**
 * Portable self-check for any developer machine.
 * Reports Node, package files, enrollment of --cwd, and whether user-level hooks point at this package.
 * Does not modify anything.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDeployUnits } from './config.mjs';
import { createLocalGit } from './git/local.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function commandLooksOurs(command, packageRoot) {
  const c = String(command || '');
  if (!c) return false;
  if (c.includes('agent-evidence-check') || c.includes('deploy-check') || c.includes('premiseguard')) return true;
  if (c.includes('hooks/run.sh') || c.includes('hooks/bridge.mjs')) return true;
  const norm = packageRoot.split(path.sep).join('/');
  return Boolean(norm && c.includes(norm));
}

function scanHooks(file, packageRoot) {
  if (!exists(file)) return { file, status: 'absent' };
  const j = readJson(file);
  if (!j) return { file, status: 'unreadable' };
  const blob = JSON.stringify(j);
  const ours = blob.includes('agent-evidence-check') || blob.includes('deploy-check') || blob.includes('hooks/run.sh') || blob.includes('hooks/bridge.mjs') || blob.includes(packageRoot.split(path.sep).join('/'));
  // also walk commands
  let matched = ours;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.command === 'string' && commandLooksOurs(node.command, packageRoot)) matched = true;
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(j);
  return { file, status: matched ? 'configured' : 'present_without_agent_evidence_check' };
}

/**
 * @param {{ cwd?: string, home?: string, packageRoot?: string }} opts
 */
export function doctor(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const home = opts.home || os.homedir();
  const packageRoot = opts.packageRoot || PKG_ROOT;
  const checks = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    id: 'node',
    ok: nodeMajor >= 22,
    detail: `Node ${process.versions.node} (${process.execPath})`,
    fix: nodeMajor >= 22 ? undefined : 'Install Node >= 22 and ensure GUI apps see it on PATH',
  });

  const runSh = path.join(packageRoot, 'hooks', 'run.sh');
  const bridge = path.join(packageRoot, 'hooks', 'bridge.mjs');
  const mcp = path.join(packageRoot, 'bin', 'agent-evidence-check-mcp.mjs');
  checks.push({
    id: 'package_files',
    ok: exists(bridge) && exists(mcp),
    detail: { packageRoot, runSh: exists(runSh), bridge: exists(bridge), mcp: exists(mcp) },
  });

  let gitOk = false;
  let gitError;
  try {
    createLocalGit(cwd).resolve('HEAD');
    gitOk = true;
  } catch (e) {
    gitError = e.message;
  }
  checks.push({
    id: 'cwd_git',
    ok: gitOk,
    detail: gitOk ? cwd : gitError,
    fix: gitOk ? undefined : 'Run doctor with --cwd pointing at a git app repo',
  });

  let loaded;
  try {
    loaded = loadDeployUnits(cwd);
  } catch (e) {
    loaded = { path: null, units: [], warnings: [], error: e.message };
  }
  checks.push({
    id: 'enrolled',
    ok: Boolean(loaded.path),
    detail: loaded.path
      ? { unitsFile: loaded.path, unitCount: loaded.units.length, warnings: loaded.warnings || [] }
      : { message: 'no deploy-units.json — hooks will no-op in this repo', error: loaded.error },
    fix: loaded.path ? undefined : `npx agent-evidence-check init --cwd ${cwd}`,
  });
  if (loaded.path && (loaded.warnings || []).length) {
    checks.push({
      id: 'units_warnings',
      ok: false,
      detail: loaded.warnings,
      fix: 'See docs/verify.md — add observe blocks or keep units manual with --observed',
    });
  }

  if (loaded.path) {
    const j = loaded.judgments || { stopGate: false, editGate: false, doneGate: false };
    const gatesOn = Boolean(j.stopGate || j.editGate || j.doneGate);
    checks.push({
      id: 'judgment_gates',
      ok: true,
      detail: {
        stopGate: Boolean(j.stopGate),
        editGate: Boolean(j.editGate),
        doneGate: Boolean(j.doneGate),
        loop: loaded.loop,
        done: loaded.done,
        note: gatesOn
          ? 'Stop/edit hooks force direction/loop/done calls when install-hooks is current'
          : 'Gates off — agents only call direction/loop/done if rules/MCP say so',
      },
      fix: gatesOn
        ? undefined
        : 'Optional: set "judgments": { "stopGate": true, "editGate": true, "doneGate": true } then re-run install-hooks (see docs/judgments.md)',
    });
  }

  const hookScans = {
    cursor: scanHooks(path.join(home, '.cursor', 'hooks.json'), packageRoot),
    claude: scanHooks(path.join(home, '.claude', 'settings.json'), packageRoot),
    codex: scanHooks(path.join(home, '.codex', 'hooks.json'), packageRoot),
    trae: scanHooks(path.join(home, '.trae', 'hooks.json'), packageRoot),
    traeCn: scanHooks(path.join(home, '.trae-cn', 'hooks.json'), packageRoot),
    qoder: scanHooks(path.join(home, '.qoder', 'settings.json'), packageRoot),
    copilot: scanHooks(path.join(home, '.copilot', 'hooks', 'agent-evidence-check.json'), packageRoot),
    copilotLegacy: scanHooks(path.join(home, '.copilot', 'hooks', 'deploy-check.json'), packageRoot),
    dsh: scanHooks(path.join(home, '.dsh', 'hooks.json'), packageRoot),
  };
  const anyHook = Object.values(hookScans).some((h) => h.status === 'configured');
  checks.push({
    id: 'user_hooks',
    ok: anyHook,
    detail: hookScans,
    fix: anyHook ? undefined : 'From an agent-evidence-check clone: npm run install-hooks (then enable Trae/Copilot/DSH UI toggles if needed)',
  });

  // enrolled + node + package are hard; hooks / gates / warnings soft
  const hardOk = checks.filter((c) => ['node', 'package_files'].includes(c.id)).every((c) => c.ok);

  return {
    ok: hardOk,
    cwd,
    packageRoot,
    platform: process.platform,
    checks,
    next: [
      loaded.path ? null : `agent-evidence-check init --cwd ${cwd}`,
      anyHook ? null : 'agent-evidence-check-install-hooks (from your agent-evidence-check clone)',
      loaded.path && !(loaded.judgments?.stopGate || loaded.judgments?.editGate)
        ? 'Optional gates: "judgments": { "stopGate": true, "editGate": true } — docs/judgments.md'
        : null,
      'agent-evidence-check --cwd <app> --shadow',
      'agent-evidence-check verify --cwd <app>',
      'agent-evidence-check direction / loop — docs/judgments.md',
      'Optional MCP: docs/mcp.md',
    ].filter(Boolean),
  };
}
