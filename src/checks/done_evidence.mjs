import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * Before saying done / fixed / green: a test command must have exited 0.
 * Evidence comes from the caller (exitCode) or from reviewDone running the configured command.
 */
export const doneEvidence = {
  id: 'done_evidence',
  phase: 'done',
  title: 'Done needs a green test run on the record',
  run(event, context) {
    const { lang } = context;
    const exitCode = event.exitCode;
    const command = String(event.testCommand || context.config?.done?.testCommand || '').trim();
    if (exitCode === 0 && command) return null;
    if (exitCode === 0 && event.allowEmptyCommand) return null;
    const gaps = [];
    if (!command) gaps.push(t(lang, 'done_evidence.gap.command'));
    if (exitCode == null || exitCode === '') gaps.push(t(lang, 'done_evidence.gap.exit'));
    else if (Number(exitCode) !== 0) gaps.push(t(lang, 'done_evidence.gap.nonzero', exitCode));
    if (!gaps.length) return null;
    return makeCard({
      checkId: this.id,
      severity: 'block',
      premise: t(lang, 'done_evidence.premise'),
      evidence: gaps.join('\n'),
      message: t(lang, 'done_evidence.message'),
      forbidden: t(lang, 'done_evidence.forbidden'),
      options: options(lang, 'done_evidence', ['rerun', 'narrow', 'stop']),
    });
  },
};

registerBuiltin(doneEvidence);
