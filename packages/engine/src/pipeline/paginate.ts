import type { PaginationPort, PaginationResult, RenderRequest } from '@openview/core';
import { paginationResultOf } from '../pagination/result.js';
import type { PdfRenderStrategy, RenderEngineOptions } from '../strategy/pdf.js';
import { type ComposedDocument, composeInSession, openSession, prepare } from './compose.js';

const OPEN_FAILED =
  'The layout session could not be opened, so no page of this document could be composed. The original error travels as `cause` for local debugging and is deliberately not summarised here.';

/**
 * Creates the pagination port for computing document page cuts without exporting PDF bytes.
 *
 * @see docs/adr/0018-le-moteur-sait-dire-ou-il-coupe.md
 */
export function createPaginationPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): PaginationPort {
  return {
    async paginate(request: RenderRequest): Promise<PaginationResult> {
      const { template, bound, limits } = prepare(request.template, request.data, options);
      const session = await openSession(strategy, bound, 'layout-measurement-failed', OPEN_FAILED);
      let composed: ComposedDocument;
      try {
        composed = await composeInSession(session, template, request.data, bound, limits);
      } finally {
        await session.close();
      }
      return paginationResultOf(composed.paginated, composed.source.html);
    },
  };
}
