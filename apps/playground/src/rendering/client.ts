/**
 * Client for local dev rendering bridge.
 */

export const CATALOG_URL = '/__openview/render-catalog';
export const RENDER_URL = '/__openview/render-pdf';

export interface CatalogueChoice {
  readonly id: string;
  readonly label: string;
}

export interface CatalogueView {
  readonly templates: readonly CatalogueChoice[];
  readonly datasets: readonly CatalogueChoice[];
}

/** Error representing a structured render refusal from the backend. */
export class RenderRefusal extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RenderRefusal';
    this.code = code;
  }
}

const choicesOf = (value: unknown): readonly CatalogueChoice[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const kept: CatalogueChoice[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record: Record<string, unknown> = { ...entry };
    if (typeof record.id === 'string' && typeof record.label === 'string') {
      kept.push({ id: record.id, label: record.label });
    }
  }
  return kept;
};

/** Fetches template and dataset identifiers from the local catalogue. */
export async function fetchCatalogue(): Promise<CatalogueView> {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    throw new RenderRefusal('catalogue-unavailable', 'The local catalogue did not answer.');
  }
  const payload: unknown = await response.json();
  const record: Record<string, unknown> =
    typeof payload === 'object' && payload !== null ? { ...payload } : {};
  return { templates: choicesOf(record.templates), datasets: choicesOf(record.datasets) };
}

async function refusalOf(response: Response): Promise<RenderRefusal> {
  try {
    const payload: unknown = await response.json();
    const record: Record<string, unknown> =
      typeof payload === 'object' && payload !== null ? { ...payload } : {};
    return new RenderRefusal(
      typeof record.code === 'string' ? record.code : 'unexpected',
      typeof record.message === 'string' ? record.message : 'The render was refused.',
    );
  } catch (cause) {
    console.warn('[openview] a refusal arrived without a json body', cause);
    return new RenderRefusal('unexpected', 'The render was refused without a readable reason.');
  }
}

const nameFrom = (disposition: string | null): string | undefined =>
  disposition?.match(/filename="([^"]+)"/)?.[1];

/**
 * Requests PDF rendering from the bridge and triggers browser download.
 */
export async function downloadPdf(templateId: string, datasetId: string): Promise<string> {
  const response = await fetch(RENDER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId, datasetId }),
  });
  if (!response.ok) {
    throw await refusalOf(response);
  }
  const filename = nameFrom(response.headers.get('content-disposition')) ?? 'openview.pdf';
  const url = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    return filename;
  } finally {
    URL.revokeObjectURL(url);
  }
}
