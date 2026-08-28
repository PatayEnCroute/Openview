import { describe, expect, it } from 'vitest';
import type { PresentationFormat } from '../../ast/nodes.js';
import type { Expression, PrintableExpression } from '../../expression/expression.js';
import { checkTemplateDataCompatibility } from '../compatibility.js';
import type {
  DataCatalogue,
  DataExpectation,
  DataReadStatus,
  DataScalarKind,
  DataType,
} from '../types.js';
import {
  band,
  bandedTable,
  binding,
  condition,
  container,
  field,
  image,
  listOf,
  loop,
  path,
  record,
  rowGroupTable,
  staticText,
  templateOf,
  writtenBinding,
} from './fixtures.js';

/** A catalogue whose single root carries the given type, under a fixed key and label. */
function rooted(type: DataType): DataCatalogue {
  return { fields: [field('root', 'Racine', type)] };
}

const EMPTY: DataCatalogue = { fields: [] };

/** Analyses one printable expression placed in a visible binding. */
function checkBinding(value: PrintableExpression, catalogue: DataCatalogue) {
  return checkTemplateDataCompatibility(templateOf(container([binding(value)])), catalogue);
}

/** The status one path reading receives at a visible binding, under the given declaration. */
function statusOfBinding(written: string, type: DataType): DataReadStatus | undefined {
  return checkBinding(path(written), rooted(type)).reads[0]?.status;
}

describe('a direct reading', () => {
  it('accepts a static model against an empty catalogue', () => {
    const result = checkTemplateDataCompatibility(templateOf(container([staticText()])), EMPTY);
    expect(result).toEqual({
      compatible: true,
      reads: [],
      diagnostics: [],
      scopeWarnings: [],
    });
  });

  it('resolves a declared root and carries its label', () => {
    const result = checkBinding(path('root'), rooted({ kind: 'string' }));
    expect(result.compatible).toBe(true);
    expect(result.reads).toEqual([
      {
        writtenPath: 'root',
        cataloguePath: ['root'],
        labels: ['Racine'],
        actualKind: 'string',
        expectation: 'printable',
        status: 'available',
        path: ['root', 'children', 0, 'content', 0, 'value'],
        nodeId: expect.stringContaining('text'),
      },
    ]);
  });

  it('refuses an undeclared root, at its position and with no value of any dataset', () => {
    const result = checkBinding(path('absent'), rooted({ kind: 'string' }));
    expect(result.compatible).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        source: 'data-compatibility',
        code: 'undeclared-data-path',
        message: expect.any(String),
        dataPath: 'absent',
        path: ['root', 'children', 0, 'content', 0, 'value'],
        nodeId: expect.stringContaining('text'),
      },
    ]);
    expect(result.reads[0]?.status).toBe('undeclared');
  });

  it('resolves a declared member of a record', () => {
    const catalogue = rooted(record([field('inner', 'Interne', { kind: 'string' })]));
    const result = checkBinding(path('root.inner'), catalogue);
    expect(result.compatible).toBe(true);
    expect(result.reads[0]?.cataloguePath).toEqual(['root', 'inner']);
    expect(result.reads[0]?.labels).toEqual(['Racine', 'Interne']);
  });

  it('refuses an undeclared member of a declared record', () => {
    const catalogue = rooted(record([field('inner', 'Interne', { kind: 'string' })]));
    const result = checkBinding(path('root.autre'), catalogue);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['undeclared-data-path']);
    expect(result.diagnostics[0]?.dataPath).toBe('root.autre');
  });

  it('refuses traversing a scalar', () => {
    expect(statusOfBinding('root.deeper', { kind: 'string' })).toBe('undeclared');
  });

  it('refuses traversing a list, since the language maps nothing implicitly', () => {
    const rows = listOf(record([field('amount', 'Montant', { kind: 'number' })]));
    expect(statusOfBinding('root.amount', rows)).toBe('undeclared');
  });

  it('reports one reading per occurrence, each at its own position', () => {
    const template = templateOf(container([binding(path('root')), binding(path('root'))]));
    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'string' }));
    expect(result.reads).toHaveLength(2);
    expect(result.reads[0]?.path).not.toEqual(result.reads[1]?.path);
    expect(result.reads[0]?.nodeId).not.toBe(result.reads[1]?.nodeId);
  });

  it('walks the flow, then the header bands, then the footer bands, in that order', () => {
    const template = templateOf(
      container([binding(path('root'))]),
      [band(container([binding(path('root'))])), band(container([binding(path('root'))]))],
      [band(container([binding(path('root'))]))],
    );
    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'string' }));
    expect(result.reads.map((read) => read.path)).toEqual([
      ['root', 'children', 0, 'content', 0, 'value'],
      ['page', 'header', 0, 'content', 'children', 0, 'content', 0, 'value'],
      ['page', 'header', 1, 'content', 'children', 0, 'content', 0, 'value'],
      ['page', 'footer', 0, 'content', 'children', 0, 'content', 0, 'value'],
    ]);
  });

  it('walks the header rows, the body and the footer rows of a table, in that order', () => {
    const template = templateOf(
      container([
        bandedTable([binding(path('root'))], [binding(path('root'))]),
        rowGroupTable(path('rows'), 'item', [binding(path('item'))]),
      ]),
    );
    const catalogue: DataCatalogue = {
      fields: [
        field('root', 'Racine', { kind: 'string' }),
        field('rows', 'Lignes', listOf({ kind: 'string' })),
      ],
    };
    const result = checkTemplateDataCompatibility(template, catalogue);
    expect(result.compatible).toBe(true);
    const cell = ['cells', 0, 'children', 0, 'content', 0, 'value'];
    expect(result.reads.map((read) => read.path)).toEqual([
      ['root', 'children', 0, 'header', 0, ...cell],
      ['root', 'children', 0, 'footer', 0, ...cell],
      ['root', 'children', 1, 'body', 0, 'each'],
      ['root', 'children', 1, 'body', 0, 'rows', 0, ...cell],
    ]);
  });

  it('reads nothing from a picture', () => {
    const template = templateOf(container([image()]));
    expect(checkTemplateDataCompatibility(template, EMPTY).reads).toEqual([]);
  });

  it('creates no reading for a literal or a page marker', () => {
    const result = checkTemplateDataCompatibility(
      templateOf(container([staticText()])),
      rooted({ kind: 'string' }),
    );
    expect(result.reads).toEqual([]);
  });
});

