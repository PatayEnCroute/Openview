import { z } from 'zod/v4';
import { InvalidProtectedConfigurationError } from './errors.js';
import {
  DEFAULT_RESOURCE_LIMITS,
  PROTECTED_MEDIA_TYPES,
  type ProtectedImageManifest,
  type ProtectedResourceLimits,
  type ProtectedResourceLimitsOverrides,
  RESOURCE_HARD_CEILINGS,
} from './types.js';

const INVALID_LIMITS =
  'A protection limit must be a whole number between 1 and its hard ceiling. Omit a field to take its default; a present but unusable value is refused rather than replaced, because a ceiling of `1e9` is a documented way of switching the guard off.';

const INVALID_MANIFEST =
  'The image manifest is not usable. Every entry names one exact source with its media type and its expected sha-256; an origin, a wildcard, a duplicate source or a digest of the wrong shape is refused.';

const bounded = (ceiling: number): z.ZodType<number> =>
  z
    .number()
    .int('A protection limit must be a whole number')
    .min(1, 'A protection limit may not go below 1')
    .max(ceiling, `A protection limit may not exceed ${ceiling}`);

const digest = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'A sha-256 is sixty-four lowercase hexadecimal digits');

const mediaType = z.enum(PROTECTED_MEDIA_TYPES);

/** Validation of the resource ceilings, refusing unknown keys rather than dropping them. */
export const ProtectedResourceLimitsSchema: z.ZodType<ProtectedResourceLimits> = z
  .strictObject({
    maxDistinctImages: bounded(RESOURCE_HARD_CEILINGS.maxDistinctImages),
    maxSourceLength: bounded(RESOURCE_HARD_CEILINGS.maxSourceLength),
    maxImageBytes: bounded(RESOURCE_HARD_CEILINGS.maxImageBytes),
    maxTotalImageBytes: bounded(RESOURCE_HARD_CEILINGS.maxTotalImageBytes),
    maxImagePixels: bounded(RESOURCE_HARD_CEILINGS.maxImagePixels),
    maxTotalImagePixels: bounded(RESOURCE_HARD_CEILINGS.maxTotalImagePixels),
    resourceTimeoutMs: bounded(RESOURCE_HARD_CEILINGS.resourceTimeoutMs),
    maxRedirects: bounded(RESOURCE_HARD_CEILINGS.maxRedirects),
    maxRawPdfBytes: bounded(RESOURCE_HARD_CEILINGS.maxRawPdfBytes),
    maxCanonicalPdfBytes: bounded(RESOURCE_HARD_CEILINGS.maxCanonicalPdfBytes),
  })
  .readonly();

const assetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('bytes'),
    source: z.string().min(1),
    mediaType,
    bytes: z.instanceof(Uint8Array),
    sha256: digest,
  }),
  z.strictObject({
    kind: z.literal('https'),
    source: z.string().min(1),
    mediaType,
    sha256: digest,
  }),
]);

/**
 * Validation of the whole manifest, duplicates included.
 *
 * Refused as one object rather than after a `Map` is built: a map keyed by source silently keeps
 * the last of two entries, and the caller would never learn which of its two authorisations won.
 */
export const ProtectedImageManifestSchema: z.ZodType<ProtectedImageManifest> = z
  .array(assetSchema)
  .max(RESOURCE_HARD_CEILINGS.maxDistinctImages)
  .refine(
    (assets) => new Set(assets.map((asset) => asset.source)).size === assets.length,
    'A source may be authorised once',
  )
  .readonly();

/** Fills the ceilings the caller left out and refuses the ones it got wrong. */
export function resolveResourceLimits(
  overrides?: ProtectedResourceLimitsOverrides | undefined,
): ProtectedResourceLimits {
  if (overrides === undefined) {
    return DEFAULT_RESOURCE_LIMITS;
  }
  const filled: Record<string, unknown> = { ...DEFAULT_RESOURCE_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      filled[key] = value;
    }
  }
  const parsed = ProtectedResourceLimitsSchema.safeParse(filled);
  if (!parsed.success) {
    throw new InvalidProtectedConfigurationError(INVALID_LIMITS, { cause: parsed.error });
  }
  return parsed.data;
}

/**
 * Validates a manifest before a runtime exists to use it.
 *
 * The parameter is `unknown` on purpose: a manifest is host configuration, and a service builds one
 * from json it read rather than from a literal a compiler checked.
 */
export function resolveImageManifest(manifest: unknown): ProtectedImageManifest {
  const parsed = ProtectedImageManifestSchema.safeParse(manifest ?? []);
  if (!parsed.success) {
    throw new InvalidProtectedConfigurationError(INVALID_MANIFEST, { cause: parsed.error });
  }
  return parsed.data;
}
