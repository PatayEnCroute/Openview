/**
 * The two public readers of the AST, checked against each other.
 *
 * `collectTemplateDataPaths` and `checkTemplateDataCompatibility` answer independent contracts over
 * the same node positions. Their agreement is a fact, not a reformulation of either one -- and it is
 * what a position declared to one traversal and forgotten by the other would break.
 */
import { describe, expect, it } from 'vitest';
import {
  binding,
  condition,
  container,
  field,
  image,
  listOf,
  loop,
  path,
  record,
  rowGroupTable,
  staticText,
  templateOf,
} from '../../data-catalogue/__tests__/fixtures.js';
import { checkTemplateDataCompatibility } from '../../data-catalogue/compatibility.js';
import type { DataCatalogue } from '../../data-catalogue/types.js';
import { collectTemplateDataPaths } from '../paths.js';

/** A catalogue declaring one distinct member per declarable position, at the nature it requires. */
const PROOF_CATALOGUE: DataCatalogue = {
  fields: [
    field(
      'epreuve',
      'Épreuve',
      record([
        field('libelle', 'Libellé', { kind: 'string' }),
        field('affiche', 'Affiché', { kind: 'boolean' }),
        field('elements', 'Éléments', listOf({ kind: 'string' })),
        field(
          'postes',
          'Postes',
          listOf(record([field('montant', 'Montant', { kind: 'number' })])),
        ),
        field('report', 'Report', { kind: 'number' }),
      ]),
    ),
  ],
};

/**
 * A model reading a distinct catalogue member at every position a node can declare, and nothing
 * anywhere else.
 *
 * No alias is read inside it on purpose: the two functions treat an alias-rooted path differently by
 * design, and an agreement that held only because both filtered the same name would prove nothing
 * about the positions themselves.
 */
function proofTemplate() {
  return templateOf(
    container([
      binding(path('epreuve.libelle')),
      condition(path('epreuve.affiche'), [staticText()]),
      loop(path('epreuve.elements'), 'element', [staticText()]),
      rowGroupTable(path('epreuve.postes'), 'poste', [staticText()], path('epreuve.report')),
      image(),
    ]),
  );
}

describe('the two public readers of the AST', () => {
  it('report the same paths, from the same five positions', () => {
    const template = proofTemplate();
    const found = checkTemplateDataCompatibility(template, PROOF_CATALOGUE);

    expect(new Set(collectTemplateDataPaths(template))).toStrictEqual(
      new Set(found.reads.map((read) => read.writtenPath)),
    );
    // The count matters on its own: two functions that both lose a position still agree.
    expect(found.reads).toHaveLength(5);
  });

  it('carry the expectation of each position, and not merely an expectation', () => {
    const found = checkTemplateDataCompatibility(proofTemplate(), PROOF_CATALOGUE);

    expect(
      Object.fromEntries(found.reads.map((read) => [read.writtenPath, read.expectation])),
    ).toStrictEqual({
      'epreuve.libelle': 'printable',
      'epreuve.affiche': 'boolean',
      'epreuve.elements': 'list',
      'epreuve.postes': 'list',
      'epreuve.report': 'number',
    });
    // Every reading lands, which is the same statement checked against the catalogue rather than
    // against this file: a wrong expectation would refuse a declared member here.
    expect(found.compatible).toBe(true);
    expect(found.reads.every((read) => read.status === 'available')).toBe(true);
  });

  it('point at a contribution through three levels of slot', () => {
    // `['body', 0]` and `['rows', 0]` are produced by two different slots, and
    // `['pageReport', 'value']` by a reading: the chain is the whole slot mechanism, end to end.
    const found = checkTemplateDataCompatibility(proofTemplate(), PROOF_CATALOGUE);
    const contribution = found.reads.find((read) => read.writtenPath === 'epreuve.report');

    expect(contribution?.path).toStrictEqual([
      'root',
      'children',
      3,
      'body',
      0,
      'rows',
      0,
      'pageReport',
      'value',
    ]);
  });
});