describe('the scopes a document opens', () => {
  const rows = listOf(
    record([
      field('libelle', 'Libellé', { kind: 'string' }),
      field('quantite', 'Quantité', { kind: 'number' }),
    ]),
  );

  it('binds a loop alias to the element of its list and resolves its members', () => {
    const template = templateOf(
      container([loop(path('root'), 'item', [binding(path('item.libelle'))])]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.compatible).toBe(true);
    const member = result.reads.find((read) => read.writtenPath === 'item.libelle');
    expect(member?.cataloguePath).toEqual(['root', 'libelle']);
    expect(member?.labels).toEqual(['Racine', 'Libellé']);
  });

  it('refuses a misspelt member of the element', () => {
    const template = templateOf(
      container([loop(path('root'), 'item', [binding(path('item.libele'))])]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.diagnostics.map((d) => d.dataPath)).toEqual(['item.libele']);
  });

  it('binds the terminal type of a list of scalars to the alias itself', () => {
    const template = templateOf(container([loop(path('root'), 'item', [binding(path('item'))])]));
    const result = checkTemplateDataCompatibility(template, rooted(listOf({ kind: 'string' })));
    expect(result.compatible).toBe(true);
    expect(result.reads.find((read) => read.writtenPath === 'item')?.actualKind).toBe('string');
  });

  it('binds a new list for each level of a list of lists', () => {
    const template = templateOf(
      container([
        loop(path('root'), 'outer', [loop(path('outer'), 'inner', [binding(path('inner'))])]),
      ]),
    );
    const result = checkTemplateDataCompatibility(
      template,
      rooted(listOf(listOf({ kind: 'number' }))),
    );
    expect(result.compatible).toBe(true);
    expect(result.reads.map((read) => [read.writtenPath, read.actualKind])).toEqual([
      ['root', 'list'],
      ['outer', 'list'],
      ['inner', 'number'],
    ]);
  });

  it('reads a row group alias inside its rows, its cells and its page report', () => {
    const template = templateOf(
      container([
        rowGroupTable(path('root'), 'item', [binding(path('item.libelle'))], path('item.quantite')),
      ]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.compatible).toBe(true);
    const report = result.reads.find((read) => read.writtenPath === 'item.quantite');
    expect(report?.expectation).toBe('number');
    expect(report?.path).toEqual([
      'root',
      'children',
      0,
      'body',
      0,
      'rows',
      0,
      'pageReport',
      'value',
    ]);
  });

  it('blocks the descendants of an absent source, and names one cause only', () => {
    const template = templateOf(
      container([loop(path('absent'), 'item', [binding(path('item.libelle'))])]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.diagnostics.map((d) => d.dataPath)).toEqual(['absent']);
    expect(result.reads.map((read) => [read.writtenPath, read.status])).toEqual([
      ['absent', 'undeclared'],
      ['item.libelle', 'blocked'],
    ]);
  });

  it('blocks the descendants of a source that is declared but is no list', () => {
    const template = templateOf(
      container([loop(path('root'), 'item', [binding(path('item.libelle'))])]),
    );
    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'number' }));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'incompatible-data-kind',
      dataPath: 'root',
      expectedKinds: ['list'],
      actualKind: 'number',
    });
    expect(result.reads[1]?.status).toBe('blocked');
  });

  it('restores the outer scope once an inner alias of the same name is closed', () => {
    const template = templateOf(
      container([
        loop(path('root'), 'item', [
          loop(path('item.inner'), 'item', [binding(path('item'))]),
          binding(path('item.libelle')),
        ]),
      ]),
    );
    const catalogue = rooted(
      listOf(
        record([
          field('libelle', 'Libellé', { kind: 'string' }),
          field('inner', 'Interne', listOf({ kind: 'number' })),
        ]),
      ),
    );
    const result = checkTemplateDataCompatibility(template, catalogue);
    expect(result.compatible).toBe(true);
    expect(result.reads.map((read) => [read.writtenPath, read.actualKind])).toEqual([
      ['root', 'list'],
      ['item.inner', 'list'],
      ['item', 'number'],
      ['item.libelle', 'string'],
    ]);
    expect(result.scopeWarnings.map((warning) => warning.code)).toEqual(['alias-shadows-alias']);
  });

  it('keeps an alias out of a sibling branch', () => {
    const template = templateOf(
      container([
        loop(path('root'), 'item', [binding(path('item.libelle'))]),
        binding(path('item.libelle')),
      ]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.diagnostics.map((d) => d.dataPath)).toEqual(['item.libelle']);
  });

  it('lets no scope of the flow reach a band, nor a band reach the next', () => {
    const template = templateOf(
      container([loop(path('root'), 'item', [binding(path('item.libelle'))])]),
      [band(container([binding(path('item.libelle'))]))],
      [band(container([binding(path('item.libelle'))]))],
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.every((d) => d.code === 'undeclared-data-path')).toBe(true);
  });
});

