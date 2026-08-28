import { describe, expect, it } from 'vitest';
import * as engine from './index.js';
import { ENGINE_VERSION } from './index.js';

describe('@openview/engine public surface', () => {
  it('exposes its version as a semver string', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exposes one factory per port, and no second export beyond them', () => {
    expect(Object.keys(engine).sort()).toStrictEqual([
      'DOCUMENT_AREAS',
      'DOCUMENT_REGIONS',
      'DOCUMENT_RENDER_ERROR_CODES',
      'DocumentRenderError',
      'ENGINE_VERSION',
      'PDF_CONTENT_TYPE',
      'createPaginationPort',
      'createPdfRenderPort',
    ]);
  });

  it('keeps the materialised document, the cuts and the html vocabulary internal', () => {
    /* The result of a pagination is a projection: a caller that could reach a fragment, a cursor,
       a metric or a probe key could recompose a page the pdf would never have printed. */
    for (const forbidden of [
      'paginate',
      'materializeDocument',
      'buildPagedTree',
      'serializeHtml',
      'wholeFragment',
      'markerReserve',
      'composeInSession',
      'paginationResultOf',
    ]) {
      expect(Object.keys(engine)).not.toContain(forbidden);
    }
  });
});
