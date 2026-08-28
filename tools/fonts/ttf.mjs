/**
 * Minimal TrueType reader for the font generator.
 *
 * Deliberately independent from the reader the engine test suite carries: the test re-derives the
 * coverage from the embedded bytes and compares it to what this tool wrote, so one reader checking
 * the other is the whole point of the pair.
 */

/** The table directory of a face, keyed by tag. */
export function tablesOf(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4);
  const tables = new Map();
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    tables.set(tag, { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  return { view, tables };
}

/** Offset of the best unicode cmap sub-table: format 12 when present, format 4 otherwise. */
function cmapSubtable(view, base) {
  const count = view.getUint16(base + 2);
  let format4 = -1;
  let format12 = -1;
  for (let i = 0; i < count; i += 1) {
    const at = base + 4 + i * 8;
    const platform = view.getUint16(at);
    const encoding = view.getUint16(at + 2);
    const offset = base + view.getUint32(at + 4);
    const format = view.getUint16(offset);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) {
      continue;
    }
    if (format === 12 && format12 < 0) {
      format12 = offset;
    }
    if (format === 4 && format4 < 0) {
      format4 = offset;
    }
  }
  return format12 >= 0 ? format12 : format4;
}

function readFormat4(view, at, into) {
  const segments = view.getUint16(at + 6) / 2;
  const endAt = at + 14;
  const startAt = endAt + segments * 2 + 2;
  const deltaAt = startAt + segments * 2;
  const rangeAt = deltaAt + segments * 2;
  for (let s = 0; s < segments; s += 1) {
    const end = view.getUint16(endAt + s * 2);
    const start = view.getUint16(startAt + s * 2);
    if (start > end || start === 0xffff) {
      continue;
    }
    const delta = view.getInt16(deltaAt + s * 2);
    const rangeOffset = view.getUint16(rangeAt + s * 2);
    for (let code = start; code <= end; code += 1) {
      let glyph;
      if (rangeOffset === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        const raw = view.getUint16(rangeAt + s * 2 + rangeOffset + (code - start) * 2);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) {
        into.add(code);
      }
    }
  }
}

function readFormat12(view, at, into) {
  const groups = view.getUint32(at + 12);
  for (let g = 0; g < groups; g += 1) {
    const record = at + 16 + g * 12;
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
export function coverageOf(bytes) {
  const { view, tables } = tablesOf(bytes);
  const cmap = tables.get('cmap');
  if (cmap === undefined) {
    throw new Error('the face carries no cmap table');
  }
  const at = cmapSubtable(view, cmap.offset);
  if (at < 0) {
    throw new Error('the face carries no unicode cmap sub-table');
  }
  const points = new Set();
  const format = view.getUint16(at);
  if (format === 12) {
    readFormat12(view, at, points);
  } else if (format === 4) {
    readFormat4(view, at, points);
  } else {
    throw new Error(`unsupported cmap format ${format}`);
  }
  const ranges = [];
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
export function namesOf(bytes) {
  const { view, tables } = tablesOf(bytes);
  const name = tables.get('name');
  if (name === undefined) {
    throw new Error('the face carries no name table');
  }
  const count = view.getUint16(name.offset + 2);
  const storage = name.offset + view.getUint16(name.offset + 4);
  const found = new Map();
  for (let i = 0; i < count; i += 1) {
    const at = name.offset + 6 + i * 12;
    if (view.getUint16(at) !== 3) {
      continue;
    }
    const nameId = view.getUint16(at + 6);
    const length = view.getUint16(at + 8);
    const offset = view.getUint16(at + 10);
    let text = '';
    for (let c = 0; c < length; c += 2) {
      text += String.fromCharCode(view.getUint16(storage + offset + c));
    }
    if (!found.has(nameId)) {
      found.set(nameId, text);
    }
  }
  return found;
}

/** The weight class the face declares and the italic bit of its `head` macStyle. */
export function stylesOf(bytes) {
  const { view, tables } = tablesOf(bytes);
  const os2 = tables.get('OS/2');
  const head = tables.get('head');
  if (os2 === undefined || head === undefined) {
    throw new Error('the face carries no OS/2 or head table');
  }
  return {
    weight: view.getUint16(os2.offset + 4),
    italic: (view.getUint16(head.offset + 44) & 0b10) !== 0,
  };
}
