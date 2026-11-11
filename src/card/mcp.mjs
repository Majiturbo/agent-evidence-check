/**
 * MCP elicitation adapter: requestedSchema must be a flat object of primitives; options become an enum.
 * @see https://modelcontextprotocol.io/specification (elicitation)
 */

import { t } from '../i18n.mjs';

/** Shared by MCP and AG-UI: message + evidence + forbidden actions as plain text. */
export function cardText(card, lang = 'en') {
  return [
    card.message,
    card.evidence && `${t(lang, 'evidence')}: ${card.evidence}`,
    card.forbidden?.length && `${t(lang, 'forbidden')}: ${card.forbidden.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** @param {import('./clarification.mjs').ClarificationCard} card */
export function toMcpElicitation(card, lang = 'en') {
  const values = card.options.map((o) => o.id);
  const labels = Object.fromEntries(card.options.map((o) => [o.id, o.label]));
  return {
    message: cardText(card, lang),
    requestedSchema: {
      type: 'object',
      properties: {
        choice: {
          type: 'string',
          title: card.premise,
          description: card.options.map((o) => `${o.id}: ${o.label}${o.description ? ` — ${o.description}` : ''}`).join('; '),
          enum: values.length ? values : ['ack'],
        },
        note: {
          type: 'string',
          title: t(lang, 'note'),
        },
      },
      required: ['choice'],
    },
    _meta: {
      checkId: card.checkId,
      severity: card.severity,
      optionLabels: labels,
      forbidden: card.forbidden,
    },
  };
}
