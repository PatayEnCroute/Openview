import { type BoxBorder, kindOf, roundDecimal } from '@openview/core';
import { assertCoveredText } from '../document/fonts/index.js';
import { type MarkerWriting, writeMarker } from '../document/presentation.js';
import type { MaterialPageFieldRun, MaterialRun, ResolvedTypography } from '../document/types.js';
import type { DocumentRenderErrorDetails } from '../errors.js';
import type {
  CellFragment,
  GridFragment,
  MarkerReserve,
  MaterialFragment,
  RowFragment,
  TableFragment,
} from '../pagination/types.js';
import { visitFragment } from '../pagination/visit.js';
import { wholeFragment } from '../pagination/whole.js';
import {
  boxCss,
  CSS_CLASSES,
  columnWidths,
  gridCss,
  gridItemCss,
  markerCss,
  runCss,
  textCss,
} from './css.js';
import { type RowRules, resolveRowRules } from './table-rules.js';
import type { HtmlAttributes, HtmlElement, HtmlElementName, HtmlNode } from './types.js';

const NO_RULES: RowRules = { top: undefined, right: undefined, bottom: undefined, left: undefined };

/** Page layout values supplied to dynamic markers during page construction. */
export interface PageValues {
  readonly number: number;
  readonly count: number;
  /** Unrounded cumulative report amount carried into the page. */
  readonly report: number;
}

/** Rendering context for HTML tree construction passes. */
export interface PaintContext {
  readonly markers: MarkerReserve;
  /** Page values when rendering a paged tree, or `undefined` for measurement probes. */
  readonly page: PageValues | undefined;
  readonly keyed: boolean;
}

export const element = (
  name: HtmlElementName,
  attributes: HtmlAttributes,
  children: readonly HtmlNode[] = [],
): HtmlElement => ({ kind: 'element', name, attributes, children });

export const characters = (text: string): HtmlNode => ({ kind: 'text', text });

const keyAttribute = (key: string, context: PaintContext): HtmlAttributes =>
  context.keyed ? { 'data-openview-key': key } : {};

const runAttribute = (index: number, context: PaintContext): HtmlAttributes =>
  context.keyed ? { 'data-openview-run': String(index) } : {};

function markerText(run: MaterialPageFieldRun, context: PaintContext): string {
  const written = writtenMarker(run, context);
  /* The last place a character can reach the page: the probe measured an envelope of samples, and
     the value a page really writes has to be inside the face all the same. */
  assertCoveredText(written, run.typography.face, { ...run.site, ...pageDetail(context) });
  return written;
}

/** One-based rank of the page being painted, when the cuts have already decided it. */
const pageDetail = (context: PaintContext): DocumentRenderErrorDetails =>
  context.page === undefined ? {} : { pageNumber: context.page.number };

function writtenMarker(run: MaterialPageFieldRun, context: PaintContext): string {
  const page = context.page;
  if (page === undefined) {
    return context.markers.placeholderOf(run);
  }
  const details = { pageNumber: page.number };
  switch (run.field) {
    case 'number':
      return countText(run.writing, page.number, details);
    case 'count':
      return countText(run.writing, page.count, details);
    case 'report': {
      const rounded = roundDecimal(page.report, run.decimals, run.mode);
      return run.writing === undefined
        ? String(rounded)
        : writeMarker(run.writing, rounded, details);
    }
    default: {
      const exhaustive: never = run;
      throw new TypeError(`Unhandled page marker: ${kindOf(exhaustive, 'field')}`);
    }
  }
}

function countText(
  writing: MarkerWriting | undefined,
  value: number,
  details: DocumentRenderErrorDetails,
): string {
  return writing === undefined ? String(value) : writeMarker(writing, value, details);
}

function buildRun(run: MaterialRun, index: number, context: PaintContext): HtmlElement {
  if (run.kind === 'pageField') {
    return element(
      'span',
      {
        class: CSS_CLASSES.marker,
        style: markerCss(run.typography, context.markers.widthOf(run)),
        ...runAttribute(index, context),
      },
      [characters(markerText(run, context))],
    );
  }
  return element('span', { style: runCss(run.typography), ...runAttribute(index, context) }, [
    characters(run.text),
  ]);
}

