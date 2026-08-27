/**
 * The reference recipe template fixture shared across ast tests.
 *
 * Provides constants and builders for table, node, and visitor test suites.
 */

import type {
  ArithmeticExpression,
  PathExpression,
  PrintableExpression,
  RoundExpression,
} from '../../expression/expression.js';
import { STANDARD_SHEETS_MM } from '../../page/page.js';
import type { Typography } from '../../style/style.js';
import { CURRENT_SCHEMA_VERSION, type Template } from '../../template/template.js';
import type {
  BlockNode,
  DocumentNode,
  DocumentNodeType,
  TableCell,
  TableNode,
  TextNode,
  TextSegment,
} from '../nodes.js';

/** True only when each type accepts the other; `false` otherwise, which fails to assign. */
export type MutuallyAssignable<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;

const lit = (text: string): TextSegment => ({ kind: 'literal', text });
const bind = (value: PrintableExpression): TextSegment => ({ kind: 'binding', value });

/** Minimal style rule fixture used across test tables. */
const RULE = { width: 0.28, color: '#1b3a6f' } as const;
const litStyled = (text: string, typography: Typography): TextSegment => ({
  kind: 'literal',
  text,
  typography,
});
const p = (path: string): PathExpression => ({ kind: 'path', path });
const txt = (id: string, content: readonly TextSegment[]): TextNode => ({
  type: 'text',
  id,
  content,
});
const cell = (columnId: string, ...children: readonly BlockNode[]): TableCell => ({
  columnId,
  children,
});
const round = (value: PrintableExpression, decimals: number): RoundExpression => ({
  kind: 'round',
  value,
  decimals,
  mode: 'halfExpand',
});
const mul = (left: PrintableExpression, right: PrintableExpression): ArithmeticExpression => ({
  kind: 'arithmetic',
  op: 'mul',
  left,
  right,
});

/** round(quantite * prixUnitaire, 2, halfExpand) -- the line amount, DECLARED. */
const montantLigne = round(mul(p('ligne.quantite'), p('ligne.prixUnitaire')), 2);

/** Aggregate sum expression for total lines calculation test fixture. */
const totalDeclare = round(
  {
    kind: 'aggregate',
    op: 'sum',
    source: p('facture.lignes'),
    as: 'ligne',
    value: round(mul(p('ligne.quantite'), p('ligne.prixUnitaire')), 2),
  },
  2,
);

// The five columns below -- designation, quantite, prixUnitaire, remise, montant --
// represent standard test data. Openview enforces no reserved column names or structure.
export const RECIPE_TABLE: TableNode = {
  type: 'table',
  id: 'lignes',
  box: { border: { top: RULE, bottom: RULE } },
  columns: [
    { id: 'designation', width: 8, align: 'start' },
    { id: 'quantite', width: 2, align: 'end' },
    { id: 'prixUnitaire', width: 3, align: 'end' },
    { id: 'remise', width: 2, align: 'end' },
    { id: 'montant', width: 3, align: 'end' },
  ],
  header: [
    {
      type: 'tableRow',
      id: 'entete',
      box: { background: '#F2F4F8', padding: { top: 1, right: 1, bottom: 1, left: 1 } },
      cells: [
        cell('designation', txt('th-designation', [lit('Désignation')])),
        cell('quantite', txt('th-quantite', [lit('Quantité')])),
        cell('prixUnitaire', txt('th-prix', [lit('Prix unitaire')])),
        cell('remise', txt('th-remise', [lit('Remise')])),
        cell('montant', txt('th-montant', [lit('Montant')])),
      ],
    },
  ],
  body: [
    {
      type: 'tableRowGroup',
      id: 'corps',
      each: p('facture.lignes'),
      as: 'ligne',
      rows: [
        {
          type: 'tableRow',
          id: 'ligne-detail',
          cells: [
            cell('designation', txt('td-designation', [bind(p('ligne.designation'))])),
            cell('quantite', txt('td-quantite', [bind(p('ligne.quantite'))])),
            cell('prixUnitaire', txt('td-prix', [bind(p('ligne.prixUnitaire'))])),
            cell('remise', txt('td-remise', [bind(p('ligne.remise'))])),
            cell('montant', txt('td-montant', [bind(montantLigne)])),
          ],
        },
      ],
    },
  ],
  footer: [
    // A short row: two cells for five columns.
    {
      type: 'tableRow',
      id: 'ligne-total',
      cells: [
        cell('designation', txt('tf-libelle', [lit('Total')])),
        cell('montant', {
          type: 'text',
          id: 'tf-montant',
          box: { border: { top: RULE }, padding: { top: 1, right: 0, bottom: 0, left: 0 } },
          typography: { family: 'EB Garamond', sizePt: 11 },
          align: 'end',
          content: [{ kind: 'binding', value: totalDeclare, typography: { bold: true } }],
        }),
      ],
    },
  ],
};

