import {
  formatDate,
  formatDecimal,
  formatMoney,
  type Presentation,
  type PresentationTable,
} from '@openview/core';
import { describe, expect, it } from 'vitest';
import { templateOf } from '../../__tests__/fixtures.js';
import { DocumentRenderError } from '../../errors.js';
import { reachableOccurrences } from '../bands.js';
import { extendBands, materializeDocument } from '../materialize.js';
import {
  createPresentationSession,
  type MarkerWriting,
  reportFractionDigits,
  sampleMarker,
  writeMarker,
  writeValue,
} from '../presentation.js';
import type { MaterialBlock } from '../types.js';

/**
 * The writings this file names. They belong to the fixture: Openview reserves neither the keys nor
 * the profiles a model maps onto them.
 */
const WRITINGS = {
  'fr-eur-2': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'long',
  },
  'en-usd-2': {
    locale: 'en-US',
    currency: 'USD',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'medium',
  },
  'fr-decimal-3': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 0,
    maxFractionDigits: 3,
    dateStyle: 'short',
  },
  'fr-whole': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 0,
    maxFractionDigits: 0,
    dateStyle: 'short',
  },
} as const satisfies PresentationTable;

/**
 * Two declarations the stored contract refuses, which is why they are never put in a template.
 *
 * The resolver parses every entry it reads, so a table that never went through the template gate --
 * the shape a session is handed in these unit tests -- is the only way to reach its two other
 * causes at all.
 */
const UNUSABLE = {
  'broken-bounds': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 4,
    maxFractionDigits: 2,
    dateStyle: 'short',
  },
  'unhonoured-locale': {
    locale: 'zz-ZZ',
    currency: 'EUR',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'short',
  },
} as const satisfies PresentationTable;

const TABLE: PresentationTable = { ...WRITINGS, ...UNUSABLE };

/** No site, no page: a detail bag a unit test has nothing to put in. */
const NOWHERE = {} as const;

const sessionOf = (selection: Record<string, string> | undefined) =>
  createPresentationSession(TABLE, selection);

/** The writing a key really resolves to, so an expectation compares against the resolver. */
function writingAt(key: keyof typeof WRITINGS): Presentation {
  return sessionOf({ probe: key }).resolve({ kind: 'money', profile: 'probe' }, NOWHERE)
    .presentation;
}

/** A marker writing built from a resolved one, for the two functions a marker may name. */
const markerAt = (key: keyof typeof WRITINGS, kind: 'money' | 'decimal'): MarkerWriting => ({
  presentation: writingAt(key),
  id: 'w1',
  kind,
});

/** The refusal one call raises, so a test reads its code and details without an assertion. */
function refusalOf(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the call should have refused');
}

