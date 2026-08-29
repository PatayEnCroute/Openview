import { DocumentRenderError } from '@openview/engine';

const TOO_MANY_VALUES =
  'This request carries more values than one render may copy across a thread boundary. Read `details.limit` for the ceiling; no key of the data set is named here, because none of them belongs to Openview.';

const TOO_MANY_CHARACTERS =
  'The strings of this request are longer, in total, than one render may copy across a thread boundary. Read `details.limit` for the ceiling in code units.';

const NOT_PLAIN_DATA =
  'This request holds something a render may not copy: a function, a symbol, an accessor, a class instance or a cycle. The hardened runtime copies plain json values only, so nothing of the caller is executed and nothing is shared with it.';

/** Ceilings on the copy one request is admitted under. */
export interface TransportLimits {
  /** Distinct values, counting every element and every property. */
  readonly maxValues: number;
  /** Sum of the lengths of every string, in utf-16 code units. */
  readonly maxStringLength: number;
}

function refuse(message: string, limit?: number | undefined): never {
  throw new DocumentRenderError(message, 'template-refused', {
    phase: 'transport',
    ...(limit === undefined ? {} : { limit }),
  });
}

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Copies a request into plain json data, under a budget, without running any of the caller's code.
 *
 * Property descriptors are read rather than the properties themselves: a getter would run caller
 * code before validation and could answer one value to the guard and another to the engine. The
 * copy shares no reference with the caller, so a mutation after admission changes nothing.
 *
 * This is a transport contract and not a schema of the data set: no key is reserved, no shape is
 * expected, and every name the caller chose survives unchanged.
 */
export function snapshotValue(value: unknown, limits: TransportLimits): unknown {
  let values = 0;
  let characters = 0;
  const seen = new Set<object>();

  const copy = (current: unknown): unknown => {
    values += 1;
    if (values > limits.maxValues) {
      refuse(TOO_MANY_VALUES, limits.maxValues);
    }
    if (current === null) {
      return null;
    }
    switch (typeof current) {
      case 'string':
        characters += current.length;
        if (characters > limits.maxStringLength) {
          refuse(TOO_MANY_CHARACTERS, limits.maxStringLength);
        }
        return current;
      case 'number':
      case 'boolean':
      case 'undefined':
        return current;
      case 'object':
        break;
      default:
        refuse(NOT_PLAIN_DATA);
    }
    const object: object = current;
    if (seen.has(object)) {
      /* `seen` holds the ancestors of the value being copied, so this is a cycle and nothing else.
         A subtree merely reached twice is copied twice, and charged twice, which keeps the budget
         an upper bound on what really crosses the boundary. */
      refuse(NOT_PLAIN_DATA);
    }
    seen.add(object);
    if (Array.isArray(object)) {
      const list = object.map((item) => copy(item));
      seen.delete(object);
      return list;
    }
    if (!isPlainObject(object)) {
      refuse(NOT_PLAIN_DATA);
    }
    if (Object.getOwnPropertySymbols(object).length > 0) {
      /* A symbol-keyed property cannot cross a thread and cannot be json: dropping it would make
         the copy quietly different from what the caller handed in. */
      refuse(NOT_PLAIN_DATA);
    }
    const built: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        refuse(NOT_PLAIN_DATA);
      }
      if (descriptor.enumerable) {
        built[key] = copy(descriptor.value);
      }
    }
    seen.delete(object);
    return built;
  };

  return copy(value);
}
