import { describe, expect, it } from 'vitest';
import { reachableOccurrences } from '../document/bands.js';
import { documentImages } from '../document/images.js';
import { materializeDocument } from '../document/materialize.js';
import { buildPagedTree, buildProbeTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import { DEFAULT_RENDER_SAFETY_LIMITS } from '../limits/types.js';
import { markerSignatures } from '../pagination/markers.js';
import {
  constantMarkers,
  gridPage,
  idsPerPage,
  literalText,
  materializedOf,
  NO_FONTS,
  NO_IMAGES,
  paginateOnGrid,
  refusalOfCut,
  SAMPLE_DATA,
  TINY_PNG,
  templateOf,
} from './fixtures.js';
import { GRID } from './metrics.js';

const container = (id: string, children: unknown[] = []): Record<string, unknown> => ({
  type: 'container',
  id,
  children,
});

const layer = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  plane: 'background',
  content: container('paper'),
  ...overrides,
});

/** A flow long enough for several pages of five grid lines. */
const longFlow = (): Record<string, unknown> => ({
  root: container('root', [literalText('body', 'x'.repeat(12 * GRID.charsPerLine))]),
});

const layeredPage = (layers: unknown[]): Record<string, unknown> => ({
  page: { ...gridPage(5), layers },
});

describe('the materialisation of the layers', () => {
  it('binds a layer once per render, not once per page', () => {
    // The evaluation budget is the counter: one binding in the layer costs one evaluation,
    // whatever the page count. A per-page rebinding would spend four times as much.
    const document = materializedOf({
      ...layeredPage([
        layer({
          content: container('watermark', [
            {
              type: 'text',
              id: 'mention',
              content: [{ kind: 'binding', value: { kind: 'path', path: 'sample.label' } }],
            },
          ]),
        }),
      ]),
      ...longFlow(),
    });
    const paginated = paginateOnGrid(document);
    expect(paginated.pages.length).toBeGreaterThan(2);
    expect(document.backgroundLayers).toHaveLength(1);
    expect(document.backgroundLayers[0]?.content.nodeId).toBe('watermark');
    expect(document.foregroundLayers).toHaveLength(0);
  });

  it('partitions the planes and keeps the stored order inside each', () => {
    const document = materializedOf({
      ...layeredPage([
        layer({ content: container('paper') }),
        layer({ plane: 'foreground', opacity: 0.85, content: container('stamp') }),
        layer({ opacity: 0.12, content: container('watermark') }),
      ]),
    });
    expect(document.backgroundLayers.map((entry) => entry.content.nodeId)).toStrictEqual([
      'paper',
      'watermark',
    ]);
    expect(document.foregroundLayers.map((entry) => entry.content.nodeId)).toStrictEqual(['stamp']);
    expect(document.backgroundLayers[1]?.opacity).toBe(0.12);
    expect(document.backgroundLayers[0]?.opacity).toBeUndefined();
  });

  it('draws the cost of a layer from the same budget as the flow', () => {
    // One step is enough for the flow alone; a layer spending it first starves the flow, which is
    // what proves one shared ceiling rather than one per area -- and that the background layer is
    // evaluated before the flow, in paint order.
    const binding = (id: string): Record<string, unknown> => ({
      type: 'text',
      id,
      content: [{ kind: 'binding', value: { kind: 'path', path: 'sample.label' } }],
    });
    const bind = (layers: unknown[] | undefined): unknown =>
      materializeDocument(
        templateOf({
          page: layers === undefined ? gridPage(5) : { ...gridPage(5), layers },
          root: container('root', [binding('in-flow')]),
        }),
        SAMPLE_DATA,
        reachableOccurrences(1),
        { maxSteps: 1 },
      );

    expect(() => bind(undefined)).not.toThrow();
    const refusal = refusalOfCut(() =>
      bind([layer({ content: container('spender', [binding('in-layer')]) })]),
    );
    expect(refusal.code).toBe('expression-refused');
    expect(refusal.details.region).toBe('root');
    expect(refusal.details.nodeId).toBe('in-flow');
  });

  it('refuses a contribution declared inside a layer, naming the area and the row', () => {
    const refusal = refusalOfCut(() =>
      materializedOf({
        ...layeredPage([
          layer({
            plane: 'foreground',
            content: container('stamp', [
              {
                type: 'table',
                id: 'smuggled',
                columns: [{ id: 'c', width: 1, align: 'start' }],
                header: [],
                body: [
                  {
                    type: 'tableRow',
                    id: 'counted-nowhere',
                    pageReport: { value: { kind: 'literal', value: 1 } },
                    cells: [],
                  },
                ],
                footer: [],
              },
            ]),
          }),
        ]),
      }),
    );
    expect(refusal.code).toBe('page-report-refused');
    expect(refusal.details.region).toBe('foreground');
    expect(refusal.details.nodeId).toBe('counted-nowhere');
  });
});

