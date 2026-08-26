import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import { PAGE_FIELD_NAME_MESSAGE } from '../../validation-messages.js';
import {
  BlockNodeSchema,
  type ConditionNode,
  ConditionNodeSchema,
  type ContainerNode,
  ContainerNodeSchema,
  type DocumentNode,
  DocumentNodeSchema,
  type DocumentNodeType,
  GridNodeSchema,
  type ImageNode,
  ImageNodeSchema,
  type LoopNode,
  LoopNodeSchema,
  type TableBodyNode,
  type TableBodyNodeSchema,
  type TableCell,
  type TableCellSchema,
  type TableColumn,
  type TableColumnSchema,
  type TableNode,
  TableNodeSchema,
  type TableRowGroupNode,
  TableRowGroupNodeSchema,
  type TableRowNode,
  TableRowNodeSchema,
  type TextBindingSegment,
  type TextBindingSegmentSchema,
  type TextLiteralSegment,
  type TextLiteralSegmentSchema,
  type TextNode,
  TextNodeSchema,
  type TextPageFieldSegment,
  type TextPageFieldSegmentSchema,
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
 * and optional fields alike.
 *
 * `TableCell` was said here to be the likeliest site, "a per-cell alignment override is lot C5's
 * declared future". IT WAS NOT A DECLARED FUTURE: ADR 0005 wrote "s'IL la décide", a conditional
 * reservation this comment hardened into a promise. Lot C5 delivered the override on the BLOCK IN
 * THE CELL instead -- a cell is not a node, it has no `id`, and an editor Command cannot address
 * it. THE PAIR STAYS, and it earned its place: it is one of the six sites that DID redden when a
 * field was added to a schema alone, and it is what a future field on `TableCell` will meet.
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

/**
 * ## The eight pairs lot C5 owed this file BEFORE it wrote one style field
 *
 * The five pairs above and the four in `page/__tests__/page.test.ts` cover exactly the six
 * sites a style could attach to that the type gate WAS watching. MEASURED, one mutation per
 * site on a copy of `core/src`, an OPTIONAL field added to the schema alone: of the fifteen
 * sites in this package, NINE compiled at exit 0 with no assertion refusing -- the three
 * segment kinds, `TextNode`, `ImageNode`, `ContainerNode`, `LoopNode`, `ConditionNode`, and
 * `Template`. Which is to say: the eight sites lot C5 attaches a style to were precisely the
 * eight nobody watched.
 *
 * And nothing else catches it. MEASURED on the same copy with four schemas deliberately
 * diverging from their types: every test PASSES. A field absent from the schema is not an
 * uncovered branch, it is a branch that does not exist, so the 90 % threshold sees nothing
 * either.
 *
 * The reason the objects themselves are not compared is the one the block above already
 * gives: under `exactOptionalPropertyTypes` an optional field added to ONE side leaves the
 * two types mutually assignable, and an optional field is precisely the shape a
 * backward-compatible new field takes. `keyof` compares KEY SETS, so it catches both
 * directions.
 *
 * The last two are CONTRE-ÉPREUVES OF THE CUT, not preparation for a field: `loop` and
 * `condition` carry NO style, deliberately -- they produce N sequences or nothing, so a box
 * on them has no subject. Their pairs redden the day someone adds a field to one side only,
 * which is how a cut stays a cut rather than becoming a habit.
 */
export const TEXT_LITERAL_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextLiteralSegmentSchema>,
  keyof TextLiteralSegment
> = true;

export const TEXT_BINDING_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextBindingSegmentSchema>,
  keyof TextBindingSegment
> = true;

export const TEXT_PAGE_FIELD_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextPageFieldSegmentSchema>,
  keyof TextPageFieldSegment
> = true;

export const TEXT_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextNodeSchema>,
  keyof TextNode
> = true;

export const IMAGE_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ImageNodeSchema>,
  keyof ImageNode
> = true;

export const CONTAINER_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ContainerNodeSchema>,
  keyof ContainerNode
> = true;

export const LOOP_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof LoopNodeSchema>,
  keyof LoopNode
> = true;

export const CONDITION_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ConditionNodeSchema>,
  keyof ConditionNode
> = true;

/**
 * The TYPE of the fragmentation mark, which the eight key-set pairs above cannot see.
 *
 * They compare key SETS, so widening the interface to `boolean` while the schema still accepts
 * only `true` leaves all eight green -- and a `false` an editor writes would then be stripped at
 * the next parse. One pair suffices: the eight interfaces inherit the field from `NodeBase` and
 * the eight schemas share one `keepTogetherField`. The key-set pairs stay necessary to prove each
 * of the eight schemas actually spells the field out.
 */
export const KEEP_TOGETHER_TYPE_IN_STEP: MutuallyAssignable<
  z.infer<typeof TextNodeSchema>['keepTogether'],
  TextNode['keepTogether']
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
    // An ABSENT field yields the SAME message: an unwritten discriminator matches no member of
    // the union, so an author who forgot the key reads which markers exist rather than
    // "required". Exact, and misleading -- recorded for lot C8, not corrected here.
    const absentField = TextNodeSchema.safeParse({
      type: 'text',
      id: 't',
      content: [{ kind: 'pageField' }],
    });

    expect(unknownField.success).toBe(false);
    if (!unknownField.success) {
      expect(unknownField.error.issues[0]?.path).toStrictEqual(['content', 0, 'field']);
      expect(unknownField.error.issues[0]?.message).toBe(PAGE_FIELD_NAME_MESSAGE);
    }
    expect(absentField.success).toBe(false);
    if (!absentField.success) {
      expect(absentField.error.issues[0]?.message).toBe(PAGE_FIELD_NAME_MESSAGE);
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

  describe('image src schemes', () => {
    const accepted = [
      'logo.png',
      'assets/logo.png',
      '/assets/logo.png',
      'https://cdn.example.test/logo.png',
      'http://cdn.example.test/logo.png',
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/svg+xml;base64,PHN2Zy8+',
      'brand-kit:primary-logo',
    ];

    for (const src of accepted) {
      it(`accepts ${src}`, () => {
        expect(ImageNodeSchema.parse({ type: 'image', id: 'i', src }).src).toBe(src);
      });
    }

    const refused = [
      'javascript:fetch("https://attacker.test")',
      'JaVaScRiPt:alert(1)',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'file:///C:/Windows/win.ini',
      'data:text/html,<script>alert(1)</script>',
      'data:application/javascript,alert(1)',
      '  javascript:alert(1)',
      `java${String.fromCharCode(9)}script:alert(1)`,
      `java${String.fromCharCode(10)}script:alert(1)`,
    ];

    for (const src of refused) {
      it(`refuses ${JSON.stringify(src)}`, () => {
        expect(() => ImageNodeSchema.parse({ type: 'image', id: 'i', src })).toThrow();
      });
    }

    it('states no URL grammar beyond the scheme, so a long data URI stays valid', () => {
      const src = `data:image/png;base64,${'A'.repeat(5000)}`;
      expect(ImageNodeSchema.parse({ type: 'image', id: 'i', src }).src).toBe(src);
    });

    it('still refuses an empty src', () => {
      expect(() => ImageNodeSchema.parse({ type: 'image', id: 'i', src: '' })).toThrow();
    });
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

/**
 * The smallest valid raw node of each kind, carrying the mark.
 *
 * A `Record` over `DocumentNodeType` rather than an array, so a ninth kind added to the union does
 * not compile until it is listed here -- `TS2741`, the idiom `page/__tests__/page.test.ts` uses for
 * band occurrences. Raw and untyped on purpose: these go through a parse.
 */
const MARKED_NODES: Readonly<Record<DocumentNodeType, unknown>> = {
  text: { type: 'text', id: 'n', keepTogether: true, content: [] },
  image: { type: 'image', id: 'n', keepTogether: true, src: 'logo.png' },
  container: { type: 'container', id: 'n', keepTogether: true, children: [] },
  loop: {
    type: 'loop',
    id: 'n',
    keepTogether: true,
    each: { kind: 'path', path: 'facture.lignes' },
    as: 'ligne',
    children: [],
  },
  condition: {
    type: 'condition',
    id: 'n',
    keepTogether: true,
    when: { kind: 'isEmpty', operand: { kind: 'path', path: 'facture.mentions' } },
    children: [],
  },
  table: {
    type: 'table',
    id: 'n',
    keepTogether: true,
    columns: [{ id: 'montant', width: 1, align: 'end' }],
    header: [],
    body: [],
    footer: [],
  },
  grid: {
    type: 'grid',
    id: 'n',
    keepTogether: true,
    columns: 12,
    rows: 8,
    step: 4,
    items: [{ row: 1, column: 1, content: { type: 'container', id: 'z', children: [] } }],
  },
  tableRow: { type: 'tableRow', id: 'n', keepTogether: true, cells: [] },
  tableRowGroup: {
    type: 'tableRowGroup',
    id: 'n',
    keepTogether: true,
    each: { kind: 'path', path: 'facture.lignes' },
    as: 'ligne',
    rows: [{ type: 'tableRow', id: 'r', cells: [] }],
  },
};

/**
 * Each kind through its OWN public schema, which the union cannot stand in for.
 *
 * `DocumentNodeSchema` would still accept a node whose own exported schema had lost the field: it
 * discriminates on `type`, and the other seven members keep theirs. Same `Record` guarantee as
 * above; parse functions rather than schemas, so no variance question arises.
 */
const PARSE_BY_KIND: Readonly<Record<DocumentNodeType, (raw: unknown) => DocumentNode>> = {
  text: (raw) => TextNodeSchema.parse(raw),
  image: (raw) => ImageNodeSchema.parse(raw),
  container: (raw) => ContainerNodeSchema.parse(raw),
  loop: (raw) => LoopNodeSchema.parse(raw),
  condition: (raw) => ConditionNodeSchema.parse(raw),
  table: (raw) => TableNodeSchema.parse(raw),
  grid: (raw) => GridNodeSchema.parse(raw),
  tableRow: (raw) => TableRowNodeSchema.parse(raw),
  tableRowGroup: (raw) => TableRowGroupNodeSchema.parse(raw),
};

const markedTable = MARKED_NODES.table as Record<string, unknown>;

describe('keepTogether', () => {
  it.each(Object.entries(MARKED_NODES))('is accepted and KEPT on a %s node', (kind, raw) => {
    // Kept, not merely accepted: `z.object` STRIPS a key it does not know, with no error, so
    // acceptance alone would also be the symptom of a schema that ignores the field.
    const throughItsOwnSchema = PARSE_BY_KIND[kind as DocumentNodeType](raw);
    const throughTheUnion = DocumentNodeSchema.parse(raw);

    expect(throughItsOwnSchema.keepTogether).toBe(true);
    expect(throughTheUnion.keepTogether).toBe(true);
    expect(JSON.parse(JSON.stringify(throughItsOwnSchema))).toStrictEqual(raw);
    expect(JSON.parse(JSON.stringify(throughTheUnion))).toStrictEqual(raw);
  });

  it('leaves the two row kinds out of the block flow, marked or not', () => {
    // The mark changes no membership: a row stays reachable only through its table.
    expect(BlockNodeSchema.safeParse(MARKED_NODES.tableRow).success).toBe(false);
    expect(BlockNodeSchema.safeParse(MARKED_NODES.tableRowGroup).success).toBe(false);
    expect(BlockNodeSchema.safeParse(MARKED_NODES.table).success).toBe(true);
  });

  it('stays valid under the table wiring check, and does not soften it', () => {
    // The table schema is the only one wrapped in a `.check()`, so it is the only place a new
    // field could interfere with a refinement rather than with the object.
    const row = (columnId: string): unknown => ({
      type: 'tableRow',
      id: 'l',
      keepTogether: true,
      cells: [{ columnId, children: [] }],
    });

    expect(TableNodeSchema.safeParse({ ...markedTable, body: [row('montant')] }).success).toBe(
      true,
    );
    expect(TableNodeSchema.safeParse({ ...markedTable, body: [row('absente')] }).success).toBe(
      false,
    );
  });

  it.each([
    ['false', false],
    ['null', null],
    ['the string "true"', 'true'],
    ['1', 1],
    ['an object', { value: true }],
  ])('refuses %s, on the path `keepTogether`', (_label, value) => {
    // `false` is the one that matters: a plain boolean would give one meaning TWO persisted
    // spellings -- key absent, and `false` -- and no reader could say which an author wrote.
    // Both schema families are covered, the plain object and the `.check()`-wrapped one.
    for (const refused of [
      TextNodeSchema.safeParse({ type: 'text', id: 't', content: [], keepTogether: value }),
      TableNodeSchema.safeParse({ ...markedTable, keepTogether: value }),
    ]) {
      expect(refused.success).toBe(false);
      if (!refused.success) {
        expect(refused.error.issues.map((issue) => issue.path)).toStrictEqual([['keepTogether']]);
      }
    }

    // And every kind, not only those two: a runtime-only relaxation on ONE schema -- a
    // `.catch(undefined)` -- keeps the inferred type, so neither the pairs above nor the union
    // annotation sees it, and the refused value would be silently rewritten to the absence.
    for (const [kind, raw] of Object.entries(MARKED_NODES)) {
      expect(() =>
        PARSE_BY_KIND[kind as DocumentNodeType]({ ...(raw as object), keepTogether: value }),
      ).toThrow(/keepTogether/);
    }
  });

  it('persists ABSENCE as absence, which is what every older document says', () => {
    const bare = { type: 'text', id: 't', content: [] };

    const parsed = TextNodeSchema.parse(bare);

    // On the parsed object, not on a round trip: `JSON.stringify` drops an undefined-valued key
    // whatever the schema did, so only the in-memory own key tells absence from presence.
    expect(parsed.keepTogether).toBeUndefined();
    expect(Object.hasOwn(parsed, 'keepTogether')).toBe(false);
  });

  it('persists an explicit `undefined` exactly like an absent key', () => {
    // The strict type admits `keepTogether: undefined`, and Zod KEEPS that key in memory -- but
    // `JSON.stringify` drops it, so the canonical persisted form stays the absence.
    const explicit = TextNodeSchema.parse({
      type: 'text',
      id: 't',
      content: [],
      keepTogether: undefined,
    });
    const absent = TextNodeSchema.parse({ type: 'text', id: 't', content: [] });

    // The in-memory shapes DIFFER, and asserting that is what gives the equality below its
    // meaning: the two spellings stay distinguishable until serialisation, and only the absence
    // costs nothing to `assertBoundedShape` and to an `onSave`.
    expect(Object.hasOwn(explicit, 'keepTogether')).toBe(true);
    expect(Object.hasOwn(absent, 'keepTogether')).toBe(false);
    expect(JSON.parse(JSON.stringify(explicit))).toStrictEqual(JSON.parse(JSON.stringify(absent)));
  });

  it('lets a stored model say which of two sibling blocks holds together', () => {
    // The recipe criterion of the lot. A consumer reads `true` on one and the absence on the
    // other, with no helper, no id registry, and no knowledge of what either block contains.
    const stored = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c7',
      name: 'Facture — les blocs insécables',
      version: '1.0.0',
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        header: [],
        footer: [],
      },
      root: {
        type: 'container',
        id: 'racine',
        children: [
          {
            type: 'container',
            id: 'details',
            children: [
              { type: 'text', id: 'ligne', content: [{ kind: 'literal', text: 'Ligne' }] },
            ],
          },
          {
            type: 'container',
            id: 'totaux',
            keepTogether: true,
            children: [
              { type: 'text', id: 'total', content: [{ kind: 'literal', text: 'Total' }] },
            ],
          },
        ],
      },
    };

    const parsed = parseTemplate(stored);
    const [details, totaux] = parsed.root.children;

    expect(details?.keepTogether).toBeUndefined();
    expect(totaux?.keepTogether).toBe(true);
    // Stored, not merely constructed: the round trip is what proves the mark survives a save.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(stored);
  });
});
