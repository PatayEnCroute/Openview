/**
 * Data catalogue subsystem facade: contracts, schemas, flattening, and template compatibility.
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
