import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dig, getObserveSpec, observeUnits } from '../src/observe/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'agent-evidence-check.mjs');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dc-obs-'));
}

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

test('dig and getObserveSpec', () => {
  assert.equal(dig({ a: { b: 1 } }, 'a.b'), 1);
  assert.equal(getObserveSpec({ verify: 'human' }), null);
  assert.equal(getObserveSpec({ observe: { type: 'literal', value: 'x' } }).type, 'literal');
  assert.equal(getObserveSpec({ verify: { type: 'literal', value: 'y' } }).value, 'y');
});

test('observeUnits: http_json, file_sha256, command, manual, errors', async () => {
  const dir = tmp();
  const file = path.join(dir, 'admin.html');
  fs.writeFileSync(file, 'hello-admin');
  const sha = createHash('sha256').update('hello-admin').digest('hex');

  const srv = await startServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ build_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', nested: { id: 'n1' } }));
      return;
    }
    if (req.url === '/plain') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('build=deadbeef\n');
      return;
    }
    res.writeHead(500);
    res.end('nope');
  });

  try {
    const { observed, observations } = await observeUnits(
      [
        { id: 'api', observe: { type: 'http_json', url: `${srv.url}/health`, field: 'build_sha' } },
        { id: 'nested', observe: { type: 'http_json', url: `${srv.url}/health`, field: 'nested.id' } },
        { id: 'text', observe: { type: 'http_text', url: `${srv.url}/plain`, pattern: 'build=(\\w+)' } },
        { id: 'static', observe: { type: 'file_sha256', path: 'admin.html' } },
        { id: 'cmd', observe: { type: 'command', run: 'node -e "process.stdout.write(\'cmd-ok\')"' } },
        { id: 'manual', verify: 'look at the dashboard' },
        { id: 'bad', observe: { type: 'http_json', url: `${srv.url}/missing`, field: 'x' } },
      ],
      { cwd: dir },
    );

    assert.equal(observed.api, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(observed.nested, 'n1');
    assert.equal(observed.text, 'deadbeef');
    assert.equal(observed.static, sha);
    assert.equal(observed.cmd, 'cmd-ok');
    assert.equal(observed.manual, undefined);
    assert.equal(observations.find((o) => o.id === 'manual').status, 'manual');
    assert.equal(observations.find((o) => o.id === 'bad').status, 'error');
  } finally {
    await srv.close();
  }
});

test('CLI verify: mismatch then match with --observed', async () => {
  const dir = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], {
    cwd: dir,
  });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({
      lang: 'en',
      units: [
        { id: 'api', observe: { type: 'literal', value: sha } },
        { id: 'admin', verify: 'manual screenshot' },
      ],
    }),
  );

  const run = (args) =>
    execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });

  const bad = JSON.parse(run(['verify', '--cwd', dir]));
  assert.equal(bad.ok, false);
  assert.ok(bad.findings.some((f) => f.checkId === 'units_match'));
  assert.deepEqual(bad.manualPending, ['admin']);

  const good = JSON.parse(
    run(['verify', '--cwd', dir, '--observed', JSON.stringify({ admin: sha })]),
  );
  assert.equal(good.ok, true);
  assert.equal(good.observed.api, sha);
  assert.equal(good.observed.admin, sha);
});

test('CLI verify respects expectFingerprint for host files', () => {
  const dir = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], {
    cwd: dir,
  });
  const body = 'static-v2';
  fs.writeFileSync(path.join(dir, 'admin.html'), body);
  const fp = createHash('sha256').update(body).digest('hex');
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({
      units: [{ id: 'admin', observe: { type: 'file_sha256', path: 'admin.html' }, expectFingerprint: fp }],
    }),
  );
  const out = JSON.parse(execFileSync(process.execPath, [CLI, 'verify', '--cwd', dir], { encoding: 'utf8' }));
  assert.equal(out.ok, true);
  assert.equal(out.observed.admin, fp);
});
