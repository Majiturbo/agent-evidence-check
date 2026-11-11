import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { reviewDone } from '../src/api.mjs';
import { check } from '../src/checks/index.mjs';
import { callTool } from '../src/mcp/stdio.mjs';
import { evaluateStopGate, loadReceipts, noteEdit, noteDirection, noteDone, noteLoop } from '../src/receipts.mjs';
import { mockGit } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'agent-evidence-check.mjs');
const BRIDGE = path.join(ROOT, 'hooks', 'bridge.mjs');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-done-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i'], {
    cwd: dir,
  });
  fs.mkdirSync(path.join(dir, 'test'));
  fs.writeFileSync(path.join(dir, 'test', 'ok.test.mjs'), "import test from 'node:test';\ntest('x', () => {});");
  execFileSync('git', ['add', 'test/ok.test.mjs'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'test'], { cwd: dir });
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({
      lang: 'en',
      done: { testCommand: 'node -e "process.exit(0)"', testPaths: ['test'] },
      judgments: { stopGate: true, doneGate: true, editGate: false },
      units: [{ id: 'web', verify: 'hand' }],
    }),
  );
  return dir;
}

test('done_evidence fails without exit 0; passes with it', () => {
  const missing = check({ type: 'done', testCommand: 'npm test' }, { lang: 'en', config: { done: {} } });
  assert.equal(missing.ok, false);
  assert.ok(missing.findings.some((f) => f.checkId === 'done_evidence'));

  const bad = check({ type: 'done', testCommand: 'npm test', exitCode: 1 }, { lang: 'en' });
  assert.equal(bad.ok, false);

  const ok = check({ type: 'done', testCommand: 'npm test', exitCode: 0 }, { lang: 'en', git: mockGit() });
  assert.equal(ok.findings.some((f) => f.checkId === 'done_evidence'), false);
});

test('tests_untampered catches deleted tests and skip lines', () => {
  const git = {
    diffNameStatus: () => ['D  test/old.test.mjs'],
    diffText: () => '',
  };
  const del = check({ type: 'done', testCommand: 't', exitCode: 0 }, { lang: 'en', git, config: { done: { testPaths: ['test'] } } });
  assert.ok(del.findings.some((f) => f.checkId === 'tests_untampered'));

  const washGit = {
    diffNameStatus: () => ['M  test/ok.test.mjs'],
    diffText: () => '+  it.skip("broken", () => {})',
  };
  const wash = check({ type: 'done', testCommand: 't', exitCode: 0 }, { lang: 'en', git: washGit, config: { done: {} } });
  assert.ok(wash.findings.some((f) => f.checkId === 'tests_untampered'));
});

test('reviewDone runs command and writes receipt', async () => {
  const dir = repo();
  const fail = await reviewDone({ cwd: dir, command: 'node -e "process.exit(2)"' });
  assert.equal(fail.ok, false);
  assert.equal(fail.exitCode, 2);
  assert.equal(loadReceipts(dir).done, null);

  const ok = await reviewDone({ cwd: dir });
  assert.equal(ok.ok, true);
  assert.equal(ok.exitCode, 0);
  assert.equal(loadReceipts(dir).done.ok, true);
});

test('reviewDone --exit-code path and washed working tree', async () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'test', 'ok.test.mjs'), "import test from 'node:test';\ntest.skip('x', () => {});");
  const washed = await reviewDone({ cwd: dir, exitCode: 0, run: false, command: 'node -e "process.exit(0)"' });
  assert.equal(washed.ok, false);
  assert.ok(washed.findings.some((f) => f.checkId === 'tests_untampered'));
});

test('doneGate on stop after edits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-done-gate-'));
  noteEdit(dir, { file: 'a.ts' });
  noteDirection(dir, { moment: 'start' });
  let r = loadReceipts(dir);
  assert.equal(evaluateStopGate(r, { enabled: true, doneEnabled: true, minEdits: 9 }).kind, 'done');
  noteDone(dir, { testCommand: 'npm test', exitCode: 0 });
  r = loadReceipts(dir);
  assert.equal(evaluateStopGate(r, { enabled: true, doneEnabled: true, minEdits: 9 }).block, false);
});

test('doneGate works without stopGate; survives loop clearing per-file edits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-done-alone-'));
  noteEdit(dir, { file: 'a.ts' });
  noteEdit(dir, { file: 'a.ts' });
  noteEdit(dir, { file: 'a.ts' });
  let r = loadReceipts(dir);
  assert.equal(evaluateStopGate(r, { enabled: false, doneEnabled: true, minEdits: 3 }).kind, 'done');
  noteDirection(dir, { moment: 'start' });
  noteLoop(dir, { target: 'a.ts' });
  r = loadReceipts(dir);
  assert.equal(r.editTotal, 3);
  assert.equal(evaluateStopGate(r, { enabled: true, doneEnabled: true, minEdits: 3 }).kind, 'done');
  noteDone(dir, { exitCode: 0 });
  r = loadReceipts(dir);
  assert.equal(evaluateStopGate(r, { enabled: true, doneEnabled: true, minEdits: 3 }).block, false);
});

test('CLI and MCP done', async () => {
  const dir = repo();
  const cli = spawnSync(
    process.execPath,
    [CLI, 'done', '--cwd', dir, '--command', 'node -e "process.exit(0)"'],
    { encoding: 'utf8' },
  );
  assert.equal(cli.status, 0);
  assert.equal(JSON.parse(cli.stdout).ok, true);

  const mcp = JSON.parse((await callTool('deploy_check_done', { cwd: dir, exitCode: 0, run: false, command: 'npm test' })).content[0].text);
  assert.equal(mcp.phase, 'done');
  assert.equal(mcp.ok, true);

  const blocked = spawnSync(process.execPath, [BRIDGE], {
    input: JSON.stringify({ hook_event_name: 'Stop', cwd: dir, stop_hook_active: false }),
    encoding: 'utf8',
  });
  // no edits yet after fresh receipts from done — allow
  assert.equal(JSON.parse(blocked.stdout || '{}').decision, undefined);
});
