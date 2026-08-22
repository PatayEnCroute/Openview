import { kindOf } from '@openview/core';
import type {
  MaterialBlock,
  MaterialDocument,
  MaterialRow,
  ResolvedTypography,
} from '../document/types.js';
import { refusal } from '../errors.js';
import { typographySignature } from '../html/build.js';
import { runCss } from '../html/css.js';
import type { MarkerReserve } from './types.js';

const UNMEASURED =
  'A page marker asks for a typography the digit probe never measured, so no width can be reserved for it.';

/** One typography a marker uses, with the declarations the digit probe paints it under. */
export interface MarkerSignature {
  readonly typography: ResolvedTypography;
  readonly css: string;
}

function collectRows(rows: readonly MaterialRow[], into: Map<string, MarkerSignature>): void {
  for (const row of rows) {
    for (const cell of row.cells) {
      collectBlocks(cell.children, into);
    }
  }
}

function collectBlocks(blocks: readonly MaterialBlock[], into: Map<string, MarkerSignature>): void {
  for (const block of blocks) {
    switch (block.kind) {
      case 'text':
        for (const run of block.runs) {
          if (run.kind === 'pageField') {
            into.set(typographySignature(run.typography), {
              typography: run.typography,
              css: runCss(run.typography),
            });
          }
        }
        break;
      case 'image':
        break;
      case 'container':
        collectBlocks(block.children, into);
        break;
      case 'table':
        collectRows(block.header, into);
        collectRows(block.body, into);
        collectRows(block.footer, into);
        break;
      default: {
        const exhaustive: never = block;
        throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
      }
    }
  }
}

/** Every distinct typography a page marker of this document is painted in. */
export function markerSignatures(document: MaterialDocument): ReadonlyMap<string, MarkerSignature> {
  const found = new Map<string, MarkerSignature>();
  for (const band of document.headerBands) {
    collectBlocks([band.content], found);
  }
  collectBlocks(document.root, found);
  for (const band of document.footerBands) {
    collectBlocks([band.content], found);
  }
  return found;
}

/**
 * The width every marker of a typography reserves, from the widest digit that typography draws.
 *
 * A footer that goes from `9` to `10` must not move the cut that decides how many pages there are.
 * Reserving the widest value the document could reach makes the geometry of a marker independent of
 * the value it ends up showing, which is what breaks that circle without a fixed-point search.
 */
export function markerReserve(digits: number, widest: ReadonlyMap<string, number>): MarkerReserve {
  return {
    digits,
    widthOf(typography: ResolvedTypography): number {
      const width = widest.get(typographySignature(typography));
      if (width === undefined) {
        throw refusal(UNMEASURED, 'layout-measurement-failed');
      }
      return width * digits;
    },
  };
}

/** A reserve for a document with no marker at all, which never has to answer a width. */
export const NO_MARKERS: MarkerReserve = markerReserve(1, new Map());
