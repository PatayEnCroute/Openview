import type { EvaluationScope, Template } from '@openview/core';
import {
  APPARENCE_A,
  APPARENCE_B,
  factureVariante,
  renderData,
  renderDataCourt,
  sampleTemplate,
} from './reference-invoice.js';

/**
 * Le catalogue local du playground : deux apparences du même modèle et deux jeux de données
 * courts, désignés par des identifiants.
 *
 * Le pont de développement n'accepte QUE ces identifiants. Il ne reçoit jamais un modèle ni un
 * jeu de données arbitraires : ce serait un service de rendu, et un service de rendu se durcit
 * avant de s'exposer.
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
];

/** Ce que le client reçoit : des identifiants et des libellés, jamais une charge utile. */
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

/** Résout un identifiant, ou rien. Un identifiant inconnu est refusé avant tout rendu. */
export function entryOf<TPayload>(
  entries: readonly CatalogueEntry<TPayload>[],
  id: unknown,
): CatalogueEntry<TPayload> | undefined {
  return typeof id === 'string' ? entries.find((entry) => entry.id === id) : undefined;
}

/** Nom de fichier explicite, composé des deux identifiants choisis. */
export function downloadName(templateId: string, datasetId: string): string {
  return `openview-${templateId}-${datasetId}.pdf`;
}
