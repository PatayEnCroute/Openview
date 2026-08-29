import { describe, expect, it } from 'vitest';
import { coverageOf } from './ttf.js';

/**
 * A `cmap` format 4 sub-table, word by word.
 *
 * The twelve embedded faces all carry a format 12 table, so nothing else in this suite reaches the
 * format 4 reader -- and a face that carried one would have its coverage re-derived by code no test
 * had ever run. Four segments: one mapped by `idDelta` alone, one through the glyph array with a
 * hole in it, one malformed, and the `0xffff` terminator every format 4 table ends on.
 */
const FORMAT_4 = [
  4, // format
  54, // length, in bytes
  0, // language
  8, // segCountX2, so four segments
  8, // searchRange
  1, // entrySelector
  0, // rangeShift
  0x0043, // endCode, ascending
  0x0102,
  0x01ff,
  0xffff,
  0, // reservedPad
  0x0041, // startCode
  0x0100,
  0x0200, // past its endCode: a segment the reader must skip
  0xffff,
  0x0010, // idDelta
  0,
  0,
  1,
  0, // idRangeOffset: the first segment maps by delta, the second by the glyph array
  6,
  0,
  0,
  5, // glyphIdArray
  0, // no glyph, so 0x0101 is not covered
  7,
];

/** A truetype file whose single table is the `cmap` carrying `subtable`. */
function fontOf(subtable: readonly number[]): Uint8Array {
  const cmap = 28; // an offset table of 12 bytes, then one table record of 16
  const bytes = new Uint8Array(cmap + 12 + subtable.length * 2);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x0001_0000);
  view.setUint16(4, 1);
  for (const [index, letter] of [...'cmap'].entries()) {
    view.setUint8(12 + index, letter.codePointAt(0) ?? 0);
  }
  view.setUint32(20, cmap);
  view.setUint32(24, bytes.length - cmap);
  view.setUint16(cmap + 2, 1); // one encoding record
  view.setUint16(cmap + 4, 3); // the windows platform
  view.setUint16(cmap + 6, 1); // unicode, basic multilingual plane
  view.setUint32(cmap + 8, 12); // the sub-table follows the record
  for (const [index, word] of subtable.entries()) {
    view.setUint16(cmap + 12 + index * 2, word);
  }
  return bytes;
}

describe('a face whose unicode table is a format 4 cmap', () => {
  it('covers the codes its segments really map, and no others', () => {
    /* `0x0041` to `0x0043` come from the delta segment, `0x0100` and `0x0102` from the glyph array
       -- `0x0101` sits between them and maps to glyph 0, which is not coverage. The malformed
       segment and the terminator contribute nothing. */
    expect(coverageOf(fontOf(FORMAT_4))).toStrictEqual([
      [0x0041, 0x0043],
      [0x0100, 0x0100],
      [0x0102, 0x0102],
    ]);
  });
});
