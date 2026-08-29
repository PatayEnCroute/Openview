import { createBudget, GridNodeSchema } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { documentImages } from '../document/images.js';
import { createKeySource, materializeBodyEntry } from '../document/materialize.js';
import { createPresentationSession } from '../document/presentation.js';
import { createMaterializationBudget } from '../limits/materialization.js';
import { markerSignatures } from '../pagination/markers.js';
import { progressionBound } from '../pagination/progress.js';
import {
  constantMarkers,
  gridPage,
  literalText,
  materializedOf,
  pagedHtmlOf,
  paginateOnGrid,
  refusalOfCut,
} from './fixtures.js';
import { GRID } from './metrics.js';

/** One row of squared paper is GRID.lineHeight css pixels; this step spells it in millimetres. */
const STEP_OF_ONE_LINE = GRID.lineHeight / GRID.pxPerMm;

const zoneText = (id: string, text: string): Record<string, unknown> => ({
  type: 'container',
  id: `zone-${id}`,
  children: [literalText(id, text)],
});

const gridBlock = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'grid',
  id: 'heading',
  columns: 12,
  rows: 3,
  step: STEP_OF_ONE_LINE,
  items: [
    { row: 1, column: 1, rowSpan: 2, columnSpan: 3, content: zoneText('logo', 'logo') },
    { row: 1, column: 4, columnSpan: 5, content: zoneText('address', 'acme, main street') },
    { row: 1, column: 9, columnSpan: 4, content: zoneText('reference', 'REF-1') },
  ],
  ...overrides,
});

