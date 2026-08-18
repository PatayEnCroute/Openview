import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import {
  BlockNodeSchema,
  type DocumentNode,
  DocumentNodeSchema,
  type TableBodyNode,
  type TableBodyNodeSchema,
  type TableCell,
  type TableCellSchema,
  type TableColumn,
  type TableColumnSchema,
  type TableNode,
  type TableNodeSchema,
  type TableRowGroupNode,
  type TableRowGroupNodeSchema,
  type TableRowNode,
  type TableRowNodeSchema,
  TextNodeSchema,
  type TextSegment,
  type TextSegmentSchema,
} from '../nodes.js';
import { type MutuallyAssignable, RECIPE_TABLE } from './fixtures.js';

/**
 * The segment schema and the hand-written union, checked in BOTH directions.
 *
 * `z.ZodType` is covariant in its output, so neither `DocumentNodeSchema`'s explicit
 * binding nor the `const segments: readonly TextSegment[]` assignment further down can
 * catch a schema that drifted -- both accept one producing LESS than `TextSegment`. The
 * annotation here does: `MutuallyAssignable` collapses to `false`, and `false` does not
 * assign to `true`.
 *
 * A `const` and not an `it`, because there is nothing to run. It used to be an `it` ending
 * in `expect(inStep).toBe(true)`, an assertion that cannot fail -- worse than no assertion,
 * because it made the suite look like it checked something at runtime. The guard is the
 * ANNOTATION, and `pnpm run type-check` is what runs it: `tsconfig.typecheck.json` covers
 * test files. Exported so it is not reported unused; nothing imports it, and the runner
 * ignores a test module's exports.
 */
export const SEGMENT_SCHEMA_IN_STEP: MutuallyAssignable<
  z.infer<typeof TextSegmentSchema>,
  TextSegment
> = true;

/**
 * The column schema and the hand-written record, checked in BOTH directions.
 *
 * The exact twin of {@link SEGMENT_SCHEMA_IN_STEP}, with the same covariance argument, and
 * NOT tautological the way the same assertion posed on `DocumentNodeSchema` would be:
 * `TableColumnSchema` carries no `z.ZodType<TableColumn>` annotation, so its inference is
 * what is being compared rather than an annotation compared with itself.
 *
 * Dropping `align` from the schema is caught here and in four other places besides -- a
 * `TS6133` on the now-unused import of `TABLE_COLUMN_ALIGNMENTS`, two `TS2375` on the
 * `z.ZodType` annotations, and a `TS2345` on the argument passed to `.superRefine` -- all
 * four at gate 2. This one is at gate 3, and it is the only one that also catches the
 * REVERSE drift: a field added to the schema and forgotten in the interface.
 */
export const TABLE_COLUMN_SCHEMA_IN_STEP: MutuallyAssignable<
  z.infer<typeof TableColumnSchema>,
  TableColumn
> = true;

/**
 * The two members `checkTableWiring` discriminates by hand, held to the union.
 *
 * The narrowing at that site does NOT hold it: measured, a third member carrying
 * `rows: readonly TableRowNode[]` compiles there and is absorbed by the `else`. This
 * annotation collapses to `false` on any third member at all, and `false` does not assign to
 * `true`. A defensive `else` in the schema would buy the same guarantee at the price of a branch
 * no input can reach -- `invalid_union` on a body entry is abandoning, so the refinement never
 * runs -- and of a `throw` that escapes `safeParse`.
 */
export const TABLE_BODY_MEMBERS_IN_STEP: MutuallyAssignable<
  TableBodyNode['type'],
  'tableRow' | 'tableRowGroup'
> = true;

/**
 * The body SCHEMA held to the body TYPE, and it is not the same guard as the one above.
 *
 * `TABLE_BODY_MEMBERS_IN_STEP` constrains the hand-written union. It says nothing about
 * `rowMembers()`, and measured: reducing that factory to `[TableRowNodeSchema]` compiles at
 * exit 0 under both tsconfigs -- `TableBodyNodeSchema` narrows, `DocumentNodeSchema` absorbs
 * the loss by covariance, and `checkTableWiring` stays assignable to `.superRefine` because a
 * `tableRow`-only array still satisfies `readonly TableBodyNode[]`. `tableRowGroup` would
 * simply stop being parseable in a table body, and every stored document carrying a repeated
 * section would answer `invalid_union`.
 *
 * Compared on the DISCRIMINANT rather than the whole node, because that is the part a lost
 * factory member removes, and comparing whole recursive unions drags `z.lazy` inference in.
 */
export const TABLE_BODY_SCHEMA_IN_STEP: MutuallyAssignable<
  z.infer<typeof TableBodyNodeSchema>['type'],
  TableBodyNode['type']
> = true;

