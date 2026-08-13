import { describe, expect, it } from 'vitest';
import { findNodeById } from '../ast/visitor.js';
import {
  EXPRESSION_ERROR_CODES,
  type ExpressionErrorCode,
  type ExpressionErrorDetails,
  ExpressionEvaluationError,
  LIMIT_ERROR_CODES,
  OPERAND_ERROR_CODES,
} from '../errors.js';
import { parseTemplate } from '../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../template/template.js';
import { childScope, evaluateExpression, evaluatePredicate, evaluateSequence } from './evaluate.js';
import type {
  AggregateExpression,
  AggregateOperator,
  ArithmeticExpression,
  ArithmeticOperator,
  ConditionalExpression,
  DateAddExpression,
  DateDiffExpression,
  EndOfMonthExpression,
  Expression,
  FilterExpression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
  TextExpression,
} from './expression.js';
import { createBudget, DEFAULT_EVALUATION_LIMITS } from './limits.js';

const scope = {
  invoice: {
    total: 0,
    label: 'ACME',
    paid: false,
    notes: '',
    lines: [{ sku: 'A' }, { sku: 'B' }],
    customer: { name: 'Ada' },
  },
};

/** Amounts the integrator would supply, plus the two values a document must never print. */
const numeric = {
  line: { quantity: 3, unitPrice: 12.5, discount: 10 },
  broken: { nan: Number.NaN, huge: 1e308, text: '2' },
  qty: 0,
  total: 100,
};

// Typed at their narrowest, not as `Expression`: that is what lets them sit in a printable
// position without a cast, which is exactly the property the sub-algebra is for.
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

/**
 * Narrows by `instanceof` rather than casting: the rule AGENTS.md 1.1 states applies
 * to the tests too, and the `no-double-cast` plugin plus `noExplicitAny` leave no
 * alternative anyway.
 */
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

describe('evaluateExpression', () => {
  it('resolves a deep path', () => {
    expect(evaluateExpression(path('invoice.customer.name'), scope)).toBe('Ada');
  });

  it('returns undefined for an absent path rather than throwing', () => {
    // Core reports absence; the render pipeline decides blank vs error.
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
        // Would throw if evaluated: ordering a string against a number.
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
    // JavaScript would evaluate '10' < '9' as true. A template comparing a
    // numeric string to a number is a data-shape bug that must surface.
    expect(() => compare('gt', path('invoice.label'), literal(1))).toThrow(
      ExpressionEvaluationError,
    );
  });

  it('orders absent data as false rather than aborting the document', () => {
    // This used to throw. One invoice line missing an optional `discount` would
    // then have killed the whole render, and eq/neq already treated absence as
    // false, so the four ordering operators were the odd ones out.
    expect(compare('lt', path('invoice.missing'), literal(1))).toBe(false);
    expect(compare('gt', path('invoice.missing'), literal(1))).toBe(false);
    expect(compare('gte', literal(1), path('invoice.missing'))).toBe(false);
  });

  it('refuses eq on non-primitives, which would compare by reference', () => {
    expect(() => compare('eq', path('invoice.lines'), path('invoice.lines'))).toThrow(
      /operate on primitives/,
    );
  });
});

