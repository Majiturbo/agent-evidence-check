import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * Repair loop: same target, repeated edits, user rejections, or "fixed" while still in one approach class.
 * Trips on rules only. Passing requires the next step to be a different class, named in alternatives.
 * Does not read the chat and does not call a model.
 */
export const loopEscape = {
  id: 'loop_escape',
  phase: 'loop',
  title: 'Leave the approach class that is already failing',
  run(event, context) {
    const { lang } = context;
    const limits = context.config?.loop || { minEdits: 3, minRejections: 2 };
    const edits = count(event.edits);
    const rejections = count(event.rejections);
    const claimsFixed = Boolean(event.claimsFixed);
    const tripped =
      (edits >= limits.minEdits && rejections >= 1) ||
      rejections >= limits.minRejections ||
      (claimsFixed && rejections >= 1) ||
      (claimsFixed && edits >= limits.minEdits);
    if (!tripped) return null;

    const target = text(event.target);
    const tried = text(event.tried);
    const next = text(event.next);
    const alternatives = (Array.isArray(event.alternatives) ? event.alternatives : [])
      .map(text)
      .filter((s) => s.length >= 3 && /[\p{L}\p{N}]/u.test(s));
    const switched =
      target.length >= 1 &&
      tried.length >= 3 &&
      next.length >= 3 &&
      !same(next, tried) &&
      alternatives.some((a) => same(a, next));
    if (switched) return null;

    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'loop_escape.premise'),
      evidence: t(lang, 'loop_escape.evidence', target || '—', edits, rejections, tried || '—', claimsFixed),
      message: t(lang, 'loop_escape.message'),
      forbidden: t(lang, 'loop_escape.forbidden'),
      options: options(lang, 'loop_escape', ['switch', 'narrow', 'stop']),
    });
  },
};

function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function text(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function same(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

registerBuiltin(loopEscape);
