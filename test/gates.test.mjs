import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { reviewDirection, reviewLoop } from '../src/api.mjs';
import { detectEvent } from '../hooks/bridge.mjs';
import {
  evaluateEditGate,
  evaluateStopGate,
  loadReceipts,
  noteEdit,
  noteDirection,
  noteLoop,
  receiptPath,
} from '../src/receipts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = path.join(ROOT, 'hooks', 'bridge.mjs');

function repo(gates = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-gate-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i'], {
    cwd: dir,
  });
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({
      lang: 'en',
      loop: { minEdits: 3, minRejections: 2 },
      judgments: { stopGate: gates, editGate: gates },
      units: [{ id: 'web', verify: 'hand' }],
    }),
  );
  return dir;
}

function hook(payload) {
  const r = spawnSync(process.execPath, [BRIDGE], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout || '{}');
}

test('detectEvent: stop and edit', () => {
  assert.equal(detectEvent({ hook_event_name: 'Stop', cwd: '/tmp' }), 'stop-claude');
  assert.equal(detectEvent({ status: 'completed', loop_count: 0 }), 'stop-cursor');
  assert.equal(
    detectEvent({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse' }),
    'edit',
  );
  assert.equal(detectEvent({ command: 'npm run deploy', cwd: '/tmp' }), 'shell');
});

test('receipts: direction unlocks stop; loop unlocks edit burst', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-rcpt-'));
  noteEdit(dir, { file: 'banner.js' });
  noteEdit(dir, { file: 'banner.js' });
  noteEdit(dir, { file: 'banner.js' });
  let r = loadReceipts(dir);
  assert.equal(r.editTotal, 3);
  assert.equal(evaluateStopGate(r, { enabled: true, minEdits: 3 }).kind, 'direction');

  noteDirection(dir, { moment: 'start' });
  r = loadReceipts(dir);
  assert.equal(evaluateStopGate(r, { enabled: true, minEdits: 3 }).kind, 'loop');

  assert.equal(evaluateEditGate(r, { enabled: true, file: 'banner.js', minEdits: 3 }).block, true);

  noteLoop(dir, { target: 'banner.js' });
  r = loadReceipts(dir);
  assert.equal(r.editTotal, 3); // session total kept for doneGate ordering
  assert.deepEqual(r.edits, {}); // per-file cleared for editGate
  assert.equal(evaluateStopGate(r, { enabled: true, minEdits: 3 }).block, false);
  assert.equal(evaluateEditGate(r, { enabled: true, file: 'banner.js', minEdits: 3 }).block, false);
  assert.equal(evaluateStopGate(r, { enabled: true, doneEnabled: true, minEdits: 3 }).kind, 'done');
  assert.ok(fs.existsSync(receiptPath(dir)));
});

test('API pass writes receipts', () => {
  const dir = repo(false);
  const bad = reviewDirection({ cwd: dir, moment: 'start', goal: 'x' });
  assert.equal(bad.ok, false);
  assert.equal(loadReceipts(dir).direction, null);

  const ok = reviewDirection({
    cwd: dir,
    moment: 'start',
    goal: 'Ship banner',
    path: 'Animate',
    nearer: 'Static PNG',
    whyNotNearer: 'Animation failed reviews',
    evidence: 'User rejected screenshot',
  });
  assert.equal(ok.ok, true);
  assert.equal(loadReceipts(dir).direction.ok, true);

  const loop = reviewLoop({
    cwd: dir,
    target: 'banner.js',
    edits: 4,
    rejections: 2,
    tried: 'tweak',
    next: 'static',
    alternatives: ['static'],
  });
  assert.equal(loop.ok, true);
  assert.equal(loadReceipts(dir).loop.ok, true);
});

test('bridge stop-claude blocks without direction after edits; stop_hook_active fails open', () => {
  const dir = repo(true);
  hook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  const stop = hook({ hook_event_name: 'Stop', cwd: dir, stop_hook_active: false });
  assert.equal(stop.decision, 'block');
  assert.match(stop.reason, /deploy_check_direction|direction/);

  const again = hook({ hook_event_name: 'Stop', cwd: dir, stop_hook_active: true });
  assert.equal(again.decision, undefined);
});

test('bridge edit gate denies the 3rd edit; loop receipt clears it', () => {
  const dir = repo(true);
  reviewDirection({
    cwd: dir,
    moment: 'start',
    goal: 'Ship banner',
    path: 'Animate',
    nearer: 'Static PNG',
    whyNotNearer: 'failed reviews',
    evidence: 'user rejected',
  });
  const e1 = hook({ tool_name: 'Edit', tool_input: { file_path: 'banner.js' }, hook_event_name: 'PreToolUse', cwd: dir });
  assert.equal(e1.permissionDecision || e1.hookSpecificOutput?.permissionDecision, 'allow');
  hook({ tool_name: 'Edit', tool_input: { file_path: 'banner.js' }, hook_event_name: 'PreToolUse', cwd: dir });
  const e3 = hook({ tool_name: 'Edit', tool_input: { file_path: 'banner.js' }, hook_event_name: 'PreToolUse', cwd: dir });
  assert.equal(e3.permissionDecision || e3.hookSpecificOutput?.permissionDecision, 'deny');

  reviewLoop({
    cwd: dir,
    target: 'banner.js',
    edits: 3,
    rejections: 2,
    tried: 'tweak',
    next: 'static',
    alternatives: ['static'],
  });
  const e4 = hook({ tool_name: 'Edit', tool_input: { file_path: 'banner.js' }, hook_event_name: 'PreToolUse', cwd: dir });
  assert.equal(e4.permissionDecision || e4.hookSpecificOutput?.permissionDecision, 'allow');
});

test('gates off: stop and edit always allow', () => {
  const dir = repo(false);
  hook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  hook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  hook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  const stop = hook({ hook_event_name: 'Stop', cwd: dir });
  assert.equal(stop.decision, undefined);
  const edit = hook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  assert.equal(edit.permissionDecision || edit.hookSpecificOutput?.permissionDecision, 'allow');
});

test('cursor stop sends followup_message', () => {
  const dir = repo(true);
  hook({ tool_name: 'Write', tool_input: { path: 'x.ts' }, hook_event_name: 'PreToolUse', cwd: dir });
  const stop = hook({ status: 'completed', loop_count: 0, cwd: dir });
  assert.match(stop.followup_message || '', /direction|deploy_check_direction/);
});
