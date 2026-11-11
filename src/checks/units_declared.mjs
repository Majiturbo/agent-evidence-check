import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * A repo must declare its deploy units, otherwise "it's live" cannot be verified
 * (see docs/cases/partial-deploy.md).
 * context.config.units → [{ id, kind, verify }]
 */
export const unitsDeclared = {
  id: 'units_declared',
  phase: 'pre-deploy',
  title: 'Deploy units must be declared',
  run(_event, context) {
    const { lang } = context;
    const units = context.config?.units;
    if (Array.isArray(units) && units.length > 0) {
      const bad = units.filter((u) => !u?.id);
      if (!bad.length) return null;
      return makeCard({
        checkId: this.id,
        severity: 'block',
        premise: t(lang, 'units_declared.badid.premise'),
        evidence: t(lang, 'units_declared.badid.evidence', bad.length),
        message: t(lang, 'units_declared.badid.message'),
        options: options(lang, 'units_declared', ['fix_config', 'abort']),
      });
    }
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'units_declared.empty.premise'),
      evidence: t(lang, 'units_declared.empty.evidence'),
      message: t(lang, 'units_declared.empty.message'),
      options: options(lang, 'units_declared', ['add_units', 'abort']),
    });
  },
};

registerBuiltin(unitsDeclared);
