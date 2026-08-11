import type { Template } from '../template/template.js';

export type RenderFormat = 'pdf' | 'html' | 'png';

export interface RenderRequest {
  readonly template: Template;
  /** Validated by the caller against the template's own data schema. */
  readonly data: Readonly<Record<string, unknown>>;
}

export interface RenderResult {
  readonly format: RenderFormat;
  /** `Uint8Array`, not `Buffer`: core must stay isomorphic (AGENTS.md 2). */
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * Hexagonal port for document rendering, and the seam the Strategy pattern
 * plugs into: one adapter per format.
 *
 * The Puppeteer adapter must live in its own package rather than inside
 * @openview/engine. Puppeteer bundles Chromium (~150-300 MB), and depending on
 * it directly would charge that download to every integrator who only ever
 * wanted HTML output. `noRestrictedImports` enforces this.
 */
export interface RenderPort {
  readonly format: RenderFormat;
  render(request: RenderRequest): Promise<RenderResult>;
}
