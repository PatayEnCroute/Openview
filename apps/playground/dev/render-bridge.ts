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
 * Le pont de rendu du serveur de DÉVELOPPEMENT du playground.
 *
 * Une application Vite tourne dans un navigateur et ne peut pas lancer Chromium ; le rendu vit
 * donc côté serveur. Ce pont n'est pas un service de rendu : il connaît un catalogue fermé, ne
 * reçoit que deux identifiants, n'est pas construit par `vite build` et n'existe que sous
 * `pnpm dev`. Le durcissement — réseau, délais, mémoire, concurrence — appartient au lot qui
 * précède toute exposition réelle.
 */

export const CATALOG_ROUTE = '/__openview/render-catalog';
export const RENDER_ROUTE = '/__openview/render-pdf';

const port = createPdfRenderPort(createPuppeteerPdfStrategy());

/** Ce qu'une route renvoie : un statut, des en-têtes et un corps déjà sérialisé. */
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

/** Le catalogue, réduit à des identifiants et des libellés. */
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
    /* Journalisé côté serveur avec sa cause, et refusé côté client sans elle : un corps illisible
       ne doit pas renvoyer à l'appelant ce que l'analyseur en a compris. */
    console.warn('[openview] render-pdf received a body that is not json', cause);
    return undefined;
  }
}

/**
 * Rend le PDF d'un couple d'identifiants.
 *
 * Une méthode inattendue, un identifiant inconnu ou un corps mal formé sont refusés AVANT que
 * le moteur soit appelé. Un refus connu ressort en JSON avec son code et son message ; la cause,
 * le HTML, le modèle et les données ne sortent jamais.
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
      /* Le code et le message, et rien de plus. `details` est sûr par construction, mais le
         publier ferait du pont une surface d'API alors qu'il n'est qu'un pont de développement. */
      return json(422, { code: error.code, message: error.message });
    }
    console.error('[openview] the render bridge failed for an unexpected reason', error);
    return json(500, { code: 'unexpected', message: 'The render failed for an unknown reason.' });
  }
}
