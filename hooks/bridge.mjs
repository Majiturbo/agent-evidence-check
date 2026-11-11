#!/usr/bin/env node
/**
 * Multi-host stdin bridge.
 *
 * Dialects (see docs/adapters.md):
 *   cursor / pretool / copilot — deploy shell gates (beforeShell)
 *   stop-claude / stop-cursor  — direction/loop stop gates (opt-in via judgments.*)
 *   edit                       — Edit/Write edit gate (opt-in)
 *
 * Env: DEPLOY_CHECK_MODE, DEPLOY_CHECK_LANG, DEPLOY_UNITS_PATH, DEPLOY_CHECK_ROOT
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeShell } from '../src/adapters/cursor-shell-hook.mjs';
import { loadDeployUnits } from '../src/config.mjs';
import { createLocalGit } from '../src/git/local.mjs';
import { resolveLang, t } from '../src/i18n.mjs';
import { evaluateEditGate, evaluateStopGate, loadReceipts, noteEdit } from '../src/receipts.mjs';

const ROOT = process.env.DEPLOY_CHECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHELL_TOOLS = new Set([
  'bash',
  'Bash',
  'powershell',
  'PowerShell',
  'RunCommand',
  'shell',
  'Shell',
  'terminal',
  'Terminal',
]);

const EDIT_TOOLS = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'StrReplace',
  'SearchReplace',
  'ApplyPatch',
  'edit',
  'write',
]);

function readStdin() {
  return new Promise((resolve, reject) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      s += c;
      if (s.length > 2e6) reject(new Error('stdin too large'));
    });
    process.stdin.on('end', () => {
      if (!s.trim()) return resolve({});
      try {
        resolve(JSON.parse(s));
      } catch (e) {
        reject(e);
      }
    });
    process.stdin.on('error', reject);
  });
}

/** @returns {'cursor'|'pretool'|'copilot'|'unknown'} */
export function detectFlavor(input) {
  if (!input || typeof input !== 'object') return 'unknown';
  if (typeof input.toolName === 'string' || (input.toolArgs != null && input.sessionId)) return 'copilot';
  if (input?.tool_input != null || input?.tool_name || input?.hook_event_name === 'PreToolUse') return 'pretool';
  if (input?.hookEventName === 'PreToolUse') return 'pretool';
  if (typeof input?.command === 'string') return 'cursor';
  return 'unknown';
}

/**
 * @returns {'shell'|'stop-claude'|'stop-cursor'|'edit'|'unknown'}
 */
export function detectEvent(input) {
  if (!input || typeof input !== 'object') return 'unknown';
  const hook = input.hook_event_name || input.hookEventName || '';
  if (hook === 'Stop' || hook === 'SubagentStop') return 'stop-claude';
  if (typeof input.status === 'string' && 'loop_count' in input && typeof input.command !== 'string') {
    return 'stop-cursor';
  }
  const flavor = detectFlavor(input);
  const toolName = extractToolName(input, flavor === 'unknown' ? 'pretool' : flavor);
  if (EDIT_TOOLS.has(toolName)) return 'edit';
  if (flavor === 'unknown') return 'unknown';
  return 'shell';
}

export function extractToolName(input, flavor) {
  if (flavor === 'copilot') return String(input.toolName || input.tool_name || '');
  if (flavor === 'pretool' || flavor === 'edit') return String(input.tool_name || input.toolName || '');
  return 'Bash';
}

export function extractCommand(input, flavor) {
  if (flavor === 'copilot') {
    const args = input.toolArgs || input.tool_input || {};
    if (typeof args === 'string') {
      try {
        const parsed = JSON.parse(args);
        return String(parsed.command || parsed.cmd || '');
      } catch {
        return args;
      }
    }
    return String(args.command || args.cmd || '');
  }
  if (flavor === 'pretool') return String(input.tool_input?.command || input.tool_input?.cmd || '');
  return String(input.command || input.cmd || '');
}

export function extractCwd(input) {
  return (
    input.cwd ||
    input.working_directory ||
    input.workingDirectory ||
    input.tool_input?.cwd ||
    input.toolArgs?.cwd ||
    input.workspaceRoots?.[0] ||
    process.cwd()
  );
}

export function extractEditFile(input) {
  const args = input.tool_input || input.toolArgs || input;
  return String(
    args.file_path ||
      args.filePath ||
      args.path ||
      args.file ||
      (Array.isArray(args.edits) && args.edits[0]?.file_path) ||
      '',
  );
}

export function extractSessionId(input) {
  return String(input.session_id || input.sessionId || input.conversation_id || input.composerId || 'default');
}

export function isShellTool(name) {
  if (!name) return true;
  return SHELL_TOOLS.has(name);
}

function mapPermission(mode, result) {
  const p = result.permission || 'allow';
  if (mode === 'shadow') return 'allow';
  return p;
}

function decisionFrom(mode, result) {
  const permission = mapPermission(mode, result);
  if (mode === 'shadow') return 'allow';
  if (permission === 'allow') return 'allow';
  return 'deny';
}

function emitCursor(result, mode, meta, lang) {
  const permission = mapPermission(mode, result);
  const out = { permission, _deploy_check: meta };
  if (result.reason) {
    out.agent_message = result.reason;
    if (permission !== 'allow') out.user_message = `${t(lang, 'hook.header', mode)}\n\n${result.reason}`;
  }
  console.log(JSON.stringify(out));
}

function emitPreTool(result, mode, meta, lang) {
  const decision = decisionFrom(mode, result);
  const reason = result.reason || '';
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason || (decision === 'allow' ? 'deploy-check ok' : t(lang, 'hook.blocked')),
      },
      permissionDecision: decision,
      permissionDecisionReason: reason || undefined,
      _deploy_check: meta,
    }),
  );
  if (decision === 'deny' && mode === 'block') process.exitCode = 2;
}

