import { describe, expect, it } from 'vitest';
import { paginate } from '../pagination/paginate.js';
import { assertAdvanced, digitsOf, progressionBound, sameFlow } from '../pagination/progress.js';
import { FLOW_START } from '../pagination/types.js';
import {
  constantMarkers,
  gridPage,
  idsPerPage,
  literalText,
  materializedOf,
  paginateOnGrid,
  refusalOfCut,
  TINY_PNG,
  textPerPage,
} from './fixtures.js';
import { gridMetrics } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** Twenty characters is one line of the grid, so a block of `n` lines is `n` of these. */
const lines = (count: number, from = 0): string =>
  Array.from({ length: count }, (_unused, index) => `line ${String(index + from).padEnd(14, '.')}`)
    .join('')
    .slice(0, count * 20);

describe('a flow that fits', () => {
  it('stays on one page and paints every block once', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(10), ...flow([literalText('a', lines(2))]) }, {}),
    );
    expect(paginated.pages).toHaveLength(1);
    expect(idsPerPage(paginated)).toStrictEqual([['root', 'a']]);
  });

  it('reports the sheet, the margins and the printable area it was given', () => {
    const document = materializedOf({ page: gridPage(10), ...flow([]) }, {});
    const paginated = paginateOnGrid(document);
    expect(paginated.sheet).toStrictEqual(document.sheet);
    expect(paginated.margins).toStrictEqual(document.margins);
    expect(paginated.printable).toStrictEqual(document.printable);
  });

  it('prints one page for a document whose flow holds nothing at all', () => {
    const paginated = paginateOnGrid(materializedOf({ page: gridPage(4), ...flow([]) }, {}));
    expect(paginated.pages).toHaveLength(1);
    expect(paginated.pages[0]?.number).toBe(1);
    expect(paginated.pages[0]?.count).toBe(1);
  });
});

describe('a flow that does not fit', () => {
  it('cuts between two sibling blocks and creates no empty page', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(2),
          ...flow([literalText('a', lines(2)), literalText('b', lines(2))]),
        },
        {},
      ),
    );
    /* The first block fills the page exactly, so the second starts the next one whole. */
    expect(idsPerPage(paginated)).toStrictEqual([
      ['root', 'a'],
      ['root', 'b'],
    ]);
    for (const page of paginated.pages) {
      expect(page.root.length).toBeGreaterThan(0);
    }
  });

  it('fragments a container and keeps its children in order, never repeating one', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(2),
          ...flow([
            {
              type: 'container',
              id: 'inner',
              children: [
                literalText('a', lines(1)),
                literalText('b', lines(1)),
                literalText('c', lines(1)),
                literalText('d', lines(1)),
              ],
            },
          ]),
        },
        {},
      ),
    );
    expect(idsPerPage(paginated)).toStrictEqual([
      ['root', 'inner', 'a', 'b'],
      ['root', 'inner', 'c', 'd'],
    ]);
  });

  it('marks each fragment of a cut box with where it sits in the sequence', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(1),
          ...flow([
            literalText('a', lines(1)),
            literalText('b', lines(1)),
            literalText('c', lines(1)),
          ]),
        },
        {},
      ),
    );
    const edges = paginated.pages.map((page) => {
      const [container] = page.root;
      return container?.kind === 'container' ? container.edge : undefined;
    });
    expect(edges).toStrictEqual(['first', 'middle', 'last']);
  });

  it('numbers the pages one to n and gives them all the same count', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(1), ...flow([literalText('a', lines(4))]) }, {}),
    );
    expect(paginated.pages.map((page) => page.number)).toStrictEqual([1, 2, 3, 4]);
    expect(new Set(paginated.pages.map((page) => page.count))).toStrictEqual(new Set([4]));
  });
});

describe('an atomic block', () => {
  const imagePage = (flowLines: number) =>
    materializedOf(
      {
        page: gridPage(flowLines),
        ...flow([literalText('a', lines(1)), { type: 'image', id: 'pic', src: TINY_PNG }]),
      },
      {},
    );

  it('moves whole to a page that can hold it rather than being cut', () => {
    /* The image is four grid lines tall and one line is already spent, so it starts a page. */
    const paginated = paginateOnGrid(imagePage(4));
    expect(idsPerPage(paginated)).toStrictEqual([
      ['root', 'a'],
      ['root', 'pic'],
    ]);
  });

  it('is refused, not scaled, when no page can hold it', () => {
    const refused = refusalOfCut(() => paginateOnGrid(imagePage(3)));
    expect(refused.code).toBe('oversized-atomic-resource');
    expect(refused.details.nodeId).toBe('pic');
  });

  it('is compared against the flow a band leaves, not against the whole printable area', () => {
    const band = (id: string) => ({
      on: 'every',
      content: { type: 'container', id, children: [literalText(`${id}-t`, lines(1))] },
    });
    /* Four lines of flow hold the image; one of them reserved for a band no longer do. */
    expect(paginateOnGrid(imagePage(4)).pages).toHaveLength(2);
    const withBand = materializedOf(
      {
        page: gridPage(5, { header: [band('top')] }),
        ...flow([literalText('a', lines(1)), { type: 'image', id: 'pic', src: TINY_PNG }]),
      },
      {},
    );
    expect(paginateOnGrid(withBand).pages).toHaveLength(2);
    const tighter = materializedOf(
      {
        page: gridPage(4, { header: [band('top')] }),
        ...flow([literalText('a', lines(1)), { type: 'image', id: 'pic', src: TINY_PNG }]),
      },
      {},
    );
    expect(refusalOfCut(() => paginateOnGrid(tighter)).code).toBe('oversized-atomic-resource');
  });
});