describe('arithmetic', () => {
  const compute = (op: ArithmeticOperator, a: PrintableExpression, b: PrintableExpression) =>
    evaluateExpression(arithmetic(op, a, b), numeric);

  it('does the four operations', () => {
    expect(compute('add', literal(2), literal(3))).toBe(5);
    expect(compute('sub', literal(2), literal(3))).toBe(-1);
    expect(compute('mul', path('line.quantity'), path('line.unitPrice'))).toBe(37.5);
    expect(compute('div', literal(9), literal(3))).toBe(3);
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
    // in lot C2.
    expect(compute('div', literal(1), literal(3))).toBe(0.3333333333333333);
    expect(compute('add', literal(0.1), literal(0.2))).toBe(0.30000000000000004);
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
    expect(() => compute('mul', path('broken.text'), literal(1))).toThrow(/refuses coercion/);
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

describe('aggregations, filter and count', () => {
  const lines = {
    invoice: {
      lines: [
        { sku: 'A', quantity: 2, unitPrice: 10, discount: 0 },
        { sku: 'B', quantity: 1, unitPrice: 30, discount: 15 },
        { sku: 'C', quantity: 4, unitPrice: 2.5, discount: 5 },
      ],
      empty: [],
      total: 70,
    },
  };

  const lineAmount: PrintableExpression = arithmetic(
    'mul',
    path('line.quantity'),
    path('line.unitPrice'),
  );

  const reduce = (
    op: AggregateOperator,
    source: Expression,
    value: PrintableExpression,
  ): AggregateExpression => ({ kind: 'aggregate', op, source, as: 'line', value });

  const discounted: FilterExpression = {
    kind: 'filter',
    source: path('invoice.lines'),
    as: 'line',
    where: { kind: 'compare', op: 'gt', left: path('line.discount'), right: literal(0) },
  };

  it('reduces lines whose amount is ITSELF a calculation', () => {
    // The point of the lot: no amount is supplied by the render data. 2*10 + 1*30 + 4*2.5.
    expect(evaluateExpression(reduce('sum', path('invoice.lines'), lineAmount), lines)).toBe(60);
    expect(evaluateExpression(reduce('avg', path('invoice.lines'), lineAmount), lines)).toBe(20);
    expect(evaluateExpression(reduce('min', path('invoice.lines'), lineAmount), lines)).toBe(10);
    expect(evaluateExpression(reduce('max', path('invoice.lines'), lineAmount), lines)).toBe(30);
  });

  it('treats an empty list as no fault, and each operator answers in its own way', () => {
    // `sum` has an additive identity, `count` has zero, and min/max/avg have neither.
    expect(evaluateExpression(reduce('sum', path('invoice.empty'), lineAmount), lines)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('invoice.empty') }, lines)).toBe(0);
    expect(
      evaluateExpression(reduce('avg', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
    expect(
      evaluateExpression(reduce('min', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
    expect(
      evaluateExpression(reduce('max', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
  });

  it('treats an absent source as an empty list', () => {
    expect(evaluateExpression(reduce('sum', path('invoice.missing'), lineAmount), lines)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('invoice.missing') }, lines)).toBe(0);
  });

  it('ignores an element whose value is absent, and avg divides by the PRESENT ones', () => {
    // The aggregate policy differs from the scalar one on purpose: in a scalar operation the
    // author named two operands, so one missing says the premise fails; here they named ONE
    // expression applied to N elements, and dropping the total of 60 lines because one has
    // no discount would be the maximum of surprise.
    const partial = {
      invoice: { lines: [{ rebate: 10 }, { sku: 'no rebate' }, { rebate: 20 }] },
    };

    expect(
      evaluateExpression(reduce('sum', path('invoice.lines'), path('line.rebate')), partial),
    ).toBe(30);
    // 30 / 2, not 30 / 3: `avg` does NOT avoid the division by zero by construction -- that
    // is only true of the empty list, and a list of 60 lines where none carries a discount
    // gives 0/0.
    expect(
      evaluateExpression(reduce('avg', path('invoice.lines'), path('line.rebate')), partial),
    ).toBe(15);
    expect(
      evaluateExpression(reduce('avg', path('invoice.lines'), path('line.absent')), partial),
    ).toBeUndefined();
  });

  it('refuses a source that is present but not a list, IN THE CALLER VOCABULARY', () => {
    // The hard-coded `A loop needs a list` would have said **loop** to whoever wrote a sum.
    expect(() =>
      evaluateExpression(reduce('sum', path('invoice.total'), lineAmount), lines),
    ).toThrow(/An aggregation needs a list/);
    expect(() =>
      evaluateExpression({ kind: 'count', source: path('invoice.total') }, lines),
    ).toThrow(/A count needs a list/);
    expect(() =>
      evaluateExpression({ ...discounted, source: path('invoice.total') }, lines),
    ).toThrow(/A filter needs a list/);

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.total'), lineAmount), lines),
      ),
    ).toStrictEqual({
      code: 'not-a-list',
      site: 'aggregate',
      at: ['source'],
      actualType: 'number',
    });
  });

  it('points at the offending element by INDEX, as a number and from the root', () => {
    const mistyped = { invoice: { lines: [{ total: 1 }, { total: 'two' }] } };

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), mistyped),
      ),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'aggregate',
      at: ['value', 1],
      actualType: 'string',
    });
  });

  it('refuses a non-finite element value, and a non-finite total', () => {
    const broken = { invoice: { lines: [{ total: Number.NaN }] } };
    const huge = { invoice: { lines: [{ total: 1e308 }, { total: 1e308 }] } };

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), broken),
      ),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'aggregate',
      at: ['value', 0],
      actualType: 'not-finite',
    });
    // At the exit too: 60 000 lines at 1e307 must not print Infinity into a document.
    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), huge),
      ),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'aggregate',
      at: [],
      actualType: 'not-finite',
    });
  });

  it('accumulates POSITIONALLY, and never reorders', () => {
    // Part of the contract, not an implementation detail: binary64 addition is not
    // associative, so "the same bit on two machines" holds for a sum ONLY if nothing
    // reorders. Summed left to right this is 0; in any other order it is 1.
    const unstable = { invoice: { lines: [{ v: 1e16 }, { v: 1 }, { v: -1e16 }] } };

    expect(evaluateExpression(reduce('sum', path('invoice.lines'), path('line.v')), unstable)).toBe(
      0,
    );
  });

  it('counts a filtered list, which is how "how many discounted lines" is written', () => {
    expect(evaluateExpression({ kind: 'count', source: discounted }, lines)).toBe(2);
    expect(evaluateExpression(reduce('sum', discounted, path('line.discount')), lines)).toBe(20);
  });

  it('refuses truthiness in a filter, like every other predicate position', () => {
    const truthy: FilterExpression = { ...discounted, where: path('line.discount') };

    expect(expectEvaluationError(() => evaluateExpression(truthy, lines))).toStrictEqual({
      code: 'not-a-boolean',
      site: 'filter',
      at: ['where', 0],
      actualType: 'number',
    });
  });

  it('drives a loop node from a filter, without the node having been retyped', () => {
    // Unbilled benefit of composition over an optional `where`: `LoopNode.each` was already
    // typed `Expression`, so "repeat only the discounted lines" needed no change to the node.
    expect(evaluateSequence(discounted, lines)).toHaveLength(2);
  });

  it('handles 60 000 elements without a RangeError', () => {
    // min/max fold rather than spread: `Math.min(...values)` overflows the stack here, and
    // 60 000 lines is a realistic accounting invoice rather than a stress test.
    const many = { rows: Array.from({ length: 60_000 }, (_unused, index) => ({ v: index })) };

    expect(evaluateExpression(reduce('max', path('rows'), path('line.v')), many)).toBe(59_999);
    expect(evaluateExpression(reduce('min', path('rows'), path('line.v')), many)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('rows') }, many)).toBe(60_000);
  });

  it('bounds a triply nested aggregate in bounded TIME', () => {
    // Measured: the cost is O(n^k) where k is chosen by the template author -- 200 lines at
    // three nesting levels is 8 080 402 steps and 17.5 seconds, at four about 58 minutes, at
    // six centuries. No field, no length and no depth is abnormal; it is the product of the
    // cardinalities that explodes, and nothing in the contract looks at that. The bound is
    // what makes this refuse instead of run.
    const rows = { rows: Array.from({ length: 30 }, (_unused, index) => ({ v: index })) };
    const innermost = reduce('sum', path('rows'), path('line.v'));
    const middle = reduce('sum', path('rows'), innermost);
    const outermost = reduce('sum', path('rows'), middle);

    const details = expectEvaluationError(() =>
      evaluateExpression(outermost, rows, { budget: createBudget({ maxItemsVisited: 5_000 }) }),
    );

    expect(details.code).toBe('item-limit-exceeded');
    if (details.code === 'item-limit-exceeded') {
      expect(details.limit).toBe(5_000);
    }
  });

  it('lets an alias shadow a caller key, which is a defined outcome and a documented hole', () => {
    // Writable, and worth pinning rather than pretending otherwise: the resolution rule is
    // the one `childScope` already carried for a loop alias. What changes is that there are
    // two new SITES for it, which is why collectDataPaths grew a third documented limit.
    const shadowing: AggregateExpression = {
      kind: 'aggregate',
      op: 'sum',
      source: path('invoice.lines'),
      as: 'invoice',
      value: path('invoice.quantity'),
    };

    expect(evaluateExpression(shadowing, lines)).toBe(7);
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
    // The one test of the lot that fails if the implementation is written "naturally" --
    // evaluate both branches, then choose. The short circuit is a correctness rule: `and`
    // and `or` already short-circuit, so an author assumes the "if" does too, and the
    // surprise would be paid in a division by zero on an untaken branch.
    const safe = conditional(
      { kind: 'compare', op: 'gt', left: path('qty'), right: literal(0) },
      arithmetic('div', path('total'), path('qty')),
      literal(0),
    );

    expect(evaluateExpression(safe, numeric)).toBe(0);
    expect(evaluateExpression(safe, { total: 100, qty: 4 })).toBe(25);
  });

  it('is what lets an author write their own fallback for absence', () => {
    // `sub(total, discount)` with no discount yields nothing, which is honest. The policy
    // belongs to the template's author, never to a fallback the evaluator guessed.
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

describe('texts', () => {
  const texts = {
    invoice: { number: 4711, label: 'acme sàrl', notes: '', flag: true, lines: [1, 2] },
  };
  const concat = (...parts: PrintableExpression[]): Expression => ({ kind: 'concat', parts });
  const asText = (value: PrintableExpression): TextExpression => ({ kind: 'text', value });

  it('joins two and three parts', () => {
    expect(evaluateExpression(concat(literal('a'), literal('b')), texts)).toBe('ab');
    expect(evaluateExpression(concat(literal('a'), literal('b'), literal('c')), texts)).toBe('abc');
  });

  it('refuses a NUMBER, because the algebra refuses coercion', () => {
    // The join is not an overloaded `+`. With implicit stringification there would be an
    // operator that adds or concatenates depending on the data, which is uninterpretable in a
    // formula bar.
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
    // The whole reason `text()` exists: gluing a label to a number the integrator supplies as
    // a number. And 4711 comes back as "4711" -- NO THOUSANDS SEPARATOR, which is the proof
    // that no format slipped into this lot. Formatting belongs to lot C6.
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
    // `text(true)` would print `true` into a document, exactly what a print position has
    // forbidden since ADR 0002.
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
    // The one place in this lot where determinism holds by convention rather than by
    // specification: `toUpperCase` is specified but INDEXED ON THE ENGINE'S UNICODE VERSION.
    // `'ß'.toUpperCase()` is "SS" -- one character becomes two, THE LENGTH CHANGES, therefore
    // the layout and the pagination change. One German company name is enough. These
    // expectations are hard-coded so a Node upgrade that changes a result is reported by a
    // test rather than by an invoice.
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
    // Measured on a balanced `concat(x, x)` tree over a 1 kB value: depth 12 gives a 4 MB
    // string, depth 18 gives 268 MB and 858 MB of RSS. The bound is checked after EVERY
    // construction, which is the only order that keeps the intermediate string from existing
    // before being refused -- so this is a verification by refusal, not by crash.
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
    // Without this, `upper(concat(...))` and `text(...)` would each be a way around it.
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

describe('civil dates in the algebra', () => {
  const dates = {
    invoice: { issuedOn: '2026-01-31', dueOn: '2026-03-02', bad: '2026-02-30', term: 30 },
    // The render date is DATA, under a name the integrator chose. Openview reserves none.
    company: { processedOn: '2026-03-10' },
  };
  const dateAdd = (date: PrintableExpression, days: PrintableExpression): DateAddExpression => ({
    kind: 'dateAdd',
    date,
    days,
  });
  const dateDiff = (from: PrintableExpression, to: PrintableExpression): DateDiffExpression => ({
    kind: 'dateDiff',
    from,
    to,
  });
  const endOfMonth = (date: PrintableExpression): EndOfMonthExpression => ({
    kind: 'endOfMonth',
    date,
  });

  it('adds days without inventing a month convention', () => {
    expect(evaluateExpression(dateAdd(literal('2026-01-31'), literal(30)), dates)).toBe(
      '2026-03-02',
    );
    expect(evaluateExpression(dateAdd(literal('2024-01-31'), literal(30)), dates)).toBe(
      '2024-03-01',
    );
    expect(evaluateExpression(dateAdd(path('invoice.issuedOn'), path('invoice.term')), dates)).toBe(
      '2026-03-02',
    );
  });

  it('counts days in both directions', () => {
    expect(evaluateExpression(dateDiff(literal('2026-01-01'), literal('2026-03-01')), dates)).toBe(
      59,
    );
    expect(evaluateExpression(dateDiff(literal('2026-03-01'), literal('2026-01-01')), dates)).toBe(
      -59,
    );
    expect(evaluateExpression(dateDiff(literal('2026-01-01'), literal('2026-01-01')), dates)).toBe(
      0,
    );
  });

  it('composes "45 days end of month"', () => {
    expect(evaluateExpression(endOfMonth(dateAdd(literal('2026-01-20'), literal(45))), dates)).toBe(
      '2026-03-31',
    );
    expect(evaluateExpression(endOfMonth(literal('2024-02-05')), dates)).toBe('2024-02-29');
  });

  it('reads the render date as a KEY OF THE SCOPE, under a name Openview never chose', () => {
    // Proven by changing the value and watching the result change: there is no `today` to
    // reserve, and the only rule left is that the engine does not read the clock (E6).
    const overdue = dateDiff(path('invoice.dueOn'), path('company.processedOn'));

    expect(evaluateExpression(overdue, dates)).toBe(8);
    expect(evaluateExpression(overdue, { ...dates, company: { processedOn: '2026-03-20' } })).toBe(
      18,
    );
    // Absent, and the document does not abort: core reports absence, policy is elsewhere.
    expect(evaluateExpression(overdue, { invoice: dates.invoice, company: {} })).toBeUndefined();
  });

  it('names the CALLING operator on a bad date, not always dateAdd', () => {
    // The most likely copy-paste mistake of the lot: it passes all four gates while naming the
    // wrong operator to the user. Hence dateDiff and endOfMonth, not only dateAdd.
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(path('invoice.bad'), literal(1)), dates),
      ),
    ).toStrictEqual({ code: 'not-a-date', site: 'dateAdd', at: ['date'], actualType: 'string' });
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateDiff(literal('2026-01-01'), path('invoice.bad')), dates),
      ),
    ).toStrictEqual({ code: 'not-a-date', site: 'dateDiff', at: ['to'], actualType: 'string' });
    expect(
      expectEvaluationError(() => evaluateExpression(endOfMonth(path('invoice.bad')), dates)),
    ).toStrictEqual({ code: 'not-a-date', site: 'endOfMonth', at: ['date'], actualType: 'string' });
  });

  it('refuses a date that is not text at all', () => {
    expect(
      expectEvaluationError(() => evaluateExpression(endOfMonth(literal(20_260_131)), dates)),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'endOfMonth',
      at: ['date'],
      actualType: 'number',
    });
  });

  it('refuses a shift that is not a whole number of days', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(literal('2026-01-31'), literal(1.5)), dates),
      ),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'dateAdd',
      at: ['days'],
      actualType: 'number',
    });
  });

  it('refuses a shift that leaves the supported range', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(literal('9999-12-31'), literal(1)), dates),
      ),
    ).toStrictEqual({
      code: 'not-a-date',
      site: 'dateAdd',
      at: ['days'],
      actualType: 'number',
    });
  });

  it('propagates absence rather than aborting', () => {
    expect(
      evaluateExpression(dateAdd(path('invoice.missing'), literal(30)), dates),
    ).toBeUndefined();
    expect(
      evaluateExpression(dateAdd(literal('2026-01-31'), path('invoice.missing')), dates),
    ).toBeUndefined();
    expect(evaluateExpression(endOfMonth(path('invoice.missing')), dates)).toBeUndefined();
  });

  it('yields ISO, which is an EXCHANGE form and not a display format', () => {
    // Until lot C6 owns display, a template that prints this prints ISO. That is stated rather
    // than hidden, and the playground labels these as raw values.
    expect(evaluateExpression(dateAdd(literal('2026-01-31'), literal(0)), dates)).toBe(
      '2026-01-31',
    );
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
    // The bug this prevents: `invoice.total` of 0 is falsy, so a truthiness-based
    // condition would silently drop a zero line from an invoice.
    expect(() => evaluatePredicate(path('invoice.total'), scope)).toThrow(
      /must evaluate to a boolean/,
    );
    expect(() => evaluatePredicate(path('invoice.label'), scope)).toThrow(
      ExpressionEvaluationError,
    );
  });
});

