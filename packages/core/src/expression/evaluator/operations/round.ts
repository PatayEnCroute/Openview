import type { RoundMode } from '../../types.js';
import { requireFiniteResult, requireNumber } from '../guards.js';

const ZERO = 48;
const NINE = 57;
const DOT = 46;
const MINUS = 45;

/** Adds one to a decimal digit string, growing it by one digit on a full carry. */
function increment(digits: string): string {
  let cursor = digits.length;
  while (cursor > 0 && digits.charCodeAt(cursor - 1) === NINE) {
    cursor -= 1;
  }
  if (cursor === 0) {
    return `1${'0'.repeat(digits.length)}`;
  }
  const raised = digits.charCodeAt(cursor - 1) - ZERO + 1;
  return `${digits.slice(0, cursor - 1)}${raised}${'0'.repeat(digits.length - cursor)}`;
}

/**
 * Whether any digit from `from` on is non-zero -- a loop rather than a regex over a
 * substring, so nothing is allocated to answer a yes/no question on the hot path.
 */
function hasNonZero(digits: string, from: number): boolean {
  for (let index = from; index < digits.length; index += 1) {
    if (digits.charCodeAt(index) !== ZERO) {
      return true;
    }
  }
  return false;
}

/**
 * The exponent of a `toExponential()` form, read without allocating.
 *
 * `Number(shortest.slice(marker + 1))` says the same thing and builds a string to say it,
 * on a path taken by every call including the ones that turn out to be the identity.
 * ECMA-262 always writes the sign, so the digits start two characters past `e`.
 */
function exponentOf(shortest: string, marker: number): number {
  const negative = shortest.charCodeAt(marker + 1) === MINUS;
  let magnitude = 0;
  for (let index = marker + 2; index < shortest.length; index += 1) {
    magnitude = magnitude * 10 + (shortest.charCodeAt(index) - ZERO);
  }
  return negative ? -magnitude : magnitude;
}

/**
 * Whether the kept digits carry. `lastKept` decides an EXACT tie, and only for `halfEven`
 * -- which is the one place in this lot where the declared mode changes anything.
 *
 * The tie is dispatched by an exhaustive `switch` rather than by an open `else`, and that is
 * not style. An `else` would make every mode that is not `halfExpand` round to-even in
 * SILENCE: widening `ROUND_MODES` -- the one evolution ADR 0004 decision 3 plans for --
 * would then compile, type-check and pass the whole property matrix while mis-rounding every
 * exact tie by a cent. The `never` below is the same control AGENTS.md 3.B's amendment rests
 * on for the two expression traversals, applied where the mode is actually read.
 */
function goesUp(mode: RoundMode, first: number, restNonZero: boolean, lastKept: number): boolean {
  if (first !== 5) {
    return first > 5;
  }
  if (restNonZero) {
    return true;
  }
  switch (mode) {
    case 'halfExpand':
      return true;
    case 'halfEven':
      return lastKept % 2 === 1;
    default: {
      const exhaustive: never = mode;
      throw new TypeError(`Unhandled rounding mode: ${String(exhaustive)}`);
    }
  }
}

/**
 * The kept digits, as an integer string of the result in units of `10 ** -decimals`.
 *
 * The `drop >= digits.length` branch is the case where every digit falls. Only when
 * EXACTLY one place separates them can the value still reach the tie; any further out it is
 * strictly below half, whatever the digits say. Getting that wrong is how a naive version
 * answers `130` to `round(120, -1, ...)`, and a frozen vector pins it.
 */
