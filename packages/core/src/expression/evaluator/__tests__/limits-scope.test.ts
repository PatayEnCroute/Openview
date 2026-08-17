import { describe, expect, it } from 'vitest';
import { findNodeById } from '../../../ast/visitor.js';
import {
  EXPRESSION_ERROR_CODES,
  type ExpressionErrorCode,
  type ExpressionErrorDetails,
  ExpressionEvaluationError,
  LIMIT_ERROR_CODES,
  OPERAND_ERROR_CODES,
  prefixPath,
} from '../../../errors.js';
import { parseTemplate } from '../../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../../template/template.js';
import { createBudget, DEFAULT_EVALUATION_LIMITS } from '../../limits.js';
import type {
  ArithmeticExpression,
  ArithmeticOperator,
  Expression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
} from '../../types.js';
import { evaluateExpression, evaluatePredicate, evaluateSequence } from '../evaluate.js';
import { childScope } from '../scope.js';

const scope = {
  invoice: {
    total: 0,
    label: 'ACME',
    paid: false,
    notes: '',
    lines: [{ sku: 'A' }, { sku: 'B' }],
    customer: { name: 'Ada' },
  },
};

const numeric = {
  broken: { nan: Number.NaN },
};

const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): LiteralExpression => ({
  kind: 'literal',
  value,
});
const arithmetic = (
  op: ArithmeticOperator,
  left: PrintableExpression,
  right: PrintableExpression,
): ArithmeticExpression => ({ kind: 'arithmetic', op, left, right });

function expectEvaluationError(run: () => unknown): ExpressionErrorDetails {
  try {
    run();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      return error.details;
    }
    throw error;
  }
  return expect.unreachable('the expression should have failed');
}

/** A chain of `levels` nested `not` nodes -- built in a loop, so it passes no guard. */
function nestedNot(levels: number): Expression {
  let built: Expression = literal(true);
  for (let remaining = 0; remaining < levels; remaining += 1) {
    built = { kind: 'not', operand: built };
  }
  return built;
}

const PRODUCED_CODES: Readonly<Record<ExpressionErrorCode, () => unknown>> = {
  'not-comparable': () =>
    evaluateExpression(
      { kind: 'compare', op: 'eq', left: path('invoice.lines'), right: path('invoice.lines') },
      scope,
    ),
  'not-orderable': () =>
    evaluateExpression(
      { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
      scope,
    ),
  'not-a-boolean': () => evaluatePredicate(path('invoice.total'), scope),
  'not-a-list': () => evaluateSequence(path('invoice.total'), scope),
  'step-limit-exceeded': () =>
    evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxSteps: 4 }) }),
  'depth-limit-exceeded': () =>
    evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxDepth: 4 }) }),
  'item-limit-exceeded': () =>
    evaluateSequence(path('invoice.lines'), scope, {
      budget: createBudget({ maxItemsVisited: 1 }),
    }),
  'operand-type': () =>
    evaluateExpression(arithmetic('add', path('invoice.label'), literal(1)), scope),
  'not-finite': () =>
    evaluateExpression(arithmetic('add', path('broken.nan'), literal(1)), numeric),
  'division-by-zero': () => evaluateExpression(arithmetic('div', literal(1), literal(0)), scope),
  'not-a-date': () =>
    evaluateExpression({ kind: 'endOfMonth', date: literal('not a date') }, scope),
  'not-a-whole-number': () =>
    evaluateExpression({ kind: 'dateAdd', date: literal('2026-01-31'), days: literal(1.5) }, scope),
  'string-limit-exceeded': () =>
    evaluateExpression({ kind: 'concat', parts: [literal('abcd'), literal('efgh')] }, scope, {
      budget: createBudget({ maxStringLength: 4 }),
    }),
};