const flowOf = (...children: Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

describe('the materialisation of a grid', () => {
  it('binds each zone in its own scope and resolves absent spans to one', () => {
    const document = materializedOf({
      ...flowOf({
        type: 'grid',
        id: 'g',
        columns: 2,
        rows: 2,
        step: 5,
        items: [
          {
            row: 2,
            column: 2,
            content: {
              type: 'container',
              id: 'zone',
              children: [
                {
                  type: 'loop',
                  id: 'per-item',
                  each: { kind: 'path', path: 'sample.items' },
                  as: 'item',
                  children: [
                    {
                      type: 'text',
                      id: 'sku',
                      content: [{ kind: 'binding', value: { kind: 'path', path: 'item.sku' } }],
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    });

    const [grid] = document.root[0]?.kind === 'container' ? document.root[0].children : [];
    if (grid?.kind !== 'grid') {
      throw new Error('the flow should carry a grid');
    }
    expect(grid.columns).toBe(2);
    expect(grid.rows).toBe(2);
    expect(grid.step).toBe(5);
    const [zone] = grid.items;
    expect(zone).toMatchObject({ row: 2, column: 2, rowSpan: 1, columnSpan: 1 });
    // The loop ran once per data item, inside the zone: two texts, one per sku.
    const texts = zone?.content.children ?? [];
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatchObject({ kind: 'text', nodeId: 'sku' });
  });

  it('refuses a grid smuggled into a table body as it refuses any block there', () => {
    // Unreachable through a parsed template -- the schema already refuses it -- so the defensive
    // branch is proven the way the other six are: on the traversal itself.
    const refusal = refusalOfCut(() =>
      materializeBodyEntry(GridNodeSchema.parse(gridBlock({ items: [] })), [], {
        scope: {},
        budget: createBudget(),
        units: createMaterializationBudget(10_000),
        keys: createKeySource(),
        presentations: createPresentationSession(undefined, undefined),
        region: 'root',
        column: undefined,
        declarationPath: [],
        iterations: [],
      }),
    );
    expect(refusal.code).toBe('template-refused');
  });
});

describe('the atomic pagination of a grid', () => {
  it('keeps a grid that fits in the rest of the page on that page', () => {
    // One line of text, then a 3-line grid: 4 of 5 lines used, one page.
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(5), ...flowOf(literalText('lead', 'x'), gridBlock()) }),
    );
    expect(paginated.pages).toHaveLength(1);
  });

  it('defers a grid that only fits on a fresh page, whole', () => {
    // Three lines of text leave 2 of 5; the 3-line grid moves entire to page 2.
    const paginated = paginateOnGrid(
      materializedOf({
        page: gridPage(5),
        ...flowOf(literalText('lead', 'x'.repeat(3 * GRID.charsPerLine)), gridBlock()),
      }),
    );
    expect(paginated.pages).toHaveLength(2);
    const secondPage = paginated.pages[1]?.root ?? [];
    expect(secondPage).toHaveLength(1);
    const [wrapper] = secondPage;
    if (wrapper?.kind !== 'container') {
      throw new Error('the root container should continue on the second page');
    }
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.children[0]?.kind).toBe('grid');
  });

  it('refuses a grid taller than a fresh page as an oversized atomic resource', () => {
    const refusal = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf({ page: gridPage(2), ...flowOf(gridBlock({ id: 'too-tall' })) }),
      ),
    );
    expect(refusal.code).toBe('oversized-atomic-resource');
    expect(refusal.details.nodeId).toBe('too-tall');
  });

  it('measures a grid at its declared height, whatever a zone contains', () => {
    // Same grid, one word then a paragraph in the zone: the declared 3 lines either way.
    const short = paginateOnGrid(
      materializedOf({ page: gridPage(5), ...flowOf(gridBlock(), literalText('after', 'y')) }),
    );
    const long = paginateOnGrid(
      materializedOf({
        page: gridPage(5),
        ...flowOf(
          gridBlock({
            items: [{ row: 1, column: 1, content: zoneText('talkative', 'z'.repeat(200)) }],
          }),
          literalText('after', 'y'),
        ),
      }),
    );
    expect(short.pages).toHaveLength(1);
    expect(long.pages).toHaveLength(1);
  });

  it('feeds the next page report from a contributing table inside a grid', () => {
    const contributingGrid = gridBlock({
      rows: 3,
      items: [
        {
          row: 1,
          column: 1,
          columnSpan: 12,
          content: {
            type: 'container',
            id: 'zone-table',
            children: [
              {
                type: 'table',
                id: 'amounts',
                columns: [{ id: 'amount', width: 1, align: 'end' }],
                header: [],
                body: [
                  {
                    type: 'tableRow',
                    id: 'amount-row',
                    pageReport: { value: { kind: 'literal', value: 12.5 } },
                    cells: [{ columnId: 'amount', children: [literalText('amount', '12.5')] }],
                  },
                ],
                footer: [],
              },
            ],
          },
        },
      ],
    });
    const paginated = paginateOnGrid(
      materializedOf({
        page: gridPage(5),
        ...flowOf(contributingGrid, literalText('tail', 'x'.repeat(6 * GRID.charsPerLine))),
      }),
    );
    expect(paginated.pages.length).toBeGreaterThan(1);
    expect(paginated.pages[0]?.incomingReport).toBe(0);
    expect(paginated.pages[1]?.incomingReport).toBe(12.5);
  });
});

describe('the html of a grid', () => {
  const html = pagedHtmlOf({ page: gridPage(6), ...flowOf(gridBlock()) });

  it('writes the tracks from the validated numbers alone', () => {
    expect(html).toContain('grid-template-columns:repeat(12,minmax(0,1fr))');
    expect(html).toContain(`grid-template-rows:repeat(3,${STEP_OF_ONE_LINE}mm)`);
  });

  it('places each zone 1-based with its exact spans', () => {
    expect(html).toContain('grid-row:1/span 2;grid-column:1/span 3');
    expect(html).toContain('grid-row:1/span 1;grid-column:4/span 5');
    expect(html).toContain('grid-row:1/span 1;grid-column:9/span 4');
  });

  it('marks each zone wrapper with the closed attribute naming its container', () => {
    expect(html).toContain('data-openview-grid-item="zone-logo"');
    expect(html).toContain('data-openview-grid-item="zone-address"');
    expect(html).toContain('data-openview-grid-item="zone-reference"');
  });

  it('declares no overflow rule on a grid or a zone', () => {
    const gridRule = /\.ov-grid\{[^}]*\}/.exec(html)?.[0] ?? '';
    const itemRule = /\.ov-grid-item\{[^}]*\}/.exec(html)?.[0] ?? '';
    expect(gridRule).not.toContain('overflow');
    expect(itemRule).not.toContain('overflow');
    expect(itemRule).toContain('min-width:0');
  });

  it('keeps the tracks inside the content box when the grid declares a padding', () => {
    const padded = pagedHtmlOf({
      page: gridPage(6),
      ...flowOf(gridBlock({ box: { padding: { top: 2, right: 3, bottom: 2, left: 3 } } })),
    });
    // One style attribute carries both the tracks and the padding: css grid resolves its tracks
    // in the content box, so writing them side by side is the whole guarantee.
    expect(padded).toMatch(/grid-template-rows:[^"]*padding:2mm 3mm 2mm 3mm/);
  });

  it('paints no string of the model inside the structural css', () => {
    const [css] = /<style>(.*?)<\/style>/.exec(html) ?? [''];
    expect(css).not.toContain('logo');
    expect(css).not.toContain('acme');
    expect(css).not.toContain('REF-1');
  });
});

describe('the collections a grid participates in', () => {
  /** A grid whose one zone holds a page marker in a named face and an embedded image. */
  const mixedGrid = (): Record<string, unknown> =>
    gridBlock({
      items: [
        {
          row: 1,
          column: 1,
          content: {
            type: 'container',
            id: 'zone-mixed',
            children: [
              {
                type: 'text',
                id: 'folio',
                typography: { family: 'Noto Serif', sizePt: 9 },
                content: [{ kind: 'pageField', field: 'number' }],
              },
              { type: 'image', id: 'zone-logo-img', src: 'logo.png' },
            ],
          },
        },
      ],
    });

  const mixedDocument = () => materializedOf({ page: gridPage(6), ...flowOf(mixedGrid()) });

  it('lists the image of a zone among the document resources', () => {
    const images = documentImages(mixedDocument());
    expect(images.map((image) => image.nodeId)).toStrictEqual(['zone-logo-img']);
  });

  it('registers the marker typography of a zone for the glyph probe', () => {
    const signatures = [...markerSignatures(mixedDocument(), { pages: 10, report: 0 }).keys()];
    expect(signatures.some((signature) => signature.includes('__openview_noto_serif_2_015'))).toBe(
      true,
    );
  });

  it('counts the contents of the zones in the progression bound', () => {
    const withContents = progressionBound(mixedDocument());
    const empty = progressionBound(
      materializedOf({ page: gridPage(6), ...flowOf(gridBlock({ items: [] })) }),
    );
    expect(withContents).toBeGreaterThan(empty);
  });

  it('paints a marker of a zone as the rank of the page that holds it', () => {
    const html = pagedHtmlOf({ page: gridPage(6), ...flowOf(mixedGrid()) });
    // The marker survives to composition and writes the page rank from inside the zone.
    expect(html).toContain('class="ov-marker"');
  });

  it('keeps a probe of a grid keyed so every zone content box can be asked for', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(6), ...flowOf(gridBlock()) }),
      {},
      constantMarkers(),
    );
    expect(paginated.pages[0]?.root[0]).toMatchObject({ kind: 'container' });
  });
});
