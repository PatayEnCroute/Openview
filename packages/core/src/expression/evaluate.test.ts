import { describe, expect, it } from 'vitest';
import { findNodeById } from '../ast/visitor.js';
import { ExpressionEvaluationError } from '../errors.js';
import { parseTemplate } from '../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../template/template.js';
import { childScope, evaluateExpression, evaluatePredicate, evaluateSequence } from './evaluate.js';
import type { Expression } from './expression.js';

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

const path = (p: string): Expression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): Expression => ({
  kind: 'literal',
  value,
});

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
