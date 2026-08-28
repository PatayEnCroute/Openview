/**
 * Types for the reproducibility profile.
 *
 * The tool itself stays plain JavaScript so the CI job can run it with `node` and no build step;
 * these declarations exist so the test that checks its shape is type-checked like every other.
 */

/** One embedded face, named and digested. */
export interface ProfileFont {
  readonly id: string;
  readonly sha256: string;
}

/** Everything two renders must share before their bytes are worth comparing. */
export interface ReproducibilityProfile {
  readonly platform: string;
  readonly architecture: string;
  readonly node: string;
  readonly v8: string;
  readonly icu: string;
  readonly unicode: string;
  readonly engine: string;
  readonly adapter: string;
  readonly puppeteer: string;
  readonly chromium: string;
  readonly fonts: readonly ProfileFont[];
  readonly pdfCanonicalizer: number;
  readonly launchArguments: readonly string[];
}

/** A browser that can answer for its own version. */
export interface VersionedBrowser {
  version(): Promise<string>;
}

/** Resolves a package from the adapter, which is where pnpm installed the runtime dependencies. */
export declare const fromAdapter: NodeJS.Require;

/** Builds the profile of the machine and the build this process is running. */
export declare function profileOf(
  browser: VersionedBrowser,
  launchArguments: readonly string[],
): Promise<ReproducibilityProfile>;

/** The profile written with its keys in a fixed order. */
export declare function serializeProfile(profile: Readonly<Record<string, unknown>>): string;

/** The fields a profile must carry. A manifest missing one is not an attestation. */
export declare const PROFILE_FIELDS: readonly string[];
