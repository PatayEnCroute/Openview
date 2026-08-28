import type { EvaluationScope, PageBandOccurrence, Template } from '@openview/core';
import { reachableOccurrences } from '../document/bands.js';
import { documentImages } from '../document/images.js';
import {
  extendBands,
  type MaterializedDocument,
  materializeDocument,
} from '../document/materialize.js';
import { DocumentRenderError, type DocumentRenderErrorCode } from '../errors.js';
import { buildMarkerProbe, buildPagedTree, buildProbeTree, sampleKey } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import {
  type MarkerBounds,
  markerReserve,
  markerSignatures,
  NO_MARKERS,
} from '../pagination/markers.js';
import { paginate } from '../pagination/paginate.js';
import { progressionBound } from '../pagination/progress.js';
import { reportMagnitudeBound } from '../pagination/reports.js';
import type { MarkerReserve, Metrics, PaginatedDocument } from '../pagination/types.js';
import { validateMeasurement } from '../pagination/validate-measurement.js';
import { verifyLayout } from '../pagination/verify.js';
import type {
  PdfRenderSession,
  PdfRenderStrategy,
  PdfSourceDocument,
  RenderEngineOptions,
} from '../strategy/pdf.js';
import { validateTemplate } from './validate.js';

const MEASURE_FAILED =
  'The layout session did not answer a measurement. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

const NOT_SETTLED =
  'The composed pages kept overflowing the height the browser gave them, so the engine stopped rather than print a sequence it could not prove. Read `details.pageNumber` for the last page involved.';

/** Maximum settle iteration rounds allowed to resolve page breaks without overflow. */
const MAX_SETTLE_ROUNDS = 8;

/** The band domains a document that turns out to hold one page can ever paint. */
export const ONE_PAGE_DOMAINS = reachableOccurrences(1);

async function measured<TResult>(run: () => Promise<TResult>): Promise<TResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      throw error;
    }
    throw new DocumentRenderError(
      MEASURE_FAILED,
      'layout-measurement-failed',
      {},
      { cause: error },
    );
  }
}

/**
 * Measures every shape a page marker of this document is painted in, and reserves its width.
 *
 * Both bounds come from the materialised document, so the reserve is decided BEFORE any cut and
 * does not move when the pages are recomposed: the highest rank the flow can reach, and the
 * saturated magnitude of the contributions the rows declared.
 */
async function reserveMarkers(
  session: PdfRenderSession,
  bound: MaterializedDocument,
): Promise<MarkerReserve> {
  const bounds: MarkerBounds = {
    pages: progressionBound(bound.document),
    report: reportMagnitudeBound(bound.document),
  };
  const signatures = markerSignatures(bound.document, bounds);
  if (signatures.size === 0) {
    return NO_MARKERS;
  }
  const probe = buildMarkerProbe(bound.document, signatures);
  const measurement = await measured(async () =>
    session.measure({
      html: serializeHtml(probe.tree),
      sheet: bound.document.sheet,
      images: [],
    }),
  );
  validateMeasurement(measurement, probe.keys, bound.document.sheet);
  const widths = new Map(measurement.boxes.map((box) => [box.key, box.width]));
  const widest = new Map<string, number>();
  for (const [signature, shape] of signatures) {
    let found = 0;
    for (const [at] of shape.samples.entries()) {
      found = Math.max(found, widths.get(sampleKey(signature, at)) ?? 0);
    }
    widest.set(signature, found);
  }
  return markerReserve(signatures, widest);
}

/** Lays the whole document out at its real width with no height constraint, and reads its boxes. */
async function measureNaturally(
  session: PdfRenderSession,
  bound: MaterializedDocument,
  markers: MarkerReserve,
): Promise<Metrics> {
  const probe = buildProbeTree(bound.document, markers);
  const measurement = await measured(async () =>
    session.measure({
      html: serializeHtml(probe.tree),
      sheet: bound.document.sheet,
      images: documentImages(bound.document),
    }),
  );
  return validateMeasurement(measurement, probe.keys, bound.document.sheet);
}

/**
 * The one composition of a render: the verified page sequence and the html it serialised to.
 *
 * The single source both façades read. The pdf port prints `source`; the pagination port projects
 * `paginated`. Nothing downstream recomposes, so an html a caller receives is byte for byte the
 * html the printer would have been handed.
 */
