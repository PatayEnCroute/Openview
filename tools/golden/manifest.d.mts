/**
 * Types for the E7 manifest contract.
 *
 * The tool itself stays plain JavaScript so the ci job runs it with `node` and no build step; these
 * declarations exist so the tests that exercise it are type-checked like every other.
 */
import type { ReproducibilityProfile } from '../reproducibility/profile.d.mts';
import type { DigestRecord } from './canonical-json.d.mts';

/** One page of one document: its rank, its isolated pdf and its E5 certificate. */
export interface GoldenPageRecord {
  readonly number: number;
  readonly pdf: DigestRecord;
  readonly pagination: DigestRecord;
}

/** One rendered scenario, and everything a comparison of it needs. */
export interface GoldenDocumentRecord {
  readonly id: string;
  readonly recipeVersion: number;
  readonly filename: string;
  readonly inputSha256: string;
  readonly storedTemplateSha256?: string | undefined;
  readonly pdf: DigestRecord;
  readonly html: DigestRecord;
  readonly sheet: DigestRecord;
  readonly notices: DigestRecord;
  readonly pages: readonly GoldenPageRecord[];
}

/** The whole corpus: its harness versions, the profile that produced it, and its documents. */
export interface GoldenManifest {
  readonly formatVersion: number;
  readonly generatorVersion: number;
  readonly pageExtractorVersion: number;
  readonly profile: ReproducibilityProfile;
  readonly documents: readonly GoldenDocumentRecord[];
}

/** The host the official corpus is produced on. */
export interface OfficialHost {
  readonly platform: string;
  readonly architecture: string;
  readonly node: string;
  readonly launchArguments: readonly string[];
}

export declare const FORMAT_VERSION: number;
export declare const GENERATOR_VERSION: number;
export declare const PAGE_EXTRACTOR_VERSION: number;
export declare const MANIFEST_FILENAME: string;

/** The profile fields that say whether two runs were ever comparable. */
export declare const HOST_FIELDS: readonly string[];

/** The profile fields that say which build did the rendering. */
export declare const RENDERER_FIELDS: readonly string[];

export declare const OFFICIAL_HOST: OfficialHost;

/** The one directory a reference batch lives in, resolved from the tool rather than from the cwd. */
export declare const REFERENCES_DIRECTORY: string;

/** An invalid manifest, named by its path and by the fields at fault -- never by its content. */
export declare class ManifestError extends Error {
  constructor(path: string, issues: readonly string[]);
  readonly issues: readonly string[];
}

/** Validates one manifest at the boundary. Throws `ManifestError` naming the path and the fields. */
export declare function parseManifest(text: string, path: string): GoldenManifest;

/** Reads and validates the manifest of a corpus directory. */
export declare function readManifest(directory: string): GoldenManifest;

/** The manifest written with every key in a fixed order and a trailing newline. */
export declare function serializeManifest(manifest: GoldenManifest): string;

/** The fields by which a profile differs from the official host. Empty means it may be promoted. */
export declare function officialHostMismatches(profile: ReproducibilityProfile): readonly string[];
