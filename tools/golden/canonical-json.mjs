/**
 * The closed json serialisation every E7 digest is taken over.
 *
 * `JSON.stringify` writes keys in insertion order, so two equal inputs assembled by two different
 * code paths would digest differently and a golden would move without its document moving. This
 * sorts object keys and refuses everything json cannot carry, rather than dropping it the way
 * `JSON.stringify` drops `undefined` and a function -- a silently dropped field is a fixture change
 * that no digest would notice.
 */
import { createHash } from 'node:crypto';

/** Sorted by code point, which is what `Array.prototype.sort` compares by default. */
const sortedKeys = (value) => Object.keys(value).sort();

const quote = (text) => JSON.stringify(text);

/**
 * Writes one value, or throws naming the path at which json ran out.
 *
 * `seen` carries the ancestors of the current value, not every value already written: a graph that
 * reaches the same object twice down two branches is not a cycle and must serialise.
 */
function write(value, path, seen) {
  if (value === null) {
    return 'null';
  }
  const type = typeof value;
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (type === 'string') {
    return quote(value);
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} is a non-finite number, which json cannot carry`);
    }
    return JSON.stringify(value);
  }
  if (type !== 'object') {
    throw new TypeError(`${path} is a ${type}, which json cannot carry`);
  }
  if (seen.has(value)) {
    throw new TypeError(`${path} closes a cycle, which json cannot carry`);
  }
  const ancestors = new Set(seen).add(value);
  if (Array.isArray(value)) {
    /* Order is meaning here: a permuted array is a different document, so it is never sorted. */
    const entries = value.map((entry, index) => write(entry, `${path}[${index}]`, ancestors));
    return `[${entries.join(',')}]`;
  }
  /* A `Date`, a `Map` and a `Set` all answer `[]` to `Object.keys`, so all three would serialise as
     `{}` and two different ones would carry the same digest -- the silent loss this module exists
     to refuse. Only a literal object and a null-prototype one carry their whole value in their own
     keys, so only those two are accepted. */
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const named = typeof value.constructor === 'function' ? value.constructor.name : 'object';
    throw new TypeError(`${path} is a ${named}, which json cannot carry`);
  }
  const entries = sortedKeys(value).map(
    (key) => `${quote(key)}:${write(value[key], `${path}.${key}`, ancestors)}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * The canonical text of a value: sorted keys, arrays in order, nothing else accepted.
 *
 * Throws on `undefined`, a function, a symbol, a bigint, a non-finite number and a cycle. Refusing
 * is the point: a fixture that grew a field json cannot carry must stop the generator, not produce
 * a digest that quietly ignores it.
 */
export function canonicalJson(value) {
  return write(value, '$', new Set());
}

/** The sha-256, in hex, of the utf-8 of the canonical text. */
export function canonicalDigest(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** The sha-256, in hex, of a byte string. Named here so no caller spells the algorithm twice. */
export function digestOf(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** What a digest record carries: the length of the thing, and its digest. */
export function recordOf(bytes) {
  return { bytes: bytes.length, sha256: digestOf(bytes) };
}

/** The same for a string, measured in utf-8 bytes and never in utf-16 code units. */
export function textRecordOf(text) {
  return { bytes: Buffer.byteLength(text, 'utf8'), sha256: digestOf(Buffer.from(text, 'utf8')) };
}