/**
 * The four remaining new pairs, held KEY BY KEY.
 *
 * `MutuallyAssignable` on the objects themselves is not enough, and measured: under
 * `exactOptionalPropertyTypes`, `{ columnId, children }` and
 * `{ columnId, children, rowSpan?: number | undefined }` are mutually assignable, so an
 * OPTIONAL field added to one side only -- precisely the shape a backward-compatible new field
 * takes -- slips through. A field present in the TYPE and absent from the SCHEMA is worse than
 * a compile error: `parseTemplate` strips it at runtime (measured), so an editor writes it, the
 * next open erases it, `onSave` persists the loss, and `schemaVersion` never moves. That is the
 * *perte silencieuse* AGENTS.md 1.2 exists to prevent.
 *
 * `keyof` includes optional keys, so comparing key sets catches both directions for required
 * and optional fields alike. `TableCell` is first because it is the likeliest site: a per-cell
 * alignment override is lot C5's declared future.
 */
export const TABLE_CELL_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableCellSchema>,
  keyof TableCell
> = true;

export const TABLE_ROW_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableRowNodeSchema>,
  keyof TableRowNode
> = true;

export const TABLE_ROW_GROUP_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableRowGroupNodeSchema>,
  keyof TableRowGroupNode
> = true;

export const TABLE_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableNodeSchema>,
  keyof TableNode
> = true;

/** The same key-set guard on the column, beside the assignability one it strengthens. */
export const TABLE_COLUMN_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableColumnSchema>,
  keyof TableColumn
> = true;

