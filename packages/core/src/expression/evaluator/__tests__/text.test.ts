import { describe, expect, it } from 'vitest';
import { type ExpressionErrorDetails, ExpressionEvaluationError } from '../../../errors.js';
import { createBudget } from '../../limits.js';
import type {
  Expression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
  TextExpression,
} from '../../types.js';
import { evaluateExpression } from '../evaluate.js';

const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): LiteralExpression => ({
  kind: 'literal',
  value,
});
const concat = (...parts: PrintableExpression[]): Expression => ({ kind: 'concat', parts });
const asText = (value: PrintableExpression): TextExpression => ({ kind: 'text', value });

function expectEvaluationError(run: () => unknown): ExpressionErrorDetails {
  try {
    run();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      return error.details;
    }
    throw error;
  }
  return expect.unreachable('the expression should have failed');
}

describe('texts', () => {
  const texts = {
    invoice: { number: 4711, label: 'acme sàrl', notes: '', flag: true, lines: [1, 2] },
  };
  const numeric = {
    broken: { nan: Number.NaN },
  };

  it('joins two and three parts', () => {
    expect(evaluateExpression(concat(literal('a'), literal('b')), texts)).toBe('ab');
    expect(evaluateExpression(concat(literal('a'), literal('b'), literal('c')), texts)).toBe('abc');
  });

  it('refuses a NUMBER, because the algebra refuses coercion', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(concat(literal('N° '), path('invoice.number')), texts),
      ),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'concat',
      at: ['parts', 1],
      actualType: 'number',
    });
  });

  it('makes the canonical case writable through text(), with no format', () => {
    expect(evaluateExpression(concat(literal('N° '), asText(path('invoice.number'))), texts)).toBe(
      'N° 4711',
    );
    expect(evaluateExpression(asText(literal(1234)), texts)).toBe('1234');
    expect(evaluateExpression(asText(literal(1234.5)), texts)).toBe('1234.5');
  });

  it('leaves text that is already text alone', () => {
    expect(evaluateExpression(asText(literal('déjà du texte')), texts)).toBe('déjà du texte');
    expect(evaluateExpression(asText(path('invoice.notes')), texts)).toBe('');
  });

  it('refuses a boolean, a list and an object in text()', () => {
    expect(
      expectEvaluationError(() => evaluateExpression(asText(literal(true)), texts)),
    ).toStrictEqual({ code: 'operand-type', site: 'text', at: ['value'], actualType: 'boolean' });
    expect(
      expectEvaluationError(() => evaluateExpression(asText(path('invoice.lines')), texts)),
    ).toStrictEqual({ code: 'operand-type', site: 'text', at: ['value'], actualType: 'list' });
    expect(
      expectEvaluationError(() => evaluateExpression(asText(path('invoice')), texts)),
    ).toStrictEqual({ code: 'operand-type', site: 'text', at: ['value'], actualType: 'object' });
  });

  it('refuses a non-finite number in text(), with the finiteness code', () => {
    expect(
      expectEvaluationError(() => evaluateExpression(asText(path('broken.nan')), numeric)),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'text',
      at: ['value'],
      actualType: 'not-finite',
    });
  });

  it('propagates absence through text(), a join and a case fold', () => {
    expect(evaluateExpression(asText(path('invoice.missing')), texts)).toBeUndefined();
    expect(
      evaluateExpression(concat(literal('a'), path('invoice.missing')), texts),
    ).toBeUndefined();
    expect(
      evaluateExpression({ kind: 'textCase', op: 'upper', text: path('invoice.missing') }, texts),
    ).toBeUndefined();
  });

  it('stops a join at the first absent part, without evaluating what follows', () => {
    // The absent part comes FIRST and the one after it would raise. The test above puts the
    // absent part LAST, which is the one position where evaluating every part up front still
    // passes -- so it cannot see the difference and this one is what pins the order.
    const wouldRaise = asText({
      kind: 'arithmetic',
      op: 'div',
      left: literal(1),
      right: literal(0),
    });

    expect(evaluateExpression(concat(path('invoice.missing'), wouldRaise), texts)).toBeUndefined();

    // And the second part really does raise when it IS reached, so the assertion above is
    // not passing because the division happens to be acceptable.
    expect(
      expectEvaluationError(() => evaluateExpression(concat(literal('a'), wouldRaise), texts)),
    ).toStrictEqual({
      code: 'division-by-zero',
      site: 'arithmetic',
      at: ['parts', 1, 'value', 'right'],
      actualType: 'number',
    });
  });

  it('refuses a number in a case fold, at its own field name', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression({ kind: 'textCase', op: 'lower', text: path('invoice.number') }, texts),
      ),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'textCase',
      at: ['text'],
      actualType: 'number',
    });
  });

  it('folds case on accented text', () => {
    expect(
      evaluateExpression({ kind: 'textCase', op: 'upper', text: path('invoice.label') }, texts),
    ).toBe('ACME SÀRL');
    expect(evaluateExpression({ kind: 'textCase', op: 'lower', text: literal('ÉTÉ') }, texts)).toBe(
      'été',
    );
  });

  it.each([
    ['upper' as const, 'ß', 'SS'],
    ['upper' as const, 'ﬀ', 'FF'],
    ['lower' as const, 'İ', 'i̇'],
    ['upper' as const, 'éàç', 'ÉÀÇ'],
    ['lower' as const, 'ÉÀÇ', 'éàç'],
  ])('pins the frozen Unicode vector %s(%o)', (op, input, expected) => {
    expect(evaluateExpression({ kind: 'textCase', op, text: literal(input) }, texts)).toBe(
      expected,
    );
    if (input === 'ß' || input === 'ﬀ') {
      expect(input).toHaveLength(1);
      expect(expected).toHaveLength(2);
    }
  });

  it('handles 100 000 characters', () => {
    const long = 'x'.repeat(100_000);
    expect(evaluateExpression(concat(literal(long), literal(long)), texts)).toHaveLength(200_000);
  });

  it('refuses a stair-shaped concat by the BOUND, in bounded memory', () => {
    let stair: PrintableExpression = literal('x'.repeat(64));
    for (let level = 0; level < 18; level += 1) {
      stair = { kind: 'concat', parts: [stair, stair] };
    }

    const details = expectEvaluationError(() =>
      evaluateExpression(stair, texts, { budget: createBudget({ maxStringLength: 1_000 }) }),
    );

    expect(details.code).toBe('string-limit-exceeded');
    if (details.code === 'string-limit-exceeded') {
      expect(details.limit).toBe(1_000);
    }
  });

  it('closes the same bound for the other two text-producing kinds', () => {
    const tight = () => createBudget({ maxStringLength: 4 });

    expect(
      expectEvaluationError(() =>
        evaluateExpression({ kind: 'textCase', op: 'upper', text: literal('abcdefgh') }, texts, {
          budget: tight(),
        }),
      ).code,
    ).toBe('string-limit-exceeded');
    expect(
      expectEvaluationError(() =>
        evaluateExpression(asText(literal(123_456_789)), texts, { budget: tight() }),
      ).code,
    ).toBe('string-limit-exceeded');
  });
});
