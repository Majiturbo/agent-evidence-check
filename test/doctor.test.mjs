import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctor } from '../src/doctor.mjs';
import { validateUnits, loadDeployUnits } from '../src/config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'agent-evidence-check.mjs');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dc-doc-'));
}

test('validateUnits warns on bad observe and duplicate ids', () => {
  const w = validateUnits([
    { id: 'a', observe: { type: 'http_json', url: 'https://example.com' } },
    { id: 'a', verify: 'manual only' },
    { id: 'b', observe: { type: 'nope' } },
  ]);
  assert.ok(w.some((x) => /duplicate/.test(x)));
  assert.ok(w.some((x) => /http_json needs url \+ field/.test(x)));
  assert.ok(w.some((x) => /unknown observe.type/.test(x)));
  assert.ok(w.some((x) => /manual/.test(x)));
});

test('doctor: enrolled temp repo + fake HOME without hooks', () => {
  const dir = tmp();
  const home = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i'], {
    cwd: dir,
  });
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({
      units: [{ id: 'api', observe: { type: 'literal', value: 'x' } }],
    }),
  );

  const out = doctor({ cwd: dir, home, packageRoot: ROOT });
  assert.equal(out.ok, true);
  assert.ok(out.checks.find((c) => c.id === 'enrolled').ok);
  assert.equal(out.checks.find((c) => c.id === 'user_hooks').ok, false);
  const gates = out.checks.find((c) => c.id === 'judgment_gates');
  assert.ok(gates);
  assert.equal(gates.detail.stopGate, false);
  assert.equal(gates.detail.doneGate, false);
  assert.ok(gates.detail.done);
  assert.ok(out.next.some((s) => /install-hooks|agent-evidence-check-install-hooks|deploy-check-install-hooks/.test(s)));
  assert.ok(out.next.some((s) => /judgments|stopGate|doneGate/.test(s)));
  // packageRoot may be this clone's absolute path; advice strings must stay portable
  assert.ok(out.next.every((s) => !/\/Users\//.test(s)));
});

test('doctor: not enrolled suggests init', () => {
  const dir = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i'], {
    cwd: dir,
  });
  const out = doctor({ cwd: dir, home: tmp(), packageRoot: ROOT });
  assert.equal(out.checks.find((c) => c.id === 'enrolled').ok, false);
  assert.match(out.checks.find((c) => c.id === 'enrolled').fix, /init/);
});

test('loadDeployUnits returns warnings for manual units', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ units: [{ id: 'x', verify: 'look' }] }));
  const loaded = loadDeployUnits(dir);
  assert.ok(loaded.warnings.some((w) => /manual/.test(w)));
});

test('CLI doctor subcommand', () => {
  const dir = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i'], {
    cwd: dir,
  });
  const raw = execFileSync(process.execPath, [CLI, 'doctor', '--cwd', dir], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tmp() },
  });
  const out = JSON.parse(raw);
  assert.equal(out.ok, true);
  assert.equal(out.checks.find((c) => c.id === 'enrolled').ok, false);
});
