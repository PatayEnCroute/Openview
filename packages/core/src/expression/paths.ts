import type { Expression } from './types.js';
import { kindOf } from './value-type.js';

/**
 * The first segment of a dotted path -- the only part that can name an alias.
 *
 * Extracted from `visitor.ts`, where it was inline, because two filters now need the
 * same rule: the node-level one that skips a loop alias, and the expression-level one
 * below that skips an alias bound INSIDE an expression. `indexOf`/`slice` rather than
 * `split`, since only the root decides and this runs once per path of a whole tree.
 */
export function rootSegment(dataPath: string): string {
  const dot = dataPath.indexOf('.');
  return dot === -1 ? dataPath : dataPath.slice(0, dot);
}

const NO_ALIASES: ReadonlySet<string> = new Set<string>();

/**
 * A copy with one more alias in it. A copy, not a mutation: an alias is confined to the
 * sub-tree that declares it, and leaking it to a sibling would silently drop a caller key
 * from the analysis.
 */
function withAlias(aliases: ReadonlySet<string>, alias: string): ReadonlySet<string> {
  return new Set(aliases).add(alias);
}

/**
 * Records the paths an expression reads, skipping those rooted at an alias the
 * expression itself binds.
 *
 * The node-level filter in `visitor.ts` cannot do this job: it works one node at a
 * time and never sees an alias buried inside an expression. Without this pass,
 * `sum(invoice.lines, l, l.total)` would make `collectDataPaths` demand a key `l` from
 * the integrator that no integrator will ever supply -- precisely the bug ADR 0002
 * fixed for loops, reintroduced by aggregations.
 */
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
      // Both branches are collected even though only one will be evaluated: the analysis
      // reports what a template MAY read, and which branch runs depends on the data.
      collectPaths(expression.when, aliases, into);
      collectPaths(expression.whenTrue, aliases, into);
      collectPaths(expression.whenFalse, aliases, into);
      break;
    case 'count':
      collectPaths(expression.source, aliases, into);
      break;
    case 'aggregate':
      // `source` is evaluated in the ENCLOSING scope, before the alias binds, so it does
      // not see it. `value` does. Getting that order wrong would either hide a caller key
      // or demand an alias from the integrator.
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
      // Its own case rather than fused with `text`, though the two bodies are identical
      // today. The exhaustiveness guard below forces a case to EXIST; nothing forces its
      // body to be right, and this function returns `void`, so no second check backstops it.
      // Fusing on the field NAME would invite a future kind carrying `value` plus a second
      // child into this group, where it would compile clean while that child's paths were
      // silently dropped -- `collectDataPaths` under-reporting, which is the ADR 0002 bug
      // class this pass exists to prevent. `value` already means three different traversals
      // in this switch: untraversed on `literal`, plain here, alias-scoped on `aggregate`.
      //
      // `decimals` and `mode` are literals, so a rounding reads nothing of its own.
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
      // `kindOf` rather than `JSON.stringify`: stringifying overflows the stack around
      // 8 000 levels of nesting, which would turn the exhaustiveness guard into a second
      // crash on exactly the payloads it exists to report.
      throw new TypeError(`Unhandled expression: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/**
 * Every data path an expression tree reads, in traversal order, de-duplicated.
 *
 * The signature is unchanged: the alias context is internal, so no caller has to know
 * that expressions can bind names now.
 */
export function pathsOf(expression: Expression, into: Set<string> = new Set()): Set<string> {
  collectPaths(expression, NO_ALIASES, into);
  return into;
}
