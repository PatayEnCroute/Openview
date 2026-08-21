import type { RenderPort, RenderRequest, RenderResult } from '@openview/core';
import { documentImages } from '../document/images.js';
import { materializeDocument } from '../document/materialize.js';
import { DocumentRenderError } from '../errors.js';
import { buildHtmlTree } from '../html/build.js';
import { serializeHtml } from '../html/serialize.js';
import type { PdfRenderStrategy, PdfSourceDocument, RenderEngineOptions } from '../strategy/pdf.js';
import { validateTemplate } from './validate.js';

/** The media type a pdf result always announces. */
export const PDF_CONTENT_TYPE = 'application/pdf';

const EXPORT_FAILED =
  'The pdf strategy did not produce a document. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

async function exportPdf(
  strategy: PdfRenderStrategy,
  source: PdfSourceDocument,
): Promise<Uint8Array> {
  try {
    return await strategy.render(source);
  } catch (error) {
    /* A refusal the strategy already named keeps its own code and details: re-wrapping it would
       replace `single-page-overflow` with a generic export failure. */
    if (error instanceof DocumentRenderError) {
      throw error;
    }
    throw new DocumentRenderError(EXPORT_FAILED, 'pdf-export-failed', {}, { cause: error });
  }
}

/**
 * Assembles the pdf render port: validate, bind, build, serialise, then print.
 *
 * All five steps run on every render; none of them may stop the chain quietly, so a refusal is an
 * exception and a success has been through all five. The strategy receives the closed html document
 * and the declared sheet -- never the template, the data or the AST.
 */
export function createPdfRenderPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): RenderPort {
  return {
    format: 'pdf',
    async render(request: RenderRequest): Promise<RenderResult> {
      const template = validateTemplate(request.template, options?.shapeLimits);
      const document = materializeDocument(template, request.data, options?.evaluationLimits);
      const html = serializeHtml(buildHtmlTree(document));
      const bytes = await exportPdf(strategy, {
        html,
        sheet: document.sheet,
        images: documentImages(document),
      });
      return { format: 'pdf', bytes, contentType: PDF_CONTENT_TYPE };
    },
  };
}
