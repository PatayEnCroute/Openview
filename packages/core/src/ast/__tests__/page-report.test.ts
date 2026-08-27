import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import { diagnosticsOf } from '../../diagnostics/diagnostics.js';
import * as core from '../../index.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import { PAGE_FIELD_NAME_MESSAGE } from '../../validation-messages.js';
import {
  type PageReportContribution,
  type PageReportContributionSchema,
  type TableRowNode,
  TableRowNodeSchema,
  TextNodeSchema,
  type TextPageCountSegment,
  type TextPageCountSegmentSchema,
  type TextPageFieldSegment,
  type TextPageFieldSegmentSchema,
  type TextPageReportSegment,
  type TextPageReportSegmentSchema,
} from '../nodes.js';
import { TableNodeSchema } from '../schemas.js';
import { collectDataPaths, nodeReads } from '../traverse.js';
import type { MutuallyAssignable } from './fixtures.js';

/**
 * The three key-set pairs the report contract owes, in the shape `nodes.test.ts` established.
 *
 * Under `exactOptionalPropertyTypes` an optional field added to one side alone leaves the two
 * types mutually assignable, so the objects are not compared: `keyof` compares KEY SETS and
 * catches both directions.
 */
export const PAGE_COUNT_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextPageCountSegmentSchema>,
  keyof TextPageCountSegment
> = true;

export const PAGE_REPORT_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextPageReportSegmentSchema>,
  keyof TextPageReportSegment
> = true;

export const PAGE_REPORT_CONTRIBUTION_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PageReportContributionSchema>,
  keyof PageReportContribution
> = true;

/** The union itself, in both directions: a member dropped from either side collapses this. */
export const PAGE_FIELD_SEGMENT_IN_STEP: MutuallyAssignable<
  z.infer<typeof TextPageFieldSegmentSchema>,
  TextPageFieldSegment
> = true;

/** The row, whose key set the optional contribution widened. */
export const TABLE_ROW_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TableRowNodeSchema>,
  keyof TableRowNode
> = true;

const amount = { kind: 'path', path: 'entry.amount' } as const;

const reportSegment = {
  kind: 'pageField',
  field: 'report',
  decimals: 2,
  mode: 'halfExpand',
} as const;

const textWith = (...content: readonly unknown[]) => ({
  type: 'text',
  id: 'line',
  content,
});

function tableWith(overrides: {
  header?: readonly unknown[];
  body?: readonly unknown[];
  footer?: readonly unknown[];
}) {
  return {
    type: 'table',
    id: 'lines',
    columns: [{ id: 'label', width: 1, align: 'start' }],
    header: overrides.header ?? [],
    body: overrides.body ?? [],
    footer: overrides.footer ?? [],
  };
}

const rowWith = (id: string, extra: Record<string, unknown> = {}) => ({
  type: 'tableRow',
  id,
  cells: [{ columnId: 'label', children: [] }],
  ...extra,
});

