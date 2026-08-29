/**
 * The closed register of E7 scenarios: six documents, in one order, from the fixtures that exist.
 *
 * A batch nobody can enumerate is not a safety net. Every entry is spelt here with the id, the file
 * it is stored under, the recipe version of its input and the number of pages it is expected to
 * take, so that adding a document is a deliberate act and losing one is a failure rather than a
 * silence.
 *
 * Nothing is copied. The templates and data sets come from the fixtures the acceptance suites
 * already own, and the historical document comes from the C9 corpus exactly as it was written.
 */

import {
  BARE,
  ENGLISH_VALUES,
  FRAMED,
  FRENCH_VALUES,
  layeredReferenceDocument,
  ONE_ROW,
  referenceDocument,
  SIXTY_ROWS,
  worded,
  writtenReferenceDocument,
} from '../../packages/adapter-puppeteer/dist/__tests__/reference-document.js';
import { parseTemplate } from '../../packages/core/dist/index.js';
import {
  V1_DATA,
  V1_DOCUMENT,
} from '../../packages/core/dist/template/__tests__/compatibility-fixtures.js';
import { canonicalDigest } from './canonical-json.mjs';

/**
 * The bilingual model, built once.
 *
 * What makes the E4 recette a recette is that the STORED document is identical between the two
 * writings: only the data set and the selection of writings differ. Two calls would let the two
 * scenarios drift apart without either failing, so the two entries below share this reference and
 * a test asserts that they do.
 */
const WRITTEN_TEMPLATE = writtenReferenceDocument(FRAMED);

/**
 * The historical v1 document, migrated by the engine's own entry point.
 *
 * `V1_DOCUMENT` is passed as it stands: not annotated with a current type, not given a page, not
 * copied into this file. C9 proved the model opens; this proves it renders.
 */
const HISTORICAL_TEMPLATE = parseTemplate(V1_DOCUMENT);

/**
 * The register, in the order the manifest stores it.
 *
 * `options` is an object even when a scenario declares nothing: `undefined` cannot be digested, and
 * the empty object renders identically -- every field of `RenderEngineOptions` is optional.
 */
export const CORPUS = Object.freeze([
  Object.freeze({
    id: 'invoice-one-page',
    recipeVersion: 1,
    filename: 'invoice-one-page.pdf',
    expectedPages: 1,
    duty: 'E1: formula, image, grid, table, appearance, single-page pdf',
    template: referenceDocument(FRAMED),
    data: ONE_ROW,
    options: {},
  }),
  Object.freeze({
    id: 'invoice-sixty-bare',
    recipeVersion: 1,
    filename: 'invoice-sixty-bare.pdf',
    expectedPages: 4,
    duty: 'E2/E3: unframed metrics, repeated headers, three seams and carried reports',
    template: referenceDocument(BARE),
    data: SIXTY_ROWS,
    options: {},
  }),
  Object.freeze({
    id: 'invoice-sixty-fr-eur',
    recipeVersion: 1,
    filename: 'invoice-sixty-fr-eur.pdf',
    expectedPages: 5,
    duty: 'E4: french words, euros, dates, decimals and written reports',
    template: WRITTEN_TEMPLATE,
    data: worded(SIXTY_ROWS, 'fr'),
    options: { presentationSelection: FRENCH_VALUES },
  }),
  Object.freeze({
    id: 'invoice-sixty-en-usd',
    recipeVersion: 1,
    filename: 'invoice-sixty-en-usd.pdf',
    expectedPages: 5,
    duty: 'E4: english words and dollars, from the same stored model',
    template: WRITTEN_TEMPLATE,
    data: worded(SIXTY_ROWS, 'en'),
    options: { presentationSelection: ENGLISH_VALUES },
  }),
  Object.freeze({
    id: 'invoice-sixty-layered',
    recipeVersion: 1,
    filename: 'invoice-sixty-layered.pdf',
    expectedPages: 5,
    duty: 'C11: grid, background, foreground and unchanged cuts',
    template: layeredReferenceDocument(FRAMED),
    data: SIXTY_ROWS,
    options: {},
  }),
  Object.freeze({
    id: 'historical-v1',
    recipeVersion: 1,
    filename: 'historical-v1.pdf',
    expectedPages: 1,
    duty: 'C9: raw v1 document, transforming migration, final render',
    template: HISTORICAL_TEMPLATE,
    data: V1_DATA,
    options: {},
    /* The only entry that carries one: the stored document is what C9 froze, and a change to it
       must not be able to disguise itself as a change of renderer. */
    storedTemplate: V1_DOCUMENT,
  }),
]);

/**
 * The digest of everything that was rendered: the migrated model, the data set and the options.
 *
 * Taken over the template AFTER `parseTemplate`, because that is the document the engine was
 * actually handed. Editing a fixture therefore moves this digest, and the comparator says so
 * instead of blaming the renderer.
 */
export function inputDigestOf(scenario) {
  return canonicalDigest({
    template: scenario.template,
    data: scenario.data,
    options: scenario.options,
  });
}

/** The digest of the raw stored document, for the one scenario that carries one. */
export function storedTemplateDigestOf(scenario) {
  return scenario.storedTemplate === undefined
    ? undefined
    : canonicalDigest(scenario.storedTemplate);
}

/** Every filename the reference directory may hold, beside the manifest. */
export const CORPUS_FILENAMES = Object.freeze(CORPUS.map((scenario) => scenario.filename));

/** Every id, in register order. */
export const CORPUS_IDS = Object.freeze(CORPUS.map((scenario) => scenario.id));
