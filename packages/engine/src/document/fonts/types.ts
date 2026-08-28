/**
 * The shape of the embedded font catalogue.
 *
 * Internal to the engine: a template names a family with a free string, and which bytes that string
 * resolves to is a capability of this build, not a field of the stored document.
 */

/** The families this build embeds, pinned to the release its bytes came from. */
export type BundledFontFamilyId = 'inter-4.1' | 'noto-sans-2.015' | 'noto-serif-2.015';

/** The four faces every embedded family carries. */
export type BundledFontWeight = 400 | 700;

export type BundledFontStyle = 'normal' | 'italic';

/**
 * One embedded face: its bytes, what they hash to, and exactly which code points it can draw.
 *
 * `cssFamily` is an internal name no template can ask for, so a document can never be served a
 * local installation of the same typeface. `codePoints` are inclusive ranges read from the face's
 * own `cmap`, which is what lets a character be refused before anything is measured.
 */
export interface BundledFontFace {
  readonly family: BundledFontFamilyId;
  readonly cssFamily: string;
  readonly weight: BundledFontWeight;
  readonly style: BundledFontStyle;
  readonly byteLength: number;
  readonly sha256: string;
  /** The family and subfamily the face names itself, so a substituted file fails its own check. */
  readonly familyName: string;
  readonly subfamilyName: string;
  readonly codePoints: readonly (readonly [number, number])[];
  /** The whole face, base64. Never fetched and never read from disk: it is part of the build. */
  readonly data: string;
}

/** The face a run resolved to, which is what a typography signature and the css are written from. */
export interface ResolvedFontFace {
  readonly family: BundledFontFamilyId;
  readonly cssFamily: string;
  readonly weight: BundledFontWeight;
  readonly style: BundledFontStyle;
}
