/**
 * AG-UI interrupt adapter: reason / message / responseSchema.
 */

import { cardText } from './mcp.mjs';

/** @param {import('./clarification.mjs').ClarificationCard} card */
export function toAguiInterrupt(card, lang = 'en') {
  const values = card.options.map((o) => o.id);
  return {
    reason: card.checkId,
    message: cardText(card, lang),
    responseSchema: {
      type: 'object',
      properties: {
        choice: {
          type: 'string',
          enum: values.length ? values : ['ack'],
        },
        note: { type: 'string' },
      },
      required: ['choice'],
    },
  };
}
