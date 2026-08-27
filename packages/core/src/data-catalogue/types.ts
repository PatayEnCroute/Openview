/**
 * Host data catalogue type contracts and terminal scalar definitions.
 * @see docs/adr/0015-le-catalogue-de-donnees-de-l-integrateur.md
 */

/** Terminal natures a declared value can have. */
export const DATA_SCALAR_KINDS = ['string', 'number', 'boolean', 'civil-date'] as const;

export type DataScalarKind = (typeof DATA_SCALAR_KINDS)[number];

/**
 * A terminal value. `civil-date` is a string at runtime and a distinct nature here, so date
 * operations can be offered without implying that a date-time or a time zone is accepted.
 */
export interface DataScalarType {
  readonly kind: DataScalarKind;
}

/** A value holding named fields, in the order the host chose. */
export interface DataObjectType {
  readonly kind: 'object';
  readonly fields: readonly DataField[];
}

/** A repeatable value. Its element type is what a loop, a filter or an aggregation binds. */
export interface DataListType {
  readonly kind: 'list';
  readonly items: DataType;
}

export type DataType = DataScalarType | DataObjectType | DataListType;

export type DataTypeKind = DataType['kind'];

/** One declared key: how a model addresses it, how a person reads it, and what it holds. */
export interface DataField {
  readonly key: string;
  readonly label: string;
  readonly type: DataType;
}

/**
 * The complete declaration. `fields` are the roots a model may address, and their order is the
 * order a field picker shows them in.
 */
export interface DataCatalogue {
  readonly fields: readonly DataField[];
}

/** Upper bound on a business label, which is a caption and never an identifier. */
export const MAX_DATA_LABEL_LENGTH = 200;

/** One field of the catalogue, flattened with the chains that lead to it. */
export interface DataCatalogueEntry {
  readonly keyPath: readonly string[];
  readonly labelPath: readonly string[];
  readonly type: DataType;
}

/**
 * What the runtime requires at the exact position a path is read.
 *
 * A closed vocabulary, not a type system: it says what an operand position accepts, and leaves to
 * evaluation the faults no catalogue reading is involved in.
 */
export const DATA_EXPECTATIONS = [
  'any',
  'printable',
  'number',
  'boolean',
  'text',
  'civil-date',
  'primitive',
  'orderable',
  'list',
] as const;

export type DataExpectation = (typeof DATA_EXPECTATIONS)[number];

/** How one reading stands against the catalogue. */
export const DATA_READ_STATUSES = ['available', 'undeclared', 'incompatible', 'blocked'] as const;

export type DataReadStatus = (typeof DATA_READ_STATUSES)[number];

/**
 * One occurrence of a path being read, resolved in the scope it is written in.
 *
 * Two readings of one field in two nodes are two entries: the position is the information this
 * carries over a deduplicated path list.
 */
export interface TemplateDataRead {
  /** The path as the expression spells it, alias included. */
  readonly writtenPath: string;
  /** Where the reading lands in the catalogue, or nothing when it lands nowhere. */
  readonly cataloguePath: readonly string[] | undefined;
  readonly labels: readonly string[];
  readonly actualKind: DataTypeKind | undefined;
  readonly expectation: DataExpectation;
  readonly status: DataReadStatus;
  /** Segments from the template root to the reading. */
  readonly path: readonly (string | number)[];
  readonly nodeId: string | undefined;
}

/** An alias masking a catalogue root, or an alias already in scope. */
export const DATA_SCOPE_WARNING_CODES = [
  'alias-shadows-catalogue-root',
  'alias-shadows-alias',
] as const;

export type DataScopeWarningCode = (typeof DATA_SCOPE_WARNING_CODES)[number];

/**
 * A masking, reported once at the declaration that causes it.
 *
 * Never a refusal: the runtime meaning is defined -- the innermost alias wins -- so this is a
 * question of intent, and it leaves `compatible` alone.
 */
export interface DataScopeWarning {
  readonly code: DataScopeWarningCode;
  readonly alias: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
  readonly nodeId: string | undefined;
}
