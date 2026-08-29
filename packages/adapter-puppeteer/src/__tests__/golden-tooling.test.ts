import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { acceptInto } from '../../../../tools/golden/accept.mjs';
import {
  canonicalDigest,
  canonicalJson,
  digestOf,
  recordOf,
  textRecordOf,
} from '../../../../tools/golden/canonical-json.mjs';
import { CORPUS } from '../../../../tools/golden/corpus.mjs';
import {
  FORMAT_VERSION,
  GENERATOR_VERSION,
  HOST_FIELDS,
  MANIFEST_FILENAME,
  ManifestError,
  OFFICIAL_HOST,
  officialHostMismatches,
  PAGE_EXTRACTOR_VERSION,
  parseManifest,
  REFERENCES_DIRECTORY,
  RENDERER_FIELDS,
  serializeManifest,
} from '../../../../tools/golden/manifest.mjs';
import { extractPage, pageCountOf } from '../../../../tools/golden/pages.mjs';
import { PROFILE_FIELDS } from '../../../../tools/reproducibility/profile.mjs';
import { canonicalizePdf } from '../canonicalize-pdf.js';

const HEX = 'a'.repeat(64);

/** A profile shaped like one the official job produces, so a test can move exactly one thing. */
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
  fonts: [{ id: 'Inter 400 normal', sha256: 'b'.repeat(64) }],
  pdfCanonicalizer: 1,
  launchArguments: ['--no-sandbox'],
};

const digest = { bytes: 12, sha256: HEX };

/** The manifest of a one-document batch: the smallest thing the schema accepts. */
const baseManifest = () => ({
  formatVersion: FORMAT_VERSION,
  generatorVersion: GENERATOR_VERSION,
  pageExtractorVersion: PAGE_EXTRACTOR_VERSION,
  profile: structuredClone(PROFILE),
  documents: [
    {
      id: 'invoice-one-page',
      recipeVersion: 1,
      filename: 'invoice-one-page.pdf',
      inputSha256: HEX,
      pdf: digest,
      html: digest,
      sheet: digest,
      notices: digest,
      pages: [{ number: 1, pdf: digest, pagination: digest }],
    },
  ],
});

/** Parses a hand-built manifest, so a test names the ONE thing it changed. */
const parse = (value: unknown) => parseManifest(JSON.stringify(value), 'manifest.json');

/** The message of the refusal, or a sentinel that makes an accepted input fail loudly. */
function refusal(value: unknown): string {
  try {
    parse(value);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return 'ACCEPTED';
}

const temporary = (prefix: string) => mkdtempSync(join(tmpdir(), `openview-${prefix}-`));

/**
 * A pdf holding exactly `pages` pages, with a distinct mark on each so no two are equal.
 *
 * Canonicalised like a delivered document: `PDFDocument.create()` stamps the moment it ran, and two
 * batches built a second apart would otherwise differ by that alone.
 */
async function pdfOf(pages: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let rank = 1; rank <= pages; rank += 1) {
    document.addPage([300, 400]).drawText(`page ${rank}`, { x: 20, y: 350 });
  }
  return await canonicalizePdf(
    await document.save({ useObjectStreams: false, addDefaultPage: false }),
  );
}

/**
 * A whole candidate batch on disk: six pdfs of the expected lengths, and a manifest that attests
 * exactly them. Synthetic on purpose -- the acceptance is being tested, not the renderer.
 */
async function syntheticBatch(directory: string): Promise<void> {
  const documents = [];
  for (const scenario of CORPUS) {
    const bytes = await pdfOf(scenario.expectedPages);
    writeFileSync(join(directory, scenario.filename), bytes);
    documents.push({
      id: scenario.id,
      recipeVersion: scenario.recipeVersion,
      filename: scenario.filename,
      inputSha256: HEX,
      pdf: recordOf(bytes),
      html: digest,
      sheet: digest,
      notices: digest,
      pages: Array.from({ length: scenario.expectedPages }, (_unused, index) => ({
        number: index + 1,
        pdf: digest,
        pagination: digest,
      })),
    });
  }
  writeFileSync(
    join(directory, MANIFEST_FILENAME),
    serializeManifest({ ...baseManifest(), documents }),
    'utf8',
  );
}

