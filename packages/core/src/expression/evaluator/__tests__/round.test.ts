import { describe, expect, it } from 'vitest';
import {
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  ROUND_MODES,
  type RoundMode,
} from '../../types.js';
import { roundDecimal } from '../operations/round.js';

describe('roundDecimal', () => {
  it.each([
    //  value                   decimals  halfExpand              halfEven
    [0.615, 2, 0.62, 0.62],
    [1.005, 2, 1.01, 1],
    [2.675, 2, 2.68, 2.68],
    [8.575, 2, 8.58, 8.58],
    [0.145, 2, 0.15, 0.14],
    [1.255, 2, 1.26, 1.26],
    [2.125, 2, 2.13, 2.12], // an EXACT tie
    [-2.125, 2, -2.13, -2.12], // symmetric on the sign
    [0.125, 2, 0.13, 0.12],
    [0.5, 0, 1, 0],
    [1.5, 0, 2, 2],
    [2.5, 0, 3, 2],
    [-2.5, 0, -3, -2], // Math.round would answer -2
    [-0.5, 0, -1, 0],
    [50, -2, 100, 0],
    [150, -2, 200, 200],
    [1250, -2, 1300, 1200],
    [-1250, -2, -1300, -1200],
    [1234.5, -2, 1200, 1200],
    [120, -1, 120, 120], // the adjacency trap
    [0.30000000000000004, 2, 0.3, 0.3],
    [63.260000000000005, 2, 63.26, 63.26],
    [0.3333333333333333, 2, 0.33, 0.33],
    [5e-324, 2, 0, 0],
    [9007199254740991, 2, 9007199254740991, 9007199254740991],
    [1.7976931348623157e308, -15, 1.7976931348623157e308, 1.7976931348623157e308],
    // The FULL carry: the one branch that grows the digit string by a position
    // ("99" -> "100"). None of the twenty-six vectors above reaches it.
    [0.999, 2, 1, 1],
    [9.99, 1, 10, 10],
    [-9.995, 2, -10, -10], // the sign is rebuilt AFTER the carry
    [9.5, 0, 10, 10],
    [999.5, 0, 1000, 1000],
    // The two branches no vector above exercised, found by instrumentation.
    [0, 2, 0, 0], // the zero input: a continuous draw never reaches it
    [2.1251, 2, 2.13, 2.13], // a hair past the half: `restNonZero` wins, halfEven included
    [-5e-324, 2, 0, 0], // negative subnormal: `toBe` being `Object.is`, this vector ALONE
    //                     pins the unsigned zero
  ])('pins the frozen rounding vector round(%o, %o)', (value, decimals, expand, even) => {
    expect(roundDecimal(value, decimals, 'halfExpand')).toBe(expand);
    expect(roundDecimal(value, decimals, 'halfEven')).toBe(even);
  });

  it('makes the declared mode REAL, which a binary semantics would not', () => {
    // Under a BINARY semantics this assertion would be FALSE: `0.145` is not an exact tie
    // there, so both modes would answer the same digit. This is what keeps `mode` from
    // being decorative -- measured, the mode changes the result 25 times more often on the
    // printed decimal than on the binary value underneath.
    expect(roundDecimal(0.145, 2, 'halfExpand')).not.toBe(roundDecimal(0.145, 2, 'halfEven'));
  });

  it.each([Number.NaN, Infinity, -Infinity])('leaves the non-finite %o unchanged', (value) => {
    for (const decimals of [-2, 0, 2]) {
      // Without the finiteness guard, `NaN` came out of here as `100`, `1` and `0.01`
      // respectively: `Math.abs(NaN).toExponential()` is `"NaN"`, `indexOf('e')` is `-1`,
      // and `NaN <= 0` is false, so the "already on the lattice" return never fired. A NaN
      // was neither propagated nor refused -- it was turned into a cent.
      expect(roundDecimal(value, decimals, 'halfExpand')).toBe(value);
      expect(roundDecimal(value, decimals, 'halfEven')).toBe(value);
    }
  });

  it.each(ROUND_MODES)('never yields a negative zero, in %s', (mode) => {
    // `toBe` is `Object.is`, so `expect(-0).toBe(0)` FAILS: these three assertions are the
    // Object.is assertions, written the way the rest of the suite writes them. A negative
    // zero is not part of a document's vocabulary, and it would show up in a min/max fold.
    expect(roundDecimal(-0.004, 2, mode)).toBe(0);
    expect(roundDecimal(-0, 2, mode)).toBe(0);
    expect(roundDecimal(-0.4, 0, mode)).toBe(0);
  });

  it('overflows only from a position built outside the declared window', () => {
    // The reserve behind `requireFiniteResult`: a `decimals` of -308 cannot come through
    // Zod, but `evaluateExpression` is public and takes an `Expression` from wherever. The
    // pure function guards nothing on its own -- the evaluator is what refuses.
    expect(roundDecimal(1.7976931348623157e308, -308, 'halfExpand')).toBe(Infinity);
    expect(roundDecimal(-1.7976931348623157e308, -308, 'halfEven')).toBe(-Infinity);
  });
});

