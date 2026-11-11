import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * Uncommitted changes → block, and explicitly forbid clearing them with stash/checkout
 * (root cause of cross-tool clobbering, see docs/cases/cross-tool-stash.md).
 *
 * context.git.status() → { clean: boolean, entries: string[] }  e.g. " M src/a.ts", "?? new.md"
 */
export const dirtyTree = {
  id: 'dirty_tree',
  phase: 'pre-deploy',
  title: 'Working tree must be clean',
  run(_event, context) {
    const { lang } = context;
    const status = context.git.status();
    if (status.clean) return null;
    const entries = status.entries || [];
    const more = entries.length > 12 ? `\n${t(lang, 'andMore', entries.length)}` : '';
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'dirty_tree.premise'),
      evidence: entries.slice(0, 12).join('\n') + more,
      message: t(lang, 'dirty_tree.message'),
      forbidden: t(lang, 'dirty_tree.forbidden'),
      options: options(lang, 'dirty_tree', ['commit_or_move', 'deploy_sha', 'worktree', 'abort']),
    });
  },
};

registerBuiltin(dirtyTree);
