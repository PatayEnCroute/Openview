import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  type Expression,
  type Presentation,
  type PrintableExpression,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import { LOGO_PNG } from './fixtures.js';

/**
 * Reference acceptance document fixture for Puppeteer PDF rendering validation.
 */

const rowAmount: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'row.units' },
  right: { kind: 'path', path: 'row.rate' },
};

/** No total is supplied by the data: every figure below is a formula of the model. */
const netTotal: PrintableExpression = {
  kind: 'aggregate',
  op: 'sum',
  source: { kind: 'path', path: 'order.rows' },
  as: 'row',
  value: rowAmount,
};

const reduction: PrintableExpression = {
  kind: 'percentOf',
  base: netTotal,
  rate: { kind: 'path', path: 'order.reductionRate' },
};

/** The one rounding of the document, with its mode and its decimals declared by the model. */
const roundedReduction: PrintableExpression = {
  kind: 'round',
  value: reduction,
  decimals: 2,
  mode: 'halfExpand',
};

const remainder: PrintableExpression = {
  kind: 'arithmetic',
  op: 'sub',
  left: netTotal,
  right: roundedReduction,
};

const dueDate: PrintableExpression = {
  kind: 'dateAdd',
  date: { kind: 'path', path: 'order.issuedOn' },
  days: { kind: 'path', path: 'order.termDays' },
};

const endOfTerm: PrintableExpression = { kind: 'endOfMonth', date: dueDate };

const reducedRowCount: PrintableExpression = {
  kind: 'count',
  source: {
    kind: 'filter',
    source: { kind: 'path', path: 'order.rows' },
    as: 'row',
    where: {
      kind: 'compare',
      op: 'gt',
      left: { kind: 'path', path: 'row.reduction' },
      right: { kind: 'literal', value: 0 },
    },
  },
};

const rowIsReduced: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'row.reduction' },
  right: { kind: 'literal', value: 0 },
};

/** The title is computed, and it switches on a value of the dataset rather than on a locale. */
const title: PrintableExpression = {
  kind: 'if',
  when: {
    kind: 'compare',
    op: 'eq',
    left: { kind: 'path', path: 'render.wording' },
    right: { kind: 'literal', value: 'long' },
  },
  whenTrue: {
    kind: 'concat',
    parts: [
      { kind: 'literal', value: 'Statement ' },
      { kind: 'text', value: { kind: 'path', path: 'order.reference' } },
      { kind: 'literal', value: ' for ' },
      { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'order.holder' } },
    ],
  },
  whenFalse: {
    kind: 'concat',
    parts: [
      { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'order.holder' } },
      { kind: 'literal', value: ' / ' },
      { kind: 'text', value: { kind: 'path', path: 'order.reference' } },
    ],
  },
};

/**
 * The writing each site of this document asks for, or nothing at all in its plain spelling.
 *
 * Threaded like the appearance, so the two spellings share one structure, one set of ids and one
 * set of data paths -- and so the plain one stays exactly the document E1 and E3 already print.
 */
export interface SiteWritings {
  readonly amount?: Record<string, unknown> | undefined;
  readonly quantity?: Record<string, unknown> | undefined;
  readonly unitPrice?: Record<string, unknown> | undefined;
  readonly date?: Record<string, unknown> | undefined;
  /** Whether the WORDS of this document switch on a path of the data set. */
  readonly bilingual?: true | undefined;
}

/** No writing anywhere: every figure prints in its canonical form, as it did before E4. */
const PLAIN: SiteWritings = {};

/**
 * The three profiles this model names, and the four sites that ask for them.
 *
 * `amount` is asked for twice over: once as money on the figures, once as a date on the two dates.
 * The same writing carries the currency and the date style, which is why one render resolves three
 * writings and not four.
 */
const WRITTEN: SiteWritings = {
  amount: { kind: 'money', profile: 'amount' },
  quantity: { kind: 'decimal', profile: 'quantity' },
  unitPrice: { kind: 'money', profile: 'unitPrice' },
  date: { kind: 'date', profile: 'amount' },
  bilingual: true,
};

