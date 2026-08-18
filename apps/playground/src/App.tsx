import {
  type BlockNode,
  type BorderEdge,
  type BoxStyle,
  CURRENT_SCHEMA_VERSION,
  childScope,
  collectTemplateDataPaths,
  createBudget,
  type DocumentNode,
  type EvaluationBudget,
  type EvaluationScope,
  type Expression,
  ExpressionEvaluationError,
  ExpressionSchema,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  findNodeById,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  mmFromPt,
  type PageBand,
  type PageBandOccurrence,
  type PageSetup,
  type PrintableExpression,
  parseTemplate,
  printableAreaOf,
  ROUND_MODES,
  type RoundExpression,
  RoundExpressionSchema,
  type RoundMode,
  resolveTextAlign,
  resolveTypography,
  STANDARD_SHEETS_MM,
  type TableCell,
  type TableColumn,
  type TableColumnAlignment,
  type TableNode,
  type TableRowNode,
  type Template,
  type TextAlignment,
  type TextNode,
  type TextSegment,
  type Typography,
  visitNode,
  visitSegment,
  walk,
} from '@openview/core';
import type { CSSProperties, ReactNode } from 'react';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis, expression evaluation, loop scoping, the C1 algebra and the
// error payload lot C8 will turn into sentences. If @openview/core breaks its
// contract, this page stops rendering -- which is the point of the playground, and
// the reason nothing below falls back to a default.
//
// It is also the ONLY real consumer of the package barrel, so it is what reveals an
// export forgotten in index.ts -- a blind spot of all four gates on the core side.

const discountApplies: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'line.discount' },
  right: { kind: 'literal', value: 0 },
};

/** `quantite * prixUnitaire` -- no line amount is supplied by the data. That is the point. */
const lineAmount: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'line.quantite' },
  right: { kind: 'path', path: 'line.prixUnitaire' },
};

/** The sum of the computed line amounts. Same shape as a loop: source, alias, value. */
const totalHT: PrintableExpression = {
  kind: 'aggregate',
  op: 'sum',
  source: { kind: 'path', path: 'commande.lignes' },
  as: 'line',
  value: lineAmount,
};

/**
 * A percentage of the total, in points, and NOT rounded here.
 *
 * Rounding is a `round` node the template writes where it wants one -- see the three
 * models further down. Rounding this amount by default would be a rounding position *de
 * facto*, therefore a rule, and Openview answers for no rule.
 */
const remise: PrintableExpression = {
  kind: 'percentOf',
  base: totalHT,
  rate: { kind: 'path', path: 'commande.tauxRemise' },
};

const restePayer: PrintableExpression = {
  kind: 'arithmetic',
  op: 'sub',
  left: totalHT,
  right: remise,
};

/**
 * A guarded division: the `if` short-circuits, so a zero count never divides.
 *
 * Written "naturally" -- evaluate both branches, then choose -- this prints an error
 * instead of a price.
 */
const prixMoyen: PrintableExpression = {
  kind: 'if',
  when: {
    kind: 'compare',
    op: 'gt',
    left: { kind: 'count', source: { kind: 'path', path: 'commande.lignes' } },
    right: { kind: 'literal', value: 0 },
  },
  whenTrue: {
    kind: 'arithmetic',
    op: 'div',
    left: totalHT,
    right: { kind: 'count', source: { kind: 'path', path: 'commande.lignes' } },
  },
  whenFalse: { kind: 'literal', value: 0 },
};

const echeance: PrintableExpression = {
  kind: 'dateAdd',
  date: { kind: 'path', path: 'commande.dateEmission' },
  days: { kind: 'path', path: 'commande.delaiPaiement' },
};

/** "45 days end of month" -- composed, so no month convention is ever chosen. */
const echeanceFinDeMois: PrintableExpression = {
  kind: 'endOfMonth',
  date: {
    kind: 'dateAdd',
    date: { kind: 'path', path: 'commande.dateEmission' },
    days: { kind: 'literal', value: 45 },
  },
};

/**
 * Days overdue, between two dates the HOST supplies.
 *
 * `traitement.effectueLe` is a name the integrating application chose. Openview reserves
 * no name for "today" and has no clock to read: that is what makes two renders of one
 * model produce the same document.
 */
const joursRetard: PrintableExpression = {
  kind: 'dateDiff',
  from: echeance,
  to: { kind: 'path', path: 'traitement.effectueLe' },
};

/** How many discounted lines: `count(filter(...))`, and not an optional `where`. */
const lignesRemisees: PrintableExpression = {
  kind: 'count',
  source: {
    kind: 'filter',
    source: { kind: 'path', path: 'commande.lignes' },
    as: 'line',
    where: discountApplies,
  },
};

/** Un bloc texte d'un seul segment littéral — un intitulé de colonne, un libellé de total. */
const txt = (id: string, text: string): TextNode => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text }],
});

/**
 * « Page ⟨number⟩ / ⟨count⟩ » — quatre segments, dont deux MARQUEURS.
 *
 * Rien ici n'est calculé : un `pageField` déclare OÙ un numéro s'imprime, jamais sa valeur.
 * Celle-ci vient du paginateur (lot E2), et la langue autour — « / », « sur », « of » — est
 * du lot C6, qui se branchera sur ces `literal` sans position de contenu nouvelle.
 *
 * Écrit une fois et partagé par les deux pieds : sur une facture d'UNE page, seule la bande
 * `lastOnly` est rendue, donc un modèle qui ne numéroterait que le pied courant sortirait
 * une facture sans numéro de page.
 */
const PAGINATION: readonly TextSegment[] = [
  { kind: 'literal', text: 'Page ' },
  { kind: 'pageField', field: 'number' },
  { kind: 'literal', text: ' / ' },
  { kind: 'pageField', field: 'count' },
];

/** Explicit stringification: `concat` refuses a number, and `text()` is where one becomes text. */
const titre: PrintableExpression = {
  kind: 'concat',
  parts: [
    { kind: 'literal', value: 'N° ' },
    { kind: 'text', value: { kind: 'path', path: 'commande.numero' } },
    { kind: 'literal', value: ' — ' },
    { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'commande.client' } },
  ],
};

// Le modèle s'appelle « Facture Exemple » parce que la facture est le document de
// référence du projet — celui qui concentre les contraintes les plus dures — et
// non le périmètre du produit. Les noms de champs ci-dessous (`commande`, `lignes`,
// `prixUnitaire`) sont ceux qu'une application intégratrice aurait choisis : Openview
// n'en réserve aucun et n'en attend aucun. Le même moteur rend un relevé, un bon de
// livraison ou un courrier avec un tout autre vocabulaire.
/**
 * Ce qu'une apparence déclare, et RIEN d'autre — lot C5.
 *
 * Sept entrées, toutes des formes du contrat : trois `BoxStyle`, trois `Typography` et un
 * `TextAlignment`. Aucune n'est une propriété CSS : le CSS est DÉRIVÉ du nœud par
 * `styleCssDe`, jamais l'inverse, et c'est ce sens de dérivation qui fait de cette page une
 * démonstration du contrat plutôt qu'une feuille de style qui lui ressemble.
 */
interface Apparence {
  readonly nom: string;
  /** La boîte du conteneur racine : le cadre du document. */
  readonly cadre: BoxStyle;
  /** La bande d'en-tête du tableau — le SECOND dispositif de différenciation d'une facture. */
  readonly bandeau: BoxStyle;
  /** La boîte du tableau lui-même : c'est sa largeur de CONTENU que les poids se partagent. */
  readonly tableau: BoxStyle;
  readonly titre: Typography;
  readonly corps: Typography;
  /** Posée sur UN SEGMENT, jamais sur le bloc : c'est ce qui rend « Total : 1 200 € » exprimable. */
  readonly accent: Typography;
  /** `justify` n'est légal QUE sur un bloc de texte, jamais sur une colonne. */
  readonly alignementMentions: TextAlignment;
}

/** Apparence A — bleu marine, un cadre complet, une bande claire, une serif. */
const APPARENCE_A: Apparence = {
  nom: 'A — marine, encadrée, serif',
  cadre: {
    background: '#FFFFFF',
    border: {
      top: { width: 0.4, color: '#1b3a6f' },
      right: { width: 0.4, color: '#1b3a6f' },
      bottom: { width: 0.4, color: '#1b3a6f' },
      left: { width: 0.4, color: '#1b3a6f' },
    },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
  },
  bandeau: { background: '#eef2f9', padding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 } },
  tableau: { border: { bottom: { width: 0.28, color: '#1b3a6f' } } },
  titre: { family: 'Georgia', sizePt: 17, bold: true, color: '#1b3a6f' },
  corps: { family: 'Georgia', sizePt: 9.5, color: '#22262b' },
  accent: { bold: true, color: '#1b3a6f' },
  alignementMentions: 'start',
};

/**
 * Apparence B — rouille, aucun cadre, un seul filet, une sans-serif, mentions JUSTIFIÉES.
 *
 * La casse HAUTE des couleurs est délibérée : les deux casses sont légales, et une fixture est
 * l'endroit où cette décision s'exerce plutôt que de rester écrite. Le contrat ne replie pas la
 * casse au parse — un consommateur qui compare deux couleurs la replie lui-même.
 */
const APPARENCE_B: Apparence = {
  nom: 'B — rouille, sans cadre, sans-serif, mentions justifiées',
  cadre: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
  bandeau: { border: { bottom: { width: 1.2, color: '#8C3A1B' } } },
  tableau: {},
  titre: { family: 'Arial', sizePt: 13, italic: true, color: '#8C3A1B' },
  corps: { family: 'Arial', sizePt: 8.5, color: '#3A3A3A' },
  accent: { color: '#8C3A1B' },
  alignementMentions: 'justify',
};

/**
 * Le modèle, PARAMÉTRÉ PAR SON APPARENCE — et c'est le geste central de cette démonstration.
 *
 * Le critère de recette demande « deux factures visuellement très différentes à partir d'un seul
 * jeu de données ». Écrire deux littéraux à la main le satisferait à l'œil et prouverait moins :
 * rien ne garantirait que la structure, les identifiants et les liaisons soient les mêmes. Une
 * FONCTION rend l'identité structurelle MÉCANIQUE — un seul arbre, un seul jeu de liaisons, et la
 * seule chose qui varie est ce que le lot C5 a ajouté. C'est aussi ce qui fait de l'égalité des
 * deux listes de `collectTemplateDataPaths` un résultat plutôt qu'une coïncidence.
 *
 * ⚠️ `tableau` vaut `{}` dans l'apparence B, et le contrat REFUSE un objet de style vide : la
 * forme canonique de « aucun style » est le champ ABSENT. C'est pourquoi les champs ci-dessous
 * passent par `siNonVide`, qui est exactement le normalisateur que le contrat demande au
 * PRODUCTEUR — « un producteur qui normalise vaut mieux que N consommateurs qui normalisent ».
 */
const siNonVide = (style: BoxStyle | Typography): BoxStyle | Typography | undefined =>
  Object.values(style).some((entree) => entree !== undefined) ? style : undefined;

