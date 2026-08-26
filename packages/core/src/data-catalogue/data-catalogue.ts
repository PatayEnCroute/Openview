/**
 * The data catalogue a host application declares, and what a model may read from it.
 *
 * Facade of the subsystem: the contract, its schema, its ordered flattening, and the compatibility
 * of one template with one catalogue. Nothing here reads, parses or requires a dataset.
 *
 * @see docs/adr/0015-le-catalogue-de-donnees-de-l-integrateur.md
 */
export type { TemplateDataCompatibility } from './compatibility.js';
export { checkTemplateDataCompatibility } from './compatibility.js';
export { acceptedKindsOf } from './expectations.js';
export { listDataCatalogueEntries } from './list.js';
export {
  DataBooleanTypeSchema,
  DataCatalogueSchema,
  DataCivilDateTypeSchema,
  DataFieldSchema,
  DataListTypeSchema,
  DataNumberTypeSchema,
  DataObjectTypeSchema,
  DataStringTypeSchema,
  DataTypeSchema,
} from './schemas.js';
export type {
  DataCatalogue,
  DataCatalogueEntry,
  DataExpectation,
  DataField,
  DataListType,
  DataObjectType,
  DataReadStatus,
  DataScalarKind,
  DataScalarType,
  DataScopeWarning,
  DataScopeWarningCode,
  DataType,
  DataTypeKind,
  TemplateDataRead,
} from './types.js';
export {
  DATA_EXPECTATIONS,
  DATA_READ_STATUSES,
  DATA_SCALAR_KINDS,
  DATA_SCOPE_WARNING_CODES,
  MAX_DATA_LABEL_LENGTH,
} from './types.js';
