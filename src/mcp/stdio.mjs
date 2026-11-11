/**
 * Minimal MCP server over stdio.
 * JSON-RPC 2.0, one message per line (no embedded newlines). Not LSP Content-Length framing.
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */

import { preDeploy, reviewDirection, reviewDone, reviewLoop, verifyDeploy } from '../api.mjs';

const SERVER_INFO = { name: 'agent-evidence-check', version: '0.2.0' };
const PROTOCOL = '2024-11-05';

export const TOOLS = [
  {
    name: 'deploy_check_pre',
    description:
      'Run pre-deploy evidence checks (dirty tree, explicit SHA, pushed, units declared). Call before ssh/rsync/kubectl/docker compose deploy. Returns ok, findings, and MCP elicitation payloads when blocked.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Path to the app git repo (default: process cwd)' },
        commit: { type: 'string', description: 'Target git SHA (default: HEAD)' },
        mode: { type: 'string', enum: ['advisory', 'shadow', 'block'], description: 'Default advisory' },
      },
    },
  },
  {
    name: 'deploy_check_verify',
    description:
      'After deploy: observe each unit (http_json / file_sha256 / command / …) and match against the target commit. Call before saying "it\'s live". Pass observed fingerprints for manual units.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Path to the app git repo' },
        commit: { type: 'string', description: 'Target git SHA (default: HEAD)' },
        mode: { type: 'string', enum: ['advisory', 'shadow', 'block'] },
        unitIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Limit to these unit ids',
        },
        observed: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Manual fingerprints { unitId: value }',
        },
        timeoutMs: { type: 'number', description: 'Per-observe timeout (default 10000)' },
      },
    },
  },
  {
    name: 'deploy_check_direction',
    description:
      'At project start or a mid-course turn, record a third-person read: goal, current path, a different nearer path, why you are or are not taking it, and one fact. Call before continuing the old path. Does not read the chat.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Path to the app git repo' },
        mode: { type: 'string', enum: ['advisory', 'shadow', 'block'] },
        moment: { type: 'string', enum: ['start', 'turn'] },
        goal: { type: 'string' },
        path: { type: 'string', description: 'The path you are about to continue' },
        nearer: { type: 'string', description: 'A different nearer path' },
        whyNotNearer: { type: 'string', description: 'Why you are taking it, or why not' },
        evidence: { type: 'string', description: 'One fact: a file, a constraint, or the user sentence' },
      },
      required: ['moment', 'goal', 'path', 'nearer', 'whyNotNearer', 'evidence'],
    },
  },
  {
    name: 'deploy_check_loop',
    description:
      'Before saying a repeated fix is done: pass how many times this target was edited, how many times the user rejected it, the approach class already tried, and the next class. A passing next step must be a different class listed in alternatives.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string' },
        mode: { type: 'string', enum: ['advisory', 'shadow', 'block'] },
        target: { type: 'string', description: 'File or symptom being repeated' },
        edits: { type: 'number' },
        rejections: { type: 'number', description: 'Times the user said this approach is still wrong' },
        claimsFixed: { type: 'boolean', description: 'True when about to say fixed or done' },
        tried: { type: 'string', description: 'Approach class already used' },
        next: { type: 'string', description: 'Approach class of the next step' },
        alternatives: {
          type: 'array',
          items: { type: 'string' },
          description: 'Other approach classes. next must be one of these and must differ from tried',
        },
      },
      required: ['target', 'edits', 'rejections', 'tried'],
    },
  },
  {
    name: 'deploy_check_done',
    description:
      'Before saying done / fixed / tests pass: run (or report) the configured test command and check the uncommitted test diff was not washed (deleted tests, skip, assert True). Prefer this over claiming green from chat.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string' },
        mode: { type: 'string', enum: ['advisory', 'shadow', 'block'] },
        command: { type: 'string', description: 'Override done.testCommand' },
        exitCode: {
          type: 'number',
          description: 'If you already ran tests, pass the exit code and set run false',
        },
        run: { type: 'boolean', description: 'Run the test command (default true unless exitCode set)' },
        timeoutMs: { type: 'number' },
      },
    },
  },
];

