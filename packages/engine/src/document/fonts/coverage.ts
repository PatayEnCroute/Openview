import type { DocumentRenderErrorDetails } from '../../errors.js';
import { refusal } from '../../errors.js';
import { bundledFace } from './catalogue.js';
import type { BundledFontFace, ResolvedFontFace } from './types.js';

const UNSUPPORTED_CHARACTER =
  'A character reached the page that the embedded face cannot draw, and the engine will not let the browser borrow a glyph from the machine it runs on: the same document would then print differently elsewhere. Read `details.nodeId` for the declaration.';

/**
 * The structural characters html carries that no face has to draw.
 *
 * A tab, a line feed and a carriage return are layout instructions in `white-space: pre-wrap`, not
 * glyphs; a face that omits them still paints the document correctly.
 */
const STRUCTURAL: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0d]);

/** Whether one code point is inside the inclusive ranges the face declared. */
function covers(face: BundledFontFace, code: number): boolean {
  /* Binary search: the ranges are sorted and a face carries a couple of hundred of them, walked
     once per character of the document. */
  let low = 0;
  let high = face.codePoints.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = face.codePoints[middle];
    if (range === undefined) {
      return false;
    }
    if (code < range[0]) {
      high = middle - 1;
    } else if (code > range[1]) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Refuses the first character of `text` the resolved face cannot draw.
 *
 * Checked against the face's own `cmap` rather than against a list of scripts: waiting for the
 * browser to fall back would mean the document borrows a glyph from the host, and `document.fonts`
 * reports nothing about a substituted glyph.
 *
 * Neither the character, its code point nor the string travels in the refusal: a character can come
 * from the caller's data set, and a message is a thing that gets logged.
 */
export function assertCoveredText(
  text: string,
  face: ResolvedFontFace,
  details: DocumentRenderErrorDetails,
): void {
  const bundled = bundledFace(face.family, face.weight, face.style);
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code === undefined || STRUCTURAL.has(code)) {
      continue;
    }
    if (!covers(bundled, code)) {
      throw refusal(UNSUPPORTED_CHARACTER, 'unsupported-font-character', details);
    }
  }
}