describe('what the manifest schema accepts', () => {
  it('accepts a complete reference and writes it back byte for byte', () => {
    const manifest = baseManifest();
    const text = serializeManifest(manifest);
    expect(serializeManifest(parse(manifest))).toBe(text);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('writes its keys in a fixed order whatever order they were built in', () => {
    const manifest = baseManifest();
    const shuffled = {
      documents: manifest.documents,
      profile: manifest.profile,
      pageExtractorVersion: manifest.pageExtractorVersion,
      generatorVersion: manifest.generatorVersion,
      formatVersion: manifest.formatVersion,
    };
    expect(serializeManifest(parse(shuffled))).toBe(serializeManifest(manifest));
  });

  it('carries the profile through with every one of its thirteen fields', () => {
    const written = parse(baseManifest()).profile;
    expect(Object.keys(written).sort()).toStrictEqual([...PROFILE_FIELDS].sort());
  });
});

describe('what the manifest schema refuses', () => {
  it('names the path of the file and never dumps its content', () => {
    const message = refusal({ ...baseManifest(), formatVersion: 99 });
    expect(message).toContain('manifest.json');
    expect(message).toContain('formatVersion');
    expect(message).not.toContain(HEX);
    expect(message).not.toContain('Chrome/152');
  });

  it.each(['formatVersion', 'generatorVersion', 'pageExtractorVersion'])(
    'refuses a manifest whose %s is not the one this harness writes',
    (field) => {
      expect(refusal({ ...baseManifest(), [field]: 2 })).toContain(field);
    },
  );

  it.each(['formatVersion', 'generatorVersion', 'pageExtractorVersion', 'profile', 'documents'])(
    'refuses a manifest missing %s entirely',
    (field) => {
      const manifest: Record<string, unknown> = baseManifest();
      delete manifest[field];
      expect(refusal(manifest)).toContain(field);
    },
  );

  it('refuses a manifest whose profile lost any one of its fields', () => {
    for (const field of PROFILE_FIELDS) {
      const manifest = baseManifest();
      const profile: Record<string, unknown> = manifest.profile;
      delete profile[field];
      expect(refusal(manifest), `dropping profile.${field} was accepted`).toContain(field);
    }
  });

  it('refuses a manifest carrying no document at all', () => {
    expect(refusal({ ...baseManifest(), documents: [] })).toContain('documents');
  });

  it.each([
    ['a digest that is not hexadecimal', 'inputSha256', 'z'.repeat(64)],
    ['a digest of the wrong length', 'inputSha256', 'a'.repeat(63)],
    ['a digest in upper case', 'inputSha256', 'A'.repeat(64)],
    ['an absolute path as a filename', 'filename', '/etc/passwd.pdf'],
    ['a parent traversal as a filename', 'filename', '../invoice-one-page.pdf'],
    ['a windows path as a filename', 'filename', 'C:\\tmp\\one.pdf'],
    ['a filename that is not a pdf', 'filename', 'invoice-one-page.txt'],
    ['an upper-case id', 'id', 'Invoice-One-Page'],
    ['an id carrying an underscore', 'id', 'invoice_one_page'],
    ['a recipe version of zero', 'recipeVersion', 0],
    ['a negative recipe version', 'recipeVersion', -1],
  ])('refuses %s', (_name, field, value) => {
    const manifest = baseManifest();
    const [document] = manifest.documents;
    if (document === undefined) {
      throw new Error('the base manifest carries one document');
    }
    expect(refusal({ ...manifest, documents: [{ ...document, [field]: value }] })).toContain(field);
  });

  it('refuses a negative length and a length of zero', () => {
    const manifest = baseManifest();
    const [document] = manifest.documents;
    if (document === undefined) {
      throw new Error('the base manifest carries one document');
    }
    for (const bytes of [-1, 0]) {
      const broken = { ...document, pdf: { bytes, sha256: HEX } };
      expect(refusal({ ...manifest, documents: [broken] })).toContain('bytes');
    }
  });

  it('refuses pages that do not run 1..N in order', () => {
    const manifest = baseManifest();
    const [document] = manifest.documents;
    if (document === undefined) {
      throw new Error('the base manifest carries one document');
    }
    for (const numbers of [[2], [1, 3], [2, 1]]) {
      const pages = numbers.map((number) => ({ number, pdf: digest, pagination: digest }));
      expect(refusal({ ...manifest, documents: [{ ...document, pages }] })).toContain('pages');
    }
  });

  it('refuses two documents sharing one id, and two sharing one filename', () => {
    const manifest = baseManifest();
    const [document] = manifest.documents;
    if (document === undefined) {
      throw new Error('the base manifest carries one document');
    }
    const other = { ...document, id: 'invoice-sixty-bare', filename: 'invoice-sixty-bare.pdf' };
    expect(
      refusal({ ...manifest, documents: [document, { ...other, id: document.id }] }),
    ).toContain('one id');
    expect(
      refusal({ ...manifest, documents: [document, { ...other, filename: document.filename }] }),
    ).toContain('one filename');
  });

  it('refuses a key the schema does not know, at the root and inside a document', () => {
    const manifest = baseManifest();
    const [document] = manifest.documents;
    if (document === undefined) {
      throw new Error('the base manifest carries one document');
    }
    expect(refusal({ ...manifest, note: 'benign' })).toContain('note');
    expect(refusal({ ...manifest, documents: [{ ...document, note: 'benign' }] })).toContain(
      'note',
    );
  });

  it('refuses a file that is not json at all, without dumping it', () => {
    const thrown = (): ManifestError => {
      try {
        parseManifest('{ not json', 'broken.json');
      } catch (error) {
        if (error instanceof ManifestError) {
          return error;
        }
      }
      throw new Error('a non-json manifest was accepted');
    };
    const error = thrown();
    expect(error.message).toContain('broken.json');
    expect(error.issues.length).toBe(1);
  });
});

describe('the closed json serialisation', () => {
  it('writes the same bytes whatever order the keys were inserted in', () => {
    const one = { beta: 1, alpha: { z: [1, 2], a: 'x' } };
    const other = { alpha: { a: 'x', z: [1, 2] }, beta: 1 };
    expect(canonicalJson(one)).toBe(canonicalJson(other));
    expect(canonicalDigest(one)).toBe(canonicalDigest(other));
  });

  it('keeps the order of an array, because a permuted array is another document', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('carries null, booleans, finite numbers, strings, arrays and objects', () => {
    expect(canonicalJson({ a: null, b: true, c: -0.5, d: 'x', e: [], f: {} })).toBe(
      '{"a":null,"b":true,"c":-0.5,"d":"x","e":[],"f":{}}',
    );
  });

  it.each([
    ['undefined', undefined],
    ['a function', () => 1],
    ['a symbol', Symbol('x')],
    ['a bigint', 1n],
    ['NaN', Number.NaN],
    ['an infinity', Number.POSITIVE_INFINITY],
  ])('refuses %s rather than dropping it', (_name, value) => {
    expect(() => canonicalJson({ field: value })).toThrow(/field/);
  });

  it('refuses a cycle, naming the path that closes it', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/cycle/);
  });

  it('serialises the same object reached twice down two branches', () => {
    const shared = { a: 1 };
    expect(canonicalJson({ left: shared, right: shared })).toBe('{"left":{"a":1},"right":{"a":1}}');
  });

  it('measures a string in utf-8 bytes, never in utf-16 code units', () => {
    /* Two code units, three bytes: the two lengths differ, and only one of them is the file. */
    expect(textRecordOf('\u20ac').bytes).toBe(3);
    expect(textRecordOf('\u20ac').sha256).toBe(digestOf(Buffer.from('\u20ac', 'utf8')));
  });

  it('records the length of a byte string as its length', () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    expect(recordOf(bytes)).toStrictEqual({ bytes: 3, sha256: digestOf(bytes) });
  });
});

