/**
 * Types for the closed register of E7 scenarios.
 *
 * The tool itself stays plain JavaScript so the ci job runs it with `node` and no build step; these
 * declarations exist so the tests that exercise it are type-checked like every other.
 *
 * The two packages are reached through their build output rather than by their package name:
 * `tools/` is not a workspace package, so pnpm links no `node_modules` beside this file. Both paths
 * resolve to the very declaration files `@openview/core` and `@openview/engine` publish, so the
 * types here are the same types the tests see under their public names.
 */
import type { EvaluationScope, Template } from '../../packages/core/dist/index.js';
import type { RenderEngineOptions } from '../../packages/engine/dist/index.js';

/** One frozen document of the batch: what is rendered, how, and what is expected to come out. */
export interface GoldenScenario {
  readonly id: string;
  readonly recipeVersion: number;
  readonly filename: string;
  readonly expectedPages: number;
  readonly duty: string;
  readonly template: Template;
  readonly data: EvaluationScope;
  readonly options: RenderEngineOptions;
  /** The raw stored document, on the one entry whose source predates the current schema. */
  readonly storedTemplate?: unknown;
}

/** The register, in the order the manifest stores it. */
export declare const CORPUS: readonly GoldenScenario[];

/** The digest of the migrated template, the data set and the options that were rendered. */
export declare function inputDigestOf(scenario: GoldenScenario): string;

/** The digest of the raw stored document, for the one scenario that carries one. */
export declare function storedTemplateDigestOf(scenario: GoldenScenario): string | undefined;

/** Every filename the reference directory may hold, beside the manifest. */
export declare const CORPUS_FILENAMES: readonly string[];

/** Every id, in register order. */
export declare const CORPUS_IDS: readonly string[];
