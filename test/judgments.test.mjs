import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { reviewDirection, reviewLoop } from '../src/api.mjs';
import { check } from '../src/checks/index.mjs';
import { callTool } from '../src/mcp/stdio.mjs';
import { mockGit, SHA } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'check-deploy.mjs');

const goodDirection = {
  moment: 'start',
  goal: 'Ship a static banner',
  path: 'Keep tuning the canvas animation',
  nearer: 'Use one static image',
  whyNotNearer: 'Taking the static image because the animation missed three reviews',
  evidence: 'User said the motion is still wrong after the last screenshot',
};

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-judge-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], {
    cwd: dir,
  });
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ lang: 'en', units: [{ id: 'api', verify: 'hand' }] }));
  return dir;
}

test('direction: missing nearer path fails; a different path with a fact passes', () => {
  const missing = check({ type: 'direction', moment: 'turn', goal: 'Fix the banner', path: 'Tweak the same draw call' }, { lang: 'en' });
  const card = missing.findings.find((f) => f.checkId === 'direction_review');
  assert.ok(card);
  assert.equal(missing.ok, false);
  assert.match(card.evidence, /nearer path/);
  assert.ok(card.forbidden.length >= 1);

  const same = check({ type: 'direction', ...goodDirection, nearer: goodDirection.path }, { lang: 'en' });
  assert.match(same.findings[0].evidence, /same as the current path/);

  const ok = check({ type: 'direction', ...goodDirection }, { lang: 'en' });
  assert.equal(ok.ok, true);
  assert.equal(ok.findings.length, 0);
});

test('direction stays off the pre-deploy path', () => {
  const verdict = check({ type: 'pre-deploy', commit: SHA }, { git: mockGit({ clean: true, pushed: new Set([SHA]) }), config: { units: [{ id: 'api' }] } });
  assert.equal(verdict.findings.some((f) => f.checkId === 'direction_review' || f.checkId === 'loop_escape'), false);
});

test('direction: Chinese card, advisory allows, block does not', () => {
  const dir = repo();
  const ask = reviewDirection({ cwd: dir, moment: 'turn', lang: 'zh' });
  assert.equal(ask.ok, false);
  assert.equal(ask.allow, true);
  assert.match(ask.cards[0].message, /更近/);

  const hard = reviewDirection({ cwd: dir, mode: 'block' });
  assert.equal(hard.allow, false);

  const passed = reviewDirection({ cwd: dir, ...goodDirection });
  assert.equal(passed.ok, true);
});

test('loop: quiet attempt passes; repeated class fails; a named different class passes', () => {
  const quiet = check({ type: 'loop', target: 'banner', edits: 1, rejections: 0, tried: 'tweak animation' }, { lang: 'en' });
  assert.equal(quiet.ok, true);

  const stuck = check(
    {
      type: 'loop',
      target: 'banner',
      edits: 4,
      rejections: 2,
      claimsFixed: true,
      tried: 'tweak animation',
      next: 'tweak animation',
      alternatives: ['use a static image'],
    },
    { lang: 'en' },
  );
  assert.equal(stuck.ok, false);
  assert.match(stuck.findings[0].evidence, /edits 4/);
  assert.ok(stuck.findings[0].forbidden.some((s) => /fixed/i.test(s)));

  const left = check(
    {
      type: 'loop',
      target: 'banner',
      edits: 4,
      rejections: 2,
      claimsFixed: true,
      tried: 'tweak animation',
      next: 'use a static image',
      alternatives: ['use a static image', 'drop the effect'],
    },
    { lang: 'en' },
  );
  assert.equal(left.ok, true);
});

test('loop: custom thresholds and a claim-fixed after one rejection', () => {
  const lenient = check(
    { type: 'loop', target: 'banner', edits: 4, rejections: 1, tried: 'tweak animation', next: 'tweak animation' },
    { config: { loop: { minEdits: 8, minRejections: 5 } } },
  );
  assert.equal(lenient.ok, true);

  const claimed = check(
    { type: 'loop', target: 'banner', edits: 1, rejections: 1, claimsFixed: true, tried: 'tweak animation' },
    { lang: 'en' },
  );
  assert.equal(claimed.ok, false);
});

test('CLI direction and loop, and not enrolled', () => {
  const dir = repo();
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-judge-bare-'));
  const none = spawnSync(process.execPath, [CLI, 'direction', '--cwd', bare, '--moment', 'start'], { encoding: 'utf8' });
  assert.equal(JSON.parse(none.stdout).enrolled, false);
  assert.equal(none.status, 0);

  const bad = spawnSync(
    process.execPath,
    [CLI, 'direction', '--cwd', dir, '--moment', 'start', '--goal', 'Ship a banner', '--path', 'Keep animating'],
    { encoding: 'utf8' },
  );
  assert.equal(bad.status, 0);
  assert.equal(JSON.parse(bad.stdout).ok, false);

  const blocked = spawnSync(process.execPath, [CLI, 'loop', '--cwd', dir, '--block', '--target', 'banner', '--edits', '3', '--rejections', '1', '--tried', 'tweak animation', '--claims-fixed'], {
    encoding: 'utf8',
  });
  assert.equal(blocked.status, 2);

  const passed = spawnSync(
    process.execPath,
    [
      CLI,
      'loop',
      '--cwd',
      dir,
      '--target',
      'banner',
      '--edits',
      '4',
      '--rejections',
      '2',
      '--tried',
      'tweak animation',
      '--next',
      'use a static image',
      '--alternative',
      'use a static image',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(passed.status, 0);
  assert.equal(JSON.parse(passed.stdout).ok, true);
});

test('MCP direction and loop tools', async () => {
  const dir = repo();
  const bad = JSON.parse((await callTool('deploy_check_direction', { cwd: dir, moment: 'turn', goal: 'Ship a banner', path: 'Keep animating' })).content[0].text);
  assert.equal(bad.ok, false);
  assert.equal(bad.phase, 'direction');

  const ok = JSON.parse(
    (await callTool('deploy_check_loop', {
      cwd: dir,
      target: 'banner',
      edits: 4,
      rejections: 2,
      tried: 'tweak animation',
      next: 'drop the effect',
      alternatives: ['drop the effect'],
    })).content[0].text,
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.phase, 'loop');
});
