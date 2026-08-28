import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROFILE_FIELDS, serializeProfile } from '../../../../tools/reproducibility/profile.mjs';

const TOOLS = join(import.meta.dirname, '..', '..', '..', '..', 'tools', 'reproducibility');

/** A profile shaped like one a real run produces, so a test can remove exactly one thing from it. */
const PROFILE = {
  platform: 'linux',
  architecture: 'x64',
  node: '24.11.1',
  v8: '13.6.233.10-node.28',
  icu: '77.1',
  unicode: '16.0',
  engine: '0.1.0',
  adapter: '0.1.0',
  puppeteer: '25.8.0',
  chromium: 'Chrome/152.0.7977.42',
  fonts: [
    { id: 'inter-4.1 400 normal', sha256: 'a'.repeat(64) },
    { id: 'noto-sans-2.015 400 normal', sha256: 'b'.repeat(64) },
  ],
  pdfCanonicalizer: 1,
  launchArguments: ['--no-sandbox'],
};

const manifestOf = (profile: unknown) => ({
  profile,
  renders: [
    {
      document: 'statement',
      pages: 4,
      html: { bytes: 10, sha256: 'c'.repeat(64) },
      pdf: [{ bytes: 20, sha256: 'd'.repeat(64) }],
    },
  ],
});

