/**
 * Pagination port: the cuts an engine chose, projected read-only for a consumer that displays them.
 *
 * Carries no materialised node, no cursor, no metric and no measurement key: a caller receives what
 * a page holds, never the algorithm that decided it.
 */
export {
  ITERATION_TYPE_SATISFIES_SCHEMA,
  IterationAddressSchema,
  KeepTogetherFallbackNoticeSchema,
  NODE_TYPES_COVER_THE_UNION,
  NOTICE_TYPE_SATISFIES_SCHEMA,
  OCCURRENCE_SCHEMA_SATISFIES_TYPE,
  OCCURRENCE_TYPE_SATISFIES_SCHEMA,
  OccurrenceReferenceSchema,
  PAGE_TYPE_SATISFIES_SCHEMA,
  PAGINATION_RESULT_SCHEMA_SATISFIES_TYPE,
  PAGINATION_RESULT_TYPE_SATISFIES_SCHEMA,
  PagePlacementSchema,
  PageReportResultSchema,
  PaginationNoticeSchema,
  PaginationPageResultSchema,
  PaginationResultSchema,
  PLACEMENT_TYPE_SATISFIES_SCHEMA,
} from './schemas.js';
export type {
  FragmentState,
  IterationAddress,
  KeepTogetherFallbackNotice,
  OccurrenceAddress,
  OccurrenceReference,
  PagePlacement,
  PageReportResult,
  PaginationNotice,
  PaginationNoticeCode,
  PaginationPageResult,
  PaginationPort,
  PaginationRegion,
  PaginationResult,
  PlacementRole,
} from './types.js';
export {
  FRAGMENT_STATES,
  PAGINATION_NOTICE_CODES,
  PAGINATION_REGIONS,
  PLACEMENT_ROLES,
} from './types.js';
