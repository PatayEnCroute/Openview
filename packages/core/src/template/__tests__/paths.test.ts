import { describe, expect, it } from 'vitest';
import { collectDataPaths } from '../../ast/visitor.js';
import { RECIPE_PAGE } from '../../page/__tests__/fixtures.js';
import type { PageBand, PageSetup } from '../../page/page.js';
import { parseTemplate } from '../migrate.js';
import { collectTemplateDataPaths } from '../paths.js';
import { CURRENT_SCHEMA_VERSION, type Template } from '../template.js';

/**
 * A band whose single text block prints one path, optionally holding together.
 *
 * The mark is SPREAD rather than assigned, so the unmarked form omits the key instead of carrying
 * it as `undefined` -- absence is the shape every document written before version 8 has.
 */
function readingBand(
  on: PageBand['on'],
  id: string,
  path: string,
  keepTogether?: true | undefined,
): PageBand {
  const mark = keepTogether === undefined ? {} : { keepTogether };
  return {
    on,
    content: {
      type: 'container',
      id,
      ...mark,
      children: [
        {
          type: 'text',
          id: `${id}-txt`,
          ...mark,
          content: [{ kind: 'binding', value: { kind: 'path', path } }],
        },
      ],
    },
  };
}

/** Creates a valid parsed Template with the specified page setup and body paths. */
function templateWith(
  page: PageSetup,
  bodyPaths: readonly string[] = [],
  keepTogether?: true | undefined,
): Template {
  const mark = keepTogether === undefined ? {} : { keepTogether };
  return parseTemplate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_paths',
    name: 'Chemins',
    version: '1.0.0',
    page,
    root: {
      type: 'container',
      id: 'racine',
      ...mark,
      children: bodyPaths.map((path, index) => ({
        type: 'text',
        id: `corps-${index}`,
        ...mark,
        content: [{ kind: 'binding', value: { kind: 'path', path } }],
      })),
    },
  });
}

const emptyPage: PageSetup = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

describe('collectTemplateDataPaths', () => {
  it('reports a binding written in a header', () => {
    // Tests that bindings inside page bands are collected in addition to the root flow.
    const template = templateWith(
      { ...emptyPage, header: [readingBand('every', 'hdr', 'client.nom')] },
      ['facture.total'],
    );

    expect(collectTemplateDataPaths(template)).toStrictEqual(['facture.total', 'client.nom']);
    // The second call is IN the test, explicitly, so the test says what it protects instead
    // of assuming it.
    expect(collectDataPaths(template.root)).toStrictEqual(['facture.total']);
  });

  it('walks `root`, then `header`, then `footer`, in that order', () => {
    // Compared as an ORDERED list, not as a set: an unwritten choice changes by accident, and
    // a consumer that displays this list to a human sees the order.
    const template = templateWith(
      {
        ...emptyPage,
        header: [readingBand('every', 'hdr', 'client.nom')],
        footer: [readingBand('every', 'ftr', 'societe.siret')],
      },
      ['facture.total'],
    );

    expect(collectTemplateDataPaths(template)).toStrictEqual([
      'facture.total',
      'client.nom',
      'societe.siret',
    ]);
  });

  it('de-duplicates across the boundary between the flow and a band', () => {
    const template = templateWith(
      {
        ...emptyPage,
        header: [readingBand('every', 'hdr', 'facture.numero')],
        footer: [readingBand('every', 'ftr', 'facture.numero')],
      },
      ['facture.numero'],
    );

    expect(collectTemplateDataPaths(template)).toStrictEqual(['facture.numero']);
  });

  it('reports NOTHING for a page marker, and that is the whole point', () => {
    // A footer that only prints `Page ⟨number⟩ / ⟨count⟩` demands no key at all. Had page
    // numbering been done by injecting a reserved key into the scope, this function would
    // report `page.numero` -- a key no integrator can supply, displayed on the playground's
    // "required data" screen at the first demonstration.
    const numbering: PageBand = {
      on: 'every',
      content: {
        type: 'container',
        id: 'ftr',
        children: [
          {
            type: 'text',
            id: 'ftr-num',
            content: [
              { kind: 'literal', text: 'Page ' },
              { kind: 'pageField', field: 'number' },
              { kind: 'literal', text: ' / ' },
              { kind: 'pageField', field: 'count' },
            ],
          },
        ],
      },
    };

    expect(
      collectTemplateDataPaths(templateWith({ ...emptyPage, footer: [numbering] })),
    ).toStrictEqual([]);
  });

  it('reports the recipe page in full: two keys, and not one per marker', () => {
    // The recipe model carries FOUR markers and two bindings. Six paths would mean the
    // markers had invented keys; two is the contract.
    const template = templateWith(RECIPE_PAGE);

    expect(collectTemplateDataPaths(template)).toStrictEqual([
      'facture.numero',
      'facture.mentions',
    ]);
  });

  it('applies the loop-alias rule inside a band exactly as in the flow', () => {
    // Tests that loop aliases inside page bands are properly excluded from collected data paths.
    const looping: PageBand = {
      on: 'every',
      content: {
        type: 'container',
        id: 'hdr',
        children: [
          {
            type: 'loop',
            id: 'refs',
            each: { kind: 'path', path: 'facture.references' },
            as: 'ref',
            children: [
              {
                type: 'text',
                id: 'ref-txt',
                content: [{ kind: 'binding', value: { kind: 'path', path: 'ref.libelle' } }],
              },
            ],
          },
        ],
      },
    };

    expect(
      collectTemplateDataPaths(templateWith({ ...emptyPage, header: [looping] })),
    ).toStrictEqual(['facture.references']);
  });

  it('reports nothing for a template whose bands are empty', () => {
    expect(collectTemplateDataPaths(templateWith(emptyPage))).toStrictEqual([]);
  });
});

describe('a fragmentation mark', () => {
  /** The same template twice, with the mark on every container and text it has, or on none. */
  const templateMarked = (keepTogether: true | undefined): Template =>
    templateWith(
      {
        ...emptyPage,
        header: [readingBand('every', 'hdr', 'client.nom', keepTogether)],
        footer: [readingBand('every', 'ftr', 'societe.siret', keepTogether)],
      },
      ['facture.total'],
      keepTogether,
    );

  it('changes not one collected path, in the flow or in a band', () => {
    // The template-level counterpart of the node-level invariance: a page policy is not a key the
    // integrator has to supply, and a band is where that would have been easiest to miss, since
    // this function is the only one that walks one.
    expect(collectTemplateDataPaths(templateMarked(true))).toStrictEqual(
      collectTemplateDataPaths(templateMarked(undefined)),
    );
    expect(collectTemplateDataPaths(templateMarked(true))).toStrictEqual([
      'facture.total',
      'client.nom',
      'societe.siret',
    ]);
  });
});