describe('the single-page extractor', () => {
  it('reads how many pages a document really holds', async () => {
    expect(await pageCountOf(await pdfOf(1))).toBe(1);
    expect(await pageCountOf(await pdfOf(4))).toBe(4);
  });

  it('extracts the same bytes twice from the same document', async () => {
    const bytes = await pdfOf(4);
    expect(digestOf(await extractPage(bytes, 2))).toBe(digestOf(await extractPage(bytes, 2)));
  });

  it('extracts the same bytes from two identical documents', async () => {
    const [left, right] = [await pdfOf(4), await pdfOf(4)];
    expect(digestOf(left)).toBe(digestOf(right));
    expect(digestOf(await extractPage(left, 3))).toBe(digestOf(await extractPage(right, 3)));
  });

  it('keeps the ranks apart: 1..N give N distinct documents', async () => {
    const bytes = await pdfOf(4);
    const digests = new Set<string>();
    for (let rank = 1; rank <= 4; rank += 1) {
      digests.add(digestOf(await extractPage(bytes, rank)));
      expect(await pageCountOf(await extractPage(bytes, rank))).toBe(1);
    }
    expect(digests.size).toBe(4);
  });

  it.each([0, 5, 1.5, Number.NaN])('refuses rank %s, naming it', async (rank) => {
    await expect(extractPage(await pdfOf(4), rank)).rejects.toThrow(/page/);
  });

  it('fixes the metadata and leaves no trailer identifier behind', async () => {
    const isolated = await extractPage(await pdfOf(2), 1);
    const reloaded = await PDFDocument.load(isolated, { updateMetadata: false });
    expect(reloaded.getProducer()).toBe('Openview');
    expect(reloaded.getTitle()).toBe('Openview');
    expect(reloaded.getCreationDate()?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(reloaded.context.trailerInfo.ID).toBeUndefined();
  });
});

describe('what the acceptance refuses', () => {
  it('refuses a candidate that is not a directory', () => {
    const target = temporary('accept-target');
    expect(() => acceptInto(join(target, 'absent'), target)).toThrow(/not a directory/);
  });

  it('refuses a target that is not a directory', async () => {
    const candidate = temporary('accept-candidate');
    await syntheticBatch(candidate);
    expect(() => acceptInto(candidate, join(candidate, 'absent'))).toThrow(/not a directory/);
  });

  it('refuses a candidate whose manifest is invalid', () => {
    const candidate = temporary('accept-invalid');
    writeFileSync(join(candidate, MANIFEST_FILENAME), '{}', 'utf8');
    expect(() => acceptInto(candidate, temporary('accept-target'))).toThrow(/not a valid/);
  });

  it('refuses a candidate whose pdf is not the file its own manifest attests', async () => {
    const candidate = temporary('accept-tampered');
    await syntheticBatch(candidate);
    const [first] = CORPUS;
    if (first === undefined) {
      throw new Error('the register carries at least one scenario');
    }
    writeFileSync(join(candidate, first.filename), await pdfOf(first.expectedPages + 1));
    expect(() => acceptInto(candidate, temporary('accept-target'))).toThrow(/attests/);
  });

  it('refuses a candidate missing one of the six documents', async () => {
    const candidate = temporary('accept-short');
    await syntheticBatch(candidate);
    const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    manifest.documents = manifest.documents.slice(0, 5);
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');
    expect(() => acceptInto(candidate, temporary('accept-target'))).toThrow(/register lists/);
  });

  it('refuses a candidate carrying a pdf no manifest entry names', async () => {
    const candidate = temporary('accept-extra');
    await syntheticBatch(candidate);
    writeFileSync(join(candidate, 'orphan.pdf'), await pdfOf(1));
    expect(() => acceptInto(candidate, temporary('accept-target'))).toThrow(/orphan\.pdf/);
  });

  it.each(['platform', 'architecture', 'node', 'launchArguments'])(
    'refuses a candidate whose %s is not the official host',
    async (field) => {
      const candidate = temporary('accept-host');
      await syntheticBatch(candidate);
      const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
      manifest.profile[field] = field === 'launchArguments' ? [] : 'elsewhere';
      writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');
      expect(() => acceptInto(candidate, temporary('accept-target'))).toThrow(
        new RegExp(`profile\\.${field}`),
      );
    },
  );
});

describe('what the acceptance does when it accepts', () => {
  it('replaces every named file and the manifest, and deletes nothing else', async () => {
    const candidate = temporary('accept-good');
    const target = temporary('accept-into');
    await syntheticBatch(candidate);
    /* A previous batch, plus a file that belongs to nobody: the promotion must overwrite the six
       and leave the stranger alone rather than tidy the directory on its own. */
    for (const scenario of CORPUS) {
      writeFileSync(join(target, scenario.filename), await pdfOf(1));
    }
    writeFileSync(join(target, 'README.md'), 'kept', 'utf8');

    const written = acceptInto(candidate, target);
    expect([...written].sort()).toStrictEqual(
      [MANIFEST_FILENAME, ...CORPUS.map((scenario) => scenario.filename)].sort(),
    );
    for (const scenario of CORPUS) {
      expect(digestOf(readFileSync(join(target, scenario.filename)))).toBe(
        digestOf(readFileSync(join(candidate, scenario.filename))),
      );
    }
    expect(readFileSync(join(target, 'README.md'), 'utf8')).toBe('kept');
    /* No shadow of the transaction survives it. */
    expect(readdirSync(target).filter((entry) => entry.includes('.incoming'))).toStrictEqual([]);
    expect(readdirSync(target).filter((entry) => entry.includes('.outgoing'))).toStrictEqual([]);
  });

  it('writes a manifest the reader accepts back', async () => {
    const candidate = temporary('accept-roundtrip');
    const target = temporary('accept-roundtrip-into');
    await syntheticBatch(candidate);
    acceptInto(candidate, target);
    expect(() =>
      parseManifest(readFileSync(join(target, MANIFEST_FILENAME), 'utf8'), 'm'),
    ).not.toThrow();
  });
});

describe('the profile the batch is qualified by', () => {
  it('splits the thirteen fields into a host half and a renderer half, losing none', () => {
    expect([...HOST_FIELDS, ...RENDERER_FIELDS].sort()).toStrictEqual([...PROFILE_FIELDS].sort());
    expect(HOST_FIELDS.filter((field) => RENDERER_FIELDS.includes(field))).toStrictEqual([]);
  });

  it('accepts the official host and names whichever field leaves it', () => {
    expect(officialHostMismatches(PROFILE)).toStrictEqual([]);
    for (const field of Object.keys(OFFICIAL_HOST)) {
      const moved = { ...PROFILE, [field]: field === 'launchArguments' ? [] : 'elsewhere' };
      expect(officialHostMismatches(moved)).toStrictEqual([field]);
    }
  });

  it('resolves the reference directory from the tool, not from the working directory', () => {
    expect(REFERENCES_DIRECTORY.replaceAll('\\', '/')).toContain('tests/golden/e7/references');
  });
});
