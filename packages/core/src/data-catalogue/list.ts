import type { DataCatalogue, DataCatalogueEntry, DataField } from './types.js';
import { type DataTypeVisitor, visitDataType } from './visitor.js';

/** The chains leading to the field being flattened, and the list being built. */
interface FlattenCursor {
  readonly keyPath: readonly string[];
  readonly labelPath: readonly string[];
  readonly into: DataCatalogueEntry[];
}

/**
 * Descends past a list boundary without inventing a segment for it.
 *
 * The element of a list has no key of its own in the data, so its fields are listed as
 * descendants of the list field itself; `type` is what still says a list was crossed.
 */
const DESCENDER: DataTypeVisitor<void, FlattenCursor> = {
  scalar: () => undefined,
  object: (type, cursor) => {
    flattenFields(type.fields, cursor);
  },
  list: (type, cursor) => {
    visitDataType(type.items, DESCENDER, cursor);
  },
};

function flattenFields(fields: readonly DataField[], cursor: FlattenCursor): void {
  for (const field of fields) {
    const keyPath = [...cursor.keyPath, field.key];
    const labelPath = [...cursor.labelPath, field.label];
    cursor.into.push({ keyPath, labelPath, type: field.type });
    visitDataType(field.type, DESCENDER, { keyPath, labelPath, into: cursor.into });
  }
}

/**
 * Flattens a catalogue depth-first, parent before descendants, siblings in the host's own order.
 *
 * The order is the contract: it is the order a field picker shows. Returns fresh arrays; the
 * catalogue's own `type` objects are shared by reference and never mutated.
 */
export function listDataCatalogueEntries(catalogue: DataCatalogue): readonly DataCatalogueEntry[] {
  const into: DataCatalogueEntry[] = [];
  flattenFields(catalogue.fields, { keyPath: [], labelPath: [], into });
  return into;
}
