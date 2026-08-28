import { assertCoveredText } from '../document/fonts/index.js';
import { type MarkerWriting, sampleMarker } from '../document/presentation.js';
import { walkDocument } from '../document/traverse.js';
import type {
  MaterialDocument,
  MaterialPageFieldRun,
  ResolvedTypography,
} from '../document/types.js';
import { refusal } from '../errors.js';
import { typographySignature } from '../html/build.js';
import { runCss } from '../html/css.js';
import { digitsOf } from './progress.js';
import type { MarkerReserve } from './types.js';

const UNMEASURED =
  'A page marker asks for a shape the width probe never measured, so no width can be reserved for it.';

/** Characters appearing in canonical number representations. */
export const CANONICAL_NUMBER_ALPHABET = '0123456789-+.e';

/** Maximum character length for canonical number representation. */
export const CANONICAL_NUMBER_MAX_CHARS = 25;

/** Decimal digits 0 through 9 used for measurement probing. */
const DECIMAL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Upper bounds for page counts and report totals in a document. */
export interface MarkerBounds {
  /** Maximum page count bound. */
  readonly pages: number;
  /** Maximum cumulative report value bound. */
  readonly report: number;
}

/** Layout signature and sample envelopes for a dynamic marker shape. */
export interface MarkerSignature {
  readonly typography: ResolvedTypography;
  readonly css: string;
  /** Sample strings measured for this marker shape. */
  readonly samples: readonly string[];
  /** Multiplier applied to the widest sample measurement. */
  readonly repeat: number;
  /** Representative placeholder string for probe measurement layout. */
  readonly placeholder: string;
}

/** Maximum integer digit length for Double values. */
const MAX_DOUBLE_INTEGER_DIGITS = 309;

/** Computes the number of digits in the integer component of a number. */
function integerDigitsOf(magnitude: number): number {
  const absolute = Math.abs(magnitude);
  if (!(absolute >= 1)) {
    return 1;
  }
  return Math.min(Math.floor(Math.log10(absolute)) + 1, MAX_DOUBLE_INTEGER_DIGITS);
}

function repdigit(digit: number, length: number): number {
  return Number(String(digit).repeat(length));
}

function repfraction(digit: number, integers: number, fraction: number): number {
  const spelt = String(digit);
  return Number(`${spelt.repeat(integers)}.${spelt.repeat(fraction)}`);
}

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

function counterEnvelope(writing: MarkerWriting, pages: number): readonly string[] {
  const length = digitsOf(pages);
  return written([0, pages, ...DECIMAL_DIGITS.map((digit) => repdigit(digit, length))], writing);
}

function reportEnvelope(writing: MarkerWriting, magnitude: number): readonly string[] {
  const integers = integerDigitsOf(magnitude) + 1;
  const fraction = writing.presentation.maxFractionDigits;
  const extremes = DECIMAL_DIGITS.flatMap((digit) => {
    const value = repfraction(digit, integers, fraction);
    return [value, -value];
  });
  return written([0, magnitude, -magnitude, ...extremes], writing);
}

function longestOf(samples: readonly string[]): string {
  let longest = '';
  for (const sample of samples) {
    if (sample.length > longest.length) {
      longest = sample;
    }
  }
  return longest;
}

function signatureOf(run: MaterialPageFieldRun, bounds: MarkerBounds): MarkerSignature {
  const shared = { typography: run.typography, css: runCss(run.typography) };
  const writing = run.writing;
  if (writing === undefined) {
    const canonical = run.field === 'report';
    const samples = canonical ? [...CANONICAL_NUMBER_ALPHABET] : DECIMAL_DIGITS.map(String);
    const repeat = canonical ? CANONICAL_NUMBER_MAX_CHARS : digitsOf(bounds.pages);
    for (const sample of samples) {
      assertCoveredText(sample, run.typography.face, run.site);
    }
    return { ...shared, samples, repeat, placeholder: '0'.repeat(repeat) };
  }
  const samples =
    run.field === 'report'
      ? reportEnvelope(writing, bounds.report)
      : counterEnvelope(writing, bounds.pages);
  for (const sample of samples) {
    assertCoveredText(sample, run.typography.face, run.site);
  }
  return { ...shared, samples, repeat: 1, placeholder: longestOf(samples) };
}

/** Computes a unique signature key identifying a marker shape and formatting configuration. */
export function markerSignature(run: MaterialPageFieldRun): string {
  const writing = run.writing;
  if (writing === undefined) {
    return `${typographySignature(run.typography)} ${run.field === 'report' ? 'report' : 'count'}`;
  }
  const scale = run.field === 'report' ? `${run.decimals}:${run.mode}` : 'count';
  return `${typographySignature(run.typography)} ${writing.kind}:${writing.id}:${scale}`;
}

/** Collects distinct marker signatures present in a materialized document. */
export function markerSignatures(
  document: MaterialDocument,
  bounds: MarkerBounds,
): ReadonlyMap<string, MarkerSignature> {
  const found = new Map<string, MarkerSignature>();
  for (const block of walkDocument(document)) {
    if (block.kind !== 'text') {
      continue;
    }
    for (const run of block.runs) {
      if (run.kind !== 'pageField') {
        continue;
      }
      const key = markerSignature(run);
      if (!found.has(key)) {
        found.set(key, signatureOf(run, bounds));
      }
    }
  }
  return found;
}

/**
 * Builds a marker reserve mapping from measured signature widths.
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

/** Empty marker reserve for documents without page counters or reports. */
export const NO_MARKERS: MarkerReserve = markerReserve(new Map(), new Map());