describe('the scopes an expression opens', () => {
  const rows = listOf(
    record([
      field('libelle', 'Libellé', { kind: 'string' }),
      field('quantite', 'Quantité', { kind: 'number' }),
    ]),
  );

  const kept: Expression = {
    kind: 'filter',
    source: path('root'),
    as: 'kept',
    where: {
      kind: 'compare',
      op: 'gt',
      left: path('kept.quantite'),
      right: { kind: 'literal', value: 0 },
    },
  };

  it('binds the filter alias inside its predicate', () => {
    const result = checkBinding({ kind: 'count', source: kept }, rooted(rows));
    expect(result.compatible).toBe(true);
    expect(result.reads.map((read) => read.writtenPath)).toEqual(['root', 'kept.quantite']);
  });

  it('binds the aggregation alias inside its value', () => {
    const total: PrintableExpression = {
      kind: 'aggregate',
      op: 'sum',
      source: path('root'),
      as: 'each',
      value: path('each.quantite'),
    };
    const result = checkBinding(total, rooted(rows));
    expect(result.compatible).toBe(true);
    expect(result.reads[1]).toMatchObject({
      writtenPath: 'each.quantite',
      expectation: 'number',
      status: 'available',
      cataloguePath: ['root', 'quantite'],
    });
  });

  it('keeps the list type of a filter, so a loop can still bind its element', () => {
    const template = templateOf(container([loop(kept, 'item', [binding(path('item.libelle'))])]));
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.compatible).toBe(true);
    expect(result.reads.at(-1)).toMatchObject({
      writtenPath: 'item.libelle',
      status: 'available',
      cataloguePath: ['root', 'libelle'],
    });
  });

  it('requires a number of the aggregated member', () => {
    const total: PrintableExpression = {
      kind: 'aggregate',
      op: 'sum',
      source: path('root'),
      as: 'each',
      value: path('each.libelle'),
    };
    const result = checkBinding(total, rooted(rows));
    expect(result.diagnostics[0]).toMatchObject({
      code: 'incompatible-data-kind',
      dataPath: 'each.libelle',
      actualKind: 'string',
      expectedKinds: ['number'],
    });
  });

  it('blocks the predicate of a broken source without cascading', () => {
    const broken: Expression = {
      kind: 'filter',
      source: path('absent'),
      as: 'kept',
      where: { kind: 'isEmpty', operand: path('kept.quantite') },
    };
    const result = checkBinding({ kind: 'count', source: broken }, rooted(rows));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.reads.map((read) => read.status)).toEqual(['undeclared', 'blocked']);
  });

  it('keeps an expression alias out of a sibling expression', () => {
    const concat: PrintableExpression = {
      kind: 'concat',
      parts: [{ kind: 'text', value: { kind: 'count', source: kept } }, path('kept.libelle')],
    };
    const result = checkBinding(concat, rooted(rows));
    expect(result.diagnostics.map((d) => d.dataPath)).toEqual(['kept.libelle']);
  });
});

