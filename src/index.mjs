/**
 * Public programmatic API for deploy-check.
 * Prefer the CLI or MCP server unless you are embedding checks in another tool.
 */

export { preDeploy, verifyDeploy, reviewDirection, reviewLoop, reviewDone } from './api.mjs';
export {
  loadReceipts,
  noteDirection,
  noteLoop,
  noteDone,
  noteEdit,
  evaluateStopGate,
  evaluateEditGate,
} from './receipts.mjs';
export { check, listCheckIds, looksLikeDeployCommand, looksLikeClearWorkspace } from './checks/index.mjs';
export { loadDeployUnits, validateUnits } from './config.mjs';
export { observeUnits, getObserveSpec, OBSERVE_TYPES } from './observe/index.mjs';
export { initConsumer } from './init.mjs';
export { doctor } from './doctor.mjs';
export { beforeShell } from './adapters/cursor-shell-hook.mjs';
export { resolveLang, t } from './i18n.mjs';
