/**
 * Closed check registry: callers select by id; a model cannot invent check names (injection guard, audit §6.2).
 */

/** @typedef {'pre-deploy'|'post-deploy'|'direction'|'loop'|'done'|'any'} Phase */
/** @typedef {{ id: string, phase: Phase, title: string, run: Function }} Check */

/** @type {Map<string, Check>} */
const builtins = new Map();

/** @param {Check} check */
export function registerBuiltin(check) {
  if (!check?.id || typeof check.run !== 'function') throw new Error('invalid check');
  if (builtins.has(check.id)) throw new Error(`duplicate check id: ${check.id}`);
  builtins.set(check.id, check);
}

/** @param {string} id */
export function getCheck(id) {
  return builtins.get(id) ?? null;
}

export function listCheckIds() {
  return [...builtins.keys()];
}

/**
 * External checks: id must start with `custom:` and cannot shadow a builtin id.
 * @param {Check} check
 * @param {Map<string, Check>} [into]
 */
export function registerCustom(check, into = new Map()) {
  if (!check?.id?.startsWith('custom:')) {
    throw new Error('custom check id must start with "custom:"');
  }
  if (builtins.has(check.id)) throw new Error('custom id collides with builtin');
  into.set(check.id, check);
  return into;
}

/**
 * @param {string[]} [ids]  defaults to all builtins
 * @param {Map<string, Check>} [custom]
 */
export function resolveChecks(ids, custom = new Map()) {
  if (!ids || ids.length === 0) return [...builtins.values()];
  const out = [];
  for (const id of ids) {
    const c = builtins.get(id) ?? custom.get(id);
    if (!c) throw new Error(`unknown check id: ${id} (not in closed registry)`);
    out.push(c);
  }
  return out;
}
