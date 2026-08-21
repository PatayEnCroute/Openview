import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  CURRENT_SCHEMA_VERSION,
  diagnosticsOf,
  type OpenviewDiagnostic,
  PageSetupSchema,
  TemplateSchema,
} from '../../index.js';

function refuse(schema: z.ZodType, raw: unknown): readonly OpenviewDiagnostic[] {
  const result = schema.safeParse(raw);
  if (result.success) {
    throw new Error('This input was accepted; the schema contract changed.');
  }
  const diagnostics = diagnosticsOf(result.error);
  if (diagnostics === undefined) {
    throw new Error('A validation error was not recognised by the facade.');
  }
  return diagnostics;
}

/** Finds by path because issue order is not part of the contract. */
function at(
  diagnostics: readonly OpenviewDiagnostic[],
  path: readonly (string | number)[],
): OpenviewDiagnostic {
  const found = diagnostics.find((diagnostic) => diagnostic.path.join(' ') === path.join(' '));
  if (found === undefined) {
    throw new Error(`No diagnostic at [${path.join(', ')}].`);
  }
  return found;
}

const validPage = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

function template(root: unknown, page: unknown = validPage): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'invoice',
    name: 'Invoice',
    version: '1.0.0',
    page,
    root,
  };
}

const emptyRoot = { type: 'container', id: 'root', children: [] };

function withSheet(width: unknown, height: unknown = 297): Record<string, unknown> {
  return { ...validPage, sheet: { width, height } };
}

describe('validator message isolation', () => {
  it('ignores a global error map that includes the received value', () => {
    const previous = z.config();
    try {
      z.config({ customError: (issue) => `received=${JSON.stringify(issue.input)}` });
      const diagnostics = refuse(
        TemplateSchema,
        template(emptyRoot, withSheet('sk-live-DONOTLOG')),
      );
      const diagnostic = at(diagnostics, ['page', 'sheet', 'width']);
      expect(diagnostic.message).toBe('This field must be a finite number.');
      expect(JSON.stringify(diagnostic)).not.toContain('DONOTLOG');
    } finally {
      z.config(previous);
    }
  });

  it('keeps diagnostics in English when Zod uses another locale', () => {
    const previous = z.config();
    try {
      z.config(z.locales.fr());
      const [diagnostic] = refuse(z.object({ width: z.number() }), { width: 'wide' });
      expect(diagnostic?.message).toBe('This field must be a finite number.');
    } finally {
      z.config(previous);
    }
  });
});

