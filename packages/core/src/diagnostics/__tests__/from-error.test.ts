import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  createBudget,
  diagnosticsOf,
  migrateToCurrent,
  type OpenviewDiagnostic,
  OpenviewError,
  parseTemplate,
  resolveEvaluationLimits,
  resolveShapeLimits,
  TEMPLATE_MIGRATION_ERROR_CODES,
  type TemplateMigration,
  type TemplateMigrationErrorCode,
} from '../../index.js';

/** The consumer pattern of D3, spelled once: an unrecognised error is rethrown, never renamed. */
function diagnose(act: () => unknown): readonly OpenviewDiagnostic[] {
  try {
    act();
  } catch (error) {
    const diagnostics = diagnosticsOf(error);
    if (diagnostics === undefined) {
      throw error;
    }
    return diagnostics;
  }
  throw new Error('This call was expected to be refused.');
}

function only(act: () => unknown): OpenviewDiagnostic {
  const diagnostics = diagnose(act);
  const [first] = diagnostics;
  if (first === undefined || diagnostics.length !== 1) {
    throw new Error(`Expected exactly one diagnostic, got ${diagnostics.length}.`);
  }
  return first;
}

const validPage = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

function stored(schemaVersion: unknown, extra: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion,
    id: 'invoice',
    name: 'Invoice',
    version: '1.0.0',
    page: validPage,
    root: { type: 'container', id: 'root', children: [] },
    ...extra,
  };
}

describe('diagnosticsOf on a migration refusal', () => {
  it('names a non-object input', () => {
    const diagnostic = only(() => migrateToCurrent('not a template'));
    expect(diagnostic).toEqual({
      source: 'template-migration',
      code: 'invalid-template',
      message: 'This is not a stored template object. Openview can only open a template.',
      path: [],
      nodeId: undefined,
      fromVersion: undefined,
    });
  });

  it.each([undefined, 'seven', 1.5, -1])(
    'names a stamp that is not usable, given %p',
    (version) => {
      const diagnostic = only(() => migrateToCurrent(stored(version)));
      expect(diagnostic.code).toBe('missing-schema-version');
      expect(diagnostic.source).toBe('template-migration');
      if (diagnostic.source === 'template-migration') {
        expect(diagnostic.fromVersion).toBeUndefined();
      }
    },
  );

  it('asks for an upgrade of Openview, not of the template, one version ahead', () => {
    const diagnostic = only(() => migrateToCurrent(stored(CURRENT_SCHEMA_VERSION + 1)));
    expect(diagnostic).toEqual({
      source: 'template-migration',
      code: 'newer-schema-version',
      message:
        'This template was created by a newer Openview schema version. Upgrade Openview before opening it.',
      path: [],
      nodeId: undefined,
      fromVersion: CURRENT_SCHEMA_VERSION + 1,
    });
  });

  it('names a broken upgrade chain', () => {
    const diagnostic = only(() => migrateToCurrent(stored(1), []));
    expect(diagnostic.code).toBe('missing-migration');
    expect(diagnostic.message).toBe(
      'This build has no upgrade step for the schema version this template declares. Its upgrade chain is incomplete.',
    );
    if (diagnostic.source === 'template-migration') {
      expect(diagnostic.fromVersion).toBe(1);
    }
  });

  it.each([
    [
      'loses the stamp',
      (input: Record<string, unknown>) => ({ ...input, schemaVersion: undefined }),
    ],
    ['does not advance', (input: Record<string, unknown>) => ({ ...input, schemaVersion: 1 })],
  ])('names an upgrade step that %s', (_label, migrate) => {
    const faulty: readonly TemplateMigration[] = [{ from: 1, to: 2, migrate }];
    const diagnostic = only(() => migrateToCurrent(stored(1), faulty));
    expect(diagnostic.code).toBe('invalid-migration-result');
    expect(diagnostic.message).toBe(
      'An upgrade step left this template without a usable schema version. Its upgrade chain is faulty.',
    );
  });

  it('covers every migration code with a scenario', () => {
    const reached: Readonly<Record<TemplateMigrationErrorCode, () => unknown>> = {
      'invalid-template': () => migrateToCurrent(null),
      'missing-schema-version': () => migrateToCurrent(stored(undefined)),
      'newer-schema-version': () => migrateToCurrent(stored(CURRENT_SCHEMA_VERSION + 1)),
      'missing-migration': () => migrateToCurrent(stored(1), []),
      'invalid-migration-result': () =>
        migrateToCurrent(stored(1), [{ from: 1, to: 2, migrate: (input) => input }]),
    };
    for (const code of TEMPLATE_MIGRATION_ERROR_CODES) {
      expect(only(reached[code]).code).toBe(code);
    }
  });

  it('leaves an arbitrary throw from a migration unknown, so the caller rethrows it', () => {
    const boom = new RangeError('a migration crashed');
    const exploding: readonly TemplateMigration[] = [
      {
        from: 1,
        to: 2,
        migrate: () => {
          throw boom;
        },
      },
    ];
    expect(diagnosticsOf(boom)).toBeUndefined();
    expect(() => diagnose(() => migrateToCurrent(stored(1), exploding))).toThrow(boom);
  });
});