describe('the expectation each position imposes', () => {
  /** Analyses one path under one operand position, and answers the status it received. */
  function statusIn(expression: PrintableExpression, type: DataType): DataReadStatus | undefined {
    return checkBinding(expression, rooted(type)).reads.at(-1)?.status;
  }

  const arithmetic = (operand: PrintableExpression): PrintableExpression => ({
    kind: 'arithmetic',
    op: 'add',
    left: { kind: 'literal', value: 1 },
    right: operand,
  });

  it.each([
    ['number', 'available'],
    ['string', 'incompatible'],
  ] as const)('reads a %s in an arithmetic operand as %s', (kind, status) => {
    expect(statusIn(arithmetic(path('root')), { kind })).toBe(status);
  });

  it.each([
    ['string', 'available'],
    ['civil-date', 'available'],
    ['number', 'incompatible'],
  ] as const)('reads a %s in a text operand as %s', (kind, status) => {
    const folded: PrintableExpression = { kind: 'textCase', op: 'upper', text: path('root') };
    expect(statusIn(folded, { kind })).toBe(status);
  });

  it.each([
    ['civil-date', 'available'],
    ['string', 'incompatible'],
  ] as const)('reads a %s in a date operand as %s', (kind, status) => {
    const shifted: PrintableExpression = {
      kind: 'dateAdd',
      date: path('root'),
      days: { kind: 'literal', value: 1 },
    };
    expect(statusIn(shifted, { kind })).toBe(status);
  });

  it('requires a number of the day count of a date shift', () => {
    const shifted: PrintableExpression = {
      kind: 'dateAdd',
      date: { kind: 'literal', value: '2026-01-01' },
      days: path('root'),
    };
    expect(statusIn(shifted, { kind: 'string' })).toBe('incompatible');
    expect(statusIn(shifted, { kind: 'number' })).toBe('available');
  });

  it.each([
    ['boolean', true],
    ['string', false],
  ] as const)('reads a %s in a condition as compatible: %s', (kind, ok) => {
    const template = templateOf(container([condition(path('root'), [staticText()])]));
    expect(checkTemplateDataCompatibility(template, rooted({ kind })).compatible).toBe(ok);
  });

  it('requires a boolean of a filter predicate', () => {
    const filtered: Expression = {
      kind: 'filter',
      source: path('root'),
      as: 'kept',
      where: path('kept'),
    };
    const result = checkBinding(
      { kind: 'count', source: filtered },
      rooted(listOf({ kind: 'string' })),
    );
    expect(result.diagnostics[0]).toMatchObject({
      code: 'incompatible-data-kind',
      dataPath: 'kept',
      expectedKinds: ['boolean'],
    });
  });

  it.each(['object', 'list'] as const)('refuses a %s in a primitive comparison', (kind) => {
    const type: DataType = kind === 'object' ? record([]) : listOf({ kind: 'string' });
    const compared: Expression = {
      kind: 'compare',
      op: 'eq',
      left: path('root'),
      right: { kind: 'literal', value: 1 },
    };
    const template = templateOf(container([condition(compared, [staticText()])]));
    expect(checkTemplateDataCompatibility(template, rooted(type)).compatible).toBe(false);
  });

  it.each([
    ['number', true],
    ['string', true],
    ['boolean', false],
  ] as const)('orders a %s: %s', (kind, ok) => {
    const ordered: Expression = {
      kind: 'compare',
      op: 'lt',
      left: path('root'),
      right: { kind: 'literal', value: 1 },
    };
    const template = templateOf(container([condition(ordered, [staticText()])]));
    expect(checkTemplateDataCompatibility(template, rooted({ kind })).compatible).toBe(ok);
  });

  it.each(['string', 'number', 'boolean', 'civil-date'] as const)(
    'accepts a %s under isEmpty',
    (kind) => {
      const empty: Expression = { kind: 'isEmpty', operand: path('root') };
      const template = templateOf(container([condition(empty, [staticText()])]));
      const result = checkTemplateDataCompatibility(template, rooted({ kind }));
      expect(result.compatible).toBe(true);
      expect(result.reads[0]?.expectation).toBe<DataExpectation>('any');
    },
  );

  it.each(['object', 'list'] as const)('accepts a %s under isEmpty too', (kind) => {
    const type: DataType = kind === 'object' ? record([]) : listOf({ kind: 'string' });
    const empty: Expression = { kind: 'isEmpty', operand: path('root') };
    const template = templateOf(container([condition(empty, [staticText()])]));
    expect(checkTemplateDataCompatibility(template, rooted(type)).compatible).toBe(true);
  });

  it('passes the inherited expectation down both branches of a conditional', () => {
    const chosen: PrintableExpression = {
      kind: 'if',
      when: { kind: 'literal', value: true },
      whenTrue: path('root'),
      whenFalse: path('root'),
    };
    const result = checkBinding(arithmetic(chosen), rooted({ kind: 'string' }));
    expect(result.reads.map((read) => read.expectation)).toEqual(['number', 'number']);
    expect(result.diagnostics).toHaveLength(2);
  });

  it('walks every remaining operand position without inventing a reading', () => {
    const everywhere: PrintableExpression = {
      kind: 'concat',
      parts: [
        { kind: 'text', value: path('root.text') },
        {
          kind: 'text',
          value: { kind: 'percentOf', base: path('root.num'), rate: path('root.num') },
        },
        {
          kind: 'text',
          value: { kind: 'round', value: path('root.num'), decimals: 2, mode: 'halfExpand' },
        },
        {
          kind: 'text',
          value: {
            kind: 'dateDiff',
            from: path('root.day'),
            to: path('root.day'),
          },
        },
        { kind: 'text', value: { kind: 'endOfMonth', date: path('root.day') } },
        { kind: 'literal', value: 'x' },
      ],
    };
    const catalogue = rooted(
      record([
        field('text', 'Texte', { kind: 'string' }),
        field('num', 'Nombre', { kind: 'number' }),
        field('day', 'Jour', { kind: 'civil-date' }),
      ]),
    );
    const result = checkBinding(everywhere, catalogue);
    expect(result.compatible).toBe(true);
    expect(result.reads.map((read) => read.expectation)).toEqual([
      'printable',
      'number',
      'number',
      'number',
      'civil-date',
      'civil-date',
      'civil-date',
    ]);
  });

  it('walks the logical operands and the negation', () => {
    const both: Expression = {
      kind: 'logical',
      op: 'and',
      operands: [path('root'), { kind: 'not', operand: path('root') }],
    };
    const template = templateOf(container([condition(both, [staticText()])]));
    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'boolean' }));
    expect(result.compatible).toBe(true);
    expect(result.reads.map((read) => read.path)).toEqual([
      ['root', 'children', 0, 'when', 'operands', 0],
      ['root', 'children', 0, 'when', 'operands', 1, 'operand'],
    ]);
  });
});

