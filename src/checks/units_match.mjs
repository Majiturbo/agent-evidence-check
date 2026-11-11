import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * post-deploy: each declared unit's observed version must equal the target.
 * event.targetCommit: string
 * event.observed: { [unitId]: string }  versions/fingerprints read from production by the caller
 * Unobserved units fail (prevents "shipped half, said done").
 */
export const unitsMatch = {
  id: 'units_match',
  phase: 'post-deploy',
  title: 'Every deploy unit is on the target version',
  run(event, context) {
    const { lang } = context;
    const units = context.config?.units || [];
    if (!units.length) return null;
    const target = (event.targetCommit || event.commit || '').trim();
    const observed = event.observed || {};
    const mismatches = [];
    for (const u of units) {
      const got = observed[u.id];
      if (got == null || got === '') {
        mismatches.push(t(lang, 'units_match.unobserved', u.id));
        continue;
      }
      const expect = u.expectFingerprint || target;
      if (!expect) {
        mismatches.push(t(lang, 'units_match.notarget', u.id));
        continue;
      }
      const ok =
        got === expect ||
        (typeof got === 'string' && typeof expect === 'string' && (got.startsWith(expect) || expect.startsWith(got)));
      if (!ok) mismatches.push(t(lang, 'units_match.mismatch', u.id, expect, got));
    }
    if (!mismatches.length) return null;
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'units_match.premise'),
      evidence: mismatches.join('\n'),
      message: t(lang, 'units_match.message'),
      options: options(lang, 'units_match', ['redeploy_missing', 'narrow_claim', 'abort']),
    });
  },
};

registerBuiltin(unitsMatch);
