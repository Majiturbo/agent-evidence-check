import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

const DEFAULT_PATHS = ['test', 'tests', 'spec', 'src/__tests__'];
const TAMPER_LINE =
  /^\+.*\b(it\.skip|test\.skip|describe\.skip|xit\(|xdescribe\(|@pytest\.mark\.skip|assert True\b|expect\(true\)|expect\(True\))/i;

/**
 * Best-effort: uncommitted diff must not delete test files or add classic wash lines.
 * Does not prove tests are good — only that this session did not obviously hollow them out.
 */
export const testsUntampered = {
  id: 'tests_untampered',
  phase: 'done',
  title: 'Tests were not washed to go green',
  run(event, context) {
    const { lang } = context;
    if (!context.git?.diffNameStatus) return null;
    const paths = resolvePaths(context.config?.done?.testPaths);
    const base = event.diffBase || 'HEAD';
    const names = context.git.diffNameStatus(base, paths);
    const deleted = [];
    for (const line of names) {
      const m = /^([AMDCRT?])\s+(.+)$/.exec(line.trim());
      if (!m) continue;
      if (m[1] === 'D' && looksLikeTest(m[2])) deleted.push(m[2]);
    }
    const diff = context.git.diffText(base, paths) || '';
    const washed = [];
    for (const line of diff.split(/\r?\n/)) {
      if (TAMPER_LINE.test(line)) washed.push(line.slice(0, 120));
    }
    if (!deleted.length && !washed.length) return null;
    const evidence = [
      deleted.length ? t(lang, 'tests_untampered.deleted', deleted.slice(0, 8).join(', ')) : null,
      washed.length ? t(lang, 'tests_untampered.washed', washed.slice(0, 6).join('\n')) : null,
    ]
      .filter(Boolean)
      .join('\n');
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'tests_untampered.premise'),
      evidence,
      message: t(lang, 'tests_untampered.message'),
      forbidden: t(lang, 'tests_untampered.forbidden'),
      options: options(lang, 'tests_untampered', ['restore', 'fix_code', 'stop']),
    });
  },
};

function resolvePaths(configured) {
  if (Array.isArray(configured) && configured.length) return configured.map(String);
  return DEFAULT_PATHS;
}

function looksLikeTest(file) {
  const f = String(file).replace(/\\/g, '/');
  return (
    /(^|\/)(test|tests|spec|__tests__)(\/|$)/i.test(f) ||
    /\.(test|spec)\.[jt]sx?$/i.test(f) ||
    /_test\.go$/i.test(f) ||
    /test_.*\.py$/i.test(f) ||
    /\.test\.mjs$/i.test(f)
  );
}

registerBuiltin(testsUntampered);
