import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import { checkTemplateDataCompatibility } from '../../data-catalogue/compatibility.js';
import { DataCatalogueSchema } from '../../data-catalogue/schemas.js';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import {
  BlockNodeSchema,
  type BlockNodeType,
  type GridItem,
  GridItemSchema,
  type GridNode,
  GridNodeSchema,
  MAX_GRID_TRACKS,
  MIN_GRID_TRACKS,
} from '../nodes.js';
import { collectDataPaths, findNodeById, walk } from '../traverse.js';
import type { MutuallyAssignable } from './fixtures.js';

/**
 * The TypeScript contract and the Zod schema, checked key by key in both directions.
 *
 * Same idiom as `page.test.ts`: `z.ZodType` is covariant in its output, so a schema producing
 * LESS than the hand-written type would still assign. Comparing key sets catches a field
 * forgotten on either side, optional keys included.
 */
export const GRID_ITEM_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof GridItemSchema>,
  keyof GridItem
> = true;

export const GRID_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof GridNodeSchema>,
  keyof GridNode
> = true;

/** The block union names `grid`; a rename or a removal reddens this annotation, not a runtime. */
export const GRID_IS_A_BLOCK: MutuallyAssignable<Extract<BlockNodeType, 'grid'>, 'grid'> = true;

const zone = (
  row: number,
  column: number,
  spans: { rowSpan?: number; columnSpan?: number } = {},
  id = `z-${row}-${column}`,
): Record<string, unknown> => ({
  row,
  column,
  ...spans,
  content: { type: 'container', id, children: [] },
});

const grid = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'grid',
  id: 'g',
  columns: 12,
  rows: 8,
  step: 4,
  items: [],
  ...overrides,
});

describe('the local shape of a grid', () => {
  it('accepts the bounds of both axes and refuses one step past them', () => {
    expect(GridNodeSchema.safeParse(grid({ columns: MIN_GRID_TRACKS, rows: 1 })).success).toBe(
      true,
    );
    expect(
      GridNodeSchema.safeParse(grid({ columns: MAX_GRID_TRACKS, rows: MAX_GRID_TRACKS })).success,
    ).toBe(true);
    expect(GridNodeSchema.safeParse(grid({ columns: 0 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ rows: 0 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ columns: MAX_GRID_TRACKS + 1 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ rows: MAX_GRID_TRACKS + 1 })).success).toBe(false);
  });

  it('requires whole numbers for axes, coordinates and spans', () => {
    expect(GridNodeSchema.safeParse(grid({ columns: 2.5 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ rows: 2.5 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(1.5, 1)] })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(1, 1.5)] })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(1, 1, { rowSpan: 2.5 })] })).success).toBe(
      false,
    );
    expect(
      GridNodeSchema.safeParse(grid({ items: [zone(1, 1, { columnSpan: 2.5 })] })).success,
    ).toBe(false);
  });

  it('refuses a step that is zero, negative, infinite or taller than a sheet can be', () => {
    expect(GridNodeSchema.safeParse(grid({ step: 0 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ step: -1 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ step: Number.POSITIVE_INFINITY })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ step: Number.NaN })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ step: 5081 })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ step: 0.25 })).success).toBe(true);
  });

  it('starts coordinates at 1 and refuses 0', () => {
    expect(GridNodeSchema.safeParse(grid({ items: [zone(0, 1)] })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(1, 0)] })).success).toBe(false);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(1, 1)] })).success).toBe(true);
  });

  it('gives one persisted spelling to a span of one: absence', () => {
    expect(GridItemSchema.safeParse(zone(1, 1)).success).toBe(true);
    expect(GridItemSchema.safeParse(zone(1, 1, { rowSpan: 1 })).success).toBe(false);
    expect(GridItemSchema.safeParse(zone(1, 1, { columnSpan: 1 })).success).toBe(false);
    expect(GridItemSchema.safeParse(zone(1, 1, { rowSpan: 2, columnSpan: 2 })).success).toBe(true);
  });

  it('accepts an empty grid and empty zones: both are design states', () => {
    expect(GridNodeSchema.safeParse(grid()).success).toBe(true);
    expect(GridNodeSchema.safeParse(grid({ items: [zone(3, 3)] })).success).toBe(true);
  });

  it('round-trips a grid with box, spans and nested contents exactly', () => {
    const stored = grid({
      box: { background: '#f5f5f5', padding: { top: 1, right: 2, bottom: 1, left: 2 } },
      items: [
        {
          row: 1,
          column: 1,
          rowSpan: 2,
          columnSpan: 3,
          content: {
            type: 'container',
            id: 'z1',
            children: [
              {
                type: 'text',
                id: 't1',
                content: [{ kind: 'binding', value: { kind: 'path', path: 'client.name' } }],
              },
            ],
          },
        },
        zone(1, 4, { columnSpan: 5 }, 'z2'),
      ],
    });
    const parsed = GridNodeSchema.parse(stored);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(stored);
    expect(JSON.parse(JSON.stringify(BlockNodeSchema.parse(stored)))).toStrictEqual(stored);
  });
});

