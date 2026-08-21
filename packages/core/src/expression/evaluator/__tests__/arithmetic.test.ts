import { describe, expect, it } from 'vitest';
import { type ExpressionErrorDetails, ExpressionEvaluationError } from '../../../errors.js';
import type {
  ArithmeticExpression,
  ArithmeticOperator,
  Expression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
} from '../../types.js';
import { evaluateExpression } from '../evaluate.js';

const numeric = {
  total: 100,
  qty: 0,
  minusZero: -0,
  line: {
    quantity: 3,
    unitPrice: 12.5,
    discount: 10,
    missing: undefined,
  },
  broken: {
    nan: Number.NaN,
    text: '2',
    huge: 1e308,
  },
};

const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): LiteralExpression => ({
  kind: 'literal',
  value,
});
const arithmetic = (
  op: ArithmeticOperator,
  left: PrintableExpression,
  right: PrintableExpression,
): ArithmeticExpression => ({ kind: 'arithmetic', op, left, right });

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

describe('arithmetic', () => {
  const compute = (op: ArithmeticOperator, a: PrintableExpression, b: PrintableExpression) =>
    evaluateExpression(arithmetic(op, a, b), numeric);

  it('does the four operations', () => {
    expect(compute('add', literal(2), literal(3))).toBe(5);
    expect(compute('sub', literal(2), literal(3))).toBe(-1);
    expect(compute('mul', path('line.quantity'), path('line.unitPrice'))).toBe(37.5);
    expect(compute('div', literal(9), literal(3))).toBe(3);
  });

  it('refuses an operator outside the closed set instead of dividing', () => {
    // Smuggled past the compiler the way `round.test.ts` smuggles a mode: `ArithmeticOperator`
    // and `z.enum(ARITHMETIC_OPERATORS)` both refuse this, so only an untyped caller of the
    // public API can produce it. What the assertion pins is that the answer is a REFUSAL and
    // not a plausible amount -- `div` used to be the `default`, so `mod` over 7 and 2 answered
    // 3.5, and an operator added to the union later would have shipped that in silence.
    const smuggled: ArithmeticOperator = JSON.parse('"mod"');
    expect(() => compute(smuggled, literal(7), literal(2))).toThrow(TypeError);
  });

  it('takes parentheses from the nesting', () => {
    // There is no precedence and no parser, so `(a + b) * c` is a mul whose left operand
    // is an add. Nothing about that can be misread in a formula bar either.
    const nested: Expression = arithmetic(
      'mul',
      arithmetic('add', literal(2), literal(3)),
      literal(4),
    );
    expect(evaluateExpression(nested, numeric)).toBe(20);
  });

  it('does NOT round a division', () => {
    // The most important test to keep over time: it forbids a future contributor from
    // "tidying up" the division, which would be a rounding position de facto -- a rule,
    // and Openview answers for no rule. How an amount rounds is declared by the template
    // through the `round` wrapper kind.
    expect(compute('div', literal(1), literal(3))).toBe(0.3333333333333333);
    expect(compute('add', literal(0.1), literal(0.2))).toBe(0.30000000000000004);
  });

  it('never yields a negative zero', () => {
    // `toBe` is `Object.is`, so `expect(-0).toBe(0)` FAILS: that is what makes these three
    // assertions a pin rather than a formality, and all three go red without the exit
    // normalisation. A negative zero is not part of a document's vocabulary -- `round` refused
    // to emit one from the start, and a multiplication had no reason to be the exception.
    expect(compute('mul', literal(0), literal(-1))).toBe(0);
    expect(compute('div', literal(0), literal(-5))).toBe(0);
    expect(compute('sub', path('minusZero'), literal(0))).toBe(0);
  });

  it('propagates absence rather than substituting zero', () => {
    // Choosing 0 would be core deciding, for DataBindingStep, the question ADR 0001 left
    // open -- and 0 is right for a sum and wrong for a division. The honest consequence:
    // `total - discount` with no discount yields undefined, not total, and THAT is what
    // earns the `if` kind its place.
    expect(compute('sub', path('total'), path('line.missing'))).toBeUndefined();
    expect(compute('div', path('line.missing'), literal(2))).toBeUndefined();
  });

  it('refuses a present operand of the wrong type where JavaScript would coerce', () => {
    expect(
      expectEvaluationError(() => compute('mul', path('broken.text'), literal(1))),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'arithmetic',
      at: ['left'],
      actualType: 'string',
    });
    // JavaScript would have yielded 2 here. No coercion: the ADR 0001 rule is extended,
    // not eroded.
    expect(() => compute('mul', path('broken.text'), literal(1))).toThrow(
      /needs numbers, but the highlighted operand is text/,
    );
    expect(expectEvaluationError(() => compute('add', literal(true), literal(1))).code).toBe(
      'operand-type',
    );
  });

  it('raises not-finite at the ENTRY and at the EXIT, with the same code', () => {
    // One rule, stated once: operand-type answers for a value's shape, not-finite for its
    // finiteness -- everywhere, both ends. Two codes for one situation would have forced
    // lot C8 to write two messages for the same fault, and the policy would re-fracture at
    // the first copy-paste.
    const entry = expectEvaluationError(() => compute('add', path('broken.nan'), literal(1)));
    const exit = expectEvaluationError(() => compute('mul', path('broken.huge'), literal(10)));

    expect(entry).toStrictEqual({
      code: 'not-finite',
      site: 'arithmetic',
      at: ['left'],
      actualType: 'not-finite',
    });
    expect(exit).toStrictEqual({
      code: 'not-finite',
      site: 'arithmetic',
      at: [],
      actualType: 'not-finite',
    });
    expect(entry.code).toBe(exit.code);
  });

  it('distinguishes a divisor that is present and zero from one that is absent', () => {
    expect(expectEvaluationError(() => compute('div', literal(1), path('qty')))).toStrictEqual({
      code: 'division-by-zero',
      site: 'arithmetic',
      at: ['right'],
      actualType: 'number',
    });
    // A NEGATIVE zero is such a divisor: `-0 === 0`, so it earns that same refusal rather than
    // the `not-finite` it would earn by dividing -- `1 / -0` is `-Infinity`. Two plausible
    // codes for one fault, so the choice is pinned instead of left to the next reader. Taken
    // from the DATA on purpose: `JSON.stringify(-0)` is `"0"`, so no stored template carries it.
    expect(
      expectEvaluationError(() => compute('div', literal(1), path('minusZero'))),
    ).toStrictEqual({
      code: 'division-by-zero',
      site: 'arithmetic',
      at: ['right'],
      actualType: 'number',
    });
    // The other case entirely: missing data propagates, it is not a wrong formula.
    expect(compute('div', literal(1), path('line.missing'))).toBeUndefined();
  });

  it('raises on a wrong operand even when its sibling is absent', () => {
    // Shape is checked before absence, so a present-but-wrong operand still surfaces.
    expect(
      expectEvaluationError(() => compute('add', path('line.missing'), path('broken.text'))).code,
    ).toBe('operand-type');
  });

  it('builds the error path from the root through nested operations', () => {
    const deep: Expression = arithmetic(
      'add',
      literal(1),
      arithmetic('mul', literal(2), path('broken.text')),
    );

    expect(expectEvaluationError(() => evaluateExpression(deep, numeric)).at).toStrictEqual([
      'right',
      'right',
    ]);
  });
});

