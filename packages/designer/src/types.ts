import type { BlockNodeType, Template } from '@openview/core';

/**
 * Derived, not restated. The hand-written list this replaces already contained `'table'`
 * while `core` had no such node: it was right by accident, and nothing in the four gates
 * said so. Derivation makes "what a user may insert" exactly "what a block flow accepts",
 * and a ninth node type cannot slip past it.
 *
 * `BlockNodeType` and not `DocumentNodeType`: after lot C3 the latter holds EIGHT members,
 * `tableRow` and `tableRowGroup` among them. An `allowedBlocks: ['tableRow']` would be
 * accepted by the type and refused by the schema, so an editor offering to insert a row into
 * a block flow would produce a document `parseTemplate` rejects.
 *
 * And `BlockNodeType` rather than `BlockNode['type']` recomputed here: the list is named once,
 * in `core`, and two computations of the same thing are two things free to diverge.
 */
export type BlockType = BlockNodeType;

// Every optional below is spelled `?: T | undefined`. tsconfig.base.json enables
// exactOptionalPropertyTypes, under which a bare `?:` rejects an explicitly
// undefined value and fails the caller with TS2379.
export interface OpenviewDesignerOptions {
  theme?: 'light' | 'dark' | 'auto' | undefined;
  layoutMode?: 'embedded' | 'fullscreen' | 'compact' | undefined;
  readOnly?: boolean | undefined;
  allowedBlocks?: BlockType[] | undefined;
}

export interface OpenviewDesignerProps {
  initialTemplate?: Partial<Template> | undefined;
  /**
   * The integrating application's data catalogue, so the field picker can offer
   * paths instead of asking the author to type them.
   *
   * Named a catalogue, not a schema, on purpose: a schema would be something
   * Openview REQUIRES of the caller, and it requires nothing. Its shape and its
   * field names belong entirely to the host application; Openview displays it and
   * reserves no key in it.
   *
   * Optional by design -- with no catalogue the Designer still works, the author
   * types paths by hand and nothing checks them. Never make it required.
   */
  dataCatalogue?: Record<string, unknown> | undefined;
  options?: OpenviewDesignerOptions | undefined;
  onChange?: ((template: Template) => void) | undefined;
  onSave?: ((template: Template) => Promise<void> | void) | undefined;
  onExportPdf?: ((template: Template) => Promise<void> | void) | undefined;
  className?: string | undefined;
}
