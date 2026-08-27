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

// The reference invoice template for the playground.
// Field names (e.g. commande, lignes, societe) are chosen by the host integration.
// Openview reserves no field names or data shapes.
// The template is a function of its style appearance.

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
 * Rounded discount, with mode and decimal places declared by the model.
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

/** Single literal segment text node with explicit typography. */
const txt = (id: string, text: string, typography: Typography): TextNode => ({
  type: 'text',
  id,
  typography,
  content: [{ kind: 'literal', text }],
});

/** Standard page numbering segment tuple with markers. */
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

/** English title variant with reordered components. */
const titreAnglais: PrintableExpression = {
  kind: 'concat',
  parts: [
    { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'commande.client' } },
    { kind: 'literal', value: ' — Invoice no. ' },
    { kind: 'text', value: { kind: 'path', path: 'commande.numero' } },
  ],
};

/** Title expression switched conditionally based on host data. */
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

/** Visual appearance options for styling template instances. */
export interface Apparence {
  readonly nom: string;
  readonly cadre: BoxStyle;
  readonly bandeau: BoxStyle;
  readonly tableau: BoxStyle;
  readonly titre: Typography;
  readonly corps: Typography;
  readonly accent: Typography;
  readonly alignementMentions: TextAlignment;
}

/** Appearance A -- navy corporate style with frame and serif typography. */
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

