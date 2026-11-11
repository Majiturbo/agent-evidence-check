import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, listCheckIds, registerCustom, looksLikeDeployCommand, looksLikeClearWorkspace } from '../src/checks/index.mjs';
import { toMcpElicitation } from '../src/card/mcp.mjs';
import { toAguiInterrupt } from '../src/card/agui.mjs';
import { beforeShell } from '../src/adapters/cursor-shell-hook.mjs';
import { mockGit, SHA, SHA2 } from './helpers.mjs';

const units = [
  { id: 'api_image', kind: 'container_image' },
  { id: 'admin_static', kind: 'host_files' },
];

function pre(event, git, config = { units }) {
  return check({ type: 'pre-deploy', commit: SHA, ...event }, { mode: 'advisory', git, config });
}

test('registry exposes the builtin ids', () => {
  const ids = listCheckIds();
  for (const id of [
    'dirty_tree',
    'deploy_from_commit',
    'unpushed',
    'units_declared',
    'units_match',
    'hotpatch_drift',
    'direction_review',
    'loop_escape',
    'done_evidence',
    'tests_untampered',
  ]) {
    assert.ok(ids.includes(id), id);
  }
});

test('unknown check id is rejected (closed registry)', () => {
  assert.throws(
    () => check({ type: 'pre-deploy', checkIds: ['rm_rf_root'] }, { git: mockGit(), config: { units } }),
    /unknown check id/,
  );
});

test('custom check must use custom: prefix', () => {
  assert.throws(() => registerCustom({ id: 'sneaky', phase: 'any', run: () => null }), /custom:/);
});

test('dirty_tree: clean passes, dirty blocks and forbids stash', () => {
  const ok = pre({}, mockGit({ clean: true }));
  assert.equal(ok.findings.some((f) => f.checkId === 'dirty_tree'), false);

  const bad = pre({}, mockGit({ clean: false, entries: [' M app.py', '?? secret.env'] }));
  const f = bad.findings.find((x) => x.checkId === 'dirty_tree');
  assert.ok(f);
  assert.equal(f.severity, 'block');
  assert.ok(f.forbidden.some((s) => /stash/i.test(s)));
  assert.equal(bad.ok, false);
});

test('deploy_from_commit: empty / HEAD / bad ref fail; full sha ok', () => {
  const git = mockGit({ resolveMap: { HEAD: SHA } });
  assert.ok(pre({ commit: '' }, git).findings.some((f) => f.checkId === 'deploy_from_commit'));
  assert.ok(pre({ commit: 'HEAD' }, git).findings.some((f) => f.checkId === 'deploy_from_commit'));
  assert.ok(pre({ commit: 'nope' }, git).findings.some((f) => f.checkId === 'deploy_from_commit'));
  assert.equal(
    pre({ commit: SHA }, mockGit({ pushed: new Set([SHA]) })).findings.some((f) => f.checkId === 'deploy_from_commit'),
    false,
  );
});

test('unpushed: local-only sha fails; remote sha passes', () => {
  const local = pre({ commit: SHA }, mockGit({ pushed: new Set() }));
  assert.ok(local.findings.some((f) => f.checkId === 'unpushed'));
  const remote = pre({ commit: SHA }, mockGit({ pushed: new Set([SHA]) }));
  assert.equal(remote.findings.some((f) => f.checkId === 'unpushed'), false);
});

test('units_declared: empty config fails; listed units pass', () => {
  const none = check(
    { type: 'pre-deploy', commit: SHA, checkIds: ['units_declared'] },
    { git: mockGit({ pushed: new Set([SHA]) }), config: { units: [] } },
  );
  assert.ok(none.findings.some((f) => f.checkId === 'units_declared'));
  const ok = check(
    { type: 'pre-deploy', commit: SHA, checkIds: ['units_declared'] },
    { git: mockGit(), config: { units } },
  );
  assert.equal(ok.findings.length, 0);
});

test('units_match: missing unit and wrong fingerprint fail; all match passes', () => {
  const ctx = { git: mockGit(), config: { units } };
  const missing = check(
    { type: 'post-deploy', commit: SHA, observed: { api_image: SHA } },
    ctx,
  );
  assert.ok(missing.findings.some((f) => f.checkId === 'units_match'));
  assert.match(missing.findings.find((f) => f.checkId === 'units_match').evidence, /admin_static/);

  const wrong = check(
    { type: 'post-deploy', commit: SHA, observed: { api_image: SHA, admin_static: SHA2 } },
    ctx,
  );
  assert.ok(wrong.findings.some((f) => f.checkId === 'units_match'));

  const ok = check(
    { type: 'post-deploy', commit: SHA, observed: { api_image: SHA, admin_static: SHA } },
    ctx,
  );
  assert.equal(ok.findings.some((f) => f.checkId === 'units_match'), false);
});

test('hotpatch_drift: advisory when drift listed; silent when absent', () => {
  const quiet = check(
    { type: 'post-deploy', commit: SHA, checkIds: ['hotpatch_drift'] },
    { git: mockGit(), config: { units } },
  );
  assert.equal(quiet.findings.some((f) => f.checkId === 'hotpatch_drift'), false);
  const drift = check(
    {
      type: 'post-deploy',
      commit: SHA,
      checkIds: ['hotpatch_drift'],
      drift: [{ path: '/etc/app/.env', note: 'API_KEY edited on host' }],
    },
    { git: mockGit(), config: { units } },
  );
  const f = drift.findings.find((x) => x.checkId === 'hotpatch_drift');
  assert.equal(f.severity, 'advisory');
  assert.equal(drift.ok, true); // advisory 不把 ok 打成 false
});

