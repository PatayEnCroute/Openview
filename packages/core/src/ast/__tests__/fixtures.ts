/**
 * The recipe model of lot C3, shared by `table.test.ts`, `nodes.test.ts` and
 * `visitor.test.ts` -- one model, three files, no copy.
 *
 * **This file carries constants and the factories that build them, and nothing else.** It is
 * not a test file: it holds no `it`, so Vitest does not collect it. But it IS instrumented by
 * coverage (`vitest.config.ts:39-40` instruments `packages/*&#47;src/**&#47;*.ts` and excludes only
 * `*.{test,spec}.ts`), and it IS compiled into `dist/` and shipped in the tarball
 * (`packages/core/tsconfig.json` excludes the four test spellings, not this name). Two rules
 * follow, and each has a mechanical criterion in the plan's §6.4:
 *
 * - **No exported factory goes uncalled.** It would be instrumented, never covered, and
 *   `noUnusedLocals` does not see an export -- so it would lower `core`'s function coverage
 *   without one test going red.
 * - **Nothing is imported from `vitest`.** That is the one real accident for a module embedded
 *   in the published package, and it is the accident `packages/core/tsconfig.json:15-18`
 *   already recounts for a `*.spec.ts`.
 */

import type {
  ArithmeticExpression,
  PathExpression,
  PrintableExpression,
  RoundExpression,
} from '../../expression/expression.js';
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

/**
 * round(sum(facture.lignes, ligne, round(ligne.quantite * ligne.prixUnitaire, 2, m)), 2, m).
 *
 * An EXPRESSION OF THE MODEL. The table sums nothing: its `footer` has nowhere to put an
 * aggregate. The alias is `ligne` here AND in the body group on purpose -- the two scopes
 * are disjoint, the shadowing is lexical and costs nothing, and writing the same name twice
 * is what makes the duplication comparable by eye. Nothing in this contract ties the two
 * copies of the arithmetic together; an editor lint is what would.
 */
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

// Les cinq colonnes ci-dessous — `designation`, `quantite`, `prixUnitaire`, `remise`,
// `montant` — sont un JEU D'ÉPREUVE, celui que le critère de recette de la roadmap nomme.
// Ce ne sont ni des noms réservés, ni une structure attendue, ni un gabarit : Openview
// n'impose aucun identifiant de colonne, exactement comme il n'impose aucun nom de champ
// de données. Un relevé bancaire, un bon de livraison ou un bordereau se décrivent avec un
// tout autre vocabulaire, et le contrat est le même. Le test, en cas de doute : si une
// fonctionnalité oblige l'intégrateur à nommer une colonne comme Openview l'a décidé, elle
// est à refuser (AGENTS.md, « Ce qu'Openview n'est pas »).
export const RECIPE_TABLE: TableNode = {
  type: 'table',
  id: 'lignes',
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
    // A SHORT ROW: two cells for five columns. Legal by construction, and exactly the shape
    // of a totals row -- the positional pairing this contract refused would have needed
    // three empty filler cells here.
    {
      type: 'tableRow',
      id: 'ligne-total',
      cells: [
        cell('designation', txt('tf-libelle', [lit('Total')])),
        cell('montant', txt('tf-montant', [bind(totalDeclare)])),
      ],
    },
  ],
};

export const RECIPE_TEMPLATE: Template = {
  // `CURRENT_SCHEMA_VERSION`, never the literal `4`. This fixture is born in INC-1, where the
  // constant is still 3 and `TemplateSchema` declares `z.literal(3)`: a literal `4` would make
  // `parseTemplate` answer `TemplateMigrationError: … written by a newer release`, and INC-1
  // would fail its own gate 4. C2 already de-literalised seven such assertions, and the
  // playground applies the rule at App.tsx:164.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'facture-c3',
  name: 'Facture — tableau de lignes',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'racine',
    children: [txt('titre', [lit('Facture '), bind(p('facture.numero'))]), RECIPE_TABLE],
  },
};