/** Appearance B -- rust modern style without outer frame, sans-serif typography. */
export const APPARENCE_B: Apparence = {
  nom: 'B — rouille, sans cadre, sans-serif, mentions justifiées',
  cadre: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
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

/** Returns the style object only if it contains at least one defined property. */
const siNonVide = (style: BoxStyle | Typography): BoxStyle | Typography | undefined =>
  Object.values(style).some((entree) => entree !== undefined) ? style : undefined;

/** Builds the header band for a page setup. */
const bandeauDe = (
  a: Apparence,
  report: Record<string, unknown> | undefined,
): Record<string, unknown> => ({
  type: 'container',
  id: 'bandeau',
  box: siNonVide(a.bandeau),
  children: [
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
    ...(report === undefined ? [] : [report]),
  ],
});

export const factureAvecApparence = (a: Apparence): Template =>
  parseTemplate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_demo_1',
    name: 'Facture Exemple',
    version: '1.0.0',
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
        { on: 'firstOnly', content: bandeauDe(a, undefined) },
        {
          on: 'exceptFirst',
          content: bandeauDe(a, {
            type: 'text',
            id: 'bandeau-report',
            typography: a.corps,
            align: 'end',
            content: [
              { kind: 'literal', text: 'Report ' },
              {
                kind: 'pageField',
                field: 'report',
                decimals: 2,
                mode: 'halfExpand',
                typography: a.accent,
              },
            ],
          }),
        },
      ],
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
              {
                type: 'text',
                id: 'pied-mentions',
                content: [
                  { kind: 'binding', value: { kind: 'path', path: 'societe.mentionsLegales' } },
                ],
              },
              {
                type: 'text',
                id: 'pied-paiement',
                content: [
                  { kind: 'binding', value: { kind: 'path', path: 'societe.coordonnees' } },
                ],
              },
            ],
          },
        },
      ],
      // Layers: repeated across pages out-of-flow without consuming height or affecting layout cuts.
      layers: [
        {
          plane: 'background',
          content: {
            type: 'container',
            id: 'papier',
            box: { background: '#fdfaf2' },
            children: [],
          },
        },
        {
          plane: 'background',
          opacity: 0.12,
          content: {
            type: 'container',
            id: 'filigrane',
            children: [
              {
                type: 'grid',
                id: 'filigrane-grille',
                columns: 3,
                rows: 3,
                step: 99,
                items: [
                  {
                    row: 2,
                    column: 2,
                    content: {
                      type: 'container',
                      id: 'filigrane-zone',
                      children: [
                        {
                          type: 'text',
                          id: 'filigrane-texte',
                          align: 'center',
                          typography: { ...a.titre, sizePt: 26 },
                          content: [{ kind: 'literal', text: 'DUPLICATA' }],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          plane: 'foreground',
          opacity: 0.85,
          content: {
            type: 'container',
            id: 'cachet',
            children: [
              {
                type: 'grid',
                id: 'cachet-grille',
                columns: 3,
                rows: 3,
                step: 99,
                items: [
                  {
                    row: 3,
                    column: 3,
                    content: {
                      type: 'container',
                      id: 'cachet-zone',
                      children: [
                        { type: 'image', id: 'cachet-image', src: LOGO_PNG, alt: 'cachet' },
                      ],
                    },
                  },
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
          type: 'grid',
          id: 'en-tete',
          columns: 12,
          rows: 6,
          step: 4,
          items: [
            {
              row: 1,
              column: 1,
              rowSpan: 4,
              columnSpan: 3,
              content: {
                type: 'container',
                id: 'zone-marque',
                children: [
                  {
                    type: 'image',
                    id: 'marque-grille',
                    src: LOGO_PNG,
                    alt: 'marque de l’émetteur',
                  },
                ],
              },
            },
            {
              row: 1,
              column: 4,
              rowSpan: 2,
              columnSpan: 5,
              content: {
                type: 'container',
                id: 'zone-titre',
                children: [
                  {
                    type: 'text',
                    id: 'title',
                    typography: { ...a.corps, bold: true },
                    content: [{ kind: 'binding', value: titre }],
                  },
                ],
              },
            },
            {
              row: 1,
              column: 9,
              rowSpan: 2,
              columnSpan: 4,
              content: {
                type: 'container',
                id: 'zone-reference',
                children: [
                  {
                    type: 'text',
                    id: 'reference-grille',
                    typography: a.corps,
                    align: 'end',
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
        },
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
                  pageReport: { value: lineAmount },
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
          keepTogether: true,
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
        {
          type: 'container',
          id: 'paiement',
          keepTogether: true,
          box: siNonVide(a.bandeau),
          children: [
            txt('paiement-titre', 'Règlement', a.accent),
            {
              type: 'text',
              id: 'paiement-corps',
              typography: a.corps,
              content: [{ kind: 'binding', value: { kind: 'path', path: 'societe.reglement' } }],
            },
          ],
        },
        {
          type: 'text',
          id: 'conditions',
          typography: a.corps,
          align: a.alignementMentions,
          content: [{ kind: 'binding', value: { kind: 'path', path: 'societe.conditions' } }],
        },
      ],
    },
  });

/**
 * The reference invoice templates using appearance variants A and B.
 */
export const sampleTemplate = factureAvecApparence(APPARENCE_A);
export const factureVariante = factureAvecApparence(APPARENCE_B);

// Sample host data for rendering.
export const renderData = {
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
  arrondi: {
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10 },
      { sku: 'B-2', quantite: 1, prixUnitaire: 30 },
      { sku: 'C-3', quantite: 4, prixUnitaire: 2.5 },
      { sku: 'D-4', quantite: 17, prixUnitaire: 0.125 },
      { sku: 'E-5', quantite: 3, prixUnitaire: 0.375 },
    ],
  },
  traitement: { effectueLe: '2026-03-10' },
  societe: {
    mentionsLegales: 'Escompte pour paiement anticipé : néant.',
    reglement:
      'Par virement sur le compte indiqué dans l’avis de règlement, en rappelant la référence.',
    coordonnees: 'Les règlements sont imputés d’abord sur la ligne impayée la plus ancienne.',
    conditions:
      'Le règlement est exigible à la date portée ci-dessus, sans escompte. Les intérêts au taux légal courent de plein droit dès le lendemain de cette date sur toute somme restée impayée, et l’indemnité forfaitaire de recouvrement prévue par la loi s’y ajoute. Les marchandises demeurent la propriété de l’émetteur jusqu’au paiement intégral de la facture. Toute contestation portant sur une ligne du présent relevé doit être formée par écrit dans les trente jours de son émission, en rappelant la référence portée en tête de chaque feuille ; une ligne non contestée dans ce délai est réputée acceptée.',
  },
};

/** Short sample data set. */
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
  societe: {
    mentionsLegales: 'Règlement intégral attendu à l’échéance.',
    reglement:
      'Par virement sur le compte indiqué dans l’avis de règlement, en rappelant la référence.',
    coordonnees: 'Les règlements sont imputés d’abord sur la ligne impayée la plus ancienne.',
    conditions:
      'Le règlement est exigible à la date portée ci-dessus, sans escompte. Les intérêts au taux légal courent de plein droit dès le lendemain de cette date sur toute somme restée impayée, et l’indemnité forfaitaire de recouvrement prévue par la loi s’y ajoute. Les marchandises demeurent la propriété de l’émetteur jusqu’au paiement intégral de la facture. Toute contestation portant sur une ligne du présent relevé doit être formée par écrit dans les trente jours de son émission, en rappelant la référence portée en tête de chaque feuille ; une ligne non contestée dans ce délai est réputée acceptée.',
  },
};

/** Description lines for sample long data. */
const TRAVAUX = [
  'Relevé mesuré de la façade nord et de ses deux retours',
  'Dépose du rejointoiement défaillant des rangs quatre à onze',
  'Rejointoiement au mortier de chaux assorti à l’original',
  'Fourniture et pose d’une bavette plomb sur le bandeau',
  'Réglage des deux fenêtres à battants de l’étage',
  'Démontage de la souche instable et tri des briques saines',
];

/** Multi-page dataset with 60 lines. */
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
  societe: {
    mentionsLegales: 'Retenue de garantie de cinq pour cent libérée à la réception.',
    reglement:
      'Par virement sur le compte indiqué dans l’avis de règlement, en rappelant la référence.',
    coordonnees: 'Les règlements sont imputés d’abord sur la ligne impayée la plus ancienne.',
    conditions:
      'Le règlement est exigible à la date portée ci-dessus, sans escompte. Les intérêts au taux légal courent de plein droit dès le lendemain de cette date sur toute somme restée impayée, et l’indemnité forfaitaire de recouvrement prévue par la loi s’y ajoute. Les marchandises demeurent la propriété de l’émetteur jusqu’au paiement intégral de la facture. Toute contestation portant sur une ligne du présent relevé doit être formée par écrit dans les trente jours de son émission, en rappelant la référence portée en tête de chaque feuille ; une ligne non contestée dans ce délai est réputée acceptée.',
  },
};
