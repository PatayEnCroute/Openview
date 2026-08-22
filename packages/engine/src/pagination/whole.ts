import { kindOf } from '@openview/core';
import type { MaterialBlock, MaterialRow } from '../document/types.js';
import type { MaterialFragment, RowFragment, TextCursor } from './types.js';

const START: TextCursor = { run: 0, offset: 0 };

/** One page holds the whole row, so every cell paints all of its own flow. */
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
 * The fragment of a block that was never cut.
 *
 * Everything painted on a page is a fragment, including what fits entirely: one shape means the
 * html builder has a single path, and a whole box and a cut box cannot drift apart.
 */
export function wholeFragment(block: MaterialBlock): MaterialFragment {
  switch (block.kind) {
    case 'text': {
      const last = block.runs.length - 1;
      const end = block.runs[last];
      return {
        kind: 'text',
        source: block,
        runs: block.runs,
        from: START,
        to:
          end === undefined
            ? START
            : { run: last, offset: end.kind === 'text' ? end.text.length : 1 },
        edge: 'whole',
      };
    }
    case 'image':
      return { kind: 'image', source: block };
    case 'container':
      return {
        kind: 'container',
        source: block,
        children: block.children.map(wholeFragment),
        edge: 'whole',
      };
    case 'table':
      return {
        kind: 'table',
        source: block,
        header: block.header.map(wholeRow),
        rows: [...block.body, ...block.footer].map(wholeRow),
        footerFrom: block.body.length,
        includesFooterEnd: true,
        edge: 'whole',
      };
    default: {
      const exhaustive: never = block;
      throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}
