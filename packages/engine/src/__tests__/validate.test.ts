import { CURRENT_SCHEMA_VERSION } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../errors.js';
import { validateTemplate } from '../pipeline/validate.js';
import { storedTemplate } from './fixtures.js';

/** Refuses and returns the refusal, so a test can read its code and details. */
function refusalFrom(
  raw: unknown,
  shapeLimits?: { readonly maxNodes: number },
): DocumentRenderError {
  try {
    validateTemplate(raw, shapeLimits);
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the payload was accepted');
}

describe('validateTemplate', () => {
  it('accepts a document already at the current version', () => {
    expect(validateTemplate(storedTemplate()).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a genuinely historic document and keeps its content', () => {
    const migrated = validateTemplate({
      schemaVersion: 1,
      id: 'tpl_v1',
      name: 'Historic',
      root: {
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 'hello', content: [{ kind: 'literal', text: 'kept' }] }],
      },
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.root.children).toHaveLength(1);
    /* The 4 -> 5 migration supplies the compatibility sheet: the engine decides no format. */
    expect(migrated.page.sheet).toStrictEqual({ width: 210, height: 297 });
  });

  it('refuses a document written by a newer release, with a migration diagnostic', () => {
    const refused = refusalFrom(storedTemplate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));
    expect(refused.code).toBe('template-refused');
    expect(refused.details.diagnostics).toStrictEqual([
      expect.objectContaining({ source: 'template-migration', code: 'newer-schema-version' }),
    ]);
  });

  it('refuses an invalid field with a validation diagnostic per issue', () => {
    const refused = refusalFrom(storedTemplate({ id: '' }));
    expect(refused.code).toBe('template-refused');
    expect(refused.details.diagnostics?.[0]?.source).toBe('template-validation');
    expect(refused.details.diagnostics?.[0]?.path).toStrictEqual(['id']);
  });

  it('applies the shape guard before any recursion of the engine', () => {
    const refused = refusalFrom(storedTemplate(), { maxNodes: 3 });
    expect(refused.details.diagnostics).toStrictEqual([
      expect.objectContaining({ source: 'template-shape', code: 'too-many-nodes', limit: 3 }),
    ]);
  });

  it('names no template content in its message', () => {
    const refused = refusalFrom(storedTemplate({ id: '', name: 'Secret customer name' }));
    expect(refused.message).not.toContain('Secret customer name');
  });
});
