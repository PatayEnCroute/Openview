import { describe, expect, it } from 'vitest';
import { type Expression, ExpressionSchema, isIdentifier, pathsOf } from './expression.js';

describe('ExpressionSchema', () => {
  it('parses a nested boolean expression', () => {
    const raw = {
      kind: 'logical',
      op: 'and',
      operands: [
        { kind: 'isEmpty', operand: { kind: 'path', path: 'invoice.notes' } },
        {
          kind: 'compare',
          op: 'gte',
          left: { kind: 'path', path: 'invoice.total' },
          right: { kind: 'literal', value: 100 },
        },
      ],
    };

    expect(JSON.parse(JSON.stringify(ExpressionSchema.parse(raw)))).toStrictEqual(raw);
  });

  it.each([null, 'text', 42, true])('accepts %o as a literal value', (value) => {
    expect(ExpressionSchema.parse({ kind: 'literal', value })).toStrictEqual({
      kind: 'literal',
      value,
    });
  });

  it('rejects an unknown expression kind', () => {
    expect(() => ExpressionSchema.parse({ kind: 'regex', pattern: '.*' })).toThrow();
  });

  it('rejects an unknown comparison operator', () => {
    expect(() =>
      ExpressionSchema.parse({
        kind: 'compare',
        op: 'matches',
        left: { kind: 'literal', value: 1 },
        right: { kind: 'literal', value: 1 },
      }),
    ).toThrow();
  });

  it('rejects a logical expression with no operands', () => {
    expect(() => ExpressionSchema.parse({ kind: 'logical', op: 'or', operands: [] })).toThrow();
  });

  it.each(['invoice lines', '1invoice', 'invoice..total', 'invoice.', ''])(
    'rejects the malformed path %o',
    (path) => {
      expect(() => ExpressionSchema.parse({ kind: 'path', path })).toThrow();
    },
  );

  it.each(['__proto__', 'constructor', 'prototype', 'invoice.constructor'])(
    'refuses the prototype-chain path %o at save time',
    (path) => {
      // These are the first step of a sandbox escape, and the template that
      // carries them is user-authored. Rejecting on parse keeps them out of
      // storage entirely.
      expect(() => ExpressionSchema.parse({ kind: 'path', path })).toThrow();
    },
  );

  it('accepts a legitimate deep path', () => {
    expect(ExpressionSchema.parse({ kind: 'path', path: 'invoice.customer.address.city' })).toEqual(
      {
        kind: 'path',
        path: 'invoice.customer.address.city',
      },
    );
  });
});

describe('pathsOf', () => {
  it('walks every branch of the tree', () => {
    const expression: Expression = {
      kind: 'logical',
      op: 'or',
      operands: [
        { kind: 'not', operand: { kind: 'path', path: 'a' } },
        { kind: 'isEmpty', operand: { kind: 'path', path: 'b' } },
        {
          kind: 'compare',
          op: 'lt',
          left: { kind: 'path', path: 'c' },
          right: { kind: 'path', path: 'd' },
        },
      ],
    };

    expect([...pathsOf(expression)]).toStrictEqual(['a', 'b', 'c', 'd']);
  });

  it('reports nothing for an expression built only from literals', () => {
    expect([...pathsOf({ kind: 'literal', value: 1 })]).toStrictEqual([]);
  });

  it('throws on an expression kind it does not know', () => {
    const smuggled: Expression = JSON.parse('{"kind":"regex"}');
    expect(() => pathsOf(smuggled)).toThrow(TypeError);
  });
});

describe('isIdentifier', () => {
  it.each(['line', 'l', '_row', '$item', 'item2', 'aB_$9'])('accepts %o', (value) => {
    expect(isIdentifier(value)).toBe(true);
  });

  it.each(['', 'line.total', 'my line', '1st', 'a-b', 'é'])('refuses %o', (value) => {
    expect(isIdentifier(value)).toBe(false);
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'refuses the prototype-chain name %o',
    (value) => {
      // The same rule a path segment obeys, from the same source: a name a
      // template may declare has to be a name a path is allowed to read back.
      expect(isIdentifier(value)).toBe(false);
    },
  );
});
