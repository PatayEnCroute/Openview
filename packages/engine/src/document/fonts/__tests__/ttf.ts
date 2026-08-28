/**
 * A TrueType reader written for the tests alone.
 *
 * Deliberately a second implementation, independent of `tools/fonts/ttf.mjs`: the generator writes
 * what it believes each face covers, and this reader re-derives it from the embedded bytes. One
 * reader checking the other is the whole point of the pair -- a face swapped without regenerating
 * its coverage makes the gate red instead of silently changing what every render may print.
 *
 * No dependency: the faces are stored as uncompressed ttf precisely so this file can read them.
 */

interface Table {
  readonly offset: number;
  readonly length: number;
}

function directoryOf(bytes: Uint8Array): { view: DataView; tables: ReadonlyMap<string, Table> } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4);
  const tables = new Map<string, Table>();
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    let tag = '';
    for (let byte = 0; byte < 4; byte += 1) {
      tag += String.fromCharCode(view.getUint8(at + byte));
    }
    tables.set(tag, { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  return { view, tables };
}

function tableOf(bytes: Uint8Array, tag: string): { view: DataView; at: number } {
  const { view, tables } = directoryOf(bytes);
  const found = tables.get(tag);
  if (found === undefined) {
    throw new Error(`the face carries no ${tag} table`);
  }
  return { view, at: found.offset };
}

/** Offset of the best unicode cmap sub-table: format 12 when the face has one, format 4 otherwise. */
function unicodeSubtable(view: DataView, base: number): number {
  const count = view.getUint16(base + 2);
  let format4 = -1;
  let format12 = -1;
  for (let index = 0; index < count; index += 1) {
    const at = base + 4 + index * 8;
    const platform = view.getUint16(at);
    const encoding = view.getUint16(at + 2);
    const offset = base + view.getUint32(at + 4);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) {
      continue;
    }
    const format = view.getUint16(offset);
    if (format === 12 && format12 < 0) {
      format12 = offset;
    }
    if (format === 4 && format4 < 0) {
      format4 = offset;
    }
  }
  return format12 >= 0 ? format12 : format4;
}

function readFormat4(view: DataView, at: number, into: Set<number>): void {
  const segments = view.getUint16(at + 6) / 2;
  const endAt = at + 14;
  const startAt = endAt + segments * 2 + 2;
  const deltaAt = startAt + segments * 2;
  const rangeAt = deltaAt + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const end = view.getUint16(endAt + segment * 2);
    const start = view.getUint16(startAt + segment * 2);
    if (start > end || start === 0xffff) {
      continue;
    }
    const delta = view.getInt16(deltaAt + segment * 2);
    const rangeOffset = view.getUint16(rangeAt + segment * 2);
    for (let code = start; code <= end; code += 1) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        const raw = view.getUint16(rangeAt + segment * 2 + rangeOffset + (code - start) * 2);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) {
        into.add(code);
      }
    }
  }
}

function readFormat12(view: DataView, at: number, into: Set<number>): void {
  const groups = view.getUint32(at + 12);
  for (let group = 0; group < groups; group += 1) {
    const record = at + 16 + group * 12;
    const start = view.getUint32(record);
    const end = view.getUint32(record + 4);
    const startGlyph = view.getUint32(record + 8);
    for (let code = start; code <= end; code += 1) {
      if (startGlyph + (code - start) !== 0) {
        into.add(code);
      }
    }
  }
}

/** Every code point the face maps to a real glyph, as sorted inclusive ranges. */
export function coverageOf(bytes: Uint8Array): readonly (readonly [number, number])[] {
  const { view, at } = tableOf(bytes, 'cmap');
  const subtable = unicodeSubtable(view, at);
  if (subtable < 0) {
    throw new Error('the face carries no unicode cmap sub-table');
  }
  const points = new Set<number>();
  const format = view.getUint16(subtable);
  if (format === 12) {
    readFormat12(view, subtable, points);
  } else if (format === 4) {
    readFormat4(view, subtable, points);
  } else {
    throw new Error(`unsupported cmap format ${format}`);
  }
  const ranges: [number, number][] = [];
  for (const code of [...points].sort((left, right) => left - right)) {
    const last = ranges.at(-1);
    if (last !== undefined && code === last[1] + 1) {
      last[1] = code;
    } else {
      ranges.push([code, code]);
    }
  }
  return ranges;
}

/** The windows-platform name records of the face, keyed by name id. */
export function namesOf(bytes: Uint8Array): ReadonlyMap<number, string> {
  const { view, at } = tableOf(bytes, 'name');
  const count = view.getUint16(at + 2);
  const storage = at + view.getUint16(at + 4);
  const found = new Map<number, string>();
  for (let index = 0; index < count; index += 1) {
    const record = at + 6 + index * 12;
    if (view.getUint16(record) !== 3) {
      continue;
    }
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const offset = view.getUint16(record + 10);
    let text = '';
    for (let byte = 0; byte < length; byte += 2) {
      text += String.fromCharCode(view.getUint16(storage + offset + byte));
    }
    if (!found.has(nameId)) {
      found.set(nameId, text);
    }
  }
  return found;
}

/** The weight class the face declares, and the italic bit of its `head` macStyle. */
export function stylesOf(bytes: Uint8Array): { weight: number; italic: boolean } {
  const os2 = tableOf(bytes, 'OS/2');
  const head = tableOf(bytes, 'head');
  return {
    weight: os2.view.getUint16(os2.at + 4),
    italic: (head.view.getUint16(head.at + 44) & 0b10) !== 0,
  };
}

/** The four-byte tag at the head of the file, which says what kind of outlines it carries. */
export function sfntVersionOf(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
}