describe('DocumentNodeSchema', () => {
  it('accepts a table through the block union, and a row only through its table', () => {
    expect(BlockNodeSchema.safeParse(RECIPE_TABLE).success).toBe(true);
    expect(DocumentNodeSchema.safeParse(RECIPE_TABLE).success).toBe(true);
    expect(BlockNodeSchema.safeParse({ type: 'tableRow', id: 'r', cells: [] }).success).toBe(false);
    expect(DocumentNodeSchema.safeParse({ type: 'tableRow', id: 'r', cells: [] }).success).toBe(
      true,
    );
  });

  it('parses a tree nested several levels deep', () => {
    const raw = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'title', content: [{ kind: 'literal', text: 'Invoice' }] },
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
              children: [
                {
                  type: 'text',
                  id: 'label',
                  content: [{ kind: 'literal', text: 'Discount applied' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const parsed: DocumentNode = DocumentNodeSchema.parse(raw);

    expect(parsed.type).toBe('container');
    // Recursion has to survive three levels, which is where a broken z.lazy
    // binding would silently degrade to `unknown`.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(raw);
  });

  it('parses a paragraph mixing fixed text and a binding', () => {
    const parsed = TextNodeSchema.parse({
      type: 'text',
      id: 't1',
      content: [
        { kind: 'literal', text: 'Total due: ' },
        { kind: 'binding', value: { kind: 'path', path: 'invoice.total' } },
      ],
    });

    const segments: readonly TextSegment[] = parsed.content;

    expect(segments).toHaveLength(2);
    expect(segments[1]?.kind).toBe('binding');
  });

  it('rejects a predicate expression in a print position', () => {
    // `isEmpty` yields a boolean, so accepting it here would let a template print
    // `true` into an invoice. The sibling positions enforce their result kind at
    // evaluation; this one enforces it at save time.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [
          { kind: 'binding', value: { kind: 'isEmpty', operand: { kind: 'path', path: 'a' } } },
        ],
      }),
    ).toThrow();
  });

  it('rejects a list-valued expression in a print position', () => {
    // The companion of the test above, for the sub-algebra ADR 0003 added: `filter` yields a
    // LIST, and a binding that accepted it would print `[object Object],[object Object]`.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [
          {
            kind: 'binding',
            value: {
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
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts a computed amount in a print position', () => {
    // The widening ADR 0003 made: a binding carries the whole printable sub-algebra now, so
    // a line amount can be calculated rather than supplied.
    const parsed = DocumentNodeSchema.parse({
      type: 'text',
      id: 't',
      content: [
        {
          kind: 'binding',
          value: {
            kind: 'aggregate',
            op: 'sum',
            source: { kind: 'path', path: 'invoice.lines' },
            as: 'line',
            value: {
              kind: 'arithmetic',
              op: 'mul',
              left: { kind: 'path', path: 'line.quantity' },
              right: { kind: 'path', path: 'line.unitPrice' },
            },
          },
        },
      ],
    });

    expect(parsed.type).toBe('text');
  });

  it('accepts a filter as a loop source, with the node unchanged', () => {
    // `LoopNode.each` was already typed `Expression`, so composition needed no migration.
    const parsed = DocumentNodeSchema.parse({
      type: 'loop',
      id: 'l1',
      each: {
        kind: 'filter',
        source: { kind: 'path', path: 'invoice.lines' },
        as: 'line',
        where: { kind: 'isEmpty', operand: { kind: 'path', path: 'line.cancelledAt' } },
      },
      as: 'line',
      children: [],
    });

    expect(parsed.type).toBe('loop');
  });

  it('accepts an empty paragraph', () => {
    expect(TextNodeSchema.parse({ type: 'text', id: 't', content: [] }).content).toStrictEqual([]);
  });

  it('rejects a text node whose content is still a bare string', () => {
    // The pre-ADR-0002 shape. Worth pinning: it must fail loudly rather than
    // parse into something that renders empty.
    expect(() => DocumentNodeSchema.parse({ type: 'text', id: 't', content: 'Invoice' })).toThrow();
  });

  it('rejects a segment kind it does not know', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [{ kind: 'html', text: '<b>x</b>' }],
      }),
    ).toThrow();
  });

  it('accepts a page marker anywhere a text segment is legal, `root` included', () => {
    // Deliberately NOT confined to a page band. Restricting it would mean knowing a
    // segment's ANCESTORS, which no local Zod schema can do -- it would take a
    // template-wide walk at save time and would be this contract's first positional rule.
    // Printing "page 3" inside the flow is legitimate; the engine substitutes the number of
    // the page the segment lands on.
    const parsed = TextNodeSchema.parse({
      type: 'text',
      id: 'ftr',
      content: [
        { kind: 'literal', text: 'Page ' },
        { kind: 'pageField', field: 'number' },
        { kind: 'literal', text: ' / ' },
        { kind: 'pageField', field: 'count' },
      ],
    });

    expect(parsed.content.map((segment) => segment.kind)).toStrictEqual([
      'literal',
      'pageField',
      'literal',
      'pageField',
    ]);
  });

  it('rejects a page field the paginator could not answer', () => {
    const unknownField = TextNodeSchema.safeParse({
      type: 'text',
      id: 't',
      content: [{ kind: 'pageField', field: 'total' }],
    });
    // An ABSENT field yields the SAME message: `z.enum` treats `undefined` as an unknown
    // option, so an author who forgot the key reads "expected one of ..." rather than
    // "required". Exact, and misleading -- recorded for lot C8, not corrected here.
    const absentField = TextNodeSchema.safeParse({
      type: 'text',
      id: 't',
      content: [{ kind: 'pageField' }],
    });

    expect(unknownField.success).toBe(false);
    if (!unknownField.success) {
      expect(unknownField.error.issues[0]?.path).toStrictEqual(['content', 0, 'field']);
      expect(unknownField.error.issues[0]?.message).toBe(
        'Invalid option: expected one of "number"|"count"',
      );
    }
    expect(absentField.success).toBe(false);
    if (!absentField.success) {
      expect(absentField.error.issues[0]?.message).toBe(
        'Invalid option: expected one of "number"|"count"',
      );
    }
  });

  it('rejects a binding carrying a malformed expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [{ kind: 'binding', value: { kind: 'path', path: '1nope' } }],
      }),
    ).toThrow();
  });

  it('accepts an image without an alt attribute', () => {
    const parsed = DocumentNodeSchema.parse({ type: 'image', id: 'logo', src: 'logo.png' });
    expect(parsed).toStrictEqual({ type: 'image', id: 'logo', src: 'logo.png' });
  });

  it('rejects an unknown node type', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'barcode', id: 'b1' })).toThrow();
  });

  it('rejects an empty node id', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'text', id: '', content: [] })).toThrow();
  });

  it('rejects a loop whose source is not a valid expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: 'invoice.lines',
        as: 'line',
        children: [],
      }),
    ).toThrow();
  });

  it('rejects a loop that declares no alias', () => {
    // Without one, children have no name for the current item -- the state this
    // package was in before ADR 0002.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: { kind: 'path', path: 'items' },
        children: [],
      }),
    ).toThrow();
  });

  it.each([
    '',
    'line.total',
    'my line',
    '1st',
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'hasOwnProperty',
  ])('rejects %o as a loop alias', (alias) => {
    // The alias becomes a key of the evaluation scope, so it obeys exactly the
    // rule a path obeys -- every member of Object.prototype included, because
    // `as: 'toString'` would install data over a method and make String(scope)
    // throw.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: { kind: 'path', path: 'items' },
        as: alias,
        children: [],
      }),
    ).toThrow();
  });

  it('rejects a condition carrying a malformed expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'condition',
        id: 'c1',
        when: { kind: 'compare', op: 'gt', left: { kind: 'path', path: 'a' } },
        children: [],
      }),
    ).toThrow();
  });

  it('rejects an invalid node nested inside a valid parent', () => {
    // The failure that matters: a malformed leaf must not be waved through
    // because its container looks fine.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'container',
        id: 'root',
        children: [
          { type: 'text', id: 'ok', content: [{ kind: 'literal', text: 'fine' }] },
          { type: 'text', id: 'broken' },
        ],
      }),
    ).toThrow();
  });
});
