/**
 * Turn each unit's observe/verify spec into an observed fingerprint.
 *
 * Spec sources (first match wins):
 *   unit.observe (object) → unit.verify (object) → null (manual / human-only string)
 *
 * Built-in types:
 *   http_json   { type, url, field, headers?, method?, timeoutMs? }
 *   http_text   { type, url, pattern?, headers?, method?, timeoutMs? }
 *   file_sha256 { type, path }
 *   command     { type, run, cwd?, timeoutMs? }  — stdout trimmed; only what the repo author wrote
 *   literal     { type, value }  — tests / fixtures
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { t } from '../i18n.mjs';
import { OBSERVE_TYPES } from './types.mjs';
export { OBSERVE_TYPES };

const execFileAsync = promisify(execFile);

export function getObserveSpec(unit) {
  if (unit?.observe && typeof unit.observe === 'object') return unit.observe;
  if (unit?.verify && typeof unit.verify === 'object') return unit.verify;
  return null;
}

/**
 * @param {object[]} units
 * @param {{ cwd?: string, timeoutMs?: number, fetchImpl?: typeof fetch, only?: string[], lang?: string }} opts
 * @returns {Promise<{ observed: Record<string,string>, observations: object[] }>}
 */
export async function observeUnits(units, opts = {}) {
  const only = opts.only?.length ? new Set(opts.only) : null;
  const observations = [];
  const observed = {};
  for (const unit of units || []) {
    if (!unit?.id) continue;
    if (only && !only.has(unit.id)) continue;
    const row = await observeOne(unit, opts);
    observations.push(row);
    if (row.status === 'ok' && row.value != null && row.value !== '') {
      observed[unit.id] = String(row.value);
    }
  }
  return { observed, observations };
}

export async function observeOne(unit, opts = {}) {
  const lang = opts.lang || 'en';
  const spec = getObserveSpec(unit);
  if (!spec) {
    return {
      id: unit.id,
      status: 'manual',
      note: typeof unit.verify === 'string' ? unit.verify : t(lang, 'observe.manual'),
    };
  }
  const type = String(spec.type || '').toLowerCase();
  try {
    const value = await runType(type, spec, opts);
    if (value == null || value === '') {
      return { id: unit.id, status: 'error', error: t(lang, 'observe.empty'), type };
    }
    return { id: unit.id, status: 'ok', value: String(value), type };
  } catch (e) {
    return { id: unit.id, status: 'error', error: e.message || String(e), type };
  }
}

async function runType(type, spec, opts) {
  switch (type) {
    case 'http_json':
      return observeHttpJson(spec, opts);
    case 'http_text':
      return observeHttpText(spec, opts);
    case 'file_sha256':
      return observeFileSha256(spec, opts);
    case 'command':
      return observeCommand(spec, opts);
    case 'literal':
      return spec.value == null ? null : String(spec.value);
    default:
      throw new Error(`unknown observe type: ${type || '(missing)'}`);
  }
}

async function observeHttpJson(spec, opts) {
  if (!spec.url) throw new Error('http_json: url required');
  if (!spec.field && !spec.path) throw new Error('http_json: field (or path) required');
  const body = await fetchText(spec, opts);
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`http_json: response is not JSON (${spec.url})`);
  }
  const field = spec.field || spec.path;
  const value = dig(json, field);
  if (value == null) throw new Error(`http_json: field "${field}" missing in response`);
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : JSON.stringify(value);
}

async function observeHttpText(spec, opts) {
  if (!spec.url) throw new Error('http_text: url required');
  const body = (await fetchText(spec, opts)).trim();
  if (spec.pattern) {
    const m = body.match(new RegExp(spec.pattern, 'm'));
    if (!m) throw new Error(`http_text: pattern did not match (${spec.url})`);
    return m[1] ?? m[0];
  }
  return body;
}

function observeFileSha256(spec, opts) {
  if (!spec.path) throw new Error('file_sha256: path required');
  const file = path.resolve(opts.cwd || process.cwd(), spec.path);
  if (!fs.existsSync(file)) throw new Error(`file_sha256: not found: ${file}`);
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

async function observeCommand(spec, opts) {
  if (!spec.run || typeof spec.run !== 'string') throw new Error('command: run (string) required');
  const cwd = path.resolve(opts.cwd || process.cwd(), spec.cwd || '.');
  const timeout = Number(spec.timeoutMs || opts.timeoutMs || 30_000);
  const shell = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/bash';
  const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', spec.run] : ['-lc', spec.run];
  try {
    const { stdout } = await execFileAsync(shell, shellArgs, {
      cwd,
      timeout,
      maxBuffer: 2e6,
      windowsHide: true,
      env: process.env,
    });
    return String(stdout || '').trim();
  } catch (e) {
    const detail = [e.stderr, e.stdout, e.message].filter(Boolean).map(String).join(' ').trim();
    throw new Error(`command failed: ${detail.slice(0, 400)}`);
  }
}

async function fetchText(spec, opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error('fetch is not available');
  const timeout = Number(spec.timeoutMs || opts.timeoutMs || 10_000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetchImpl(spec.url, {
      method: spec.method || 'GET',
      headers: spec.headers || undefined,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} (${spec.url})`);
    return await res.text();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`timeout after ${timeout}ms (${spec.url})`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Dig `a.b.0.c` out of a JSON value. */
export function dig(obj, dotted) {
  if (obj == null) return undefined;
  if (!dotted || dotted === '.') return obj;
  return String(dotted)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}
