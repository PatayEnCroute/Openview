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
import { acceptedKindsOf } from '../../data-catalogue/expectations.js';
import type { DataCatalogue } from '../../data-catalogue/types.js';
import { DATA_EXPECTATIONS as CATALOGUE_VOCABULARY } from '../../data-catalogue/types.js';
import type { Expression, PrintableExpression } from '../../expression/expression.js';
import * as core from '../../index.js';
import { collectTemplateDataPaths } from '../../template/paths.js';
import type { BlockNode, DocumentNode, DocumentNodeType, TableRowNode } from '../nodes.js';
import { DATA_EXPECTATIONS, nodeShape } from '../shape.js';

const LABEL: PrintableExpression = { kind: 'path', path: 'epreuve.libelle' };
const AMOUNT: PrintableExpression = { kind: 'path', path: 'epreuve.report' };
const FLAG: Expression = { kind: 'path', path: 'epreuve.affiche' };
const SEQUENCE: Expression = { kind: 'path', path: 'epreuve.elements' };

const LEAF: BlockNode = { type: 'text', id: 'leaf', content: [] };
const OTHER_LEAF: BlockNode = { type: 'text', id: 'other-leaf', content: [] };

const HEADER_ROW: TableRowNode = {
  type: 'tableRow',
  id: 'head',
  cells: [{ columnId: 'c', children: [LEAF] }],
};
const FOOTER_ROW: TableRowNode = {
  type: 'tableRow',
  id: 'foot',
  cells: [{ columnId: 'c', children: [LEAF] }],
};
const DETAIL_ROW: TableRowNode = {
  type: 'tableRow',
  id: 'detail',
  cells: [{ columnId: 'c', children: [LEAF] }],
  pageReport: { value: AMOUNT },
};

/**
 * One node per kind, keyed by its own discriminant.
 *
 * A `Record` over `DocumentNodeType` rather than a list: a ninth kind added to the union stops this
 * file compiling until it carries one, which is a stronger guarantee than any count of eight.
 */
const ONE_PER_KIND: Readonly<Record<DocumentNodeType, DocumentNode>> = {
  text: {
    type: 'text',
    id: 'n-text',
    content: [
      { kind: 'literal', text: 'Due: ' },
      { kind: 'binding', value: LABEL },
      { kind: 'pageField', field: 'number' },
    ],
  },
  image: { type: 'image', id: 'n-image', src: 'asset-key' },
  container: { type: 'container', id: 'n-container', children: [LEAF, OTHER_LEAF] },
  loop: { type: 'loop', id: 'n-loop', each: SEQUENCE, as: 'element', children: [LEAF] },
  condition: { type: 'condition', id: 'n-condition', when: FLAG, children: [LEAF] },
  table: {
    type: 'table',
    id: 'n-table',
    columns: [{ id: 'c', width: 1, align: 'start' }],
    header: [HEADER_ROW],
    body: [DETAIL_ROW],
    footer: [FOOTER_ROW],
  },
  tableRowGroup: {
    type: 'tableRowGroup',
    id: 'n-group',
    each: SEQUENCE,
    as: 'poste',
    rows: [DETAIL_ROW],
  },
  tableRow: {
    type: 'tableRow',
    id: 'n-row',
    cells: [
      { columnId: 'c', children: [LEAF] },
      { columnId: 'd', children: [OTHER_LEAF] },
    ],
    pageReport: { value: AMOUNT },
  },
};

