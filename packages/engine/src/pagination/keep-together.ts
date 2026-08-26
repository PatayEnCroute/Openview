/** What one occurrence asking to stay whole resolves to, once its natural height is known. */
export type KeepDecision = 'whole' | 'defer' | 'fallBack';

/**
 * The three ordered branches a mark resolves to, and the only place their order is written.
 *
 * It fits where it stands, so it is placed whole; else a page holding nothing else could hold it,
 * so the page closes without it; else no page can, so the mark stops blocking and the kind uses the
 * policy it would have used unmarked.
 *
 * That third branch is the termination argument, not a concession: without it an occurrence taller
 * than any page would be deferred to a fresh page for ever, and a mark could turn a printable
 * document into a refusal or a loop.
 */
export function decideKeepTogether(whole: number, available: number, fresh: number): KeepDecision {
  if (whole <= available) {
    return 'whole';
  }
  return whole <= fresh ? 'defer' : 'fallBack';
}
