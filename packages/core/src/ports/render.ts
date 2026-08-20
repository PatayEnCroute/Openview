import type { EvaluationScope } from '../expression/evaluate.js';
import type { Template } from '../template/template.js';

export type RenderFormat = 'pdf' | 'html' | 'png';

/**
 * Parameters for a document render request.
 * `data` is owned and structured by the host application.
 */
export interface RenderRequest {
  readonly template: Template;
  readonly data: EvaluationScope;
}

/** Binary output produced by a render strategy. */
export interface RenderResult {
  readonly format: RenderFormat;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/** Hexagonal port for document render adapters. */
export interface RenderPort {
  readonly format: RenderFormat;
  render(request: RenderRequest): Promise<RenderResult>;
}
