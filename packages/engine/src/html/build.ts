import { type BoxBorder, kindOf, roundDecimal } from '@openview/core';
import type { MaterialPageFieldRun, MaterialRun, ResolvedTypography } from '../document/types.js';
import { CANONICAL_NUMBER_MAX_CHARS } from '../pagination/markers.js';
import type {
  CellFragment,
  GridFragment,
  MarkerReserve,
  MaterialFragment,
  RowFragment,
  TableFragment,
} from '../pagination/types.js';
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

/** What the cuts decided about the page being painted, which is all a marker can print. */
export interface PageValues {
  readonly number: number;
  readonly count: number;
  /** Unrounded sum the rows finished on earlier pages carry in; each marker rounds it itself. */
  readonly report: number;
}

/**
 * What a paint pass needs beyond the fragments: the reserved marker widths, the page values when
 * they exist, and whether occurrence keys are annotated.
 *
 * Keys belong to a probe alone. Two fragments of one block share their source key, so annotating
 * them on a paginated document would file two boxes under one name.
 */
export interface PaintContext {
  readonly markers: MarkerReserve;
  /** `undefined` on a probe, which shows a placeholder of the reserved width instead. */
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

/**
 * Computes rendered text for a page marker, using digit placeholders during measurement.
 */
function markerText(run: MaterialPageFieldRun, context: PaintContext): string {
  const page = context.page;
  if (page === undefined) {
    return '0'.repeat(run.field === 'report' ? CANONICAL_NUMBER_MAX_CHARS : context.markers.digits);
  }
  switch (run.field) {
    case 'number':
      return String(page.number);
    case 'count':
      return String(page.count);
    case 'report':
      return String(roundDecimal(page.report, run.decimals, run.mode));
    default: {
      const exhaustive: never = run;
      throw new TypeError(`Unhandled page marker: ${kindOf(exhaustive, 'field')}`);
    }
  }
}

/**
 * One run: a span of bound characters, or a page marker in a box of the reserved width.
 *
 * The marker box is as wide as the widest value the document could ever show, so the digits that
 * land in it cannot move a line break and cannot change where the page was cut.
 */
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
  /* Left and right belong to the row, so only its outermost cells may paint them; painting them on
     every cell would draw a rule on each column boundary the template never declared. */
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

/**
 * One fragment of a table: its declared header repeated in front, then the rows it carries.
 *
 * The rules are resolved on the sequence of this fragment alone. A boundary that used to sit
 * between two rows is a boundary with the page edge once they are on different sheets, so a shadow
 * computed before the cut is never carried over.
 */
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

/**
 * One grid: its tracks from validated numbers, one positioned wrapper per zone, and each zone's
 * container built whole -- a grid is atomic, so no zone is ever a partial fragment.
 *
 * The wrapper carries a closed attribute naming the zone's container, which is what the layout
 * session measures overflow against; no `overflow: hidden` hides an escape from it.
 */
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
 * One box per fragment. The element names come from the closed vocabulary and the attributes from
 * this function, so no value of the template can become markup.
 *
 * A cut box is painted closed: its background, its padding and its rules are repeated on every page
 * it spans, rather than left open behind a page edge.
 */
export function buildFragment(fragment: MaterialFragment, context: PaintContext): HtmlElement {
  switch (fragment.kind) {
    case 'text':
      return element(
        'div',
        {
          class: CSS_CLASSES.text,
          style: textCss(fragment.source.align, fragment.source.box),
          'data-openview-node': fragment.source.nodeId,
          ...keyAttribute(fragment.source.key, context),
        },
        fragment.runs.map((run, index) => buildRun(run, index, context)),
      );
    case 'image':
      /* The wrapper carries the box so that `width: 100%` on the image means the content width of
         its parent, which is what an image with no declared size is entitled to. */
      return element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(fragment.source.box),
          'data-openview-node': fragment.source.nodeId,
          ...keyAttribute(fragment.source.key, context),
        },
        [
          element('img', {
            class: CSS_CLASSES.image,
            src: fragment.source.src,
            alt: fragment.source.alt,
          }),
        ],
      );
    case 'container':
      return element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(fragment.source.box),
          'data-openview-node': fragment.source.nodeId,
          ...keyAttribute(fragment.source.key, context),
        },
        fragment.children.map((child) => buildFragment(child, context)),
      );
    case 'table':
      return buildTable(fragment, context);
    case 'grid':
      return buildGrid(fragment, context);
    default: {
      /* `kindOf` reads the discriminant and nothing else: a message must not be able to carry the
         text a block holds. */
      const exhaustive: never = fragment;
      throw new TypeError(`Unhandled fragment: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/** A typography signature: everything that changes the advance width of a digit. */
export function typographySignature(typography: ResolvedTypography): string {
  return [
    typography.family,
    String(typography.sizePt),
    typography.bold ? 'b' : 'n',
    typography.italic ? 'i' : 'n',
  ].join(' ');
}
