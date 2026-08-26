import { describe, expect, it } from 'vitest';
import { listDataCatalogueEntries } from '../list.js';
import type { DataCatalogue } from '../types.js';

/**
 * A catalogue exercising every descent at once: a record, a list of records, a list of scalars, a
 * list of lists, and two empties.
 */
const CATALOGUE: DataCatalogue = {
  fields: [
    {
      key: 'order',
      label: 'Commande',
      type: {
        kind: 'object',
        fields: [
          { key: 'ref', label: 'Référence', type: { kind: 'string' } },
          { key: 'issuedOn', label: 'Émise le', type: { kind: 'civil-date' } },
          {
            key: 'rows',
            label: 'Lignes',
            type: {
              kind: 'list',
              items: {
                kind: 'object',
                fields: [
                  { key: 'qty', label: 'Quantité', type: { kind: 'number' } },
                  {
                    key: 'tags',
                    label: 'Étiquettes',
                    type: { kind: 'list', items: { kind: 'string' } },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    {
      key: 'grids',
      label: 'Grilles',
      type: {
        kind: 'list',
        items: {
          kind: 'list',
          items: {
            kind: 'object',
            fields: [{ key: 'cell', label: 'Cellule', type: { kind: 'string' } }],
          },
        },
      },
    },
    { key: 'blank', label: 'Vide', type: { kind: 'object', fields: [] } },
    { key: 'none', label: 'Aucune', type: { kind: 'list', items: { kind: 'object', fields: [] } } },
  ],
};

describe('listDataCatalogueEntries', () => {
  it('lists parents before descendants, siblings in the declared order', () => {
    expect(listDataCatalogueEntries(CATALOGUE).map((entry) => entry.keyPath.join('.'))).toEqual([
      'order',
      'order.ref',
      'order.issuedOn',
      'order.rows',
      'order.rows.qty',
      'order.rows.tags',
      'grids',
      'grids.cell',
      'blank',
      'none',
    ]);
  });

  it('carries the label chain beside the key chain', () => {
    const entries = listDataCatalogueEntries(CATALOGUE);
    expect(
      entries.find((entry) => entry.keyPath.join('.') === 'order.rows.qty')?.labelPath,
    ).toEqual(['Commande', 'Lignes', 'Quantité']);
    expect(entries.find((entry) => entry.keyPath.join('.') === 'grids.cell')?.labelPath).toEqual([
      'Grilles',
      'Cellule',
    ]);
  });

  it('keeps the list boundary in the parent type rather than inventing a key segment', () => {
    const entries = listDataCatalogueEntries(CATALOGUE);
    const rows = entries.find((entry) => entry.keyPath.join('.') === 'order.rows');
    expect(rows?.type.kind).toBe('list');
    expect(entries.map((entry) => entry.keyPath.join('.'))).not.toContain('order.rows.[]');
  });

  it('lists an empty record and an empty list element once each, with nothing below', () => {
    const keys = listDataCatalogueEntries(CATALOGUE).map((entry) => entry.keyPath.join('.'));
    expect(keys.filter((key) => key === 'blank')).toHaveLength(1);
    expect(keys.filter((key) => key === 'none')).toHaveLength(1);
    expect(keys.filter((key) => key.startsWith('none.'))).toEqual([]);
  });

  it('lists nothing for an empty catalogue', () => {
    expect(listDataCatalogueEntries({ fields: [] })).toEqual([]);
  });

  it('shares the declared types by reference and mutates no array of the catalogue', () => {
    const before: unknown = JSON.parse(JSON.stringify(CATALOGUE));
    const entries = listDataCatalogueEntries(CATALOGUE);
    expect(entries[0]?.type).toBe(CATALOGUE.fields[0]?.type);
    expect(CATALOGUE).toEqual(before);
  });

  it('answers equal values in independent arrays on two calls', () => {
    const first = listDataCatalogueEntries(CATALOGUE);
    const second = listDataCatalogueEntries(CATALOGUE);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]?.keyPath).not.toBe(second[0]?.keyPath);
  });
});