/**
 * The rounding of D2, written a second time and by other means: the shortest
 * round-tripping decimal is expanded into an EXACT integer, divided by an exact power of
 * ten, and the tie is broken by comparing twice the remainder to the divisor.
 *
 * BigInt is deliberately absent from production (ADR 0003 decision 4, and D12 of the C2
 * plan). It belongs here for the opposite reason: an oracle has to be exact, and it has to
 * share as little as possible with what it checks. `Intl.NumberFormat` was refused as the
 * committed oracle because its result is indexed on an ICU build; this one is indexed on
 * nothing.
 */
function referenceRound(value: number, decimals: number, mode: RoundMode): number {
  if (!Number.isFinite(value) || value === 0) {
    return value === 0 ? 0 : value;
  }
  const shortest = Math.abs(value).toExponential();
  const marker = shortest.indexOf('e');
  const exponent = Number(shortest.slice(marker + 1));
  const digits = shortest.slice(0, marker).replace('.', '');
  const shift = exponent - digits.length + 1 + decimals;
  let scaled = BigInt(digits);
  if (shift >= 0) {
    scaled *= 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const remainder = scaled % divisor;
    scaled /= divisor;
    const twice = remainder * 2n;
    if (twice > divisor || (twice === divisor && (mode === 'halfExpand' || scaled % 2n === 1n))) {
      scaled += 1n;
    }
  }
  const rounded = Number(`${value < 0 ? '-' : ''}${scaled}e${-decimals}`);
  return rounded === 0 ? 0 : rounded;
}

/**
 * The PRNG the whole file draws from, written here rather than imported.
 *
 * `Math.random` is refused by the machine under `packages/core/**` -- `biome.jsonc`'s
 * `noJsRestrictedProperties` override names it, and nothing there excludes a `*.test.ts`.
 * A test that drew from it would stop at gate 1. The deeper reason is the same one E6
 * states for the engine: an irreproducible test measures nothing. Seeded, a divergence
 * found in CI reproduces byte for byte in a local `-t` run of the single `it`.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * The population, in two halves that do not cover the same thing.
 *
 * - **Amounts**: `sign * integer in [0, 1e12) / 10 ** p`, `p` in `[0, 6]`. Their decimal
 *   writing is SHORT -- the real case, the one that produces exact ties and therefore makes
 *   the `mode` field work.
 * - **Arbitrary doubles**: a full 52-bit mantissa, an exponent in `[-40, 40]`. Their decimal
 *   writing is LONG -- the case that works the digit-string surgery.
 *
 * The non-finite values are not drawn: they have their own `it` above.
 */
function drawPopulation(seed: number, half: number): readonly number[] {
  const random = mulberry32(seed);
  const values: number[] = [];
  for (let index = 0; index < half; index += 1) {
    const units = Math.floor(random() * 1e6) * 1e6 + Math.floor(random() * 1e6);
    const scale = 10 ** Math.floor(random() * 7);
    values.push((random() < 0.5 ? -1 : 1) * (units / scale));
  }
  for (let index = 0; index < half; index += 1) {
    const mantissa = Math.floor(random() * 2 ** 26) * 2 ** 26 + Math.floor(random() * 2 ** 26);
    const exponent = Math.floor(random() * 81) - 40;
    values.push((random() < 0.5 ? -1 : 1) * (1 + mantissa / 2 ** 52) * 2 ** exponent);
  }
  return values;
}