describe('a box whose own decoration leaves no room', () => {
  it('is refused rather than paginated forever', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(2),
            ...flow([
              {
                type: 'container',
                id: 'padded',
                box: { padding: { top: 20, right: 0, bottom: 20, left: 0 } },
                children: [literalText('a', lines(1))],
              },
            ]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('padded');
  });

  it('is refused when it holds nothing and is still taller than a page', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(2),
            ...flow([
              {
                type: 'container',
                id: 'slab',
                box: { padding: { top: 20, right: 0, bottom: 20, left: 0 } },
                children: [],
              },
            ]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('slab');
  });

  it('is accepted when it holds nothing, because nothing has to fit inside it', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(10),
          ...flow([
            {
              type: 'container',
              id: 'spacer',
              box: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
              children: [],
            },
          ]),
        },
        {},
      ),
    );
    expect(paginated.pages).toHaveLength(1);
  });
});

describe('keepTogether is carried, and changes no cut of this release', () => {
  /* The contract spells "no" as an absent key, so the two documents differ by that key alone. */
  const marked = { keepTogether: true };
  const twoTexts = (kept: Record<string, unknown>) =>
    materializedOf(
      {
        page: gridPage(3),
        ...flow([
          { ...literalText('a', lines(2)), ...kept },
          { ...literalText('b', lines(2)), ...kept },
        ]),
      },
      {},
    );

  it('cuts a text the same way whether it is marked or not', () => {
    expect(textPerPage(paginateOnGrid(twoTexts(marked)), 'b')).toStrictEqual(
      textPerPage(paginateOnGrid(twoTexts({})), 'b'),
    );
    expect(paginateOnGrid(twoTexts(marked)).pages).toHaveLength(2);
  });

  it('survives binding so a later release can order a report from it', () => {
    const [container] = twoTexts(marked).root;
    expect(container?.kind === 'container' && container.children[0]?.keepTogether).toBe(true);
    const [plain] = twoTexts({}).root;
    expect(plain?.kind === 'container' && plain.children[0]?.keepTogether).toBe(false);
  });
});

describe('the progression bound and the strict advance', () => {
  it('counts a unit for every character, block and structural position', () => {
    const document = materializedOf(
      {
        page: gridPage(4),
        ...flow([literalText('a', 'abc'), { type: 'image', id: 'p', src: TINY_PNG }]),
      },
      {},
    );
    /* Root, the text and its three characters, the image: never zero, always finite. */
    expect(progressionBound(document)).toBeGreaterThanOrEqual(6);
    expect(Number.isFinite(progressionBound(document))).toBe(true);
  });

  it('is at least one even for a document with nothing in it', () => {
    const document = materializedOf({ page: gridPage(4), ...flow([]) }, {});
    expect(progressionBound(document)).toBeGreaterThanOrEqual(1);
  });

  it('writes the bound in as many decimal digits as it really takes', () => {
    expect(digitsOf(1)).toBe(1);
    expect(digitsOf(9)).toBe(1);
    expect(digitsOf(10)).toBe(2);
    expect(digitsOf(99)).toBe(2);
    expect(digitsOf(100)).toBe(3);
    expect(digitsOf(1234.7)).toBe(4);
  });

  it('refuses a page that left the cursor exactly where it found it', () => {
    expect(() => assertAdvanced(FLOW_START, FLOW_START, 3)).toThrow(
      expect.objectContaining({ code: 'pagination-impossible' }),
    );
    const later = { index: 1, inner: undefined };
    expect(() => assertAdvanced(FLOW_START, later, 1)).not.toThrow();
  });

  it('tells two positions apart at every depth a cursor can reach', () => {
    expect(sameFlow(FLOW_START, { index: 0, inner: undefined })).toBe(true);
    expect(sameFlow(FLOW_START, { index: 1, inner: undefined })).toBe(false);
    const text = { index: 0, inner: { kind: 'text', line: 2 } } as const;
    expect(sameFlow(text, { index: 0, inner: { kind: 'text', line: 2 } })).toBe(true);
    expect(sameFlow(text, { index: 0, inner: { kind: 'text', line: 3 } })).toBe(false);
    expect(sameFlow(text, FLOW_START)).toBe(false);
    const nested = { index: 0, inner: { kind: 'container', flow: text } } as const;
    expect(sameFlow(nested, { index: 0, inner: { kind: 'container', flow: text } })).toBe(true);
    expect(sameFlow(nested, text)).toBe(false);
    const table = { index: 0, inner: { kind: 'table', row: 2, inner: undefined } } as const;
    expect(sameFlow(table, { index: 0, inner: { kind: 'table', row: 2, inner: undefined } })).toBe(
      true,
    );
    expect(sameFlow(table, { index: 0, inner: { kind: 'table', row: 3, inner: undefined } })).toBe(
      false,
    );
    const split = {
      index: 0,
      inner: { kind: 'table', row: 2, inner: { cells: [FLOW_START] } },
    } as const;
    expect(sameFlow(split, table)).toBe(false);
    expect(
      sameFlow(split, {
        index: 0,
        inner: { kind: 'table', row: 2, inner: { cells: [FLOW_START] } },
      }),
    ).toBe(true);
    expect(
      sameFlow(split, {
        index: 0,
        inner: { kind: 'table', row: 2, inner: { cells: [{ index: 1, inner: undefined }] } },
      }),
    ).toBe(false);
  });
});

