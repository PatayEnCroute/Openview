import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The two packages that must know nothing of a dataset, tests excluded. */
const ROOTS = [
  join(import.meta.dirname, '..'),
  join(import.meta.dirname, '..', '..', '..', 'adapter-puppeteer', 'src'),
];

function sourcesOf(root: string): readonly string[] {
  const found: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== '__tests__') {
          walk(path);
        }
        continue;
      }
      if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.spec.ts')) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

const SOURCES = ROOTS.flatMap((root) => sourcesOf(root)).map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

/**
 * Names that belong to a dataset, to a fixture or to a trade -- never to Openview.
 *
 * A field name in the engine would force every integrator to spell their data the way this repo
 * happens to spell its recette, which is exactly the thing the scope rule forbids.
 */
const RESERVED = [
  'invoice',
  'facture',
  'order.rows',
  'commande',
  'lignes',
  'holder',
  'issuer',
  'reductionRate',
  'termDays',
  'unitPrice',
  'prixUnitaire',
];

/** Words a page marker must not turn into a reserved key of the data. */
const NOT_A_DATA_KEY = ["'page'", "'total'", "'lines'", "'pageNumber'"];

describe('the engine and its adapter know no dataset', () => {
  it('reads at least one source file, so an empty sweep cannot pass', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it.each(RESERVED)('never names %s', (name) => {
    /* Whole words only: `placeholder` is not the field `holder`, and a substring match would make
       this sweep unmaintainable rather than strict. */
    const word = new RegExp(String.raw`\b${name.replaceAll('.', String.raw`\.`)}\b`);
    /* The witness proves the pattern really matches, so a mangled escape cannot pass this sweep by
       finding nothing anywhere. */
    expect(word.test(`const x = '${name}';`)).toBe(true);
    const offenders = SOURCES.filter((source) => word.test(source.text)).map(
      (source) => source.path,
    );
    expect(offenders).toStrictEqual([]);
  });

  it.each(NOT_A_DATA_KEY)('never reserves %s as a key of the host data', (literal) => {
    /* `pageNumber` is a field of a refusal, and `page` names the geometry of a sheet; neither may
       appear as a string the engine looks up in the caller's dataset. */
    const offenders = SOURCES.filter(
      (source) => source.text.includes(`data[${literal}]`) || source.text.includes(`.${literal}]`),
    ).map((source) => source.path);
    expect(offenders).toStrictEqual([]);
  });

  it('declares no schema for the dataset of the caller', () => {
    const offenders = SOURCES.filter(
      (source) => source.text.includes('RenderDataSchema') || source.text.includes('DataSchema'),
    ).map((source) => source.path);
    expect(offenders).toStrictEqual([]);
  });

  it('reads neither a clock, a locale nor a random source', () => {
    const forbidden = ['Date.now', 'Math.random', 'process.env', 'new Date(', 'toLocale'];
    for (const name of forbidden) {
      const offenders = SOURCES.filter((source) => source.text.includes(name)).map(
        (source) => source.path,
      );
      expect(offenders).toStrictEqual([]);
    }
  });
});