/** Both bounds of the window, and nine positions in between. */
const POSITIONS = [-15, -9, -5, -2, 0, 1, 2, 3, 5, 9, 15] as const;

/**
 * One `it` per position, and that is a matter of ergonomics rather than style.
 *
 * The whole matrix costs a few seconds -- fine for the four gates, unbearable in an edit
 * loop. Split this way, `pnpm vitest round -t "frozen"` replays the 34 vectors in
 * milliseconds during a refactor of `keptDigits`, and the matrix only runs again at commit
 * time. Without the split the only available granularity is the file, and a developer who
 * pays for the matrix on every save ends up disabling the suite -- which is the ordinary
 * way an exact oracle dies.
 *
 * Each `it` RESTARTS FROM ITS OWN SEED. A single stream carried from one `it` to the next
 * would make every one of them depend on the execution order, which Vitest does not
 * guarantee, and `-t` on a single `it` would then replay a different population.
 */
describe('roundDecimal -- property matrix against the BigInt reference', () => {
  it.each(POSITIONS)('agrees with the exact reference at %o decimals', (decimals) => {
    const values = drawPopulation(0x9e3779b9 ^ (decimals + 16), 10_000);
    const divergences: string[] = [];

    for (const value of values) {
      for (const mode of ROUND_MODES) {
        const mine = roundDecimal(value, decimals, mode);
        const theirs = referenceRound(value, decimals, mode);
        if (!Object.is(mine, theirs)) {
          divergences.push(`round(${value}, ${decimals}, ${mode}): ${mine} vs ${theirs}`);
        }
      }
    }

    expect(divergences.slice(0, 5)).toStrictEqual([]);
  });
});

describe('roundDecimal -- the structural properties', () => {
  const values = drawPopulation(0x5bf03635, 1_000);

  it('is idempotent at every position of the window', () => {
    // Rounding a rounded value changes nothing: the shortest decimal form of the result IS
    // the multiple of `10 ** -decimals`, so a second pass drops no digit at all.
    const violations: string[] = [];
    for (const decimals of POSITIONS) {
      for (const mode of ROUND_MODES) {
        for (const value of values) {
          const once = roundDecimal(value, decimals, mode);
          const twice = roundDecimal(once, decimals, mode);
          if (!Object.is(once, twice)) {
            violations.push(`round(${value}, ${decimals}, ${mode}): ${once} then ${twice}`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toStrictEqual([]);
  });

  it('is monotone: a larger value never rounds to a smaller one', () => {
    const sorted = [...values].sort((left, right) => left - right);
    const violations: string[] = [];
    for (const decimals of POSITIONS) {
      for (const mode of ROUND_MODES) {
        for (let index = 1; index < sorted.length; index += 1) {
          const previous = sorted[index - 1];
          const current = sorted[index];
          if (previous === undefined || current === undefined) {
            continue;
          }
          if (roundDecimal(previous, decimals, mode) > roundDecimal(current, decimals, mode)) {
            violations.push(`round(${previous}, ${decimals}, ${mode}) > round(${current}, ...)`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toStrictEqual([]);
  });

  it('yields a finite, never negatively signed zero inside the declared window', () => {
    const violations: string[] = [];
    for (let decimals = MIN_ROUND_DECIMALS; decimals <= MAX_ROUND_DECIMALS; decimals += 1) {
      for (const mode of ROUND_MODES) {
        for (const value of values) {
          const rounded = roundDecimal(value, decimals, mode);
          if (!Number.isFinite(rounded) || Object.is(rounded, -0)) {
            violations.push(`round(${value}, ${decimals}, ${mode}) = ${rounded}`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toStrictEqual([]);
  });
});