export const RECIPE_TEMPLATE: Template = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'facture-c3',
  name: 'Facture — tableau de lignes',
  version: '1.0.0',
  page: {
    sheet: { ...STANDARD_SHEETS_MM.a4 },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'racine',
    box: { padding: { top: 0, right: 0, bottom: 4, left: 0 } },
    children: [
      txt('titre', [
        litStyled('Facture ', { sizePt: 18, bold: true }),
        {
          kind: 'binding',
          value: p('facture.numero'),
          typography: { sizePt: 18, color: '#1b3a6f' },
        },
      ]),
      RECIPE_TABLE,
    ],
  },
};

/**
 * A nested tree carrying a loop, a condition and a text binding under a shared alias.
 *
 * Held here rather than in a test file because the dispatch tests and the derived-traversal tests
 * both read it: two copies would let one of the two silently test a different shape.
 */
export const DISCOUNT_TREE: DocumentNode = {
  type: 'container',
  id: 'root',
  children: [
    { type: 'text', id: 'title', content: [{ kind: 'literal', text: 'Invoice' }] },
    {
      type: 'loop',
      id: 'lines',
      each: { kind: 'path', path: 'invoice.lines' },
      as: 'line',
      children: [
        { type: 'image', id: 'thumb', src: 'thumb.png' },
        {
          type: 'condition',
          id: 'discounted',
          when: {
            kind: 'compare',
            op: 'gt',
            left: { kind: 'path', path: 'line.discount' },
            right: { kind: 'literal', value: 0 },
          },
          children: [
            {
              type: 'text',
              id: 'label',
              content: [
                { kind: 'literal', text: 'Discount: ' },
                { kind: 'binding', value: { kind: 'path', path: 'line.discount' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const EMPTY_TEXT: BlockNode = { type: 'text', id: 'leaf', content: [] };
const OTHER_EMPTY_TEXT: BlockNode = { type: 'text', id: 'other-leaf', content: [] };
const ONE_CELL = [{ columnId: 'c', children: [EMPTY_TEXT] }];
const SEQUENCE: PathExpression = p('proof.elements');

/**
 * One node per kind, keyed by its own discriminant.
 *
 * The value type is `Extract<DocumentNode, { type: K }>` and not the whole union: the key then holds
 * the discriminant at compile time, so an entry cannot sit under the wrong kind, and a reader gets
 * the narrowed node back. A ninth kind added to the union stops every consumer of this compiling
 * until it carries one -- stronger than any count of eight.
 */
export const ONE_NODE_PER_KIND: {
  readonly [K in DocumentNodeType]: Extract<DocumentNode, { type: K }>;
} = {
  text: {
    type: 'text',
    id: 'n-text',
    content: [
      { kind: 'literal', text: 'Due: ' },
      { kind: 'binding', value: p('proof.label') },
      { kind: 'pageField', field: 'number' },
    ],
  },
  image: { type: 'image', id: 'n-image', src: 'asset-key' },
  container: { type: 'container', id: 'n-container', children: [EMPTY_TEXT, OTHER_EMPTY_TEXT] },
  loop: { type: 'loop', id: 'n-loop', each: SEQUENCE, as: 'element', children: [EMPTY_TEXT] },
  condition: {
    type: 'condition',
    id: 'n-condition',
    when: p('proof.shown'),
    children: [EMPTY_TEXT],
  },
  table: {
    type: 'table',
    id: 'n-table',
    columns: [{ id: 'c', width: 1, align: 'start' }],
    header: [{ type: 'tableRow', id: 'n-head', cells: ONE_CELL }],
    body: [{ type: 'tableRow', id: 'n-body', cells: ONE_CELL }],
    footer: [{ type: 'tableRow', id: 'n-foot', cells: ONE_CELL }],
  },
  grid: {
    type: 'grid',
    id: 'n-grid',
    columns: 2,
    rows: 2,
    step: 12,
    items: [
      { row: 1, column: 1, content: { type: 'container', id: 'n-zone', children: [EMPTY_TEXT] } },
      {
        row: 2,
        column: 2,
        content: { type: 'container', id: 'n-other-zone', children: [OTHER_EMPTY_TEXT] },
      },
    ],
  },
  tableRowGroup: {
    type: 'tableRowGroup',
    id: 'n-group',
    each: SEQUENCE,
    as: 'poste',
    rows: [{ type: 'tableRow', id: 'n-grouped', cells: ONE_CELL }],
  },
  tableRow: {
    type: 'tableRow',
    id: 'n-row',
    cells: [
      { columnId: 'c', children: [EMPTY_TEXT] },
      { columnId: 'd', children: [OTHER_EMPTY_TEXT] },
    ],
    pageReport: { value: p('proof.report') },
  },
};