describe('evaluateSequence', () => {
  it('iterates a list', () => {
    expect(evaluateSequence(path('invoice.lines'), scope)).toHaveLength(2);
  });

  it('yields no iterations for absent data', () => {
    expect(evaluateSequence(path('invoice.missing'), scope)).toStrictEqual([]);
  });

  it('refuses a value that is present but not a list', () => {
    expect(() => evaluateSequence(path('invoice.total'), scope)).toThrow(/needs a list/);
  });

  it('keeps the loop wording verbatim when no caller is named', () => {
    // The message lot C8 will own, unchanged: this increment adds the machine payload
    // beside it, not a new sentence.
    expect(() => evaluateSequence(path('invoice.total'), scope)).toThrow(
      'A loop needs a list to iterate over, got a number.',
    );
  });

  it('falls back to a neutral subject for a caller that has no wording', () => {
    // The wording table is deliberately partial and grows with the algebra, so the
    // fallback is reachable rather than dead -- and it must not say "loop" to a caller
    // that is not one. The list-reducing kinds get their own wording in INC-6.
    expect(() => evaluateSequence(path('invoice.total'), scope, { caller: 'condition' })).toThrow(
      /An expression needs a list/,
    );
  });
});

/** A chain of `levels` nested `not` nodes -- built in a loop, so it passes no guard. */
function nestedNot(levels: number): Expression {
  let built: Expression = literal(true);
  for (let remaining = 0; remaining < levels; remaining += 1) {
    built = { kind: 'not', operand: built };
  }
  return built;
}