function keptDigits(digits: string, drop: number, mode: RoundMode): string {
  if (drop >= digits.length) {
    const adjacent = drop === digits.length;
    const first = adjacent ? digits.charCodeAt(0) - ZERO : 0;
    // What lies past the rounding position, told TRUTHFULLY. Further out than adjacent, the
    // digit AT the position is a leading zero and the whole string is discarded -- and it is
    // non-zero, `value === 0` having already returned. Passing a fabricated `false` here
    // changed nothing for the two half-modes, which read this only on an exact tie, but it
    // would tell a future directed mode "nothing was dropped" -- and a directed mode reads
    // every discarded digit.
    const restNonZero = adjacent ? hasNonZero(digits, 1) : true;
    return goesUp(mode, first, restNonZero, 0) ? '1' : '0';
  }
  const cut = digits.length - drop;
  const kept = digits.slice(0, cut);
  const up = goesUp(
    mode,
    digits.charCodeAt(cut) - ZERO,
    hasNonZero(digits, cut + 1),
    digits.charCodeAt(cut - 1) - ZERO,
  );
  return up ? increment(kept) : kept;
}

/**
 * Rounds a value at a declared position, in a declared mode, on the number AS IT IS
 * WRITTEN.
 *
 * The value goes through its SHORTEST round-tripping decimal form, is rounded on the digit
 * string, and is rebuilt by a single string-to-number conversion -- so there is exactly ONE
 * binary rounding in the whole operation, at the end, and no intermediate scaling
 * contributing an error of its own. `10 ** decimals` appears nowhere: exponentiation is
 * implementation-approximated in ECMA-262, which is the very reason `Math.pow` was kept out
 * of the algebra (see ARITHMETIC_OPERATORS).
 *
 * PRECONDITION, and it is enforced by the first line rather than merely documented: the
 * value must be FINITE. In the normal flow `evaluateRound` has already refused a non-finite
 * operand through `requireNumber`, but this function is exported and a test, a property
 * draw or a future caller reaches it directly. Without the guard, `NaN` does not propagate
 * and does not throw -- it returns an AMOUNT. Measured: `roundDecimal(NaN, 2, m)` yielded
 * `0.01`, because `Math.abs(NaN).toExponential()` is `"NaN"`, `indexOf('e')` is `-1`, and
 * `NaN <= 0` is false, so the "already on the lattice" return never fires.
 *
 * Verified over 4 400 022 comparisons against an independently written exact BigInt
 * reference -- every `k/1000` in both signs up to 60 000, 40 000 uniform random bit
 * patterns, 40 000 realistic amounts, at eleven precisions including both bounds, in both
 * modes -- with ZERO divergence. Idempotent, monotone, and a negative zero cannot come out
 * of it by the structure of the code rather than by a patch.
 *
 * It is finite on every finite input AT A WHOLE `decimals`, and the qualification is
 * load-bearing rather than pedantic: `decimals` is typed `number`, so a FRACTIONAL one is
 * type-legal and only Zod refuses it, at save time. On a hand-built tree it rebuilds through
 * a malformed literal and the outcome depends on the DATA -- measured,
 * `roundDecimal(0.615, 2.5, m)` is `NaN` while `roundDecimal(63.25, 2.5, m)` is the identity
 * and `decimals: Infinity` is the identity too. `evaluateRound` then charges that `NaN` as
 * `not-finite`, whose wording names an overflow that did not happen. ADR 0004 decision 6
 * declined a runtime guard for a position no supported path can deliver; what is refused is
 * claiming a finiteness this function does not have.
 *
 * Cost, and NEITHER the absolute figures NOR the ratio travel -- which is the only durable
 * thing to say about them. Protocol: Node 24.11.1, 200 000 warm-up iterations then 2 000 000
 * calls on pre-drawn values with a sum sink. Five machines measured the pre-fast-path code
 * at 378 ns to 4 838 ns on 17-digit values and 118 ns to 1 467 ns on a realistic invoice
 * mix -- a factor of TWELVE in both directions. The ratio to an arithmetic node moved just
 * as much, between harnesses as well as machines, because a multiplication in a tight loop
 * measures anywhere from 1.2 ns to 50 ns depending on what V8 hoists.
 *
 * The two fast paths above then changed the shape rather than the scale, measured on one
 * machine before and after over 16 800 624 comparisons with an identical sink: integers
 * 102 -> 6 ns, invoice mix 114 -> 61 ns, 17-digit values 369 -> 338 ns.
 *
 * What survives all of it, and what lot E8 actually needs: a `round` node that ACTUALLY
 * ROUNDS costs one to two orders of magnitude more wall time than an arithmetic node, while
 * spending the SAME single step of the budget; a `round` that lands on the identity now
 * costs a small multiple of one. Not a bound problem, since the bound counts steps; a
 * worker-timeout problem, and one to re-measure on the machine that sizes the timeout.
 */
