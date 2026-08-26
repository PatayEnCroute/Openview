import { describe, expect, it } from 'vitest';
import type { Expression, ExpressionKind } from '../types.js';
import { type ExpressionVisitor, visitExpression } from '../visitor.js';

const NUMBER: Expression = { kind: 'literal', value: 1 };
const TEXT: Expression = { kind: 'literal', value: 'a' };
const FLAG: Expression = { kind: 'literal', value: true };
const LIST: Expression = { kind: 'path', path: 'source' };

/** One expression per kind: the Record type is what makes a missing sample a compile error. */
const SAMPLES: Readonly<Record<ExpressionKind, Expression>> = {
  literal: NUMBER,
  path: { kind: 'path', path: 'a.b' },
  arithmetic: { kind: 'arithmetic', op: 'add', left: NUMBER, right: NUMBER },
  percentOf: { kind: 'percentOf', base: NUMBER, rate: NUMBER },
  round: { kind: 'round', value: NUMBER, decimals: 2, mode: 'halfExpand' },
  concat: { kind: 'concat', parts: [TEXT] },
  text: { kind: 'text', value: NUMBER },
  textCase: { kind: 'textCase', op: 'upper', text: TEXT },
  dateAdd: { kind: 'dateAdd', date: TEXT, days: NUMBER },
  dateDiff: { kind: 'dateDiff', from: TEXT, to: TEXT },
  endOfMonth: { kind: 'endOfMonth', date: TEXT },
  aggregate: { kind: 'aggregate', op: 'sum', source: LIST, as: 'item', value: NUMBER },
  count: { kind: 'count', source: LIST },
  filter: { kind: 'filter', source: LIST, as: 'item', where: FLAG },
  if: { kind: 'if', when: FLAG, whenTrue: NUMBER, whenFalse: NUMBER },
  compare: { kind: 'compare', op: 'eq', left: NUMBER, right: NUMBER },
  logical: { kind: 'logical', op: 'and', operands: [FLAG] },
  not: { kind: 'not', operand: FLAG },
  isEmpty: { kind: 'isEmpty', operand: LIST },
};

const KINDS: readonly ExpressionKind[] = Object.keys(SAMPLES).filter(
  (key): key is ExpressionKind => key in SAMPLES,
);

/** Every branch answers with its own name, so a misrouted dispatch names the branch that fired. */
const NAMING: ExpressionVisitor<string, undefined> = {
  literal: () => 'literal',
  path: () => 'path',
  arithmetic: () => 'arithmetic',
  percentOf: () => 'percentOf',
  round: () => 'round',
  concat: () => 'concat',
  text: () => 'text',
  textCase: () => 'textCase',
  dateAdd: () => 'dateAdd',
  dateDiff: () => 'dateDiff',
  endOfMonth: () => 'endOfMonth',
  aggregate: () => 'aggregate',
  count: () => 'count',
  filter: () => 'filter',
  if: () => 'if',
  compare: () => 'compare',
  logical: () => 'logical',
  not: () => 'not',
  isEmpty: () => 'isEmpty',
};

/** Builds a visitor whose nineteen branches share one implementation, with no assertion. */
function uniform<TResult, TContext>(
  branch: (expression: Expression, context: TContext) => TResult,
): ExpressionVisitor<TResult, TContext> {
  return {
    literal: branch,
    path: branch,
    arithmetic: branch,
    percentOf: branch,
    round: branch,
    concat: branch,
    text: branch,
    textCase: branch,
    dateAdd: branch,
    dateDiff: branch,
    endOfMonth: branch,
    aggregate: branch,
    count: branch,
    filter: branch,
    if: branch,
    compare: branch,
    logical: branch,
    not: branch,
    isEmpty: branch,
  };
}

describe('visitExpression', () => {
  it.each(KINDS)('samples %s under its own discriminant', (kind) => {
    expect(SAMPLES[kind].kind).toBe(kind);
  });

  it.each(KINDS)('routes %s to its own branch', (kind) => {
    expect(visitExpression(SAMPLES[kind], NAMING, undefined)).toBe(kind);
  });

  it.each(KINDS)('hands the %s branch the expression itself, not a copy', (kind) => {
    const identity = uniform<Expression, undefined>((expression) => expression);
    expect(visitExpression(SAMPLES[kind], identity, undefined)).toBe(SAMPLES[kind]);
  });

  it('throws on a kind it does not know', () => {
    // The guarantee the document visitor gives for node types, now given for the algebra: a
    // twentieth kind breaks compilation at this single site instead of escaping one traversal.
    const smuggled: Expression = JSON.parse('{"kind":"pow","left":1,"right":2}');
    expect(() => visitExpression(smuggled, NAMING, undefined)).toThrow(TypeError);
  });

  it.each(KINDS)('passes the context through %s untouched', (kind) => {
    const context = { marker: Symbol('context') };
    const echo = uniform<unknown, typeof context>((_expression, given) => given);
    expect(visitExpression(SAMPLES[kind], echo, context)).toBe(context);
  });
});
