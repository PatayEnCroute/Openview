import type { EvaluationBudget } from '../../limits.js';
import type { Expression, PrintableExpression, TextCaseOperator } from '../../types.js';
import { valueTypeOf } from '../../value-type.js';
import { describe, fail } from '../context.js';
import { acceptText, isAbsent, requireText } from '../guards.js';
import type { EvaluationScope } from '../scope.js';

/** Evaluates string concatenation across printable parts. */
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

/** Evaluates conversion of a number or string to a string. */
export function evaluateText(raw: unknown, budget: EvaluationBudget): string | undefined {
  if (isAbsent(raw)) {
    return undefined;
  }
  if (typeof raw === 'string') {
    return acceptText(raw, 'text', [], budget);
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return fail(
        { code: 'not-finite', site: 'text', at: ['value'], actualType: 'not-finite' },
        'A number that is not finite has no text form a document could carry.',
      );
    }
    return acceptText(String(raw), 'text', [], budget);
  }
  return fail(
    { code: 'operand-type', site: 'text', at: ['value'], actualType: valueTypeOf(raw) },
    `Only a number or a text can be turned into text, got ${describe(valueTypeOf(raw))}.`,
  );
}

/** Evaluates case transformation (`upper` or `lower`) on text. */
export function evaluateTextCase(
  source: unknown,
  op: TextCaseOperator,
  budget: EvaluationBudget,
): string | undefined {
  const text = requireText(source, 'textCase', ['text']);
  if (text === undefined) {
    return undefined;
  }
  const folded = op === 'upper' ? text.toUpperCase() : text.toLowerCase();
  return acceptText(folded, 'textCase', [], budget);
}
