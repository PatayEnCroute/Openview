import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import {
  type AggregateExpressionSchema,
  type ArithmeticExpressionSchema,
  type CompareExpressionSchema,
  type ConcatExpressionSchema,
  type ConditionalExpressionSchema,
  type CountExpressionSchema,
  type DateAddExpressionSchema,
  type DateDiffExpressionSchema,
  type EndOfMonthExpressionSchema,
  type Expression,
  type ExpressionKind,
  ExpressionSchema,
  type FilterExpressionSchema,
  type IsEmptyExpressionSchema,
  isIdentifier,
  type LiteralExpressionSchema,
  type LogicalExpressionSchema,
  type NotExpressionSchema,
  type PathExpressionSchema,
  type PercentOfExpressionSchema,
  type PrintableExpression,
  PrintableExpressionSchema,
  type TextCaseExpressionSchema,
  type TextExpressionSchema,
} from '../expression.js';

/** True only when each type accepts the other; `false` otherwise, which fails to assign. */
type MutuallyAssignable<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;

/**
 * The members of the union body, enumerated one by one.
 *
 * `z.infer<typeof ExpressionSchema>` would be a tautology here: it returns the
 * `z.ZodType<Expression>` ANNOTATION, not what the `z.lazy` body actually builds. Only
 * naming each member schema reaches the body.
 *
 * The schemas are imported type-only because they appear nowhere but inside
 * `z.infer<typeof X>`; `useImportType` is an error in this repo, and `z.infer` works
 * perfectly well on a type-only import.
 */
type EnumeratedMembers =
  | z.infer<typeof LiteralExpressionSchema>
  | z.infer<typeof PathExpressionSchema>
  | z.infer<typeof ArithmeticExpressionSchema>
  | z.infer<typeof PercentOfExpressionSchema>
  | z.infer<typeof AggregateExpressionSchema>
  | z.infer<typeof CountExpressionSchema>
  | z.infer<typeof ConditionalExpressionSchema>
  | z.infer<typeof ConcatExpressionSchema>
  | z.infer<typeof TextExpressionSchema>
  | z.infer<typeof TextCaseExpressionSchema>
  | z.infer<typeof DateAddExpressionSchema>
  | z.infer<typeof DateDiffExpressionSchema>
  | z.infer<typeof EndOfMonthExpressionSchema>
  | z.infer<typeof CompareExpressionSchema>
  | z.infer<typeof LogicalExpressionSchema>
  | z.infer<typeof NotExpressionSchema>
  | z.infer<typeof IsEmptyExpressionSchema>
  | z.infer<typeof FilterExpressionSchema>;

/**
 * One sample per kind, in a MAPPED type rather than a `Record<ExpressionKind, Expression>`.
 *
 * The difference is the whole guard: under a plain `Record`, an entry like
 * `{ isEmpty: { kind: 'literal', value: 1 } }` compiles without a word, so the check
 * would go decorative for exactly the kind it was meant to protect. Mapped, each key is
 * pinned to `Extract<Expression, { kind: K }>`.
 */
const SAMPLES: { readonly [K in ExpressionKind]: Extract<Expression, { kind: K }> } = {
  literal: { kind: 'literal', value: 1 },
  path: { kind: 'path', path: 'invoice.total' },
  arithmetic: {
    kind: 'arithmetic',
    op: 'add',
    left: { kind: 'path', path: 'invoice.total' },
    right: { kind: 'literal', value: 1 },
  },
  percentOf: {
    kind: 'percentOf',
    base: { kind: 'path', path: 'invoice.total' },
    rate: { kind: 'literal', value: 20 },
  },
  aggregate: {
    kind: 'aggregate',
    op: 'sum',
    source: { kind: 'path', path: 'invoice.lines' },
    as: 'line',
    value: { kind: 'path', path: 'line.total' },
  },
  count: { kind: 'count', source: { kind: 'path', path: 'invoice.lines' } },
  filter: {
    kind: 'filter',
    source: { kind: 'path', path: 'invoice.lines' },
    as: 'line',
    where: {
      kind: 'compare',
      op: 'gt',
      left: { kind: 'path', path: 'line.discount' },
      right: { kind: 'literal', value: 0 },
    },
  },
  if: {
    kind: 'if',
    when: { kind: 'isEmpty', operand: { kind: 'path', path: 'invoice.discount' } },
    whenTrue: { kind: 'literal', value: 0 },
    whenFalse: { kind: 'path', path: 'invoice.discount' },
  },
  concat: {
    kind: 'concat',
    parts: [
      { kind: 'literal', value: 'N° ' },
      { kind: 'text', value: { kind: 'path', path: 'invoice.number' } },
    ],
  },
  text: { kind: 'text', value: { kind: 'path', path: 'invoice.number' } },
  textCase: { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'invoice.label' } },
  dateAdd: {
    kind: 'dateAdd',
    date: { kind: 'path', path: 'invoice.issuedOn' },
    days: { kind: 'literal', value: 30 },
  },
  dateDiff: {
    kind: 'dateDiff',
    from: { kind: 'path', path: 'invoice.dueOn' },
    to: { kind: 'path', path: 'company.processedOn' },
  },
  endOfMonth: { kind: 'endOfMonth', date: { kind: 'path', path: 'invoice.issuedOn' } },
  compare: {
    kind: 'compare',
    op: 'gt',
    left: { kind: 'path', path: 'invoice.total' },
    right: { kind: 'literal', value: 0 },
  },
  logical: { kind: 'logical', op: 'and', operands: [{ kind: 'literal', value: true }] },
  not: { kind: 'not', operand: { kind: 'literal', value: false } },
  isEmpty: { kind: 'isEmpty', operand: { kind: 'path', path: 'invoice.notes' } },
};

