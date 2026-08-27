import { describe, expect, it } from 'vitest';
import { pathsOf, rootSegment } from '../paths.js';
import type { Expression } from '../types.js';

describe('rootSegment', () => {
  it.each([
    ['invoice', 'invoice'],
    ['invoice.total', 'invoice'],
    ['invoice.customer.name', 'invoice'],
  ])('reduces %o to %o', (dataPath, expected) => {
    expect(rootSegment(dataPath)).toBe(expected);
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

  it('walks a calculation, at each operator its own field names', () => {
    const computed: Expression = {
      kind: 'arithmetic',
      op: 'sub',
      left: { kind: 'path', path: 'invoice.total' },
      right: {
        kind: 'percentOf',
        base: { kind: 'path', path: 'invoice.total' },
        rate: { kind: 'path', path: 'invoice.discountRate' },
      },
    };

    expect([...pathsOf(computed)]).toStrictEqual(['invoice.total', 'invoice.discountRate']);
  });

  it('never reports an alias an expression bound for itself', () => {
    // The bug ADR 0002 fixed for loops, which aggregations would have reintroduced: without
    // an alias context here, `sum(invoice.lines, l, l.total)` would make an integrator
    // handing over { invoice } be told a key `l` is missing when nothing is.
    const summed: Expression = {
      kind: 'aggregate',
      op: 'sum',
      source: { kind: 'path', path: 'invoice.lines' },
      as: 'l',
      value: {
        kind: 'arithmetic',
        op: 'mul',
        left: { kind: 'path', path: 'l.quantity' },
        right: { kind: 'path', path: 'company.rate' },
      },
    };

    expect([...pathsOf(summed)]).toStrictEqual(['invoice.lines', 'company.rate']);
  });

  it('confines an alias to the sub-tree that declared it', () => {
    // A copy per descent, not a mutation: `l` is invisible to the sibling below, so the
    // caller key `l.after` is still reported.
    const siblings: Expression = {
      kind: 'arithmetic',
      op: 'add',
      left: {
        kind: 'aggregate',
        op: 'sum',
        source: { kind: 'path', path: 'invoice.lines' },
        as: 'l',
        value: { kind: 'path', path: 'l.total' },
      },
      right: { kind: 'path', path: 'l.after' },
    };

    expect([...pathsOf(siblings)]).toStrictEqual(['invoice.lines', 'l.after']);
  });

  it('walks a filter through its own field names', () => {
    const discounted: Expression = {
      kind: 'count',
      source: {
        kind: 'filter',
        source: { kind: 'path', path: 'invoice.lines' },
        as: 'line',
        where: {
          kind: 'compare',
          op: 'gt',
          left: { kind: 'path', path: 'line.discount' },
          right: { kind: 'path', path: 'company.threshold' },
        },
      },
    };

    expect([...pathsOf(discounted)]).toStrictEqual(['invoice.lines', 'company.threshold']);
  });

  it('walks every text and date operator through its own field names', () => {
    // Each kind has NAMED fields of fixed arity, so there is no `args` array to guess at --
    // and the traversal has to name each one, which is what this pins.
    const joined: Expression = {
      kind: 'concat',
      parts: [
        { kind: 'literal', value: 'N° ' },
        { kind: 'text', value: { kind: 'path', path: 'invoice.number' } },
        { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'invoice.label' } },
      ],
    };
    expect([...pathsOf(joined)]).toStrictEqual(['invoice.number', 'invoice.label']);

    const due: Expression = {
      kind: 'endOfMonth',
      date: {
        kind: 'dateAdd',
        date: { kind: 'path', path: 'invoice.issuedOn' },
        days: { kind: 'path', path: 'company.paymentTerm' },
      },
    };
    expect([...pathsOf(due)]).toStrictEqual(['invoice.issuedOn', 'company.paymentTerm']);

    const overdue: Expression = {
      kind: 'dateDiff',
      from: { kind: 'path', path: 'invoice.dueOn' },
      // The render date is a caller key like any other, under a name Openview never chose.
      to: { kind: 'path', path: 'company.processedOn' },
    };
    expect([...pathsOf(overdue)]).toStrictEqual(['invoice.dueOn', 'company.processedOn']);
  });

  it('walks a rounding, which reads nothing of its own', () => {
    // `decimals` and `mode` are LITERALS -- that is the whole reason the case is joined to
    // `text`'s. A rounding reads exactly what its `value` reads, no more and no less.
    const rounded: Expression = {
      kind: 'round',
      value: { kind: 'path', path: 'invoice.total' },
      decimals: 2,
      mode: 'halfExpand',
    };

    expect([...pathsOf(rounded)]).toStrictEqual(['invoice.total']);
  });

  it('does not demand the alias a rounding is written under', () => {
    // Verifies that aggregate aliases within round expressions are excluded from required data paths.
    const total: Expression = {
      kind: 'round',
      value: {
        kind: 'aggregate',
        op: 'sum',
        source: { kind: 'path', path: 'facture.lignes' },
        as: 'l',
        value: {
          kind: 'round',
          value: { kind: 'path', path: 'l.total' },
          decimals: 2,
          mode: 'halfEven',
        },
      },
      decimals: 2,
      mode: 'halfEven',
    };

    expect([...pathsOf(total)]).toStrictEqual(['facture.lignes']);
  });

  it('collects BOTH branches of a conditional', () => {
    // The analysis reports what a template MAY read; which branch runs depends on the data,
    // so reporting only one would tell an integrator a key is unnecessary when it is.
    const guarded: Expression = {
      kind: 'if',
      when: { kind: 'isEmpty', operand: { kind: 'path', path: 'invoice.rebate' } },
      whenTrue: { kind: 'literal', value: 0 },
      whenFalse: { kind: 'path', path: 'invoice.rebate' },
    };

    expect([...pathsOf(guarded)]).toStrictEqual(['invoice.rebate']);
  });

  it('throws on an expression kind it does not know', () => {
    const smuggled: Expression = JSON.parse('{"kind":"regex"}');
    expect(() => pathsOf(smuggled)).toThrow(TypeError);
  });
});
