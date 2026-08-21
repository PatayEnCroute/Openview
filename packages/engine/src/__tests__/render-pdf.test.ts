import type { RenderRequest, Template } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../errors.js';
import { createPdfRenderPort, PDF_CONTENT_TYPE } from '../pipeline/render-pdf.js';
import {
  FAKE_PDF_BYTES,
  failingStrategy,
  recordingStrategy,
  SAMPLE_DATA,
  templateOf,
  unvalidatableTemplate,
} from './fixtures.js';

const requestOf = (template: Template, data: RenderRequest['data'] = {}): RenderRequest => ({
  template,
  data,
});

const labelText = templateOf({
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'who',
        content: [{ kind: 'binding', value: { kind: 'path', path: 'sample.label' } }],
      },
    ],
  },
});

describe('createPdfRenderPort', () => {
  it('announces the pdf format on the port itself', () => {
    expect(createPdfRenderPort(recordingStrategy().strategy).format).toBe('pdf');
  });

  it('returns the strategy bytes with the pdf format and media type', async () => {
    const port = createPdfRenderPort(recordingStrategy().strategy);
    const result = await port.render(requestOf(templateOf()));
    expect(result).toStrictEqual({
      format: 'pdf',
      bytes: FAKE_PDF_BYTES,
      contentType: PDF_CONTENT_TYPE,
    });
    expect(PDF_CONTENT_TYPE).toBe('application/pdf');
  });

  it('calls the strategy exactly once, with the serialised html and the declared sheet', async () => {
    const recorded = recordingStrategy();
    const port = createPdfRenderPort(recorded.strategy);
    await port.render(
      requestOf(
        templateOf({
          page: {
            sheet: { width: 123.45, height: 234.56 },
            margins: { top: 1, right: 2, bottom: 3, left: 4 },
            header: [],
            footer: [],
          },
        }),
      ),
    );
    expect(recorded.calls).toHaveLength(1);
    const [call] = recorded.calls;
    expect(call?.sheet).toStrictEqual({ width: 123.45, height: 234.56 });
    expect(call?.html.startsWith('<!doctype html>')).toBe(true);
    expect(call?.html).toContain('@page{size:123.45mm 234.56mm;margin:0}');
  });

  it('validates the template even when the static type already announced one', async () => {
    const recorded = recordingStrategy();
    const port = createPdfRenderPort(recorded.strategy);
    await expect(port.render(requestOf(unvalidatableTemplate()))).rejects.toMatchObject({
      code: 'template-refused',
    });
    expect(recorded.calls).toHaveLength(0);
  });

  it('never reaches the strategy when a binding refuses', async () => {
    const recorded = recordingStrategy();
    const port = createPdfRenderPort(recorded.strategy);
    await expect(port.render(requestOf(labelText, {}))).rejects.toMatchObject({
      code: 'missing-binding-value',
    });
    expect(recorded.calls).toHaveLength(0);
  });

  it('keeps the host dataset opaque and unmutated', async () => {
    const port = createPdfRenderPort(recordingStrategy().strategy);
    const before = structuredClone(SAMPLE_DATA);
    await port.render(requestOf(labelText, SAMPLE_DATA));
    expect(SAMPLE_DATA).toStrictEqual(before);
  });

  it('wraps an unknown strategy failure without summarising its cause', async () => {
    const boom = new Error('chromium said something with a total of 1200 in it');
    const port = createPdfRenderPort(failingStrategy(boom));
    const caught: unknown = await port
      .render(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('pdf-export-failed');
      expect(caught.message).not.toContain('1200');
      expect(caught.cause).toBe(boom);
    }
  });

  it('lets a refusal the strategy already named travel unchanged', async () => {
    const named = new DocumentRenderError('overflowed', 'single-page-overflow', { region: 'root' });
    const port = createPdfRenderPort(failingStrategy(named));
    await expect(port.render(requestOf(templateOf()))).rejects.toBe(named);
  });

  it('applies configured shape bounds, which are engine options and not request fields', async () => {
    const port = createPdfRenderPort(recordingStrategy().strategy, {
      shapeLimits: { maxNodes: 4 },
    });
    await expect(port.render(requestOf(templateOf()))).rejects.toMatchObject({
      code: 'template-refused',
    });
  });

  it('applies configured evaluation bounds to the formulas of the document', async () => {
    const port = createPdfRenderPort(recordingStrategy().strategy, {
      evaluationLimits: { maxSteps: 1 },
    });
    await expect(port.render(requestOf(labelText, SAMPLE_DATA))).resolves.toMatchObject({
      format: 'pdf',
    });
    const tight = createPdfRenderPort(recordingStrategy().strategy, {
      evaluationLimits: { maxSteps: 1 },
    });
    const two = templateOf({
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'text',
            id: 'twice',
            content: [
              { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
              { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
            ],
          },
        ],
      },
    });
    await expect(tight.render(requestOf(two, SAMPLE_DATA))).rejects.toMatchObject({
      code: 'expression-refused',
    });
  });
});
