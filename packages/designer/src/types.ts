import type { BlockNodeType, DataCatalogue, Template } from '@openview/core';

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
  /**
   * What the host application lets a model read, with its own labels and structure.
   *
   * Absent is equivalent to an empty catalogue: no field is proposed, and a static model still
   * opens. It never means that Openview should guess the fields from a dataset. Parse it once with
   * `DataCatalogueSchema` where it enters the application, never on each React render.
   */
  dataCatalogue?: DataCatalogue | undefined;
  options?: OpenviewDesignerOptions | undefined;
  onChange?: ((template: Template) => void) | undefined;
  onSave?: ((template: Template) => Promise<void> | void) | undefined;
  onExportPdf?: ((template: Template) => Promise<void> | void) | undefined;
  className?: string | undefined;
}
