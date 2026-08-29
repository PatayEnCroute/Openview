import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { embeddedSourceOf, readEmbeddedImage } from '../embedded.js';
import { DEFAULT_RESOURCE_LIMITS, type ProtectedResourceLimits } from '../types.js';
import { TINY_PNG_BASE64, TINY_PNG_BYTES, TINY_PNG_SOURCE } from './fixtures.js';

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
  throw new Error('the source was accepted');
};

describe('an inline bitmap source', () => {
  it('reads back the bytes the template embedded', () => {
    const read = readEmbeddedImage(TINY_PNG_SOURCE, limits());
    expect(read?.mediaType).toBe('image/png');
    expect(read?.bytes).toStrictEqual(TINY_PNG_BYTES);
  });

  it('reads each of the three spellings this backend accepts', () => {
    for (const type of ['png', 'jpeg', 'webp'] as const) {
      expect(readEmbeddedImage(`data:image/${type};base64,AAAA`, limits())?.mediaType).toBe(
        `image/${type}`,
      );
    }
  });

  it('reports that an http source is not one, rather than refusing it here', () => {
    /* Not this function's decision: a remote source is the manifest's business. */
    expect(readEmbeddedImage('https://assets.example.com/logo.png', limits())).toBeUndefined();
    expect(readEmbeddedImage('asset:logo', limits())).toBeUndefined();
  });

  it('reports a spelling with different case or a stray space as not inline at all', () => {
    /* Accepting them would widen what this backend prints, which is the opposite of the job. */
    expect(readEmbeddedImage(`DATA:image/png;base64,${TINY_PNG_BASE64}`, limits())).toBeUndefined();
    expect(readEmbeddedImage(`data:image/PNG;base64,${TINY_PNG_BASE64}`, limits())).toBeUndefined();
    expect(
      readEmbeddedImage(` data:image/png;base64,${TINY_PNG_BASE64}`, limits()),
    ).toBeUndefined();
    expect(readEmbeddedImage('data:image/png ;base64,AAAA', limits())).toBeUndefined();
  });

  it('reports a media type outside the three as not one of them', () => {
    expect(readEmbeddedImage('data:image/svg+xml;base64,PHN2Zy8+', limits())).toBeUndefined();
    expect(readEmbeddedImage('data:image/gif;base64,R0lGODlh', limits())).toBeUndefined();
  });

  it('refuses a payload that is not standard base64', () => {
    for (const payload of ['AAA', 'A===', '****', 'AA=A', 'AA A']) {
      expect(
        refusalOf(() => readEmbeddedImage(`data:image/png;base64,${payload}`, limits())).code,
      ).toBe('resource-policy-refused');
    }
  });

  it('refuses a source longer than one render may even parse', () => {
    const refused = refusalOf(() =>
      readEmbeddedImage(
        `data:image/png;base64,${'A'.repeat(400)}`,
        limits({ maxSourceLength: 64 }),
      ),
    );
    expect(refused.details.limit).toBe(64);
    expect(refused.message).not.toContain('AAAA');
  });

  it('measures the ceiling before parsing, so an enormous source costs one comparison', () => {
    /* A four-hundred-megabyte source must not be decoded to be refused. */
    const refused = refusalOf(() =>
      readEmbeddedImage('x'.repeat(1_000), limits({ maxSourceLength: 999 })),
    );
    expect(refused.code).toBe('resource-policy-refused');
  });
});

describe('the inline source bytes are written back as', () => {
  it('round-trips a bitmap through the exact spelling the policy accepts', () => {
    const written = embeddedSourceOf('image/png', TINY_PNG_BYTES);
    expect(written).toBe(TINY_PNG_SOURCE);
    expect(readEmbeddedImage(written, limits())?.bytes).toStrictEqual(TINY_PNG_BYTES);
  });
});
