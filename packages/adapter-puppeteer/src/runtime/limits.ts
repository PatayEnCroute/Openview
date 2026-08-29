import { z } from 'zod/v4';
import { InvalidProtectedConfigurationError } from '../resource/errors.js';
import { MIB } from '../resource/types.js';

/** Bounds on isolation, waiting and recycling, beyond the ones a resource or a document has. */
export interface ProtectedRuntimeLimits {
  /** Workers and browsers this runtime owns, and therefore renders it may run at once. */
  readonly slots: number;
  /** Requests it may hold while every slot is taken. */
  readonly queueDepth: number;
  /** Wall-clock a held request may wait, in milliseconds. */
  readonly queueTimeoutMs: number;
  /** Wall-clock one render may hold a slot, in milliseconds. */
  readonly renderTimeoutMs: number;
  /** Wall-clock a browser is given to close before it is killed, in milliseconds. */
  readonly shutdownTimeoutMs: number;
  /** Old generation of one worker isolate, in mebibytes. */
  readonly workerOldSpaceMb: number;
  /** Stack of one worker isolate, in mebibytes. */
  readonly workerStackMb: number;
  /** Renders after which a worker and its browser are recycled, fault or not. */
  readonly maxRendersPerWorker: number;
  /** Values one request may carry across the thread boundary. */
  readonly maxTransportValues: number;
  /** Sum of the lengths of its strings, in utf-16 code units. */
  readonly maxTransportStringLength: number;
}

/**
 * What a caller may name when it configures the bounds.
 *
 * An explicit `undefined` reads as an omission, so a host forwarding an optional configuration does
 * not have to delete the keys it has no value for.
 */
export type ProtectedRuntimeLimitsOverrides = {
  readonly [K in keyof ProtectedRuntimeLimits]?: ProtectedRuntimeLimits[K] | undefined;
};

/**
 * Defaults chosen without reading the machine.
 *
 * One slot rather than a share of the cpus: a runtime whose capacity depends on the host would
 * produce a different refusal on two machines, and reading `availableParallelism()` is exactly the
 * environment read this engine refuses everywhere else.
 */
export const DEFAULT_RUNTIME_LIMITS: ProtectedRuntimeLimits = {
  slots: 1,
  queueDepth: 4,
  queueTimeoutMs: 5_000,
  renderTimeoutMs: 30_000,
  shutdownTimeoutMs: 5_000,
  workerOldSpaceMb: 256,
  workerStackMb: 4,
  maxRendersPerWorker: 100,
  maxTransportValues: 500_000,
  maxTransportStringLength: 64 * MIB,
};

/** Highest value each bound may be configured to. */
export const RUNTIME_HARD_CEILINGS: ProtectedRuntimeLimits = {
  slots: 32,
  queueDepth: 40,
  queueTimeoutMs: 600_000,
  renderTimeoutMs: 600_000,
  shutdownTimeoutMs: 600_000,
  workerOldSpaceMb: 2_560,
  workerStackMb: 40,
  maxRendersPerWorker: 1_000,
  maxTransportValues: 5_000_000,
  maxTransportStringLength: 640 * MIB,
};

const INVALID =
  'A runtime limit must be a whole number between 1 and its hard ceiling. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `slots: 0` accepts nothing and `renderTimeoutMs: NaN` never expires.';

const bounded = (ceiling: number): z.ZodType<number> =>
  z
    .number()
    .int('A runtime limit must be a whole number')
    .min(1, 'A runtime limit may not go below 1')
    .max(ceiling, `A runtime limit may not exceed ${ceiling}`);

/** Validation of the runtime bounds, refusing unknown keys rather than dropping them. */
export const ProtectedRuntimeLimitsSchema: z.ZodType<ProtectedRuntimeLimits> = z
  .strictObject({
    slots: bounded(RUNTIME_HARD_CEILINGS.slots),
    queueDepth: bounded(RUNTIME_HARD_CEILINGS.queueDepth),
    queueTimeoutMs: bounded(RUNTIME_HARD_CEILINGS.queueTimeoutMs),
    renderTimeoutMs: bounded(RUNTIME_HARD_CEILINGS.renderTimeoutMs),
    shutdownTimeoutMs: bounded(RUNTIME_HARD_CEILINGS.shutdownTimeoutMs),
    workerOldSpaceMb: bounded(RUNTIME_HARD_CEILINGS.workerOldSpaceMb),
    workerStackMb: bounded(RUNTIME_HARD_CEILINGS.workerStackMb),
    maxRendersPerWorker: bounded(RUNTIME_HARD_CEILINGS.maxRendersPerWorker),
    maxTransportValues: bounded(RUNTIME_HARD_CEILINGS.maxTransportValues),
    maxTransportStringLength: bounded(RUNTIME_HARD_CEILINGS.maxTransportStringLength),
  })
  .readonly();

/** Fills the bounds the caller left out and refuses the ones it got wrong. */
export function resolveRuntimeLimits(
  overrides?: ProtectedRuntimeLimitsOverrides | undefined,
): ProtectedRuntimeLimits {
  if (overrides === undefined) {
    return DEFAULT_RUNTIME_LIMITS;
  }
  const filled: Record<string, unknown> = { ...DEFAULT_RUNTIME_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      filled[key] = value;
    }
  }
  const parsed = ProtectedRuntimeLimitsSchema.safeParse(filled);
  if (!parsed.success) {
    throw new InvalidProtectedConfigurationError(INVALID, { cause: parsed.error });
  }
  return parsed.data;
}
