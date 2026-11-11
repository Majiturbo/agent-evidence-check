import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * Project start or a mid-course turn: the agent must record a third-person read
 * (goal, current path, a different nearer path, why it is or isn't taking it, one fact).
 * This check does not read the chat and does not call a model.
 */
export const directionReview = {
  id: 'direction_review',
  phase: 'direction',
  title: 'Direction needs a nearer path on the record',
  run(event, context) {
    const { lang } = context;
    const moment = String(event.moment || '').trim();
    const goal = fact(event.goal);
    const path = fact(event.path);
    const nearer = fact(event.nearer);
    const why = fact(event.whyNotNearer);
    const evidence = fact(event.evidence);
    const gaps = [];
    if (moment !== 'start' && moment !== 'turn') gaps.push(t(lang, 'direction_review.gap.moment'));
    if (!goal) gaps.push(t(lang, 'direction_review.gap.goal'));
    if (!path) gaps.push(t(lang, 'direction_review.gap.path'));
    if (!nearer) gaps.push(t(lang, 'direction_review.gap.nearer'));
    else if (same(nearer, path)) gaps.push(t(lang, 'direction_review.gap.same'));
    if (!why) gaps.push(t(lang, 'direction_review.gap.why'));
    if (!evidence) gaps.push(t(lang, 'direction_review.gap.evidence'));
    if (!gaps.length) return null;
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'direction_review.premise'),
      evidence: gaps.join('\n'),
      message: t(lang, 'direction_review.message'),
      forbidden: t(lang, 'direction_review.forbidden'),
      options: options(lang, 'direction_review', ['switch', 'record', 'stop']),
    });
  },
};

function fact(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < 3) return '';
  if (!/[\p{L}\p{N}]/u.test(s)) return '';
  return s;
}

function same(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

registerBuiltin(directionReview);
