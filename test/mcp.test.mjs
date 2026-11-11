import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, consumeLines, handle, TOOLS, writeMessage } from '../src/mcp/stdio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(ROOT, 'bin', 'agent-evidence-check-mcp.mjs');

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-mcp-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], {
    cwd: dir,
  });
  return dir;
}

test('tools catalog names', () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name).sort(),
    ['deploy_check_direction', 'deploy_check_done', 'deploy_check_loop', 'deploy_check_pre', 'deploy_check_verify'],
  );
});

test('handle initialize and tools/list', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(init.result.serverInfo.name, 'agent-evidence-check');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(list.result.tools.length, 5);
});

test('callTool pre + verify on temp enrolled repo', async () => {
  const dir = tmpRepo();
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  fs.writeFileSync(
    path.join(dir, 'deploy-units.json'),
    JSON.stringify({ units: [{ id: 'api', observe: { type: 'literal', value: sha } }] }),
  );

  const pre = await callTool('deploy_check_pre', { cwd: dir });
  const preBody = JSON.parse(pre.content[0].text);
  assert.equal(preBody.enrolled, true);
  assert.equal(preBody.ok, false); // unpushed in a fresh repo

  const verify = await callTool('deploy_check_verify', { cwd: dir });
  const v = JSON.parse(verify.content[0].text);
  assert.equal(v.ok, true);
  assert.equal(v.observed.api, sha);
});

test('newline-delimited stdio round-trip with real process', async () => {
  const dir = tmpRepo();
  fs.writeFileSync(path.join(dir, 'deploy-units.json'), JSON.stringify({ units: [{ id: 'api' }] }));

  const child = spawn(process.execPath, [MCP], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = Buffer.alloc(0);
  child.stdout.on('data', (c) => {
    out = Buffer.concat([out, c]);
  });

  const send = (obj) => writeMessage(obj, child.stdin);

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'deploy_check_pre', arguments: { cwd: dir } },
  });

  const deadline = Date.now() + 5000;
  let messages = [];
  while (Date.now() < deadline && messages.length < 3) {
    await new Promise((r) => setTimeout(r, 50));
    const parsed = consumeLines(out);
    out = parsed.rest;
    messages = messages.concat(parsed.messages);
  }
  child.kill();

  assert.ok(messages.some((m) => m.id === 1 && m.result?.serverInfo?.name === 'agent-evidence-check'));
  assert.ok(messages.some((m) => m.id === 2 && m.result?.tools?.length === 5));
  const call = messages.find((m) => m.id === 3);
  assert.ok(call?.result?.content?.[0]?.text);
  const body = JSON.parse(call.result.content[0].text);
  assert.equal(body.phase, 'pre-deploy');
  assert.equal(body.enrolled, true);
});