describe('the layers and the cuts', () => {
  it('adds layers to a document without moving one fragment or one report', () => {
    const bare = paginateOnGrid(materializedOf({ page: gridPage(5), ...longFlow() }));
    const layered = paginateOnGrid(
      materializedOf({
        ...layeredPage([
          layer({ content: container('paper') }),
          layer({ plane: 'foreground', content: container('stamp') }),
        ]),
        ...longFlow(),
      }),
    );
    expect(layered.pages).toHaveLength(bare.pages.length);
    expect(idsPerPage(layered)).toStrictEqual(idsPerPage(bare));
    expect(layered.pages.map((page) => page.incomingReport)).toStrictEqual(
      bare.pages.map((page) => page.incomingReport),
    );
    expect(layered.headerReserve).toBe(bare.headerReserve);
    expect(layered.footerReserve).toBe(bare.footerReserve);
  });
});

describe('the composition of the pages', () => {
  const paginated = () =>
    paginateOnGrid(
      materializedOf({
        ...layeredPage([
          layer({ content: container('paper', []) }),
          layer({
            opacity: 0.12,
            content: container('watermark', [literalText('duplicata', 'DUPLICATA')]),
          }),
          layer({
            plane: 'foreground',
            opacity: 0.85,
            content: container('stamp', [literalText('paid', 'PAID')]),
          }),
        ]),
        ...longFlow(),
      }),
    );

  it('paints background layers, then the printable, then foreground layers, on every page', () => {
    const html = serializeHtml(
      buildPagedTree(paginated(), NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    const pages = html.split('class="ov-page"').slice(1);
    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      const paper = page.indexOf('data-openview-node="paper"');
      const watermark = page.indexOf('data-openview-node="watermark"');
      const printable = page.indexOf('class="ov-printable"');
      const stamp = page.indexOf('data-openview-node="stamp"');
      expect(paper).toBeGreaterThanOrEqual(0);
      expect(watermark).toBeGreaterThan(paper);
      expect(printable).toBeGreaterThan(watermark);
      expect(stamp).toBeGreaterThan(printable);
    }
  });

  it('writes the whole-layer opacity on the wrapper and nothing on an opaque one', () => {
    const html = serializeHtml(
      buildPagedTree(paginated(), NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('class="ov-layer" style="opacity:0.12"');
    expect(html).toContain('class="ov-layer" style="opacity:0.85"');
    expect(html).toContain('<div class="ov-layer"><div class="ov-container"');
  });

  it('stretches a layer to the whole sheet through the closed stylesheet', () => {
    const html = serializeHtml(
      buildPagedTree(paginated(), NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('.ov-layer{position:absolute;top:0;left:0;width:100%;height:100%}');
    expect(html).toContain('.ov-layer>.ov-container{height:100%}');
  });

  it('writes each page rank into a marker a layer carries, from one materialisation', () => {
    const html = serializeHtml(
      buildPagedTree(
        paginateOnGrid(
          materializedOf({
            ...layeredPage([
              layer({
                plane: 'foreground',
                content: container('folio-layer', [
                  {
                    type: 'text',
                    id: 'folio',
                    content: [{ kind: 'pageField', field: 'number' }],
                  },
                ]),
              }),
            ]),
            ...longFlow(),
          }),
          {},
          constantMarkers(1),
        ),
        NO_FONTS,
        NO_IMAGES,
      ),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    const folios = [...html.matchAll(/class="ov-marker"[^>]*>(\d+)</g)].map((hit) => hit[1]);
    expect(folios).toStrictEqual(['1', '2', '3']);
  });

  it('keeps the probe free of layers: no zone of theirs is ever asked for', () => {
    const document = materializedOf({
      ...layeredPage([layer({ content: container('paper') })]),
      ...longFlow(),
    });
    const probe = buildProbeTree(document, constantMarkers(), NO_FONTS, NO_IMAGES);
    expect(serializeHtml(probe.tree, DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes)).not.toContain(
      'data-openview-node="paper"',
    );
    expect(serializeHtml(probe.tree, DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes)).not.toContain(
      'class="ov-layer"',
    );
  });
});

describe('the observations a layer joins', () => {
  it('lists a layer image among the document resources, in paint order', () => {
    const document = materializedOf({
      ...layeredPage([
        layer({ content: container('paper', [{ type: 'image', id: 'texture', src: TINY_PNG }]) }),
        layer({
          plane: 'foreground',
          content: container('stamp', [{ type: 'image', id: 'seal', src: TINY_PNG }]),
        }),
      ]),
      ...longFlow(),
    });
    const ids = documentImages(document).map((image) => image.nodeId);
    expect(ids[0]).toBe('texture');
    expect(ids.at(-1)).toBe('seal');
  });

  it('measures the marker typography a layer uses in the glyph probe', () => {
    const document = materializedOf({
      ...layeredPage([
        layer({
          content: container('folio-layer', [
            {
              type: 'text',
              id: 'folio',
              typography: { family: 'Noto Serif', sizePt: 9 },
              content: [{ kind: 'pageField', field: 'number' }],
            },
          ]),
        }),
      ]),
    });
    const signatures = [...markerSignatures(document, { pages: 10, report: 0 }).keys()];
    expect(signatures.some((signature) => signature.includes('__openview_noto_serif_2_015'))).toBe(
      true,
    );
  });
});
