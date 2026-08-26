import type {
  EvaluationScope,
  PageBandOccurrence,
  RenderPort,
  RenderRequest,
  RenderResult,
  Template,
} from '@openview/core';
import { reachableOccurrences } from '../document/bands.js';
import { documentImages } from '../document/images.js';
import {
  extendBands,
  type MaterializedDocument,
  materializeDocument,
} from '../document/materialize.js';
import { DocumentRenderError } from '../errors.js';
import { buildGlyphProbe, buildPagedTree, buildProbeTree, glyphKey } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import {
  CANONICAL_NUMBER_ALPHABET,
  type GlyphWidths,
  markerReserve,
  markerSignatures,
} from '../pagination/markers.js';
import { paginate } from '../pagination/paginate.js';
import { digitsOf, progressionBound } from '../pagination/progress.js';
import type { MarkerReserve, Metrics, PaginatedDocument } from '../pagination/types.js';
import { validateMeasurement } from '../pagination/validate-measurement.js';
import { verifyLayout } from '../pagination/verify.js';
import type { PdfRenderSession, PdfRenderStrategy, RenderEngineOptions } from '../strategy/pdf.js';
import { validateTemplate } from './validate.js';

/** The media type a pdf result always announces. */
export const PDF_CONTENT_TYPE = 'application/pdf';

const EXPORT_FAILED =
  'The pdf strategy did not produce a document. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

const MEASURE_FAILED =
  'The layout session did not answer a measurement. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

const NOT_SETTLED =
  'The composed pages kept overflowing the height the browser gave them, so the engine stopped rather than print a sequence it could not prove. Read `details.pageNumber` for the last page involved.';

/**
 * How many times a measured overflow may push the paginator to cut again.
 *
 * Each round withholds strictly more height from one page, so the sequence cannot repeat; the bound
 * only stops a pathological document from spending a browser on it. The operational ceilings of a
 * hostile document are a separate concern from this convergence.
 */
const MAX_SETTLE_ROUNDS = 8;

/** The band domains a document that turns out to hold one page can ever paint. */
const ONE_PAGE_DOMAINS = reachableOccurrences(1);

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

/** How many of the canonical alphabet's leading characters are the ten decimal digits. */
const DECIMAL_DIGITS = 10;

/** Measures the widest glyph of every typography a page marker of this document uses. */
async function reserveMarkers(
  session: PdfRenderSession,
  bound: MaterializedDocument,
): Promise<MarkerReserve> {
  const signatures = markerSignatures(bound.document);
  const digits = digitsOf(progressionBound(bound.document));
  if (signatures.size === 0) {
    return markerReserve(digits, new Map());
  }
  const probe = buildGlyphProbe(bound.document, signatures);
  const measurement = await measured(async () =>
    session.measure({
      html: serializeHtml(probe.tree),
      sheet: bound.document.sheet,
      images: [],
    }),
  );
  validateMeasurement(measurement, probe.keys, bound.document.sheet);
  const widths = new Map(measurement.boxes.map((box) => [box.key, box.width]));
  const widest = new Map<string, GlyphWidths>();
  for (const signature of signatures.keys()) {
    let digit = 0;
    let canonical = 0;
    for (let at = 0; at < CANONICAL_NUMBER_ALPHABET.length; at += 1) {
      const width = widths.get(glyphKey(signature, at)) ?? 0;
      canonical = Math.max(canonical, width);
      if (at < DECIMAL_DIGITS) {
        digit = Math.max(digit, width);
      }
    }
    widest.set(signature, { digit, canonical });
  }
  return markerReserve(digits, widest);
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

interface Composed {
  readonly paginated: PaginatedDocument;
  readonly html: string;
}

/**
 * Cuts, paints and measures the whole sequence until the browser agrees every page holds what the
 * paginator put on it.
 *
 * A measured overflow becomes height withheld from that page and the flow is cut again from the
 * start, so the pages that follow are recomposed rather than patched. Nothing is printed until a
 * measurement of the final sequence has come back clean.
 */
async function settle(
  session: PdfRenderSession,
  bound: MaterializedDocument,
  markers: MarkerReserve,
  metrics: Metrics,
  printableHeight: number,
): Promise<Composed> {
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

async function renderInSession(
  session: PdfRenderSession,
  template: Template,
  data: EvaluationScope,
  first: MaterializedDocument,
): Promise<Uint8Array> {
  const pxOf = (bound: MaterializedDocument, metrics: { readonly pxPerMm: number }): number =>
    bound.document.printable.height * metrics.pxPerMm;

  let bound = first;
  let markers = await reserveMarkers(session, bound);
  let metrics = await measureNaturally(session, bound, markers);

  if (pageCountOf(bound, markers, metrics, pxOf(bound, metrics)) > 1) {
    /* The one-page hypothesis is spent: the domains a run of pages reaches are wider, so the bands
       they add are bound now -- once -- and the reserves and the cuts are taken again from the
       start. Widening never makes the document fit on one page again, so this happens at most once
       and the two passes cannot chase each other. */
    const widened: ReadonlySet<PageBandOccurrence> = reachableOccurrences(2);
    bound = extendBands(template, data, bound, widened);
    markers = await reserveMarkers(session, bound);
    metrics = await measureNaturally(session, bound, markers);
  }

  const composed = await settle(session, bound, markers, metrics, pxOf(bound, metrics));
  try {
    return await session.print({
      html: composed.html,
      sheet: composed.paginated.sheet,
      images: documentImages(bound.document),
    });
  } catch (error) {
    /* A refusal the session already named keeps its own code and details: re-wrapping it would
       replace a precise cause with a generic export failure. */
    if (error instanceof DocumentRenderError) {
      throw error;
    }
    throw new DocumentRenderError(EXPORT_FAILED, 'pdf-export-failed', {}, { cause: error });
  }
}

/**
 * Assembles the pdf render port: validate, bind, paginate, build, serialise, then print.
 *
 * Every step runs on every render; none of them may stop the chain quietly, so a refusal is an
 * exception and a success has been through all of them. One session is opened per render and closed
 * on every path, so every height that decided a cut and the page that was printed come from the
 * same fonts and the same layout engine.
 *
 * The strategy receives closed html documents and the declared sheet -- never the template, the
 * data or the AST.
 */
export function createPdfRenderPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): RenderPort {
  return {
    format: 'pdf',
    async render(request: RenderRequest): Promise<RenderResult> {
      const template = validateTemplate(request.template, options?.shapeLimits);
      const bound = materializeDocument(
        template,
        request.data,
        ONE_PAGE_DOMAINS,
        options?.evaluationLimits,
      );
      const session = await openSession(strategy, bound);
      let bytes: Uint8Array;
      try {
        bytes = await renderInSession(session, template, request.data, bound);
      } finally {
        await session.close();
      }
      return { format: 'pdf', bytes, contentType: PDF_CONTENT_TYPE };
    },
  };
}

async function openSession(
  strategy: PdfRenderStrategy,
  bound: MaterializedDocument,
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
    throw new DocumentRenderError(EXPORT_FAILED, 'pdf-export-failed', {}, { cause: error });
  }
}
