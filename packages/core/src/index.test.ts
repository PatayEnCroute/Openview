import { describe, expect, it } from 'vitest';
import { parseTemplateSchema } from './index.js';

describe('TemplateSchema & parseTemplateSchema', () => {
  it('should validate a correct template schema', () => {
    const validRaw = {
      id: 'tpl_123',
      name: 'Invoice Template',
      version: '1.0.0',
    };

    const parsed = parseTemplateSchema(validRaw);
    expect(parsed.id).toBe('tpl_123');
    expect(parsed.name).toBe('Invoice Template');
    expect(parsed.version).toBe('1.0.0');
  });

  it('should throw a Zod validation error for invalid template schema', () => {
    const invalidRaw = {
      id: '', // Empty string violates min(1)
      name: 'Invoice Template',
    };

    expect(() => parseTemplateSchema(invalidRaw)).toThrow();
  });
});
