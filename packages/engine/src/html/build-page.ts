import { fontFaceCss, usedFaces } from '../document/fonts/index.js';
import type { MaterialBlock, MaterialDocument, MaterialPageLayer } from '../document/types.js';
import type { MarkerReserve, MaterialPage, PaginatedDocument } from '../pagination/types.js';
import { wholeFragment } from '../pagination/whole.js';
import { buildFragment, characters, element, type PaintContext } from './build.js';
import { CSS_CLASSES, documentCss, layerCss, probeCss } from './css.js';
import type { HtmlElement, HtmlNode, HtmlTree } from './types.js';

/**
 * A slot of a page: a band region of reserved height, or the flow between them.
 *
 * The regions are emitted even when empty: the session measures them by selector, and a missing box
 * would make an absent band indistinguishable from an unmeasured one.
 */
function slot(
  region: 'header' | 'root' | 'footer',
  className: string,
  children: readonly HtmlElement[],
): HtmlElement {
  return element('div', { class: className, 'data-openview-region': region }, children);
}

function bandSlot(
  blocks: readonly MaterialBlock[],
  region: 'header' | 'footer',
  className: string,
  context: PaintContext,
): HtmlElement {
  return slot(
    region,
    className,
    blocks.map((block) => buildFragment(wholeFragment(block), context)),
  );
}

/**
 * One layer wrapper: absolute over the whole sheet, with the layer's own opacity when one is
 * declared. Painted per page so a marker inside it writes that page's values, from the single
 * materialisation the render made.
 */
function buildLayer(layer: MaterialPageLayer, context: PaintContext): HtmlElement {
  const style = layerCss(layer.opacity);
  return element(
    'div',
    style === undefined ? { class: CSS_CLASSES.layer } : { class: CSS_CLASSES.layer, style },
    [buildFragment(wholeFragment(layer.content), context)],
  );
}

function buildPage(
  page: MaterialPage,
  markers: MarkerReserve,
  background: readonly MaterialPageLayer[],
  foreground: readonly MaterialPageLayer[],
): HtmlElement {
  const context: PaintContext = {
    markers,
    page: { number: page.number, count: page.count, report: page.incomingReport },
    keyed: false,
  };
  return element('div', { class: CSS_CLASSES.page, 'data-openview-page': String(page.number) }, [
    ...background.map((layer) => buildLayer(layer, context)),
    element('div', { class: CSS_CLASSES.printable }, [
      bandSlot(page.header, 'header', `${CSS_CLASSES.band} ${CSS_CLASSES.headerSlot}`, context),
      slot(
        'root',
        CSS_CLASSES.flow,
        page.root.map((fragment) => buildFragment(fragment, context)),
      ),
      bandSlot(page.footer, 'footer', `${CSS_CLASSES.band} ${CSS_CLASSES.footerSlot}`, context),
    ]),
    ...foreground.map((layer) => buildLayer(layer, context)),
  ]);
}

/**
 * Builds the complete HTML tree for the paginated document.
 */
export function buildPagedTree(paginated: PaginatedDocument, fonts: string): HtmlTree {
  return {
    css: fonts + documentCss(paginated),
    body: paginated.pages.map((page) =>
      buildPage(page, paginated.markers, paginated.backgroundLayers, paginated.foregroundLayers),
    ),
  };
}

/** Probe HTML tree paired with the set of annotated occurrence keys. */
export interface ProbeTree {
  readonly tree: HtmlTree;
  readonly keys: ReadonlySet<string>;
}

function keysOf(tree: HtmlTree): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (nodes: readonly HtmlNode[]): void => {
    for (const node of nodes) {
      if (node.kind !== 'element') {
        continue;
      }
      const key = node.attributes['data-openview-key'];
      if (key !== undefined) {
        found.add(key);
      }
      walk(node.children);
    }
  };
  walk(tree.body);
  return found;
}

/**
 * Builds an unconstrained HTML probe tree for layout measurement.
 */
export function buildProbeTree(
  document: MaterialDocument,
  markers: MarkerReserve,
  fonts: string,
): ProbeTree {
  const context: PaintContext = { markers, page: undefined, keyed: true };
  const tree: HtmlTree = {
    css: fonts + probeCss(document),
    body: [
      element('div', { class: CSS_CLASSES.page }, [
        element('div', { class: CSS_CLASSES.printable }, [
          slot(
            'header',
            CSS_CLASSES.band,
            document.headerBands.map((band) => buildFragment(wholeFragment(band.content), context)),
          ),
          slot(
            'root',
            CSS_CLASSES.flow,
            document.root.map((block) => buildFragment(wholeFragment(block), context)),
          ),
          slot(
            'footer',
            CSS_CLASSES.band,
            document.footerBands.map((band) => buildFragment(wholeFragment(band.content), context)),
          ),
        ]),
      ]),
    ],
  };
  return { tree, keys: keysOf(tree) };
}

/** Formats a unique measurement key for a marker sample. */
export const sampleKey = (signature: string, at: number): string => `s${at}:${signature}`;

/**
 * Builds an HTML probe tree to measure sample widths for marker signatures.
 */
export function buildMarkerProbe(
  document: MaterialDocument,
  signatures: ReadonlyMap<string, { readonly css: string; readonly samples: readonly string[] }>,
  fonts: string,
): ProbeTree {
  const rows: HtmlElement[] = [];
  for (const [signature, { css, samples }] of signatures) {
    rows.push(
      element(
        'div',
        { class: CSS_CLASSES.container },
        samples.map((sample, at) =>
          element(
            'span',
            {
              class: CSS_CLASSES.marker,
              style: css,
              'data-openview-key': sampleKey(signature, at),
            },
            [characters(sample)],
          ),
        ),
      ),
    );
  }
  const tree: HtmlTree = {
    css: fonts + probeCss(document),
    body: [
      element('div', { class: CSS_CLASSES.page }, [
        element('div', { class: CSS_CLASSES.printable }, [
          slot('header', CSS_CLASSES.band, []),
          slot('root', CSS_CLASSES.flow, rows),
          slot('footer', CSS_CLASSES.band, []),
        ]),
      ]),
    ],
  };
  return { tree, keys: keysOf(tree) };
}

/**
 * The `@font-face` rules for the faces this document paints, written once per render.
 *
 * The single source the three trees share. A probe measured against one set of faces and a page
 * printed against another would put the cuts and the paint in two different typographies, so the
 * marker probe, the natural probe and every settling round are handed this same string.
 */
export function documentFontCss(document: MaterialDocument): string {
  return fontFaceCss(usedFaces(document));
}