describe('diagnosticsOf on a validation error', () => {
  it('names the expected type when the field is missing', () => {
    const [diagnostic] = refuse(z.object({ width: z.number() }), {});
    expect(diagnostic).toEqual({
      source: 'template-validation',
      code: 'invalid-type',
      message: 'This field must be a finite number.',
      path: ['width'],
      nodeId: undefined,
      expected: 'number',
    });
  });

  it('names the expected type when the value is of another type', () => {
    const [diagnostic] = refuse(z.object({ name: z.string() }), { name: 4 });
    expect(diagnostic?.message).toBe('This field must be text.');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'asks for a finite number rather than a number, given %p',
    (value) => {
      const diagnostics = refuse(TemplateSchema, template(emptyRoot, withSheet(value)));
      const diagnostic = at(diagnostics, ['page', 'sheet', 'width']);
      expect(diagnostic.code).toBe('invalid-type');
      expect(diagnostic.message).toBe('This field must be a finite number.');
    },
  );

  it('enumerates the declared choices, and never the received value', () => {
    const diagnostics = refuse(
      TemplateSchema,
      template({
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 't1', content: [{ kind: 'pageField' }] }],
      }),
    );
    const diagnostic = at(diagnostics, ['root', 'children', 0, 'content', 0, 'field']);
    expect(diagnostic.code).toBe('invalid-value');
    expect(diagnostic.message).toBe('This field must be one of "number" or "count".');
    if (diagnostic.code === 'invalid-value') {
      expect(diagnostic.acceptedValues).toEqual(['"number"', '"count"']);
    }
  });

  it('keeps the words a schema wrote for a single accepted value', () => {
    const diagnostics = refuse(
      TemplateSchema,
      template({
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 't1', keepTogether: false, content: [] }],
      }),
    );
    const diagnostic = at(diagnostics, ['root', 'children', 0, 'keepTogether']);
    expect(diagnostic.code).toBe('invalid-value');
    expect(diagnostic.message).toBe(
      'This field must be true when present; omit it to allow the block to split.',
    );
  });

  it('derives a single accepted value when the schema wrote nothing', () => {
    const [diagnostic] = refuse(z.object({ flag: z.literal(true) }), { flag: false });
    expect(diagnostic?.message).toBe('This field must be true.');
  });

  it('joins three or more declared choices', () => {
    const [diagnostic] = refuse(z.object({ mode: z.enum(['a', 'b', 'c']) }), { mode: 'd' });
    expect(diagnostic?.message).toBe('This field must be one of "a", "b" or "c".');
  });

  it('quotes only the choices that are text', () => {
    const [diagnostic] = refuse(z.object({ n: z.literal([1, 2]) }), { n: 3 });
    expect(diagnostic?.message).toBe('This field must be one of 1 or 2.');
  });

  it.each([
    ['minimum', 0, 'A sheet is at least'],
    ['maximum', 100_000, 'A sheet is at most'],
  ])('keeps the bound and its unit declared by the schema at the %s', (_label, width, opener) => {
    const diagnostics = refuse(PageSetupSchema, withSheet(width));
    const diagnostic = at(diagnostics, ['sheet', 'width']);
    expect(diagnostic.code).toBe('out-of-range');
    expect(diagnostic.message.startsWith(String(opener))).toBe(true);
  });

  it('keeps the reason a format check wrote', () => {
    const diagnostics = refuse(TemplateSchema, {
      ...template(emptyRoot),
      createdAt: 'yesterday',
    });
    const diagnostic = at(diagnostics, ['createdAt']);
    expect(diagnostic.code).toBe('invalid-format');
    expect(diagnostic.message).toBe('This field must use the datetime format.');
  });

  it('asks for a supported shape when a discriminant is unknown', () => {
    const diagnostics = refuse(
      TemplateSchema,
      template({ type: 'container', id: 'root', children: [{ type: 'spreadsheet', id: 'x' }] }),
    );
    const diagnostic = at(diagnostics, ['root', 'children', 0, 'type']);
    expect(diagnostic.code).toBe('invalid-structure');
    expect(diagnostic.message).toBe(
      'This value matches none of the supported shapes. Check the "type" or "kind" that names it.',
    );
  });

  it('does not invent a discriminant for a plain union', () => {
    const diagnostics = refuse(TemplateSchema, {
      ...template(emptyRoot),
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'text',
            id: 't1',
            content: [{ kind: 'binding', value: { kind: 'literal', value: [] } }],
          },
        ],
      },
    });
    const diagnostic = at(diagnostics, ['root', 'children', 0, 'content', 0, 'value', 'value']);
    expect(diagnostic.code).toBe('invalid-structure');
    expect(diagnostic.message).toBe('This value matches none of the supported forms.');
  });

  it('keeps the sentence a cross-field relation wrote', () => {
    const diagnostics = refuse(PageSetupSchema, {
      ...validPage,
      margins: { top: 20, right: 120, bottom: 20, left: 120 },
    });
    const diagnostic = at(diagnostics, ['margins']);
    expect(diagnostic.code).toBe('invalid-relation');
    expect(diagnostic.message).toBe('Horizontal margins leave no printable width.');
  });

  it('names keys the schema does not define', () => {
    const [diagnostic] = refuse(z.strictObject({ a: z.string() }), { a: 'x', b: 1 });
    expect(diagnostic?.code).toBe('invalid-structure');
    expect(diagnostic?.message).toBe(
      'This object carries keys the schema does not define. Remove them.',
    );
  });

  // Raised rather than provoked through a schema: this Zod release flattens a map key and a set
  // element to a plain type refusal, so no public parse reaches these two codes. They stay mapped
  // because the code union still declares them, and the mapping table is total over that union.
  it('names an unsupported key shape', () => {
    const schema = z.unknown().check((ctx) => {
      ctx.issues.push({
        code: 'invalid_key',
        origin: 'record',
        issues: [],
        input: ctx.value,
        path: ['presentations'],
        message: 'never shown',
      });
    });
    const [diagnostic] = refuse(schema, {});
    expect(diagnostic?.code).toBe('invalid-structure');
    expect(diagnostic?.message).toBe('This object carries a key of an unsupported shape.');
  });

  it('names an unsupported element shape', () => {
    const schema = z.unknown().check((ctx) => {
      ctx.issues.push({
        code: 'invalid_element',
        origin: 'set',
        key: 'unused',
        issues: [],
        input: ctx.value,
        path: ['children'],
        message: 'never shown',
      });
    });
    const [diagnostic] = refuse(schema, {});
    expect(diagnostic?.code).toBe('invalid-structure');
    expect(diagnostic?.message).toBe('This collection carries an element of an unsupported shape.');
  });

  it('names an expected type it has no noun for, without inventing one', () => {
    // The noun table is deliberately partial: a type Openview never declares falls back to the
    // schema's own word for it, which is vocabulary and never input data.
    const [diagnostic] = refuse(z.object({ when: z.date() }), { when: 'today' });
    expect(diagnostic?.code).toBe('invalid-type');
    expect(diagnostic?.message).toBe('This field must be a date.');
    const [exotic] = refuse(z.object({ id: z.bigint() }), { id: 1 });
    expect(exotic?.message).toBe('This field must be a bigint.');
  });

  it('says so when a schema accepts no value at all', () => {
    const schema = z.unknown().check((ctx) => {
      ctx.issues.push({
        code: 'invalid_value',
        values: [],
        input: ctx.value,
        path: ['root'],
        message: 'Invalid input: expected nothing',
      });
    });
    const [diagnostic] = refuse(schema, {});
    expect(diagnostic?.message).toBe('This field accepts no value.');
  });

  it('names a bound that is not a multiple', () => {
    const [diagnostic] = refuse(z.object({ n: z.number().multipleOf(5) }), { n: 7 });
    expect(diagnostic?.code).toBe('out-of-range');
  });

  it('keeps two independent faults as two corrections on two paths', () => {
    const diagnostics = refuse(TemplateSchema, template(emptyRoot, withSheet('wide', 'tall')));
    expect(at(diagnostics, ['page', 'sheet', 'width']).code).toBe('invalid-type');
    expect(at(diagnostics, ['page', 'sheet', 'height']).code).toBe('invalid-type');
    expect(diagnostics).toHaveLength(2);
  });

  it('copies the path so mutating it reaches neither the error nor a later read', () => {
    const result = TemplateSchema.safeParse(template(emptyRoot, withSheet('wide')));
    const error = result.error;
    if (error === undefined) {
      throw new Error('The schema accepted an unusable sheet width.');
    }
    const first = diagnosticsOf(error)?.[0];
    const second = diagnosticsOf(error)?.[0];
    if (first === undefined || second === undefined) {
      throw new Error('The facade did not recognise a validation error.');
    }
    expect(first.path).toEqual(second.path);
    expect(first.path).not.toBe(second.path);
    (first.path as (string | number)[]).push('injected');
    expect(diagnosticsOf(error)?.[0]?.path).toEqual(['page', 'sheet', 'width']);
    expect(error.issues[0]?.path).toEqual(['page', 'sheet', 'width']);
  });

  it('never carries the received value, even when it is a secret', () => {
    const diagnostics = refuse(
      TemplateSchema,
      template(emptyRoot, withSheet('sk-live-7f3a-DONOTLOG')),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('DONOTLOG');
  });

  it('prefixes the path and carries the node id the consumer supplies', () => {
    const result = PageSetupSchema.safeParse(withSheet('wide'));
    const error = result.error;
    if (error === undefined) {
      throw new Error('The schema accepted an unusable sheet width.');
    }
    const [diagnostic] = diagnosticsOf(error, { nodeId: 'page-setup', pathPrefix: ['page'] }) ?? [];
    expect(diagnostic?.path).toEqual(['page', 'sheet', 'width']);
    expect(diagnostic?.nodeId).toBe('page-setup');
  });

  it('refuses to name a location that is not a chain of keys and indices', () => {
    const schema = z.unknown().check((ctx) => {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        path: ['page', Symbol('confidential')],
        message: 'never shown',
      });
    });
    const [diagnostic] = refuse(schema, 'anything');
    expect(diagnostic?.code).toBe('invalid-structure');
    expect(diagnostic?.message).toBe(
      'Openview cannot name the location of this refusal. Report it as a defect.',
    );
    expect(diagnostic?.path).toEqual(['page']);
    expect(JSON.stringify(diagnostic)).not.toContain('confidential');
  });
});
