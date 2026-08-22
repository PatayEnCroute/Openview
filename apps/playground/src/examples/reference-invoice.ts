import {
  type BoxStyle,
  CURRENT_SCHEMA_VERSION,
  type Expression,
  type PrintableExpression,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
  type TextAlignment,
  type TextNode,
  type TextSegment,
  type Typography,
} from '@openview/core';
import { LOGO_PNG } from './logo.js';

// La facture de référence du dépôt, et le seul endroit où elle est décrite.
//
// Ses noms de champs — `commande`, `lignes`, `societe` — sont ceux d'une application
// intégratrice : Openview n'en réserve aucun et n'en attend aucun. Aucun de ces noms
// n'apparaît dans `packages/engine` ni dans l'adaptateur, et c'est vérifiable au grep.
//
// Le modèle est une FONCTION de son apparence : la structure, les identifiants et les
// chemins de données sont donc mécaniquement identiques d'une apparence à l'autre, et
// l'égalité des deux listes de `collectTemplateDataPaths` est un résultat plutôt qu'une
// coïncidence.

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
export const totalHT: PrintableExpression = {
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
export const remise: PrintableExpression = {
  kind: 'percentOf',
  base: totalHT,
  rate: { kind: 'path', path: 'commande.tauxRemise' },
};

/**
 * La remise ARRONDIE, avec son mode et ses décimales déclarés PAR LE MODÈLE.
 *
 * C'est le témoin d'arrondi de la facture : le moteur n'arrondit rien de lui-même, et il ne
 * reconnaît pas un montant. Reconnaître celui-ci réserverait un sens métier.
 */
const remiseArrondie: PrintableExpression = {
  kind: 'round',
  value: remise,
  decimals: 2,
  mode: 'halfExpand',
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

/**
 * Un bloc texte d'un seul segment littéral — un intitulé de colonne, un libellé de total.
 *
 * La typographie est passée EXPLICITEMENT : le moteur n'hérite rien d'un conteneur, et un libellé
 * qui n'en déclare aucune sort dans le défaut du moteur — visiblement différent du corps du
 * document. C'est le défaut correct, et c'est aussi la raison de le déclarer ici.
 */
const txt = (id: string, text: string, typography: Typography): TextNode => ({
  type: 'text',
  id,
  typography,
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
const titreFrancais: PrintableExpression = {
  kind: 'concat',
  parts: [
    { kind: 'literal', value: 'Facture n° ' },
    { kind: 'text', value: { kind: 'path', path: 'commande.numero' } },
    { kind: 'literal', value: ' — ' },
    { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'commande.client' } },
  ],
};

/**
 * La moitié anglaise du même titre, et elle RÉORDONNE.
 *
 * C'est l'argument qui distingue le `if` d'une table de traductions : le client passe devant, et
 * « n° » devient « no. » à une autre place de la phrase. Une table clé → texte ne sait pas faire
 * ça ; un `if` le fait parce qu'il porte l'expression entière et non un mot.
 */
const titreAnglais: PrintableExpression = {
  kind: 'concat',
  parts: [
    { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'commande.client' } },
    { kind: 'literal', value: ' — Invoice no. ' },
    { kind: 'text', value: { kind: 'path', path: 'commande.numero' } },
  ],
};

/**
 * Le titre, BASCULÉ PAR UNE DONNÉE — c'est le premier des deux commutateurs de la vitrine.
 *
 * Ce mécanisme est intégralement celui du lot C1 : le lot C6 n'ajoute RIEN pour les libellés, et
 * c'est la première chose à dire de lui. Ce qu'il ajoute est l'écriture d'une VALEUR, et elle
 * bascule par un tout autre canal — le NOM passé à `resolvePresentation`. Les deux sont
 * indépendants par conception, et la section C6 plus bas montre les quatre combinaisons.
 */
export const titre: PrintableExpression = {
  kind: 'if',
  when: {
    kind: 'compare',
    op: 'eq',
    left: { kind: 'path', path: 'rendu.langue' },
    right: { kind: 'literal', value: 'fr' },
  },
  whenTrue: titreFrancais,
  whenFalse: titreAnglais,
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
export interface Apparence {
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
export const APPARENCE_A: Apparence = {
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
export const APPARENCE_B: Apparence = {
  nom: 'B — rouille, sans cadre, sans-serif, mentions justifiées',
  cadre: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
  // Un filet est peint À L'INTÉRIEUR de la boîte : sans padding, il recouvrirait la dernière
  // ligne de son propre contenu. Une boîte qui déclare un filet déclare aussi son padding.
  bandeau: {
    border: { bottom: { width: 1.2, color: '#8C3A1B' } },
    padding: { top: 0.6, right: 1, bottom: 2, left: 1 },
  },
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

export const factureAvecApparence = (a: Apparence): Template =>
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
    // Les DEUX écritures que ce modèle déclare — lot C6. Elles vivent dans le DOCUMENT, pas dans
    // le code React, et c'est tout l'objet du lot : rien de ce qui suit ne lit la machine.
    //
    // Les noms de clés appartiennent à l'AUTEUR du modèle. Openview n'en réserve aucun : pas de
    // « default », pas de « fr », aucune convention liant une clé à une langue. Un modèle qui
    // écrirait montants, quantités et prix unitaires dans deux langues déclarerait SIX entrées.
    //
    // La devise est requise même dans une écriture qui n'imprime pas d'argent, et c'est ce qui
    // rend `formatMoney` totale sur toute écriture déclarée : son `undefined` a UNE cause, la
    // valeur non finie, et non deux.
    presentations: {
      'fr-eur': {
        locale: 'fr-FR',
        currency: 'EUR',
        minFractionDigits: 2,
        maxFractionDigits: 2,
        dateStyle: 'long',
      },
      'en-usd': {
        locale: 'en-US',
        currency: 'USD',
        minFractionDigits: 2,
        maxFractionDigits: 2,
        dateStyle: 'long',
      },
    },
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
              // Le logo et la référence, côte à côte DANS UN TABLEAU — et le tableau est là
              // pour une raison précise.
              //
              // Une image sans dimension déclarée prend la largeur de CONTENU de son parent et
              // garde son ratio intrinsèque : posée directement dans la bande, elle occuperait
              // toute la largeur imprimable. Le contrat d'apparence ne porte aucune largeur de
              // boîte, donc la seule façon d'en contraindre une aujourd'hui est un POIDS DE
              // COLONNE. C'est la réponse d'un auteur de modèle, pas un contournement.
              {
                type: 'table',
                id: 'bandeau-grille',
                columns: [
                  { id: 'marque', width: 1, align: 'start' },
                  { id: 'reference', width: 5, align: 'end' },
                ],
                header: [],
                body: [
                  {
                    type: 'tableRow',
                    id: 'bandeau-ligne',
                    cells: [
                      {
                        columnId: 'marque',
                        children: [
                          {
                            type: 'image',
                            id: 'logo',
                            src: LOGO_PNG,
                            alt: 'marque de l’émetteur',
                          },
                        ],
                      },
                      {
                        columnId: 'reference',
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
                    ],
                  },
                ],
                footer: [],
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
                { columnId: 'sku', children: [txt('th-sku', 'Référence', a.corps)] },
                { columnId: 'quantite', children: [txt('th-quantite', 'Qté', a.corps)] },
                { columnId: 'prixUnitaire', children: [txt('th-prix', 'Prix unitaire', a.corps)] },
                { columnId: 'montant', children: [txt('th-montant', 'Montant', a.corps)] },
                { columnId: 'remise', children: [txt('th-remise', 'Remise', a.corps)] },
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
                  // Le padding d'une LIGNE insète le contenu de chaque cellule à l'identique et ne
                  // déplace aucune frontière de colonne : sans lui, deux colonnes voisines se
                  // touchent et « 30 » colle à « Remise appliquée ».
                  box: { padding: { top: 0.6, right: 1, bottom: 0.6, left: 1 } },
                  cells: [
                    {
                      columnId: 'sku',
                      children: [
                        {
                          type: 'text',
                          id: 'td-sku',
                          typography: a.corps,
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
                          typography: a.corps,
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
                          typography: a.corps,
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
                          typography: a.corps,
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
                              typography: a.corps,
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
                { columnId: 'sku', children: [txt('tf-libelle', 'Total HT', a.corps)] },
                {
                  columnId: 'montant',
                  children: [
                    {
                      type: 'text',
                      id: 'tf-montant',
                      typography: a.corps,
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
            { kind: 'literal', text: ' — remise arrondie ' },
            { kind: 'binding', value: remiseArrondie },
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
export const sampleTemplate = factureAvecApparence(APPARENCE_A);
export const factureVariante = factureAvecApparence(APPARENCE_B);

// Le jeu de données de l'application hôte. Sa structure et ses noms de champs lui
// appartiennent ; `core` ne les connaît pas et ne les valide pas. AUCUN MONTANT n'y
// figure : tous ceux affichés plus bas sont calculés par le modèle.
export const renderData = {
  // La langue des MOTS, et c'est une DONNÉE que l'intégrateur nomme — pas une clé réservée par
  // Openview, pas une lecture de la machine. Le `if` du titre la lit ; l'écriture des VALEURS,
  // elle, se choisit par un argument passé à `resolvePresentation`. Deux canaux, indépendants.
  rendu: { langue: 'fr' },
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
 * Un SECOND jeu de données, court, et compatible avec le même modèle.
 *
 * Il fait varier le nombre de lignes, la langue des libellés, la condition de remise et donc
 * tous les montants calculés — sans changer une seule clé. C'est ce qui rend visible que le
 * modèle ne connaît pas ses valeurs : il ne connaît que les chemins qu'il déclare lire.
 */
export const renderDataCourt = {
  rendu: { langue: 'en' },
  commande: {
    numero: 20_260_015,
    client: 'brontide llc',
    dateEmission: '2026-02-27',
    delaiPaiement: 45,
    tauxRemise: 3,
    lignes: [{ sku: 'Z-9', quantite: 3, prixUnitaire: 7.77, discount: 0 }],
  },
  arrondi: { lignes: [{ sku: 'Z-9', quantite: 3, prixUnitaire: 7.77 }] },
  traitement: { effectueLe: '2026-04-02' },
  societe: { mentionsLegales: 'Règlement intégral attendu à l’échéance.' },
};

/** Ce que chaque ligne longue désigne, cyclé pour que la recette se lise comme un document. */
const TRAVAUX = [
  'Relevé mesuré de la façade nord et de ses deux retours',
  'Dépose du rejointoiement défaillant des rangs quatre à onze',
  'Rejointoiement au mortier de chaux assorti à l’original',
  'Fourniture et pose d’une bavette plomb sur le bandeau',
  'Réglage des deux fenêtres à battants de l’étage',
  'Démontage de la souche instable et tri des briques saines',
];

/**
 * Un TROISIÈME jeu de données, long : soixante lignes sous les mêmes clés.
 *
 * Rien du nombre soixante n'est connu du moteur ni de l'adaptateur. Le nombre de feuilles est
 * celui que le flux mesuré demande, et il se voit dans le pied « page n / N ».
 */
export const renderDataLong = {
  rendu: { langue: 'fr' },
  commande: {
    numero: 20_260_016,
    client: 'longacre travaux',
    dateEmission: '2026-03-02',
    delaiPaiement: 60,
    tauxRemise: 7.5,
    lignes: Array.from({ length: 60 }, (_inutilise, index) => ({
      sku: `${String(index + 1).padStart(3, '0')} - ${TRAVAUX[index % TRAVAUX.length] ?? ''}`,
      quantite: 1 + (index % 4),
      prixUnitaire: 12.5 + (index % 7) * 3.25,
      discount: index % 5 === 0 ? 2 + (index % 3) : 0,
    })),
  },
  arrondi: {
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10 },
      { sku: 'D-4', quantite: 17, prixUnitaire: 0.125 },
    ],
  },
  traitement: { effectueLe: '2026-03-11' },
  societe: { mentionsLegales: 'Retenue de garantie de cinq pour cent libérée à la réception.' },
};
