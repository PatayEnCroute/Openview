import type { BlockNodeType, Template } from '@openview/core';

/** Block types insertable in the visual designer. */
export type BlockType = BlockNodeType;

export interface OpenviewDesignerOptions {
  theme?: 'light' | 'dark' | 'auto' | undefined;
  layoutMode?: 'embedded' | 'fullscreen' | 'compact' | undefined;
  readOnly?: boolean | undefined;
  allowedBlocks?: BlockType[] | undefined;
}

export interface OpenviewDesignerProps {
  initialTemplate?: Partial<Template> | undefined;
  /** Host application data catalogue (for field picker suggestions). */
  dataCatalogue?: Record<string, unknown> | undefined;
  options?: OpenviewDesignerOptions | undefined;
  onChange?: ((template: Template) => void) | undefined;
  onSave?: ((template: Template) => Promise<void> | void) | undefined;
  onExportPdf?: ((template: Template) => Promise<void> | void) | undefined;
  className?: string | undefined;
}
