/**
 * Historical test corpus: raw documents per stored version for migration verification.
 */

import { CURRENT_SCHEMA_VERSION } from '../template.js';

/**
 * The page these current-shape literals carry.
 *
 * `parseTemplate` migrates and THEN validates against the current schema, so every literal
 * crossing that gate needs one whatever its stamp. Its margins differ from the compatibility page
 * a pageless document receives, so a test asserting that an authored page SURVIVES cannot pass by
 * coincidence.
 */
export const authoredPage = {
  sheet: { width: 210, height: 297 },
  margins: { top: 12, right: 12, bottom: 12, left: 12 },
  header: [],
  footer: [],
};

/** A minimal document at the current stamp, used as the baseline of the entry-point tests. */
export const validTemplate = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl_123',
  name: 'Invoice',
  version: '1.0.0',
  page: authoredPage,
  root: { type: 'container', id: 'root', children: [] },
};

/**
 * The page a document that declares none receives, pinned here so a later tidy-up cannot change it
 * silently. A4 with 20 mm margins is a compatibility decision written once, not a default for new
 * models and not a reading of the machine.
 */
export const COMPATIBILITY_PAGE = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

/**
 * The data set the version 1 document reads, named by the fixture itself.
 *
 * Openview reserves no field name, so this vocabulary is deliberately neutral: it belongs to the
 * fixture, never to the contract. Two entries with different statuses so a condition can be proven
 * on both branches.
 */
export const V1_DATA = {
  payload: {
    title: 'Quarterly summary',
    entries: [
      { label: 'First entry', status: 'open' },
      { label: 'Second entry', status: 'closed' },
    ],
  },
};

/**
 * Written before the first stamped lot: container, literal text and binding, a loop with its
 * alias, a condition, and paths the host application named. No page, no table, no appearance, no
 * writings, no fragmentation preference.
 *
 * Exported by name because the compatibility suite replays its MEANING, not only its shape.
 */