describe('the expectation a declared writing imposes', () => {
  /** The status one path receives at a site declaring one writing, under one declared nature. */
  function statusAtSite(format: PresentationFormat, kind: DataScalarKind): DataReadStatus {
    const template = templateOf(container([writtenBinding(path('root'), format)]));
    const read = checkTemplateDataCompatibility(template, rooted({ kind })).reads[0];
    if (read === undefined) {
      throw new Error('a written site should record its reading');
    }
    return read.status;
  }

  it('keeps a site that declares none on the printable expectation', () => {
    // The half of "purely additive" that matters to a host: a model that asked for nothing goes on
    // asking for nothing, so a catalogue accepted before this contract is accepted after it.
    expect(statusOfBinding('root', { kind: 'number' })).toBe('available');
    expect(statusOfBinding('root', { kind: 'string' })).toBe('available');
    expect(statusOfBinding('root', { kind: 'civil-date' })).toBe('available');
  });

  it.each([
    ['money', 'amount'],
    ['decimal', 'quantity'],
  ] as const)(
    'requires a number of a %s site, and reports the reading it names',
    (kind, profile) => {
      const format: PresentationFormat = { kind, profile };
      expect(statusAtSite(format, 'number')).toBe('available');
      expect(statusAtSite(format, 'string')).toBe('incompatible');
      expect(statusAtSite(format, 'civil-date')).toBe('incompatible');
    },
  );

  it('requires a civil date of a date site, and refuses a text that looks like one', () => {
    const format: PresentationFormat = { kind: 'date', profile: 'issued' };
    expect(statusAtSite(format, 'civil-date')).toBe('available');
    expect(statusAtSite(format, 'string')).toBe('incompatible');
    expect(statusAtSite(format, 'number')).toBe('incompatible');
  });

  it('names the accepted natures and the declared one on the refusal it raises', () => {
    const template = templateOf(
      container([writtenBinding(path('root'), { kind: 'money', profile: 'amount' })]),
    );

    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'string' }));

    expect(result.compatible).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      source: 'data-compatibility',
      code: 'incompatible-data-kind',
      dataPath: 'root',
      actualKind: 'string',
      expectedKinds: ['number'],
    });
  });

  it('declares no path for the profile it was given', () => {
    // A profile is a name the model author owns and the caller maps at render time. A host reading
    // this analysis must never be told to declare a field called `amount`.
    const template = templateOf(
      container([writtenBinding(path('root'), { kind: 'money', profile: 'amount' })]),
    );

    const result = checkTemplateDataCompatibility(template, rooted({ kind: 'number' }));

    expect(result.reads.map((read) => read.writtenPath)).toStrictEqual(['root']);
  });
});

