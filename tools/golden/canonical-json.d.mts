/**
 * Types for the closed json serialisation E7 digests are taken over.
 *
 * The tool itself stays plain JavaScript so the ci job runs it with `node` and no build step;
 * these declarations exist so the tests that exercise it are type-checked like every other.
 */

/** The length of a thing and its sha-256, the pair every E7 comparison is written from. */
export interface DigestRecord {
  readonly bytes: number;
  readonly sha256: string;
}

/**
 * The canonical text of a value: object keys sorted by code point, arrays left in order.
 *
 * Throws a `TypeError` naming the path at which json ran out for `undefined`, a function, a symbol,
 * a bigint, a non-finite number and a cycle.
 */
export declare function canonicalJson(value: unknown): string;

/** The sha-256, in hex, of the utf-8 of `canonicalJson(value)`. */
export declare function canonicalDigest(value: unknown): string;

/** The sha-256, in hex, of a byte string. */
export declare function digestOf(bytes: Uint8Array): string;

/** The length in bytes of a byte string, and its digest. */
export declare function recordOf(bytes: Uint8Array): DigestRecord;

/** The length of a string in utf-8 BYTES -- never utf-16 code units -- and its digest. */
export declare function textRecordOf(text: string): DigestRecord;