test('shadow mode never denies allow flag', () => {
  const v = check(
    { type: 'pre-deploy', commit: SHA },
    { mode: 'shadow', git: mockGit({ clean: false, entries: [' M x'] }), config: { units } },
  );
  assert.equal(v.shadow, true);
  assert.equal(v.allow, true);
  assert.equal(v.ok, false);
});

test('MCP elicitation schema is flat with enum choices', () => {
  const v = pre({}, mockGit({ clean: false, entries: [' M x'], pushed: new Set([SHA]) }));
  const mcp = toMcpElicitation(v.cards[0]);
  assert.equal(mcp.requestedSchema.type, 'object');
  assert.ok(Array.isArray(mcp.requestedSchema.properties.choice.enum));
  assert.ok(mcp.requestedSchema.properties.choice.enum.includes('abort'));
});

test('AG-UI interrupt has reason/message/responseSchema', () => {
  const v = pre({}, mockGit({ clean: false, entries: [' M x'], pushed: new Set([SHA]) }));
  const ag = toAguiInterrupt(v.cards[0]);
  assert.equal(ag.reason, 'dirty_tree');
  assert.ok(ag.message);
  assert.equal(ag.responseSchema.type, 'object');
});

test('command detectors', () => {
  assert.equal(looksLikeDeployCommand('ssh host docker compose up -d'), true);
  assert.equal(looksLikeDeployCommand('rsync -a dist/ host:/srv'), true);
  assert.equal(looksLikeDeployCommand('npm test'), false);
  assert.equal(looksLikeDeployCommand('ssh-keygen -t ed25519'), false);
  assert.equal(looksLikeDeployCommand('ssh-add ~/.ssh/id'), false);
  assert.equal(looksLikeDeployCommand('ssh -T git@github.com'), false);
  assert.equal(looksLikeDeployCommand('docker compose up -d', ['^\\./deploy\\.sh']), false);
  assert.equal(looksLikeDeployCommand('./deploy.sh prod', ['^\\./deploy\\.sh']), true);
});

test('clear-workspace detector ignores read-only git', () => {
  for (const cmd of [
    'git stash push -u -m "wip before deploy"',
    'git stash',
    'git stash -u',
    'git stash drop',
    'git -C app stash save wip',
    'git checkout -- src/a.ts',
    'git checkout HEAD -- src/a.ts',
    'git checkout .',
    'git restore src/a.ts',
    'git restore --staged --worktree a.ts',
    'git reset --hard origin/main',
    'git clean -fd',
    'git clean -xdf',
    'git status && git stash push',
  ]) {
    assert.equal(looksLikeClearWorkspace(cmd), true, cmd);
  }
  for (const cmd of [
    'git status',
    'git stash list',
    'git stash show -p',
    'git stash pop',
    'git restore --staged a.ts',
    'git checkout main',
    'git checkout -b feature',
    'git reset HEAD~1',
    'git clean -n',
  ]) {
    assert.equal(looksLikeClearWorkspace(cmd), false, cmd);
  }
});

test('clean tree + stash: advisory allows with reason, block denies', () => {
  const git = mockGit({ clean: true, pushed: new Set([SHA]) });
  const adv = beforeShell({ command: 'git stash', mode: 'advisory', context: { git, config: { units } } });
  assert.equal(adv.permission, 'allow');
  assert.ok(adv.reason);
  const blk = beforeShell({ command: 'git stash', mode: 'block', context: { git, config: { units } } });
  assert.equal(blk.permission, 'deny');
});

test('cursor hook: stash clear → ask/deny; unrelated command → allow', () => {
  const git = mockGit({ clean: false, entries: [' M other.ts'], pushed: new Set([SHA]) });
  const deny = beforeShell({
    command: 'git stash push -u -m "wip before deploy"',
    mode: 'block',
    context: { git, config: { units } },
  });
  assert.equal(deny.permission, 'deny');

  const ask = beforeShell({
    command: 'git stash push -u -m "wip"',
    mode: 'advisory',
    context: { git, config: { units } },
  });
  assert.equal(ask.permission, 'ask');

  const allow = beforeShell({ command: 'npm test', mode: 'block', context: { git, config: { units } } });
  assert.equal(allow.permission, 'allow');
});

test('i18n: every English key has a Chinese counterpart of the same shape', async () => {
  const { _tables } = await import('../src/i18n.mjs');
  for (const [key, v] of Object.entries(_tables.en)) {
    assert.ok(key in _tables.zh, `zh missing ${key}`);
    assert.equal(typeof _tables.zh[key], typeof v, key);
    if (Array.isArray(v)) assert.equal(_tables.zh[key].length, v.length, key);
  }
});

test('cards render in the requested language', () => {
  const git = mockGit({ clean: false, entries: [' M x'], pushed: new Set([SHA]) });
  const en = check({ type: 'pre-deploy', commit: SHA, checkIds: ['dirty_tree'] }, { git, config: { units }, lang: 'en' });
  const zh = check({ type: 'pre-deploy', commit: SHA, checkIds: ['dirty_tree'] }, { git, config: { units }, lang: 'zh' });
  assert.match(en.cards[0].message, /uncommitted/);
  assert.match(zh.cards[0].message, /未提交/);
  assert.match(en.mcp[0].message, /Evidence:/);
  assert.match(zh.agui[0].message, /证据/);
});

test('happy pre-deploy path', () => {
  const v = pre(
    {},
    mockGit({ clean: true, pushed: new Set([SHA]), resolveMap: { [SHA]: SHA } }),
  );
  assert.equal(v.ok, true);
  assert.equal(v.findings.length, 0);
});
