/** One mebibyte, the unit every byte ceiling in this package is written in. */
export const MIB = 1_048_576;

/** The three bitmap media types this backend can print. */
export const PROTECTED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ProtectedMediaType = (typeof PROTECTED_MEDIA_TYPES)[number];

/**
 * One authorised image, named by the exact source the host wrote into the template.
 *
 * `bytes` carries the file itself; `https` names one the broker may fetch. Both forms declare the
 * digest the content must have: an origin alone gives neither integrity nor a reproducible
 * document, since the asset behind it may change between two renders.
 */
export type ProtectedImageAsset =
  | {
      readonly source: string;
      readonly kind: 'bytes';
      readonly mediaType: ProtectedMediaType;
      readonly bytes: Uint8Array;
      readonly sha256: string;
    }
  | {
      readonly source: string;
      readonly kind: 'https';
      readonly mediaType: ProtectedMediaType;
      readonly sha256: string;
    };

/** The closed list of sources one runtime is allowed to load. */
export type ProtectedImageManifest = readonly ProtectedImageAsset[];

/** Ceilings on what one render may load, decode and print. */
export interface ProtectedResourceLimits {
  /** Distinct sources one render may resolve. */
  readonly maxDistinctImages: number;
  /** Length of the textual source before it is parsed at all. */
  readonly maxSourceLength: number;
  /** Encoded size of one image, in bytes. */
  readonly maxImageBytes: number;
  /** Encoded size of every image of one render, in bytes. */
  readonly maxTotalImageBytes: number;
  /** Surface of one image, in pixels. */
  readonly maxImagePixels: number;
  /** Surface of every image of one render, in pixels. */
  readonly maxTotalImagePixels: number;
  /** Wall-clock allowed to one remote resource, in milliseconds. */
  readonly resourceTimeoutMs: number;
  /** Redirects one remote resource may follow, each revalidated in full. */
  readonly maxRedirects: number;
  /** Raw bytes the printer may stream out of the browser. */
  readonly maxRawPdfBytes: number;
  /** Bytes the canonical document may reach once rewritten. */
  readonly maxCanonicalPdfBytes: number;
}

/**
 * What a caller may name when it configures the ceilings.
 *
 * An explicit `undefined` reads as an omission, so a host forwarding an optional configuration does
 * not have to delete the keys it has no value for.
 */
export type ProtectedResourceLimitsOverrides = {
  readonly [K in keyof ProtectedResourceLimits]?: ProtectedResourceLimits[K] | undefined;
};

/** Defaults measured against the documents this repository already renders. */
export const DEFAULT_RESOURCE_LIMITS: ProtectedResourceLimits = {
  maxDistinctImages: 64,
  maxSourceLength: 16 * MIB,
  maxImageBytes: 8 * MIB,
  maxTotalImageBytes: 32 * MIB,
  maxImagePixels: 25_000_000,
  maxTotalImagePixels: 100_000_000,
  resourceTimeoutMs: 10_000,
  maxRedirects: 3,
  maxRawPdfBytes: 64 * MIB,
  maxCanonicalPdfBytes: 64 * MIB,
};

/**
 * Highest value each ceiling may be configured to.
 *
 * Tenfold the default, except redirects and timeouts: a chain of ten hops already costs ten full
 * policy passes, and a resource allowed more than a minute holds a slot no render can use.
 */
export const RESOURCE_HARD_CEILINGS: ProtectedResourceLimits = {
  maxDistinctImages: 640,
  maxSourceLength: 160 * MIB,
  maxImageBytes: 80 * MIB,
  maxTotalImageBytes: 320 * MIB,
  maxImagePixels: 250_000_000,
  maxTotalImagePixels: 1_000_000_000,
  resourceTimeoutMs: 60_000,
  maxRedirects: 10,
  maxRawPdfBytes: 640 * MIB,
  maxCanonicalPdfBytes: 640 * MIB,
};
