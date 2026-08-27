/** What one occurrence asking to stay whole resolves to, once its natural height is known. */
export type KeepDecision = 'whole' | 'defer' | 'fallBack';

/**
 * Resolves placement strategy for an unbreakable block against available and fresh page heights.
 */
export function decideKeepTogether(whole: number, available: number, fresh: number): KeepDecision {
  if (whole <= available) {
    return 'whole';
  }
  return whole <= fresh ? 'defer' : 'fallBack';
}
