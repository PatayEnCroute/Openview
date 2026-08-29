import { describe, expect, it } from 'vitest';
import { InvalidProtectedConfigurationError } from '../errors.js';
import {
  ProtectedResourceLimitsSchema,
  resolveImageManifest,
  resolveResourceLimits,
} from '../schemas.js';
import {
  DEFAULT_RESOURCE_LIMITS,
  type ProtectedImageManifest,
  RESOURCE_HARD_CEILINGS,
} from '../types.js';
import { digestOf, TINY_PNG_BYTES } from './fixtures.js';

const refusalOf = (run: () => unknown): InvalidProtectedConfigurationError => {
  try {
    run();
  } catch (error) {
    if (error instanceof InvalidProtectedConfigurationError) {
      return error;
    }
    throw error;
  }
  throw new Error('the configuration was accepted');
};

const digest = digestOf(TINY_PNG_BYTES);

describe('the ceilings one render loads under', () => {
  it('are active without the caller naming any of them', () => {
    expect(resolveResourceLimits()).toStrictEqual(DEFAULT_RESOURCE_LIMITS);
  });

  it('keep the default of every field the caller left out', () => {
    expect(resolveResourceLimits({ maxRedirects: 1 })).toStrictEqual({
      ...DEFAULT_RESOURCE_LIMITS,
      maxRedirects: 1,
    });
  });

  it('read an explicit `undefined` as an omission', () => {
    expect(resolveResourceLimits({ maxRedirects: undefined })).toStrictEqual(
      DEFAULT_RESOURCE_LIMITS,
    );
  });

  it('accept each hard ceiling exactly and refuse one past it', () => {
    expect(
      resolveResourceLimits({ maxRedirects: RESOURCE_HARD_CEILINGS.maxRedirects }).maxRedirects,
    ).toBe(RESOURCE_HARD_CEILINGS.maxRedirects);
    expect(
      refusalOf(() =>
        resolveResourceLimits({ maxRedirects: RESOURCE_HARD_CEILINGS.maxRedirects + 1 }),
      ).name,
    ).toBe('InvalidProtectedConfigurationError');
  });

  it('refuse zero, a fraction, a NaN and an unknown key', () => {
    for (const value of [0, 1.5, Number.NaN]) {
      expect(refusalOf(() => resolveResourceLimits({ maxImageBytes: value })).name).toBe(
        'InvalidProtectedConfigurationError',
      );
    }
    /* A misspelt ceiling has to stop the runtime: dropping it would leave the caller believing it
       had configured one. */
    expect(
      ProtectedResourceLimitsSchema.safeParse({ ...DEFAULT_RESOURCE_LIMITS, maxImageSize: 10 })
        .success,
    ).toBe(false);
  });
});

describe('the manifest a runtime is given', () => {
  it('is empty when the caller supplies none, which authorises nothing remote', () => {
    expect(resolveImageManifest(undefined)).toStrictEqual([]);
  });

  it('accepts an entry that names its bytes and an entry that names an https url', () => {
    const manifest: ProtectedImageManifest = [
      {
        kind: 'bytes',
        source: 'asset:logo',
        mediaType: 'image/png',
        bytes: TINY_PNG_BYTES,
        sha256: digest,
      },
      {
        kind: 'https',
        source: 'https://assets.example.com/logo.png',
        mediaType: 'image/png',
        sha256: digest,
      },
    ];
    expect(resolveImageManifest(manifest)).toHaveLength(2);
  });

  it('refuses two entries for one source, rather than keeping the last of them', () => {
    /* A map keyed by source would silently drop one, and the caller would never learn which of its
       two authorisations won. */
    expect(
      refusalOf(() =>
        resolveImageManifest([
          {
            kind: 'https',
            source: 'https://a.example/x.png',
            mediaType: 'image/png',
            sha256: digest,
          },
          {
            kind: 'https',
            source: 'https://a.example/x.png',
            mediaType: 'image/png',
            sha256: digest,
          },
        ]),
      ).name,
    ).toBe('InvalidProtectedConfigurationError');
  });

  it('refuses a digest of the wrong shape', () => {
    for (const sha256 of ['', 'abc', digest.toUpperCase(), `${digest}0`]) {
      expect(
        refusalOf(() =>
          resolveImageManifest([
            { kind: 'https', source: 'https://a.example/x.png', mediaType: 'image/png', sha256 },
          ]),
        ).name,
      ).toBe('InvalidProtectedConfigurationError');
    }
  });

  it('refuses a media type this backend does not print', () => {
    expect(
      refusalOf(() =>
        resolveImageManifest([
          {
            kind: 'https',
            source: 'https://a.example/x.svg',
            /* Svg is a language, and it does not become a bitmap by being listed. */
            mediaType: 'image/svg+xml',
            sha256: digest,
          },
        ]),
      ).name,
    ).toBe('InvalidProtectedConfigurationError');
  });

  it('refuses an entry with no digest at all, rather than computing one for it', () => {
    expect(
      refusalOf(() =>
        resolveImageManifest([
          { kind: 'https', source: 'https://a.example/x.png', mediaType: 'image/png' },
        ]),
      ).name,
    ).toBe('InvalidProtectedConfigurationError');
  });

  it('refuses an entry with a field it did not declare', () => {
    expect(
      refusalOf(() =>
        resolveImageManifest([
          {
            kind: 'https',
            source: 'https://a.example/x.png',
            mediaType: 'image/png',
            sha256: digest,
            headers: { authorization: 'secret' },
          },
        ]),
      ).name,
    ).toBe('InvalidProtectedConfigurationError');
  });
});