describe('an alias that masks a name', () => {
  const rows = listOf(record([field('libelle', 'Libellé', { kind: 'string' })]));

  it('warns once at the declaration when it masks a catalogue root', () => {
    const template = templateOf(
      container([
        loop(path('root'), 'root', [binding(path('root.libelle')), binding(path('root.libelle'))]),
      ]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.scopeWarnings).toEqual([
      {
        code: 'alias-shadows-catalogue-root',
        alias: 'root',
        message: expect.any(String),
        path: ['root', 'children', 0, 'as'],
        nodeId: expect.stringContaining('loop'),
      },
    ]);
  });

  it('never turns a masking into a refusal', () => {
    const template = templateOf(
      container([loop(path('root'), 'root', [binding(path('root.libelle'))])]),
    );
    const result = checkTemplateDataCompatibility(template, rooted(rows));
    expect(result.compatible).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('warns at an expression alias masking a catalogue root', () => {
    const filtered: Expression = {
      kind: 'filter',
      source: path('root'),
      as: 'root',
      where: { kind: 'isEmpty', operand: path('root.libelle') },
    };
    const result = checkBinding({ kind: 'count', source: filtered }, rooted(rows));
    expect(result.scopeWarnings.map((warning) => [warning.code, warning.path])).toEqual([
      [
        'alias-shadows-catalogue-root',
        ['root', 'children', 0, 'content', 0, 'value', 'source', 'as'],
      ],
    ]);
  });
});

describe('what the analysis never does', () => {
  it('needs no dataset to be called, and its result carries none', () => {
    const result = checkBinding(path('root'), rooted({ kind: 'string' }));
    expect(checkTemplateDataCompatibility).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('undefined-value');
  });

  it('writes one constant refusal, whatever the path and the catalogue', () => {
    const first = checkBinding(path('alpha'), rooted({ kind: 'string' }));
    const second = checkBinding(path('zulu.deeper'), { fields: [] });
    expect(first.diagnostics[0]?.message).toBe(second.diagnostics[0]?.message);
    expect(first.diagnostics[0]?.message).not.toContain('alpha');
    expect(second.diagnostics[0]?.message).not.toContain('zulu');
  });

  it('resolves the first of two sibling keys a caller built without parsing', () => {
    // The schema refuses this catalogue, so only a hand-built value reaches here. It still gets a
    // defined answer rather than a silent last-one-wins.
    const unparsed: DataCatalogue = {
      fields: [
        field('root', 'Premier', { kind: 'string' }),
        field('root', 'Second', { kind: 'number' }),
      ],
    };
    const result = checkBinding(path('root'), unparsed);
    expect(result.reads[0]).toMatchObject({ labels: ['Premier'], actualKind: 'string' });
  });

  it('keeps the offending path in its own field and out of the sentence', () => {
    const result = checkBinding(path('secret'), EMPTY);
    expect(result.diagnostics[0]?.dataPath).toBe('secret');
    expect(result.diagnostics[0]?.message).not.toContain('secret');
  });
});