describe('percentOf', () => {
  const percent = (base: PrintableExpression, rate: PrintableExpression) =>
    evaluateExpression({ kind: 'percentOf', base, rate }, numeric);

  it('reads the rate in points', () => {
    expect(percent(literal(1500), literal(20))).toBe(300);
    expect(percent(path('total'), path('line.discount'))).toBe(10);
  });

  it('does not round either', () => {
    expect(percent(literal(10), literal(3))).toBe(0.3);
    expect(percent(literal(1), literal(1))).toBe(0.01);
  });

  it('never yields a negative zero either', () => {
    // The same rule, from the same exit guard, and the same `Object.is` semantics of `toBe`.
    expect(percent(literal(0), literal(-10))).toBe(0);
    expect(percent(literal(-0), literal(10))).toBe(0);
  });

  it('propagates absence and refuses a wrong shape, at its own field names', () => {
    expect(percent(path('line.missing'), literal(20))).toBeUndefined();
    expect(expectEvaluationError(() => percent(path('broken.text'), literal(20)))).toStrictEqual({
      code: 'operand-type',
      site: 'percentOf',
      at: ['base'],
      actualType: 'string',
    });
    expect(expectEvaluationError(() => percent(literal(20), path('broken.text'))).at).toStrictEqual(
      ['rate'],
    );
  });

  it('refuses a non-finite result', () => {
    expect(expectEvaluationError(() => percent(path('broken.huge'), literal(1e10))).code).toBe(
      'not-finite',
    );
  });
});
