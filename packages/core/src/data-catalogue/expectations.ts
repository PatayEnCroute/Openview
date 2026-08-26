import type { DataExpectation, DataTypeKind } from './types.js';

/**
 * The declared natures each position accepts, mirroring the evaluator's own guards.
 *
 * `civil-date` is a string at runtime, so it satisfies `text`, `printable`, `primitive` and
 * `orderable`; only the homonymous expectation is satisfied by it alone. `boolean` prints nowhere,
 * and neither a record nor a list is orderable or comparable.
 */
const ACCEPTED: Readonly<Record<DataExpectation, readonly DataTypeKind[]>> = {
  any: ['string', 'number', 'boolean', 'civil-date', 'object', 'list'],
  printable: ['string', 'number', 'civil-date'],
  number: ['number'],
  boolean: ['boolean'],
  text: ['string', 'civil-date'],
  'civil-date': ['civil-date'],
  primitive: ['string', 'number', 'boolean', 'civil-date'],
  orderable: ['string', 'number', 'civil-date'],
  list: ['list'],
};

/** The declared natures this position accepts. */
export function acceptedKindsOf(expectation: DataExpectation): readonly DataTypeKind[] {
  return ACCEPTED[expectation];
}

/** Whether a declared nature may be read where this expectation holds. */
export function satisfies(expectation: DataExpectation, kind: DataTypeKind): boolean {
  return ACCEPTED[expectation].includes(kind);
}
