import {
  type DecimalPresentationFormat,
  formatDate,
  formatDecimal,
  formatMoney,
  kindOf,
  type NumericPresentationFormat,
  type Presentation,
  type PresentationFormat,
  type PresentationRefusal,
  type PresentationTable,
  resolvePresentation,
  valueTypeOf,
} from '@openview/core';
import { type DocumentRenderErrorDetails, refusal } from '../errors.js';

const UNSELECTED_PROFILE =
  'A site of this template asks for a writing profile the caller did not select. Every profile a reachable site names is mapped to a declared writing in the engine options; the profile itself is deliberately not repeated here.';

const UNUSABLE_WRITING =
  'The writing selected for a site of this template could not be honoured. Read `details.presentationRefusal` for the cause the resolver named; the profile, the writing and the value are deliberately not repeated.';

const REPORT_SCALE =
  'The writing selected for a page report allows a different number of fraction digits than the rounding that report declares, so the formatter would round the figure a second time. Read `details.limit` for the number of digits the marker asked for.';

const NOT_A_NUMBER =
  'A site of this template writes an amount or a quantity, and its formula produced something other than a finite number. Read `details.actualType` for what arrived and `details.formatKind` for what the site asked for; the value itself is deliberately not repeated.';

const NOT_A_CIVIL_DATE =
  'A site of this template writes a date, and its formula produced something other than a civil date. A date is the `YYYY-MM-DD` form on the proleptic Gregorian calendar; `details.actualType` names what arrived, and the value itself is deliberately not repeated.';

const UNWRITTEN =
  'A formatter returned no characters for a site of this template. A blank left in a printed position is more dangerous than a refusal, so the render stops here.';

/**
 * One writing a render resolved, with the identity a reserve signature distinguishes it by.
 *
 * The id is opaque and local to one render: it separates two writings in a signature without
 * putting a writing key, or the name the caller chose for it, anywhere a log could reach.
 */
export interface ResolvedWriting {
  /** The canonical writing the resolver returned. Never an object assembled here. */
  readonly presentation: Presentation;
  readonly id: string;
}

/** The writing one page marker prints with: the function it names, and the writing it resolved. */
export interface MarkerWriting extends ResolvedWriting {
  readonly kind: NumericPresentationFormat['kind'];
}

/** How the caller maps the profiles a template names to the writings that template declares. */
export type PresentationSelection = Readonly<Record<string, string>>;

/**
 * The writings of one render: resolved on first use, and once per writing key.
 *
 * Local to a render by construction -- created beside the evaluation budget and never exported --
 * so two renders of one template under two selections cannot share a resolution. Lazy on purpose:
 * a false condition, an empty loop or a band no page reaches names no profile, so a template can
 * declare a site the caller selected nothing for and still render.
 */
export interface PresentationSession {
  /** The writing a binding site asks for, cached by the key its profile selected. */
  resolve(format: PresentationFormat, details: DocumentRenderErrorDetails): ResolvedWriting;
  /** The writing a page counter asks for. A counter writes a whole number of pages and nothing else. */
  resolveCounter(
    format: DecimalPresentationFormat,
    details: DocumentRenderErrorDetails,
  ): MarkerWriting;
  /**
   * The writing a page report asks for, checked against the rounding the marker declared.
   *
   * @param decimals the rounding position the marker carries, which the writing has to match
   */
  resolveReport(
    format: NumericPresentationFormat,
    decimals: number,
    details: DocumentRenderErrorDetails,
  ): MarkerWriting;
  /** How many writings this render has resolved so far. Read by tests, never by the pipeline. */
  readonly resolved: number;
}

/**
 * How many fraction digits a report rounded at this position can reach.
 *
 * A negative position rounds to tens or hundreds, so the rounded figure has no fraction at all.
 */
export function reportFractionDigits(decimals: number): number {
  return Math.max(decimals, 0);
}

/**
 * Writes one evaluated value at the writing its site declared, or refuses.
 *
 * The guard comes before the formatter and is closed on the three functions: no number is read out
 * of a string, no date is built from an instant, and nothing is inferred from the value's own type.
 */