/**
 * The six writings the bilingual recette declares. Their names belong to this fixture.
 *
 * Three per configuration: amounts at two decimals, quantities at up to three, and unit prices at
 * up to four -- which is why one writing per render would not do.
 */
export const WRITINGS: Readonly<Record<string, Presentation>> = {
  'fr-eur-2': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'long',
  },
  'fr-decimal-3': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 0,
    maxFractionDigits: 3,
    dateStyle: 'short',
  },
  'fr-eur-4': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 2,
    maxFractionDigits: 4,
    dateStyle: 'short',
  },
  'en-usd-2': {
    locale: 'en-US',
    currency: 'USD',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'long',
  },
  'en-decimal-3': {
    locale: 'en-US',
    currency: 'USD',
    minFractionDigits: 0,
    maxFractionDigits: 3,
    dateStyle: 'short',
  },
  'en-usd-4': {
    locale: 'en-US',
    currency: 'USD',
    minFractionDigits: 2,
    maxFractionDigits: 4,
    dateStyle: 'short',
  },
};

/** The values in French and euros. One of the two diagonals of the recette. */
export const FRENCH_VALUES: Record<string, string> = {
  amount: 'fr-eur-2',
  quantity: 'fr-decimal-3',
  unitPrice: 'fr-eur-4',
};

/** The values in English and dollars. The other diagonal. */
export const ENGLISH_VALUES: Record<string, string> = {
  amount: 'en-usd-2',
  quantity: 'en-decimal-3',
  unitPrice: 'en-usd-4',
};

/** The path this fixture -- not Openview -- chose to carry the language of the words. */
const FRENCH_WORDS: Expression = {
  kind: 'compare',
  op: 'eq',
  left: { kind: 'path', path: 'render.language' },
  right: { kind: 'literal', value: 'fr' },
};

/** A writing on a site, or nothing: the canonical spelling of "no writing" is no key. */
const asks = (format: Record<string, unknown> | undefined): Record<string, unknown> =>
  format === undefined ? {} : { format };

const pagination = (sites: SiteWritings): readonly Record<string, unknown>[] => [
  said('Page ', 'Page ', sites),
  { kind: 'pageField', field: 'number', ...asks(sites.quantity) },
  said(' / ', ' sur ', sites),
  { kind: 'pageField', field: 'count', ...asks(sites.quantity) },
];

/**
 * A fixed word inside a run of segments, in one language or in whichever the data set names.
 *
 * The words and the figures switch on two independent things: a path of the data set here, and the
 * writings the caller selected there. Nothing couples them, and the recette renders all four pairs.
 */
const said = (english: string, french: string, sites: SiteWritings): Record<string, unknown> =>
  sites.bilingual === true
    ? {
        kind: 'binding',
        value: {
          kind: 'if',
          when: FRENCH_WORDS,
          whenTrue: { kind: 'literal', value: french },
          whenFalse: { kind: 'literal', value: english },
        },
      }
    : { kind: 'literal', text: english };

/** A whole text block holding one fixed word. */
const label = (
  id: string,
  english: string,
  french: string,
  sites: SiteWritings = PLAIN,
): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [said(english, french, sites)],
});

const bound = (
  id: string,
  value: PrintableExpression,
  format?: Record<string, unknown> | undefined,
): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'binding', value, ...asks(format) }],
});

/**
 * The banner of one page domain, with the extra line that domain carries -- or none.
 *
 * The two header domains show the same mark and the same reference, so the banner is built once and
 * spelt twice. What differs is the line below it: the pages after the first carry the amount
 * brought forward from the rows that ended before them.
 */
