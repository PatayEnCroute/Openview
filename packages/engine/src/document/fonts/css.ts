import { bundledFace } from './catalogue.js';
import type { ResolvedFontFace } from './types.js';

/**
 * The `@font-face` rules for the faces a document actually paints.
 *
 * Embedded as `data:` uris so the stylesheet is the whole typography: the same string measures, the
 * same string prints and the same string is published to a viewer, with nothing left to fetch. Only
 * the reached faces are written -- a document set in one weight does not carry the other eleven.
 *
 * The base64 alphabet is fixed and checked by the integrity test, so it needs no escaping inside
 * `url()`; no name from the template ever enters one of these rules.
 */
export function fontFaceCss(faces: readonly ResolvedFontFace[]): string {
  return faces
    .map((face) => {
      const bundled = bundledFace(face.family, face.weight, face.style);
      return (
        `@font-face{font-family:"${bundled.cssFamily}";` +
        `font-style:${bundled.style};font-weight:${bundled.weight};` +
        /* `block` rather than the default `auto`: a browser that painted one frame with a fallback
           would have measured a glyph this build never embedded. */
        'font-display:block;' +
        `src:url(data:font/ttf;base64,${bundled.data}) format("truetype")}`
      );
    })
    .join('');
}
