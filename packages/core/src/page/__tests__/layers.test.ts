import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { checkTemplateDataCompatibility } from '../../data-catalogue/compatibility.js';
import { DataCatalogueSchema } from '../../data-catalogue/schemas.js';
import { parseTemplate } from '../../template/migrate.js';
import { collectTemplateDataPaths } from '../../template/paths.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import { PAGE_LAYER_PLANES, type PageLayer, PageLayerSchema, PageSetupSchema } from '../page.js';

/** Both directions, key by key: the idiom every page contract already uses. */
export const PAGE_LAYER_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PageLayerSchema>,
  keyof PageLayer
> = true;

const container = (id: string, children: unknown[] = []): Record<string, unknown> => ({
  type: 'container',
  id,
  children,
});

const layer = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  plane: 'background',
  content: container('paper'),
  ...overrides,
});

const page = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sheet: { width: 210, height: 297 },
  margins: { top: 15, right: 15, bottom: 15, left: 15 },
  header: [],
  footer: [],
  ...overrides,
});

describe('the canonical form of the layer list', () => {
  it('keeps absence as absence: no key is invented on the parsed setup', () => {
    const parsed = PageSetupSchema.parse(page());
    expect(Object.hasOwn(parsed, 'layers')).toBe(false);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(page());
  });

  it('refuses an empty list with the remedy in the message', () => {
    const result = PageSetupSchema.safeParse(page({ layers: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('omit the field');
    }
  });

  it('accepts the two planes and refuses any other word', () => {
    expect(PAGE_LAYER_PLANES).toStrictEqual(['background', 'foreground']);
    for (const plane of PAGE_LAYER_PLANES) {
      expect(PageLayerSchema.safeParse(layer({ plane })).success).toBe(true);
    }
    expect(PageLayerSchema.safeParse(layer({ plane: 'middle' })).success).toBe(false);
    expect(PageLayerSchema.safeParse(layer({ plane: 'watermark' })).success).toBe(false);
  });

  it('accepts an absent or strictly intermediate opacity and refuses the degenerate values', () => {
    expect(PageLayerSchema.safeParse(layer()).success).toBe(true);
    expect(PageLayerSchema.safeParse(layer({ opacity: 0.5 })).success).toBe(true);
    expect(PageLayerSchema.safeParse(layer({ opacity: 0 })).success).toBe(false);
    expect(PageLayerSchema.safeParse(layer({ opacity: 1 })).success).toBe(false);
    expect(PageLayerSchema.safeParse(layer({ opacity: Number.NaN })).success).toBe(false);
    expect(PageLayerSchema.safeParse(layer({ opacity: Number.POSITIVE_INFINITY })).success).toBe(
      false,
    );
    expect(PageLayerSchema.safeParse(layer({ opacity: Number.NEGATIVE_INFINITY })).success).toBe(
      false,
    );
  });

  it('keeps several layers of one plane in their stored order', () => {
    const stored = page({
      layers: [
        layer({ content: container('paper') }),
        layer({ opacity: 0.12, content: container('watermark') }),
        layer({ plane: 'foreground', opacity: 0.85, content: container('stamp') }),
      ],
    });
    const parsed = PageSetupSchema.parse(stored);
    expect(parsed.layers?.map((entry) => entry.content.id)).toStrictEqual([
      'paper',
      'watermark',
      'stamp',
    ]);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(stored);
  });

  it('conserves a layer content of styles, grid, image and dynamic text through parsing', () => {
    const stored = page({
      layers: [
        layer({
          content: container('rich', [
            {
              type: 'grid',
              id: 'layer-grid',
              columns: 3,
              rows: 3,
              step: 90,
              items: [
                {
                  row: 2,
                  column: 2,
                  content: container('centre', [
                    {
                      type: 'text',
                      id: 'duplicata',
                      content: [
                        { kind: 'binding', value: { kind: 'path', path: 'invoice.mention' } },
                      ],
                    },
                  ]),
                },
              ],
            },
            { type: 'image', id: 'seal', src: 'seal.png' },
          ]),
        }),
      ],
    });
    const parsed = PageSetupSchema.parse(stored);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(stored);
  });
});

const template = (layers: unknown[] | undefined): Record<string, unknown> => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl',
  name: 'Layered',
  version: '1.0.0',
  page: layers === undefined ? page() : page({ layers }),
  root: container('root', [
    {
      type: 'text',
      id: 'flow-text',
      content: [{ kind: 'binding', value: { kind: 'path', path: 'invoice.number' } }],
    },
  ]),
});

describe('the readings of a layer', () => {
  const layered = template([
    layer({
      content: container('watermark', [
        {
          type: 'text',
          id: 'mention',
          content: [{ kind: 'binding', value: { kind: 'path', path: 'invoice.mention' } }],
        },
      ]),
    }),
  ]);

  it('appends layer readings after the historic order of the flow and the bands', () => {
    expect(collectTemplateDataPaths(parseTemplate(layered))).toStrictEqual([
      'invoice.number',
      'invoice.mention',
    ]);
  });

  it('locates a layer reading at its stored path for the catalogue', () => {
    const catalogue = DataCatalogueSchema.parse({
      fields: [
        {
          key: 'invoice',
          label: 'Invoice',
          type: {
            kind: 'object',
            fields: [
              { key: 'number', label: 'Number', type: { kind: 'string' } },
              { key: 'mention', label: 'Mention', type: { kind: 'string' } },
            ],
          },
        },
      ],
    });
    const compatibility = checkTemplateDataCompatibility(parseTemplate(layered), catalogue);
    expect(compatibility.compatible).toBe(true);
    const layerRead = compatibility.reads.find((read) => read.writtenPath === 'invoice.mention');
    expect(layerRead?.path.slice(0, 4)).toStrictEqual(['page', 'layers', 0, 'content']);
    expect(layerRead?.nodeId).toBe('mention');
  });
});
