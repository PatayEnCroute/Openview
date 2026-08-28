import { visitBlock } from '../document/traverse.js';
import type { MaterialBlock, MaterialRow } from '../document/types.js';
import type { MaterialFragment, RowFragment, TextCursor } from './types.js';

const START: TextCursor = { run: 0, offset: 0 };

/** Constructs an uncut whole RowFragment from a materialized table row. */
export function wholeRow(row: MaterialRow): RowFragment {
  return {
    source: row,
    edge: 'whole',
    cells: row.cells.map((cell) => ({
      source: cell,
      children: cell.children.map(wholeFragment),
    })),
  };
}

/**
 * Constructs an uncut whole MaterialFragment from a materialized block.
 */
export function wholeFragment(block: MaterialBlock): MaterialFragment {
  return visitBlock<MaterialFragment>(block, {
    text: (text) => {
      const last = text.runs.length - 1;
      const end = text.runs[last];
      return {
        kind: 'text',
        source: text,
        runs: text.runs,
        from: START,
        to:
          end === undefined
            ? START
            : { run: last, offset: end.kind === 'text' ? end.text.length : 1 },
        edge: 'whole',
      };
    },
    image: (image) => ({ kind: 'image', source: image }),
    grid: (grid) => ({ kind: 'grid', source: grid }),
    container: (container) => ({
      kind: 'container',
      source: container,
      children: container.children.map(wholeFragment),
      edge: 'whole',
    }),
    table: (table) => ({
      kind: 'table',
      source: table,
      header: table.header.map(wholeRow),
      rows: [...table.body, ...table.footer].map(wholeRow),
      footerFrom: table.body.length,
      includesFooterEnd: true,
      edge: 'whole',
    }),
  });
}
