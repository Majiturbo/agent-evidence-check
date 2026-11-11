import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = path.join(ROOT, 'hooks', 'run.sh');
const INSTALL = path.join(ROOT, 'scripts', 'install-hooks.mjs');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function repo() {
  const dir = tmp('dc-repo-');
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return { dir, git };
}

const IS_WIN = process.platform === 'win32';
const BRIDGE = path.join(ROOT, 'hooks', 'bridge.mjs');

function hook(payload, env = {}) {
  const [bin, args] = IS_WIN ? [process.execPath, [BRIDGE]] : [RUN, []];
  const r = spawnSync(bin, args, {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, DEPLOY_CHECK_NODE: process.execPath, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const claude = (command, cwd) => ({ tool_name: 'Bash', tool_input: { command }, cwd, hook_event_name: 'PreToolUse' });
const decision = (out) => out.hookSpecificOutput.permissionDecision;

test('repo without deploy-units.json is never touched', () => {
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'wip.txt'), 'x');
  for (const cmd of ['git stash push -u', 'docker compose up -d', 'ssh prod deploy', 'git stash list']) {
    assert.equal(decision(hook(claude(cmd, dir))), 'allow', cmd);
  }
});

test('enrolled repo: dirty stash denied, read-only allowed, config found from subdir', () => {
  const { dir, git } = repo();
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ units: [{ id: 'api' }] }));
  git('add', '.');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'units');
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'other-tool-wip.txt'), 'x');

  const sub = path.join(dir, 'sub');
  assert.equal(decision(hook(claude('git stash push -u -m wip', sub))), 'deny');
  assert.equal(decision(hook(claude('git stash list', sub))), 'allow');
  assert.equal(decision(hook(claude('ls', sub))), 'allow');

  const deploy = hook(claude('rsync -a dist/ host:/srv', sub));
  assert.equal(decision(deploy), 'deny');
  assert.ok(deploy._deploy_check.findings.includes('dirty_tree'));

  const cursor = hook({ command: 'git stash push -u', cwd: sub });
  assert.equal(cursor.permission, 'ask');

  const shadow = hook(claude('git stash push -u', sub), { DEPLOY_CHECK_MODE: 'shadow' });
  assert.equal(decision(shadow), 'allow');
});

test('malformed config fails open', () => {
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), '{bad');
  assert.equal(decision(hook(claude('rsync -a x host:/y', dir))), 'allow');
});

test('install is idempotent, keeps foreign hooks, uninstall removes only ours', () => {
  const home = tmp('dc-home-');
  const foreign = { type: 'command', command: '/usr/local/bin/other-hook' };
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ model: 'x', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [foreign] }] } }),
  );
  fs.mkdirSync(path.join(home, '.dsh'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.dsh', 'hooks.json'),
    JSON.stringify({ version: 1, hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [foreign] }] } }),
  );
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (...a) => execFileSync(process.execPath, [INSTALL, ...a], { env, encoding: 'utf8' });

  run();
  run();
  const claudeCfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  const cmds = claudeCfg.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.equal(claudeCfg.model, 'x');
  assert.ok(cmds.includes(foreign.command));
  assert.equal(cmds.filter((c) => c.includes('hooks/')).length, 1);
  assert.ok(claudeCfg.hooks.PreToolUse.some((g) => /Edit/.test(g.matcher || '')));
  assert.ok(claudeCfg.hooks.Stop?.some((g) => g.hooks?.some((h) => String(h.command).includes('hooks/'))));

  const dsh = JSON.parse(fs.readFileSync(path.join(home, '.dsh', 'hooks.json'), 'utf8'));
  assert.ok(dsh.hooks.PreToolUse.some((g) => g.hooks.some((h) => h.command === foreign.command)));

  const trae = JSON.parse(fs.readFileSync(path.join(home, '.trae', 'hooks.json'), 'utf8'));
  assert.equal(trae.hooks.PreToolUse[0].matcher, 'RunCommand');

  const cursorInstalled = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.ok(cursorInstalled.hooks.stop?.some((h) => String(h.command).includes('hooks/')));
  assert.equal(cursorInstalled.hooks.stop[0].loop_limit, 3);

  run('--uninstall');
  const after = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  const left = after.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.deepEqual(left, [foreign.command]);
  assert.equal(after.hooks.Stop, undefined);
  assert.equal(fs.existsSync(path.join(home, '.copilot', 'hooks', 'deploy-check.json')), false);
  const cursor = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(cursor.hooks.beforeShellExecution, undefined);
  assert.equal(cursor.hooks.stop, undefined);
});

test('windows install writes `node "<fwd-slash path>/bridge.mjs"` and Codex commandWindows', () => {
  const home = tmp('dc-home-win-');
  const env = { ...process.env, HOME: home, USERPROFILE: home, DEPLOY_CHECK_PLATFORM: 'win32' };
  execFileSync(process.execPath, [INSTALL], { env, encoding: 'utf8' });
  const expected = `node "${BRIDGE.split(path.sep).join('/')}"`;

  const cursor = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(cursor.hooks.beforeShellExecution[0].command, expected);
  const codex = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'hooks.json'), 'utf8'));
  assert.equal(codex.hooks.PreToolUse[0].hooks[0].command, expected);
  assert.equal(codex.hooks.PreToolUse[0].hooks[0].commandWindows, expected);
  assert.ok(!expected.includes('\\'));

  // switching platforms rewrites our entry instead of duplicating it
  execFileSync(process.execPath, [INSTALL], { env: { ...env, DEPLOY_CHECK_PLATFORM: 'linux' }, encoding: 'utf8' });
  const again = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(again.hooks.beforeShellExecution.length, 1);
  assert.equal(again.hooks.beforeShellExecution[0].command, RUN);
});

test('language: English by default, Chinese via deploy-units.json lang', () => {
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ units: [{ id: 'api' }] }));
  fs.writeFileSync(path.join(dir, 'wip.txt'), 'x');
  const env = { DEPLOY_CHECK_LANG: '', LANG: 'en_US.UTF-8', LC_ALL: '' };
  const en = hook(claude('git stash push -u', dir), env).hookSpecificOutput.permissionDecisionReason;
  assert.match(en, /working tree/i);

  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ lang: 'zh', units: [{ id: 'api' }] }));
  const zh = hook(claude('git stash push -u', dir), env).hookSpecificOutput.permissionDecisionReason;
  assert.match(zh, /工作区/);
});

test('run.sh fail-open when node is missing does not exec the allow JSON', {
  // Unix entry only; Windows hosts call bridge.mjs via `node` (see install-hooks).
  skip: IS_WIN ? 'run.sh is the Unix hook entry' : false,
}, () => {
  const r = spawnSync('bash', [RUN], {
    input: '{}',
    encoding: 'utf8',
    env: {
      PATH: '/usr/bin:/bin',
      HOME: os.tmpdir(),
      DEPLOY_CHECK_NO_FALLBACK: '1',
    },
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const out = JSON.parse(r.stdout);
  assert.equal(out.permission, 'allow');
  assert.match(out.permissionDecisionReason, /node not found/);
});