function toolPayload(structured) {
  const { cards, mcp, agui, ...rest } = structured;
  const body = { ...rest, elicitations: mcp };
  return {
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    // Keep full cards for hosts that read structuredContent
    structuredContent: { ...rest, cards, elicitations: mcp, agui },
  };
}

export async function callTool(name, args = {}) {
  if (name === 'deploy_check_pre') {
    return toolPayload(
      preDeploy({
        cwd: args.cwd,
        commit: args.commit || null,
        mode: args.mode || 'advisory',
      }),
    );
  }
  if (name === 'deploy_check_direction') {
    return toolPayload(
      reviewDirection({
        cwd: args.cwd,
        mode: args.mode || 'advisory',
        moment: args.moment,
        goal: args.goal,
        path: args.path,
        nearer: args.nearer,
        whyNotNearer: args.whyNotNearer,
        evidence: args.evidence,
      }),
    );
  }
  if (name === 'deploy_check_loop') {
    return toolPayload(
      reviewLoop({
        cwd: args.cwd,
        mode: args.mode || 'advisory',
        target: args.target,
        edits: args.edits,
        rejections: args.rejections,
        claimsFixed: args.claimsFixed,
        tried: args.tried,
        next: args.next,
        alternatives: args.alternatives,
      }),
    );
  }
  if (name === 'deploy_check_done') {
    return toolPayload(
      await reviewDone({
        cwd: args.cwd,
        mode: args.mode || 'advisory',
        command: args.command,
        exitCode: args.exitCode,
        run: args.run,
        timeoutMs: args.timeoutMs,
      }),
    );
  }
  if (name === 'deploy_check_verify') {
    return toolPayload(
      await verifyDeploy({
        cwd: args.cwd,
        commit: args.commit || null,
        mode: args.mode || 'advisory',
        unitIds: args.unitIds,
        observed: args.observed,
        timeoutMs: args.timeoutMs,
      }),
    );
  }
  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
}

/** One JSON-RPC message per line. JSON.stringify escapes any newlines inside strings. */
export function writeMessage(obj, stdout = process.stdout) {
  stdout.write(JSON.stringify(obj) + '\n');
}

export async function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0') return null;

  if (msg.id === undefined || msg.id === null) {
    return null; // notifications
  }

  try {
    switch (msg.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          },
        };
      case 'ping':
        return { jsonrpc: '2.0', id: msg.id, result: {} };
      case 'tools/list':
        return { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
      case 'tools/call': {
        const result = await callTool(msg.params?.name, msg.params?.arguments || {});
        return { jsonrpc: '2.0', id: msg.id, result };
      }
      default:
        return {
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32601, message: `Method not found: ${msg.method}` },
        };
    }
  } catch (e) {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32000, message: e.message || String(e) },
    };
  }
}

/** Split a UTF-8 buffer into newline-delimited JSON messages. Keeps an incomplete tail. */
export function consumeLines(buffer) {
  const messages = [];
  let rest = buffer;
  while (true) {
    const nl = rest.indexOf('\n');
    if (nl === -1) break;
    const line = rest.slice(0, nl).toString('utf8').replace(/\r$/, '').trim();
    rest = rest.slice(nl + 1);
    if (!line) continue;
    try {
      messages.push(JSON.parse(line));
    } catch (e) {
      process.stderr.write(`agent-evidence-check-mcp: bad JSON line: ${e.message}\n`);
    }
  }
  return { messages, rest };
}

/** Start newline-delimited MCP server on stdin/stdout. Logs go to stderr only. */
export function startStdioServer({ stdin = process.stdin, stdout = process.stdout } = {}) {
  let buf = Buffer.alloc(0);
  stdin.on('data', (chunk) => {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    const { messages, rest } = consumeLines(buf);
    buf = rest;
    for (const msg of messages) {
      Promise.resolve(handle(msg)).then((out) => {
        if (out) writeMessage(out, stdout);
      });
    }
  });
}