export function writeValue(
  format: PresentationFormat,
  writing: Presentation,
  value: unknown,
  details: DocumentRenderErrorDetails,
): string {
  const located = { ...details, formatKind: format.kind };
  switch (format.kind) {
    case 'money':
      return written(formatMoney(numberAt(value, located), writing), located);
    case 'decimal':
      return written(formatDecimal(numberAt(value, located), writing), located);
    case 'date':
      return written(formatDate(civilDateAt(value, located), writing), located);
    default: {
      const exhaustive: never = format.kind;
      throw new TypeError(`Unhandled presentation format: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/**
 * The characters one marker writing produces for a value, or nothing when it produces none.
 *
 * The single dispatch of the two numeric formatters, shared by the paint and by the width probe, so
 * a reserve is measured on the strings the print really writes.
 */
export function sampleMarker(writing: MarkerWriting, value: number): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return writing.kind === 'money'
    ? formatMoney(value, writing.presentation)
    : formatDecimal(value, writing.presentation);
}

/**
 * Writes a page marker's value at the writing it resolved, or refuses.
 *
 * The value arrives already rounded when the marker declared a rounding: this function never
 * rounds, and `Intl` is never handed a rounding mode of its own.
 */
export function writeMarker(
  writing: MarkerWriting,
  value: number,
  details: DocumentRenderErrorDetails,
): string {
  const located = { ...details, formatKind: writing.kind };
  return written(sampleMarker(writing, numberAt(value, located)), located);
}

function numberAt(value: unknown, details: DocumentRenderErrorDetails): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  throw refusal(NOT_A_NUMBER, 'unformattable-binding-value', {
    ...details,
    actualType: valueTypeOf(value),
  });
}

function civilDateAt(value: unknown, details: DocumentRenderErrorDetails): string {
  if (typeof value === 'string') {
    return value;
  }
  throw refusal(NOT_A_CIVIL_DATE, 'unformattable-binding-value', {
    ...details,
    actualType: valueTypeOf(value),
  });
}

/** The characters a formatter produced, or a refusal: a formatted site is never left blank. */
function written(text: string | undefined, details: DocumentRenderErrorDetails): string {
  if (text === undefined) {
    throw refusal(UNWRITTEN, 'unformattable-binding-value', details);
  }
  return text;
}

function refuseRefusal(cause: PresentationRefusal, details: DocumentRenderErrorDetails): never {
  throw refusal(UNUSABLE_WRITING, 'presentation-refused', {
    ...details,
    presentationRefusal: cause,
  });
}

/**
 * Opens the writings of one render.
 *
 * `Object.hasOwn` guards both tables: a profile named `constructor` reaches nothing unless the
 * caller really declared it, and a key of that name really declared stays usable.
 */
export function createPresentationSession(
  presentations: PresentationTable | undefined,
  selection: PresentationSelection | undefined,
): PresentationSession {
  /* Keyed by the writing the profile selected, not by the profile: two profiles pointing at one
     writing share one resolution, which is what makes the reserve signatures agree with the paint. */
  const cache = new Map<string, ResolvedWriting>();

  const keyOf = (format: PresentationFormat, details: DocumentRenderErrorDetails): string => {
    const key =
      selection !== undefined && Object.hasOwn(selection, format.profile)
        ? selection[format.profile]
        : undefined;
    if (key === undefined) {
      throw refusal(UNSELECTED_PROFILE, 'presentation-refused', {
        ...details,
        formatKind: format.kind,
      });
    }
    return key;
  };

  const resolve = (
    format: PresentationFormat,
    details: DocumentRenderErrorDetails,
  ): ResolvedWriting => {
    const key = keyOf(format, details);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const resolution = resolvePresentation(presentations, key);
    if (!resolution.ok) {
      refuseRefusal(resolution.refusal, { ...details, formatKind: format.kind });
    }
    const found: ResolvedWriting = {
      presentation: resolution.writing,
      id: `w${cache.size + 1}`,
    };
    cache.set(key, found);
    return found;
  };

  return {
    resolve,
    resolveCounter: (format, details) => ({ ...resolve(format, details), kind: format.kind }),
    resolveReport: (format, decimals, details) => {
      const found = resolve(format, details);
      const asked = reportFractionDigits(decimals);
      /* Refused rather than corrected: a writing allowing fewer digits would round the figure a
         second time, and one allowing more would print digits the declared rounding removed. */
      if (found.presentation.maxFractionDigits !== asked) {
        throw refusal(REPORT_SCALE, 'presentation-refused', {
          ...details,
          formatKind: format.kind,
          limit: asked,
        });
      }
      return { ...found, kind: format.kind };
    },
    get resolved(): number {
      return cache.size;
    },
  };
}