describe('the cross invariants of a grid', () => {
  it('accepts a zone that ends exactly on the last track of each axis', () => {
    expect(
      GridNodeSchema.safeParse(grid({ items: [zone(7, 10, { rowSpan: 2, columnSpan: 3 })] }))
        .success,
    ).toBe(true);
  });

  it('locates a zone that leaves the grid, on each side and through each span', () => {
    const failsAt = (items: unknown[], path: readonly (string | number)[]): void => {
      const result = GridNodeSchema.safeParse(grid({ items }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toContainEqual([...path]);
      }
    };
    failsAt([zone(9, 1)], ['items', 0, 'row']);
    failsAt([zone(1, 13)], ['items', 0, 'column']);
    failsAt([zone(8, 1, { rowSpan: 2 })], ['items', 0, 'row']);
    failsAt([zone(1, 12, { columnSpan: 2 })], ['items', 0, 'column']);
  });

  it('refuses a simple overlap, a full inclusion and a span crossing, at the second zone', () => {
    const overlapAt = (items: unknown[], index: number): void => {
      const result = GridNodeSchema.safeParse(grid({ items }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toContainEqual(['items', index]);
      }
    };
    overlapAt([zone(1, 1), zone(1, 1, {}, 'other')], 1);
    overlapAt([zone(1, 1, { rowSpan: 4, columnSpan: 4 }), zone(2, 2, {}, 'inner')], 1);
    overlapAt([zone(1, 2, { rowSpan: 4 }), zone(2, 1, { columnSpan: 4 }, 'crossing')], 1);
  });

  it('accepts adjacent zones sharing an edge but no coordinate', () => {
    expect(
      GridNodeSchema.safeParse(
        grid({
          items: [
            zone(1, 1, { rowSpan: 2, columnSpan: 3 }),
            zone(1, 4, { rowSpan: 2, columnSpan: 5 }, 'mid'),
            zone(1, 9, { rowSpan: 2, columnSpan: 4 }, 'right'),
            zone(3, 1, { columnSpan: 12 }, 'below'),
          ],
        }),
      ).success,
    ).toBe(true);
  });

  it('finishes a maximal tiling at the bounds with a readable verdict', () => {
    // One thousand full-width zones: a million occupied coordinates, no quadratic scan.
    const items = Array.from({ length: MAX_GRID_TRACKS }, (_unused, index) =>
      zone(index + 1, 1, { columnSpan: MAX_GRID_TRACKS }, `row-${index + 1}`),
    );
    expect(
      GridNodeSchema.safeParse(grid({ columns: MAX_GRID_TRACKS, rows: MAX_GRID_TRACKS, items }))
        .success,
    ).toBe(true);
  });

  it('does not cascade the cross check onto a zone whose own bounds already failed', () => {
    const result = GridNodeSchema.safeParse(grid({ items: [zone(0, 1), zone(1, 1, {}, 'ok')] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      // The faulty zone gets its local issue; no overlap issue is invented on top of it, and the
      // second zone -- which shares nothing with a zone that was refused -- gets none either.
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('items.0.row');
      expect(paths).not.toContain('items.1');
    }
  });
});

describe('the traversal of a grid', () => {
  const tree = GridNodeSchema.parse(
    grid({
      items: [
        {
          row: 1,
          column: 1,
          content: {
            type: 'container',
            id: 'z1',
            children: [
              {
                type: 'loop',
                id: 'l1',
                each: { kind: 'path', path: 'invoice.lines' },
                as: 'line',
                children: [
                  {
                    type: 'text',
                    id: 't1',
                    content: [
                      { kind: 'binding', value: { kind: 'path', path: 'line.label' } },
                      { kind: 'binding', value: { kind: 'path', path: 'invoice.currency' } },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          row: 2,
          column: 1,
          content: {
            type: 'container',
            id: 'z2',
            children: [
              {
                type: 'text',
                id: 't2',
                content: [{ kind: 'binding', value: { kind: 'path', path: 'line.label' } }],
              },
            ],
          },
        },
      ],
    }),
  );

  it('reaches every zone content through walk and findNodeById', () => {
    expect([...walk(tree)].map((node) => node.id)).toStrictEqual([
      'g',
      'z1',
      'l1',
      't1',
      'z2',
      't2',
    ]);
    expect(findNodeById(tree, 't2')?.type).toBe('text');
  });

  it('keeps a loop alias local to its zone: the neighbour reads the host path', () => {
    // In z1 `line` is the loop alias, so only `invoice.*` escapes; in z2 the same spelling is a
    // host path, because no alias is in scope there. No alias crosses from one zone to another.
    expect(collectDataPaths(tree)).toStrictEqual([
      'invoice.lines',
      'invoice.currency',
      'line.label',
    ]);
  });

  it('treats no grid position as a host datum', () => {
    const paths = collectDataPaths(tree).join(' ');
    expect(paths).not.toMatch(/\brow\b|\bcolumn\b|\bstep\b/);
  });

  it('locates a catalogue reading inside a grid zone at its stored path', () => {
    const template = parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'tpl',
      name: 'Gridded',
      version: '1.0.0',
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 15, right: 15, bottom: 15, left: 15 },
        header: [],
        footer: [],
      },
      root: { type: 'container', id: 'root', children: [tree] },
    });
    const catalogue = DataCatalogueSchema.parse({
      fields: [
        {
          key: 'invoice',
          label: 'Invoice',
          type: {
            kind: 'object',
            fields: [
              {
                key: 'lines',
                label: 'Lines',
                type: {
                  kind: 'list',
                  items: {
                    kind: 'object',
                    fields: [{ key: 'label', label: 'Label', type: { kind: 'string' } }],
                  },
                },
              },
              { key: 'currency', label: 'Currency', type: { kind: 'string' } },
            ],
          },
        },
      ],
    });

    const compatibility = checkTemplateDataCompatibility(template, catalogue);
    const inZone = compatibility.reads.find((read) => read.writtenPath === 'invoice.currency');
    expect(inZone?.status).toBe('available');
    expect(inZone?.path.slice(0, 6)).toStrictEqual(['root', 'children', 0, 'items', 0, 'content']);
    // The neighbouring zone reads `line.label` with no alias in scope: undeclared, not leaked.
    const inNeighbour = compatibility.reads.find(
      (read) => read.writtenPath === 'line.label' && read.nodeId === 't2',
    );
    expect(inNeighbour?.status).toBe('undeclared');
  });
});
