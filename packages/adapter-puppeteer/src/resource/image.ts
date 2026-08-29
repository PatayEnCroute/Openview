import { DocumentRenderError } from '@openview/engine';
import type { ProtectedMediaType, ProtectedResourceLimits } from './types.js';

const NOT_A_BITMAP =
  'These bytes do not begin with the signature of the media type they were declared under. A declared type is not evidence, so the file is refused before anything decodes it.';

const TRUNCATED =
  'The header of this image stops before its dimensions, so no decoder can be told in advance how large the bitmap would be.';

const TOO_MANY_PIXELS =
  'This image declares a surface larger than one render may decode. Read `details.limit` for the ceiling in pixels; a few bytes of header can announce a bitmap of several gigabytes.';

const TOO_MANY_BYTES =
  'This image is larger than one render may load. Read `details.limit` for the ceiling in bytes.';

/** Width and height a header announces, in pixels. */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, at) => bytes[at] === byte);

const ascii = (bytes: Uint8Array, at: number, text: string): boolean =>
  bytes.length >= at + text.length &&
  [...text].every((character, index) => bytes[at + index] === character.charCodeAt(0));

/**
 * Reads the header words through a `DataView`.
 *
 * Every call below is preceded by a length check, and a view reads the exact width the format
 * declares instead of assembling bytes one index at a time.
 */
const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const be32 = (bytes: Uint8Array, at: number): number => viewOf(bytes).getUint32(at);

const be16 = (bytes: Uint8Array, at: number): number => viewOf(bytes).getUint16(at);

const le16 = (bytes: Uint8Array, at: number): number => viewOf(bytes).getUint16(at, true);

/** Three little-endian bytes, which is how a webp container writes a dimension. */
const le24 = (bytes: Uint8Array, at: number): number =>
  viewOf(bytes).getUint16(at, true) + viewOf(bytes).getUint8(at + 2) * 0x10000;

const le32Unsigned = (bytes: Uint8Array, at: number): number => viewOf(bytes).getUint32(at, true);

/** Which of the three media types these bytes really are, or `undefined` for anything else. */
export function sniffMediaType(bytes: Uint8Array): ProtectedMediaType | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    return 'image/webp';
  }
  return undefined;
}

function refuse(message: string, limit?: number | undefined): never {
  throw new DocumentRenderError(message, 'resource-policy-refused', {
    phase: 'resource',
    resourceKind: 'embedded-image',
    ...(limit === undefined ? {} : { limit }),
  });
}

/** Dimensions from a png `IHDR`, which is always the first chunk. */
function pngDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 24 || !ascii(bytes, 12, 'IHDR')) {
    refuse(TRUNCATED);
  }
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

/** Frame markers that carry the frame dimensions, as opposed to tables and restart markers. */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** Dimensions from the first jpeg start-of-frame segment, walking the segment lengths. */
function jpegDimensions(bytes: Uint8Array): ImageDimensions {
  let at = 2;
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) {
      refuse(TRUNCATED);
    }
    const marker = viewOf(bytes).getUint8(at + 1);
    /* Padding between segments is written as repeated `0xff`, so the scan steps one byte rather
       than reading a length that is not there. */
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const length = be16(bytes, at + 2);
    if (length < 2) {
      refuse(TRUNCATED);
    }
    if (isStartOfFrame(marker)) {
      if (at + 9 > bytes.length) {
        refuse(TRUNCATED);
      }
      return { height: be16(bytes, at + 5), width: be16(bytes, at + 7) };
    }
    at += 2 + length;
  }
  refuse(TRUNCATED);
}

/** Dimensions from a webp `VP8`, `VP8L` or `VP8X` chunk, whichever the container holds first. */
function webpDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 30) {
    refuse(TRUNCATED);
  }
  if (ascii(bytes, 12, 'VP8X')) {
    return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
  if (ascii(bytes, 12, 'VP8L')) {
    const packed = le32Unsigned(bytes, 21);
    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(bytes, 12, 'VP8 ')) {
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  refuse(TRUNCATED);
}

/**
 * Reads the dimensions a bitmap header announces, without decoding it.
 *
 * A ceiling on encoded bytes alone lets a few hundred bytes of header announce a surface of
 * billions of pixels, which a browser then tries to allocate.
 */
export function imageDimensions(mediaType: ProtectedMediaType, bytes: Uint8Array): ImageDimensions {
  switch (mediaType) {
    case 'image/png':
      return pngDimensions(bytes);
    case 'image/jpeg':
      return jpegDimensions(bytes);
    case 'image/webp':
      return webpDimensions(bytes);
    default: {
      const exhaustive: never = mediaType;
      throw new TypeError(`Unhandled media type: ${String(exhaustive)}`);
    }
  }
}

/** What one image contributed, once its bytes were accepted. */
export interface InspectedImage {
  readonly mediaType: ProtectedMediaType;
  readonly bytes: Uint8Array;
  readonly pixels: number;
}

/**
 * Checks bytes against the type they claim and against the per-image ceilings.
 *
 * The signature is read before the declared type is believed, and the dimensions before the
 * cumulative budget is touched: both refusals happen without a browser and without a decoder.
 */
export function inspectImage(
  declared: ProtectedMediaType,
  bytes: Uint8Array,
  limits: ProtectedResourceLimits,
): InspectedImage {
  if (bytes.length > limits.maxImageBytes) {
    refuse(TOO_MANY_BYTES, limits.maxImageBytes);
  }
  if (sniffMediaType(bytes) !== declared) {
    refuse(NOT_A_BITMAP);
  }
  const { width, height } = imageDimensions(declared, bytes);
  if (width <= 0 || height <= 0) {
    refuse(TRUNCATED);
  }
  const pixels = width * height;
  if (pixels > limits.maxImagePixels) {
    refuse(TOO_MANY_PIXELS, limits.maxImagePixels);
  }
  return { mediaType: declared, bytes, pixels };
}
