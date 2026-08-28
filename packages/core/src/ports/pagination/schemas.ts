import { z } from 'zod/v4';
import type { DocumentNodeType } from '../../ast/nodes.js';
import { SheetSchema } from '../../page/page.js';
import {
  FRAGMENT_STATES,
  type IterationAddress,
  type KeepTogetherFallbackNotice,
  type OccurrenceReference,
  PAGINATION_REGIONS,
  type PagePlacement,
  type PaginationPageResult,
  type PaginationResult,
  PLACEMENT_ROLES,
} from './types.js';

/**
 * The node kinds an occurrence can come from.
 *
 * Spelt here rather than derived, because the ast module owns no runtime list of its union. The
 * `satisfies` refuses an invented kind and {@link NODE_TYPES_COVER_THE_UNION} refuses a missing one,
 * so a ninth node kind breaks this compilation rather than escaping the schema.
 */
const NODE_TYPES = [
  'text',
  'image',
  'container',
  'loop',
  'condition',
  'table',
  'grid',
  'tableRow',
  'tableRowGroup',
] as const satisfies readonly DocumentNodeType[];

export const NODE_TYPES_COVER_THE_UNION: DocumentNodeType extends (typeof NODE_TYPES)[number]
  ? true
  : false = true;

/** A rank is a whole count from zero: a negative or fractional segment addresses nothing. */
const rankSchema = z.number().int().min(0);

const declarationPathSchema = z.array(z.union([z.string(), rankSchema])).readonly();

export const IterationAddressSchema = z.object({
  declarationPath: declarationPathSchema,
  index: rankSchema,
});

export const OccurrenceReferenceSchema = z.object({
  declarationPath: declarationPathSchema,
  iterations: z.array(IterationAddressSchema).readonly(),
  nodeId: z.string(),
  nodeType: z.enum(NODE_TYPES),
});

export const PagePlacementSchema = z.object({
  occurrence: OccurrenceReferenceSchema,
  region: z.enum(PAGINATION_REGIONS),
  role: z.enum(PLACEMENT_ROLES),
  fragment: z.enum(FRAGMENT_STATES),
});

/** The carried sum is raw and may be negative; `z.number()` refuses the non-finite total alone. */
export const PageReportResultSchema = z.object({
  incoming: z.number(),
  completedBy: z.array(OccurrenceReferenceSchema).readonly(),
});

const pageNumberSchema = z.number().int().min(1);

export const KeepTogetherFallbackNoticeSchema = z.object({
  code: z.literal('keep-together-fallback'),
  occurrence: OccurrenceReferenceSchema,
  pages: z.array(pageNumberSchema).readonly(),
});

/** Closed at one member today; a second notice code makes this a union discriminated on `code`. */
export const PaginationNoticeSchema = KeepTogetherFallbackNoticeSchema;

export const PaginationPageResultSchema = z.object({
  number: pageNumberSchema,
  placements: z.array(PagePlacementSchema).readonly(),
  report: PageReportResultSchema,
});

/**
 * Zod schema for the data a pagination result carries.
 *
 * A frontier schema: a consumer deserialising this envelope parses it here. The engine builds the
 * result from values it already validated and never parses its own output inside a render.
 */
export const PaginationResultSchema = z.object({
  sheet: SheetSchema,
  html: z.string(),
  pages: z.array(PaginationPageResultSchema).readonly(),
  notices: z.array(PaginationNoticeSchema).readonly(),
});

export const PAGINATION_RESULT_SCHEMA_SATISFIES_TYPE: z.infer<
  typeof PaginationResultSchema
> extends PaginationResult
  ? true
  : false = true;

export const PAGINATION_RESULT_TYPE_SATISFIES_SCHEMA: PaginationResult extends z.infer<
  typeof PaginationResultSchema
>
  ? true
  : false = true;

export const OCCURRENCE_SCHEMA_SATISFIES_TYPE: z.infer<
  typeof OccurrenceReferenceSchema
> extends OccurrenceReference
  ? true
  : false = true;

export const OCCURRENCE_TYPE_SATISFIES_SCHEMA: OccurrenceReference extends z.infer<
  typeof OccurrenceReferenceSchema
>
  ? true
  : false = true;

export const ITERATION_TYPE_SATISFIES_SCHEMA: IterationAddress extends z.infer<
  typeof IterationAddressSchema
>
  ? true
  : false = true;

export const PLACEMENT_TYPE_SATISFIES_SCHEMA: PagePlacement extends z.infer<
  typeof PagePlacementSchema
>
  ? true
  : false = true;

export const NOTICE_TYPE_SATISFIES_SCHEMA: KeepTogetherFallbackNotice extends z.infer<
  typeof KeepTogetherFallbackNoticeSchema
>
  ? true
  : false = true;

export const PAGE_TYPE_SATISFIES_SCHEMA: PaginationPageResult extends z.infer<
  typeof PaginationPageResultSchema
>
  ? true
  : false = true;