describe('nodeShape', () => {
  it('reports the binding runs of a text block, with the index of the segment carrying each', () => {
    // The index is the one in `content`, literals and page markers included: it has to point at
    // the segment a consumer can reach, not at the rank among the bindings alone.
    expect(nodeShape(ONE_PER_KIND.text)).toStrictEqual({
      readings: [{ expression: LABEL, expectation: 'printable', at: ['content', 1, 'value'] }],
      binding: undefined,
      children: [],
    });
  });

  it('reports nothing at all for a picture', () => {
    expect(nodeShape(ONE_PER_KIND.image)).toStrictEqual({
      readings: [],
      binding: undefined,
      children: [],
    });
  });

  it('reports one slot for a container, and reads nothing of its own', () => {
    expect(nodeShape(ONE_PER_KIND.container)).toStrictEqual({
      readings: [],
      binding: undefined,
      children: [{ nodes: [LEAF, OTHER_LEAF], at: ['children'] }],
    });
  });

  it('reports the source of a loop as a reading under the list expectation, and its alias', () => {
    expect(nodeShape(ONE_PER_KIND.loop)).toStrictEqual({
      readings: [],
      binding: {
        source: { expression: SEQUENCE, expectation: 'list', at: ['each'] },
        alias: 'element',
      },
      children: [{ nodes: [LEAF], at: ['children'] }],
    });
  });

  it('requires a boolean of the guard of a condition', () => {
    expect(nodeShape(ONE_PER_KIND.condition)).toStrictEqual({
      readings: [{ expression: FLAG, expectation: 'boolean', at: ['when'] }],
      binding: undefined,
      children: [{ nodes: [LEAF], at: ['children'] }],
    });
  });

  it('reports the three sections of a table as three slots, in flow order', () => {
    expect(nodeShape(ONE_PER_KIND.table)).toStrictEqual({
      readings: [],
      binding: undefined,
      children: [
        { nodes: [HEADER_ROW], at: ['header'] },
        { nodes: [DETAIL_ROW], at: ['body'] },
        { nodes: [FOOTER_ROW], at: ['footer'] },
      ],
    });
  });

  it('reports the source of a row group like a loop, and its rows as one slot', () => {
    expect(nodeShape(ONE_PER_KIND.tableRowGroup)).toStrictEqual({
      readings: [],
      binding: {
        source: { expression: SEQUENCE, expectation: 'list', at: ['each'] },
        alias: 'poste',
      },
      children: [{ nodes: [DETAIL_ROW], at: ['rows'] }],
    });
  });

  it('reports one slot per cell of a row, and requires a number of its contribution', () => {
    expect(nodeShape(ONE_PER_KIND.tableRow)).toStrictEqual({
      readings: [{ expression: AMOUNT, expectation: 'number', at: ['pageReport', 'value'] }],
      binding: undefined,
      children: [
        { nodes: [LEAF], at: ['cells', 0, 'children'] },
        { nodes: [OTHER_LEAF], at: ['cells', 1, 'children'] },
      ],
    });
  });

  it('reports no reading for a row that declares no contribution', () => {
    expect(nodeShape(HEADER_ROW).readings).toStrictEqual([]);
  });

  it('gives every slot and every reading a non-empty path of its own', () => {
    // A slot path of zero segments would make a child collide with its own parent, and a reading
    // path of zero segments would point a diagnostic at the node instead of at the expression.
    for (const [type, node] of Object.entries(ONE_PER_KIND)) {
      const shape = nodeShape(node);
      for (const slot of shape.children) {
        expect(slot.at.length, `${type} child slot`).toBeGreaterThan(0);
      }
      for (const reading of shape.readings) {
        expect(reading.at.length, `${type} reading`).toBeGreaterThan(0);
      }
      expect(shape.binding?.source.at.length ?? 1, `${type} binding`).toBeGreaterThan(0);
    }
  });

  it('gives no kind both readings and a binding, which is why the order of `nodeReads` is declared', () => {
    // The premise of that declared order: no node carries the two at once today, so no test can
    // observe which comes first. The day one does, this goes red and the rule has to be honoured.
    for (const [type, node] of Object.entries(ONE_PER_KIND)) {
      const { readings, binding } = nodeShape(node);
      expect(readings.length === 0 || binding === undefined, type).toBe(true);
    }
  });
});

/**
 * A catalogue declaring one distinct member per declarable position, at the nature that position
 * requires.
 */
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
 * No alias is read inside it on purpose: the two functions compared below treat an alias-rooted
 * path differently by design, and an agreement that held only because both filtered the same name
 * would prove nothing about the positions themselves.
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
    // The test CH3 exists for. Before the refactor, `collectDataPaths` read `READS_VISITOR` and
    // `checkTemplateDataCompatibility` read a separate table, and a position declared in one but
    // not the other produced no compilation error, no red test and no trace at runtime.
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
    // `['body', 0]` and `['rows', 0]` are produced by two different slots, and `['pageReport',
    // 'value']` by a reading: the chain is the whole slot mechanism, end to end.
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

describe('the expectation vocabulary', () => {
  it('is one value, wherever it is imported from', () => {
    // The relocation into `ast/` is a re-export, not a copy. Two arrays with equal contents would
    // satisfy `toStrictEqual` and still be two vocabularies drifting apart.
    expect(CATALOGUE_VOCABULARY).toBe(DATA_EXPECTATIONS);
    expect(core.DATA_EXPECTATIONS).toBe(DATA_EXPECTATIONS);
  });

  it('has an accepted set of natures for every entry it declares', () => {
    for (const expectation of DATA_EXPECTATIONS) {
      expect(acceptedKindsOf(expectation).length, expectation).toBeGreaterThan(0);
    }
  });
});