/** Runs the comparator on two manifests and answers what it decided. */
function compare(left: unknown, right: unknown): { code: number; output: string } {
  const directory = mkdtempSync(join(tmpdir(), 'openview-profile-'));
  const first = join(directory, 'first.json');
  const second = join(directory, 'second.json');
  writeFileSync(first, JSON.stringify(left), 'utf8');
  writeFileSync(second, JSON.stringify(right), 'utf8');
  try {
    const output = execFileSync(process.execPath, [join(TOOLS, 'compare.mjs'), first, second], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (error: unknown) {
    /* Refined rather than asserted: what `execFileSync` throws is `unknown`, and reading a field
       off it without checking is exactly the cast AGENTS.md forbids. */
    const failure = error instanceof Error ? error : undefined;
    const status = failure !== undefined && 'status' in failure ? failure.status : undefined;
    const stdout = failure !== undefined && 'stdout' in failure ? failure.stdout : undefined;
    const stderr = failure !== undefined && 'stderr' in failure ? failure.stderr : undefined;
    return {
      code: typeof status === 'number' ? status : 1,
      output: `${typeof stdout === 'string' ? stdout : ''}${typeof stderr === 'string' ? stderr : ''}`,
    };
  }
}

describe('the shape of a reproducibility profile', () => {
  it('names every field an attestation needs, and no fewer', () => {
    /* Spelt out rather than derived from the profile builder: a field silently dropped from both
       at once would leave the comparator blind and this list is what refuses that. */
    expect([...PROFILE_FIELDS].sort()).toStrictEqual(
      [
        'adapter',
        'architecture',
        'chromium',
        'engine',
        'fonts',
        'icu',
        'launchArguments',
        'node',
        'pdfCanonicalizer',
        'platform',
        'puppeteer',
        'unicode',
        'v8',
      ].sort(),
    );
  });

  it('serialises its keys in a fixed order, whatever order they were built in', () => {
    /* The same profile with every key written in the opposite order. Spelt out rather than
       shuffled at run time, so it is still a whole profile and the compiler says so. */
    const reversed: typeof PROFILE = {
      launchArguments: PROFILE.launchArguments,
      pdfCanonicalizer: PROFILE.pdfCanonicalizer,
      fonts: PROFILE.fonts,
      chromium: PROFILE.chromium,
      puppeteer: PROFILE.puppeteer,
      adapter: PROFILE.adapter,
      engine: PROFILE.engine,
      unicode: PROFILE.unicode,
      icu: PROFILE.icu,
      v8: PROFILE.v8,
      node: PROFILE.node,
      architecture: PROFILE.architecture,
      platform: PROFILE.platform,
    };
    expect(serializeProfile(reversed)).toBe(serializeProfile(PROFILE));
    const keys = [...serializeProfile(PROFILE).matchAll(/^ {2}"([a-zA-Z0-9]+)":/gm)].map(
      (match) => match[1],
    );
    expect(keys).toStrictEqual([...PROFILE_FIELDS]);
  });
});

describe('what the comparator refuses before it reads a digest', () => {
  it('accepts two runs that share a profile and produced the same bytes', () => {
    const { code } = compare(manifestOf(PROFILE), manifestOf(PROFILE));
    expect(code).toBe(0);
  });

  it('refuses a manifest that carries no field of the profile at all', () => {
    for (const field of PROFILE_FIELDS) {
      const stripped: Record<string, unknown> = { ...PROFILE };
      delete stripped[field];
      const { code, output } = compare(manifestOf(PROFILE), manifestOf(stripped));
      expect(code, `dropping ${field} was accepted`).not.toBe(0);
      expect(output).toContain(field);
    }
  });

  it.each([
    ['node', '24.12.0'],
    ['icu', '78.1'],
    ['unicode', '17.0'],
    ['v8', '13.7.0'],
    ['chromium', 'Chrome/153.0.0.0'],
    ['platform', 'darwin'],
    ['architecture', 'arm64'],
    ['engine', '0.2.0'],
    ['adapter', '0.2.0'],
    ['puppeteer', '26.0.0'],
    ['pdfCanonicalizer', 2],
  ])('refuses two runs whose %s differs, before comparing any digest', (field, value) => {
    const { code, output } = compare(
      manifestOf(PROFILE),
      manifestOf({ ...PROFILE, [field]: value }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain(`profile.${field}`);
    expect(output).toContain('their bytes say nothing');
  });

  it('refuses two runs whose launch arguments differ', () => {
    const { code, output } = compare(
      manifestOf(PROFILE),
      manifestOf({ ...PROFILE, launchArguments: [] }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('profile.launchArguments');
  });

  it('refuses two runs embedding a different face, naming the face', () => {
    const swapped = {
      ...PROFILE,
      fonts: [PROFILE.fonts[0], { id: 'noto-sans-2.015 400 normal', sha256: 'e'.repeat(64) }],
    };
    const { code, output } = compare(manifestOf(PROFILE), manifestOf(swapped));
    expect(code).not.toBe(0);
    expect(output).toContain('noto-sans-2.015 400 normal');
  });

  it('refuses two runs embedding a different number of faces', () => {
    const fewer = { ...PROFILE, fonts: [PROFILE.fonts[0]] };
    const { code, output } = compare(manifestOf(PROFILE), manifestOf(fewer));
    expect(code).not.toBe(0);
    expect(output).toContain('profile.fonts');
  });
});

describe('what the comparator refuses once the profiles agree', () => {
  it('refuses two runs that produced different pdf bytes', () => {
    const other = manifestOf(PROFILE);
    other.renders[0]?.pdf.splice(0, 1, { bytes: 21, sha256: 'f'.repeat(64) });
    const { code, output } = compare(manifestOf(PROFILE), other);
    expect(code).not.toBe(0);
    expect(output).toContain('did not produce the same document');
  });

  it('refuses two runs that published different html', () => {
    const other = manifestOf(PROFILE);
    const render = other.renders[0];
    if (render !== undefined) {
      other.renders[0] = { ...render, html: { bytes: 10, sha256: '9'.repeat(64) } };
    }
    const { code, output } = compare(manifestOf(PROFILE), other);
    expect(code).not.toBe(0);
    expect(output).toContain('published html');
  });

  it('refuses two runs that cut the document into a different number of pages', () => {
    const other = manifestOf(PROFILE);
    const render = other.renders[0];
    if (render !== undefined) {
      other.renders[0] = { ...render, pages: 5 };
    }
    const { code, output } = compare(manifestOf(PROFILE), other);
    expect(code).not.toBe(0);
    expect(output).toContain('pages against');
  });

  it('refuses a manifest that carries no render at all', () => {
    const { code, output } = compare(manifestOf(PROFILE), { profile: PROFILE, renders: [] });
    expect(code).not.toBe(0);
    expect(output).toContain('carries no render');
  });
});
