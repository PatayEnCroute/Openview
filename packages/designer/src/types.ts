import type { Template } from '@openview/core';

export type BlockType = 'text' | 'image' | 'container' | 'table' | 'loop' | 'condition';

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
  dataSchema?: Record<string, unknown> | undefined;
  options?: OpenviewDesignerOptions | undefined;
  onChange?: ((template: Template) => void) | undefined;
  onSave?: ((template: Template) => Promise<void> | void) | undefined;
  onExportPdf?: ((template: Template) => Promise<void> | void) | undefined;
  className?: string | undefined;
}