/**
 * One producer per DECLARED code, every one of them executed by the test below -- so "the
 * catalogue is complete" is proven rather than declared.
 *
 * The catalogue was declared whole from the first increment of this lot, because lot C8 has
 * to enumerate it and adding a required field to a public interface mid-lot would have been
 * the only real cost. While producers were still landing, this table was paired with a dated
 * `PENDING_CODES` debt list and the assertion was a PARTITION: produced ∪ debt == catalogue,
 * and produced ∩ debt == ∅. That kept a declared-but-unproducible code from passing as
 * covered, and kept a settled debt from rotting in silence. Nothing is owed any more, so the
 * debt list is gone from the file and the exhaustive assertion appeared by subtraction.
 *
 * A TOTAL `Record` rather than a `Partial`, which is the stricter form the subtraction buys:
 * a declared code with no producer now fails to COMPILE. It forbids the two symmetrical
 * drifts -- a code nothing produces (C8 would promise a message for an impossible situation)
 * and a throw with no label (C8 would have nothing to hang a message on).
 */
const PRODUCED_CODES: Readonly<Record<ExpressionErrorCode, () => unknown>> = {
  'not-comparable': () =>
    evaluateExpression(
      { kind: 'compare', op: 'eq', left: path('invoice.lines'), right: path('invoice.lines') },
      scope,
    ),
  'not-orderable': () =>
    evaluateExpression(
      { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
      scope,
    ),
  'not-a-boolean': () => evaluatePredicate(path('invoice.total'), scope),
  'not-a-list': () => evaluateSequence(path('invoice.total'), scope),
  'step-limit-exceeded': () =>
    evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxSteps: 4 }) }),
  'depth-limit-exceeded': () =>
    evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxDepth: 4 }) }),
  // Earlier than the plan assigned it: the element counter lives in the shared list
  // primitive rather than in each list-reducing operator, so a loop source already
  // exercises it.
  'item-limit-exceeded': () =>
    evaluateSequence(path('invoice.lines'), scope, {
      budget: createBudget({ maxItemsVisited: 1 }),
    }),
  'operand-type': () =>
    evaluateExpression(arithmetic('add', path('invoice.label'), literal(1)), scope),
  'not-finite': () =>
    evaluateExpression(arithmetic('add', path('broken.nan'), literal(1)), numeric),
  'division-by-zero': () => evaluateExpression(arithmetic('div', literal(1), literal(0)), scope),
  'not-a-date': () =>
    evaluateExpression({ kind: 'endOfMonth', date: literal('not a date') }, scope),
  'string-limit-exceeded': () =>
    evaluateExpression({ kind: 'concat', parts: [literal('abcd'), literal('efgh')] }, scope, {
      budget: createBudget({ maxStringLength: 4 }),
    }),
};