describe('expression error payload', () => {
  it('produces every code the catalogue declares, and no other', () => {
    expect(Object.keys(PRODUCED_CODES).sort()).toStrictEqual([...EXPRESSION_ERROR_CODES].sort());
  });

  it.each(Object.entries(PRODUCED_CODES))('produces %s from a real evaluation', (code, run) => {
    expect(expectEvaluationError(run).code).toBe(code);
  });

  it('keeps the two catalogues disjoint and their union whole', () => {
    const operand: readonly string[] = OPERAND_ERROR_CODES;
    const limit: readonly string[] = LIMIT_ERROR_CODES;

    expect(operand.filter((code) => limit.includes(code))).toStrictEqual([]);
    expect(EXPRESSION_ERROR_CODES).toHaveLength(operand.length + limit.length);
  });

  it('names the culprit operand of an incomparable pair', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'eq', left: path('invoice.lines'), right: literal('x') },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-comparable',
      site: 'compare',
      at: ['left'],
      actualType: 'list',
    });

    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'neq', left: literal('x'), right: path('invoice.lines') },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-comparable',
      site: 'compare',
      at: ['right'],
      actualType: 'list',
    });
  });

  it('anchors an unorderable pair on the left operand', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-orderable',
      site: 'compare',
      at: ['left'],
      actualType: 'string',
    });
  });

  it('reports the site of a predicate position that is not an expression', () => {
    expect(
      expectEvaluationError(() => evaluatePredicate(path('invoice.total'), scope)),
    ).toStrictEqual({ code: 'not-a-boolean', site: 'condition', at: [], actualType: 'number' });

    expect(
      expectEvaluationError(() =>
        evaluateSequence(path('invoice.total'), scope, { caller: 'loop' }),
      ),
    ).toStrictEqual({ code: 'not-a-list', site: 'loop', at: [], actualType: 'number' });
  });

  it('names a TABLE BODY, and not "an expression", when its list source is not a list', () => {
    // Le détail ci-dessus n'épingle pas le MESSAGE, et c'est le message que le libellé change.
    // `LIST_CALLER_SUBJECTS` est un `Partial` : ajouter le site sans le libellé ne casse rien,
    // ni à la compilation ni au lint, et la chaîne retombe silencieusement sur « An
    // expression » -- dit à un auteur qui n'a écrit aucune expression, mais un tableau.
    // L'assertion porte donc sur la chaîne ENTIÈRE, faute de quoi elle resterait verte le jour
    // où le libellé disparaît.
    expect(() =>
      evaluateSequence(path('invoice.total'), scope, { caller: 'tableRowGroup' }),
    ).toThrow('A table body needs a list to iterate over, got a number.');

    // Le contrôle croisé est gratuit et vaut d'être écrit à côté : deux sites, deux sujets.
    expect(() => evaluateSequence(path('invoice.total'), scope, { caller: 'loop' })).toThrow(
      'A loop needs a list to iterate over, got a number.',
    );
  });

  it('adds no error code: C3 widens a SITE, never a catalogue', () => {
    // Le meilleur résultat qu'un lot puisse offrir à C8. Rien n'interdit mécaniquement
    // d'ajouter une entrée à l'un des trois catalogues ; c'est le test de complétude
    // ci-dessus qui rougirait, et seulement pour un code effectivement produit.
    const operand: readonly string[] = OPERAND_ERROR_CODES;
    const limit: readonly string[] = LIMIT_ERROR_CODES;

    expect(EXPRESSION_ERROR_CODES).toHaveLength(operand.length + limit.length);
  });

  it('points at the operand index of a logical, as a number and not a string', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          { kind: 'logical', op: 'and', operands: [literal(true), path('invoice.total')] },
          scope,
        ),
      ),
    ).toStrictEqual({
      code: 'not-a-boolean',
      site: 'logical',
      at: ['operands', 1],
      actualType: 'number',
    });
  });

  it('points at the operand of a not', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression({ kind: 'not', operand: path('invoice.total') }, scope),
      ),
    ).toStrictEqual({
      code: 'not-a-boolean',
      site: 'not',
      at: ['operand'],
      actualType: 'number',
    });
  });

  it('builds the path from the root, and root-to-leaf', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          {
            kind: 'logical',
            op: 'and',
            operands: [
              literal(true),
              { kind: 'compare', op: 'gt', left: path('invoice.label'), right: literal(1) },
            ],
          },
          scope,
        ),
      ).at,
    ).toStrictEqual(['operands', 1, 'left']);
  });

  it('reaches inside an isEmpty operand as well', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(
          {
            kind: 'isEmpty',
            operand: { kind: 'compare', op: 'lt', left: literal(true), right: literal(false) },
          },
          scope,
        ),
      ).at,
    ).toStrictEqual(['operand', 'left']);
  });

  it('hands out the same path on every read, and a copy that a later prefix cannot touch', () => {
    let caught: ExpressionEvaluationError | undefined;
    try {
      evaluateExpression({ kind: 'not', operand: path('invoice.total') }, scope);
    } catch (error) {
      if (!(error instanceof ExpressionEvaluationError)) {
        throw error;
      }
      caught = error;
    }
    if (caught === undefined) {
      throw new Error('the expression should have failed');
    }

    const first = caught.details.at;
    expect(caught.details.at).toStrictEqual(first);

    caught[prefixPath]('value');
    expect(first).toStrictEqual(['operand']);
    expect(caught.details.at).toStrictEqual(['value', 'operand']);
  });

  it('lets a foreign error through the descent untouched', () => {
    const smuggled: Expression = JSON.parse('{"kind":"regex"}');

    expect(() => evaluateExpression({ kind: 'not', operand: smuggled }, scope)).toThrow(TypeError);
  });

  it('carries the configured ceiling on a bound failure, not a shape', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(nestedNot(10), scope, { budget: createBudget({ maxSteps: 4 }) }),
      ),
    ).toStrictEqual({
      code: 'step-limit-exceeded',
      site: 'not',
      at: ['operand', 'operand', 'operand', 'operand'],
      limit: 4,
    });
  });

  it('carries a hand-built deep tree as depth-limit-exceeded, not a RangeError', () => {
    const details = expectEvaluationError(() =>
      evaluateExpression(nestedNot(200), scope, { budget: createBudget({ maxDepth: 8 }) }),
    );

    expect(details.code).toBe('depth-limit-exceeded');
    if (details.code === 'depth-limit-exceeded') {
      expect(details.limit).toBe(8);
    }
  });

  it('accumulates one budget across two top-level calls', () => {
    const budget = createBudget({ maxSteps: 6 });

    expect(evaluateExpression(nestedNot(3), scope, { budget })).toBe(false);
    expect(budget.spent.steps).toBe(4);
    expect(() => evaluateExpression(nestedNot(3), scope, { budget })).toThrow(
      /more than 6 operations/,
    );
  });

  it('bounds a call that was given no budget at all', () => {
    expect(() =>
      evaluateExpression(nestedNot(DEFAULT_EVALUATION_LIMITS.maxDepth + 5), scope),
    ).toThrow(/nests more than 64 levels/);
  });

  it('counts the root node too', () => {
    const budget = createBudget();
    evaluateExpression(literal(1), scope, { budget });

    expect(budget.spent.steps).toBe(1);
    expect(budget.spent.depth).toBe(0);
  });

  it('reports the traversal ceiling from the list primitive', () => {
    expect(
      expectEvaluationError(() =>
        evaluateSequence(path('invoice.lines'), scope, {
          budget: createBudget({ maxItemsVisited: 1 }),
        }),
      ),
    ).toStrictEqual({
      code: 'item-limit-exceeded',
      site: 'loop',
      at: [],
      limit: 1,
    });
  });

  it('carries a ceiling rather than a shape on the bound branch', () => {
    const error = new ExpressionEvaluationError('bounded', {
      code: 'step-limit-exceeded',
      site: 'logical',
      at: ['operands', 0],
      limit: 5,
    });

    const details = error.details;
    expect(details.code).toBe('step-limit-exceeded');
    if (details.code === 'step-limit-exceeded') {
      expect(details.limit).toBe(5);
    }
    expect(details.at).toStrictEqual(['operands', 0]);
  });
});

