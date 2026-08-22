import { valueTypeOf } from '@openview/core';
import { type DocumentRenderErrorDetails, refusal } from '../errors.js';

const MISSING =
  'A visible binding produced no value. A blank left in a printed position is more dangerous than a refusal, so the template has to say what absence means: guard the binding with `isEmpty`, an `if` that yields an empty text, or a condition around the block.';

const NON_PRINTABLE =
  'A visible binding produced a value with no printed form. Only text and a finite number print as themselves; `details.actualType` names what arrived, and `text`, `concat` or `round` are how a template turns it into text.';

/**
 * Turns an evaluated binding into the exact characters to print, or refuses.
 *
 * Text prints as itself and a finite number in its canonical form -- no locale, no implicit
 * rounding, since recognising a total as money would reserve a business meaning. Everything else
 * is refused: no `undefined`, no `[object Object]` and no invented json ever reaches a page.
 */
export function printableText(value: unknown, details: DocumentRenderErrorDetails): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (value === null || value === undefined) {
    throw refusal(MISSING, 'missing-binding-value', details);
  }
  throw refusal(NON_PRINTABLE, 'non-printable-binding-value', {
    ...details,
    actualType: valueTypeOf(value),
  });
}
