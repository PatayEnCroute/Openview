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
import type { BlockNode, TableCell, TableNode, TextNode, TextSegment } from '../nodes.js';

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
