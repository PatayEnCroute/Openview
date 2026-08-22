import { type BoxBorder, kindOf } from '@openview/core';
import type {
  MaterialBlock,
  MaterialCell,
  MaterialDocument,
  MaterialRow,
  MaterialTable,
} from '../document/types.js';
import type { DocumentRegion } from '../errors.js';
import { boxCss, CSS_CLASSES, columnWidths, documentCss, runCss, textCss } from './css.js';
import { type RowRules, resolveRowRules } from './table-rules.js';
import type { HtmlAttributes, HtmlElement, HtmlElementName, HtmlNode, HtmlTree } from './types.js';

const NO_RULES: RowRules = { top: undefined, right: undefined, bottom: undefined, left: undefined };

const element = (
  name: HtmlElementName,
  attributes: HtmlAttributes,
  children: readonly HtmlNode[] = [],
): HtmlElement => ({ kind: 'element', name, attributes, children });

const characters = (text: string): HtmlNode => ({ kind: 'text', text });

function buildCell(
  cell: MaterialCell,
  row: MaterialRow,
  rules: RowRules,
  index: number,
  columns: number,
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
    { class: CSS_CLASSES.cell, style: boxCss(row.box, edges) },
    cell.children.map(buildBlock),
  );
}

function buildRow(row: MaterialRow, rules: RowRules): HtmlElement {
  return element(
    'tr',
    { 'data-openview-node': row.nodeId },
    row.cells.map((cell, index) => buildCell(cell, row, rules, index, row.cells.length)),
  );
}

function buildTable(table: MaterialTable): HtmlElement {
  /* One ordered sequence across the three sections: the boundary between the last header row and
     the first body row is a boundary like any other. */
  const rows = [...table.header, ...table.body, ...table.footer];
  const rules = resolveRowRules(
    rows.map((row) => row.box?.border),
    table.box?.border,
  );
  const section = (name: 'thead' | 'tbody' | 'tfoot', from: number, count: number): HtmlElement =>
    element(
      name,
      {},
      rows
        .slice(from, from + count)
        .map((row, index) => buildRow(row, rules[from + index] ?? NO_RULES)),
    );
  const headerCount = table.header.length;
  const bodyCount = table.body.length;
  return element(
    'table',
    {
      class: CSS_CLASSES.table,
      style: boxCss(table.box),
      'data-openview-node': table.nodeId,
    },
    [
      element(
        'colgroup',
        {},
        columnWidths(table.columns).map((width) => element('col', { style: `width:${width}` })),
      ),
      section('thead', 0, headerCount),
      section('tbody', headerCount, bodyCount),
      section('tfoot', headerCount + bodyCount, table.footer.length),
    ],
  );
}

/**
 * One box per materialised block. The element names come from the closed vocabulary and the
 * attributes from this function, so no value of the template can become markup.
 */
function buildBlock(block: MaterialBlock): HtmlElement {
  switch (block.kind) {
    case 'text':
      return element(
        'div',
        {
          class: CSS_CLASSES.text,
          style: textCss(block.align, block.box),
          'data-openview-node': block.nodeId,
        },
        block.runs.map((run) =>
          element('span', { style: runCss(run.typography) }, [characters(run.text)]),
        ),
      );
    case 'image':
      /* The wrapper carries the box so that `width: 100%` on the image means the content width of
         its parent, which is what an image with no declared size is entitled to. */
      return element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(block.box),
          'data-openview-node': block.nodeId,
        },
        [element('img', { class: CSS_CLASSES.image, src: block.src, alt: block.alt })],
      );
    case 'container':
      return element(
        'div',
        {
          class: CSS_CLASSES.container,
          style: boxCss(block.box),
          'data-openview-node': block.nodeId,
        },
        block.children.map(buildBlock),
      );
    case 'table':
      return buildTable(block);
    default: {
      /* `kindOf` reads the discriminant and nothing else: a message must not be able to carry the
         text a block holds. */
      const exhaustive: never = block;
      throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

function buildRegion(
  blocks: readonly MaterialBlock[],
  region: DocumentRegion,
  className: string,
): HtmlElement {
  return element(
    'div',
    { class: className, 'data-openview-region': region },
    blocks.map(buildBlock),
  );
}

/**
 * Builds the sheet, its printable area and the three vertical regions.
 *
 * The regions are emitted even when empty: the adapter measures them by selector, and a missing box
 * would make an absent band indistinguishable from an unmeasured one.
 */
export function buildHtmlTree(document: MaterialDocument): HtmlTree {
  return {
    css: documentCss(document),
    body: [
      element('div', { class: CSS_CLASSES.page }, [
        element('div', { class: CSS_CLASSES.printable }, [
          buildRegion(document.header, 'header', CSS_CLASSES.band),
          buildRegion(document.root, 'root', CSS_CLASSES.flow),
          buildRegion(document.footer, 'footer', CSS_CLASSES.band),
        ]),
      ]),
    ],
  };
}