describe('expression error payload', () => {
  it('produces every code the catalogue declares, and no other', () => {
    // The total Record above already makes a missing producer a compile error; this catches
    // the other direction, a producer for a code the catalogue dropped.
    expect(Object.keys(PRODUCED_CODES).sort()).toStrictEqual([...EXPRESSION_ERROR_CODES].sort());
  });

  it.each(Object.entries(PRODUCED_CODES))('produces %s from a real evaluation', (code, run) => {
    expect(expectEvaluationError(run).code).toBe(code);
  });

  it('keeps the two catalogues disjoint and their union whole', () => {
    const operand: readonly string[] = OPERAND_ERROR_CODES;
    const limit: readonly string[] = LIMIT_ERROR_CODES;

    expect(operand.filter((code) => limit.includes(code))).toStrictEqual([]);
    expect(EXPRESSION_ERROR_CODES).toHaveLength(operand.length + limit.length);
  });

  it('names the culprit operand of an incomparable pair', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'eq', left: path('invoice.lines'), right: literal('x') },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-comparable',
      site: 'compare',
      at: ['left'],
      actualType: 'list',
    });

    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'neq', left: literal('x'), right: path('invoice.lines') },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-comparable',
      site: 'compare',
      at: ['right'],
      actualType: 'list',
    });
  });

  it('anchors an unorderable pair on the left operand', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-orderable',
      site: 'compare',
      at: ['left'],
      actualType: 'string',
    });
  });

  it('reports the site of a predicate position that is not an expression', () => {
    // `ExpressionKind` alone could not say this: `ConditionNode.when` carries an
    // expression without being one, which is why the field is `site` and not `kind`.
    expect(
      expectEvaluationError(() => evaluatePredicate(path('invoice.total'), scope)),
    ).toStrictEqual({ code: 'not-a-boolean', site: 'condition', at: [], actualType: 'number' });

    expect(
      expectEvaluationError(() =>
        evaluateSequence(path('invoice.total'), scope, { caller: 'loop' }),
      ),
    ).toStrictEqual({ code: 'not-a-list', site: 'loop', at: [], actualType: 'number' });
  });

  it('points at the operand index of a logical, as a number and not a string', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'logical', op: 'and', operands: [literal(true), path('invoice.total')] },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-a-boolean',
      site: 'logical',
      at: ['operands', 1],
      actualType: 'number',
    });
  });

  it('points at the operand of a not', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression({ kind: 'not', operand: path('invoice.total') }, scope),
      ),
    ).toStrictEqual({
      code: 'not-a-boolean',
      site: 'not',
      at: ['operand'],
      actualType: 'number',
    });
  });

  it('builds the path from the root, and root-to-leaf', () => {
    // The property no gate can see: `fail()` writes a LOCAL path and every descent
    // prefixes its own segment on the way out. If the order were reversed, this reads
    // ['left', 1, 'operands'].
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          {
            kind: 'logical',
            op: 'and',
            operands: [
              literal(true),
              { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
            ],
          },
          scope,
        ),
      ).at,
    ).toStrictEqual(['operands', 1, 'left']);
  });

  it('reaches inside an isEmpty operand as well', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          {
            kind: 'isEmpty',
            operand: { kind: 'compare', op: 'lt', left: literal(true), right: literal(false) },
          },
          scope,
        ),
      ).at,
    ).toStrictEqual(['operand', 'left']);
  });

  it('hands out the same path on every read, and a copy that a later prefix cannot touch', () => {
    // The two remaining properties of the private reversed path. Nothing in the four
    // gates sees either of them.
    let caught: ExpressionEvaluationError | undefined;
    try {
      evaluateExpression({ kind: 'not', operand: path('invoice.total') }, scope);
    } catch (error) {
      if (!(error instanceof ExpressionEvaluationError)) {
        throw error;
      }
      caught = error;
    }
    if (caught === undefined) {
      throw new Error('the expression should have failed');
    }

    const first = caught.details.at;
    expect(caught.details.at).toStrictEqual(first);

    caught.prefix('value');
    expect(first).toStrictEqual(['operand']);
    expect(caught.details.at).toStrictEqual(['value', 'operand']);
  });

  it('lets a foreign error through the descent untouched', () => {
    // The descent wrapper prefixes paths; it must not catch anything else. A kind that
    // bypassed Zod raises a TypeError, and enriching or absorbing it here would hide
    // the one failure that means "this value never went through validation".
    const smuggled: Expression = JSON.parse('{"kind":"regex"}');

    expect(() => evaluateExpression({ kind: 'not', operand: smuggled }, scope)).toThrow(TypeError);
  });

  it('carries the configured ceiling on a bound failure, not a shape', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxSteps: 4 }) }),
      ),
    ).toStrictEqual({
      code: 'step-limit-exceeded',
      site: 'not',
      at: ['operand', 'operand', 'operand', 'operand'],
      limit: 4,
    });
  });

  it('carries a hand-built deep tree as depth-limit-exceeded, not a RangeError', () => {
    // The hole this closes: `evaluateExpression` is public and takes an Expression from
    // wherever. A tree built in a loop by an integrator, never passed through
    // parseTemplate, overflows the stack around 20 000 levels and raises a bare
    // RangeError -- the very unwrapped error the shape guard refuses at parse time.
    const details = expectEvaluationError(() =>
      evaluateExpression(nestedNot(200), scope, { budget: createBudget({ maxDepth: 8 }) }),
    );

    expect(details.code).toBe('depth-limit-exceeded');
    if (details.code === 'depth-limit-exceeded') {
      expect(details.limit).toBe(8);
    }
  });

  it('accumulates one budget across two top-level calls', () => {
    // The reason a budget and a configuration are two different types. A counter local to
    // evaluateExpression resets on every top-level call, so a document with 500 bindings
    // would get 500 separate allowances and the bound would be decorative.
    const budget = createBudget({ maxSteps: 6 });

    expect(evaluateExpression(nestedNot(3), scope, { budget })).toBe(false);
    expect(budget.spent.steps).toBe(4);
    expect(() => evaluateExpression(nestedNot(3), scope, { budget })).toThrow(
      /more than 6 operations/,
    );
  });

  it('bounds a call that was given no budget at all', () => {
    // Defaults are active, never opt-in. A caller who omits the budget still gets bounded
    // -- just per call, which is the residual risk ADR 0003 names out loud.
    expect(() =>
      evaluateExpression(nestedNot(DEFAULT_EVALUATION_LIMITS.maxDepth + 5), scope),
    ).toThrow(/nests more than 64 levels/);
  });

  it('counts the root node too', () => {
    // The counters sit at the head of evaluateExpression rather than in the descent
    // wrapper, precisely so the root is not free: a wrapper by definition never sees it.
    const budget = createBudget();
    evaluateExpression(literal(1), scope, { budget });

    expect(budget.spent.steps).toBe(1);
    expect(budget.spent.depth).toBe(0);
  });

  it('reports the traversal ceiling from the list primitive', () => {
    expect(
      expectEvaluationError(() =>
        evaluateSequence(path('invoice.lines'), scope, {
          budget: createBudget({ maxItemsVisited: 1 }),
        }),
      ),
    ).toStrictEqual({
      code: 'item-limit-exceeded',
      site: 'loop',
      at: [],
      limit: 1,
    });
  });

  it('carries a ceiling rather than a shape on the bound branch', () => {
    // Declared from INC-1 so C8 can enumerate the catalogue, and constructible now
    // even though the evaluator has no producer for it until INC-3.
    const error = new ExpressionEvaluationError('bounded', {
      code: 'step-limit-exceeded',
      site: 'logical',
      at: ['operands', 0],
      limit: 5,
    });

    const details = error.details;
    expect(details.code).toBe('step-limit-exceeded');
    if (details.code === 'step-limit-exceeded') {
      // Narrowing by the discriminant, no cast: the bound branch has `limit` and no
      // `actualType` to invent.
      expect(details.limit).toBe(5);
    }
    expect(details.at).toStrictEqual(['operands', 0]);
  });
});

