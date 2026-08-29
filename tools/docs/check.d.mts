/**
 * Types for the documentation gate.
 *
 * The tool itself stays plain JavaScript, like the rest of `tools/`; these declarations exist so
 * the suite that drives it is type-checked like every other.
 */

/** One page of one language tree, with the ceiling it lives under. */
export interface DocumentationFile {
  readonly path: string;
  readonly maxLines: number;
}

/** What one rule saw, where. */
export interface DocumentationViolation {
  readonly file: string;
  /** One-based line, or 0 when the violation is about the file as a whole. */
  readonly line: number;
  readonly rule: string;
  readonly message: string;
}

/** The pages, and every fact they are allowed to claim. */
export interface DocumentationInput {
  readonly files: ReadonlyMap<string, string>;
  /** Quotable source regions, keyed `path#name`, indentation already removed. */
  readonly regions: ReadonlyMap<string, string>;
  /** Named exports of each documented package. */
  readonly exports: ReadonlyMap<string, readonly string[]>;
  /** Closed lists, in source order. */
  readonly vocabularies: ReadonlyMap<string, readonly string[]>;
  /**
   * Default objects, compared key by key in both directions.
   *
   * `object` rather than a record type: the sources are interfaces, and an interface without an
   * index signature is not assignable to `Record<string, …>`. The gate reads them with
   * `Object.entries`, which needs nothing more.
   */
  readonly defaults: ReadonlyMap<string, object>;
  /** Single facts a page may state. */
  readonly values: ReadonlyMap<string, number | string>;
  /** Whether a repository-relative path exists. */
  exists(path: string): boolean;
}

export declare const LANGUAGES: readonly string[];
export declare const GUIDE_ROOT: string;
export declare const GUIDE_PAGES: readonly { readonly name: string; readonly maxLines: number }[];
export declare const PUBLISHED_LANGUAGE: string;
export declare const READMES: readonly {
  readonly directory: string;
  readonly maxLines: number;
}[];

/** Where the landing page of one package, in one language, lives. */
export declare function readmeOf(directory: string, language: string): string;
export declare const MAX_WIDTH: number;
export declare const MAX_HEADING_DEPTH: number;
export declare const TOTAL_PER_LANGUAGE: number;

/** The files one language tree must hold, guide pages then readmes. */
export declare function filesOf(language: string): readonly DocumentationFile[];

/** The names a barrel exports, values and types alike. */
export declare function exportedNamesOf(source: string): readonly string[];

/** The `// #region name` blocks of a source module, indentation removed. */
export declare function regionsOf(source: string): ReadonlyMap<string, string>;

/** Every rule, over one set of pages: an empty list is a green gate. */
export declare function checkDocumentation(
  input: DocumentationInput,
): readonly DocumentationViolation[];
