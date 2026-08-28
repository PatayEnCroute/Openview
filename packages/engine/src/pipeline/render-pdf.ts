import type { RenderPort, RenderRequest, RenderResult } from '@openview/core';
import { DocumentRenderError } from '../errors.js';
import type { PdfRenderSession, PdfRenderStrategy, RenderEngineOptions } from '../strategy/pdf.js';
import { type ComposedDocument, composeInSession, openSession, prepare } from './compose.js';

/** The media type a pdf result always announces. */
export const PDF_CONTENT_TYPE = 'application/pdf';

const EXPORT_FAILED =
  'The pdf strategy did not produce a document. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

/** Hands the composed source to the printer, and names an unknown backend failure an export one. */
async function printComposed(
  session: PdfRenderSession,
  composed: ComposedDocument,
): Promise<Uint8Array> {
  try {
    return await session.print(composed.source);
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      throw error;
    }
    throw new DocumentRenderError(EXPORT_FAILED, 'pdf-export-failed', {}, { cause: error });
  }
}

/**
 * Assembles the PDF render port executing validation, binding, pagination, and printing.
 *
 * Printing is all this port adds to the shared composition: the bytes come from the very html the
 * pagination port returns, so the two façades can never disagree on where the cuts fell.
 *
 * @see docs/adr/0006-la-page.md
 */
export function createPdfRenderPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): RenderPort {
  return {
    format: 'pdf',
    async render(request: RenderRequest): Promise<RenderResult> {
      const { template, bound } = prepare(request.template, request.data, options);
      /* Opening is where a pdf backend first refuses, and this port has always named that refusal
         an export failure: the code is kept so an existing caller keeps reading one contract. */
      const session = await openSession(strategy, bound, 'pdf-export-failed', EXPORT_FAILED);
      let bytes: Uint8Array;
      try {
        const composed = await composeInSession(session, template, request.data, bound);
        bytes = await printComposed(session, composed);
      } finally {
        await session.close();
      }
      return { format: 'pdf', bytes, contentType: PDF_CONTENT_TYPE };
    },
  };
}
