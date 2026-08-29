/**
 * The data set the published example renders.
 *
 * Typed here, and only here: the shape of a data set belongs to the host application. Openview
 * reserves no field name, expects no structure and never parses this object.
 */

// #region invoice-data
/** One billed line. `units` times `rate` is computed by the template, never by the caller. */
export interface InvoiceLine {
  readonly label: string;
  readonly units: number;
  readonly rate: number;
}

export interface Invoice {
  readonly reference: string;
  readonly customer: string;
  /** A civil date, `YYYY-MM-DD`. The engine owns no clock: today is a value you pass in. */
  readonly issuedOn: string;
  readonly termDays: number;
  readonly lines: readonly InvoiceLine[];
  readonly notice: string;
}

export const INVOICE_DATA: { readonly invoice: Invoice } = {
  invoice: {
    reference: 'F-2026-0117',
    customer: 'Longacre Works',
    issuedOn: '2026-03-02',
    termDays: 30,
    lines: [
      { label: 'Site survey', units: 2, rate: 480 },
      { label: 'Cabling, second floor', units: 1, rate: 1250.5 },
      { label: 'Commissioning', units: 3.5, rate: 120 },
    ],
    notice: 'Payment by transfer, quoting the invoice reference.',
  },
};
// #endregion invoice-data
