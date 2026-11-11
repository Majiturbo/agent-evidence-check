import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * The commit to deploy must already be on a remote-tracking branch.
 * context.git.isPushed(sha) → boolean
 */
export const unpushed = {
  id: 'unpushed',
  phase: 'pre-deploy',
  title: 'Commit must be pushed',
  run(event, context) {
    const { lang } = context;
    const sha = (event.commit || '').trim();
    if (!sha) return null; // deploy_from_commit owns this case
    const resolved = context.git.resolve(sha) || sha;
    if (context.git.isPushed(resolved)) return null;
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'unpushed.premise'),
      evidence: t(lang, 'unpushed.evidence', resolved.slice(0, 12)),
      message: t(lang, 'unpushed.message'),
      options: options(lang, 'unpushed', ['push', 'abort']),
    });
  },
};

registerBuiltin(unpushed);
