import { kindOf } from '@openview/core';
import { type MarkerWriting, sampleMarker } from '../document/presentation.js';
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
import { digitsOf } from './progress.js';
import type { MarkerReserve } from './types.js';

const UNMEASURED =
  'A page marker asks for a shape the width probe never measured, so no width can be reserved for it.';

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
 * A localised writing is a different alphabet and a different bound, so it is measured instead.
 */
export const CANONICAL_NUMBER_MAX_CHARS = 25;

/** The ten decimal digits, one sample of each: a proportional font draws them at ten widths. */
const DECIMAL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * What the values one document's markers can hold are bounded by, before any cut is chosen.
 *
 * Both bounds are computed from the materialised document alone, which is what lets a reserve be
 * decided once and stay valid through every repagination.
 */
export interface MarkerBounds {
  /** Highest page rank, and highest page count, this document can reach. */
  readonly pages: number;
  /** Highest absolute value any incoming page report of this document can reach. */
  readonly report: number;
}

/**
 * One marker shape a document paints, and the boxes whose width bounds it.
 *
 * A shape is a typography, a field and a writing together: two markers in one font but two
 * currencies do not share a bound, and a localised one does not share the canonical alphabet's.
 */
export interface MarkerSignature {
  readonly typography: ResolvedTypography;
  readonly css: string;
  /** The strings the probe measures for this shape, each in its own box. */
  readonly samples: readonly string[];
  /**
   * How many of the widest sample the reserve holds.
   *
   * One for a measured whole value. Greater only on the canonical path, where the samples are
   * single glyphs and kerning is off, so the sum of advances is the width of the value.
   */
  readonly repeat: number;
  /** What a probe shows in a marker of this shape, before the cuts decided its value. */
  readonly placeholder: string;
}

/** Integer digits of `Number.MAX_VALUE`: the widest a double can ever be asked to write. */
const MAX_DOUBLE_INTEGER_DIGITS = 309;

/**
 * How many digits the integer part of a magnitude writes.
 *
 * Not {@link digitsOf}: past the exponential threshold `String` writes `1e+300`, whose length says
 * nothing about the three hundred digits `Intl` prints in standard notation. Clamped, so a
 * saturated bound asks for a very wide reserve rather than for an unbounded string.
 */
function integerDigitsOf(magnitude: number): number {
  const absolute = Math.abs(magnitude);
  if (!(absolute >= 1)) {
    return 1;
  }
  return Math.min(Math.floor(Math.log10(absolute)) + 1, MAX_DOUBLE_INTEGER_DIGITS);
}

/** The whole number written with one digit repeated, which is the widest of its length. */
function repdigit(digit: number, length: number): number {
  return Number(String(digit).repeat(length));
}

/** The same, with a fractional part of the same digit: the widest form the writing allows. */
function repfraction(digit: number, integers: number, fraction: number): number {
  const spelt = String(digit);
  return Number(`${spelt.repeat(integers)}.${spelt.repeat(fraction)}`);
}

/** The samples a writing really produces, dropping the values it declines to write. */
function written(values: readonly number[], writing: MarkerWriting): readonly string[] {
  const found = new Set<string>();
  for (const value of values) {
    const text = sampleMarker(writing, value);
    if (text !== undefined) {
      found.add(text);
    }
  }
  return [...found];
}

/**
 * The samples that bound a written page counter: zero, the highest rank, and one run of each digit.
 *
 * A run of a single digit is the widest number of its length whatever the font, and the grouping a
 * locale inserts depends on the length alone -- so the longest run bounds every shorter value too.
 * No sign is sampled: a page rank is never negative.
 */
function counterEnvelope(writing: MarkerWriting, pages: number): readonly string[] {
  const length = digitsOf(pages);
  return written([0, pages, ...DECIMAL_DIGITS.map((digit) => repdigit(digit, length))], writing);
}

/**
 * The samples that bound a written page report: zero, both signs of the magnitude, and the extreme
 * fractional forms the writing allows.
 *
 * One integer digit past the magnitude, because rounding away from zero carries: a bound of 999.99
 * rounded at no decimals writes the four digits of 1000.
 */
function reportEnvelope(writing: MarkerWriting, magnitude: number): readonly string[] {
  const integers = integerDigitsOf(magnitude) + 1;
  const fraction = writing.presentation.maxFractionDigits;
  const extremes = DECIMAL_DIGITS.flatMap((digit) => {
    const value = repfraction(digit, integers, fraction);
    return [value, -value];
  });
  return written([0, magnitude, -magnitude, ...extremes], writing);
}

/** The longest of the samples: any of them fits the reserve, so length is a free tie-break. */
function longestOf(samples: readonly string[]): string {
  let longest = '';
  for (const sample of samples) {
    if (sample.length > longest.length) {
      longest = sample;
    }
  }
  return longest;
}

