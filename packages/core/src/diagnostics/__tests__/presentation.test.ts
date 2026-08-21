import { describe, expect, it } from 'vitest';
import {
  diagnosticOfPresentationRefusal,
  diagnosticsOf,
  PRESENTATION_REFUSALS,
  type Presentation,
  type PresentationRefusal,
  resolvePresentation,
} from '../../index.js';

const french: Presentation = {
  locale: 'fr-FR',
  currency: 'EUR',
  minFractionDigits: 2,
  maxFractionDigits: 2,
  dateStyle: 'short',
};

function refusalOf(
  presentations: Readonly<Record<string, Presentation>> | undefined,
  writing: string,
): PresentationRefusal {
  const resolution = resolvePresentation(presentations, writing);
  if (resolution.ok) {
    throw new Error(`The writing "${writing}" resolved; this scenario needs a refusal.`);
  }
  return resolution.refusal;
}

describe('diagnosticOfPresentationRefusal', () => {
  it('names a writing the template never declared', () => {
    const diagnostic = diagnosticOfPresentationRefusal(refusalOf({ 'fr-eur': french }, 'de-eur'));
    expect(diagnostic).toEqual({
      source: 'presentation-resolution',
      code: 'unknown-writing',
      message:
        'This template declares no writing under that name. Add it to the presentations table, or point at a declared one.',
      path: [],
      nodeId: undefined,
    });
  });

  it('names a writing whose fields do not hold together', () => {
    const broken = { 'fr-eur': { ...french, currency: 'euros' } };
    const diagnostic = diagnosticOfPresentationRefusal(refusalOf(broken, 'fr-eur'));
    expect(diagnostic.code).toBe('invalid-writing');
    expect(diagnostic.message).toBe(
      'This writing is unusable. Check its language, currency, fraction digits and date style.',
    );
  });

  it('blames neither the author nor the caller for a tag this engine cannot honour', () => {
    const unhonoured = { 'zz-eur': { ...french, locale: 'zz' } };
    const diagnostic = diagnosticOfPresentationRefusal(refusalOf(unhonoured, 'zz-eur'));
    expect(diagnostic.code).toBe('unhonoured-locale');
    expect(diagnostic.message).toBe(
      'The language this writing names cannot be honoured here. Choose a language this renderer supports.',
    );
  });

  it('gives the three refusals three distinct codes and three distinct sentences', () => {
    const diagnostics = PRESENTATION_REFUSALS.map((refusal) =>
      diagnosticOfPresentationRefusal(refusal),
    );
    expect(new Set(diagnostics.map((diagnostic) => diagnostic.code)).size).toBe(3);
    expect(new Set(diagnostics.map((diagnostic) => diagnostic.message)).size).toBe(3);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.source).toBe('presentation-resolution');
    }
  });

  it('never lets the declared language pick the language of the diagnostic', () => {
    // A writing describes the printed document; a diagnostic addresses the author's tooling. So a
    // refusal of a French writing is worded exactly like a refusal of a Japanese one.
    const messages = ['fr-FR', 'ja-JP', 'ar-EG'].map(
      (locale) =>
        diagnosticOfPresentationRefusal(
          refusalOf({ w: { ...french, locale, currency: 'euros' } }, 'w'),
        ).message,
    );
    expect(new Set(messages).size).toBe(1);
  });

  it('carries the node id and path prefix the consumer supplies', () => {
    const diagnostic = diagnosticOfPresentationRefusal('unknown-writing', {
      nodeId: 'total-amount',
      pathPrefix: ['root', 'children', 4],
    });
    expect(diagnostic.path).toEqual(['root', 'children', 4]);
    expect(diagnostic.nodeId).toBe('total-amount');
  });

  it('stays out of diagnosticsOf, because a refusal is a return value and not a throw', () => {
    expect(diagnosticsOf('unknown-writing')).toBeUndefined();
  });
});