/**
 * Exactly the kinds of the printable sub-algebra, as something a test can iterate.
 *
 * Mapped over `PrintableExpression['kind']`, so moving a kind in or out of the
 * sub-algebra fails to compile here until this record is updated -- which is the point:
 * the record IS the assertion about which kinds a text binding accepts.
 */
const PRINTABLE_KINDS: { readonly [K in PrintableExpression['kind']]: true } = {
  literal: true,
  path: true,
  arithmetic: true,
  percentOf: true,
  aggregate: true,
  count: true,
  if: true,
  concat: true,
  text: true,
  textCase: true,
  dateAdd: true,
  dateDiff: true,
  endOfMonth: true,
};

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

  it.each([
    '__proto__',
    'constructor',
    'prototype',
    'invoice.constructor',
    'toString',
    'invoice.hasOwnProperty',
    'invoice.valueOf',
  ])('refuses the inherited-member path %o at save time', (path) => {
    // `resolvePath` reads own enumerable properties only, so none of these could
    // resolve to anything anyway. They are refused here because a path naming an
    // inherited member is a template bug, and saying so when the template is
    // saved beats resolving to nothing when a document renders.
    expect(() => ExpressionSchema.parse({ kind: 'path', path })).toThrow();
  });

  it('accepts a legitimate deep path', () => {
    expect(ExpressionSchema.parse({ kind: 'path', path: 'invoice.customer.address.city' })).toEqual(
      {
        kind: 'path',
        path: 'invoice.customer.address.city',
      },
    );
  });

  it('refuses a path longer than 256 characters', () => {
    // A narrowing, and a measured one: a 591-character path parsed before ADR 0003.
    // `resolvePath` re-splits a path on every read, and aggregations turn that count
    // from O(1) into O(n).
    const long = `a.${'b'.repeat(255)}`;
    expect(long).toHaveLength(257);
    expect(() => ExpressionSchema.parse({ kind: 'path', path: long })).toThrow(
      /may not exceed 256/,
    );
    expect(ExpressionSchema.parse({ kind: 'path', path: long.slice(0, 256) })).toHaveProperty(
      'kind',
      'path',
    );
  });
});

describe('the texts-and-dates schemas', () => {
  it('refuses a concat with fewer than two parts', () => {
    // One part is the part itself, and zero is nothing.
    expect(() =>
      ExpressionSchema.parse({ kind: 'concat', parts: [{ kind: 'literal', value: 'x' }] }),
    ).toThrow(/at least two parts/);
    expect(() => ExpressionSchema.parse({ kind: 'concat', parts: [] })).toThrow();
  });

  it.each([
    ['2026-02-30'],
    ['2025-02-29'],
    ['2026-13-01'],
    ['2026-1-5'],
    ['31/01/2026'],
    ['0000-01-01'],
  ])('refuses the literal date %o AT SAVE TIME', (value) => {
    // The doctrine this repo already applies to a path: "a malformed path fails when the
    // template is saved instead of when a document renders". That a `path` cannot be checked
    // at save time says nothing about a `literal`, so the refinement speaks about a literal
    // string and stays silent about everything else.
    expect(() =>
      ExpressionSchema.parse({
        kind: 'dateAdd',
        date: { kind: 'literal', value },
        days: { kind: 'literal', value: 30 },
      }),
    ).toThrow();
  });

  it('says nothing about a date it cannot check at save time', () => {
    // A path, and a non-string literal: neither can be validated before a render, so the
    // refinement must not pretend otherwise.
    expect(() =>
      ExpressionSchema.parse({
        kind: 'dateAdd',
        date: { kind: 'path', path: 'invoice.issuedOn' },
        days: { kind: 'literal', value: 30 },
      }),
    ).not.toThrow();
    expect(() =>
      ExpressionSchema.parse({
        kind: 'endOfMonth',
        date: { kind: 'literal', value: 20_260_131 },
      }),
    ).not.toThrow();
  });

  it.each([['30'], [1.5], [true]])('refuses the literal day count %o AT SAVE TIME', (days) => {
    // The sibling of the date refinement, and it was missing: a literal `'30'` or `1.5` in a
    // `days` position parsed cleanly and failed only when a document rendered. The argument
    // for checking a literal date applies word for word to a literal day count.
    expect(() =>
      ExpressionSchema.parse({
        kind: 'dateAdd',
        date: { kind: 'literal', value: '2026-01-01' },
        days: { kind: 'literal', value: days },
      }),
    ).toThrow();
  });

  it('says nothing about a day count it cannot check at save time', () => {
    // A path is unverifiable before a render, and so is a computed shift; only a literal is
    // checkable. `null` passes too, because absence propagates rather than failing.
    for (const days of [
      { kind: 'path', path: 'commande.delaiPaiement' },
      {
        kind: 'arithmetic',
        op: 'add',
        left: { kind: 'literal', value: 15 },
        right: { kind: 'literal', value: 15 },
      },
      { kind: 'literal', value: null },
      { kind: 'literal', value: 30 },
    ]) {
      expect(() =>
        ExpressionSchema.parse({
          kind: 'dateAdd',
          date: { kind: 'literal', value: '2026-01-01' },
          days,
        }),
      ).not.toThrow();
    }
  });

  it('stops at its own level, and that boundary is worth writing down', () => {
    // Both refinements inspect only the operand AT THEIR OWN LEVEL, so a bad literal tucked
    // inside a conditional still reaches the evaluator. Save-time validation buys the literal
    // in the position itself and nothing further.
    expect(() =>
      ExpressionSchema.parse({
        kind: 'endOfMonth',
        date: {
          kind: 'if',
          when: { kind: 'literal', value: true },
          whenTrue: { kind: 'literal', value: '2026-02-30' },
          whenFalse: { kind: 'literal', value: '2026-02-28' },
        },
      }),
    ).not.toThrow();
  });

  it('checks both date operands of a dateDiff', () => {
    expect(() =>
      ExpressionSchema.parse({
        kind: 'dateDiff',
        from: { kind: 'literal', value: '2026-01-01' },
        to: { kind: 'literal', value: '2026-02-31' },
      }),
    ).toThrow();
    expect(() =>
      ExpressionSchema.parse({
        kind: 'dateDiff',
        from: { kind: 'literal', value: '2026-01-01' },
        to: { kind: 'literal', value: '2026-03-01' },
      }),
    ).not.toThrow();
  });

  it('refuses an unknown case operator', () => {
    expect(() =>
      ExpressionSchema.parse({
        kind: 'textCase',
        op: 'title',
        text: { kind: 'literal', value: 'x' },
      }),
    ).toThrow();
  });
});