/** The shape one marker run paints in, with the samples that bound its width. */
function signatureOf(run: MaterialPageFieldRun, bounds: MarkerBounds): MarkerSignature {
  const shared = { typography: run.typography, css: runCss(run.typography) };
  const writing = run.writing;
  if (writing === undefined) {
    /* The canonical path, unchanged: a counter draws digits alone, and `String` on a report may
       also draw a sign, a point and an exponent, none of which a digit bounds. */
    const canonical = run.field === 'report';
    const samples = canonical ? [...CANONICAL_NUMBER_ALPHABET] : DECIMAL_DIGITS.map(String);
    const repeat = canonical ? CANONICAL_NUMBER_MAX_CHARS : digitsOf(bounds.pages);
    return { ...shared, samples, repeat, placeholder: '0'.repeat(repeat) };
  }
  const samples =
    run.field === 'report'
      ? reportEnvelope(writing, bounds.report)
      : counterEnvelope(writing, bounds.pages);
  return { ...shared, samples, repeat: 1, placeholder: longestOf(samples) };
}

/**
 * The key one marker shape is filed under.
 *
 * The writing enters it through the opaque id the session handed out, never through its key or the
 * profile that selected it: two markers of two currencies must not share a bound, and no name the
 * caller chose belongs in a signature a diagnostic could carry.
 */
export function markerSignature(run: MaterialPageFieldRun): string {
  const writing = run.writing;
  if (writing === undefined) {
    return `${typographySignature(run.typography)} ${run.field === 'report' ? 'report' : 'count'}`;
  }
  const scale = run.field === 'report' ? `${run.decimals}:${run.mode}` : 'count';
  return `${typographySignature(run.typography)} ${writing.kind}:${writing.id}:${scale}`;
}

function collectRows(rows: readonly MaterialRow[], into: Collector): void {
  for (const row of rows) {
    for (const cell of row.cells) {
      collectBlocks(cell.children, into);
    }
  }
}

interface Collector {
  readonly found: Map<string, MarkerSignature>;
  readonly bounds: MarkerBounds;
}

function collectBlocks(blocks: readonly MaterialBlock[], into: Collector): void {
  for (const block of blocks) {
    switch (block.kind) {
      case 'text':
        for (const run of block.runs) {
          if (run.kind === 'pageField') {
            const key = markerSignature(run);
            if (!into.found.has(key)) {
              into.found.set(key, signatureOf(run, into.bounds));
            }
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
      case 'grid':
        for (const item of block.items) {
          collectBlocks([item.content], into);
        }
        break;
      default: {
        const exhaustive: never = block;
        throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
      }
    }
  }
}

/** Every distinct shape a page marker of this document is painted in. */
export function markerSignatures(
  document: MaterialDocument,
  bounds: MarkerBounds,
): ReadonlyMap<string, MarkerSignature> {
  const into: Collector = { found: new Map<string, MarkerSignature>(), bounds };
  for (const layer of document.backgroundLayers) {
    collectBlocks([layer.content], into);
  }
  for (const band of document.headerBands) {
    collectBlocks([band.content], into);
  }
  collectBlocks(document.root, into);
  for (const band of document.footerBands) {
    collectBlocks([band.content], into);
  }
  for (const layer of document.foregroundLayers) {
    collectBlocks([layer.content], into);
  }
  return into.found;
}

/**
 * The width every marker shape reserves, from the widths the probe measured for its samples.
 *
 * The widest sample decides, times the number of samples a value is made of -- one, once the whole
 * value was measured. A shape the probe never answered for is a refusal, never a zero.
 */
export function markerReserve(
  signatures: ReadonlyMap<string, MarkerSignature>,
  widest: ReadonlyMap<string, number>,
): MarkerReserve {
  const shapeOf = (run: MaterialPageFieldRun): MarkerSignature => {
    const key = markerSignature(run);
    const found = signatures.get(key);
    if (found === undefined) {
      throw refusal(UNMEASURED, 'layout-measurement-failed');
    }
    return found;
  };
  return {
    widthOf(run: MaterialPageFieldRun): number {
      const key = markerSignature(run);
      const measured = widest.get(key);
      if (measured === undefined) {
        throw refusal(UNMEASURED, 'layout-measurement-failed');
      }
      return measured * shapeOf(run).repeat;
    },
    placeholderOf(run: MaterialPageFieldRun): string {
      return shapeOf(run).placeholder;
    },
  };
}

/** A reserve for a document with no marker at all, which never has to answer a width. */
export const NO_MARKERS: MarkerReserve = markerReserve(new Map(), new Map());
