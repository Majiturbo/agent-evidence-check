/**
 * Library API shared by the CLI and the MCP server.
 * Callers pass cwd / commit / mode; no process.argv parsing here.
 */

import path from 'node:path';
import { check } from './checks/index.mjs';
import { createLocalGit } from './git/local.mjs';
import { loadDeployUnits } from './config.mjs';
import { observeUnits } from './observe/index.mjs';
import { resolveLang, t } from './i18n.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { noteDirection, noteDone, noteLoop } from './receipts.mjs';

const execFileAsync = promisify(execFile);

/**
 * @param {{ cwd?: string, commit?: string|null, configPath?: string|null, mode?: string }} opts
 */
function notEnrolled(phase, cwd, lang) {
  return {
    phase,
    cwd,
    enrolled: false,
    ok: false,
    allow: true,
    error: t(lang, 'hook.not_enrolled'),
    lang,
    findings: [],
    cards: [],
    mcp: [],
    agui: [],
  };
}

function judgment(phase, opts, event) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const mode = opts.mode || 'advisory';
  const loaded = loadDeployUnits(cwd, opts.configPath || null);
  const lang = resolveLang(opts.lang || loaded.lang);
  if (!loaded.path) return notEnrolled(phase, cwd, lang);
  const verdict = check(event, {
    mode,
    lang,
    git: opts.git || createLocalGit(cwd),
    config: {
      units: loaded.units,
      deployCommands: loaded.deployCommands,
      lang,
      loop: loaded.loop,
      done: loaded.done,
    },
  });
  if (verdict.ok) {
    const root = loaded.root || cwd;
    const sessionId = opts.sessionId || 'default';
    if (phase === 'direction') noteDirection(root, { sessionId, moment: opts.moment });
    if (phase === 'loop') noteLoop(root, { sessionId, target: opts.target });
    if (phase === 'done') noteDone(root, { sessionId, testCommand: event.testCommand, exitCode: event.exitCode });
  }
  return {
    phase,
    cwd,
    enrolled: true,
    mode: verdict.mode,
    lang,
    ok: verdict.ok,
    allow: verdict.allow,
    findings: verdict.findings,
    cards: verdict.cards,
    mcp: verdict.mcp,
    agui: verdict.agui,
    receipt: verdict.ok,
  };
}

/**
 * Project start or a turn. Fields are the third-person record; this does not call a model.
 * @param {{ cwd?: string, configPath?: string|null, mode?: string, lang?: string, moment?: string, goal?: string, path?: string, nearer?: string, whyNotNearer?: string, evidence?: string }} opts
 */
export function reviewDirection(opts = {}) {
  return judgment('direction', opts, {
    type: 'direction',
    moment: opts.moment,
    goal: opts.goal,
    path: opts.path,
    nearer: opts.nearer,
    whyNotNearer: opts.whyNotNearer,
    evidence: opts.evidence,
  });
}

/**
 * Repair-loop evidence. Counts and approach classes come from the caller.
 * @param {{ cwd?: string, configPath?: string|null, mode?: string, lang?: string, target?: string, edits?: number, rejections?: number, claimsFixed?: boolean, tried?: string, next?: string, alternatives?: string[] }} opts
 */
export function reviewLoop(opts = {}) {
  return judgment('loop', opts, {
    type: 'loop',
    target: opts.target,
    edits: opts.edits,
    rejections: opts.rejections,
    claimsFixed: opts.claimsFixed,
    tried: opts.tried,
    next: opts.next,
    alternatives: opts.alternatives,
  });
}

/**
 * Before saying done: green test exit + tests not washed in the uncommitted diff.
 * Runs `done.testCommand` unless exitCode is already supplied.
 * @param {{ cwd?: string, configPath?: string|null, mode?: string, lang?: string, sessionId?: string, command?: string, exitCode?: number|null, run?: boolean, timeoutMs?: number }} opts
 */
