/**
 * ClarificationCard — output shape shared by deploy, direction, and loop checks.
 * Transports only adapt to MCP elicitation / AG-UI interrupt; no custom protocol.
 */

/** @typedef {'info'|'advisory'|'block'} Severity */
/** @typedef {{ id: string, label: string, description?: string }} Option */

/**
 * @typedef {object} ClarificationCard
 * @property {string} id
 * @property {string} checkId       id from the closed registry
 * @property {Severity} severity
 * @property {string} premise       the claim that does not hold ("it's live", "tree can be cleared"…)
 * @property {string} evidence      git status, unit versions…
 * @property {string} message       one human-readable sentence
 * @property {Option[]} options     ways to resolve
 * @property {string[]} [forbidden] explicitly forbidden actions (e.g. stash to clear)
 */

/**
 * @param {Omit<ClarificationCard, 'id'> & { id?: string }} input
 * @returns {ClarificationCard}
 */
export function makeCard(input) {
  if (!input.checkId || !input.premise || !input.message) {
    throw new Error('ClarificationCard requires checkId, premise, message');
  }
  return {
    id: input.id ?? `${input.checkId}:${Date.now().toString(36)}`,
    checkId: input.checkId,
    severity: input.severity ?? 'advisory',
    premise: input.premise,
    evidence: input.evidence ?? '',
    message: input.message,
    options: input.options ?? [],
    forbidden: input.forbidden ?? [],
  };
}