export interface ComposedDocument {
  readonly bound: MaterializedDocument;
  readonly paginated: PaginatedDocument;
  readonly source: PdfSourceDocument;
}

/** One settling round: the cuts it chose and the html those cuts serialised to. */
interface Attempt {
  readonly paginated: PaginatedDocument;
  readonly html: string;
}

/**
 * Iteratively measures and repaginates pages until layout converges without height overflow.
 */
async function settle(
  session: PdfRenderSession,
  bound: MaterializedDocument,
  markers: MarkerReserve,
  metrics: Metrics,
  printableHeight: number,
): Promise<Attempt> {
  const slack = new Map<number, number>();
  let last = 0;
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    const paginated = paginate(bound.document, {
      metrics,
      markers,
      printableHeight,
      slack,
    });
    const html = serializeHtml(buildPagedTree(paginated));
    const measurement = await measured(async () =>
      session.measure({
        html,
        sheet: paginated.sheet,
        images: documentImages(bound.document),
      }),
    );
    const overflow = verifyLayout(paginated, measurement, metrics.pxPerMm);
    if (overflow === undefined) {
      return { paginated, html };
    }
    last = overflow.pageNumber;
    slack.set(overflow.pageNumber, (slack.get(overflow.pageNumber) ?? 0) + overflow.excess);
  }
  throw new DocumentRenderError(NOT_SETTLED, 'pagination-impossible', { pageNumber: last });
}

/** How many pages the cuts produce, without composing the final html. */
function pageCountOf(
  bound: MaterializedDocument,
  markers: MarkerReserve,
  metrics: Metrics,
  printableHeight: number,
): number {
  return paginate(bound.document, { metrics, markers, printableHeight, slack: new Map() }).pages
    .length;
}

/**
 * Reserves the markers, measures, widens the bands a run of pages adds, and settles the cuts.
 *
 * The whole of a render up to but excluding the export: both façades call this one operation, so a
 * preview and a pdf cannot be composed from two different sequences.
 */
export async function composeInSession(
  session: PdfRenderSession,
  template: Template,
  data: EvaluationScope,
  first: MaterializedDocument,
): Promise<ComposedDocument> {
  const pxOf = (of: MaterializedDocument, metrics: { readonly pxPerMm: number }): number =>
    of.document.printable.height * metrics.pxPerMm;

  let bound = first;
  let markers = await reserveMarkers(session, bound);
  let metrics = await measureNaturally(session, bound, markers);

  if (pageCountOf(bound, markers, metrics, pxOf(bound, metrics)) > 1) {
    const widened: ReadonlySet<PageBandOccurrence> = reachableOccurrences(2);
    bound = extendBands(template, data, bound, widened);
    markers = await reserveMarkers(session, bound);
    metrics = await measureNaturally(session, bound, markers);
  }

  const attempt = await settle(session, bound, markers, metrics, pxOf(bound, metrics));
  return {
    bound,
    paginated: attempt.paginated,
    source: {
      html: attempt.html,
      sheet: attempt.paginated.sheet,
      images: documentImages(bound.document),
    },
  };
}

/** Validates the template and binds it under the hypothesis that the document holds one page. */
export function prepare(
  template: Template,
  data: EvaluationScope,
  options: RenderEngineOptions | undefined,
): { readonly template: Template; readonly bound: MaterializedDocument } {
  const validated = validateTemplate(template, options?.shapeLimits);
  return {
    template: validated,
    bound: materializeDocument(
      validated,
      data,
      ONE_PAGE_DOMAINS,
      options?.evaluationLimits,
      options?.presentationSelection,
    ),
  };
}

/**
 * Opens the session a render measures in, under the failure code its façade owns.
 *
 * Opening is common to laying out and to printing, so the code is a parameter: a pagination that
 * never prints must not be refused with an export failure it could not have reached.
 */
export async function openSession(
  strategy: PdfRenderStrategy,
  bound: MaterializedDocument,
  code: DocumentRenderErrorCode,
  message: string,
): Promise<PdfRenderSession> {
  try {
    return await strategy.open({
      sheet: bound.document.sheet,
      images: documentImages(bound.document),
    });
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      throw error;
    }
    throw new DocumentRenderError(message, code, {}, { cause: error });
  }
}