describe('the writings one render selects', () => {
  it('maps a profile the model named to the writing the caller chose', () => {
    const found = sessionOf({ amount: 'fr-eur-2' }).resolve(
      { kind: 'money', profile: 'amount' },
      NOWHERE,
    );

    expect(found.presentation.locale).toBe('fr-FR');
    expect(found.presentation.currency).toBe('EUR');
  });

  it('refuses a profile the caller selected nothing for, without naming it', () => {
    const error = refusalOf(() =>
      sessionOf({ amount: 'fr-eur-2' }).resolve(
        { kind: 'decimal', profile: 'quantity' },
        {
          nodeId: 'q',
        },
      ),
    );

    expect(error.code).toBe('presentation-refused');
    expect(error.details).toMatchObject({ nodeId: 'q', formatKind: 'decimal' });
    expect(error.message).not.toContain('quantity');
  });

  it('refuses a selection with no table behind it at all', () => {
    const error = refusalOf(() =>
      createPresentationSession(undefined, { amount: 'fr-eur-2' }).resolve(
        { kind: 'money', profile: 'amount' },
        NOWHERE,
      ),
    );

    expect(error.details.presentationRefusal).toBe('unknown-writing');
  });

  it.each([
    ['a key the table does not declare', 'absent', 'unknown-writing'],
    ['a writing the contract refuses', 'broken-bounds', 'invalid-writing'],
    ['a locale this engine does not honour', 'unhonoured-locale', 'unhonoured-locale'],
  ] as const)('keeps the cause the resolver named for %s', (_label, key, cause) => {
    // The three causes stay distinguished: a caller reading `details.presentationRefusal` learns
    // whether to fix its selection, the declaration, or its expectation of the runtime.
    const error = refusalOf(() =>
      sessionOf({ amount: key }).resolve({ kind: 'money', profile: 'amount' }, NOWHERE),
    );

    expect(error.code).toBe('presentation-refused');
    expect(error.details.presentationRefusal).toBe(cause);
  });

  it('gives an unselected profile no false cause of its own', () => {
    // The resolver was never called, so there is nothing for it to have said. Reporting
    // `unknown-writing` here would send a caller looking for a declaration that is not the fault.
    const error = refusalOf(() =>
      sessionOf({}).resolve({ kind: 'money', profile: 'amount' }, NOWHERE),
    );

    expect(Object.hasOwn(error.details, 'presentationRefusal')).toBe(false);
  });

  it('reads the selection and the table as own properties alone', () => {
    // `constructor` reaches a function through a plain lookup on either table, and neither table
    // declares it. Both readings have to see nothing.
    expect(
      refusalOf(() =>
        sessionOf({ amount: 'constructor' }).resolve({ kind: 'money', profile: 'amount' }, NOWHERE),
      ).details.presentationRefusal,
    ).toBe('unknown-writing');

    expect(
      Object.hasOwn(
        refusalOf(() =>
          sessionOf({ constructor: 'fr-eur-2' }).resolve(
            { kind: 'money', profile: 'toString' },
            NOWHERE,
          ),
        ).details,
        'presentationRefusal',
      ),
    ).toBe(false);
  });

  it('keeps a profile and a writing really named `constructor` usable', () => {
    // The guard is about inheritance, not about the spelling: a name the caller really declared
    // stays a name, whatever `Object.prototype` also carries.
    const table: PresentationTable = { constructor: WRITINGS['fr-eur-2'] };
    const session = createPresentationSession(table, { constructor: 'constructor' });

    expect(
      session.resolve({ kind: 'money', profile: 'constructor' }, NOWHERE).presentation.currency,
    ).toBe('EUR');
  });

  it('resolves one writing key once, however many sites ask for it', () => {
    const session = sessionOf({ amount: 'fr-eur-2', total: 'fr-eur-2' });
    const first = session.resolve({ kind: 'money', profile: 'amount' }, NOWHERE);

    for (let round = 0; round < 100; round += 1) {
      /* The SAME object, not an equal one: two resolutions of one key would mean two parses and two
         locale checks per render, which is what E4-3 forbids. */
      expect(session.resolve({ kind: 'money', profile: 'amount' }, NOWHERE)).toBe(first);
    }
    /* And two profiles that chose the same writing share that one resolution. */
    expect(session.resolve({ kind: 'money', profile: 'total' }, NOWHERE)).toBe(first);
    expect(session.resolved).toBe(1);
  });

  it('resolves three distinct writings three times, and gives each its own identity', () => {
    const session = sessionOf({
      amount: 'fr-eur-2',
      quantity: 'fr-decimal-3',
      foreign: 'en-usd-2',
    });

    const ids = new Set(
      (['amount', 'quantity', 'foreign'] as const).map(
        (profile) => session.resolve({ kind: 'decimal', profile }, NOWHERE).id,
      ),
    );

    expect(session.resolved).toBe(3);
    expect(ids.size).toBe(3);
  });

  it('canonicalises the writing exactly as the resolver does, and no further', () => {
    // E4-10: nothing here assembles a `Presentation`. What a site gets is what the resolver
    // returned, so a locale is canonical because the resolver made it so.
    const session = sessionOf({ amount: 'en-usd-2' });

    expect(
      session.resolve({ kind: 'money', profile: 'amount' }, NOWHERE).presentation,
    ).toStrictEqual(writingAt('en-usd-2'));
  });
});

