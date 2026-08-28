import type { PaginationPort, PaginationResult, RenderRequest } from '@openview/core';
import { paginationResultOf } from '../pagination/result.js';
import type { PdfRenderStrategy, RenderEngineOptions } from '../strategy/pdf.js';
import { type ComposedDocument, composeInSession, openSession, prepare } from './compose.js';

const OPEN_FAILED =
  'The layout session could not be opened, so no page of this document could be composed. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

/**
 * Assembles the pagination port: the cuts of a document, with no byte of export produced.
 *
 * The same strategy as the pdf port on purpose. What decides where a page ends is the environment
 * the document would be printed in, so measuring anywhere else would answer about another document;
 * the session opened here can print, and this port never asks it to.
 *
 * @see docs/adr/0018-le-moteur-sait-dire-ou-il-coupe.md
 */
export function createPaginationPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): PaginationPort {
  return {
    async paginate(request: RenderRequest): Promise<PaginationResult> {
      const { template, bound } = prepare(request.template, request.data, options);
      /* Opening is laying out here, never exporting: an unknown failure is a layout failure, and
         naming it a pdf export would describe a step this port does not have. */
      const session = await openSession(strategy, bound, 'layout-measurement-failed', OPEN_FAILED);
      let composed: ComposedDocument;
      try {
        composed = await composeInSession(session, template, request.data, bound);
      } finally {
        await session.close();
      }
      return paginationResultOf(composed.paginated, composed.source.html);
    },
  };
}
