/**
 * Builders and the proof declaration shared by `compatibility.test.ts` and `recipe.test.ts`.
 *
 * Carries constants and factories only: it holds no `it`, imports nothing from `vitest`, and every
 * export it declares is called somewhere -- an uncalled one would be instrumented, never covered,
 * and would lower this package's function coverage with no test going red.
 *
 * The business keys below are a proof set. None of them exists in the production sources: the
 * catalogue contract names no field, and `recipe.test.ts` renames the whole set to show it.
 */

import type { Expression, PrintableExpression } from '../../expression/expression.js';
import { STANDARD_SHEETS_MM } from '../../page/page.js';
import { CURRENT_SCHEMA_VERSION, type Template } from '../../template/template.js';
import type { DataCatalogue, DataField, DataType } from '../types.js';

/** The shapes a parsed template actually carries, rather than their hand-written counterparts. */
export type Root = Template['root'];
export type Block = Root['children'][number];
export type Band = Template['page']['header'][number];

let nextId = 0;

/** A distinct node id per call, so two nodes of one model are never confused in a result. */
function freshId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

export const path = (written: string): PrintableExpression => ({ kind: 'path', path: written });

/** A text block reading one expression, so a reading has a node and a position of its own. */
export function binding(value: PrintableExpression): Block {
  return { type: 'text', id: freshId('text'), content: [{ kind: 'binding', value }] };
}

/** A text block reading nothing: a literal and a page marker, neither of which is a data reading. */
export function staticText(): Block {
  return {
    type: 'text',
    id: freshId('static'),
    content: [
      { kind: 'literal', text: 'Fixed' },
      { kind: 'pageField', field: 'number' },
    ],
  };
}

export function container(children: Block[]): Root {
  return { type: 'container', id: freshId('box'), children };
}

export function loop(each: Expression, as: string, children: Block[]): Block {
  return { type: 'loop', id: freshId('loop'), each, as, children };
}

export function condition(when: Expression, children: Block[]): Block {
  return { type: 'condition', id: freshId('cond'), when, children };
}

/** A one-column table whose body repeats a group, with an optional page report on its row. */
export function rowGroupTable(
  each: Expression,
  as: string,
  cell: Block[],
  pageReport?: PrintableExpression,
): Block {
  const cells = [{ columnId: 'c', children: cell }];
  const row =
    pageReport === undefined
      ? { type: 'tableRow' as const, id: freshId('row'), cells }
      : { type: 'tableRow' as const, id: freshId('row'), cells, pageReport: { value: pageReport } };
  return {
    type: 'table',
    id: freshId('table'),
    columns: [{ id: 'c', width: 1, align: 'start' }],
    header: [],
    body: [{ type: 'tableRowGroup', id: freshId('group'), each, as, rows: [row] }],
    footer: [],
  };
}

/** A picture: a node the analysis walks past without a reading of any kind. */
export function image(): Block {
  return { type: 'image', id: freshId('img'), src: 'asset-key' };
}

function cellRow(children: Block[]) {
  return {
    type: 'tableRow' as const,
    id: freshId('row'),
    cells: [{ columnId: 'c', children }],
  };
}

/** A table whose header and footer rows carry readings of their own. */
export function bandedTable(header: Block[], footer: Block[]): Block {
  return {
    type: 'table',
    id: freshId('table'),
    columns: [{ id: 'c', width: 1, align: 'start' }],
    header: [cellRow(header)],
    body: [],
    footer: [cellRow(footer)],
  };
}

export function band(content: Root): Band {
  return { on: 'every', content };
}

export function templateOf(root: Root, header: Band[] = [], footer: Band[] = []): Template {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'fixture',
    name: 'Fixture',
    version: '1.0.0',
    page: {
      sheet: STANDARD_SHEETS_MM.a4,
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header,
      footer,
    },
    root,
  };
}

export const field = (key: string, label: string, type: DataType): DataField => ({
  key,
  label,
  type,
});

export const record = (fields: readonly DataField[]): DataType => ({ kind: 'object', fields });
export const listOf = (items: DataType): DataType => ({ kind: 'list', items });