export async function reviewDone(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const mode = opts.mode || 'advisory';
  const loaded = loadDeployUnits(cwd, opts.configPath || null);
  const lang = resolveLang(opts.lang || loaded.lang);
  if (!loaded.path) return notEnrolled('done', cwd, lang);

  const testCommand = String(opts.command || loaded.done?.testCommand || '').trim();
  let exitCode = opts.exitCode;
  let stdout = '';
  let stderr = '';
  const shouldRun = opts.run !== false && (exitCode == null || exitCode === '');
  if (shouldRun && testCommand) {
    const shell = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/bash';
    const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', testCommand] : ['-lc', testCommand];
    try {
      const r = await execFileAsync(shell, shellArgs, {
        cwd: loaded.root || cwd,
        timeout: Number(opts.timeoutMs) || 120_000,
        maxBuffer: 4e6,
        windowsHide: true,
        env: process.env,
      });
      exitCode = 0;
      stdout = String(r.stdout || '');
      stderr = String(r.stderr || '');
    } catch (e) {
      exitCode = typeof e.code === 'number' ? e.code : 1;
      stdout = String(e.stdout || '');
      stderr = String(e.stderr || e.message || '');
    }
  }

  return {
    ...judgment(
      'done',
      { ...opts, git: createLocalGit(loaded.root || cwd) },
      {
        type: 'done',
        testCommand,
        exitCode,
        diffBase: opts.diffBase || 'HEAD',
      },
    ),
    testCommand,
    exitCode,
    stdout: stdout.slice(0, 4000),
    stderr: stderr.slice(0, 2000),
  };
}

export function preDeploy(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const mode = opts.mode || 'advisory';
  const loaded = loadDeployUnits(cwd, opts.configPath || null);
  const lang = resolveLang(loaded.lang);
  const git = createLocalGit(cwd);
  const commit = opts.commit || git.resolve('HEAD');
  const verdict = check(
    { type: 'pre-deploy', commit },
    { mode, git, lang, config: { units: loaded.units, deployCommands: loaded.deployCommands, lang } },
  );
  return {
    phase: 'pre-deploy',
    cwd,
    commit,
    unitsFile: loaded.path,
    unitCount: loaded.units.length,
    enrolled: Boolean(loaded.path),
    mode: verdict.mode,
    lang: verdict.lang,
    ok: verdict.ok,
    findings: verdict.findings,
    cards: verdict.cards,
    mcp: verdict.mcp,
    agui: verdict.agui,
  };
}

/**
 * @param {{
 *   cwd?: string,
 *   commit?: string|null,
 *   configPath?: string|null,
 *   mode?: string,
 *   unitIds?: string[],
 *   observed?: Record<string,string>,
 *   timeoutMs?: number,
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
export async function verifyDeploy(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const mode = opts.mode || 'advisory';
  const loaded = loadDeployUnits(cwd, opts.configPath || null);
  const lang = resolveLang(loaded.lang);

  if (!loaded.path) {
    return {
      phase: 'post-deploy',
      cwd,
      enrolled: false,
      ok: false,
      error: t(lang, 'hook.not_enrolled'),
      lang,
      findings: [],
      cards: [],
      mcp: [],
      agui: [],
      observed: {},
      observations: [],
      manualPending: [],
    };
  }

  const git = createLocalGit(cwd);
  const commit = opts.commit || git.resolve('HEAD');
  const only = opts.unitIds?.length ? opts.unitIds : undefined;
  const { observed: auto, observations } = await observeUnits(loaded.units, {
    cwd: loaded.root || cwd,
    timeoutMs: opts.timeoutMs || 10_000,
    only,
    lang,
    fetchImpl: opts.fetchImpl,
  });
  const observed = { ...(auto || {}), ...(opts.observed || {}) };

  const unitsForMatch = only ? loaded.units.filter((u) => only.includes(u.id)) : loaded.units;
  const manualPending = unitsForMatch
    .filter((u) => !observed[u.id])
    .filter((u) => observations.find((o) => o.id === u.id)?.status === 'manual')
    .map((u) => u.id);

  const verdict = check(
    { type: 'post-deploy', commit, targetCommit: commit, observed },
    {
      mode,
      git,
      lang,
      config: { units: unitsForMatch, deployCommands: loaded.deployCommands, lang },
    },
  );

  const ok = verdict.ok && observations.every((o) => o.status !== 'error');
  return {
    phase: 'post-deploy',
    cwd,
    commit,
    unitsFile: loaded.path,
    enrolled: true,
    mode: verdict.mode,
    lang,
    ok,
    observed,
    observations,
    manualPending,
    manualHint: manualPending.length ? t(lang, 'observe.manual_pending', manualPending) : undefined,
    findings: verdict.findings,
    cards: verdict.cards,
    mcp: verdict.mcp,
    agui: verdict.agui,
  };
}
