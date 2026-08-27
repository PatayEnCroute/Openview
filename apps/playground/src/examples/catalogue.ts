import type { EvaluationScope, Template } from '@openview/core';
import {
  APPARENCE_A,
  APPARENCE_B,
  factureVariante,
  renderData,
  renderDataCourt,
  renderDataLong,
  sampleTemplate,
} from './reference-invoice.js';

/**
 * Local playground catalogue entries for templates and datasets.
 */

export interface CatalogueEntry<TPayload> {
  readonly id: string;
  readonly label: string;
  readonly payload: TPayload;
}

export const TEMPLATES: readonly CatalogueEntry<Template>[] = [
  { id: 'apparence-a', label: APPARENCE_A.nom, payload: sampleTemplate },
  { id: 'apparence-b', label: APPARENCE_B.nom, payload: factureVariante },
];

export const DATASETS: readonly CatalogueEntry<EvaluationScope>[] = [
  {
    id: 'trois-lignes',
    label: 'Trois lignes, deux remisées, libellés en français',
    payload: renderData,
  },
  {
    id: 'une-ligne',
    label: 'Une ligne, aucune remise, libellés en anglais',
    payload: renderDataCourt,
  },
  {
    id: 'soixante-lignes',
    label: 'Soixante lignes : le document sort paginé',
    payload: renderDataLong,
  },
];

/** Summary of catalogue entries exposed to the client. */
export interface CatalogueSummary {
  readonly templates: readonly { readonly id: string; readonly label: string }[];
  readonly datasets: readonly { readonly id: string; readonly label: string }[];
}

const summaryOf = (
  entries: readonly CatalogueEntry<unknown>[],
): readonly { readonly id: string; readonly label: string }[] =>
  entries.map((entry) => ({ id: entry.id, label: entry.label }));

export function catalogueSummary(): CatalogueSummary {
  return { templates: summaryOf(TEMPLATES), datasets: summaryOf(DATASETS) };
}

/** Resolves an entry by its unique identifier. */
export function entryOf<TPayload>(
  entries: readonly CatalogueEntry<TPayload>[],
  id: unknown,
): CatalogueEntry<TPayload> | undefined {
  return typeof id === 'string' ? entries.find((entry) => entry.id === id) : undefined;
}

/** Generates a download filename based on selected template and dataset ids. */
export function downloadName(templateId: string, datasetId: string): string {
  return `openview-${templateId}-${datasetId}.pdf`;
}