describe('the page-field union', () => {
  it('keeps the two counting fields exactly as they were', () => {
    // A document written before the report existed still parses, and a counter still carries the
    // two keys it always had: like every other node of this contract, it drops what it does not
    // declare rather than refusing it.
    for (const field of ['number', 'count'] as const) {
      const parsed = TextNodeSchema.parse(
        textWith({ kind: 'pageField', field, decimals: 2, mode: 'halfExpand' }),
      );
      expect(parsed.content[0]).toStrictEqual({ kind: 'pageField', field });
    }
  });

  it('publishes the report beside them in the closed list of fields', () => {
    expect(core.PAGE_FIELDS).toStrictEqual(['number', 'count', 'report']);
  });

  it('requires both rounding parameters on a report', () => {
    expect(TextNodeSchema.safeParse(textWith(reportSegment)).success).toBe(true);
    for (const partial of [
      { kind: 'pageField', field: 'report', decimals: 2 },
      { kind: 'pageField', field: 'report', mode: 'halfExpand' },
      { kind: 'pageField', field: 'report' },
    ]) {
      expect(TextNodeSchema.safeParse(textWith(partial)).success).toBe(false);
    }
  });

  it('refuses a rounding position or a mode the round operation refuses', () => {
    // Same bounds and same messages as a round expression, because it is the same schema: a
    // second spelling here would be a second policy able to drift from it.
    const refused = (decimals: number) =>
      TextNodeSchema.safeParse(textWith({ ...reportSegment, decimals }));
    expect(refused(core.MAX_ROUND_DECIMALS).success).toBe(true);
    expect(refused(core.MIN_ROUND_DECIMALS).success).toBe(true);
    expect(refused(core.MAX_ROUND_DECIMALS + 1).success).toBe(false);
    expect(refused(core.MIN_ROUND_DECIMALS - 1).success).toBe(false);
    expect(refused(1.5).error?.issues[0]?.message).toContain('whole number of decimal places');
    expect(TextNodeSchema.safeParse(textWith({ ...reportSegment, mode: 'halfUp' })).success).toBe(
      false,
    );
  });

  it('refuses a field name outside the closed list, and says which names exist', () => {
    // A nested union reports a missing discriminator, so without a message of its own an author
    // who mistypes a marker reads "Invalid input" and learns nothing.
    const parsed = TextNodeSchema.safeParse(textWith({ kind: 'pageField', field: 'total' }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toStrictEqual(['content', 0, 'field']);
    expect(parsed.error?.issues[0]?.message).toBe(PAGE_FIELD_NAME_MESSAGE);
    expect(diagnosticsOf(parsed.error)?.[0]?.message).toBe(PAGE_FIELD_NAME_MESSAGE);
  });
});

describe('a row contribution', () => {
  it('is accepted on a fixed body row and on a repeated one', () => {
    expect(
      TableNodeSchema.safeParse(
        tableWith({ body: [rowWith('fixed', { pageReport: { value: amount } })] }),
      ).success,
    ).toBe(true);
    expect(
      TableNodeSchema.safeParse(
        tableWith({
          body: [
            {
              type: 'tableRowGroup',
              id: 'entries',
              each: { kind: 'path', path: 'payload.entries' },
              as: 'entry',
              rows: [rowWith('repeated', { pageReport: { value: amount } })],
            },
          ],
        }),
      ).success,
    ).toBe(true);
  });

  it('is refused in the header and in the footer, where the position is still known', () => {
    for (const section of ['header', 'footer'] as const) {
      const parsed = TableNodeSchema.safeParse(
        tableWith({ [section]: [rowWith('edge', { pageReport: { value: amount } })] }),
      );
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path).toStrictEqual([section, 0, 'pageReport']);
      expect(parsed.error?.issues[0]?.message).toContain('Only a body row');
    }
  });

  it('stays absent rather than written undefined when the row declares none', () => {
    const parsed = TableRowNodeSchema.parse(rowWith('plain'));
    expect(Object.hasOwn(parsed, 'pageReport')).toBe(false);
  });

  it('refuses a value that is not a printable expression', () => {
    expect(
      TableRowNodeSchema.safeParse(rowWith('bad', { pageReport: { value: 42 } })).success,
    ).toBe(false);
    expect(TableRowNodeSchema.safeParse(rowWith('bad', { pageReport: {} })).success).toBe(false);
  });
});

describe('what the contribution adds to the catalogue of reads', () => {
  it('is read by the row that declares it and by no other node', () => {
    const row = TableRowNodeSchema.parse(rowWith('detail', { pageReport: { value: amount } }));
    expect(nodeReads(row).reads).toStrictEqual([amount]);
    expect(nodeReads(TableRowNodeSchema.parse(rowWith('plain'))).reads).toStrictEqual([]);
  });

  it('reaches the data catalogue, and the alias of its group masks it', () => {
    // A repeated row reads through the alias, which is local: the catalogue must keep the sequence
    // the caller supplies and never the name the model gave one of its items.
    const grouped = TableNodeSchema.parse(
      tableWith({
        body: [
          {
            type: 'tableRowGroup',
            id: 'entries',
            each: { kind: 'path', path: 'payload.entries' },
            as: 'entry',
            rows: [rowWith('repeated', { pageReport: { value: amount } })],
          },
        ],
      }),
    );
    expect(collectDataPaths(grouped)).toStrictEqual(['payload.entries']);

    const fixed = TableNodeSchema.parse(
      tableWith({
        body: [
          rowWith('fixed', { pageReport: { value: { kind: 'path', path: 'invoice.brought' } } }),
        ],
      }),
    );
    expect(collectDataPaths(fixed)).toStrictEqual(['invoice.brought']);
  });

  it('adds no implicit read of its own', () => {
    // A marker names no data and the mark names no data: only the expression the model wrote does.
    const withMarker = TableNodeSchema.parse(
      tableWith({
        body: [
          {
            type: 'tableRow',
            id: 'marked',
            keepTogether: true,
            cells: [{ columnId: 'label', children: [textWith(reportSegment)] }],
          },
        ],
      }),
    );
    expect(collectDataPaths(withMarker)).toStrictEqual([]);
  });
});

describe('the public surface the report contract adds', () => {
  it('publishes the contribution schema, the two segment schemas and the rounding operation', () => {
    // By name, not by total: a total breaks on every later feature and misses a rename, which is
    // the one fault that reaches an integrator.
    const values = Object.keys(core);
    for (const symbol of [
      'PageReportContributionSchema',
      'TextPageCountSegmentSchema',
      'TextPageReportSegmentSchema',
      'roundDecimal',
    ]) {
      expect(values).toContain(symbol);
    }
  });

  it('leaks no other helper of the evaluator', () => {
    // Publishing one pure operation is not opening the evaluator: its guards, its dispatch and the
    // wrapper that validates a round expression stay internal.
    const values = Object.keys(core);
    for (const absent of [
      'evaluateRound',
      'requireNumber',
      'requireFiniteResult',
      'RoundingPositionSchema',
    ]) {
      expect(values).not.toContain(absent);
    }
  });

  it('rounds a page report exactly as a round expression does', () => {
    // The shared oracle: one algorithm, reachable from both sides, so a copy inside a renderer
    // that drifted would disagree with this.
    expect(core.roundDecimal(2.5, 0, 'halfEven')).toBe(2);
    expect(core.roundDecimal(2.5, 0, 'halfExpand')).toBe(3);
    expect(core.roundDecimal(-2.5, 0, 'halfExpand')).toBe(-3);
    expect(core.roundDecimal(1.005, 2, 'halfExpand')).toBe(1.01);
    expect(core.roundDecimal(1250, -2, 'halfEven')).toBe(1200);
    expect(Object.is(core.roundDecimal(-0.004, 2, 'halfExpand'), 0)).toBe(true);
  });
});

describe('the stamp the report contract carries', () => {
  it('stands one past the fragmentation preference', () => {
    // Both classes of change need it: an optional field an older build strips in silence, and a
    // widened union it refuses on an unknown discriminator with no version named.
    expect(CURRENT_SCHEMA_VERSION).toBe(9);
    expect(core.TEMPLATE_MIGRATIONS.at(-1)).toMatchObject({ from: 8, to: 9 });
  });
});
