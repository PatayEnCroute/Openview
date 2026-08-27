import { createPuppeteerPdfStrategy } from '@openview/adapter-puppeteer';
import { createPdfRenderPort, DocumentRenderError } from '@openview/engine';
import {
  catalogueSummary,
  DATASETS,
  downloadName,
  entryOf,
  TEMPLATES,
} from '../src/examples/catalogue.js';

/**
 * Dev server rendering bridge for the playground Vite app.
 */

export const CATALOG_ROUTE = '/__openview/render-catalog';
export const RENDER_ROUTE = '/__openview/render-pdf';

const port = createPdfRenderPort(createPuppeteerPdfStrategy());

/** Bridge HTTP response structure containing status code, headers, and serialized body. */
export interface BridgeResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

const json = (status: number, payload: unknown): BridgeResponse => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(payload),
});

/** Returns catalogue entries summarized as identifiers and labels. */
export function catalogResponse(): BridgeResponse {
  return json(200, catalogueSummary());
}

interface RenderChoice {
  readonly templateId: unknown;
  readonly datasetId: unknown;
}

function parseChoice(body: string): RenderChoice | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const record: Record<string, unknown> = { ...parsed };
    return { templateId: record.templateId, datasetId: record.datasetId };
  } catch (cause) {
    console.warn('[openview] render-pdf received a body that is not json', cause);
    return undefined;
  }
}

/**
 * Handles PDF rendering requests for template and dataset identifiers.
 */
export async function renderResponse(method: string, body: string): Promise<BridgeResponse> {
  if (method !== 'POST') {
    return json(405, { code: 'method-not-allowed', message: 'Use POST.' });
  }
  const choice = parseChoice(body);
  if (choice === undefined) {
    return json(400, { code: 'malformed-body', message: 'Send {"templateId","datasetId"}.' });
  }
  const template = entryOf(TEMPLATES, choice.templateId);
  const dataset = entryOf(DATASETS, choice.datasetId);
  if (template === undefined || dataset === undefined) {
    return json(404, {
      code: 'unknown-selection',
      message: 'That template or dataset is not in the local catalogue.',
    });
  }

  try {
    const result = await port.render({ template: template.payload, data: dataset.payload });
    return {
      status: 200,
      headers: {
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${downloadName(template.id, dataset.id)}"`,
        'cache-control': 'no-store',
      },
      body: result.bytes,
    };
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return json(422, { code: error.code, message: error.message });
    }
    console.error('[openview] the render bridge failed for an unexpected reason', error);
    return json(500, { code: 'unexpected', message: 'The render failed for an unknown reason.' });
  }
}