describe('the scale a page report demands of its writing', () => {
  const REPORT = { kind: 'money', profile: 'amount' } as const;

  it('accepts the writing whose maximum matches the rounding declared', () => {
    expect(sessionOf({ amount: 'fr-eur-2' }).resolveReport(REPORT, 2, NOWHERE).kind).toBe('money');
  });

  it.each([
    ['a coarser writing, which would round the figure again', 'fr-whole'],
    ['a finer writing, which would print digits the rounding removed', 'fr-decimal-3'],
  ] as const)('refuses %s', (_label, key) => {
    const error = refusalOf(() => sessionOf({ amount: key }).resolveReport(REPORT, 2, NOWHERE));

    expect(error.code).toBe('presentation-refused');
    expect(error.details).toMatchObject({ limit: 2, formatKind: 'money' });
  });

  it('asks a report rounded to tens or hundreds for a writing with no fraction at all', () => {
    // A negative rounding position leaves no fraction to print, so the writing that matches it is
    // the one whose maximum is zero.
    expect(reportFractionDigits(-2)).toBe(0);
    expect(reportFractionDigits(0)).toBe(0);
    expect(reportFractionDigits(3)).toBe(3);

    expect(
      sessionOf({ amount: 'fr-whole' }).resolveReport(REPORT, -2, NOWHERE).presentation
        .maxFractionDigits,
    ).toBe(0);
  });

  it('resolves a counter without asking anything of its scale', () => {
    // A counter writes a whole number of pages, so the writing's fraction bounds are the author's
    // business: only a report has a declared rounding a writing could contradict.
    const writing = sessionOf({ rank: 'fr-decimal-3' }).resolveCounter(
      { kind: 'decimal', profile: 'rank' },
      NOWHERE,
    );

    expect(writing.kind).toBe('decimal');
    expect(writing.presentation.maxFractionDigits).toBe(3);
  });
});

describe('writing one value at the site that asked for it', () => {
  const EUR = writingAt('fr-eur-2');
  const DECIMAL = writingAt('fr-decimal-3');

  it('writes an amount, a quantity and a date through the core formatters', () => {
    // Compared against the formatter of the SAME build rather than against a pinned string: an ICU
    // upgrade may respell a currency, and a golden here would pin the version, not the contract.
    expect(writeValue({ kind: 'money', profile: 'a' }, EUR, 1234.5, NOWHERE)).toBe(
      formatMoney(1234.5, EUR),
    );
    expect(writeValue({ kind: 'decimal', profile: 'q' }, DECIMAL, 1234.5, NOWHERE)).toBe(
      formatDecimal(1234.5, DECIMAL),
    );
    expect(writeValue({ kind: 'date', profile: 'd' }, EUR, '2026-03-02', NOWHERE)).toBe(
      formatDate('2026-03-02', EUR),
    );
  });

  it.each([
    ['a string that looks like a number', '1234.5'],
    ['nothing at all', undefined],
    ['a null', null],
    ['a boolean', true],
    ['an infinity', Number.POSITIVE_INFINITY],
    ['a not-a-number', Number.NaN],
  ] as const)('refuses %s at a numeric site, without repeating it', (_label, value) => {
    // No number is read out of a string: a host that supplies `"1234.5"` supplied text, and
    // coercing it silently would make the engine guess what its data means.
    const error = refusalOf(() =>
      writeValue({ kind: 'money', profile: 'amount' }, EUR, value, { nodeId: 'total' }),
    );

    expect(error.code).toBe('unformattable-binding-value');
    expect(error.details).toMatchObject({ nodeId: 'total', formatKind: 'money' });
    expect(error.message).not.toContain(String(value));
  });

  it.each([
    ['a value that is not text', 20_260_014],
    ['text that is not a date', 'the second of March'],
    ['a date outside the calendar', '2026-02-30'],
  ] as const)('refuses %s at a date site', (_label, value) => {
    const error = refusalOf(() => writeValue({ kind: 'date', profile: 'd' }, EUR, value, NOWHERE));

    expect(error.code).toBe('unformattable-binding-value');
    expect(error.details.formatKind).toBe('date');
  });

  it('names the category of what arrived, and only the category', () => {
    const error = refusalOf(() =>
      writeValue({ kind: 'decimal', profile: 'q' }, DECIMAL, 'A-1', NOWHERE),
    );

    expect(error.details.actualType).toBe('string');
    expect(error.message).not.toContain('A-1');
  });

  it('writes a negative zero as a zero, exactly as the formatter does', () => {
    expect(writeValue({ kind: 'decimal', profile: 'q' }, DECIMAL, -0, NOWHERE)).toBe(
      formatDecimal(0, DECIMAL),
    );
  });

  it('refuses rather than leave a formatted position blank', () => {
    // The policy is failure, never a blank: a marker with no characters in a printed position reads
    // as though the figure were zero.
    const marker = markerAt('fr-eur-2', 'money');

    expect(sampleMarker(marker, Number.NaN)).toBeUndefined();
    expect(refusalOf(() => writeMarker(marker, Number.NaN, NOWHERE)).code).toBe(
      'unformattable-binding-value',
    );
  });

  it('never rounds on its own: a marker writes the value it was handed', () => {
    // `Intl` is handed no rounding mode, so a value that still needs rounding has to arrive
    // rounded. Both spellings below come out of the writing, not out of a second policy.
    const marker = markerAt('fr-whole', 'decimal');

    expect(writeMarker(marker, 2, NOWHERE)).toBe(formatDecimal(2, marker.presentation));
    expect(writeMarker(marker, 2.5, NOWHERE)).toBe(formatDecimal(2.5, marker.presentation));
  });

  it('prints an unknown but well-formed currency as itself, with no table of fallbacks', () => {
    // E4-5. The engine holds no ISO list: what a declaration says is what is printed, and a
    // currency it does not recognise is not an error of the model.
    const table: PresentationTable = {
      exotic: { ...WRITINGS['fr-eur-2'], currency: 'ZZZ' },
    };
    const session = createPresentationSession(table, { amount: 'exotic' });
    const writing = session.resolve({ kind: 'money', profile: 'amount' }, NOWHERE);

    const written = writeValue(
      { kind: 'money', profile: 'amount' },
      writing.presentation,
      12.5,
      NOWHERE,
    );

    expect(written).toContain('ZZZ');
    expect(written).not.toContain('EUR');
    expect(written).not.toContain('$');
  });
});