describe('scope reading', () => {
  it('ignores inherited properties, so a path cannot reach Object.prototype', () => {
    // These paths are refused by the schema, so reaching them means the document
    // bypassed validation -- data read straight from storage. `Reflect.get` alone
    // returned a function here, which a text binding would have printed.
    expect(evaluateExpression(path('invoice.toString'), scope)).toBeUndefined();
    expect(evaluateExpression(path('invoice.hasOwnProperty'), scope)).toBeUndefined();
  });

  it('ignores a non-enumerable own property, which childScope cannot copy', () => {
    const hidden: Record<string, unknown> = { invoice: { total: 1 } };
    Object.defineProperty(hidden, 'company', { value: { name: 'ACME' } });

    // The divergence this rules out: readable outside a loop, gone inside one.
    // Both now report absence, so the resolver and the scope builder agree.
    expect(evaluateExpression(path('company.name'), hidden)).toBeUndefined();
    expect(
      evaluateExpression(path('company.name'), childScope(hidden, 'line', {})),
    ).toBeUndefined();
  });

  it('honours a getter declared as an own enumerable property', () => {
    const withGetter = {
      get today(): string {
        return '2026-08-12';
      },
    };

    expect(evaluateExpression(path('today'), withGetter)).toBe('2026-08-12');
    expect(evaluateExpression(path('today'), childScope(withGetter, 'line', {}))).toBe(
      '2026-08-12',
    );
  });
});

