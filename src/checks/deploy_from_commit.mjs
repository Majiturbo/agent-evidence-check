import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const SHORT_SHA = /^[0-9a-f]{7,40}$/i;

/**
 * The deploy source must be an explicit git SHA, not "the working tree" or a loose HEAD.
 * event.commit: string | undefined
 * context.git.resolve(ref) → fullSha | null
 */
export const deployFromCommit = {
  id: 'deploy_from_commit',
  phase: 'pre-deploy',
  title: 'Deploy an explicit commit SHA',
  run(event, context) {
    const { lang } = context;
    const raw = (event.commit || '').trim();
    const card = (variant, evidence, optIds) =>
      makeCard({
        checkId: this.id,
        severity: 'block',
        premise: t(lang, `deploy_from_commit.${variant}.premise`),
        evidence,
        message: t(lang, `deploy_from_commit.${variant}.message`),
        options: options(lang, 'deploy_from_commit', [...optIds, 'abort']),
      });

    if (!raw) return card('empty', t(lang, 'deploy_from_commit.empty.evidence'), ['provide_sha']);
    if (raw === 'HEAD' || raw === 'head' || raw === '.') {
      return card('head', `event.commit=${raw}`, ['resolve_sha']);
    }
    const resolved = FULL_SHA.test(raw) ? raw.toLowerCase() : context.git.resolve(raw);
    if (!resolved || !SHORT_SHA.test(resolved)) {
      return card('bad', t(lang, 'deploy_from_commit.bad.evidence', raw), ['fix_ref']);
    }
    return null;
  },
};

registerBuiltin(deployFromCommit);

export function isFullSha(s) {
  return FULL_SHA.test(s);
}
