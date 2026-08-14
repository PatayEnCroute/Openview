import type { EvaluationBudget } from '../../limits.js';
import type { Expression, PrintableExpression, TextCaseOperator } from '../../types.js';
import { valueTypeOf } from '../../value-type.js';
import { describe, fail } from '../context.js';
import { acceptText, isAbsent, requireText } from '../guards.js';
import type { EvaluationScope } from '../scope.js';

/**
 * Joins texts, evaluating ONE PART AT A TIME.
 *
 * The interleaving is load-bearing twice over, and evaluating every part up front broke
 * both at once:
 *
 * - **An absent part stops the descent.** A part that follows an absent one is never
 *   evaluated, so `concat(remise, text(div(total, remise)))` propagates absence like the
 *   rest of the algebra instead of raising the division the missing operand made
 *   unreachable. Evaluated eagerly, a document that should have printed a blank fails.
 * - **The bound is checked after EVERY construction,** which is the only order that stops
 *   an intermediate string from existing before being refused (see `acceptText`).
 *
 * Neither property is visible to the gates: the two branches below stay covered whatever
 * the evaluation ORDER is, and the absence test that used to guard this put the absent part
 * LAST, the one position where an eager version still passes. Hence a test with the absent
 * part first, and this note against a future `parts.map(...)`.
 */
export function evaluateConcat(
  parts: readonly PrintableExpression[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateWithinFn: (
    expr: Expression,
    at: readonly (string | number)[],
    scope: EvaluationScope,
    budget: EvaluationBudget,
  ) => unknown,
): string | undefined {
  let built = '';
  for (const [index, part] of parts.entries()) {
    const piece = requireText(evaluateWithinFn(part, ['parts', index], scope, budget), 'concat', [
      'parts',
      index,
    ]);
    if (piece === undefined) {
      return undefined;
    }
    built = acceptText(built + piece, 'concat', [], budget);
  }
  return built;
}

export function evaluateText(raw: unknown, budget: EvaluationBudget): string | undefined {
  if (isAbsent(raw)) {
    return undefined;
  }
  if (typeof raw === 'string') {
    return acceptText(raw, 'text', [], budget);
  }
  if (typeof raw === 'number') {
    // Same single rule as arithmetic: `not-finite` answers for finiteness wherever it
    // comes up, so a NaN here does not get relabelled `operand-type`.
    if (!Number.isFinite(raw)) {
      return fail(
        { code: 'not-finite', site: 'text', at: ['value'], actualType: 'not-finite' },
        'A number that is not finite has no text form a document could carry.',
      );
    }
    return acceptText(String(raw), 'text', [], budget);
  }
  // A boolean, a list and an object are refused: `text(true)` would print `true` into a
  // document, exactly what a print position has forbidden since ADR 0002.
  return fail(
    { code: 'operand-type', site: 'text', at: ['value'], actualType: valueTypeOf(raw) },
    `Only a number or a text can be turned into text, got ${describe(valueTypeOf(raw))}.`,
  );
}

export function evaluateTextCase(
  source: unknown,
  op: TextCaseOperator,
  budget: EvaluationBudget,
): string | undefined {
  const text = requireText(source, 'textCase', ['text']);
  if (text === undefined) {
    return undefined;
  }
  // Never `toLocaleUpperCase`: the locale variant depends on ICU and breaks the
  // determinism the engine owes (E6). The Biome guard refuses it too.
  const folded = op === 'upper' ? text.toUpperCase() : text.toLowerCase();
  return acceptText(folded, 'textCase', [], budget);
}
