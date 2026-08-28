import { createPuppeteerPdfStrategy } from '@openview/adapter-puppeteer';
import type { RenderPort } from '@openview/core';
import {
  createPdfRenderPort,
  DocumentRenderError,
  type PresentationSelection,
} from '@openview/engine';
import {
  catalogueSummary,
  DATASETS,
  downloadName,
  entryOf,
  TEMPLATES,
  VALUE_WRITINGS,
} from '../src/examples/catalogue.js';

/**
 * Dev server rendering bridge for the playground Vite app.
 */

export const CATALOG_ROUTE = '/__openview/render-catalog';
export const RENDER_ROUTE = '/__openview/render-pdf';

const strategy = createPuppeteerPdfStrategy();

/**
 * One port per named writing variant, opened on first use.
 *
 * The selection is a construction argument, so a variant is a port and not a request field. Built
 * from the whitelist alone: the body of a request names a variant, and never a map of writings.
 */
const ports = new Map<string, RenderPort>();

function portFor(variant: { readonly id: string; readonly payload: PresentationSelection }) {
  const found = ports.get(variant.id);
  if (found !== undefined) {
    return found;
  }
  const opened = createPdfRenderPort(strategy, { presentationSelection: variant.payload });
  ports.set(variant.id, opened);
  return opened;
}

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
  readonly writingId: unknown;
}

function parseChoice(body: string): RenderChoice | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const record: Record<string, unknown> = { ...parsed };
    return {
      templateId: record.templateId,
      datasetId: record.datasetId,
      writingId: record.writingId,
    };
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
    return json(400, {
      code: 'malformed-body',
      message: 'Send {"templateId","datasetId","writingId"}.',
    });
  }
  const template = entryOf(TEMPLATES, choice.templateId);
  const dataset = entryOf(DATASETS, choice.datasetId);
  const writing = entryOf(VALUE_WRITINGS, choice.writingId);
  if (template === undefined || dataset === undefined || writing === undefined) {
    return json(404, {
      code: 'unknown-selection',
      message: 'That template, dataset or writing is not in the local catalogue.',
    });
  }

  try {
    const result = await portFor(writing).render({
      template: template.payload,
      data: dataset.payload,
    });
    return {
      status: 200,
      headers: {
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${downloadName(
          template.id,
          dataset.id,
          writing.id,
        )}"`,
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
