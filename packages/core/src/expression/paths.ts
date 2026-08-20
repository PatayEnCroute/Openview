import type { Expression } from './types.js';
import { kindOf } from './value-type.js';

/**
 * Returns the first segment of a dotted path.
 */
export function rootSegment(dataPath: string): string {
  const dot = dataPath.indexOf('.');
  return dot === -1 ? dataPath : dataPath.slice(0, dot);
}

const NO_ALIASES: ReadonlySet<string> = new Set<string>();

function withAlias(aliases: ReadonlySet<string>, alias: string): ReadonlySet<string> {
  return new Set(aliases).add(alias);
}

function collectPaths(
  expression: Expression,
  aliases: ReadonlySet<string>,
  into: Set<string>,
): void {
  switch (expression.kind) {
    case 'literal':
      break;
    case 'path':
      if (!aliases.has(rootSegment(expression.path))) {
        into.add(expression.path);
      }
      break;
    case 'compare':
    case 'arithmetic':
      collectPaths(expression.left, aliases, into);
      collectPaths(expression.right, aliases, into);
      break;
    case 'percentOf':
      collectPaths(expression.base, aliases, into);
      collectPaths(expression.rate, aliases, into);
      break;
    case 'if':
      collectPaths(expression.when, aliases, into);
      collectPaths(expression.whenTrue, aliases, into);
      collectPaths(expression.whenFalse, aliases, into);
      break;
    case 'count':
      collectPaths(expression.source, aliases, into);
      break;
    case 'aggregate':
      collectPaths(expression.source, aliases, into);
      collectPaths(expression.value, withAlias(aliases, expression.as), into);
      break;
    case 'filter':
      collectPaths(expression.source, aliases, into);
      collectPaths(expression.where, withAlias(aliases, expression.as), into);
      break;
    case 'concat':
      for (const part of expression.parts) {
        collectPaths(part, aliases, into);
      }
      break;
    case 'text':
      collectPaths(expression.value, aliases, into);
      break;
    case 'round':
      collectPaths(expression.value, aliases, into);
      break;
    case 'textCase':
      collectPaths(expression.text, aliases, into);
      break;
    case 'dateAdd':
      collectPaths(expression.date, aliases, into);
      collectPaths(expression.days, aliases, into);
      break;
    case 'dateDiff':
      collectPaths(expression.from, aliases, into);
      collectPaths(expression.to, aliases, into);
      break;
    case 'endOfMonth':
      collectPaths(expression.date, aliases, into);
      break;
    case 'logical':
      for (const operand of expression.operands) {
        collectPaths(operand, aliases, into);
      }
      break;
    case 'not':
    case 'isEmpty':
      collectPaths(expression.operand, aliases, into);
      break;
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/**
 * Collects all external data paths read by an expression tree into a Set.
 */
export function pathsOf(expression: Expression, into: Set<string> = new Set()): Set<string> {
  collectPaths(expression, NO_ALIASES, into);
  return into;
}
