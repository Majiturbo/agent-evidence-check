import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectFlavor, extractCommand, extractCwd, extractToolName, isShellTool } from '../hooks/bridge.mjs';

test('detect Cursor / PreToolUse / Copilot', () => {
  assert.equal(detectFlavor({ command: 'git status', cwd: '/tmp' }), 'cursor');
  assert.equal(
    detectFlavor({ tool_name: 'RunCommand', tool_input: { command: 'git stash' }, hook_event_name: 'PreToolUse' }),
    'pretool',
  );
  assert.equal(detectFlavor({ toolName: 'bash', toolArgs: { command: 'ssh x' }, sessionId: '1', cwd: '/tmp' }), 'copilot');
  assert.equal(detectFlavor({}), 'unknown');
});

test('extract Trae RunCommand and Copilot toolArgs', () => {
  assert.equal(extractToolName({ tool_name: 'RunCommand' }, 'pretool'), 'RunCommand');
  assert.equal(extractCommand({ tool_input: { command: 'docker compose up' } }, 'pretool'), 'docker compose up');
  assert.equal(extractCommand({ toolArgs: { command: 'npm run deploy' } }, 'copilot'), 'npm run deploy');
  assert.equal(isShellTool('RunCommand'), true);
  assert.equal(isShellTool('Edit'), false);
  assert.equal(extractCwd({ cwd: '/a' }), '/a');
});