export const V1_DOCUMENT = {
  schemaVersion: 1,
  id: 'tpl_v1',
  name: 'Historical model',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'heading',
        content: [
          { kind: 'literal', text: 'Report: ' },
          { kind: 'binding', value: { kind: 'path', path: 'payload.title' } },
        ],
      },
      {
        type: 'loop',
        id: 'entries',
        each: { kind: 'path', path: 'payload.entries' },
        as: 'entry',
        children: [
          {
            type: 'condition',
            id: 'open-only',
            when: {
              kind: 'compare',
              op: 'eq',
              left: { kind: 'path', path: 'entry.status' },
              right: { kind: 'literal', value: 'open' },
            },
            children: [
              {
                type: 'text',
                id: 'entry-label',
                content: [
                  { kind: 'literal', text: '- ' },
                  { kind: 'binding', value: { kind: 'path', path: 'entry.label' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Carries a composed formula in a printable position: an aggregate over an arithmetic product. */
const v2 = {
  schemaVersion: 2,
  id: 'tpl_v2',
  name: 'Historical model',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'total',
        content: [
          {
            kind: 'binding',
            value: {
              kind: 'aggregate',
              op: 'sum',
              source: { kind: 'path', path: 'payload.entries' },
              as: 'entry',
              value: {
                kind: 'arithmetic',
                op: 'mul',
                left: { kind: 'path', path: 'entry.quantity' },
                right: { kind: 'path', path: 'entry.unitPrice' },
              },
            },
          },
        ],
      },
    ],
  },
};

/** Carries a rounding the model declares in full: mode and decimals both written down. */
const v3 = {
  schemaVersion: 3,
  id: 'tpl_v3',
  name: 'Historical model',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'total',
        content: [
          {
            kind: 'binding',
            value: {
              kind: 'round',
              value: { kind: 'path', path: 'payload.total' },
              decimals: 2,
              mode: 'halfExpand',
            },
          },
        ],
      },
    ],
  },
};

/** Carries a table wired end to end -- one column, one repeated row group, one bound cell. */
const v4 = {
  schemaVersion: 4,
  id: 'tpl_v4',
  name: 'Historical model',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'table',
        id: 'rows',
        columns: [{ id: 'label', width: 1, align: 'start' }],
        header: [],
        body: [
          {
            type: 'tableRowGroup',
            id: 'body',
            each: { kind: 'path', path: 'payload.entries' },
            as: 'entry',
            rows: [
              {
                type: 'tableRow',
                id: 'detail',
                cells: [
                  {
                    columnId: 'label',
                    children: [
                      {
                        type: 'text',
                        id: 'cell',
                        content: [
                          { kind: 'binding', value: { kind: 'path', path: 'entry.label' } },
                        ],
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
};

/** Carries a page the author wrote, a footer band, and a page field in a text position. */
const v5 = {
  schemaVersion: 5,
  id: 'tpl_v5',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 148, height: 210 },
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    header: [],
    footer: [
      {
        on: 'every',
        content: {
          type: 'container',
          id: 'footer-band',
          children: [
            {
              type: 'text',
              id: 'folio',
              content: [
                { kind: 'pageField', field: 'number' },
                { kind: 'literal', text: ' / ' },
                { kind: 'pageField', field: 'count' },
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
    children: [
      { type: 'text', id: 'heading', content: [{ kind: 'literal', text: 'Historical model' }] },
    ],
  },
};

/** Carries an appearance: a box on the container, a typography and an alignment on the text. */
const v6 = {
  schemaVersion: 6,
  id: 'tpl_v6',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'root',
    box: {
      background: '#1b3a6f',
      border: { top: { width: 0.5, color: '#000000' } },
      padding: { top: 2, right: 2, bottom: 2, left: 2 },
    },
    children: [
      {
        type: 'text',
        id: 'heading',
        align: 'center',
        typography: { family: 'Inter', sizePt: 14, bold: true, color: '#FFFFFF' },
        content: [{ kind: 'literal', text: 'Historical model' }],
      },
    ],
  },
};

/** Carries a table of writings the model names, each declaring its own locale and currency. */
const v7 = {
  schemaVersion: 7,
  id: 'tpl_v7',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [],
    footer: [],
  },
  presentations: {
    home: {
      locale: 'fr-FR',
      currency: 'EUR',
      minFractionDigits: 2,
      maxFractionDigits: 2,
      dateStyle: 'long',
    },
    export: {
      locale: 'en-US',
      currency: 'USD',
      minFractionDigits: 0,
      maxFractionDigits: 4,
      dateStyle: 'short',
    },
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      { type: 'text', id: 'heading', content: [{ kind: 'literal', text: 'Historical model' }] },
    ],
  },
};

/** Two sibling blocks, and only one asks to stay whole: presence and absence are both statements. */
const v8 = {
  schemaVersion: 8,
  id: 'tpl_v8',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'container',
        id: 'unbreakable',
        keepTogether: true,
        children: [{ type: 'text', id: 'totals', content: [{ kind: 'literal', text: 'Totals' }] }],
      },
      {
        type: 'container',
        id: 'breakable',
        children: [{ type: 'text', id: 'notes', content: [{ kind: 'literal', text: 'Notes' }] }],
      },
    ],
  },
};

/**
 * A body row that declares what it is worth to the page report, and a running header that writes
 * that report at a declared rounding. The header row carries no contribution: only a body row can.
 */
const v9 = {
  schemaVersion: 9,
  id: 'tpl_v9',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [
      {
        on: 'exceptFirst',
        content: {
          type: 'container',
          id: 'carried',
          children: [
            {
              type: 'text',
              id: 'carried-line',
              content: [
                { kind: 'literal', text: 'Carried forward ' },
                { kind: 'pageField', field: 'report', decimals: 2, mode: 'halfExpand' },
              ],
            },
          ],
        },
      },
    ],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'table',
        id: 'lines',
        columns: [
          { id: 'label', width: 3, align: 'start' },
          { id: 'amount', width: 1, align: 'end' },
        ],
        header: [
          {
            type: 'tableRow',
            id: 'head',
            cells: [
              {
                columnId: 'label',
                children: [
                  { type: 'text', id: 'h-label', content: [{ kind: 'literal', text: 'Label' }] },
                ],
              },
              {
                columnId: 'amount',
                children: [
                  { type: 'text', id: 'h-amount', content: [{ kind: 'literal', text: 'Amount' }] },
                ],
              },
            ],
          },
        ],
        body: [
          {
            type: 'tableRowGroup',
            id: 'entries',
            each: { kind: 'path', path: 'payload.entries' },
            as: 'entry',
            rows: [
              {
                type: 'tableRow',
                id: 'entry-row',
                pageReport: { value: { kind: 'path', path: 'entry.amount' } },
                cells: [
                  {
                    columnId: 'label',
                    children: [
                      {
                        type: 'text',
                        id: 'entry-label',
                        content: [
                          { kind: 'binding', value: { kind: 'path', path: 'entry.label' } },
                        ],
                      },
                    ],
                  },
                  {
                    columnId: 'amount',
                    children: [
                      {
                        type: 'text',
                        id: 'entry-amount',
                        content: [
                          { kind: 'binding', value: { kind: 'path', path: 'entry.amount' } },
                        ],
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
};

/**
 * A grid heading of three aligned zones -- one spanning two rows -- and two page layers: an opaque
 * paper background behind the pages and a stamped image in front of them.
 */
const v10 = {
  schemaVersion: 10,
  id: 'tpl_v10',
  name: 'Historical model',
  version: '1.0.0',
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [],
    footer: [],
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
      {
        plane: 'foreground',
        opacity: 0.85,
        content: {
          type: 'container',
          id: 'stamp',
          children: [{ type: 'image', id: 'stamp-image', src: 'stamp.png' }],
        },
      },
    ],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'grid',
        id: 'heading',
        columns: 12,
        rows: 8,
        step: 4,
        items: [
          {
            row: 1,
            column: 1,
            rowSpan: 2,
            columnSpan: 3,
            content: {
              type: 'container',
              id: 'zone-logo',
              children: [{ type: 'image', id: 'logo', src: 'logo.png' }],
            },
          },
          {
            row: 1,
            column: 4,
            columnSpan: 5,
            content: {
              type: 'container',
              id: 'zone-address',
              children: [
                {
                  type: 'text',
                  id: 'address',
                  content: [{ kind: 'binding', value: { kind: 'path', path: 'payload.address' } }],
                },
              ],
            },
          },
          {
            row: 1,
            column: 9,
            columnSpan: 4,
            content: {
              type: 'container',
              id: 'zone-reference',
              children: [
                {
                  type: 'text',
                  id: 'reference',
                  content: [{ kind: 'literal', text: 'REF-001' }],
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

/**
 * Three writings the model names, and the sites that ask for them by profile: an amount, a
 * quantity and a date on the bindings, and the same amount profile on the report the pages carry.
 *
 * The reference stays unformatted on purpose: a number the host uses as an identifier must survive
 * the render exactly as it was supplied.
 */
const v11 = {
  schemaVersion: 11,
  id: 'tpl_v11',
  name: 'Historical model',
  version: '1.0.0',
  presentations: {
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
  },
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header: [],
    footer: [
      {
        on: 'exceptFirst',
        content: {
          type: 'container',
          id: 'foot',
          children: [
            {
              type: 'text',
              id: 'carried',
              content: [
                { kind: 'literal', text: 'Brought forward ' },
                {
                  kind: 'pageField',
                  field: 'report',
                  decimals: 2,
                  mode: 'halfEven',
                  format: { kind: 'money', profile: 'amount' },
                },
                { kind: 'literal', text: ' on page ' },
                {
                  kind: 'pageField',
                  field: 'number',
                  format: { kind: 'decimal', profile: 'rank' },
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
    children: [
      {
        type: 'text',
        id: 'reference',
        content: [{ kind: 'binding', value: { kind: 'path', path: 'payload.reference' } }],
      },
      {
        type: 'text',
        id: 'issued',
        content: [
          {
            kind: 'binding',
            value: { kind: 'path', path: 'payload.issuedOn' },
            format: { kind: 'date', profile: 'amount' },
          },
        ],
      },
      {
        type: 'table',
        id: 'lines',
        columns: [
          { id: 'units', width: 1, align: 'end' },
          { id: 'amount', width: 2, align: 'end' },
        ],
        header: [],
        body: [
          {
            type: 'tableRowGroup',
            id: 'group',
            each: { kind: 'path', path: 'payload.entries' },
            as: 'entry',
            rows: [
              {
                type: 'tableRow',
                id: 'line',
                pageReport: { value: { kind: 'path', path: 'entry.amount' } },
                cells: [
                  {
                    columnId: 'units',
                    children: [
                      {
                        type: 'text',
                        id: 'units-cell',
                        content: [
                          {
                            kind: 'binding',
                            value: { kind: 'path', path: 'entry.units' },
                            format: { kind: 'decimal', profile: 'quantity' },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    columnId: 'amount',
                    children: [
                      {
                        type: 'text',
                        id: 'amount-cell',
                        content: [
                          {
                            kind: 'binding',
                            value: { kind: 'path', path: 'entry.amount' },
                            format: { kind: 'money', profile: 'amount' },
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
        footer: [],
      },
    ],
  },
};

/** One historical document and its compatibility expectations. */
export interface HistoricalFixture {
  /** The stored version this document was written under. */
  readonly version: number;
  /** The raw document, exactly as it was stored. */
  readonly document: Record<string, unknown>;
  /** Whether migrating it must write the compatibility page it declares none of. */
  readonly receivesCompatibilityPage: boolean;
  /**
   * Tokens of later versions -- object keys, node types, expression kinds -- that must appear
   * NOWHERE in the stored document, nor in its migrated form. `page` is excluded when the chain is
   * expected to write one: that is the single transformation the registry performs.
   */
  readonly futureTokens: readonly string[];
}

const PAGE = 'page';
const TABLE = ['table', 'tableRow', 'tableRowGroup', 'columns'];
const APPEARANCE = ['box', 'typography', 'align'];
const WRITINGS = 'presentations';
const FRAGMENTATION = 'keepTogether';
const ACCOUNTING = 'pageReport';
const LAYOUT = 'grid';
const WRITTEN_SITES = 'format';

/**
 * Historical test documents ordered by version from the initial schema to current.
 */
export const HISTORICAL_FIXTURES: readonly HistoricalFixture[] = [
  {
    version: 1,
    document: V1_DOCUMENT,
    receivesCompatibilityPage: true,
    futureTokens: [
      ...TABLE,
      ...APPEARANCE,
      WRITINGS,
      FRAGMENTATION,
      ACCOUNTING,
      LAYOUT,
      WRITTEN_SITES,
    ],
  },
  {
    version: 2,
    document: v2,
    receivesCompatibilityPage: true,
    futureTokens: [
      ...TABLE,
      'round',
      ...APPEARANCE,
      WRITINGS,
      FRAGMENTATION,
      ACCOUNTING,
      LAYOUT,
      WRITTEN_SITES,
    ],
  },
  {
    version: 3,
    document: v3,
    receivesCompatibilityPage: true,
    futureTokens: [
      ...TABLE,
      ...APPEARANCE,
      WRITINGS,
      FRAGMENTATION,
      ACCOUNTING,
      LAYOUT,
      WRITTEN_SITES,
    ],
  },
  {
    version: 4,
    document: v4,
    receivesCompatibilityPage: true,
    futureTokens: [...APPEARANCE, WRITINGS, FRAGMENTATION, ACCOUNTING, LAYOUT, WRITTEN_SITES],
  },
  {
    version: 5,
    document: v5,
    receivesCompatibilityPage: false,
    futureTokens: [...APPEARANCE, WRITINGS, FRAGMENTATION, ACCOUNTING, LAYOUT, WRITTEN_SITES],
  },
  {
    version: 6,
    document: v6,
    receivesCompatibilityPage: false,
    futureTokens: [WRITINGS, FRAGMENTATION, ACCOUNTING, LAYOUT, WRITTEN_SITES],
  },
  {
    version: 7,
    document: v7,
    receivesCompatibilityPage: false,
    futureTokens: [FRAGMENTATION, ACCOUNTING, LAYOUT, WRITTEN_SITES],
  },
  {
    version: 8,
    document: v8,
    receivesCompatibilityPage: false,
    futureTokens: [ACCOUNTING, LAYOUT, WRITTEN_SITES],
  },
  {
    version: 9,
    document: v9,
    receivesCompatibilityPage: false,
    futureTokens: [LAYOUT, WRITTEN_SITES],
  },
  {
    version: 10,
    document: v10,
    receivesCompatibilityPage: false,
    futureTokens: [WRITTEN_SITES],
  },
  {
    version: 11,
    document: v11,
    receivesCompatibilityPage: false,
    futureTokens: [],
  },
];

/** The tokens a stored document must not carry, including the page a migration may add later. */
export function tokensAbsentFromSource(fixture: HistoricalFixture): readonly string[] {
  return fixture.receivesCompatibilityPage ? [PAGE, ...fixture.futureTokens] : fixture.futureTokens;
}