function stripe(
  appearance: Appearance,
  sites: SiteWritings,
  carried: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    type: 'container',
    id: 'stripe',
    box: orUndefined(appearance.stripe),
    children: [
      /* The mark and the reference share a table, and the table is what gives the image a width:
         an image with no declared size takes the content width of its parent, and the appearance
         contract carries no width on a box. A column weight is the only way a model constrains
         one today. */
      {
        type: 'table',
        id: 'stripe-grid',
        columns: [
          { id: 'mark', width: 1, align: 'start' },
          { id: 'reference', width: 5, align: 'end' },
        ],
        header: [],
        body: [
          {
            type: 'tableRow',
            id: 'stripe-row',
            cells: [
              {
                columnId: 'mark',
                children: [{ type: 'image', id: 'logo', src: LOGO_PNG, alt: 'issuer mark' }],
              },
              {
                columnId: 'reference',
                children: [
                  {
                    type: 'text',
                    id: 'stripe-reference',
                    typography: appearance.body,
                    /* The reference is an IDENTIFIER: no writing, whatever it looks like. A
                       host that numbers its orders 20260014 must read 20260014 back. */
                    content: [
                      said('Reference ', 'Reference ', sites),
                      {
                        kind: 'binding',
                        value: { kind: 'path', path: 'order.reference' },
                        typography: appearance.accent,
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
      ...(carried === undefined ? [] : [carried]),
    ],
  };
}

/** What an appearance declares, and nothing else: three boxes, three typographies, one alignment. */
export interface Appearance {
  readonly name: string;
  readonly frame: Record<string, unknown>;
  readonly stripe: Record<string, unknown>;
  readonly table: Record<string, unknown>;
  /** Two rules that meet on one boundary with different widths, to exercise the conflict rule. */
  readonly headRule: Record<string, unknown>;
  readonly firstRowRule: Record<string, unknown>;
  readonly title: Record<string, unknown>;
  readonly body: Record<string, unknown>;
  readonly accent: Record<string, unknown>;
  readonly noticeAlign: 'start' | 'end' | 'justify';
  /**
   * How many A4 sheets the sixty-line statement takes in this appearance.
   *
   * A measured consequence of the declared faces, not a target: the two appearances set the same
   * sixty rows in two families of different metrics, so they do not fill the same number of sheets.
   */
  readonly sheets: number;
}

export const FRAMED: Appearance = {
  name: 'framed navy serif',
  frame: {
    background: '#ffffff',
    border: {
      top: { width: 0.4, color: '#1b3a6f' },
      right: { width: 0.4, color: '#1b3a6f' },
      bottom: { width: 0.4, color: '#1b3a6f' },
      left: { width: 0.4, color: '#1b3a6f' },
    },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
  },
  stripe: { background: '#eef2f9', padding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 } },
  table: { border: { bottom: { width: 0.28, color: '#1b3a6f' } } },
  headRule: { bottom: { width: 0.28, color: '#1b3a6f' } },
  firstRowRule: { top: { width: 1.2, color: '#1b3a6f' } },
  title: { family: 'Noto Serif', sizePt: 16, bold: true, color: '#1b3a6f' },
  body: { family: 'Noto Serif', sizePt: 8, color: '#22262b' },
  accent: { bold: true, color: '#1b3a6f' },
  noticeAlign: 'start',
  sheets: 5,
};

export const BARE: Appearance = {
  name: 'rust sans-serif, justified notice',
  frame: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
  stripe: { border: { bottom: { width: 1.2, color: '#8C3A1B' } } },
  table: { background: '#FDF7F4' },
  headRule: { bottom: { width: 1.2, color: '#8C3A1B' } },
  firstRowRule: { top: { width: 0.28, color: '#8C3A1B' } },
  title: { family: 'Noto Sans', sizePt: 13, italic: true, color: '#8C3A1B' },
  body: { family: 'Noto Sans', sizePt: 7.5, color: '#3A3A3A' },
  accent: { color: '#8C3A1B' },
  noticeAlign: 'justify',
  sheets: 4,
};

/** The contract refuses an empty style object: the canonical spelling of "no style" is no field. */
const orUndefined = (style: Record<string, unknown>): Record<string, unknown> | undefined =>
  Object.values(style).some((entry) => entry !== undefined) ? style : undefined;

/**
 * The document, parameterised by its appearance.
 *
 * A function rather than two literals, so that identical structure, identical ids and identical data
 * paths across the two appearances are mechanical instead of a coincidence.
 */
export function referenceDocument(appearance: Appearance): Template {
  return parseTemplate(referenceDocumentRaw(appearance));
}

/**
 * The same document, with every site classed and its words switched by the data set.
 *
 * One template object, rendered through two ports: what makes the recette a recette is that the
 * stored document is IDENTICAL between the two diagonals.
 */
export function writtenReferenceDocument(appearance: Appearance): Template {
  return parseTemplate({
    ...referenceDocumentRaw(appearance, WRITTEN),
    presentations: WRITINGS,
  });
}

function referenceDocumentRaw(
  appearance: Appearance,
  sites: SiteWritings = PLAIN,
): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_reference',
    name: 'Reference document',
    version: '1.0.0',
    page: {
      /* A4 because the author of this model wrote it, not because the engine knows a format. */
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 14, right: 14, bottom: 14, left: 14 },
      header: [
        /* `firstOnly` plus `exceptFirst` rather than one `every`: the pages after the first carry
           the amount brought forward, and the first has nothing to bring. The banner is therefore
           spelt twice -- the duplication a band domain costs, paid here rather than hidden behind
           a helper that would invent a third page domain. */
        {
          on: 'firstOnly',
          content: stripe(appearance, sites, undefined),
        },
        {
          on: 'exceptFirst',
          content: stripe(appearance, sites, {
            type: 'text',
            id: 'stripe-carried',
            typography: appearance.body,
            align: 'end',
            content: [
              said('Brought forward ', 'Report ', sites),
              {
                kind: 'pageField',
                field: 'report',
                decimals: 2,
                mode: 'halfExpand',
                /* The rounding is declared here and the writing is chosen by the caller. Their
                   scales have to agree, or the formatter would round the figure a second time. */
                ...asks(sites.amount),
                typography: appearance.accent,
              },
            ],
          }),
        },
      ],
      footer: [
        /* `exceptLast` plus `lastOnly` is the only legal spelling of "a running foot and a final
           one": `every` plus `lastOnly` would both fall on the last sheet and the schema refuses it. */
        {
          on: 'exceptLast',
          content: {
            type: 'container',
            id: 'running-foot',
            children: [{ type: 'text', id: 'running-foot-num', content: pagination(sites) }],
          },
        },
        {
          on: 'lastOnly',
          content: {
            type: 'container',
            id: 'final-foot',
            children: [
              { type: 'text', id: 'final-foot-num', content: pagination(sites) },
              {
                type: 'text',
                id: 'final-foot-notice',
                typography: appearance.body,
                align: appearance.noticeAlign,
                content: [{ kind: 'binding', value: { kind: 'path', path: 'issuer.notice' } }],
              },
              /* The payment details the model chose to show on the last sheet only. The engine
                 knows no legal vocabulary: it applies the domain and measures the height. */
              {
                type: 'text',
                id: 'final-foot-payment',
                typography: appearance.body,
                align: appearance.noticeAlign,
                content: [{ kind: 'binding', value: { kind: 'path', path: 'issuer.payment' } }],
              },
            ],
          },
        },
      ],
    },
    root: {
      type: 'container',
      id: 'root',
      box: orUndefined(appearance.frame),
      keepTogether: true,
      children: [
        {
          type: 'text',
          id: 'title',
          typography: appearance.title,
          content: [{ kind: 'binding', value: title }],
        },
        {
          type: 'table',
          id: 'rows',
          box: orUndefined(appearance.table),
          columns: [
            { id: 'sku', width: 6, align: 'start' },
            { id: 'units', width: 2, align: 'end' },
            { id: 'rate', width: 3, align: 'end' },
            { id: 'amount', width: 3, align: 'end' },
            { id: 'note', width: 4, align: 'start' },
          ],
          header: [
            {
              type: 'tableRow',
              id: 'head',
              box: { ...appearance.stripe, border: appearance.headRule },
              cells: [
                { columnId: 'sku', children: [label('h-sku', 'Item', 'Article', sites)] },
                { columnId: 'units', children: [label('h-units', 'Units', 'Quantite', sites)] },
                { columnId: 'rate', children: [label('h-rate', 'Rate', 'Prix unitaire', sites)] },
                { columnId: 'amount', children: [label('h-amount', 'Amount', 'Montant', sites)] },
                { columnId: 'note', children: [label('h-note', 'Note', 'Remarque', sites)] },
              ],
            },
          ],
          body: [
            {
              type: 'tableRowGroup',
              id: 'group',
              each: { kind: 'path', path: 'order.rows' },
              as: 'row',
              rows: [
                {
                  type: 'tableRow',
                  id: 'detail',
                  /* Meets the header rule on one boundary with a different width. */
                  box: { border: appearance.firstRowRule },
                  keepTogether: true,
                  /* What this line is worth to the pages after it. The renderer decides which page
                     the occurrence ends on; the model decides only the amount, and it is the same
                     formula the `amount` column prints. */
                  pageReport: { value: rowAmount },
                  cells: [
                    {
                      columnId: 'sku',
                      /* An item code is an identifier too, digits and all: no writing. */
                      children: [bound('d-sku', { kind: 'path', path: 'row.sku' })],
                    },
                    {
                      columnId: 'units',
                      children: [
                        bound('d-units', { kind: 'path', path: 'row.units' }, sites.quantity),
                      ],
                    },
                    {
                      columnId: 'rate',
                      children: [
                        bound('d-rate', { kind: 'path', path: 'row.rate' }, sites.unitPrice),
                      ],
                    },
                    {
                      columnId: 'amount',
                      children: [bound('d-amount', rowAmount, sites.amount)],
                    },
                    {
                      columnId: 'note',
                      children: [
                        {
                          type: 'condition',
                          id: 'reduced',
                          when: rowIsReduced,
                          children: [
                            {
                              type: 'text',
                              id: 'reduced-note',
                              /* A reduction is a MONEY amount here. Written down site by site
                                 rather than deduced from the field name, which the engine never
                                 reads. */
                              content: [
                                said('less ', 'moins ', sites),
                                {
                                  kind: 'binding',
                                  value: { kind: 'path', path: 'row.reduction' },
                                  ...asks(sites.amount),
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
            /* A short row: two cells for five columns, which is the shape of a total line. */
            {
              type: 'tableRow',
              id: 'total',
              cells: [
                { columnId: 'sku', children: [label('f-label', 'Net total', 'Total net', sites)] },
                { columnId: 'amount', children: [bound('f-amount', netTotal, sites.amount)] },
              ],
            },
          ],
        },
        {
          type: 'text',
          id: 'totals',
          typography: appearance.body,
          align: 'end',
          keepTogether: true,
          content: [
            said('Net ', 'Net ', sites),
            {
              kind: 'binding',
              value: netTotal,
              ...asks(sites.amount),
              typography: appearance.accent,
            },
            said(' less ', ' moins ', sites),
            { kind: 'binding', value: roundedReduction, ...asks(sites.amount) },
            said(' leaves ', ' laisse ', sites),
            { kind: 'binding', value: remainder, ...asks(sites.amount) },
          ],
        },
        {
          type: 'text',
          id: 'dates',
          typography: appearance.body,
          align: appearance.noticeAlign,
          content: [
            said('Due ', 'Echeance ', sites),
            { kind: 'binding', value: dueDate, ...asks(sites.date) },
            said(', end of that month ', ', fin du mois ', sites),
            { kind: 'binding', value: endOfTerm, ...asks(sites.date) },
            said(', reduced lines ', ', lignes remisees ', sites),
            {
              kind: 'binding',
              value: reducedRowCount,
              ...asks(sites.quantity),
              typography: appearance.accent,
            },
          ],
        },
        /* A framed block that asks to stay whole. It lands where the rows leave off, so on the long
           dataset it is the case the mark exists for: cut it and the frame is left open. */
        {
          type: 'container',
          id: 'settlement',
          keepTogether: true,
          box: { ...appearance.stripe, border: appearance.headRule },
          children: [
            {
              ...label('settlement-head', 'How to settle', 'Comment regler', sites),
              typography: appearance.accent,
            },
            {
              type: 'text',
              id: 'settlement-body',
              typography: appearance.body,
              content: [{ kind: 'binding', value: { kind: 'path', path: 'issuer.settlement' } }],
            },
          ],
        },
        /* Long enough to be cut across a page edge, which is where the two-line preference on
           either side of the seam is exercised on a real document rather than on a grid. */
        {
          type: 'text',
          id: 'terms',
          typography: appearance.body,
          align: appearance.noticeAlign,
          content: [{ kind: 'binding', value: { kind: 'path', path: 'issuer.terms' } }],
        },
      ],
    },
  };
}

/** One zone of the heading grid: its position, its spans, and the blocks it holds. */
function headingZone(
  id: string,
  position: Record<string, number>,
  children: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return { ...position, content: { type: 'container', id, children } };
}

/**
 * The heading of the C11 recette: twelve columns, six rows of four millimetres.
 *
 * Twelve because 3, 4 and 5 columns divide it cleanly for this model -- the engine reserves
 * neither the number nor any vocabulary. The mark spans four rows to prove `rowSpan` on a zone a
 * bitmap really constrains.
 */
function headingGrid(appearance: Appearance): Record<string, unknown> {
  return {
    type: 'grid',
    id: 'heading',
    columns: 12,
    rows: 6,
    step: 4,
    box: orUndefined(appearance.stripe),
    items: [
      headingZone('zone-mark', { row: 1, column: 1, rowSpan: 4, columnSpan: 3 }, [
        { type: 'image', id: 'grid-mark', src: LOGO_PNG, alt: 'issuer mark' },
      ]),
      headingZone('zone-title', { row: 1, column: 4, rowSpan: 2, columnSpan: 5 }, [
        {
          type: 'text',
          id: 'grid-title',
          typography: { ...appearance.body, bold: true },
          content: [{ kind: 'binding', value: title }],
        },
      ]),
      headingZone('zone-reference', { row: 1, column: 9, rowSpan: 2, columnSpan: 4 }, [
        {
          type: 'text',
          id: 'grid-reference',
          typography: appearance.body,
          align: 'end',
          content: [
            { kind: 'literal', text: 'Reference ' },
            {
              kind: 'binding',
              value: { kind: 'path', path: 'order.reference' },
              typography: appearance.accent,
            },
          ],
        },
      ]),
    ],
  };
}

/** A full-sheet layer whose content sits in one zone of a three-by-three page grid. */
function sheetLayer(
  plane: 'background' | 'foreground',
  opacity: number | undefined,
  id: string,
  zone: { row: number; column: number },
  children: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return {
    plane,
    ...(opacity === undefined ? {} : { opacity }),
    content: {
      type: 'container',
      id,
      children: [
        {
          type: 'grid',
          id: `${id}-grid`,
          columns: 3,
          rows: 3,
          step: 99,
          items: [{ ...zone, content: { type: 'container', id: `${id}-zone`, children } }],
        },
      ],
    },
  };
}

/**
 * The C11 recette: the same sixty-line statement, its title moved onto a twelve-column heading
 * grid, painted over a paper background, a faint watermark and a stamped mark in front.
 *
 * Built from the same raw document so that adding or removing the layers is the ONLY difference
 * the invariance oracle has to explain.
 */
export function layeredReferenceDocument(appearance: Appearance, layers = true): Template {
  const raw = referenceDocumentRaw(appearance);
  const page = raw.page;
  const root = raw.root;
  if (
    typeof page !== 'object' ||
    page === null ||
    typeof root !== 'object' ||
    root === null ||
    !('children' in root) ||
    !Array.isArray(root.children)
  ) {
    throw new Error('the reference document changed shape');
  }
  /* The plain title is replaced by the heading grid, which carries it in a zone. */
  const [, ...afterTitle] = root.children;
  return parseTemplate({
    ...raw,
    page: layers
      ? {
          ...page,
          layers: [
            {
              plane: 'background',
              content: {
                type: 'container',
                id: 'paper',
                box: { background: '#fdfaf2' },
                children: [],
              },
            },
            sheetLayer('background', 0.12, 'watermark', { row: 2, column: 2 }, [
              {
                type: 'text',
                id: 'watermark-text',
                align: 'center',
                /* Sized to hold 'DUPLICATA' as one unbreakable word inside a 70 mm zone: a larger
                   size would be a horizontal overflow, and the engine refuses those. */
                typography: { ...appearance.title, sizePt: 26 },
                content: [{ kind: 'literal', text: 'DUPLICATA' }],
              },
            ]),
            sheetLayer('foreground', 0.85, 'stamp', { row: 3, column: 3 }, [
              { type: 'image', id: 'stamp-mark', src: LOGO_PNG, alt: 'stamp' },
            ]),
          ],
        }
      : page,
    root: { ...root, children: [headingGrid(appearance), ...afterTitle] },
  });
}

/** Three rows, two of them reduced. */
export const THREE_ROWS: EvaluationScope = {
  render: { wording: 'long', language: 'en' },
  order: {
    reference: 20_260_014,
    holder: 'acme',
    issuedOn: '2026-01-20',
    termDays: 30,
    reductionRate: 10,
    rows: [
      { sku: 'A-1', units: 2, rate: 10, reduction: 0 },
      { sku: 'B-2', units: 1, rate: 30, reduction: 15 },
      { sku: 'C-3', units: 4, rate: 2.5, reduction: 5 },
    ],
  },
  issuer: {
    notice: 'No early-payment discount applies to this document.',
    settlement: 'By transfer to the account named in the remittance advice, quoting the reference.',
    payment: 'Remittances are applied to the oldest unpaid line first.',
    terms:
      'Payment is due on the date shown above, without deduction. Interest at the statutory rate runs from the day after that date on any part left unpaid, and the recovery costs allowed by law are added to it. Goods remain the property of the issuer until the invoice is settled in full. Any dispute about a line of this statement is to be raised in writing within thirty days of its issue, quoting the reference at the head of every sheet; a line not disputed within that period is taken as accepted.',
  },
};

/** One row, none reduced, the short wording: the same model, different results. */
export const ONE_ROW: EvaluationScope = {
  render: { wording: 'short', language: 'en' },
  order: {
    reference: 20_260_015,
    holder: 'brontide',
    issuedOn: '2026-02-27',
    termDays: 45,
    reductionRate: 3,
    rows: [{ sku: 'Z-9', units: 3, rate: 7.77, reduction: 0 }],
  },
  issuer: {
    notice: 'Settlement in full is expected on the due date.',
    settlement: 'By transfer to the account named in the remittance advice, quoting the reference.',
    payment: 'Remittances are applied to the oldest unpaid line first.',
    terms:
      'Payment is due on the date shown above, without deduction. Interest at the statutory rate runs from the day after that date on any part left unpaid, and the recovery costs allowed by law are added to it. Goods remain the property of the issuer until the invoice is settled in full. Any dispute about a line of this statement is to be raised in writing within thirty days of its issue, quoting the reference at the head of every sheet; a line not disputed within that period is taken as accepted.',
  },
};

/**
 * The same data set, asking for its words in the other language.
 *
 * The words switch here, in the data. The figures switch in the port's selection. Neither reads the
 * other, which is why the recette can render all four pairs of the two.
 */
export function worded(data: EvaluationScope, language: 'fr' | 'en'): EvaluationScope {
  const render = data.render;
  if (typeof render !== 'object' || render === null) {
    throw new Error('the reference data set should carry a render block');
  }
  return { ...data, render: { ...render, language } };
}

/**
 * The bilingual recette's own short data set.
 *
 * Its unit price carries four decimals and its quantity three, so the three writings a render
 * resolves are VISIBLY different rather than merely selected -- a rate of 7.77 would print the same
 * under the amount writing and under the unit-price one.
 */
export const WRITTEN_ROWS: EvaluationScope = {
  render: { wording: 'short', language: 'en' },
  order: {
    reference: 20_260_017,
    holder: 'longacre works',
    issuedOn: '2026-03-02',
    termDays: 45,
    reductionRate: 5,
    rows: [
      { sku: '0012345', units: 2.125, rate: 7.1234, reduction: 0 },
      { sku: 'REF-0090', units: 1, rate: 12.5, reduction: 3.5 },
    ],
  },
  issuer: {
    notice: 'Settlement in full is expected on the due date.',
    settlement: 'By transfer to the account named in the remittance advice, quoting the reference.',
    payment: 'Remittances are applied to the oldest unpaid line first.',
    terms: 'Payment is due on the date shown above, without deduction.',
  },
};

export const APPEARANCES = [FRAMED, BARE] as const;
export const DATASETS = [
  { name: 'three rows', data: THREE_ROWS },
  { name: 'one row', data: ONE_ROW },
] as const;

/**
 * What each of the sixty lines is for, cycled so the recette reads like a document rather than a
 * loop counter. The wording is this fixture's own, like every other name it uses.
 */
const WORK = [
  'Measured survey of the north elevation and of its two return walls',
  'Removal of the failed pointing between courses four and eleven, by hand',
  'Repointing in a lime mortar matched to the original, struck flush',
  'Supply and fitting of a lead saddle over the string course',
  'Easing the two casement windows upstairs, with new brass fasteners',
  'Taking down the loose chimney stack and setting the sound bricks aside',
];

/** Sixty rows, priced so that no two lines carry the same figures. */
const sixtyRows = (): readonly Record<string, unknown>[] =>
  Array.from({ length: 60 }, (_unused, index) => ({
    sku: `${String(index + 1).padStart(3, '0')} - ${WORK[index % WORK.length] ?? ''}`,
    units: 1 + (index % 4),
    rate: 12.5 + (index % 7) * 3.25,
    reduction: index % 5 === 0 ? 2 + (index % 3) : 0,
  }));

/**
 * The acceptance dataset of the paginated recette: sixty lines on the same A4 model.
 *
 * Nothing about the number sixty is known to the engine or to this adapter. The lines are host data
 * under this fixture's own key, and four sheets is what the measured flow happens to need.
 */
export const SIXTY_ROWS: EvaluationScope = {
  render: { wording: 'long', language: 'en' },
  order: {
    reference: 20_260_016,
    holder: 'longacre works',
    issuedOn: '2026-03-02',
    termDays: 60,
    reductionRate: 7.5,
    rows: sixtyRows(),
  },
  issuer: {
    notice: 'Retention of five per cent is released on practical completion.',
    settlement: 'By transfer to the account named in the remittance advice, quoting the reference.',
    payment: 'Remittances are applied to the oldest unpaid line first.',
    terms:
      'Payment is due on the date shown above, without deduction. Interest at the statutory rate runs from the day after that date on any part left unpaid, and the recovery costs allowed by law are added to it. Goods remain the property of the issuer until the invoice is settled in full. Any dispute about a line of this statement is to be raised in writing within thirty days of its issue, quoting the reference at the head of every sheet; a line not disputed within that period is taken as accepted.',
  },
};
