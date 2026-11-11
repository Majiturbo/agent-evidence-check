import { makeCard } from '../card/clarification.mjs';
import { t, options } from '../i18n.mjs';
import { registerBuiltin } from './registry.mjs';

/**
 * Production files / env differ from git → hot patch; ask to commit it back.
 * event.drift: [{ path, note }]  supplied by the caller (this check never SSHes).
 * No drift info → skip (do not pretend it was measured).
 */
export const hotpatchDrift = {
  id: 'hotpatch_drift',
  phase: 'post-deploy',
  title: 'Hot patches must go back to git',
  run(event, context) {
    const { lang } = context;
    const drift = event.drift;
    if (!Array.isArray(drift) || drift.length === 0) return null;
    const sample = drift
      .slice(0, 10)
      .map((d) => `${d.path}${d.note ? ` — ${d.note}` : ''}`)
      .join('\n');
    return makeCard({
      checkId: this.id,
      severity: 'advisory',
      premise: t(lang, 'hotpatch_drift.premise'),
      evidence: sample + (drift.length > 10 ? `\n${t(lang, 'andMore', drift.length)}` : ''),
      message: t(lang, 'hotpatch_drift.message'),
      options: options(lang, 'hotpatch_drift', ['commit_hotpatch', 'revert_hotpatch', 'ack']),
    });
  },
};

registerBuiltin(hotpatchDrift);
