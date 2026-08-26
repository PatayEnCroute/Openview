import { kindOf } from '../expression/value-type.js';
import type { DataListType, DataObjectType, DataScalarType, DataType } from './types.js';

/**
 * Visitor over a declared type: a terminal value, a record of fields, or a repeatable value.
 *
 * The four terminal natures share one branch because none of them is traversed; what tells them
 * apart is `type.kind`, which every branch still receives.
 */
export interface DataTypeVisitor<TResult, TContext> {
  readonly scalar: (type: DataScalarType, context: TContext) => TResult;
  readonly object: (type: DataObjectType, context: TContext) => TResult;
  readonly list: (type: DataListType, context: TContext) => TResult;
}

/** Dispatches a declared type to its visitor branch. */
export function visitDataType<TResult, TContext>(
  type: DataType,
  visitor: DataTypeVisitor<TResult, TContext>,
  context: TContext,
): TResult {
  switch (type.kind) {
    case 'object':
      return visitor.object(type, context);
    case 'list':
      return visitor.list(type, context);
    case 'string':
    case 'number':
    case 'boolean':
    case 'civil-date':
      return visitor.scalar(type, context);
    default: {
      const exhaustive: never = type;
      throw new TypeError(`Unhandled data type: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}
