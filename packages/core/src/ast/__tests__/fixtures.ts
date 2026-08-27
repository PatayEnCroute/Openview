/**
 * Models shared by `table.test.ts`, `nodes.test.ts`, `visitor.test.ts` and
 * `traverse.test.ts` -- one model, several files, no copy.
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

/**
 * ## The nine style sites of lot C5, carried by this fixture on purpose
 *
 * The JSON round trip of `table.test.ts` is the ONLY net under `Template`, which is the ninth
 * accrual site and the one that CANNOT have a `*_KEYS_IN_STEP` pair: `Template` is inferred from
 * its schema, so the assertion would compare an annotation with itself. And that net only sees a
 * field the literal it compares actually CARRIES. So this fixture carries one, at every site it
 * has a node for.
 *
 * Deliberately MINIMAL values -- one field per site, not a complete style. The complete shapes
 * live in `style/__tests__/fixtures.ts`, where the seventeen round trips need them; here the
 * point is PRESENCE at each site, and a fuller literal would inflate this fixture's calibration
 * baseline for nothing.
 *
 * It covers SIX of the nine carriers and not all nine: this model has no image node and no
 * `pageField` segment. The two missing ones are covered by the nine-site round trip of
 * `style/__tests__/style.test.ts`, which builds its own `Template`. Adding an image and a band
 * here was discarded BY MEASUREMENT: `visitor.test.ts` pins `walk(root)` at 19 nodes, and one
 * more node reddens it -- a cost with no counterpart, since the ninth site is already guarded
 * elsewhere.
 */
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
  // Site 1. THIRD position on purpose: `Object.keys` yields insertion order, and
  // `table.test.ts` pins the exact key list -- writing this field last would redden that
  // assertion for a reason of tidiness, which is how a useful assertion gets "corrected".
  // A table now DOES carry a border and a shading, which is why the docstring of `TableNode`
  // saying it carries none had to be rewritten.
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
      // Site 2. The heading band: a row IS a band, and this is the second differentiating
      // device of an invoice.
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
    // A SHORT ROW: two cells for five columns. Legal by construction, and exactly the shape
    // of a totals row -- the positional pairing this contract refused would have needed
    // three empty filler cells here.
    {
      type: 'tableRow',
      id: 'ligne-total',
      cells: [
        cell('designation', txt('tf-libelle', [lit('Total')])),
        // Sites 3 to 6 in one node, because this is the node where all four fields have a
        // subject: a rule above the total, an inset under it, a family and a size for the
        // amount, an alignment for the runs, and a bold on the run itself.
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
  // `CURRENT_SCHEMA_VERSION`, never the literal `4`. This fixture is born in INC-1, where the
  // constant is still 3 and `TemplateSchema` declares `z.literal(3)`: a literal `4` would make
  // `parseTemplate` answer `TemplateMigrationError: … written by a newer release`, and INC-1
  // would fail its own gate 4. C2 already de-literalised seven such assertions, and the
  // playground applies the rule at App.tsx:164.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'facture-c3',
  name: 'Facture — tableau de lignes',
  version: '1.0.0',
  // Le champ requis du lot C4, et DÉLIBÉRÉMENT la page la plus simple qui soit : ce modèle-ci
  // démontre le tableau, pas la feuille. La page de recette de C4 — celle qui porte trois
  // bandes et quatre marqueurs — vit dans `page/__tests__/fixtures.ts` et n'est pas recopiée
  // ici. Ce que cette page apporte quand même : l'aller-retour JSON de `table.test.ts` couvre
  // désormais un champ `page`, donc un champ que la fixture porterait et que le schéma
  // supprimerait s'y verrait.
  //
  // `RECIPE_PAGE` ne peut PAS être écrite ici, et c'est mesuré plutôt que subi : `Template`
  // est inféré de son schéma, où `z.array` rend un tableau MUTABLE, tandis que `PageSetup`
  // déclare `readonly PageBand[]` — `TS2322` dans ce sens, et dans ce sens seulement.
  //
  // L'étalement de `STANDARD_SHEETS_MM.a4` est ce qui rend visible pourquoi ce tableau est
  // `as const satisfies` : annoté `Readonly<Record<string, Sheet>>`, il rendrait
  // `Sheet | undefined` sous `noUncheckedIndexedAccess` et cette ligne ne compilerait pas.
  page: {
    sheet: { ...STANDARD_SHEETS_MM.a4 },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'racine',
    // Sites 7 to 9: a box on the root container, and two segment typographies in the title --
    // one on a `literal`, one on a `binding`.
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