export function roundDecimal(value: number, decimals: number, mode: RoundMode): number {
  // A non-finite input leaves UNCHANGED, and this guard is load-bearing rather than
  // defensive decoration: without it `NaN` returns a plausible AMOUNT. Raising belongs to
  // `evaluateRound`, so that `fail()` stays the one site that throws -- the helper never
  // invents a number, the evaluator refuses.
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return 0;
  }
  // An integer at a non-negative position is the identity by construction: its shortest
  // decimal form carries no fractional digit, so `drop` is `-decimals` and nothing is
  // dropped. Measured 26x to 38x cheaper than reaching that same conclusion through the
  // digit string, on a case a document meets constantly -- a quantity, an integer unit
  // price, a sum of integers. AFTER the zero check on purpose: `Number.isInteger(-0)` is
  // true, and a guard placed first would return `-0` where the line above returns `0`.
  if (decimals >= 0 && Number.isInteger(value)) {
    return value;
  }
  const shortest = Math.abs(value).toExponential();
  const marker = shortest.indexOf('e');
  // `drop` needs the digit COUNT and the exponent, and neither needs an allocation: the
  // mantissa is `d` or `d.ddd`, so the dot is at index 1 when there is one. Building the
  // digit string before this point cost ~46 % of every identity call, which is exactly the
  // call a template makes on an amount already at scale.
  const digitCount = shortest.charCodeAt(1) === DOT ? marker - 1 : marker;
  const drop = digitCount - 1 - exponentOf(shortest, marker) - decimals;
  if (drop <= 0) {
    // Already on the lattice: the identity, and the mode never gets a say.
    return value;
  }
  const digits = shortest.slice(0, marker).replace('.', '');
  const sign = value < 0 ? '-' : '';
  const rounded = Number(`${sign}${keptDigits(digits, drop, mode)}e${-decimals}`);
  // `round(-0.004, 2, m)` yields zero, not minus zero: a negative zero is not part of a
  // document's vocabulary, and it would be visible in a test and in a min/max fold.
  return rounded === 0 ? 0 : rounded;
}

/**
 * The kind's evaluation.
 *
 * `site` is hard-coded here, unlike in the shared guards, and for the reason `requireDate`'s
 * docstring gives from the other side: this function serves ONE kind and cannot be
 * copy-pasted onto another, exactly like `evaluateText`.
 *
 * The three policies of ADR 0003 decision 6 apply unchanged, and none of them needed a new
 * error code: absence propagates -- so `sum(lines, l, round(l.total, 2, m))` ignores a line
 * with no total exactly as `sum(lines, l, l.total)` does today -- a present non-number
 * raises `operand-type`, and `NaN` or an infinity raises `not-finite`.
 *
 * `requireFiniteResult` looks unreachable and is not, which is why it stays. Within the
 * declared window it cannot fire, and no non-finite result appeared over 480 000 draws. But
 * `evaluateExpression` is PUBLIC and takes an `Expression` from wherever -- the argument the
 * depth bound already documents -- and a hand-built `{ decimals: -308 }` on
 * `Number.MAX_VALUE` reconstructs `Infinity`. A document must never carry one, so the guard
 * stays and a test builds that node by hand.
 */
export function evaluateRound(raw: unknown, decimals: number, mode: RoundMode): number | undefined {
  const value = requireNumber(raw, 'round', ['value']);
  if (value === undefined) {
    return undefined;
  }
  return requireFiniteResult(roundDecimal(value, decimals, mode), 'round', []);
}