describe('when a render resolves the writings it needs', () => {
  const site = (id: string, profile: string, path: string) => ({
    type: 'text',
    id,
    content: [
      { kind: 'binding', value: { kind: 'path', path }, format: { kind: 'money', profile } },
    ],
  });

  const DATA = { payload: { amount: 12.5, quantity: 3 } };

  const written = (children: readonly Record<string, unknown>[], page?: Record<string, unknown>) =>
    templateOf({
      presentations: WRITINGS,
      ...(page === undefined ? {} : { page }),
      root: { type: 'container', id: 'root', children },
    });

  const A4 = {
    sheet: { width: 210, height: 297 },
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    header: [],
  };

  it('resolves nothing for a site no page reaches', () => {
    // A false condition names a profile the caller selected nothing for, and the render succeeds:
    // laziness is what lets one stored template carry sites a given configuration never prints.
    const bound = materializeDocument(
      written([
        {
          type: 'condition',
          id: 'never',
          when: { kind: 'literal', value: false },
          children: [site('unreachable', 'exotic', 'payload.amount')],
        },
      ]),
      DATA,
      reachableOccurrences(1),
      undefined,
      { amount: 'fr-eur-2' },
    );

    expect(bound.presentations.resolved).toBe(0);
  });

  it('resolves a writing once across the flow and a band bound later', () => {
    // The second pass binds the domains the one-page hypothesis left out. It must reuse the session
    // of the first, or a profile present in both is parsed and locale-checked twice per render.
    const template = written([site('inflow', 'amount', 'payload.amount')], {
      ...A4,
      footer: [
        {
          on: 'exceptFirst',
          content: {
            type: 'container',
            id: 'foot',
            children: [site('carried', 'amount', 'payload.amount')],
          },
        },
      ],
    });

    const first = materializeDocument(template, DATA, reachableOccurrences(1), undefined, {
      amount: 'fr-eur-2',
    });
    expect(first.presentations.resolved).toBe(1);

    const widened = extendBands(template, DATA, first, reachableOccurrences(2));

    expect(widened.presentations).toBe(first.presentations);
    expect(widened.presentations.resolved).toBe(1);
  });

  it('leaves a site that declares no writing byte for byte as it was', () => {
    const canonical = materializeDocument(
      written([
        {
          type: 'text',
          id: 'plain',
          content: [{ kind: 'binding', value: { kind: 'path', path: 'payload.amount' } }],
        },
      ]),
      DATA,
      reachableOccurrences(1),
    );

    expect(textOf(canonical.document.root[0])).toBe('12.5');
  });

  it('writes the same stored site two ways under two selections', () => {
    // The recette in one assertion: one template object, two selections, two writings, and nothing
    // about the stored document different between them.
    const template = written([site('amount', 'amount', 'payload.amount')]);

    const french = materializeDocument(template, DATA, reachableOccurrences(1), undefined, {
      amount: 'fr-eur-2',
    });
    const english = materializeDocument(template, DATA, reachableOccurrences(1), undefined, {
      amount: 'en-usd-2',
    });

    expect(textOf(french.document.root[0])).toBe(formatMoney(12.5, writingAt('fr-eur-2')));
    expect(textOf(english.document.root[0])).toBe(formatMoney(12.5, writingAt('en-usd-2')));
    /* And no session outlives its render, so the second is not reading the first one's cache. */
    expect(french.presentations).not.toBe(english.presentations);
  });

  it('refuses the whole render when a reachable site names an unselected profile', () => {
    const error = refusalOf(() =>
      materializeDocument(
        written([site('amount', 'amount', 'payload.amount')]),
        DATA,
        reachableOccurrences(1),
        undefined,
        {},
      ),
    );

    expect(error.code).toBe('presentation-refused');
    expect(error.details.nodeId).toBe('amount');
  });

  it('carries the resolved writing on a page marker instead of writing it early', () => {
    const bound = materializeDocument(
      written([
        {
          type: 'text',
          id: 'foot',
          content: [
            { kind: 'pageField', field: 'number', format: { kind: 'decimal', profile: 'rank' } },
            {
              kind: 'pageField',
              field: 'report',
              decimals: 2,
              mode: 'halfEven',
              format: { kind: 'money', profile: 'amount' },
            },
          ],
        },
      ]),
      DATA,
      reachableOccurrences(1),
      undefined,
      { rank: 'fr-decimal-3', amount: 'fr-eur-2' },
    );

    const [container] = bound.document.root;
    if (container?.kind !== 'container' || container.children[0]?.kind !== 'text') {
      throw new Error('the fixture should carry a text block of markers');
    }
    const [counter, report] = container.children[0].runs;

    expect(counter).toMatchObject({
      kind: 'pageField',
      field: 'number',
      writing: { kind: 'decimal' },
    });
    expect(report).toMatchObject({
      kind: 'pageField',
      field: 'report',
      writing: { kind: 'money' },
    });
  });

  it('leaves a marker that declares no writing with no key for one', () => {
    const bound = materializeDocument(
      written([
        {
          type: 'text',
          id: 'foot',
          content: [
            { kind: 'pageField', field: 'count' },
            { kind: 'pageField', field: 'report', decimals: 2, mode: 'halfEven' },
          ],
        },
      ]),
      DATA,
      reachableOccurrences(1),
    );

    const [container] = bound.document.root;
    if (container?.kind !== 'container' || container.children[0]?.kind !== 'text') {
      throw new Error('the fixture should carry a text block of markers');
    }
    for (const run of container.children[0].runs) {
      expect(Object.hasOwn(run, 'writing')).toBe(false);
    }
  });
});

/** The characters one materialised text block prints, runs joined in order. */
function textOf(block: MaterialBlock | undefined): string {
  if (block?.kind !== 'container') {
    throw new Error('the fixture should carry a root container');
  }
  const [text] = block.children;
  if (text?.kind !== 'text') {
    throw new Error('the fixture should carry a text block');
  }
  return text.runs.map((run) => (run.kind === 'text' ? run.text : '')).join('');
}
