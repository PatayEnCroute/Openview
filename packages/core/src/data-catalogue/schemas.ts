import { z } from 'zod/v4';
import { isIdentifier } from '../expression/expression.js';
import {
  type DataCatalogue,
  type DataField,
  type DataType,
  MAX_DATA_LABEL_LENGTH,
} from './types.js';
import { type DataTypeVisitor, visitDataType } from './visitor.js';

export const DATA_KEY_MESSAGE =
  'A catalogue key is one identifier a path expression can address, and may not be __proto__, constructor or prototype';
export const DATA_LABEL_MESSAGE =
  'A label is a non-empty text with no leading or trailing whitespace';
export const DATA_LABEL_LENGTH_MESSAGE = `A label may not exceed ${MAX_DATA_LABEL_LENGTH} characters`;
export const DUPLICATE_DATA_KEY_MESSAGE =
  'Two fields of the same object share a key. One key names one value, so sibling keys have to be unique.';

/** The grammar of the path language, reused rather than restated: no key is addressable twice. */
const dataKeySchema = z.string().refine(isIdentifier, DATA_KEY_MESSAGE);

const dataLabelSchema = z
  .string()
  .max(MAX_DATA_LABEL_LENGTH, DATA_LABEL_LENGTH_MESSAGE)
  .refine((label) => label.length > 0 && label.trim() === label, DATA_LABEL_MESSAGE);

export const DataStringTypeSchema = z.object({ kind: z.literal('string') });
export const DataNumberTypeSchema = z.object({ kind: z.literal('number') });
export const DataBooleanTypeSchema = z.object({ kind: z.literal('boolean') });
export const DataCivilDateTypeSchema = z.object({ kind: z.literal('civil-date') });

function typeMembers() {
  return [
    DataStringTypeSchema,
    DataNumberTypeSchema,
    DataBooleanTypeSchema,
    DataCivilDateTypeSchema,
    DataObjectTypeSchema,
    DataListTypeSchema,
  ] as const;
}

/** Zod schema for any declared type. */
export const DataTypeSchema: z.ZodType<DataType> = z.lazy(() =>
  z.discriminatedUnion('kind', typeMembers()),
);

/** Zod schema for one declared field. */
export const DataFieldSchema: z.ZodType<DataField> = z.lazy(() =>
  z.object({ key: dataKeySchema, label: dataLabelSchema, type: DataTypeSchema }),
);

export const DataObjectTypeSchema = z.object({
  kind: z.literal('object'),
  fields: z.array(DataFieldSchema),
});

export const DataListTypeSchema = z.object({
  kind: z.literal('list'),
  items: DataTypeSchema,
});

/** Where the scan currently stands in the parsed value, and where its issues are reported. */
interface DuplicateScan {
  readonly at: readonly (string | number)[];
  readonly ctx: z.RefinementCtx;
}

const DUPLICATE_CHECKER: DataTypeVisitor<void, DuplicateScan> = {
  scalar: () => undefined,
  object: (type, scan) => {
    checkSiblingKeys(type.fields, [...scan.at, 'fields'], scan.ctx);
  },
  list: (type, scan) => {
    visitDataType(type.items, DUPLICATE_CHECKER, { at: [...scan.at, 'items'], ctx: scan.ctx });
  },
};

/**
 * Refuses two sibling keys, at the position of the second one: they would describe two competing
 * types for a single value, and only one of them could ever be read.
 */
function checkSiblingKeys(
  fields: readonly DataField[],
  at: readonly (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, field] of fields.entries()) {
    if (seen.has(field.key)) {
      ctx.addIssue({
        code: 'custom',
        path: [...at, index, 'key'],
        message: DUPLICATE_DATA_KEY_MESSAGE,
      });
    }
    seen.add(field.key);
    visitDataType(field.type, DUPLICATE_CHECKER, { at: [...at, index, 'type'], ctx });
  }
}

/**
 * Zod schema for a host data catalogue.
 *
 * Parse it once at the boundary that receives it, never inside a render loop.
 */
export const DataCatalogueSchema: z.ZodType<DataCatalogue> = z
  .object({ fields: z.array(DataFieldSchema) })
  .check(
    z.superRefine((catalogue: DataCatalogue, ctx: z.RefinementCtx) => {
      checkSiblingKeys(catalogue.fields, ['fields'], ctx);
    }),
  );
