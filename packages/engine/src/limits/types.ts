/** One mebibyte, the unit every byte ceiling in this file is written in. */
export const MIB = 1_048_576;

/**
 * Logical ceilings on what one render may materialise, paginate and serialise.
 *
 * They bound work whose meaning the engine knows. Wall-clock, memory and browser resources are not
 * here: nothing in this package can interrupt a synchronous evaluation or count a Chromium page.
 */
export interface RenderSafetyLimits {
  /** Maximum persistent objects one render may build from the bound document. */
  readonly maxMaterializedUnits: number;
  /** Maximum pages one document may be cut into. */
  readonly maxPages: number;
  /** Maximum size of a serialised html document, in utf-8 bytes. */
  readonly maxHtmlBytes: number;
}

/**
 * What a caller may name when it configures the ceilings.
 *
 * An explicit `undefined` reads as an omission, so a host forwarding an optional configuration does
 * not have to delete the keys it has no value for.
 */
export type RenderSafetyLimitsOverrides = {
  readonly [K in keyof RenderSafetyLimits]?: RenderSafetyLimits[K] | undefined;
};

/** Default logical ceilings, active unless the caller overrides a field. */
export const DEFAULT_RENDER_SAFETY_LIMITS: RenderSafetyLimits = {
  maxMaterializedUnits: 250_000,
  maxPages: 100,
  maxHtmlBytes: 32 * MIB,
};

/**
 * Highest value each ceiling may be configured to.
 *
 * A ceiling a caller can raise to a billion is a documented way of switching the guard off, so each
 * one stops well before that. Pages stop far earlier than the tenfold rule the others follow: ten
 * thousand sheets is already past any document a print pipeline is meant to produce.
 */
export const RENDER_SAFETY_HARD_CEILINGS: RenderSafetyLimits = {
  maxMaterializedUnits: 2_500_000,
  maxPages: 10_000,
  maxHtmlBytes: 320 * MIB,
};
