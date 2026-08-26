import { kindOf } from '@openview/core';
import type {
  MaterialBlock,
  MaterialDocument,
  MaterialPageFieldRun,
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
 * Every character the canonical writing of a finite number can use.
 *
 * `String(value)` on a finite double produces digits, an optional sign, a decimal point and, past
 * the two thresholds where the notation switches, `e` with its own sign. Nothing else appears --
 * no separator, no symbol, no space -- because the writing is canonical and not localised.
 */
export const CANONICAL_NUMBER_ALPHABET = '0123456789-+.e';

/**
 * The longest canonical writing of a finite number, in characters.
 *
 * MEASURED, and exactly tight rather than generous: `-0.0000012345678901234567` reaches it -- a
 * sign, `0.`, the five zeros the decimal notation still allows, and seventeen significant digits.
 * A localised writing is a different alphabet and a different bound.
 */
export const CANONICAL_NUMBER_MAX_CHARS = 25;

/** The widest glyph of one typography, in the two alphabets a marker draws from. */
export interface GlyphWidths {
  /** Widest decimal digit, which bounds a page counter. */
  readonly digit: number;
  /** Widest character of the canonical alphabet, which bounds a page report. */
  readonly canonical: number;
}

/**
 * The width every marker reserves, from the widest glyph its own alphabet can draw.
 *
 * A footer that goes from `9` to `10` must not move the cut that decides how many pages there are,
 * and a report that goes from `0` to `-1234.56` must not either. Reserving the widest value the
 * marker could ever reach makes its geometry independent of the value it ends up showing, which is
 * what breaks that circle without a fixed-point search.
 *
 * A counter and a report take different bounds: a counter writes at most `digits` digits, a report
 * writes at most {@link CANONICAL_NUMBER_MAX_CHARS} characters of a wider alphabet.
 */
export function markerReserve(
  digits: number,
  widest: ReadonlyMap<string, GlyphWidths>,
): MarkerReserve {
  const glyphs = (typography: ResolvedTypography): GlyphWidths => {
    const found = widest.get(typographySignature(typography));
    if (found === undefined) {
      throw refusal(UNMEASURED, 'layout-measurement-failed');
    }
    return found;
  };
  return {
    digits,
    widthOf(run: MaterialPageFieldRun): number {
      const found = glyphs(run.typography);
      return run.field === 'report'
        ? found.canonical * CANONICAL_NUMBER_MAX_CHARS
        : found.digit * digits;
    },
  };
}

/** A reserve for a document with no marker at all, which never has to answer a width. */
export const NO_MARKERS: MarkerReserve = markerReserve(1, new Map());