/**
 * The proof catalogue: a document record, a recipient record of two texts, a list of rows carrying
 * a label, a quantity, a price and a discount, a list of texts inside each row, and a flag.
 */
export function proofCatalogue(): DataCatalogue {
  return {
    fields: [
      field(
        'document',
        'Document',
        record([
          field('numero', 'Numéro', { kind: 'number' }),
          field('emisLe', 'Émis le', { kind: 'civil-date' }),
          field('delai', 'Délai en jours', { kind: 'number' }),
        ]),
      ),
      field(
        'destinataire',
        'Destinataire',
        record([
          field('nom', 'Nom', { kind: 'string' }),
          field('ville', 'Ville', { kind: 'string' }),
        ]),
      ),
      field(
        'lignes',
        'Lignes',
        listOf(
          record([
            field('libelle', 'Libellé', { kind: 'string' }),
            field('quantite', 'Quantité', { kind: 'number' }),
            field('prix', 'Prix unitaire', { kind: 'number' }),
            field('remise', 'Remise', { kind: 'number' }),
            field('mentions', 'Mentions', listOf({ kind: 'string' })),
          ]),
        ),
      ),
      field('acquitte', 'Acquitté', { kind: 'boolean' }),
    ],
  };
}

/** The same declaration with the price removed, and nothing else changed. */
export function catalogueWithoutPrice(): DataCatalogue {
  const complete = proofCatalogue();
  return {
    fields: complete.fields.map((root) =>
      root.key !== 'lignes' || root.type.kind !== 'list' || root.type.items.kind !== 'object'
        ? root
        : {
            ...root,
            type: {
              kind: 'list',
              items: {
                kind: 'object',
                fields: root.type.items.fields.filter((member) => member.key !== 'prix'),
              },
            },
          },
    ),
  };
}

/** The same declaration with the list of rows turned into a record, and nothing else changed. */
export function catalogueWithRowsAsRecord(): DataCatalogue {
  const complete = proofCatalogue();
  return {
    fields: complete.fields.map((root) =>
      root.key !== 'lignes' || root.type.kind !== 'list'
        ? root
        : { ...root, type: root.type.items },
    ),
  };
}

/** Rows kept discounted, under an alias of their own. */
function discountedRows(alias: string): Expression {
  return {
    kind: 'filter',
    source: path('lignes'),
    as: alias,
    where: {
      kind: 'compare',
      op: 'gt',
      left: path(`${alias}.remise`),
      right: { kind: 'literal', value: 0 },
    },
  };
}

/** The sum of the row amounts: a total the data never carries ready-made. */
function rowsTotal(alias: string): PrintableExpression {
  return {
    kind: 'aggregate',
    op: 'sum',
    source: path('lignes'),
    as: alias,
    value: {
      kind: 'arithmetic',
      op: 'mul',
      left: path(`${alias}.quantite`),
      right: path(`${alias}.prix`),
    },
  };
}

/**
 * The proof model: one reading in the flow, one in the header, one in the footer, the list under a
 * row group, three members of its element, a member under a filter, a numeric member under an
 * aggregation, a civil date under a date operation, a flag under a condition, and a page report.
 */
export function proofTemplate(): Template {
  const rowAmount: PrintableExpression = {
    kind: 'arithmetic',
    op: 'mul',
    left: path('ligne.quantite'),
    right: path('ligne.prix'),
  };
  const dueOn: PrintableExpression = {
    kind: 'dateAdd',
    date: path('document.emisLe'),
    days: path('document.delai'),
  };

  return templateOf(
    container([
      binding(path('destinataire.nom')),
      rowGroupTable(path('lignes'), 'ligne', [binding(path('ligne.libelle'))], rowAmount),
      loop(discountedRows('remisee'), 'gardee', [binding(path('gardee.libelle'))]),
      condition(path('acquitte'), [binding(rowsTotal('agregee'))]),
      binding(dueOn),
      staticText(),
    ]),
    [band(container([binding(path('document.numero'))]))],
    [band(container([binding(path('destinataire.ville'))]))],
  );
}
