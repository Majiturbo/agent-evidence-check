import fs from 'node:fs';
import path from 'node:path';
import { OBSERVE_TYPES } from './observe/types.mjs';

const NAMES = ['deploy-units.json', '.deploy-units.json'];
const OBSERVE_SET = new Set(OBSERVE_TYPES);

/**
 * Load deploy-units config. Lookup order:
 *   explicitPath → deploy-units.json / .deploy-units.json walking up from cwd, stopping at the git root
 *
 * No config = repo not enrolled (hooks pass through).
 * @returns {{ path: string|null, root: string|null, units: object[], deployCommands: string[]|null, lang: string|null, warnings: string[] }}
 */
export function loadDeployUnits(cwd = process.cwd(), explicitPath) {
  const file = explicitPath ? path.resolve(cwd, explicitPath) : findConfig(cwd);
  if (!file || !fs.existsSync(file)) {
    return {
      path: null,
      root: null,
      units: [],
      deployCommands: null,
      lang: null,
      loop: loopThresholds(null),
      judgments: judgmentGates(null),
      done: doneConfig(null),
      warnings: [],
    };
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const units = Array.isArray(raw) ? raw : raw.units;
  if (!Array.isArray(units)) throw new Error(`${file}: expected { units: [...] } or an array`);
  const warnings = validateUnits(units, file);
  const deployCommands = Array.isArray(raw.deployCommands) ? raw.deployCommands.map(String) : null;
  const lang = typeof raw.lang === 'string' ? raw.lang : null;
  const loop = loopThresholds(Array.isArray(raw) ? null : raw.loop);
  const judgments = judgmentGates(Array.isArray(raw) ? null : raw.judgments);
  const done = doneConfig(Array.isArray(raw) ? null : raw.done);
  return { path: file, root: path.dirname(file), units, deployCommands, lang, loop, judgments, done, warnings };
}

/** Loop-escape thresholds. Invalid values fall back to the defaults. */
export function loopThresholds(loop) {
  const src = loop && typeof loop === 'object' ? loop : {};
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : fallback;
  };
  return { minEdits: num(src.minEdits, 3), minRejections: num(src.minRejections, 2) };
}

/**
 * Optional hard gates so agents must call direction/loop/done.
 * Default off — set `"judgments": { "stopGate": true, "editGate": true, "doneGate": true }`.
 */
export function judgmentGates(judgments) {
  const src = judgments && typeof judgments === 'object' ? judgments : {};
  const on = (v) => v === true || v === 'on' || v === 1;
  const gatesOn = on(src.gates);
  return {
    stopGate: src.stopGate == null ? gatesOn : on(src.stopGate),
    editGate: src.editGate == null ? gatesOn : on(src.editGate),
    doneGate: src.doneGate == null ? gatesOn : on(src.doneGate),
  };
}

/** Done / fake-green checks. */
export function doneConfig(done) {
  const src = done && typeof done === 'object' ? done : {};
  const testCommand = typeof src.testCommand === 'string' ? src.testCommand.trim() : '';
  const testPaths = Array.isArray(src.testPaths) ? src.testPaths.map(String).filter(Boolean) : null;
  return {
    testCommand: testCommand || 'npm test',
    testPaths: testPaths && testPaths.length ? testPaths : null,
  };
}

/**
 * Soft validation: returns warnings (does not throw) so hooks stay fail-open.
 * Hard errors (non-array units) still throw from loadDeployUnits.
 */
export function validateUnits(units, label = 'deploy-units.json') {
  const warnings = [];
  const seen = new Set();
  for (const [i, u] of (units || []).entries()) {
    const where = `${label} units[${i}]`;
    if (!u || typeof u !== 'object') {
      warnings.push(`${where}: must be an object`);
      continue;
    }
    if (!u.id || typeof u.id !== 'string') warnings.push(`${where}: missing string id`);
    else if (seen.has(u.id)) warnings.push(`${where}: duplicate id "${u.id}"`);
    else seen.add(u.id);

    const spec = u.observe && typeof u.observe === 'object' ? u.observe : u.verify && typeof u.verify === 'object' ? u.verify : null;
    if (spec) {
      const type = String(spec.type || '');
      if (!OBSERVE_SET.has(type)) {
        warnings.push(`${where}: unknown observe.type "${type || '(missing)'}" (want ${OBSERVE_TYPES.join('|')})`);
      } else if (type === 'http_json' && (!spec.url || !(spec.field || spec.path))) {
        warnings.push(`${where}: http_json needs url + field`);
      } else if (type === 'http_text' && !spec.url) {
        warnings.push(`${where}: http_text needs url`);
      } else if (type === 'file_sha256' && !spec.path) {
        warnings.push(`${where}: file_sha256 needs path`);
      } else if (type === 'command' && !spec.run) {
        warnings.push(`${where}: command needs run`);
      }
    } else if (typeof u.verify === 'string' || u.verify == null) {
      warnings.push(`${where}: id "${u.id || '?'}" has no machine observe — verify will stay manual until you add observe or pass --observed`);
    }
  }
  return warnings;
}

function findConfig(start) {
  let dir = path.resolve(start);
  for (;;) {
    for (const name of NAMES) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) return f;
    }
    if (fs.existsSync(path.join(dir, '.git'))) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
