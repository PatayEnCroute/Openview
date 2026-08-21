import { describe, expect, it } from 'vitest';
import { type ExpressionErrorDetails, ExpressionEvaluationError } from '../../../errors.js';
import type {
  ArithmeticExpression,
  ArithmeticOperator,
  ComparisonOperator,
  ConditionalExpression,
  Expression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
} from '../../types.js';
import { evaluateExpression, evaluatePredicate } from '../evaluate.js';

const scope = {
  invoice: {
    total: 0,
    label: 'ACME',
    paid: false,
    notes: '',
    lines: [{ sku: 'A' }, { sku: 'B' }],
    customer: { name: 'Ada' },
    missing: undefined,
  },
};

const numeric = {
  line: { quantity: 3, unitPrice: 12.5, discount: 10 },
  broken: { text: '2' },
  qty: 0,
  total: 100,
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

describe('evaluateExpression basic & logical', () => {
  it('resolves a deep path', () => {
    expect(evaluateExpression(path('invoice.customer.name'), scope)).toBe('Ada');
  });

  it('returns undefined for an absent path rather than throwing', () => {
    expect(evaluateExpression(path('invoice.missing.deep'), scope)).toBeUndefined();
  });

  it('returns undefined when a path traverses a primitive', () => {
    expect(evaluateExpression(path('invoice.label.nope'), scope)).toBeUndefined();
  });

  it('returns literals unchanged', () => {
    expect(evaluateExpression(literal(42), scope)).toBe(42);
  });

  it('reports an empty string, array and object as empty', () => {
    expect(evaluateExpression({ kind: 'isEmpty', operand: path('invoice.notes') }, scope)).toBe(
      true,
    );
    expect(evaluateExpression({ kind: 'isEmpty', operand: path('invoice.missing') }, scope)).toBe(
      true,
    );
    expect(evaluateExpression({ kind: 'isEmpty', operand: path('invoice.lines') }, scope)).toBe(
      false,
    );
    expect(evaluateExpression({ kind: 'isEmpty', operand: literal(0) }, scope)).toBe(false);
  });

  it('distinguishes an empty object from a populated one', () => {
    const withObjects = { blank: {}, filled: { name: 'Ada' } };
    expect(evaluateExpression({ kind: 'isEmpty', operand: path('blank') }, withObjects)).toBe(true);
    expect(evaluateExpression({ kind: 'isEmpty', operand: path('filled') }, withObjects)).toBe(
      false,
    );
  });

  it('short-circuits `and` before touching missing data', () => {
    const expression: Expression = {
      kind: 'logical',
      op: 'and',
      operands: [
        literal(false),
        { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
      ],
    };
    expect(evaluateExpression(expression, scope)).toBe(false);
  });

  it('short-circuits `or` on the first true operand', () => {
    const expression: Expression = {
      kind: 'logical',
      op: 'or',
      operands: [
        literal(true),
        { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
      ],
    };
    expect(evaluateExpression(expression, scope)).toBe(true);
  });

  it('negates a predicate', () => {
    expect(evaluateExpression({ kind: 'not', operand: literal(false) }, scope)).toBe(true);
  });

  it('throws on an expression kind it does not know', () => {
    const smuggled: Expression = JSON.parse('{"kind":"regex"}');
    expect(() => evaluateExpression(smuggled, scope)).toThrow(TypeError);
  });
});

describe('comparison', () => {
  const compare = (op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte', a: Expression, b: Expression) =>
    evaluateExpression({ kind: 'compare', op, left: a, right: b }, scope);

  it('compares numbers and strings by value', () => {
    expect(compare('eq', path('invoice.total'), literal(0))).toBe(true);
    expect(compare('neq', path('invoice.label'), literal('ACME'))).toBe(false);
    expect(compare('gte', literal(2), literal(2))).toBe(true);
    expect(compare('lte', literal(2), literal(3))).toBe(true);
    expect(compare('lt', literal('a'), literal('b'))).toBe(true);
    expect(compare('gt', literal(3), literal(2))).toBe(true);
  });

  it('treats an absent path as not equal to a value', () => {
    expect(compare('eq', path('invoice.missing'), literal('x'))).toBe(false);
  });

  it('refuses to order a string against a number', () => {
    expect(() => compare('gt', path('invoice.label'), literal(1))).toThrow(
      ExpressionEvaluationError,
    );
  });

  it('orders absent data as false rather than aborting the document', () => {
    expect(compare('lt', path('invoice.missing'), literal(1))).toBe(false);
    expect(compare('gt', path('invoice.missing'), literal(1))).toBe(false);
    expect(compare('gte', literal(1), path('invoice.missing'))).toBe(false);
  });

  it('refuses eq on non-primitives, which would compare by reference', () => {
    expect(() => compare('eq', path('invoice.lines'), path('invoice.lines'))).toThrow(
      /operate on primitives/,
    );
  });

  it('seals a non-finite operand here too, rather than answering in silence', () => {
    const broken = { line: { total: Number.NaN, cap: Number.POSITIVE_INFINITY } };
    const compareIn = (op: 'eq' | 'gt', a: Expression, b: Expression) =>
      evaluateExpression({ kind: 'compare', op, left: a, right: b }, broken);

    // Unsealed, this answered `false` -- so a filter dropped the line and an `if` took the
    // other branch, with no error anywhere.
    expect(
      expectEvaluationError(() => compareIn('gt', path('line.total'), literal(0))),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'compare',
      at: ['left'],
      actualType: 'not-finite',
    });
    // And on eq, where `NaN === NaN` would have reported two identical faults as different.
    expect(
      expectEvaluationError(() => compareIn('eq', literal(0), path('line.cap'))),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'compare',
      at: ['right'],
      actualType: 'not-finite',
    });
  });

  it('reads null and an omitted key as ONE absent value on eq/neq', () => {
    const absences = { line: { discount: null }, invoice: { defaultDiscount: undefined } };
    const compareIn = (op: 'eq' | 'neq', a: Expression, b: Expression) =>
      evaluateExpression({ kind: 'compare', op, left: a, right: b }, absences);
    const discount = path('line.discount');
    const fallback = path('invoice.defaultDiscount');

    expect(compareIn('eq', discount, fallback)).toBe(true);
    expect(compareIn('neq', discount, fallback)).toBe(false);
    // Absence collapses; it does not swallow. One side present is still a difference,
    // whichever side it is.
    expect(compareIn('eq', discount, literal(0))).toBe(false);
    expect(compareIn('neq', literal(0), discount)).toBe(true);
  });

  it('refuses an ordering operator outside the closed set instead of answering <=', () => {
    // The counterpart of `arithmetic.test.ts`'s smuggled operator, and the stake is not the
    // same: an amount that is wrong gets noticed, a BRANCH that is wrong renders a plausible
    // document. `lte` used to be the `default` of the ordering switch, so this answered `true`.
    const smuggled: ComparisonOperator = JSON.parse('"between"');
    expect(() => compare(smuggled, literal(1), literal(2))).toThrow(TypeError);
  });
});

describe('the conditional inside a formula', () => {
  const conditional = (
    when: Expression,
    whenTrue: PrintableExpression,
    whenFalse: PrintableExpression,
  ): ConditionalExpression => ({ kind: 'if', when, whenTrue, whenFalse });

  it('picks a branch by its condition', () => {
    const guarded = conditional(
      { kind: 'compare', op: 'gt', left: path('total'), right: literal(0) },
      literal('positive'),
      literal('zero'),
    );
    expect(evaluateExpression(guarded, numeric)).toBe('positive');
    expect(evaluateExpression(guarded, { total: 0 })).toBe('zero');
  });

  it('does NOT evaluate the branch it did not take', () => {
    const safe = conditional(
      { kind: 'compare', op: 'gt', left: path('qty'), right: literal(0) },
      arithmetic('div', path('total'), path('qty')),
      literal(0),
    );

    expect(evaluateExpression(safe, numeric)).toBe(0);
    expect(evaluateExpression(safe, { total: 100, qty: 4 })).toBe(25);
  });

  it('is what lets an author write their own fallback for absence', () => {
    const withFallback = arithmetic(
      'sub',
      path('total'),
      conditional(
        { kind: 'isEmpty', operand: path('line.rebate') },
        literal(0),
        path('line.rebate'),
      ),
    );

    expect(evaluateExpression(withFallback, numeric)).toBe(100);
    expect(evaluateExpression(withFallback, { total: 100, line: { rebate: 15 } })).toBe(85);
  });

  it('refuses truthiness in its condition, like every other predicate position', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(conditional(path('total'), literal(1), literal(2)), numeric),
      ),
    ).toStrictEqual({
      code: 'not-a-boolean',
      site: 'if',
      at: ['when'],
      actualType: 'number',
    });
  });

  it('names the branch it failed in', () => {
    const broken = conditional(
      literal(true),
      arithmetic('mul', path('broken.text'), literal(1)),
      literal(0),
    );

    expect(expectEvaluationError(() => evaluateExpression(broken, numeric)).at).toStrictEqual([
      'whenTrue',
      'left',
    ]);
  });

  it('treats an absent condition as false, so the else branch runs', () => {
    expect(
      evaluateExpression(conditional(path('nothing'), literal('yes'), literal('no')), numeric),
    ).toBe('no');
  });
});

describe('evaluatePredicate', () => {
  it('accepts a boolean result', () => {
    expect(evaluatePredicate(path('invoice.paid'), scope)).toBe(false);
  });

  it('treats absent data as false rather than aborting the render', () => {
    expect(evaluatePredicate(path('invoice.missing'), scope)).toBe(false);
  });

  it('refuses JavaScript truthiness', () => {
    expect(() => evaluatePredicate(path('invoice.total'), scope)).toThrow(
      /must return true or false, but it returns a number/,
    );
    expect(() => evaluatePredicate(path('invoice.label'), scope)).toThrow(
      ExpressionEvaluationError,
    );
  });
});