describe('childScope', () => {
  it('binds the current item under the alias, keeping the enclosing data reachable', () => {
    const lines = evaluateSequence(path('invoice.lines'), scope);
    const first = childScope(scope, 'line', lines[0]);

    expect(evaluateExpression(path('line.sku'), first)).toBe('A');
    // A line still knows its invoice: the enclosing scope is not replaced.
    expect(evaluateExpression(path('invoice.label'), first)).toBe('ACME');
  });

  it('lets the innermost loop shadow an outer alias', () => {
    const outer = childScope(scope, 'row', { sku: 'outer' });
    const inner = childScope(outer, 'row', { sku: 'inner' });

    expect(evaluateExpression(path('row.sku'), inner)).toBe('inner');
    // Lexical shadowing: the outer binding still holds in its own scope. This is
    // why an alias collision is a defined outcome and not an ambiguous one.
    expect(evaluateExpression(path('row.sku'), outer)).toBe('outer');
  });

  it('leaves the parent scope untouched', () => {
    childScope(scope, 'line', { sku: 'X' });
    expect(evaluateExpression(path('line.sku'), scope)).toBeUndefined();
  });

  it('reads a primitive item through the alias alone', () => {
    // A list of strings, printed with no field access.
    expect(evaluateExpression(path('tag'), childScope({}, 'tag', 'urgent'))).toBe('urgent');
  });

  it('drives a parsed template loop, with no alias invented by the caller', () => {
    // The seam ADR 0002 rests on. The alias and the condition both come off the
    // parsed document, and nothing outside the template literal names `line`: if
    // the schema stopped carrying `as`, or the evaluator stopped honouring it,
    // this fails -- which neither half's own unit tests would catch.
    const template = parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'tpl_1',
      name: 'Invoice',
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lines',
            each: { kind: 'path', path: 'invoice.lines' },
            as: 'line',
            children: [
              {
                type: 'condition',
                id: 'discounted',
                when: {
                  kind: 'compare',
                  op: 'gt',
                  left: { kind: 'path', path: 'line.discount' },
                  right: { kind: 'literal', value: 0 },
                },
                children: [],
              },
            ],
          },
        ],
      },
    });

    const loop = findNodeById(template.root, 'lines');
    const condition = findNodeById(template.root, 'discounted');
    if (loop?.type !== 'loop' || condition?.type !== 'condition') {
      // A throw rather than an assertion: it narrows both nodes for the lines
      // below without the non-null assertion this repo forbids.
      throw new Error('the parsed template lost its loop or its condition');
    }

    const data = { invoice: { lines: [{ discount: 0 }, { discount: 15 }] } };
    const applied = evaluateSequence(loop.each, data).map((item) =>
      evaluatePredicate(condition.when, childScope(data, loop.as, item)),
    );

    expect(applied).toStrictEqual([false, true]);
  });
});
