import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import type { PdfRenderStrategy, PdfSourceDocument } from '../strategy/pdf.js';

/** A four-byte pdf signature. Enough for a strategy that must not print anything real. */
export const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

/** A valid 4x2 navy png, so an image test measures a real decode rather than a placeholder. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOQtsqHIwZkDgBNGgYhi5XcagAAAABJRU5ErkJggg==';

/** A valid 120x40 navy png, sized like a small logo. */
export const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAAAZklEQVR4nO3QQQkAIADAQHvYxFL2/9lCYR4swLgx19aFxvODTwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag251AEd4W9Pz3UCaAAAAAElFTkSuQmCC';

/** Stored template shape, before validation, so a test can feed a hostile or historic payload. */
export function storedTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_test',
    name: 'Test template',
    version: '1.0.0',
    page: {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header: [],
      footer: [],
    },
    root: { type: 'container', id: 'root', children: [] },
    ...overrides,
  };
}

/** The same payload, validated. */
export function templateOf(overrides: Record<string, unknown> = {}): Template {
  return parseTemplate(storedTemplate(overrides));
}

/**
 * A template that satisfies the static type and fails the schema: an empty id is a `string`.
 *
 * This is the shape a JavaScript caller reaches the port with, and the reason the pipeline validates
 * a value the compiler already called a `Template`.
 */
export function unvalidatableTemplate(): Template {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: '',
    name: 'Refused',
    version: '1.0.0',
    page: {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header: [],
      footer: [],
    },
    root: { type: 'container', id: 'root', children: [] },
  };
}

/** A strategy that records what it was handed and returns fixed bytes. */
export interface RecordedStrategy {
  readonly strategy: PdfRenderStrategy;
  readonly calls: PdfSourceDocument[];
}

export function recordingStrategy(bytes: Uint8Array = FAKE_PDF_BYTES): RecordedStrategy {
  const calls: PdfSourceDocument[] = [];
  return {
    calls,
    strategy: {
      format: 'pdf',
      render(document: PdfSourceDocument): Promise<Uint8Array> {
        calls.push(document);
        return Promise.resolve(bytes);
      },
    },
  };
}

/** A strategy that always fails, to prove how an unknown failure is wrapped. */
export function failingStrategy(error: unknown): PdfRenderStrategy {
  return {
    format: 'pdf',
    render(): Promise<Uint8Array> {
      return Promise.reject(error);
    },
  };
}

/** A short host dataset. Its names belong to this fixture, not to Openview. */
export const SAMPLE_DATA: EvaluationScope = {
  sample: {
    reference: 42,
    label: 'acme',
    items: [
      { sku: 'A-1', count: 2, unitPrice: 10, rebate: 0 },
      { sku: 'B-2', count: 1, unitPrice: 30, rebate: 15 },
    ],
  },
  issuer: { notice: 'no early-payment discount' },
};