function buildCell(
  cell: CellFragment,
  row: RowFragment,
  rules: RowRules,
  index: number,
  columns: number,
  context: PaintContext,
): HtmlElement {
  const edges: BoxBorder = {
    top: rules.top,
    right: index === columns - 1 ? rules.right : undefined,
    bottom: rules.bottom,
    left: index === 0 ? rules.left : undefined,
  };
  return element(
    'td',
    {
      class: CSS_CLASSES.cell,
      style: boxCss(row.source.box, edges),
      ...keyAttribute(cell.source.key, context),
    },
    cell.children.map((child) => buildFragment(child, context)),
  );
}

function buildRow(row: RowFragment, rules: RowRules, context: PaintContext): HtmlElement {
  return element(
    'tr',
    { 'data-openview-node': row.source.nodeId, ...keyAttribute(row.source.key, context) },
    row.cells.map((cell, index) => buildCell(cell, row, rules, index, row.cells.length, context)),
  );
}

function buildTable(table: TableFragment, context: PaintContext): HtmlElement {
  const rows = [...table.header, ...table.rows];
  const rules = resolveRowRules(
    rows.map((row) => row.source.box?.border),
    table.source.box?.border,
  );
  const section = (name: 'thead' | 'tbody' | 'tfoot', from: number, count: number): HtmlElement =>
    element(
      name,
      {},
      rows
        .slice(from, from + count)
        .map((row, index) => buildRow(row, rules[from + index] ?? NO_RULES, context)),
    );
  const header = table.header.length;
  const body = table.footerFrom;
  return element(
    'table',
    {
      class: CSS_CLASSES.table,
      style: boxCss(table.source.box),
      'data-openview-node': table.source.nodeId,
      ...keyAttribute(table.source.key, context),
    },
    [
      element(
        'colgroup',
        {},
        columnWidths(table.source.columns).map((width) =>
          element('col', { style: `width:${width}` }),
        ),
      ),
      section('thead', 0, header),
      section('tbody', header, body),
      section('tfoot', header + body, table.rows.length - body),
    ],
  );
}

function buildGrid(grid: GridFragment, context: PaintContext): HtmlElement {
  const source = grid.source;
  return element(
    'div',
    {
      class: CSS_CLASSES.grid,
      style: gridCss(source.columns, source.rows, source.step, source.box),
      'data-openview-node': source.nodeId,
      ...keyAttribute(source.key, context),
    },
    source.items.map((item) =>
      element(
        'div',
        {
          class: CSS_CLASSES.gridItem,
          style: gridItemCss(item.row, item.column, item.rowSpan, item.columnSpan),
          'data-openview-grid-item': item.content.nodeId,
        },
        [buildFragment(wholeFragment(item.content), context)],
      ),
    ),
  );
}

/**
 * Builds an HTML DOM tree element for a materialized fragment.
 */
export function buildFragment(fragment: MaterialFragment, context: PaintContext): HtmlElement {
  return visitFragment<HtmlElement>(fragment, {
    text: (text) =>
      element(
        'div',
        {
          class: CSS_CLASSES.text,
          style: textCss(text.source.align, text.source.box),
          'data-openview-node': text.source.nodeId,
          ...keyAttribute(text.source.key, context),
        },
        text.runs.map((run, index) => buildRun(run, index, context)),
      ),
    /* The wrapper carries the box so that `width: 100%` on the image means the content width of
       its parent, which is what an image with no declared size is entitled to. */
    image: (image) =>
      element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(image.source.box),
          'data-openview-node': image.source.nodeId,
          ...keyAttribute(image.source.key, context),
        },
        [
          element('img', {
            class: CSS_CLASSES.image,
            src: image.source.src,
            alt: image.source.alt,
          }),
        ],
      ),
    container: (container) =>
      element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(container.source.box),
          'data-openview-node': container.source.nodeId,
          ...keyAttribute(container.source.key, context),
        },
        container.children.map((child) => buildFragment(child, context)),
      ),
    table: (table) => buildTable(table, context),
    grid: (grid) => buildGrid(grid, context),
  });
}

/** Computes a unique signature string for typography properties affecting digit advances. */
export function typographySignature(typography: ResolvedTypography): string {
  const face = typography.face;
  return [face.cssFamily, String(typography.sizePt), String(face.weight), face.style].join(' ');
}
