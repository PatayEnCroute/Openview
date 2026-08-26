import type { MaterialBlock, MaterialDocument, MaterialPageLayer } from '../document/types.js';
import { CANONICAL_NUMBER_ALPHABET } from '../pagination/markers.js';
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
 * The printed document: one closed box per page, all at the declared sheet, each composed as
 * background layers, then the three printable slots, then foreground layers -- DOM order is the
 * paint order, so no z-index of the model ever enters the css.
 */
export function buildPagedTree(paginated: PaginatedDocument): HtmlTree {
  return {
    css: documentCss(paginated),
    body: paginated.pages.map((page) =>
      buildPage(page, paginated.markers, paginated.backgroundLayers, paginated.foregroundLayers),
    ),
  };
}

/** A probe tree and the occurrence keys it annotated, which is the ask a reply is checked against. */
export interface ProbeTree {
  readonly tree: HtmlTree;
  readonly keys: ReadonlySet<string>;
}

/** Reads back what the tree really annotated, so the ask cannot drift from the markup. */
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
 * The measuring probe: the same widths as the printed document, and no height constraint anywhere.
 *
 * Every box carries its occurrence key, so a reply can be filed against the ask and a missing or
 * doubled answer is caught before a height of it decides a cut. Bands are laid out one after the
 * other in their region: only the height of each is read, never where the probe happened to put it.
 * Page layers are absent on purpose: they reserve no height and decide no cut, so no box of theirs
 * is ever asked for.
 */
export function buildProbeTree(document: MaterialDocument, markers: MarkerReserve): ProbeTree {
  const context: PaintContext = { markers, page: undefined, keyed: true };
  const tree: HtmlTree = {
    css: probeCss(document),
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

/** The key a measured glyph is filed under, by its rank in the canonical alphabet. */
export const glyphKey = (signature: string, at: number): string => `g${at}:${signature}`;

/**
 * The glyph probe: one box per character of the canonical alphabet and per typography a marker uses.
 *
 * The widest glyph of a font decides the reserve, so every character is measured rather than
 * assumed equal -- and a report may draw a sign, a point or an exponent, none of which a digit
 * bounds. Kerning and ligatures are off on the same class the printed marker uses, which is what
 * makes the sum of the advances the width of the value.
 */
export function buildGlyphProbe(
  document: MaterialDocument,
  signatures: ReadonlyMap<string, { readonly css: string }>,
): ProbeTree {
  const rows: HtmlElement[] = [];
  for (const [signature, { css }] of signatures) {
    rows.push(
      element(
        'div',
        { class: CSS_CLASSES.container },
        [...CANONICAL_NUMBER_ALPHABET].map((glyph, at) =>
          element(
            'span',
            {
              class: CSS_CLASSES.marker,
              style: css,
              'data-openview-key': glyphKey(signature, at),
            },
            [characters(glyph)],
          ),
        ),
      ),
    );
  }
  const tree: HtmlTree = {
    css: probeCss(document),
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
