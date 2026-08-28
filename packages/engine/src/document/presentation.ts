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

/** Resolved presentation writing paired with a render-unique identifier. */
export interface ResolvedWriting {
  readonly presentation: Presentation;
  readonly id: string;
}

/** Formatter kind and resolved writing for a page marker. */
export interface MarkerWriting extends ResolvedWriting {
  readonly kind: NumericPresentationFormat['kind'];
}

/** Mapping from template presentation profile names to declared writing keys. */
export type PresentationSelection = Readonly<Record<string, string>>;

/**
 * Session managing lazy resolution and caching of presentation formats for a single render.
 */
export interface PresentationSession {
  /** Resolves and caches the presentation writing for a binding site. */
  resolve(format: PresentationFormat, details: DocumentRenderErrorDetails): ResolvedWriting;
  /** Resolves the presentation writing for a page counter. */
  resolveCounter(
    format: DecimalPresentationFormat,
    details: DocumentRenderErrorDetails,
  ): MarkerWriting;
  /** Resolves the presentation writing for a page report, validating fraction digit alignment. */
  resolveReport(
    format: NumericPresentationFormat,
    decimals: number,
    details: DocumentRenderErrorDetails,
  ): MarkerWriting;
  /** Total number of resolved presentation formats in this session. */
  readonly resolved: number;
}

/** Returns the maximum fraction digits allowed for a report decimal position. */
export function reportFractionDigits(decimals: number): number {
  return Math.max(decimals, 0);
}

/**
 * Formats an evaluated value according to the given presentation writing.
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

/** Formats a numeric marker sample value without raising errors on non-finite input. */
export function sampleMarker(writing: MarkerWriting, value: number): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return writing.kind === 'money'
    ? formatMoney(value, writing.presentation)
    : formatDecimal(value, writing.presentation);
}

/** Formats a page marker value using its resolved writing. */
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
 * Creates a presentation session scoped to a single render execution.
 */
export function createPresentationSession(
  presentations: PresentationTable | undefined,
  selection: PresentationSelection | undefined,
): PresentationSession {
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
