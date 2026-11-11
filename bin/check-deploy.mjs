#!/usr/bin/env node
/**
 * CLI for deploy-check.
 *
 *   deploy-check init [--cwd DIR] [--lang en|zh] [--force] [--with-copilot-hook]
 *   deploy-check doctor [--cwd DIR]
 *   deploy-check [--cwd DIR] [--commit SHA] [--config PATH] [--shadow|--block]
 *   deploy-check verify [--cwd DIR] [--commit SHA] [--unit ID]...
 *       [--observed JSON|@file] [--timeout MS] [--shadow|--block]
 *   deploy-check direction --moment start|turn --goal TEXT --path TEXT
 *       --nearer TEXT --why TEXT --evidence TEXT [--cwd DIR] [--shadow|--block]
 *   deploy-check loop --target NAME --edits N --rejections N [--claims-fixed]
 *       --tried CLASS [--next CLASS] [--alternative CLASS]... [--cwd DIR] [--shadow|--block]
 *   deploy-check done [--cwd DIR] [--command CMD] [--exit-code N] [--no-run] [--shadow|--block]
 */

import fs from 'node:fs';
import path from 'node:path';
import { preDeploy, verifyDeploy, reviewDirection, reviewLoop, reviewDone } from '../src/api.mjs';
import { initConsumer } from '../src/init.mjs';
import { doctor } from '../src/doctor.mjs';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

function flags(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[++i]);
  }
  return out;
}

function parseObserved(raw) {
  if (raw == null || raw === '') return {};
  const text = raw.startsWith('@') ? fs.readFileSync(raw.slice(1), 'utf8') : raw;
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--observed must be a JSON object of { unitId: fingerprint }');
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}

function modeFromArgv() {
  if (process.argv.includes('--block')) return 'block';
  if (process.argv.includes('--shadow')) return 'shadow';
  return 'advisory';
}

function help() {
  console.log(`Usage:
  deploy-check init [--cwd DIR] [--lang en|zh] [--force] [--with-copilot-hook]
  deploy-check doctor [--cwd DIR]
  deploy-check [--cwd DIR] [--commit SHA] [--config PATH] [--shadow|--block]
  deploy-check verify [--cwd DIR] [--commit SHA] [--unit ID]...
      [--observed '{"id":"fp"}'|@file.json] [--timeout MS] [--shadow|--block]
  deploy-check direction --moment start|turn --goal TEXT --path TEXT \\
      --nearer TEXT --why TEXT --evidence TEXT [--cwd DIR] [--shadow|--block]
  deploy-check loop --target NAME --edits N --rejections N [--claims-fixed] \\
      --tried CLASS [--next CLASS] [--alternative CLASS]... [--cwd DIR] [--shadow|--block]
  deploy-check done [--cwd DIR] [--command CMD] [--exit-code N] [--no-run] [--timeout MS] \\
      [--shadow|--block]
  deploy-check-mcp          # stdio MCP server (see docs/mcp.md)
`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    help();
    return;
  }

  const sub = ['init', 'doctor', 'verify', 'post-deploy', 'pre-deploy', 'direction', 'loop', 'done'].includes(
    process.argv[2],
  )
    ? process.argv[2]
    : 'pre-deploy';
  const cwd = path.resolve(arg('--cwd', process.cwd()));

  if (sub === 'init') {
    console.log(
      JSON.stringify(
        initConsumer({
          cwd,
          lang: arg('--lang', 'en'),
          force: process.argv.includes('--force'),
          withCopilotHook: process.argv.includes('--with-copilot-hook'),
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (sub === 'doctor') {
    const out = doctor({ cwd });
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 1;
    return;
  }

  const mode = modeFromArgv();
  const commit = arg('--commit', null);
  const configPath = arg('--config', null);

  if (sub === 'direction' || sub === 'loop' || sub === 'done') {
    const out =
      sub === 'direction'
        ? reviewDirection({
            cwd,
            configPath,
            mode,
            moment: arg('--moment', ''),
            goal: arg('--goal', ''),
            path: arg('--path', ''),
            nearer: arg('--nearer', ''),
            whyNotNearer: arg('--why', ''),
            evidence: arg('--evidence', ''),
          })
        : sub === 'loop'
          ? reviewLoop({
              cwd,
              configPath,
              mode,
              target: arg('--target', ''),
              edits: Number(arg('--edits', '0')),
              rejections: Number(arg('--rejections', '0')),
              claimsFixed: process.argv.includes('--claims-fixed'),
              tried: arg('--tried', ''),
              next: arg('--next', ''),
              alternatives: flags('--alternative'),
            })
          : await reviewDone({
              cwd,
              configPath,
              mode,
              command: arg('--command', undefined),
              exitCode: process.argv.includes('--exit-code') ? Number(arg('--exit-code', '1')) : null,
              run: !process.argv.includes('--no-run'),
              timeoutMs: Number(arg('--timeout', 120_000)),
            });
    const { cards, mcp, agui, ...rest } = out;
    console.log(JSON.stringify(rest, null, 2));
    if (mode === 'block' && !out.ok) process.exit(2);
    return;
  }

  if (sub === 'pre-deploy') {
    const out = preDeploy({ cwd, commit, configPath, mode });
    const { cards, mcp, agui, ...rest } = out;
    console.log(JSON.stringify(rest, null, 2));
    if (mode === 'block' && !out.ok) process.exit(2);
    return;
  }

  const out = await verifyDeploy({
    cwd,
    commit,
    configPath,
    mode,
    unitIds: flags('--unit'),
    observed: parseObserved(arg('--observed', null)),
    timeoutMs: Number(arg('--timeout', 10_000)),
  });
  const { cards, mcp, agui, ...rest } = out;
  console.log(JSON.stringify(rest, null, 2));
  if (mode === 'block' && !out.ok) process.exit(2);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(2);
});