describe('what a page keeps of the source', () => {
  it('never mutates the materialised document it cut', () => {
    const document = materializedOf(
      { page: gridPage(1), ...flow([literalText('a', lines(3))]) },
      {},
    );
    const before = structuredClone(document);
    paginateOnGrid(document);
    expect(document).toStrictEqual(before);
  });

  it('carries the marker reserve it was given onto the pages', () => {
    const markers = constantMarkers(2, 7);
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(4), ...flow([literalText('a', lines(1))]) }, {}),
      {},
      markers,
    );
    expect(paginated.markers).toBe(markers);
  });

  it('restores the whole text of a block by concatenating its fragments in order', () => {
    const whole = lines(5);
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(2), ...flow([literalText('a', whole)]) }, {}),
    );
    expect(textPerPage(paginated, 'a').join('')).toBe(whole);
  });
});

describe('a page with no room left for the flow', () => {
  const document = () =>
    materializedOf({ page: gridPage(4), ...flow([literalText('a', lines(2))]) }, {});

  const cut = (slack: ReadonlyMap<number, number>) => {
    const bound = document();
    const metrics = gridMetrics(bound);
    return paginate(bound, {
      metrics,
      markers: constantMarkers(),
      printableHeight: bound.printable.height * metrics.pxPerMm,
      slack,
    });
  };

  it('refuses the page rather than printing a truncated one', () => {
    const refused = refusalOfCut(() => cut(new Map([[1, 40]])));
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.pageNumber).toBe(1);
  });

  it('refuses a page that was withheld more height than it ever had', () => {
    const refused = refusalOfCut(() => cut(new Map([[1, 60]])));
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.pageNumber).toBe(1);
  });

  it('prints the bands alone for a flow that holds no block at all', () => {
    const bound = document();
    const metrics = gridMetrics(bound);
    const paginated = paginate(
      { ...bound, root: [] },
      {
        metrics,
        markers: constantMarkers(),
        printableHeight: bound.printable.height * metrics.pxPerMm,
        slack: new Map(),
      },
    );
    expect(paginated.pages).toHaveLength(1);
    expect(paginated.pages[0]?.root).toStrictEqual([]);
  });
});

describe('the progression bound of a structured document', () => {
  it('counts the rows and the cells of a table, not only its own position', () => {
    const table = {
      type: 'table',
      id: 'grid',
      columns: [{ id: 'only', width: 1, align: 'start' }],
      header: [
        {
          type: 'tableRow',
          id: 'h',
          cells: [{ columnId: 'only', children: [literalText('ht', 'head')] }],
        },
      ],
      body: [
        {
          type: 'tableRow',
          id: 'r',
          cells: [{ columnId: 'only', children: [literalText('rt', 'body')] }],
        },
      ],
      footer: [
        {
          type: 'tableRow',
          id: 'f',
          cells: [{ columnId: 'only', children: [literalText('ft', 'foot')] }],
        },
      ],
    };
    const plain = progressionBound(
      materializedOf({ page: gridPage(10), ...flow([literalText('a', 'abcd')]) }, {}),
    );
    const structured = progressionBound(
      materializedOf({ page: gridPage(10), ...flow([table]) }, {}),
    );
    expect(structured).toBeGreaterThan(plain);
  });

  it('counts a marker as one position, whatever digits it will show', () => {
    const marked = progressionBound(
      materializedOf(
        {
          page: gridPage(10),
          ...flow([
            {
              type: 'text',
              id: 'm',
              content: [
                { kind: 'literal', text: 'ab' },
                { kind: 'pageField', field: 'count' },
              ],
            },
          ]),
        },
        {},
      ),
    );
    const plain = progressionBound(
      materializedOf({ page: gridPage(10), ...flow([literalText('m', 'abc')]) }, {}),
    );
    expect(marked).toBe(plain);
  });
});
