import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  type Expression,
  type PrintableExpression,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import { LOGO_PNG } from './fixtures.js';

/**
 * The acceptance document: one sheet, a logo, a five-column table, computed money and dates, two
 * bands and two appearances.
 *
 * It is shaped like a bill because that is the hardest document the roadmap names, and its field
 * names are this fixture's own -- `order`, `rows`, `issuer`. Nothing in the engine or in this
 * adapter reads a name: the same structure prints a statement or a delivery note under a completely
 * different vocabulary.
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

const PAGINATION = [
  { kind: 'literal', text: 'Page ' },
  { kind: 'pageField', field: 'number' },
  { kind: 'literal', text: ' / ' },
  { kind: 'pageField', field: 'count' },
];

const label = (id: string, text: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text }],
});

const bound = (id: string, value: PrintableExpression): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'binding', value }],
});

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
  title: { family: 'Georgia', sizePt: 16, bold: true, color: '#1b3a6f' },
  body: { family: 'Georgia', sizePt: 8, color: '#22262b' },
  accent: { bold: true, color: '#1b3a6f' },
  noticeAlign: 'start',
};

export const BARE: Appearance = {
  name: 'rust sans-serif, justified notice',
  frame: { padding: { top: 2, right: 0, bottom: 2, left: 0 } },
  stripe: { border: { bottom: { width: 1.2, color: '#8C3A1B' } } },
  table: { background: '#FDF7F4' },
  headRule: { bottom: { width: 1.2, color: '#8C3A1B' } },
  firstRowRule: { top: { width: 0.28, color: '#8C3A1B' } },
  title: { family: 'Arial', sizePt: 13, italic: true, color: '#8C3A1B' },
  body: { family: 'Arial', sizePt: 7.5, color: '#3A3A3A' },
  accent: { color: '#8C3A1B' },
  noticeAlign: 'justify',
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
  return parseTemplate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_reference',
    name: 'Reference document',
    version: '1.0.0',
    page: {
      /* A4 because the author of this model wrote it, not because the engine knows a format. */
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 14, right: 14, bottom: 14, left: 14 },
      header: [
        {
          on: 'every',
          content: {
            type: 'container',
            id: 'stripe',
            box: orUndefined(appearance.stripe),
            children: [
              /* The mark and the reference share a table, and the table is what gives the image a
                 width: an image with no declared size takes the content width of its parent, and
                 the appearance contract carries no width on a box. A column weight is the only way
                 a model constrains one today. */
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
                        children: [
                          { type: 'image', id: 'logo', src: LOGO_PNG, alt: 'issuer mark' },
                        ],
                      },
                      {
                        columnId: 'reference',
                        children: [
                          {
                            type: 'text',
                            id: 'stripe-reference',
                            typography: appearance.body,
                            content: [
                              { kind: 'literal', text: 'Reference ' },
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
            ],
          },
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
            children: [{ type: 'text', id: 'running-foot-num', content: PAGINATION }],
          },
        },
        {
          on: 'lastOnly',
          content: {
            type: 'container',
            id: 'final-foot',
            children: [
              { type: 'text', id: 'final-foot-num', content: PAGINATION },
              {
                type: 'text',
                id: 'final-foot-notice',
                typography: appearance.body,
                align: appearance.noticeAlign,
                content: [{ kind: 'binding', value: { kind: 'path', path: 'issuer.notice' } }],
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
                { columnId: 'sku', children: [label('h-sku', 'Item')] },
                { columnId: 'units', children: [label('h-units', 'Units')] },
                { columnId: 'rate', children: [label('h-rate', 'Rate')] },
                { columnId: 'amount', children: [label('h-amount', 'Amount')] },
                { columnId: 'note', children: [label('h-note', 'Note')] },
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
                  cells: [
                    {
                      columnId: 'sku',
                      children: [bound('d-sku', { kind: 'path', path: 'row.sku' })],
                    },
                    {
                      columnId: 'units',
                      children: [bound('d-units', { kind: 'path', path: 'row.units' })],
                    },
                    {
                      columnId: 'rate',
                      children: [bound('d-rate', { kind: 'path', path: 'row.rate' })],
                    },
                    { columnId: 'amount', children: [bound('d-amount', rowAmount)] },
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
                              content: [
                                { kind: 'literal', text: 'less ' },
                                { kind: 'binding', value: { kind: 'path', path: 'row.reduction' } },
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
                { columnId: 'sku', children: [label('f-label', 'Net total')] },
                { columnId: 'amount', children: [bound('f-amount', netTotal)] },
              ],
            },
          ],
        },
        {
          type: 'text',
          id: 'totals',
          typography: appearance.body,
          align: 'end',
          content: [
            { kind: 'literal', text: 'Net ' },
            { kind: 'binding', value: netTotal, typography: appearance.accent },
            { kind: 'literal', text: ' less ' },
            { kind: 'binding', value: roundedReduction },
            { kind: 'literal', text: ' leaves ' },
            { kind: 'binding', value: remainder },
          ],
        },
        {
          type: 'text',
          id: 'dates',
          typography: appearance.body,
          align: appearance.noticeAlign,
          content: [
            { kind: 'literal', text: 'Due ' },
            { kind: 'binding', value: dueDate },
            { kind: 'literal', text: ', end of that month ' },
            { kind: 'binding', value: endOfTerm },
            { kind: 'literal', text: ', reduced lines ' },
            { kind: 'binding', value: reducedRowCount, typography: appearance.accent },
          ],
        },
      ],
    },
  });
}

/** Three rows, two of them reduced. */
export const THREE_ROWS: EvaluationScope = {
  render: { wording: 'long' },
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
  issuer: { notice: 'No early-payment discount applies to this document.' },
};

/** One row, none reduced, the short wording: the same model, different results. */
export const ONE_ROW: EvaluationScope = {
  render: { wording: 'short' },
  order: {
    reference: 20_260_015,
    holder: 'brontide',
    issuedOn: '2026-02-27',
    termDays: 45,
    reductionRate: 3,
    rows: [{ sku: 'Z-9', units: 3, rate: 7.77, reduction: 0 }],
  },
  issuer: { notice: 'Settlement in full is expected on the due date.' },
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
  render: { wording: 'long' },
  order: {
    reference: 20_260_016,
    holder: 'longacre works',
    issuedOn: '2026-03-02',
    termDays: 60,
    reductionRate: 7.5,
    rows: sixtyRows(),
  },
  issuer: { notice: 'Retention of five per cent is released on practical completion.' },
};
