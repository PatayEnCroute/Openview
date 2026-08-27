import type { EvaluationScope, Template } from '@openview/core';
import {
  APPARENCE_A,
  APPARENCE_B,
  factureVariante,
  renderData,
  renderDataCourt,
  renderDataLong,
  renderDataLongAnglais,
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
    label: 'Trois lignes, deux remisées, mots en français',
    payload: renderData,
  },
  {
    id: 'une-ligne',
    label: 'Une ligne, aucune remise, mots en anglais',
    payload: renderDataCourt,
  },
  {
    id: 'soixante-lignes',
    label: 'Soixante lignes, mots en français : le document sort paginé',
    payload: renderDataLong,
  },
  {
    id: 'soixante-lignes-en',
    label: 'Soixante lignes, mots en anglais : le document sort paginé',
    payload: renderDataLongAnglais,
  },
];

/**
 * The writings of the values, per named variant.
 *
 * A WHITELIST, not a map the browser sends: the client names a variant and the bridge looks it up
 * here, so nothing a page posts can reach the selection a port is built with.
 *
 * The words of this model switch on a path of its own data set instead -- the two are independent
 * switches, which is why the four pairings are all offered and none is refused.
 */
export const VALUE_WRITINGS: readonly CatalogueEntry<Readonly<Record<string, string>>>[] = [
  {
    id: 'fr-eur',
    label: 'Valeurs en français, euros',
    payload: { montant: 'fr-eur', quantite: 'fr-decimal', prixUnitaire: 'fr-eur-4' },
  },
  {
    id: 'en-usd',
    label: 'Valeurs en anglais, dollars',
    payload: { montant: 'en-usd', quantite: 'en-decimal', prixUnitaire: 'en-usd-4' },
  },
];

/** Summary of catalogue entries exposed to the client. */
export interface CatalogueSummary {
  readonly templates: readonly { readonly id: string; readonly label: string }[];
  readonly datasets: readonly { readonly id: string; readonly label: string }[];
  readonly writings: readonly { readonly id: string; readonly label: string }[];
}

const summaryOf = (
  entries: readonly CatalogueEntry<unknown>[],
): readonly { readonly id: string; readonly label: string }[] =>
  entries.map((entry) => ({ id: entry.id, label: entry.label }));

export function catalogueSummary(): CatalogueSummary {
  return {
    templates: summaryOf(TEMPLATES),
    datasets: summaryOf(DATASETS),
    writings: summaryOf(VALUE_WRITINGS),
  };
}

/** Resolves an entry by its unique identifier. */
export function entryOf<TPayload>(
  entries: readonly CatalogueEntry<TPayload>[],
  id: unknown,
): CatalogueEntry<TPayload> | undefined {
  return typeof id === 'string' ? entries.find((entry) => entry.id === id) : undefined;
}

/** Generates a download filename based on the selected template, dataset and writing ids. */
export function downloadName(templateId: string, datasetId: string, writingId: string): string {
  return `openview-${templateId}-${datasetId}-${writingId}.pdf`;
}
