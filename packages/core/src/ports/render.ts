import type { EvaluationScope } from '../expression/evaluate.js';
import type { Template } from '../template/template.js';

export type RenderFormat = 'pdf' | 'html' | 'png';

/**
 * Everything a render needs, and deliberately nothing else.
 *
 * `data` is the integrating application's own dataset. Openview reserves no key
 * in it, expects no particular shape, and never validates its contents: the
 * catalogue of available fields belongs to the caller. That is why the type is an
 * opaque bag of `unknown` rather than a schema, and why no `RenderDataSchema`
 * will ever live in core. A template reads whatever paths its author picked --
 * `collectDataPaths` tells the caller which ones -- and the caller alone decides
 * whether its dataset satisfies them.
 *
 * There is no third field on purpose. No clock, no *system* locale, no ambient
 * context: "today" is a datum like any other, supplied under whatever name the
 * caller chose. That is not a naming convention Openview imposes -- it falls out of
 * the determinism the engine owes (roadmap engine, E6): a renderer that reads the
 * machine clock cannot produce the same document twice. Language and currency are a
 * different matter entirely: the template declares them (roadmap core, C6). What is
 * refused here is reading them off the machine.
 */
export interface RenderRequest {
  readonly template: Template;
  /** The caller's namespace -- the same one expressions resolve against. */
  readonly data: EvaluationScope;
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