describe('diagnosticsOf on a shape refusal', () => {
  function nested(levels: number): unknown {
    let node: Record<string, unknown> = { type: 'container', id: 'leaf', children: [] };
    for (let level = 0; level < levels; level += 1) {
      node = { type: 'container', id: `c${level}`, children: [node] };
    }
    return stored(CURRENT_SCHEMA_VERSION, { root: node });
  }

  it('names the nesting limit and carries it as a field', () => {
    const diagnostic = only(() => parseTemplate(nested(80)));
    expect(diagnostic).toEqual({
      source: 'template-shape',
      code: 'too-deep',
      message: 'This template exceeds the configured nesting limit. Reduce its nesting.',
      path: [],
      nodeId: undefined,
      limit: 64,
    });
  });

  it('names the value count limit', () => {
    const diagnostic = only(() => parseTemplate(nested(4), undefined, { maxNodes: 3 }));
    expect(diagnostic.code).toBe('too-many-nodes');
    if (diagnostic.source === 'template-shape') {
      expect(diagnostic.limit).toBe(3);
    }
  });

  it('names a value that is not plain data, and carries no limit', () => {
    const payload = { schemaVersion: CURRENT_SCHEMA_VERSION };
    Object.defineProperty(payload, 'root', { get: () => ({}), enumerable: true });
    const diagnostic = only(() => parseTemplate(payload));
    expect(diagnostic.code).toBe('not-plain-data');
    expect(diagnostic.message).toBe(
      'This template must be plain data. Remove the property defined by a getter or a setter.',
    );
    if (diagnostic.source === 'template-shape') {
      expect(diagnostic.limit).toBeUndefined();
    }
  });
});

describe('diagnosticsOf on a configuration refusal', () => {
  it.each([
    ['invalid-evaluation-limits', () => resolveEvaluationLimits({ maxSteps: 0 })],
    ['invalid-shape-limits', () => resolveShapeLimits({ maxDepth: Number.NaN })],
  ])('names %s and addresses the integrator', (code, act) => {
    const diagnostic = only(act);
    expect(diagnostic.source).toBe('configuration');
    expect(diagnostic.code).toBe(code);
    expect(diagnostic.message).toContain('given to Openview are unusable');
    expect(diagnostic.path).toEqual([]);
  });

  it('reaches the evaluation limits through a budget too', () => {
    expect(only(() => createBudget({ maxDepth: -1 })).code).toBe('invalid-evaluation-limits');
  });
});

describe('an error the facade does not know', () => {
  it.each([
    ['a plain Error', new Error('boom')],
    ['a TypeError', new TypeError('boom')],
    ['a bare OpenviewError', new OpenviewError('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
  ])('stays unknown, given %s', (_label, error) => {
    expect(diagnosticsOf(error)).toBeUndefined();
  });

  it('is rethrown unchanged by the consumer pattern', () => {
    const boom = new OpenviewError('a base error is not a family');
    expect(() =>
      diagnose(() => {
        throw boom;
      }),
    ).toThrow(boom);
  });
});