function emitCopilot(result, mode, meta, lang) {
  const decision = decisionFrom(mode, result);
  const reason = result.reason || '';
  console.log(
    JSON.stringify({
      permissionDecision: decision,
      permissionDecisionReason: reason || (decision === 'allow' ? 'deploy-check ok' : t(lang, 'hook.blocked')),
      _deploy_check: meta,
    }),
  );
  if (decision === 'deny' && mode === 'block') process.exitCode = 2;
}

function emitStopClaude(block, reason, meta) {
  if (!block) {
    console.log(JSON.stringify({ _deploy_check: meta }));
    return;
  }
  console.log(JSON.stringify({ decision: 'block', reason, _deploy_check: meta }));
}

function emitStopCursor(block, reason, meta) {
  if (!block) {
    console.log(JSON.stringify({ _deploy_check: meta }));
    return;
  }
  console.log(JSON.stringify({ followup_message: reason, _deploy_check: meta }));
}

function allowPassthrough(flavor, msg) {
  if (flavor === 'copilot') {
    console.log(JSON.stringify({ permissionDecision: 'allow', permissionDecisionReason: msg }));
  } else if (flavor === 'pretool' || flavor === 'edit') {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: msg,
        },
        permissionDecision: 'allow',
      }),
    );
  } else if (flavor === 'stop-claude' || flavor === 'stop-cursor') {
    console.log(JSON.stringify({}));
  } else {
    console.log(JSON.stringify({ permission: 'allow', agent_message: msg }));
  }
}

function gateReason(lang, gate) {
  if (gate.kind === 'direction') return t(lang, 'gate.direction');
  if (gate.kind === 'loop') return t(lang, 'gate.loop');
  if (gate.kind === 'done') return t(lang, 'gate.done');
  if (gate.count != null) return t(lang, 'gate.edit', gate.file || '_', gate.count, gate.minEdits);
  return t(lang, 'hook.blocked');
}

async function main() {
  const input = await readStdin();
  const event = detectEvent(input);
  const flavor = detectFlavor(input);
  const cwd = extractCwd(input);
  const mode = process.env.DEPLOY_CHECK_MODE || 'advisory';
  const sessionId = extractSessionId(input);
  let lang = resolveLang(null);

  if (event === 'unknown' && flavor === 'unknown') {
    allowPassthrough('cursor', t(lang, 'hook.unrecognized'));
    return;
  }

  const loaded = loadDeployUnits(cwd, process.env.DEPLOY_UNITS_PATH || undefined);
  if (!loaded.path) {
    if (event === 'stop-claude' || event === 'stop-cursor') allowPassthrough(event, t(lang, 'hook.not_enrolled'));
    else allowPassthrough(flavor === 'unknown' ? 'pretool' : flavor, t(lang, 'hook.not_enrolled'));
    return;
  }

  lang = resolveLang(loaded.lang);
  const root = loaded.root || cwd;
  const metaBase = { root: ROOT, cwd, mode, event, unitsFile: loaded.path, sessionId };

  if (event === 'stop-claude' || event === 'stop-cursor') {
    const receipts = loadReceipts(root, sessionId);
    const gate = evaluateStopGate(receipts, {
      enabled: mode !== 'shadow' && loaded.judgments.stopGate,
      doneEnabled: mode !== 'shadow' && loaded.judgments.doneGate,
      stopHookActive: Boolean(input.stop_hook_active),
      loopCount: Number(input.loop_count) || 0,
      loopLimit: 3,
      minEdits: loaded.loop.minEdits,
    });
    const meta = { ...metaBase, gate: gate.block ? gate.kind : null };
    const reason = gate.block ? gateReason(lang, gate) : '';
    if (event === 'stop-claude') emitStopClaude(gate.block, reason, meta);
    else emitStopCursor(gate.block, reason, meta);
    return;
  }

  if (event === 'edit') {
    const file = extractEditFile(input);
    const receipts = noteEdit(root, { sessionId, file });
    const gate = evaluateEditGate(receipts, {
      enabled: mode !== 'shadow' && loaded.judgments.editGate,
      file,
      minEdits: loaded.loop.minEdits,
    });
    const meta = { ...metaBase, file, editCount: gate.count || receipts.edits[file] || 0 };
    if (gate.block) {
      emitPreTool({ permission: 'deny', reason: gateReason(lang, gate) }, mode, meta, lang);
    } else {
      allowPassthrough('pretool', 'deploy-check: edit ok');
    }
    return;
  }

  // shell deploy path
  const toolName = extractToolName(input, flavor);
  const command = extractCommand(input, flavor);
  if (!isShellTool(toolName) || !command) {
    allowPassthrough(flavor, t(lang, 'hook.not_shell'));
    return;
  }

  const git = createLocalGit(cwd);
  const result = beforeShell({
    command,
    cwd,
    mode,
    context: { git, lang, config: { units: loaded.units, deployCommands: loaded.deployCommands, lang } },
  });
  const meta = {
    ...metaBase,
    flavor,
    toolName,
    findings: result.verdict?.findings?.map((f) => f.checkId) || [],
  };

  if (flavor === 'copilot') emitCopilot(result, mode, meta, lang);
  else if (flavor === 'pretool') emitPreTool(result, mode, meta, lang);
  else emitCursor(result, mode, meta, lang);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.log(
      JSON.stringify({
        permission: 'allow',
        permissionDecision: 'allow',
        permissionDecisionReason: `deploy-check error (fail open): ${e.message}`,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: `deploy-check error (fail open): ${e.message}`,
        },
        agent_message: `deploy-check error (fail open): ${e.message}`,
      }),
    );
  });
}
