import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { imageDimensions, inspectImage, sniffMediaType } from '../image.js';
import { DEFAULT_RESOURCE_LIMITS, type ProtectedResourceLimits } from '../types.js';
import {
  jpegHeader,
  pngHeader,
  TINY_PNG_BYTES,
  webpExtendedHeader,
  webpHeader,
  webpLosslessHeader,
} from './fixtures.js';

const limits = (overrides: Partial<ProtectedResourceLimits> = {}): ProtectedResourceLimits => ({
  ...DEFAULT_RESOURCE_LIMITS,
  ...overrides,
});

const refusalOf = (run: () => unknown): DocumentRenderError => {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the image was accepted');
};

describe('what a run of bytes really is', () => {
  it('recognises the three bitmaps this backend prints', () => {
    expect(sniffMediaType(TINY_PNG_BYTES)).toBe('image/png');
    expect(sniffMediaType(jpegHeader(2, 2))).toBe('image/jpeg');
    expect(sniffMediaType(webpHeader(2, 2))).toBe('image/webp');
  });

  it('recognises nothing in an empty, a truncated or a foreign run', () => {
    expect(sniffMediaType(new Uint8Array())).toBeUndefined();
    expect(sniffMediaType(new Uint8Array([0x89, 0x50]))).toBeUndefined();
    /* An svg is a language, not a bitmap, and it does not become one by declaring a media type. */
    expect(sniffMediaType(new Uint8Array(Buffer.from('<svg xmlns=')))).toBeUndefined();
  });
});

describe('the surface a header announces', () => {
  it('reads a png `IHDR`', () => {
    expect(imageDimensions('image/png', pngHeader(1024, 768))).toStrictEqual({
      width: 1024,
      height: 768,
    });
  });

  it('reads the first jpeg frame, walking past the segments before it', () => {
    const withComment = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xfe,
      0x00,
      0x04,
      0x01,
      0x02,
      ...jpegHeader(640, 480).slice(2),
    ]);
    expect(imageDimensions('image/jpeg', withComment)).toStrictEqual({ width: 640, height: 480 });
  });

  it('steps over the fill bytes a jpeg writes between segments', () => {
    const padded = new Uint8Array([0xff, 0xd8, 0xff, 0xff, ...jpegHeader(8, 4).slice(2)]);
    expect(imageDimensions('image/jpeg', padded)).toStrictEqual({ width: 8, height: 4 });
  });

  it('reads each of the three webp containers', () => {
    expect(imageDimensions('image/webp', webpHeader(300, 200))).toStrictEqual({
      width: 300,
      height: 200,
    });
    expect(imageDimensions('image/webp', webpLosslessHeader(300, 200))).toStrictEqual({
      width: 300,
      height: 200,
    });
    expect(imageDimensions('image/webp', webpExtendedHeader(300, 200))).toStrictEqual({
      width: 300,
      height: 200,
    });
  });

  it('refuses a header that stops before its dimensions', () => {
    expect(refusalOf(() => imageDimensions('image/png', pngHeader(4, 4).slice(0, 20))).code).toBe(
      'resource-policy-refused',
    );
    expect(
      refusalOf(() => imageDimensions('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]))).code,
    ).toBe('resource-policy-refused');
    expect(refusalOf(() => imageDimensions('image/webp', webpHeader(2, 2).slice(0, 20))).code).toBe(
      'resource-policy-refused',
    );
  });

  it('refuses a jpeg whose segment lengths lead nowhere', () => {
    expect(
      refusalOf(() =>
        imageDimensions('image/jpeg', new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x00, 0x02])),
      ).code,
    ).toBe('resource-policy-refused');
    expect(
      refusalOf(() =>
        imageDimensions('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00, 0x00])),
      ).code,
    ).toBe('resource-policy-refused');
  });

  it('refuses a webp container this backend does not read', () => {
    const unknown = webpHeader(2, 2);
    unknown.set([0x41, 0x4c, 0x50, 0x48], 12);
    expect(refusalOf(() => imageDimensions('image/webp', unknown)).code).toBe(
      'resource-policy-refused',
    );
  });
});

describe('the bytes one render may decode', () => {
  it('accepts a real bitmap under every ceiling', () => {
    const inspected = inspectImage('image/png', TINY_PNG_BYTES, limits());
    expect(inspected.pixels).toBe(8);
    expect(inspected.mediaType).toBe('image/png');
  });

  it('refuses a declared type the signature contradicts', () => {
    /* The whole reason a manifest declares a media type and the broker still reads the bytes. */
    expect(refusalOf(() => inspectImage('image/jpeg', TINY_PNG_BYTES, limits())).code).toBe(
      'resource-policy-refused',
    );
  });

  it('accepts exactly the byte ceiling and refuses one past it', () => {
    expect(() =>
      inspectImage('image/png', TINY_PNG_BYTES, limits({ maxImageBytes: TINY_PNG_BYTES.length })),
    ).not.toThrow();
    const refused = refusalOf(() =>
      inspectImage(
        'image/png',
        TINY_PNG_BYTES,
        limits({ maxImageBytes: TINY_PNG_BYTES.length - 1 }),
      ),
    );
    expect(refused.details.limit).toBe(TINY_PNG_BYTES.length - 1);
    expect(refused.details.resourceKind).toBe('embedded-image');
  });

  it('refuses a few bytes of header announcing a bitmap of billions of pixels', () => {
    /* Twenty-four bytes, forty gigapixels: a ceiling on the encoded size alone catches none of it. */
    const bomb = pngHeader(200_000, 200_000);
    expect(bomb.byteLength).toBeLessThan(64);
    const refused = refusalOf(() => inspectImage('image/png', bomb, limits()));
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.limit).toBe(DEFAULT_RESOURCE_LIMITS.maxImagePixels);
  });

  it('accepts exactly the pixel ceiling and refuses one past it', () => {
    expect(() =>
      inspectImage('image/png', pngHeader(100, 100), limits({ maxImagePixels: 10_000 })),
    ).not.toThrow();
    expect(
      refusalOf(() =>
        inspectImage('image/png', pngHeader(100, 101), limits({ maxImagePixels: 10_000 })),
      ).code,
    ).toBe('resource-policy-refused');
  });

  it('refuses a header announcing no surface at all', () => {
    expect(refusalOf(() => inspectImage('image/png', pngHeader(0, 10), limits())).code).toBe(
      'resource-policy-refused',
    );
  });
});

describe('a container that only looks like one', () => {
  it('is not a webp when its riff chunk names something else', () => {
    const riff = webpHeader(2, 2);
    riff.set([0x4e, 0x4f, 0x50, 0x45], 8);
    expect(sniffMediaType(riff)).toBeUndefined();
  });

  it('is not a png when one byte of its signature differs', () => {
    const png = pngHeader(2, 2);
    png[3] = 0;
    expect(sniffMediaType(png)).toBeUndefined();
  });

  it('is recognised as nothing when its bytes stop inside the riff header itself', () => {
    expect(sniffMediaType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeUndefined();
  });

  it('refuses a jpeg frame whose own segment stops short', () => {
    const truncated = jpegHeader(4, 4).slice(0, 8);
    expect(refusalOf(() => imageDimensions('image/jpeg', truncated)).code).toBe(
      'resource-policy-refused',
    );
  });
});
