import { describe, expect, it } from 'vitest';
import {
  DATA_KEY_MESSAGE,
  DATA_LABEL_LENGTH_MESSAGE,
  DATA_LABEL_MESSAGE,
  DataCatalogueSchema,
  DUPLICATE_DATA_KEY_MESSAGE,
} from '../schemas.js';
import { MAX_DATA_LABEL_LENGTH } from '../types.js';

/** A catalogue holding one root field of the given type, so a refusal path stays readable. */
function catalogueOf(type: unknown): unknown {
  return { fields: [{ key: 'root', label: 'Racine', type }] };
}

function issuesOf(value: unknown): readonly { path: readonly PropertyKey[]; message: string }[] {
  const result = DataCatalogueSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

describe('the catalogue schema accepts what a host may declare', () => {
  it('accepts an empty catalogue, because a wholly static model is valid', () => {
    expect(DataCatalogueSchema.safeParse({ fields: [] }).success).toBe(true);
  });

  it.each(['string', 'number', 'boolean', 'civil-date'])('accepts a %s leaf', (kind) => {
    expect(DataCatalogueSchema.safeParse(catalogueOf({ kind })).success).toBe(true);
  });

  it('accepts a nested record', () => {
    const nested = {
      kind: 'object',
      fields: [{ key: 'inner', label: 'Interne', type: { kind: 'string' } }],
    };
    expect(DataCatalogueSchema.safeParse(catalogueOf(nested)).success).toBe(true);
  });

  it('accepts a list of scalars', () => {
    expect(
      DataCatalogueSchema.safeParse(catalogueOf({ kind: 'list', items: { kind: 'number' } }))
        .success,
    ).toBe(true);
  });

  it('accepts a list of records', () => {
    const list = {
      kind: 'list',
      items: {
        kind: 'object',
        fields: [{ key: 'amount', label: 'Montant', type: { kind: 'number' } }],
      },
    };
    expect(DataCatalogueSchema.safeParse(catalogueOf(list)).success).toBe(true);
  });

  it('accepts a list of lists, with no special shape for the nesting', () => {
    const nested = { kind: 'list', items: { kind: 'list', items: { kind: 'string' } } };
    expect(DataCatalogueSchema.safeParse(catalogueOf(nested)).success).toBe(true);
  });

  it('accepts a record with no field and a list of empty records', () => {
    const empties = {
      fields: [
        { key: 'blank', label: 'Vide', type: { kind: 'object', fields: [] } },
        {
          key: 'rows',
          label: 'Lignes',
          type: { kind: 'list', items: { kind: 'object', fields: [] } },
        },
      ],
    };
    expect(DataCatalogueSchema.safeParse(empties).success).toBe(true);
  });

  it('accepts a label at the bound and two siblings sharing one label', () => {
    const parsed = DataCatalogueSchema.safeParse({
      fields: [
        { key: 'a', label: 'X'.repeat(MAX_DATA_LABEL_LENGTH), type: { kind: 'string' } },
        { key: 'b', label: 'Même libellé', type: { kind: 'string' } },
        { key: 'c', label: 'Même libellé', type: { kind: 'string' } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('keeps the declared order of siblings through a parse', () => {
    const parsed = DataCatalogueSchema.parse({
      fields: [
        { key: 'zulu', label: 'Zoulou', type: { kind: 'string' } },
        { key: 'alpha', label: 'Alpha', type: { kind: 'string' } },
        { key: 'mike', label: 'Mike', type: { kind: 'string' } },
      ],
    });
    expect(parsed.fields.map((field) => field.key)).toEqual(['zulu', 'alpha', 'mike']);
  });

  it('round-trips a deep declaration unchanged', () => {
    const declared = {
      fields: [
        {
          key: 'order',
          label: 'Commande',
          type: {
            kind: 'object',
            fields: [
              { key: 'issuedOn', label: 'Émise le', type: { kind: 'civil-date' } },
              {
                key: 'rows',
                label: 'Lignes',
                type: {
                  kind: 'list',
                  items: {
                    kind: 'object',
                    fields: [{ key: 'qty', label: 'Quantité', type: { kind: 'number' } }],
                  },
                },
              },
            ],
          },
        },
      ],
    };
    expect(DataCatalogueSchema.parse(declared)).toEqual(declared);
  });
});

describe('the catalogue schema refuses what no path could address', () => {
  it.each([
    ['an empty key', ''],
    ['a dotted key', 'a.b'],
    ['a key with a space', 'a b'],
    ['a hyphenated key', 'a-b'],
    ['a key starting with a digit', '1a'],
  ])('refuses %s', (_name, key) => {
    const issues = issuesOf({ fields: [{ key, label: 'L', type: { kind: 'string' } }] });
    expect(issues).toContainEqual({ path: ['fields', 0, 'key'], message: DATA_KEY_MESSAGE });
  });

  it.each(['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf'])(
    'refuses the inherited member %s as a key',
    (key) => {
      const issues = issuesOf({ fields: [{ key, label: 'L', type: { kind: 'string' } }] });
      expect(issues).toContainEqual({ path: ['fields', 0, 'key'], message: DATA_KEY_MESSAGE });
    },
  );

  it.each([
    ['an empty label', ''],
    ['a blank label', '   '],
    ['a label with a leading space', ' Nom'],
    ['a label with a trailing space', 'Nom '],
  ])('refuses %s', (_name, label) => {
    const issues = issuesOf({ fields: [{ key: 'k', label, type: { kind: 'string' } }] });
    expect(issues).toContainEqual({ path: ['fields', 0, 'label'], message: DATA_LABEL_MESSAGE });
  });

  it('refuses a label beyond the bound', () => {
    const label = 'X'.repeat(MAX_DATA_LABEL_LENGTH + 1);
    const issues = issuesOf({ fields: [{ key: 'k', label, type: { kind: 'string' } }] });
    expect(issues).toContainEqual({
      path: ['fields', 0, 'label'],
      message: DATA_LABEL_LENGTH_MESSAGE,
    });
  });

  it('refuses an unknown kind', () => {
    expect(DataCatalogueSchema.safeParse(catalogueOf({ kind: 'money' })).success).toBe(false);
  });

  it.each([
    ['a field with no type', { fields: [{ key: 'k', label: 'L' }] }],
    ['a field with no key', { fields: [{ label: 'L', type: { kind: 'string' } }] }],
    ['a field with no label', { fields: [{ key: 'k', type: { kind: 'string' } }] }],
    ['a list with no items', { fields: [{ key: 'k', label: 'L', type: { kind: 'list' } }] }],
    ['a record with no fields', { fields: [{ key: 'k', label: 'L', type: { kind: 'object' } }] }],
    ['a catalogue with no fields', {}],
  ])('refuses %s', (_name, value) => {
    expect(DataCatalogueSchema.safeParse(value).success).toBe(false);
  });

  it('refuses a malformed recursive type', () => {
    const malformed = catalogueOf({ kind: 'list', items: { kind: 'object', fields: 'nope' } });
    expect(DataCatalogueSchema.safeParse(malformed).success).toBe(false);
  });
});

describe('the catalogue schema refuses two sibling keys, at the second one', () => {
  it('refuses a duplicate root key', () => {
    const issues = issuesOf({
      fields: [
        { key: 'twin', label: 'Premier', type: { kind: 'string' } },
        { key: 'twin', label: 'Second', type: { kind: 'number' } },
      ],
    });
    expect(issues).toEqual([{ path: ['fields', 1, 'key'], message: DUPLICATE_DATA_KEY_MESSAGE }]);
  });

  it('refuses a duplicate key inside a record', () => {
    const issues = issuesOf(
      catalogueOf({
        kind: 'object',
        fields: [
          { key: 'twin', label: 'Premier', type: { kind: 'string' } },
          { key: 'twin', label: 'Second', type: { kind: 'string' } },
        ],
      }),
    );
    expect(issues).toEqual([
      {
        path: ['fields', 0, 'type', 'fields', 1, 'key'],
        message: DUPLICATE_DATA_KEY_MESSAGE,
      },
    ]);
  });

  it('refuses a duplicate key inside the element of a list', () => {
    const issues = issuesOf(
      catalogueOf({
        kind: 'list',
        items: {
          kind: 'object',
          fields: [
            { key: 'twin', label: 'Premier', type: { kind: 'string' } },
            { key: 'twin', label: 'Second', type: { kind: 'string' } },
          ],
        },
      }),
    );
    expect(issues).toEqual([
      {
        path: ['fields', 0, 'type', 'items', 'fields', 1, 'key'],
        message: DUPLICATE_DATA_KEY_MESSAGE,
      },
    ]);
  });

  it('writes one constant refusal, whatever the key and the label in fault', () => {
    const first = issuesOf({
      fields: [
        { key: 'alpha', label: 'Alpha', type: { kind: 'string' } },
        { key: 'alpha', label: 'Alpha bis', type: { kind: 'number' } },
      ],
    });
    const second = issuesOf({
      fields: [
        { key: 'zulu', label: 'Zoulou', type: { kind: 'boolean' } },
        { key: 'zulu', label: 'Zoulou bis', type: { kind: 'civil-date' } },
      ],
    });
    expect(first).toEqual(second);
    expect(first[0]?.message).toBe(DUPLICATE_DATA_KEY_MESSAGE);
  });
});