describe('the union body and the hand-written types', () => {
  it('keeps the enumerated members and the union in step', () => {
    // Compile-time assertions wearing a runtime expectation, and the only guard that
    // works here: `z.ZodType` is covariant in its output, so a `z.lazy` body missing a
    // member stays assignable to its annotation and compiles silently.
    //
    // Only the KINDS get mutual assignability. Mutual assignability on the members
    // themselves does not compile: Zod infers `operands: Expression[]` (mutable)
    // against `readonly Expression[]`, so the failure would report array variance
    // rather than a missing member.
    const membersFit: EnumeratedMembers extends Expression ? true : false = true;
    const kindsInStep: MutuallyAssignable<EnumeratedMembers['kind'], ExpressionKind> = true;

    expect([membersFit, kindsInStep]).toStrictEqual([true, true]);
  });

  it.each(Object.entries(SAMPLES))(
    'parses the %s sample through the union body',
    (_kind, sample) => {
      // THE guard that covers the runtime. Removing a member from the `z.lazy` body leaves
      // `tsc` and Biome silent; this is what turns that into a red test.
      expect(ExpressionSchema.parse(sample)).toStrictEqual(sample);
    },
  );
});

describe('PrintableExpressionSchema', () => {
  it.each(Object.entries(SAMPLES))('decides the %s sample by its value kind', (kind, sample) => {
    // The partition, checked in both directions from one sample table: a printable kind
    // must parse here, and a predicate kind must not. A binding that accepted `isEmpty`
    // would let a template print `true` into an invoice.
    if (kind in PRINTABLE_KINDS) {
      expect(PrintableExpressionSchema.parse(sample)).toStrictEqual(sample);
    } else {
      expect(() => PrintableExpressionSchema.parse(sample)).toThrow();
    }
  });

  it('accepts a boolean literal, because it always did', () => {
    // The claim to state carefully: a print position refuses the OPERATORS that yield a
    // boolean, and has never forbidden a boolean literal. Saying otherwise would need
    // `boolean` removed from LiteralValue, which is a narrowing of the stored contract.
    expect(PrintableExpressionSchema.parse({ kind: 'literal', value: true })).toStrictEqual({
      kind: 'literal',
      value: true,
    });
  });
});

describe('isIdentifier', () => {
  it.each(['line', 'l', '_row', '$item', 'item2', 'aB_$9'])('accepts %o', (value) => {
    expect(isIdentifier(value)).toBe(true);
  });

  it.each(['', 'line.total', 'my line', '1st', 'a-b', 'é'])('refuses %o', (value) => {
    expect(isIdentifier(value)).toBe(false);
  });

  it.each(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty'])(
    'refuses the inherited-member name %o',
    (value) => {
      // The set is derived from Object.prototype rather than listed, so it cannot
      // fall behind. A name a template may declare has to be a name a path is
      // allowed to read back -- and a loop alias named `toString` would shadow a
      // method every JavaScript consumer assumes exists.
      expect(isIdentifier(value)).toBe(false);
    },
  );
});