const factureAvecApparence = (a: Apparence): Template =>
  parseTemplate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_demo_1',
    name: 'Facture Exemple',
    version: '1.0.0',
    // La feuille, ses marges et ses bandes — lot C4. Les dimensions ci-dessous sont celles
    // d'une A4 PARCE QUE L'AUTEUR DU MODÈLE L'A ÉCRIT : Openview n'impose aucun format, n'en
    // réserve aucun nom et n'en déduit aucun d'une locale — même règle que pour les noms de
    // champs et les identifiants de colonnes. `STANDARD_SHEETS_MM` est une COMMODITÉ
    // D'ÉCRITURE : elle est étalée ici, et le document, lui, n'enregistre que deux nombres.
    // Ajouter un format à cette table ne change ni le schéma, ni la version, ni un document.
    page: {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 18, right: 15, bottom: 18, left: 15 },
      header: [
        {
          on: 'every',
          content: {
            type: 'container',
            id: 'bandeau',
            // Une bande a le style GRATUITEMENT : `PageBand.content` EST un `ContainerNode`,
            // donc pas une ligne de `page/` n'a bougé pour que ceci soit exprimable.
            box: siNonVide(a.bandeau),
            children: [
              {
                type: 'text',
                id: 'bandeau-titre',
                typography: a.corps,
                content: [
                  { kind: 'literal', text: 'Commande ' },
                  {
                    kind: 'binding',
                    value: { kind: 'path', path: 'commande.numero' },
                    typography: a.accent,
                  },
                ],
              },
            ],
          },
        },
      ],
      // Un pied COURANT et un pied de DERNIÈRE page. `every` + `lastOnly` serait refusé par le
      // schéma — les deux tomberaient sur la dernière feuille —, donc le pied courant est
      // `exceptLast`. C'est la seule écriture licite de cette intention, et c'est la raison
      // d'exister de la troisième occurrence.
      footer: [
        {
          on: 'exceptLast',
          content: {
            type: 'container',
            id: 'pied',
            children: [{ type: 'text', id: 'pied-num', content: PAGINATION }],
          },
        },
        {
          on: 'lastOnly',
          content: {
            type: 'container',
            id: 'pied-dernier',
            children: [
              { type: 'text', id: 'pied-dernier-num', content: PAGINATION },
              // Cette liaison est lue PAR LA BANDE ET PAR ELLE SEULE : aucun bloc du flux ne la
              // porte. C'est ce qui rend visible, sur l'écran « Données requises » plus haut, la
              // différence entre `collectTemplateDataPaths` et `collectDataPaths(root)` — sans
              // elle, l'appelant ne fournirait pas la clé et le pied s'imprimerait vide.
              {
                type: 'text',
                id: 'pied-mentions',
                content: [
                  { kind: 'binding', value: { kind: 'path', path: 'societe.mentionsLegales' } },
                ],
              },
            ],
          },
        },
      ],
    },
    root: {
      type: 'container',
      id: 'root',
      box: siNonVide(a.cadre),
      children: [
        {
          type: 'text',
          id: 'title',
          typography: a.titre,
          content: [{ kind: 'binding', value: titre }],
        },
        // Les cinq identifiants de colonne ci-dessous — `sku`, `quantite`, `prixUnitaire`,
        // `montant`, `remise` — appellent le même avertissement que les noms de champs plus
        // haut, adapté : ce sont un JEU D'ÉPREUVE, choisis par l'auteur du modèle. Openview
        // n'impose aucun identifiant de colonne, et le premier tableau réellement décrit est
        // celui qui sera recopié — le dépôt nomme déjà ce mécanisme, « position par défaut de
        // fait ». Un relevé bancaire ou un bordereau se décrivent avec un tout autre
        // vocabulaire, et le contrat est le même.
        //
        // Avant le lot C3, une ligne entière de facture était UN SEUL nœud texte dont les
        // segments mimaient des colonnes (`line-label`). Rien ne disait qu'il y avait des
        // colonnes, aucune largeur, aucun alignement, et l'en-tête n'existait pas.
        {
          type: 'table',
          id: 'lignes',
          box: siNonVide(a.tableau),
          columns: [
            { id: 'sku', width: 6, align: 'start' },
            { id: 'quantite', width: 2, align: 'end' },
            { id: 'prixUnitaire', width: 3, align: 'end' },
            { id: 'montant', width: 3, align: 'end' },
            { id: 'remise', width: 4, align: 'start' },
          ],
          header: [
            {
              type: 'tableRow',
              id: 'entete',
              box: siNonVide(a.bandeau),
              cells: [
                { columnId: 'sku', children: [txt('th-sku', 'Référence')] },
                { columnId: 'quantite', children: [txt('th-quantite', 'Qté')] },
                { columnId: 'prixUnitaire', children: [txt('th-prix', 'Prix unitaire')] },
                { columnId: 'montant', children: [txt('th-montant', 'Montant')] },
                { columnId: 'remise', children: [txt('th-remise', 'Remise')] },
              ],
            },
          ],
          body: [
            {
              type: 'tableRowGroup',
              id: 'corps',
              each: { kind: 'path', path: 'commande.lignes' },
              as: 'line',
              rows: [
                {
                  type: 'tableRow',
                  id: 'ligne-detail',
                  cells: [
                    {
                      columnId: 'sku',
                      children: [
                        {
                          type: 'text',
                          id: 'td-sku',
                          content: [{ kind: 'binding', value: { kind: 'path', path: 'line.sku' } }],
                        },
                      ],
                    },
                    {
                      columnId: 'quantite',
                      children: [
                        {
                          type: 'text',
                          id: 'td-quantite',
                          content: [
                            { kind: 'binding', value: { kind: 'path', path: 'line.quantite' } },
                          ],
                        },
                      ],
                    },
                    {
                      columnId: 'prixUnitaire',
                      children: [
                        {
                          type: 'text',
                          id: 'td-prix',
                          content: [
                            { kind: 'binding', value: { kind: 'path', path: 'line.prixUnitaire' } },
                          ],
                        },
                      ],
                    },
                    {
                      columnId: 'montant',
                      children: [
                        {
                          type: 'text',
                          id: 'td-montant',
                          content: [{ kind: 'binding', value: lineAmount }],
                        },
                      ],
                    },
                    // Une cellule contient des BLOCS, pas des segments : la condition qui
                    // portait la note de remise vit désormais DANS la cellule, et le parcours
                    // l'atteint quand même — `childrenOf` aplatit la frontière de cellule.
                    {
                      columnId: 'remise',
                      children: [
                        {
                          type: 'condition',
                          id: 'discounted',
                          when: discountApplies,
                          children: [
                            {
                              type: 'text',
                              id: 'discount-note',
                              content: [
                                { kind: 'literal', text: 'Remise appliquée : ' },
                                {
                                  kind: 'binding',
                                  value: { kind: 'path', path: 'line.discount' },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          footer: [
            // UNE LIGNE COURTE : deux cellules pour cinq colonnes. Licite par construction, et
            // c'est exactement la forme d'une ligne de total — l'appariement positionnel que ce
            // contrat a refusé aurait exigé trois cellules de remplissage vides ici.
            //
            // Le total est une EXPRESSION DU MODÈLE, visible dans l'arbre. Le tableau ne somme
            // rien : son `footer` n'a nulle part où poser un agrégat.
            {
              type: 'tableRow',
              id: 'ligne-total',
              cells: [
                { columnId: 'sku', children: [txt('tf-libelle', 'Total HT')] },
                {
                  columnId: 'montant',
                  children: [
                    {
                      type: 'text',
                      id: 'tf-montant',
                      content: [{ kind: 'binding', value: totalHT }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'text',
          id: 'totals',
          typography: a.corps,
          align: 'end',
          content: [
            { kind: 'literal', text: 'Total HT ' },
            { kind: 'binding', value: totalHT, typography: a.accent },
            { kind: 'literal', text: ' — remise ' },
            { kind: 'binding', value: remise },
            { kind: 'literal', text: ' — reste à payer ' },
            { kind: 'binding', value: restePayer },
            { kind: 'literal', text: ' — prix moyen ' },
            { kind: 'binding', value: prixMoyen },
          ],
        },
        {
          type: 'text',
          id: 'dates',
          typography: a.corps,
          align: a.alignementMentions,
          content: [
            { kind: 'literal', text: 'Échéance ' },
            { kind: 'binding', value: echeance },
            { kind: 'literal', text: ' — 45 jours fin de mois ' },
            { kind: 'binding', value: echeanceFinDeMois },
            { kind: 'literal', text: ' — jours de retard ' },
            { kind: 'binding', value: joursRetard },
          ],
        },
        {
          type: 'text',
          id: 'discount-count',
          typography: a.corps,
          align: a.alignementMentions,
          content: [
            { kind: 'literal', text: 'Lignes remisées ' },
            { kind: 'binding', value: lignesRemisees, typography: a.accent },
          ],
        },
      ],
    },
  });

/**
 * Les deux factures. MÊME structure, MÊMES identifiants, MÊME jeu de données — et le seul écart
 * est l'apparence, ce que le lot C5 vient d'ajouter au contrat.
 */
const sampleTemplate = factureAvecApparence(APPARENCE_A);
const factureVariante = factureAvecApparence(APPARENCE_B);

// Le jeu de données de l'application hôte. Sa structure et ses noms de champs lui
// appartiennent ; `core` ne les connaît pas et ne les valide pas. AUCUN MONTANT n'y
// figure : tous ceux affichés plus bas sont calculés par le modèle.
const renderData = {
  commande: {
    numero: 20_260_014,
    client: 'acme sàrl',
    dateEmission: '2026-01-20',
    delaiPaiement: 30,
    tauxRemise: 10,
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10, discount: 0 },
      { sku: 'B-2', quantite: 1, prixUnitaire: 30, discount: 15 },
      { sku: 'C-3', quantite: 4, prixUnitaire: 2.5, discount: 5 },
    ],
  },
  // Un SECOND jeu de lignes, dédié à la démonstration d'arrondi. La facture ci-dessus
  // n'est pas touchée : ses quatre montants (60 / 6 / 54 / 20) sont cités nommément par
  // l'ADR 0003, et les étendre aurait périmé quatre chiffres d'un document qui fait foi.
  //
  // Deux de ces cinq lignes portent des valeurs DYADIQUES — 0,125 vaut 2⁻³ et 0,375 vaut
  // 3·2⁻³, et leurs produits par 17 et par 3 le sont aussi. Le demi y est donc LE demi, et
  // non un artefact de représentation : c'est la seule façon de montrer que le mode décide
  // quelque chose. Comme au-dessus, aucune ligne ne porte de montant — seulement une
  // quantité et un prix unitaire.
  arrondi: {
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10 },
      { sku: 'B-2', quantite: 1, prixUnitaire: 30 },
      { sku: 'C-3', quantite: 4, prixUnitaire: 2.5 },
      { sku: 'D-4', quantite: 17, prixUnitaire: 0.125 },
      { sku: 'E-5', quantite: 3, prixUnitaire: 0.375 },
    ],
  },
  // « Aujourd'hui » est une donnée, sous un nom que l'intégrateur choisit.
  traitement: { effectueLe: '2026-03-10' },
  // Lu par le PIED DE DERNIÈRE PAGE et par lui seul. Aucun bloc du flux ne le lit, donc cette
  // clé n'apparaît dans « Données requises » que parce que l'analyse descend dans les bandes.
  societe: { mentionsLegales: 'Escompte pour paiement anticipé : néant.' },
};

/**
 * Le budget de CE document, créé une fois — comme le fera le pipeline.
 *
 * Deux erreurs symétriques, et la page les évite toutes les deux. Un budget par *appel* se
 * réinitialiserait à chaque liaison, et un document de 500 liaisons obtiendrait 500 fois
 * l'allocation : la borne serait décorative. Un budget par *page* ferait dépendre le
 * compteur d'un document de ce qu'un autre a déjà consommé, donc de l'ordre de la
 * démonstration. L'unité juste est le DOCUMENT : les trois modèles d'arrondi plus bas
 * partagent le jeu de données et portent chacun le sien.
 */
const budgetFacture: EvaluationBudget = createBudget();

/**
 * Valeurs brutes, volontairement : transformer une liaison en texte imprimable
 * est le travail de `DataBindingStep` (étape 2), et l'ADR 0001 laisse ouverte la
 * politique de la valeur absente. Le playground ne la tranche pas à sa place.
 *
 * Cela vaut aussi pour les dates : `YYYY-MM-DD` est une représentation d'ÉCHANGE, pas
 * un format d'affichage. Les rendre en `31/03/2026` appartient au lot C6, au même
 * endroit que la mise en forme des nombres.
 *
 * Le parcours passe par `visitSegment` : c'est la deuxième traversée de segments
 * du dépôt, et une nouvelle sorte de segment doit casser la compilation ici.
 */
function rawSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): readonly string[] {
  return segments.map((segment) =>
    visitSegment(segment, {
      literal: (literal) => JSON.stringify(literal.text),
      binding: (binding) => {
        const value = evaluateExpression(binding.value, scope, { budget });
        return value === undefined ? '(absent)' : JSON.stringify(value);
      },
      // Cette page N'A PAS DE PAGINATEUR : elle ne coupe rien, donc elle ne connaît ni le
      // rang d'une page ni leur nombre. `1` est un ESPACE RÉSERVÉ affiché honnêtement, pas
      // une valeur calculée — c'est le moteur (lot E2) qui substituera la vraie.
      pageField: (marker) => `⟨${marker.field}⟩`,
    }),
  );
}

/**
 * Tombe plutôt que de dégrader. Chaque nœud lu ci-dessous figure dans le littéral
 * de template au-dessus : s'il manque, c'est le contrat de core qui est cassé, et
 * une section vide le dirait beaucoup moins bien qu'une exception.
 */
function requireNode(root: DocumentNode, id: string): DocumentNode {
  const node = findNodeById(root, id);
  if (node === undefined) {
    throw new Error(`Nœud « ${id} » absent du document validé : contrat de core cassé.`);
  }
  return node;
}

function requireTextNode(root: DocumentNode, id: string): readonly TextSegment[] {
  const node = requireNode(root, id);
  if (node.type !== 'text') {
    throw new Error(`« ${id} » devrait être un texte, pas un ${node.type}.`);
  }
  return node.content;
}

/**
 * La même discipline, pour un tableau — et le TYPE DE RETOUR compte.
 *
 * Un `const` module dont on rétrécit le type par un `if` ne reste pas rétréci dans le corps
 * du composant : une fermeture ne porte pas le flux de contrôle du module. Une fonction qui
 * rend `TableNode` le fait, elle.
 */
function requireTableNode(root: DocumentNode, id: string): TableNode {
  const node = requireNode(root, id);
  if (node.type !== 'table') {
    throw new Error(`« ${id} » devrait être un tableau, pas un ${node.type}.`);
  }
  return node;
}

/**
 * Les racines d'un modèle : `root`, puis le contenu de chaque bande.
 *
 * Écrit une fois parce que `walk(sampleTemplate.root)` seul MENTAIT sur cet écran — il
 * omettait les sept nœuds des bandes (`bandeau`, `bandeau-titre`, `pied`, `pied-num`,
 * `pied-dernier`, `pied-dernier-num`, `pied-mentions`) alors que la section « La page »
 * plus bas affiche le texte résolu de ces mêmes nœuds. Le trou n'est pas propre au
 * playground : `collectTemplateDataPaths` existe précisément parce que `collectDataPaths`
 * le rencontre aussi, et `template/paths.ts` note qu'aucun `findNodeInTemplate` ne le
 * ferme encore côté `core`.
 */
const racines: readonly DocumentNode[] = [
  sampleTemplate.root,
  ...sampleTemplate.page.header.map((bande) => bande.content),
  ...sampleTemplate.page.footer.map((bande) => bande.content),
];

const nodeIds = racines.flatMap((racine) =>
  [...walk(racine)].map((node) => `${node.id} (${node.type})`),
);

/**
 * `collectTemplateDataPaths` et NON `collectDataPaths(sampleTemplate.root)`.
 *
 * Depuis le lot C4 les bandes vivent hors de `root`, donc la seconde forme omettrait
 * `societe.mentionsLegales` — lu par le pied de dernière page et par lui seul. Et c'est
 * bien cette clé-là : `commande.numero`, que l'en-tête lit aussi, est déjà portée par
 * `titre` dans le flux, donc la forme sur `root` la rendrait de toute façon. Une
 * justification qui nomme la mauvaise clé ne démontre rien.
 *
 * Le symptôme ne serait pas une erreur mais un BLANC : l'appelant ne fournirait pas la
 * clé, et le pied s'imprimerait vide.
 */
const dataPaths = collectTemplateDataPaths(sampleTemplate);

// Tout ce qui suit se lit sur le document validé : l'alias sur le nœud de groupe, la
// condition sur le nœud de condition. Les expressions déclarées plus haut ne servent qu'à
// construire le template ; l'évaluation ci-dessous n'y touche pas.
//
// Ce `requireNode` vaut une démonstration à lui seul : `discounted` vit désormais DANS une
// cellule du tableau, et `findNodeById` l'atteint quand même. `childrenOf` aplatit la
// frontière de cellule, donc rien de ce qu'un tableau contient n'est invisible au parcours —
// un sous-arbre que le parcours ne rendrait pas serait invisible à `walk`, à `findNodeById` et
// à `collectDataPaths` SANS erreur nulle part.
const conditionNode = requireNode(sampleTemplate.root, 'discounted');
if (conditionNode.type !== 'condition') {
  throw new Error(`« discounted » devrait être une condition, pas un ${conditionNode.type}.`);
}

const root = sampleTemplate.root;
const titleSegments = rawSegments(requireTextNode(root, 'title'), renderData, budgetFacture);
const totalSegments = rawSegments(requireTextNode(root, 'totals'), renderData, budgetFacture);
const dateSegments = rawSegments(requireTextNode(root, 'dates'), renderData, budgetFacture);
const countSegments = rawSegments(
  requireTextNode(root, 'discount-count'),
  renderData,
  budgetFacture,
);

/* ------------------------------------------------------------------------------------- *
 * La section facture, décrite par un vrai tableau
 * ------------------------------------------------------------------------------------- */

/**
 * Une part de largeur, `width / Σ width`, en pourcentage.
 *
 * Le poids est un ENTIER, donc la somme est exacte en binary64 et la part est UNE division
 * correctement arrondie — le même nombre à l'écran et dans le PDF. C3 ne déclare nulle part
 * la largeur du tableau lui-même : seul le RAPPORT inter-colonnes est déclaré, et c'est le
 * conteneur qui donne la largeur.
 *
 * **Aucun second arrondi ici, et c'est le point.** Un `.toFixed(2)` appliqué à la part
 * détruirait l'exactitude que le poids entier existe pour donner : trois colonnes de poids 1
 * rendraient `33.33 % × 3 = 99.99 %`, et une colonne légale de poids 1 à côté de vingt et une
 * de poids 1 000 rendrait `0.00 %` — une largeur déclarée non nulle affichée à zéro. La
 * division est émise telle quelle ; c'est au moteur de rendu, et non à ce calcul, de décider
 * d'une précision d'affichage.
 */
function partsDeLargeur(columns: readonly TableColumn[]): readonly string[] {
  const total = columns.reduce((somme, column) => somme + column.width, 0);
  return columns.map((column) => `${(column.width / total) * 100}%`);
}

/**
 * Les segments d'un bloc texte, en TEXTE D'AFFICHAGE.
 *
 * Distinct de `rawSegments`, et la distinction est la correction d'un vrai défaut : celui-ci
 * est une sonde de diagnostic qui passe chaque run par `JSON.stringify` et les joint par
 * ` + `, ce qui est juste dans un `<code>` et faux dans une cellule — l'en-tête rendait
 * `"Référence"`, guillemets compris, sous une phrase affirmant qu'aucune information n'est
 * inventée en chemin.
 *
 * Les segments d'UN nœud texte sont des runs EN LIGNE : ils se concatènent sans séparateur.
 * C'est exactement ce que dit la docstring de `TextSegment` — « "Total: " et la valeur
 * appartiennent à la même ligne » —, et tout séparateur ajouté ici serait inventé.
 */
function texteDeSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): string {
  return runsDeSegments(segments, scope, budget, undefined)
    .map((run) => run.texte)
    .join('');
}

/** Un run prêt à peindre : son texte, et la typographie RÉSOLUE qui s'y applique. */
interface RunAffiche {
  readonly texte: string;
  readonly typographie: Typography | undefined;
}

/**
 * Les runs d'un bloc texte, chacun avec sa typographie résolue — lot C5.
 *
 * ## Pourquoi cette fonction existe, et pourquoi `texteDeSegments` en dérive
 *
 * `typography` vit sur LE SEGMENT autant que sur le bloc, donc « Total : **1 200 €** » — une
 * graisse à l'intérieur d'une phrase — n'est peignable qu'avec un élément par run. Le rendu
 * passe donc du texte au `<span>`, et le parcours des segments reste écrit UNE FOIS : la
 * version texte n'est plus qu'une projection de celle-ci. Deux parcours auraient été deux
 * orthographes d'un même fait, avec le droit de diverger sur la valeur absente.
 *
 * La résolution est `resolveTypography` DU CONTRAT, jamais un `??` réécrit ici. Ce que la
 * fonction exportée garantit n'est pas une garantie de bit — `a ?? b` n'a aucun hasard
 * numérique — mais une garantie d'UNICITÉ : il n'existe qu'une orthographe de « le style du run
 * gagne sur celui du bloc », et ce fichier est un consommateur nommé de cette unicité.
 */
function runsDeSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
  bloc: Typography | undefined,
): readonly RunAffiche[] {
  return segments.map((segment) => {
    const texte = visitSegment(segment, {
      literal: (literal) => literal.text,
      binding: (binding) => {
        const value = evaluateExpression(binding.value, scope, { budget });
        // Une donnée absente rend une cellule vide. L'ADR 0001 laisse la politique de la
        // valeur absente ouverte, et une cellule de tableau n'est pas l'endroit où la
        // trancher : `rawSegments` garde le `(absent)` explicite pour les sections de dump.
        return value === undefined ? '' : String(value);
      },
      // Même raison qu'au-dessus : pas de paginateur, donc pas de valeur. `1` est un espace
      // réservé, et la page le dit en toutes lettres plutôt que de faire croire à un calcul.
      pageField: () => '1',
    });
    const typographie = resolveTypography({
      run: visitSegment<Typography | undefined>(segment, {
        literal: (literal) => literal.typography,
        binding: (binding) => binding.typography,
        pageField: (marqueur) => marqueur.typography,
      }),
      block: bloc,
    });
    return { texte, typographie };
  });
}

/**
 * L'échelle des deux factures peintes plus bas : des PIXELS PAR MILLIMÈTRE.
 *
 * Déclarée, et déclarée ici, parce que tout ce que le lot C5 stocke est en millimètres — sauf
 * une taille de caractère, qui est en points. C'est ce qui rend la conversion du contrat
 * réellement porteuse dans ce fichier plutôt que décorative : `fontSize: '10pt'` aurait marché
 * en CSS et n'aurait rien démontré.
 */
const PX_PAR_MM = 2.6;

/**
 * Transcrit UN nom de police opaque en chaîne CSS, sans lui donner la grammaire d'une pile.
 *
 * Passer le nom brut à `fontFamily` ferait de la virgule un séparateur et de `serif` ou
 * `system-ui` des indirections vers la machine. Le contrat autorise au contraire une police qui
 * s'appellerait réellement « Serif » et refuse toute pile de repli : les guillemets portent cette
 * différence. Les caractères de contrôle passent par un échappement hexadécimal CSS ; le guillemet
 * et la barre oblique inverse sont échappés directement.
 */
function familleDePoliceCss(famille: string | undefined): string | undefined {
  if (famille === undefined) {
    return undefined;
  }

  const morceaux: string[] = [];
  for (const caractere of famille) {
    const pointDeCode = caractere.codePointAt(0);
    if (pointDeCode === undefined) {
      continue;
    }
    if (caractere === '"' || caractere === '\\') {
      morceaux.push(`\\${caractere}`);
    } else if (pointDeCode <= 0x1f || pointDeCode === 0x7f) {
      morceaux.push(`\\${pointDeCode.toString(16)} `);
    } else {
      morceaux.push(caractere);
    }
  }
  return `"${morceaux.join('')}"`;
}

const filetCss = (arete: BorderEdge | undefined): string | undefined =>
  arete === undefined ? undefined : `${arete.width * PX_PAR_MM}px solid ${arete.color}`;

/**
 * Le CSS d'un nœud, DÉRIVÉ de ce que le nœud déclare — jamais l'inverse.
 *
 * C'est le sens de la dérivation qui compte. Une feuille de style écrite à la main à côté du
 * modèle ressemblerait au résultat et ne prouverait rien ; ici, chaque propriété vient d'un champ
 * que le contrat porte, et retirer le champ du modèle éteint la propriété.
 *
 * ## La conversion vient du CONTRAT, et c'est une dépendance plutôt qu'une convention
 *
 * `mmFromPt` est importée, pas réécrite. Le motif est mesuré et il est le même que celui de
 * `printableAreaOf` : `(pt * 25.4) / 72` et `pt * (25.4 / 72)` rendent deux doubles différents
 * pour 31,5 % des tailles entières, et la décision produit 7 promet un aperçu IDENTIQUE au PDF.
 * Une conversion réécrite ici casserait cette promesse en silence. Ce fichier est le premier
 * consommateur nommé de cette fonction.
 *
 * ## Ce que cette fonction NE fait PAS
 *
 * Elle n'invente aucune valeur par défaut. Un champ absent laisse la propriété CSS absente, et
 * c'est le navigateur qui décide — ce qui est exactement la dette que l'ADR 0007 nomme pour les
 * cinq valeurs typographiques qu'un run peut ne pas déclarer. Écrire un défaut ici serait écrire
 * une règle de rendu dans une démonstration, au lieu de montrer le trou.
 */
function styleCssDe(box: BoxStyle | undefined, typo: Typography | undefined): CSSProperties {
  const mm = (valeur: number): string => `${valeur * PX_PAR_MM}px`;

  return {
    backgroundColor: box?.background,
    borderTop: filetCss(box?.border?.top),
    borderRight: filetCss(box?.border?.right),
    borderBottom: filetCss(box?.border?.bottom),
    borderLeft: filetCss(box?.border?.left),
    paddingTop: box?.padding === undefined ? undefined : mm(box.padding.top),
    paddingRight: box?.padding === undefined ? undefined : mm(box.padding.right),
    paddingBottom: box?.padding === undefined ? undefined : mm(box.padding.bottom),
    paddingLeft: box?.padding === undefined ? undefined : mm(box.padding.left),
    fontFamily: familleDePoliceCss(typo?.family),
    // Points -> millimètres par la conversion DU CONTRAT, puis millimètres -> pixels par
    // l'échelle déclarée. Deux étapes, une seule orthographe de la première.
    fontSize: typo?.sizePt === undefined ? undefined : mm(mmFromPt(typo.sizePt)),
    fontWeight: typo?.bold === undefined ? undefined : typo.bold ? 700 : 400,
    fontStyle: typo?.italic === undefined ? undefined : typo.italic ? 'italic' : 'normal',
    color: typo?.color,
  };
}

/** `start`/`end` restent tels quels : CSS les connaît, et rien n'est résolu ici. */
const alignementCss = (align: TextAlignment | undefined): CSSProperties['textAlign'] => align;

/**
 * Apparie chaque élément d'une liste à une clé stable DANS CETTE LISTE.
 *
 * Un identifiant de nœud ne suffit pas, et c'est une propriété du contrat plutôt qu'un défaut :
 * deux itérations d'une boucle rendent le MÊME id, puisque c'est le même sous-arbre répété. La
 * position dans la liste rendue est donc la seule chose qui les distingue, et la calculer ICI
 * plutôt que dans le JSX permet d'écrire la raison une fois au lieu de la répéter à chaque site.
 */
const avecCle = <T,>(
  items: readonly T[],
  nom: (item: T) => string,
): readonly { readonly cle: string; readonly item: T }[] =>
  items.map((item, index) => ({ cle: `${nom(item)}#${index}`, item }));

/**
 * Peint un bloc, AU SEGMENT, avec ce que le modèle déclare et rien de plus.
 *
 * ## Ce que cette fonction démontre, et ce qu'elle ne peut pas démontrer
 *
 * Elle démontre que l'apparence est ENTIÈREMENT dans le document : le même appel, sur deux
 * modèles qui ne diffèrent que par leur apparence, rend deux factures très différentes. Elle ne
 * démontre RIEN sur la pagination, la coupe, la fusion de deux filets adjacents ou la place d'une
 * image sans dimension : ce sont les attentes que l'ADR 0007 nomme envers le moteur, et cette page
 * n'est pas un moteur.
 *
 * Le parcours passe par `visitNode`, et les huit branches sont nommées : un neuvième type de bloc
 * casse la compilation ICI, à un site unique.
 */
function Bloc({
  bloc,
  scope,
  budget,
  colonne,
}: {
  readonly bloc: BlockNode;
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
  readonly colonne?: TableColumnAlignment | undefined;
}) {
  const enfants = (blocs: readonly BlockNode[], portee: EvaluationScope = scope) =>
    avecCle(blocs, (enfant) => enfant.id).map(({ cle, item }) => (
      <Bloc key={cle} bloc={item} scope={portee} budget={budget} />
    ));

  return visitNode<ReactNode>(bloc, {
    text: (texte) => (
      <div
        style={{
          ...styleCssDe(texte.box, undefined),
          // La précédence vient du CONTRAT : `resolveTextAlign` est la seule orthographe de
          // « d'où vient le défaut », et la colonne n'est qu'un défaut.
          textAlign: alignementCss(resolveTextAlign({ text: texte.align, column: colonne })),
        }}
      >
        {/* Un <span> PAR RUN, parce que `typography` vit sur le segment autant que sur le
            bloc : c'est ce qui rend « Total : 1 200 € » -- une graisse à l'intérieur d'une
            phrase -- exprimable, et c'est nommément ce que l'ADR 0002 avait laissé ouvert. */}
        {avecCle(
          runsDeSegments(texte.content, scope, budget, texte.typography),
          (run) => run.texte,
        ).map(({ cle, item }) => (
          <span key={cle} style={styleCssDe(undefined, item.typographie)}>
            {item.texte}
          </span>
        ))}
      </div>
    ),
    image: (image) => <div style={styleCssDe(image.box, undefined)}>{image.alt ?? image.src}</div>,
    container: (conteneur) => (
      <div style={styleCssDe(conteneur.box, undefined)}>{enfants(conteneur.children)}</div>
    ),
    // `null` et non un fragment vide : une condition fausse ne rend RIEN, et le dire avec
    // `null` est ce qui distingue « rien » de « un élément qui se trouve être vide ».
    condition: (condition) =>
      evaluatePredicate(condition.when, scope, { budget }) ? enfants(condition.children) : null,
    loop: (boucle) =>
      avecCle(evaluateSequence(boucle.each, scope, { budget }), () => boucle.as).map(
        ({ cle, item }) => (
          // L'alias est lié ICI, dans la portée de l'itération : c'est `childScope` DU CONTRAT,
          // et non une portée recomposée à la main -- ce qui est exactement ce que l'ADR 0002 a
          // corrigé quand cette page inventait `{ line }` elle-même.
          <div key={cle}>{enfants(boucle.children, childScope(scope, boucle.as, item))}</div>
        ),
      ),
    table: (tableau) => <Tableau tableau={tableau} scope={scope} budget={budget} />,
    tableRow: (ligne) => <div>[ligne {ligne.id} hors d'un tableau]</div>,
    tableRowGroup: (groupe) => <div>[groupe {groupe.id} hors d'un tableau]</div>,
  });
}

/**
 * Peint un tableau : les trois sections nommées, les poids de colonne, et les trois `box`.
 *
 * Le `padding` du tableau est retranché de sa largeur AVANT que les poids se la partagent, et le
 * `padding` d'une LIGNE insète le contenu de chaque cellule sans déplacer aucune frontière de
 * colonne. Ce sont les deux phrases du modèle de boîte que le contrat a dû écrire, et cette
 * fonction est ce qui les rend visibles : c'est `box-sizing: border-box` sur le tableau, et un
 * padding porté par la CELLULE et non par la bande.
 */
function Tableau({
  tableau,
  scope,
  budget,
}: {
  readonly tableau: TableNode;
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
}) {
  const parts = partsDeLargeur(tableau.columns);
  const ligne = (row: TableRowNode, portee: EvaluationScope, cle: string) => (
    <tr key={cle} style={{ backgroundColor: row.box?.background }}>
      {tableau.columns.map((column, index) => {
        // Une cellule NOMME sa colonne : la recherche est par clé, jamais par position. C'est
        // exactement ce que la docstring de `TableCell` dit que l'appariement par clé a supprimé.
        const cellule = row.cells.find((candidate) => candidate.columnId === column.id);
        return (
          <td
            key={column.id}
            style={{
              width: parts[index],
              verticalAlign: 'top',
              // ④ du modèle de boîte : le `padding` d'une LIGNE insète le contenu de CHAQUE
              // CELLULE, à l'identique, et ne déplace AUCUNE frontière de colonne. Insérer la
              // bande entière désalignerait l'en-tête du corps — le défaut que le lot existe
              // pour empêcher.
              ...styleCssDe(
                row.box?.padding === undefined ? undefined : { padding: row.box.padding },
                undefined,
              ),
              borderTop: filetCss(row.box?.border?.top),
              borderRight:
                index === tableau.columns.length - 1 ? filetCss(row.box?.border?.right) : undefined,
              borderBottom: filetCss(row.box?.border?.bottom),
              borderLeft: index === 0 ? filetCss(row.box?.border?.left) : undefined,
              textAlign: alignementCss(column.align),
            }}
          >
            {avecCle(cellule?.children ?? [], (enfant) => enfant.id).map(({ cle, item }) => (
              <Bloc key={cle} bloc={item} scope={portee} budget={budget} colonne={column.align} />
            ))}
          </td>
        );
      })}
    </tr>
  );

  return (
    <table
      style={{
        // ③ : les poids se résolvent contre la largeur de CONTENU du tableau, donc son
        // `padding` est retranché AVANT le partage. `border-box` est ce qui l'exprime en CSS.
        boxSizing: 'border-box',
        width: '100%',
        borderCollapse: 'collapse',
        ...styleCssDe(tableau.box, undefined),
      }}
    >
      <thead>{tableau.header.map((row) => ligne(row, scope, `h-${row.id}`))}</thead>
      <tbody>
        {tableau.body.flatMap((entree) =>
          entree.type === 'tableRow'
            ? [ligne(entree, scope, `b-${entree.id}`)]
            : avecCle(evaluateSequence(entree.each, scope, { budget }), () => entree.id).flatMap(
                ({ cle, item }) =>
                  entree.rows.map((row) =>
                    ligne(row, childScope(scope, entree.as, item), `b-${cle}-${row.id}`),
                  ),
              ),
        )}
      </tbody>
      <tfoot>{tableau.footer.map((row) => ligne(row, scope, `f-${row.id}`))}</tfoot>
    </table>
  );
}

/**
 * Les deux listes de chemins de données, et l'égalité est la moitié MÉCANIQUEMENT VÉRIFIABLE du
 * critère de recette.
 *
 * L'autre moitié — « visuellement très différentes » — est une REVUE HUMAINE, et aucune assertion
 * ne peut en tenir lieu. Le plan nomme qui la fait ; cette page se contente de mettre les deux
 * factures côte à côte pour qu'elle soit possible.
 */
const cheminsA = collectTemplateDataPaths(sampleTemplate);
const cheminsB = collectTemplateDataPaths(factureVariante);
const cheminsIdentiques =
  cheminsA.length === cheminsB.length && cheminsA.every((chemin, i) => chemin === cheminsB[i]);

/**
 * Ce qu'un bloc affiche, dans la portée qu'on lui donne.
 *
 * **Le parcours passe par `visitNode`, et les huit branches sont nommées.** C'est la règle
 * qu'`AGENTS.md` §3.B pose et que ce fichier applique déjà aux segments (`rawSegments`) :
 * un neuvième type de bloc casse la compilation ICI, à un site unique, au lieu de se
 * découvrir à l'exécution.
 *
 * Aucune branche ne lève et aucune ne rend le vide en silence, et les deux moitiés de cette
 * phrase ont été des défauts. Un `throw` était atteint depuis la portée de MODULE — les
 * constantes ci-dessous sont évaluées avant que React existe —, si bien qu'une image dans une
 * cellule rendait une page BLANCHE plutôt qu'une section dégradée. Et la branche `condition`
 * rendait `''` pour tout enfant non textuel, exactement ce que la docstring promettait de ne
 * pas faire. Les trois blocs que cette démonstration ne sait pas mettre en page rendent
 * désormais un MARQUEUR VISIBLE : ni exception, ni silence.
 */
function texteDeBloc(block: BlockNode, scope: EvaluationScope, budget: EvaluationBudget): string {
  const descendre = (blocs: readonly BlockNode[]): string =>
    blocs
      .map((enfant) => texteDeBloc(enfant, scope, budget))
      .filter((texte) => texte !== '')
      .join(' ');

  return visitNode<string>(block, {
    text: (texte) => texteDeSegments(texte.content, scope, budget),
    image: (image) => image.alt ?? `[image ${image.src}]`,
    container: (conteneur) => descendre(conteneur.children),
    // Récursive, et c'est la correction : un `container`, une seconde condition ou une image
    // sous une condition descendent par le même chemin que partout ailleurs.
    condition: (condition) =>
      evaluatePredicate(condition.when, scope, { budget }) ? descendre(condition.children) : '',
    loop: (boucle) => `[loop ${boucle.as} non mis en page par cette démonstration]`,
    table: (imbrique) => `[tableau imbriqué ${imbrique.id} non mis en page ici]`,
    tableRow: (ligne) => `[ligne ${ligne.id} hors d'un tableau]`,
    tableRowGroup: (groupe) => `[groupe ${groupe.id} hors d'un tableau]`,
  });
}

function texteDeCellule(cell: TableCell, scope: EvaluationScope, budget: EvaluationBudget): string {
  return cell.children
    .map((block) => texteDeBloc(block, scope, budget))
    .filter((text) => text !== '')
    .join(' ');
}

/** Une case prête à afficher : sa COLONNE et son texte, appariés une seule fois. */
interface CaseAffichee {
  readonly column: TableColumn;
  readonly texte: string;
}

/**
 * Une ligne prête à afficher : une case par colonne déclarée, vide là où la ligne est courte.
 *
 * Rend la **colonne avec son texte** plutôt qu'un texte seul, et ce n'est pas une commodité :
 * en ne rendant que des chaînes, l'affichage devait retrouver la colonne PAR POSITION —
 * `columns[index]?.align ?? 'start'`, six fois — c'est-à-dire recroiser deux tableaux par
 * index, exactement ce que la docstring de `TableCell` dit que l'appariement par clé a
 * supprimé. Le `?? 'start'` inventait de surcroît un alignement que le modèle n'a pas déclaré,
 * dans une section qui affirme que rien n'est inventé en chemin.
 */
function casesDeLigne(
  row: TableRowNode,
  columns: readonly TableColumn[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): readonly CaseAffichee[] {
  // La cellule NOMME sa colonne : on cherche par `columnId`, jamais par position. C'est ce qui
  // rend une ligne courte naturelle au lieu d'une suite de remplissages.
  return columns.map((column) => {
    const cell = row.cells.find((candidate) => candidate.columnId === column.id);
    return { column, texte: cell === undefined ? '' : texteDeCellule(cell, scope, budget) };
  });
}

const tableauLignes = requireTableNode(root, 'lignes');
const largeurs = partsDeLargeur(tableauLignes.columns);

const lignesEntete = tableauLignes.header.map((row) => ({
  id: row.id,
  cases: casesDeLigne(row, tableauLignes.columns, renderData, budgetFacture),
}));

// Le corps : une portée dérivée par élément, exactement comme une boucle, et l'alias est
// déclaré par le GROUPE. L'en-tête et le pied ne le voient pas — c'est la raison pour laquelle
// la répétition vit sur `tableRowGroup` et non sur le tableau.
const lignesCorps = tableauLignes.body.flatMap((entry) => {
  if (entry.type === 'tableRow') {
    return [
      {
        id: entry.id,
        cases: casesDeLigne(entry, tableauLignes.columns, renderData, budgetFacture),
      },
    ];
  }
  return evaluateSequence(entry.each, renderData, {
    budget: budgetFacture,
    caller: 'tableRowGroup',
  }).flatMap((item) => {
    const itemScope = childScope(renderData, entry.as, item);
    return entry.rows.map((row) => ({
      id: row.id,
      cases: casesDeLigne(row, tableauLignes.columns, itemScope, budgetFacture),
    }));
  });
});

const lignesPied = tableauLignes.footer.map((row) => ({
  id: row.id,
  cases: casesDeLigne(row, tableauLignes.columns, renderData, budgetFacture),
}));

/* ------------------------------------------------------------------------------------- *
 * Trois modèles, un jeu de données, trois totaux
 * ------------------------------------------------------------------------------------- */

/** `quantite * prixUnitaire` sur le second jeu de lignes. Aucun montant n'est fourni. */
const montantLigne: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'l.quantite' },
  right: { kind: 'path', path: 'l.prixUnitaire' },
};

/** Le kind du lot C2 : trois champs requis, et la POSITION dans l'arbre est la déclaration. */
const arrondir = (value: PrintableExpression, mode: RoundMode): RoundExpression => ({
  kind: 'round',
  value,
  decimals: 2,
  mode,
});

const sommeDes = (value: PrintableExpression): PrintableExpression => ({
  kind: 'aggregate',
  op: 'sum',
  source: { kind: 'path', path: 'arrondi.lignes' },
  as: 'l',
  value,
});

interface ModeleArrondi {
  readonly cle: string;
  readonly libelle: string;
  readonly template: Template;
  readonly budget: EvaluationBudget;
}

/**
 * Un modèle complet par variante, PARSÉ — pas une expression évaluée à la volée.
 *
 * Chacun porte son propre budget, et c'est le contrat : « le budget de travail du rendu
 * ENTIER, créé une fois par le pipeline et partagé par toute expression du DOCUMENT ».
 * Trois modèles sont trois documents. Un budget commun ferait dépendre le compteur affiché
 * sous B de ce que A a déjà dépensé, donc de l'ordre de la démonstration — et un
 * intégrateur qui recopie cette page câblerait un budget de rendu sur une session.
 */
function modeleArrondi(
  cle: string,
  libelle: string,
  parLigne: PrintableExpression,
  mode: RoundMode,
): ModeleArrondi {
  // Le total est DÉRIVÉ de l'expression de ligne, jamais réécrit à côté d'elle : c'est ce
  // qui garantit que la colonne d'un modèle et son total somment bien la même chose. Épelé
  // deux fois, rien n'obligerait les deux copies à rester identiques, et les désaccorder
  // rendrait la démonstration silencieusement fausse — aucune porte ne lit ce fichier.
  const total = arrondir(sommeDes(parLigne), mode);
  return {
    cle,
    libelle,
    template: parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `tpl_arrondi_${cle}`,
      name: `Arrondi ${cle}`,
      version: '1.0.0',
      // Une page nue : ces trois modèles démontrent l'arrondi, pas la feuille. Le champ est
      // requis, donc leur auteur l'écrit — et c'est exactement ce que « impose » veut dire.
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        header: [],
        footer: [],
      },
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lignes',
            each: { kind: 'path', path: 'arrondi.lignes' },
            as: 'l',
            children: [
              { type: 'text', id: 'montant', content: [{ kind: 'binding', value: parLigne }] },
            ],
          },
          { type: 'text', id: 'total', content: [{ kind: 'binding', value: total }] },
        ],
      },
    }),
    budget: createBudget(),
  };
}

const modeles: readonly ModeleArrondi[] = [
  modeleArrondi(
    'A',
    'lignes arrondies, puis le total — halfExpand',
    arrondir(montantLigne, 'halfExpand'),
    'halfExpand',
  ),
  modeleArrondi(
    'B',
    'lignes arrondies, puis le total — halfEven',
    arrondir(montantLigne, 'halfEven'),
    'halfEven',
  ),
  modeleArrondi(
    'A′',
    'lignes exactes, total seul arrondi — halfExpand',
    montantLigne,
    'halfExpand',
  ),
];

/** La liaison d'un nœud de texte à une seule liaison. Tombe plutôt que de dégrader. */
function premiereLiaison(segments: readonly TextSegment[], quoi: string): PrintableExpression {
  const segment = segments[0];
  if (segment?.kind !== 'binding') {
    throw new Error(`« ${quoi} » devrait porter une liaison : contrat de core cassé.`);
  }
  return segment.value;
}

function nombre(value: unknown, quoi: string): number {
  if (typeof value !== 'number') {
    // `TypeError` plutôt qu'`Error` : ce qui échoue ici est un contrôle de type, et la classe
    // le dit à qui inspecte l'erreur — comme `goesUp` le fait dans `core`.
    throw new TypeError(`« ${quoi} » aurait dû être un nombre : contrat de core cassé.`);
  }
  return value;
}

interface LectureArrondi {
  readonly modele: ModeleArrondi;
  readonly montants: readonly number[];
  readonly total: number;
}

/** Tout se lit sur le document VALIDÉ, comme partout ailleurs sur cette page. */
function lireModele(modele: ModeleArrondi): LectureArrondi {
  const documentRoot = modele.template.root;
  const boucle = requireNode(documentRoot, 'lignes');
  if (boucle.type !== 'loop') {
    throw new Error(`« lignes » devrait être une boucle, pas un ${boucle.type}.`);
  }
  const liaisonMontant = premiereLiaison(requireTextNode(documentRoot, 'montant'), 'montant');
  const liaisonTotal = premiereLiaison(requireTextNode(documentRoot, 'total'), 'total');
  const options = { budget: modele.budget };

  return {
    modele,
    montants: evaluateSequence(boucle.each, renderData, options).map((item) =>
      nombre(
        evaluateExpression(liaisonMontant, childScope(renderData, boucle.as, item), options),
        `montant du modèle ${modele.cle}`,
      ),
    ),
    total: nombre(
      evaluateExpression(liaisonTotal, renderData, options),
      `total du modèle ${modele.cle}`,
    ),
  };
}

const lectures: readonly LectureArrondi[] = modeles.map(lireModele);

/**
 * La prose ci-dessous NOMME des chiffres ; elle les lit donc, elle ne les recopie pas.
 *
 * Écrits en dur à côté d'un tableau calculé en direct, ils se périment au premier coup d'œil
 * de quelqu'un qui édite les cinq lignes de démonstration — et aucune porte ne relit ce
 * fichier, `apps/*` étant hors du glob de Vitest. La page enseignerait alors une conclusion
 * que son propre tableau contredit.
 */
function lectureDe(cle: string): LectureArrondi {
  const lecture = lectures.find((candidate) => candidate.modele.cle === cle);
  if (lecture === undefined) {
    throw new Error(`Modèle « ${cle} » absent : la démonstration ne dit plus ce qu'elle annonce.`);
  }
  return lecture;
}

const lectureA = lectureDe('A');
const lectureB = lectureDe('B');
const lectureAPrime = lectureDe('A′');

/**
 * Les lignes que l'arrondi change réellement — c'est-à-dire celles dont le montant exact
 * n'est pas déjà au centime. Dérivées plutôt que listées : c'est exactement le point
 * pédagogique, et une ligne ajoutée au jeu de données entre d'elle-même dans la phrase.
 */
const lignesDyadiques = lectureAPrime.montants.filter(
  (montant, index) => montant !== lectureA.montants[index],
);

/** L'écriture française d'un nombre calculé, pour que la prose et le tableau concordent. */
const fr = (value: number): string => String(value).replace('.', ',');

/** Les lignes du second jeu, telles que la page les affiche à gauche du tableau. */
const lignesArrondi = renderData.arrondi.lignes;

/**
 * Un refus au SAVE TIME, qui n'a rien à voir avec un refus au rendu.
 *
 * Il lui faut son propre véhicule : `reportRefusal` ne capture qu'une
 * `ExpressionEvaluationError` et relance tout le reste, or un `ZodError` ne porte ni
 * `code`, ni `site`, ni `at`. Et l'argument fautif ne se construirait même pas —
 * `{ mode: 'halfUp' }` ne type-checke pas comme `Expression`, ce qui est exactement le
 * garde-fou attendu côté TypeScript. D'où un `unknown` et un `safeParse`.
 */
interface ParseRefusalReport {
  readonly title: string;
  readonly path: string;
  readonly message: string;
}

function reportParseRefusal(title: string, raw: unknown): ParseRefusalReport {
  const result = ExpressionSchema.safeParse(raw);
  if (result.success) {
    throw new Error(`« ${title} » aurait dû être refusée au parse : contrat de core cassé.`);
  }
  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new Error(`« ${title} » a été refusée sans motif : contrat de core cassé.`);
  }
  return { title, path: issue.path.join(' → '), message: issue.message };
}

const arrondiValide = { kind: 'round', value: { kind: 'path', path: 'arrondi.total' } };

const parseRefusals: readonly ParseRefusalReport[] = [
  reportParseRefusal('Un mode qui n’existe pas', { ...arrondiValide, decimals: 2, mode: 'halfUp' }),
  reportParseRefusal('Un nom de règle plutôt qu’une opération', {
    ...arrondiValide,
    decimals: 2,
    mode: 'bankers',
  }),
  reportParseRefusal('Une position fractionnaire', {
    ...arrondiValide,
    decimals: 2.5,
    mode: 'halfEven',
  }),
  reportParseRefusal('Une position hors de la fenêtre', {
    ...arrondiValide,
    decimals: MIN_ROUND_DECIMALS - 1,
    mode: 'halfEven',
  }),
];

/**
 * Le même contrôle, du point de vue de l'INTÉGRATEUR.
 *
 * Il construit un nœud par programme et veut le valider avant de le stocker, sans passer
 * par le template entier : c'est ce consommateur — immédiat, et hors du dépôt — qui
 * justifie que le kind exporte son schéma membre et les deux bornes de sa fenêtre.
 */
const horsFenetre = RoundExpressionSchema.safeParse({
  ...arrondiValide,
  decimals: MAX_ROUND_DECIMALS + 1,
  mode: 'halfExpand',
});
const messageHorsFenetre = horsFenetre.success
  ? '(acceptée — ce que le contrat interdit)'
  : (horsFenetre.error.issues[0]?.message ?? '(refusée sans motif)');

/**
 * Un avant-goût du lot C8 : la charge machine qu'une formule fautive rend.
 *
 * Le `catch` EST la démonstration ici — c'est la seule section où il ne s'agit pas de
 * dégrader. Il est narrowé par `instanceof`, jamais par un cast, et il affiche
 * `details.code`, `details.site` et `details.at`. Le champ s'appelle `site` et non
 * `kind` parce que `LoopNode.each` et `ConditionNode.when` portent une expression sans
 * en être : `ExpressionKind` ne suffisait pas.
 *
 * Rien de la charge ne vient des DONNÉES : `actualType` est le *tag* d'une valeur, pas
 * la valeur. C'est ce qui rend un refus sûr à journaliser même quand le document ne
 * l'est pas.
 */
interface RefusalReport {
  readonly title: string;
  readonly code: string;
  readonly site: string;
  readonly at: string;
  readonly detail: string;
  readonly message: string;
}

/**
 * Le budget des démonstrations de refus, et il est SÉPARÉ de celui de la facture.
 *
 * Ces quatre formules fautives n'appartiennent à aucun document : les charger au budget de
 * la facture gonflait le compteur que la section « Budget du rendu » affiche sous son nom —
 * mesuré, 145 opérations affichées pour 124 réelles. La page enseigne qu'un compteur partagé
 * au-delà d'un document est l'erreur ; elle n'a pas le droit de la commettre en la montrant.
 */
const budgetDemonstrations: EvaluationBudget = createBudget();

function reportRefusal(title: string, expression: Expression): RefusalReport {
  try {
    evaluateExpression(expression, renderData, { budget: budgetDemonstrations });
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      const details = error.details;
      return {
        title,
        code: details.code,
        site: details.site,
        at: details.at.length === 0 ? '(racine)' : details.at.join(' → '),
        detail:
          'actualType' in details
            ? `actualType : ${details.actualType}`
            : `limit : ${details.limit}`,
        message: error.message,
      };
    }
    throw error;
  }
  throw new Error(`« ${title} » aurait dû être refusée : contrat de core cassé.`);
}

const refusals: readonly RefusalReport[] = [
  reportRefusal('Diviser par un nombre de lignes non gardé', {
    kind: 'arithmetic',
    op: 'div',
    left: totalHT,
    right: { kind: 'literal', value: 0 },
  }),
  reportRefusal('Additionner un texte à un nombre', {
    kind: 'arithmetic',
    op: 'add',
    left: { kind: 'path', path: 'commande.client' },
    right: { kind: 'literal', value: 1 },
  }),
  reportRefusal('Coller un nombre sans passer par text()', {
    kind: 'concat',
    parts: [
      { kind: 'literal', value: 'N° ' },
      { kind: 'path', path: 'commande.numero' },
    ],
  }),
  reportRefusal('Une date qui n’existe pas au calendrier', {
    kind: 'endOfMonth',
    date: { kind: 'literal', value: '2026-02-30' },
  }),
];

const codeStyle = {
  background: '#f4f4f4',
  padding: '1rem',
  borderRadius: '4px',
  overflowX: 'auto',
} as const;

const refusalStyle = {
  background: '#fff4f4',
  border: '1px solid #f0c0c0',
  padding: '0.75rem',
  borderRadius: '4px',
  marginBottom: '0.75rem',
} as const;

/**
 * Une couleur distincte : un refus au save time n'est pas un refus au rendu.
 *
 * Dérivé, pas recopié — les deux sortes de cartes se lisent en séquence sur la même page, et
 * la phrase ci-dessus ne reste vraie que si la géométrie a UNE source.
 */
const parseRefusalStyle = {
  ...refusalStyle,
  background: '#fffaf0',
  border: '1px solid #e8d5a0',
} as const;

const tableStyle = { borderCollapse: 'collapse', marginBottom: '1rem' } as const;

const cellStyle = {
  border: '1px solid #ddd',
  padding: '0.35rem 0.75rem',
  textAlign: 'left',
} as const;

/** L'écart d'un centime se lit sur cette ligne : elle est mise en évidence pour cela. */
const totalCellStyle = { ...cellStyle, background: '#f0f6ff', fontWeight: 'bold' } as const;

/**
 * Le pied du tableau de lignes, et il ne réutilise PAS `totalCellStyle`.
 *
 * Celui-ci existe pour une raison nommée — « l'écart d'un centime se lit sur cette ligne » —
 * et l'emprunter pour une ligne de total ordinaire rendrait ce commentaire faux. Deux raisons,
 * deux constantes.
 */
const pieceDePiedStyle = { ...cellStyle, fontWeight: 'bold' } as const;

/**
 * Le style du tableau de lignes, et il est SÉPARÉ de `tableStyle` pour deux raisons.
 *
 * `tableLayout: 'fixed'` plus une largeur définie sont ce qui rend les pourcentages de
 * `<colgroup>` **autoritaires**. Sans eux, l'algorithme de table automatique traite une
 * largeur de colonne en pourcentage comme une simple suggestion et la fait perdre contre le
 * minimum de contenu : mesuré, un conteneur contraint rendait 24,79 / 14,10 / 19,06 / 21,59 /
 * 20,47 % là où le modèle déclare 33,33 / 11,11 / 16,67 / 16,67 / 22,22 %. La section affirme
 * que les largeurs sont `width / Σ width` ; il faut donc que ce soit vrai, et pas seulement
 * dans une fenêtre assez large pour que le tableau puisse grandir.
 *
 * Et c'est une constante distincte parce que le `<table>` comparatif des trois arrondis
 * partage `tableStyle` et doit rester inchangé — il agrège trois documents et porte un
 * `colSpan` que le contrat ne décrit pas.
 */
const tableauLignesStyle = { ...tableStyle, width: '100%', tableLayout: 'fixed' } as const;

/* ------------------------------------------------------------------------------------- *
 * La page : une feuille dessinée à l'échelle, et rien de plus
 * ------------------------------------------------------------------------------------- */

/**
 * La page du modèle VALIDÉ, lue comme tout le reste de cette section.
 *
 * `sampleTemplate.page` et non le littéral écrit plus haut : ce qui est dessiné est ce que
 * le parse a rendu, pas ce que l'auteur croyait avoir écrit.
 */
const pageModele: PageSetup = sampleTemplate.page;

/**
 * L'aire imprimable, obtenue de `printableAreaOf` et JAMAIS recalculée ici.
 *
 * Le playground devient ainsi le troisième consommateur de cette fonction, après le moteur
 * (E1) et le viewer (V1). C'est tout l'argument rendu visible : `largeur - gauche - droite`
 * n'est pas UNE opération — mesuré, `215.9 - (25.4 + 25.4)` rend `165.10000000000002` et
 * `(215.9 - 25.4) - 25.4` rend `165.1`. Deux implémentations qui écrivent la soustraction
 * chacune de leur côté n'écrivent pas la même formule ; une fonction exportée fait de cet
 * accord une DÉPENDANCE.
 */
const aireImprimable = printableAreaOf(pageModele);

/** Le facteur d'échelle du dessin : la feuille tient dans 320 px de large. */
const ECHELLE = 320 / pageModele.sheet.width;

/**
 * L'occurrence en clair, et les CINQ ont un libellé.
 *
 * Un `Record` sur l'union plutôt qu'un `switch` : un membre ajouté à
 * `PAGE_BAND_OCCURRENCES` et pas ici ne compile pas. Sans cela, le playground montrerait un
 * tuple partiel sans que rien ne le signale.
 */
const LIBELLE_OCCURRENCE: Readonly<Record<PageBandOccurrence, string>> = {
  every: 'sur toutes les pages',
  firstOnly: 'première page seulement',
  exceptFirst: 'sauf la première',
  exceptLast: 'sauf la dernière',
  lastOnly: 'dernière page seulement',
};

/** Ce qu'une bande affiche dans le dessin : son rang d'application et son contenu résolu. */
interface BandeAffichee {
  readonly cle: string;
  readonly occurrence: string;
  readonly texte: string;
}

function bandesAffichees(cote: 'header' | 'footer'): readonly BandeAffichee[] {
  return pageModele[cote].map((bande: PageBand, index: number) => ({
    cle: `${cote}-${index}`,
    occurrence: LIBELLE_OCCURRENCE[bande.on],
    texte: texteDeBloc(bande.content, renderData, budgetFacture),
  }));
}

const bandesHaut = bandesAffichees('header');
const bandesBas = bandesAffichees('footer');

const feuilleStyle = {
  position: 'relative',
  width: `${pageModele.sheet.width * ECHELLE}px`,
  height: `${pageModele.sheet.height * ECHELLE}px`,
  border: '1px solid #999',
  background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
} as const;

/**
 * La zone imprimable, positionnée par les marges et DIMENSIONNÉE par `printableAreaOf`.
 *
 * Les décalages viennent des marges, les dimensions de la fonction : c'est ce qui rend le
 * dessin faux si quelqu'un « corrige » la soustraction ailleurs.
 */
const zoneImprimableStyle = {
  position: 'absolute',
  left: `${pageModele.margins.left * ECHELLE}px`,
  top: `${pageModele.margins.top * ECHELLE}px`,
  width: `${aireImprimable.width * ECHELLE}px`,
  height: `${aireImprimable.height * ECHELLE}px`,
  border: '1px dashed #6a9fd4',
  background: '#f6faff',
} as const;

const bandeStyle = {
  background: '#fff8e6',
  border: '1px solid #e8d5a0',
  borderRadius: '4px',
  padding: '0.4rem 0.6rem',
  marginBottom: '0.4rem',
  fontSize: '0.85rem',
} as const;

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>🚀 Openview Playground</h1>
      <p>
        Template <strong>{sampleTemplate.name}</strong> validé au schéma v
        {sampleTemplate.schemaVersion}.
      </p>

      <h2>Parcours de l'AST (Visiteur, profondeur d'abord)</h2>
      <ol>
        {nodeIds.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ol>

      <h2>Données requises (analyse statique des expressions)</h2>
      <p>
        Aucun alias n'y figure : <code>line</code> est déclaré par le template, qu'il soit lié par
        le groupe de lignes du tableau, par l'agrégat ou par le filtre — <strong>quatre</strong>{' '}
        sites d'alias depuis le lot C3, et le quatrième ne fuit pas plus que les trois autres. Les
        autres chemins sont les noms choisis par l'application intégratrice — c'est la liste que le
        moteur <em>rend</em> à l'appelant, pas une liste qu'il lui <em>impose</em>. Remarquez qu'
        <code>traitement.effectueLe</code> y figure comme n'importe quelle autre clé : « aujourd'hui
        » est une donnée, pas une horloge.
      </p>
      <p>
        Depuis le lot C4, cette liste vient de <code>collectTemplateDataPaths</code> et non de{' '}
        <code>collectDataPaths(root)</code> : les bandes de page vivent <em>hors</em> de{' '}
        <code>root</code>, donc la seconde forme omettrait <code>societe.mentionsLegales</code> — lu
        par le pied de dernière page et par lui seul. Le symptôme ne serait pas une erreur mais un{' '}
        <strong>blanc</strong> : on aurait dit à l'appelant de fournir les{' '}
        <strong>{dataPaths.length - 1}</strong> premières clés de cette liste, jamais la{' '}
        <strong>{dataPaths.length}</strong>
        <sup>e</sup>, et le pied s'imprimerait vide. Les deux nombres sont <em>calculés</em> sur la
        liste affichée juste dessous : une prose qui les écrit en dur finit par la contredire.
      </p>
      <ul>
        {dataPaths.map((dataPath) => (
          <li key={dataPath}>
            <code>{dataPath}</code>
          </li>
        ))}
      </ul>

      <h2>La page : une feuille, des marges, et ce qui se répète</h2>
      <p>
        Le rectangle ci-dessous est <strong>dessiné à l'échelle</strong> depuis{' '}
        <code>page.sheet</code> et <code>page.margins</code> du modèle validé, et la zone en
        pointillés est obtenue de <code>printableAreaOf</code> — <em>jamais recalculée ici</em>.
        Cette page est donc le <strong>troisième consommateur</strong> de cette fonction, après le
        moteur et le viewer, et c'est tout son argument rendu visible :{' '}
        <code>largeur − gauche − droite</code> n'est pas <em>une</em> opération.{' '}
        <code>215,9 − (25,4 + 25,4)</code> vaut <code>165.10000000000002</code> quand{' '}
        <code>(215,9 − 25,4) − 25,4</code> vaut <code>165.1</code> : deux implémentations qui
        écrivent la soustraction chacune de leur côté n'écrivent pas la même formule.
      </p>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={feuilleStyle}>
          <div style={zoneImprimableStyle} />
        </div>
        <div style={{ flex: '1 1 20rem' }}>
          <p style={{ marginTop: 0 }}>
            Feuille <code>{pageModele.sheet.width}</code> × <code>{pageModele.sheet.height}</code>{' '}
            mm — marges <code>{pageModele.margins.top}</code> /{' '}
            <code>{pageModele.margins.right}</code> / <code>{pageModele.margins.bottom}</code> /{' '}
            <code>{pageModele.margins.left}</code> mm — zone imprimable{' '}
            <code>{aireImprimable.width}</code> × <code>{aireImprimable.height}</code> mm.
          </p>
          <p>
            <strong>En haut</strong>
          </p>
          {bandesHaut.map((bande) => (
            <div key={bande.cle} style={bandeStyle}>
              <em>{bande.occurrence}</em> — {bande.texte}
            </div>
          ))}
          <p>
            <strong>En bas</strong>
          </p>
          {bandesBas.map((bande) => (
            <div key={bande.cle} style={bandeStyle}>
              <em>{bande.occurrence}</em> — {bande.texte}
            </div>
          ))}
        </div>
      </div>
      <p>
        Le pied courant est <code>exceptLast</code> et non <code>every</code>, et ce n'est pas un
        choix de style : ce modèle porte <em>aussi</em> un pied de dernière page, et{' '}
        <code>every</code> recoupant tout, la paire <code>every</code> + <code>lastOnly</code> est{' '}
        <strong>refusée par le schéma</strong> — elle poserait deux bandes sur la dernière feuille.
        Sur les vingt-cinq couples d'occurrences, <strong>deux seulement</strong> sont compatibles :{' '}
        <code>firstOnly</code> + <code>exceptFirst</code> et <code>exceptLast</code> +{' '}
        <code>lastOnly</code>. Comme elles ne partagent aucun membre, un côté ne peut jamais porter
        plus de deux bandes.
      </p>
      <p>
        Le <code>1 / 1</code> des pieds est un <strong>espace réservé</strong>.{' '}
        <em>Cette page n'a pas de paginateur</em> : elle ne coupe rien, donc elle ne connaît ni le
        rang d'une page ni leur nombre. Ce que le modèle déclare est un <strong>marqueur</strong> —{' '}
        <code>pageField</code>, un emplacement — et la valeur viendra du moteur (lot E2), la langue
        autour de C6. Rien n'est calculé ici, et <code>collectTemplateDataPaths</code> le confirme :
        les quatre marqueurs de ce modèle ne réclament <em>aucune</em> clé à l'application
        intégratrice.
      </p>
      <p>
        Et ce que cette démonstration <strong>ne peut pas</strong> montrer, dit franchement : la
        répétition (il n'y a qu'une page), la dernière page (il n'y en a pas d'autre), le
        débordement, le report et la moindre coupure. Après C4,{' '}
        <strong>aucun document ne sort sur deux pages</strong> : le lot livre les faits qu'un
        paginateur devra respecter, et le paginateur est le lot E2. Un visiteur qui voudrait voir
        une bande se répéter devra l'attendre.
      </p>

      <h2>L'apparence : deux factures très différentes, un seul jeu de données (lot C5)</h2>
      <p>
        Les deux documents ci-dessous sortent de <strong>la même fonction</strong>,{' '}
        <code>factureAvecApparence</code>, appelée avec deux <code>Apparence</code> différentes.
        Même structure, <strong>mêmes identifiants</strong>, mêmes liaisons, même{' '}
        <code>renderData</code> — et la seule chose qui varie est ce que le lot C5 a ajouté au
        contrat : <code>box</code> sur cinq types de nœud, <code>typography</code> sur le nœud texte
        et sur les trois kinds de segment, <code>align</code> sur le nœud texte.
      </p>
      <p>
        Une <strong>fonction</strong> et non deux littéraux écrits à la main, et ce n'est pas une
        commodité : deux littéraux satisferaient le critère <em>à l'œil</em> en ne prouvant rien —
        rien ne garantirait que la structure et les liaisons soient identiques. Paramétrer le modèle
        rend l'identité structurelle <strong>mécanique</strong>, et fait de l'égalité des deux
        listes de <code>collectTemplateDataPaths</code> un <em>résultat</em> plutôt qu'une
        coïncidence.
      </p>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {[
          { apparence: APPARENCE_A, modele: sampleTemplate },
          { apparence: APPARENCE_B, modele: factureVariante },
        ].map(({ apparence, modele }) => (
          <div key={apparence.nom} style={{ flex: '1 1 340px', minWidth: '320px' }}>
            <p>
              <strong>{apparence.nom}</strong>
            </p>
            <div
              style={{
                border: '1px solid #d0d4da',
                background: '#fff',
                padding: '8px',
                overflowX: 'auto',
              }}
            >
              <Bloc bloc={modele.root} scope={renderData} budget={createBudget()} />
            </div>
          </div>
        ))}
      </div>
      <p>
        Ce que ces deux vues <strong>dérivent</strong> du document, et rien d'autre : le fond, les
        quatre arêtes et l'inset de chaque boîte ; la famille, la taille, la graisse, l'italique et
        la couleur de chaque run ; l'alignement de chaque bloc de texte. Une propriété dont le champ
        est <strong>absent</strong> reste absente du CSS — <em>aucun défaut n'est inventé ici</em>,
        et c'est très exactement la dette que l'ADR 0007 nomme : les cinq valeurs typographiques
        d'un run qui n'en déclare aucune appartiennent au moteur, pas à cette page.
      </p>
      <p>
        La taille de caractère est la <strong>seule longueur en points</strong> du contrat ; tout le
        reste est en millimètres. Elle passe donc par <code>mmFromPt</code>{' '}
        <strong>du contrat</strong>, jamais par une division réécrite ici, avant d'être multipliée
        par l'échelle déclarée de <code>{PX_PAR_MM}</code> px/mm. Le motif est mesuré :{' '}
        <code>(pt * 25.4) / 72</code> et <code>pt * (25.4 / 72)</code> rendent{' '}
        <strong>deux doubles différents pour 31,5 % des tailles entières</strong>, et la décision
        produit 7 promet un aperçu identique au PDF. Cette page est le premier consommateur nommé de
        cette fonction.
      </p>
      <p>
        Et l'alignement passe par <code>resolveTextAlign</code>, pour la même raison de forme : la
        colonne fournit un <strong>défaut</strong>, le bloc tranche. Ce ne sont pas deux
        déclarations d'un même fait — une cellule qui contient une image a le premier et pas le
        second, et une cellule qui contient deux paragraphes a un défaut et <strong>deux</strong>{' '}
        alignements, qui peuvent différer. <code>justify</code> n'existe que sur le tuple du texte :
        une <strong>colonne ne justifie rien</strong>, et l'apparence B le montre sur ses mentions.
      </p>
      <p>
        Les deux clés de données réclamées à l'application intégratrice, côte à côte :{' '}
        <code>{cheminsA.join(', ')}</code> contre <code>{cheminsB.join(', ')}</code> —{' '}
        <strong>{cheminsIdentiques ? 'identiques' : 'DIFFÉRENTES, ce qui est un défaut'}</strong>.
        C'est la moitié <strong>mécaniquement vérifiable</strong> du critère de recette : une
        apparence ne change pas ce qu'un document lit. L'autre moitié — « visuellement très
        différentes » — est une <strong>revue humaine</strong>, et aucune assertion ne peut en tenir
        lieu ; cette page se contente de la rendre possible.
      </p>
      <p>
        Ce que cette démonstration <strong>ne peut pas</strong> montrer, dit franchement : le
        comportement d'une boîte au point de coupe (il n'y a qu'une page), la rencontre de deux
        filets adjacents, la résolution d'un nom de police absent, et la place d'une image sans
        dimension déclarée. Ce sont quatre des <strong>huit attentes envers le moteur</strong> que
        l'ADR 0007 nomme, avec leur propriétaire — elles ne seront vérifiables qu'au lot E2.
      </p>

      <h2>Titre : concaténation, mise en chaîne explicite et majuscules</h2>
      <p>
        <code>{titleSegments.join(' + ')}</code>
      </p>

      <h2>Tableau de lignes : trois sections nommées, et rien de deviné</h2>
      <p>
        Le <code>&lt;table&gt;</code> ci-dessous est <strong>intégralement dérivé</strong> du nœud{' '}
        <code>table</code> du modèle validé : le <code>&lt;thead&gt;</code> depuis{' '}
        <code>header</code>, le <code>&lt;tbody&gt;</code> depuis <code>body</code>, le{' '}
        <code>&lt;tfoot&gt;</code> depuis <code>footer</code>, les largeurs en{' '}
        <code>width / Σ width</code> et les alignements lus sur <code>align</code>. Aucune cellule
        n'est écrite à la main, et <em>aucune information n'est inventée en chemin</em> — c'est
        exactement ce que cette démonstration doit prouver, et qu'aucun test de <code>core</code> ne
        peut prouver, puisque <code>core</code> ne rend rien.
      </p>
      <p>
        Aucun montant de ligne n'est fourni par le jeu de données : chacun est le produit d'une
        quantité par un prix unitaire, calculé par le modèle. La dernière ligne est une{' '}
        <strong>ligne courte</strong> — deux cellules pour cinq colonnes — et son total est une{' '}
        <em>expression du modèle</em>, pas une somme que le tableau saurait faire : son{' '}
        <code>footer</code> n'a nulle part où poser un agrégat.
      </p>
      <table style={tableauLignesStyle}>
        <colgroup>
          {tableauLignes.columns.map((column, index) => (
            <col key={column.id} style={{ width: largeurs[index] }} />
          ))}
        </colgroup>
        {/*
          Une clé de ligne est positionnelle par nature, et c'est vrai des TROIS sections. Les
          lignes ne sont jamais réordonnées, deux lignes identiques doivent rester deux entrées
          distinctes, et une clé dérivée du contenu les confondrait. `row.id` n'est PAS une clé
          valide : `nodeIdSchema` est un simple `z.string().min(1)`, rien dans `core` n'impose
          l'unicité des ids de nœud, et `TableNode.header` déclare explicitement que plusieurs
          lignes d'en-tête sont licites — deux lignes portant le même id passent le schéma et
          donneraient à React deux clés identiques.
        */}
        <thead>
          {lignesEntete.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <th key={column.id} style={{ ...cellStyle, textAlign: column.align }}>
                  {texte}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {lignesCorps.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <td key={column.id} style={{ ...cellStyle, textAlign: column.align }}>
                  {texte}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {lignesPied.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <td key={column.id} style={{ ...pieceDePiedStyle, textAlign: column.align }}>
                  {texte}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>

      <h2>Les quatre montants, tous calculés par le modèle</h2>
      <p>
        <code>{totalSegments.join(' + ')}</code>
      </p>
      <p>
        Le prix moyen passe par un <code>if</code> qui court-circuite : la division n'est évaluée
        que si le nombre de lignes est strictement positif. Aucun arrondi n'est appliqué ici, et
        c'est délibéré : l'arrondi est un nœud <code>round</code> que le modèle écrit là où il en
        veut un. La section suivante montre ce que cette liberté coûte et ce qu'elle rend.
      </p>

      <h2>Trois modèles, un jeu de données, trois totaux</h2>
      <p>
        Les trois modèles ci-dessous lisent <strong>les mêmes cinq lignes</strong> et rendent trois
        totaux différents. Aucun n'est faux : chacun déclare autre chose. C'est le point exact où
        naît le fameux « écart d'un centime », et Openview le rend <em>visible dans l'arbre</em> au
        lieu de le décider à la place de l'auteur.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cellStyle}>Ligne</th>
            <th style={cellStyle}>Quantité</th>
            <th style={cellStyle}>Prix unitaire</th>
            {lectures.map((lecture) => (
              <th key={lecture.modele.cle} style={cellStyle}>
                {lecture.modele.cle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignesArrondi.map((ligne, index) => (
            <tr key={ligne.sku}>
              <td style={cellStyle}>{ligne.sku}</td>
              <td style={cellStyle}>{ligne.quantite}</td>
              <td style={cellStyle}>{ligne.prixUnitaire}</td>
              {lectures.map((lecture) => (
                <td key={lecture.modele.cle} style={cellStyle}>
                  <code>{lecture.montants[index]}</code>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th colSpan={3} style={cellStyle}>
              Total
            </th>
            {lectures.map((lecture) => (
              <td key={lecture.modele.cle} style={totalCellStyle}>
                <code>{lecture.total}</code>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ul>
        {lectures.map((lecture) => (
          <li key={lecture.modele.cle}>
            <strong>{lecture.modele.cle}</strong> — {lecture.modele.libelle}
          </li>
        ))}
      </ul>
      <p>
        <strong>
          Les deux causes de l'écart sont distinctes, et les confondre fait écrire le mauvais
          modèle.
        </strong>
      </p>
      <ul>
        <li>
          <strong>
            {fr(lectureA.total)} contre {fr(lectureB.total)}, c'est le MODE.
          </strong>{' '}
          Même position d'arrondi, même ordre : seules les lignes dyadiques —{' '}
          {lignesDyadiques.map((montant) => fr(montant)).join(' et ')} — sont des égalités exactes,
          et <code>halfEven</code> les renvoie vers le chiffre pair là où <code>halfExpand</code>{' '}
          les éloigne de zéro. Le jeu est fermé à ces deux modes :{' '}
          <code>{ROUND_MODES.join(' | ')}</code>.
        </li>
        <li>
          <strong>
            {fr(lectureAPrime.total)}, c'est la POSITION de la déclaration dans l'arbre.
          </strong>{' '}
          Aucune ligne n'est arrondie ; l'arrondi porte sur le total. Les deux modes rendent ici le{' '}
          <em>même</em> chiffre, ce qui prouve que l'écart précédent ne venait pas d'eux. Un champ{' '}
          <code>precision?</code> posé sur chaque nœud n'aurait pas su exprimer ce cas : il n'y a
          aucun nœud intermédiaire où l'accrocher.
        </li>
      </ul>
      <p>
        Le premier jeu de lignes, plus haut, dit la moitié complémentaire : sur des montants déjà
        exacts au centime, <code>round</code> est l'<strong>identité</strong>. L'arrondi n'apparaît
        que là où le modèle l'écrit, et il ne change une valeur que lorsqu'il y a quelque chose à
        changer.
      </p>
      <p>
        La position se déclare comme un entier littéral, dans une fenêtre fermée de{' '}
        <code>{MIN_ROUND_DECIMALS}</code> à <code>{MAX_ROUND_DECIMALS}</code> : « ce total
        arrondit-il comme les lignes au-dessus ? » se répond alors en comparant deux entiers dans
        l'arbre, <em>sans données et sans rendu</em>.
      </p>

      <h2>Refus à la SAUVEGARDE du modèle (et non au rendu)</h2>
      <p>
        Les refus de la section suivante se produisent au <em>rendu</em> ; ceux-ci se produisent
        quand le modèle est <em>enregistré</em>. La distinction n'est pas cosmétique : ce que le
        schéma tranche au save time est ce que le lot C2 n'a eu besoin d'aucun code d'erreur nouveau
        pour dire. La charge n'a donc ni <code>code</code>, ni <code>site</code> — elle a un chemin
        et une phrase.
      </p>
      <p>
        Les deux premiers rendent <em>la même</em> phrase, et c'est voulu : un nom à consonance
        réglementaire n'obtient aucun traitement de faveur. Un nom désigne une <em>opération</em>,
        jamais une règle — <code>halfEven</code> est le nom de « l'arrondi du banquier » quand on le
        décrit au lieu de l'invoquer.
      </p>
      {parseRefusals.map((refusal) => (
        <div key={refusal.title} style={parseRefusalStyle}>
          <strong>{refusal.title}</strong>
          <ul>
            <li>
              <code>issue.path</code> : <code>{refusal.path}</code>
            </li>
            <li>{refusal.message}</li>
          </ul>
        </div>
      ))}
      <p>
        Et le même contrôle vu de l'application intégratrice, qui construit un nœud par programme et
        le valide avant de le stocker — sans passer par le template entier :{' '}
        <code>RoundExpressionSchema.safeParse</code> d'une position à{' '}
        <code>{MAX_ROUND_DECIMALS + 1}</code> rend « {messageHorsFenetre} ».
      </p>

      <h2>Dates : échéance, « 45 jours fin de mois » et jours de retard</h2>
      <p>
        <code>{dateSegments.join(' + ')}</code>
      </p>
      <p>
        Valeurs brutes en <code>YYYY-MM-DD</code>, qui est une représentation d'<em>échange</em> et
        non un format d'affichage : les rendre en <code>31/03/2026</code> appartient au lot C6. Les
        jours de retard se comptent entre deux dates <em>fournies</em> — le moteur ne lit jamais
        l'horloge, sinon deux rendus du même modèle ne pourraient pas donner le même document.
      </p>

      <h2>
        Compter une liste filtrée : <code>count(filter(…))</code>
      </h2>
      <p>
        <code>{countSegments.join(' + ')}</code>
      </p>

      <h2>Refus compréhensible (avant-goût du lot C8)</h2>
      <p>
        Chaque formule ci-dessous est fautive <em>volontairement</em>. Ce que core rend est un code,
        un opérateur et un chemin depuis la racine de la formule ; il ne rend jamais la valeur
        fautive, seulement sa <em>forme</em>. C'est ce qui rend un refus sûr à journaliser même
        quand le document ne l'est pas.
      </p>
      {refusals.map((refusal) => (
        <div key={refusal.code + refusal.at} style={refusalStyle}>
          <strong>{refusal.title}</strong>
          <ul>
            <li>
              <code>details.code</code> : <code>{refusal.code}</code>
            </li>
            <li>
              <code>details.site</code> : <code>{refusal.site}</code>
            </li>
            <li>
              <code>details.at</code> : <code>{refusal.at}</code>
            </li>
            <li>
              <code>{refusal.detail}</code>
            </li>
          </ul>
          <p>{refusal.message}</p>
        </div>
      ))}

      <h2>Budget du rendu — un par DOCUMENT</h2>
      <p>
        Un budget par <em>appel</em> se réinitialiserait à chaque liaison, et un document de 500
        liaisons obtiendrait 500 fois l'allocation : la borne serait décorative. Mais un budget par{' '}
        <em>page</em> serait faux dans l'autre sens — le compteur d'un document dépendrait de ce
        qu'un autre a déjà consommé, donc de l'ordre de la démonstration. L'unité est le{' '}
        <strong>document</strong>, et cette page en rend quatre : la facture et les trois modèles
        d'arrondi, qui partagent le jeu de données et rien d'autre.
      </p>
      <ul>
        <li>
          <strong>Facture Exemple</strong> — <code>{budgetFacture.spent.steps}</code> opérations et{' '}
          <code>{budgetFacture.spent.itemsVisited}</code> éléments de liste traversés, sur{' '}
          <code>{budgetFacture.limits.maxSteps}</code> et{' '}
          <code>{budgetFacture.limits.maxItemsVisited}</code> autorisés.
        </li>
        {lectures.map((lecture) => (
          <li key={lecture.modele.cle}>
            <strong>Arrondi {lecture.modele.cle}</strong> —{' '}
            <code>{lecture.modele.budget.spent.steps}</code> opérations et{' '}
            <code>{lecture.modele.budget.spent.itemsVisited}</code> éléments de liste traversés. Un
            nœud <code>round</code> dépense <em>un</em> pas, comme tout autre nœud à opérande
            unique.
          </li>
        ))}
      </ul>
      <p>
        Les formules fautives des deux sections de refus n'appartiennent, elles, à aucun document :
        elles portent leur propre compteur — <code>{budgetDemonstrations.spent.steps}</code>{' '}
        opérations et <code>{budgetDemonstrations.spent.itemsVisited}</code> éléments — plutôt que
        de gonfler celui de la facture. C'est la même règle appliquée au cas limite : ce qui n'est
        pas un document n'a pas à peser sur le budget d'un document.
      </p>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}
