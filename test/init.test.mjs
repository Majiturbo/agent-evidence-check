import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initConsumer } from '../src/init.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'agent-evidence-check.mjs');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dc-init-'));
}

test('init writes deploy-units.json and AGENTS.md; second run is idempotent', () => {
  const dir = tmp();
  const first = initConsumer({ cwd: dir, lang: 'en' });
  assert.ok(first.actions.some((a) => a.file === 'deploy-units.json' && a.status === 'written'));
  assert.ok(first.actions.some((a) => a.file === 'AGENTS.md' && a.status === 'written'));

  const units = JSON.parse(fs.readFileSync(path.join(dir, 'deploy-units.json'), 'utf8'));
  assert.equal(units.lang, 'en');
  assert.ok(units.units.some((u) => u.id === 'api'));
  assert.match(JSON.stringify(units), /example\.com/);
  assert.ok(!JSON.stringify(units).includes('/Users/'));

  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /agent-evidence-check/);

  const second = initConsumer({ cwd: dir });
  assert.ok(second.actions.some((a) => a.file === 'deploy-units.json' && a.status === 'skipped'));
  assert.ok(second.actions.some((a) => a.file === 'AGENTS.md' && a.status === 'skipped'));
});

test('init --lang zh and --with-copilot-hook', () => {
  const dir = tmp();
  const out = initConsumer({ cwd: dir, lang: 'zh', withCopilotHook: true });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'deploy-units.json'), 'utf8')).lang, 'zh');
  assert.ok(out.actions.some((a) => a.file === '.github/hooks/agent-evidence-check.json' && a.status === 'written'));
  const hook = fs.readFileSync(path.join(dir, '.github', 'hooks', 'agent-evidence-check.json'), 'utf8');
  assert.match(hook, /ABS\/PATH\/TO\/agent-evidence-check/);
  assert.ok(!hook.includes('/Users/'));
});

test('init appends to existing AGENTS.md without agent-evidence-check section', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Hello\n\nBe careful.\n');
  initConsumer({ cwd: dir });
  const text = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(text, /^# Hello/m);
  assert.match(text, /Agent evidence checks \(agent-evidence-check\)/);
});

test('CLI init subcommand', () => {
  const dir = tmp();
  const raw = execFileSync(process.execPath, [CLI, 'init', '--cwd', dir, '--lang', 'en'], { encoding: 'utf8' });
  const out = JSON.parse(raw);
  assert.equal(out.cwd, dir);
  assert.ok(fs.existsSync(path.join(dir, 'deploy-units.json')));
});