describe('scope reading', () => {
  it('ignores inherited properties, so a path cannot reach Object.prototype', () => {
    expect(evaluateExpression(path('invoice.toString'), scope)).toBeUndefined();
    expect(evaluateExpression(path('invoice.hasOwnProperty'), scope)).toBeUndefined();
  });

  it('ignores a non-enumerable own property, which childScope cannot copy', () => {
    const hidden: Record<string, unknown> = { invoice: { total: 1 } };
    Object.defineProperty(hidden, 'company', { value: { name: 'ACME' } });

    expect(evaluateExpression(path('company.name'), hidden)).toBeUndefined();
    expect(
      evaluateExpression(path('company.name'), childScope(hidden, 'line', {})),
    ).toBeUndefined();
  });

  it('honours a getter declared as an own enumerable property', () => {
    const withGetter = {
      get today(): string {
        return '2026-08-12';
      },
    };

    expect(evaluateExpression(path('today'), withGetter)).toBe('2026-08-12');
    expect(evaluateExpression(path('today'), childScope(withGetter, 'line', {}))).toBe(
      '2026-08-12',
    );
  });
});

describe('childScope', () => {
  it('binds the current item under the alias, keeping the enclosing data reachable', () => {
    const lines = evaluateSequence(path('invoice.lines'), scope);
    const first = childScope(scope, 'line', lines[0]);

    expect(evaluateExpression(path('line.sku'), first)).toBe('A');
    expect(evaluateExpression(path('invoice.label'), first)).toBe('ACME');
  });

  it('lets the innermost loop shadow an outer alias', () => {
    const outer = childScope(scope, 'row', { sku: 'outer' });
    const inner = childScope(outer, 'row', { sku: 'inner' });

    expect(evaluateExpression(path('row.sku'), inner)).toBe('inner');
    expect(evaluateExpression(path('row.sku'), outer)).toBe('outer');
  });

  it('leaves the parent scope untouched', () => {
    childScope(scope, 'line', { sku: 'X' });
    expect(evaluateExpression(path('line.sku'), scope)).toBeUndefined();
  });

  it('reads a primitive item through the alias alone', () => {
    expect(evaluateExpression(path('tag'), childScope({}, 'tag', 'urgent'))).toBe('urgent');
  });

  it('drives a parsed template loop, with no alias invented by the caller', () => {
    const template = parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'tpl_1',
      name: 'Invoice',
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lines',
            each: { kind: 'path', path: 'invoice.lines' },
            as: 'line',
            children: [
              {
                type: 'condition',
                id: 'discounted',
                when: {
                  kind: 'compare',
                  op: 'gt',
                  left: { kind: 'path', path: 'line.discount' },
                  right: { kind: 'literal', value: 0 },
                },
                children: [],
              },
            ],
          },
        ],
      },
    });

    const loop = findNodeById(template.root, 'lines');
    const condition = findNodeById(template.root, 'discounted');
    if (loop?.type !== 'loop' || condition?.type !== 'condition') {
      throw new Error('the parsed template lost its loop or its condition');
    }

    const data = { invoice: { lines: [{ discount: 0 }, { discount: 15 }] } };
    const applied = evaluateSequence(loop.each, data).map((item) =>
      evaluatePredicate(condition.when, childScope(data, loop.as, item)),
    );

    expect(applied).toStrictEqual([false, true]);
  });
});
