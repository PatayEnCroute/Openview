import { DocumentRenderError } from '@openview/engine';
import type { ProtectedMediaType, ProtectedResourceLimits } from './types.js';

const TOO_LONG =
  'This image source is longer than one render may even parse. Read `details.limit` for the ceiling in code units; the source itself is deliberately not repeated.';

const NOT_BASE64 =
  'The payload of this `data:` source is not standard base64. Decoding a lenient superset would let two different sources produce the same bytes, and one of them was never authorised.';

/**
 * The inline spellings this backend reads, each bound to the type it announces.
 *
 * Matched exactly, as the direct path already does: accepting a different case or a stray space
 * would widen what this backend prints rather than bound it.
 */
const EMBEDDED_PREFIXES: readonly (readonly [string, ProtectedMediaType])[] = [
  ['data:image/png;base64,', 'image/png'],
  ['data:image/jpeg;base64,', 'image/jpeg'],
  ['data:image/webp;base64,', 'image/webp'],
];

/** Standard base64: full quartets, with at most two padding characters closing the last one. */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function refuse(message: string, limit?: number | undefined): never {
  throw new DocumentRenderError(message, 'resource-policy-refused', {
    phase: 'resource',
    resourceKind: 'embedded-image',
    ...(limit === undefined ? {} : { limit }),
  });
}

/** An inline source, split into the type it declares and the bytes it carries. */
export interface EmbeddedImage {
  readonly mediaType: ProtectedMediaType;
  readonly bytes: Uint8Array;
}

/**
 * Reads an inline `data:` bitmap, or reports that the source is not one.
 *
 * The length is checked before anything is parsed, so an enormous source costs a comparison rather
 * than a decode.
 */
export function readEmbeddedImage(
  src: string,
  limits: ProtectedResourceLimits,
): EmbeddedImage | undefined {
  if (src.length > limits.maxSourceLength) {
    refuse(TOO_LONG, limits.maxSourceLength);
  }
  const found = EMBEDDED_PREFIXES.find(([prefix]) => src.startsWith(prefix));
  if (found === undefined) {
    return undefined;
  }
  const [prefix, mediaType] = found;
  const payload = src.slice(prefix.length);
  if (!BASE64.test(payload)) {
    refuse(NOT_BASE64);
  }
  /* `Buffer.from` accepts a lenient superset and drops what it does not understand, so the
     alphabet and the quartets are checked above rather than trusted to the decoder. */
  return { mediaType, bytes: new Uint8Array(Buffer.from(payload, 'base64')) };
}

/** Writes bytes back as the inline source a browser may load. */
export function embeddedSourceOf(mediaType: ProtectedMediaType, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
}
