/** Schema-authored messages that diagnostics may safely preserve. */
export const KEEP_TOGETHER_VALUE_MESSAGE =
  'This field must be true when present; omit it to allow the block to split.';
export const COLUMN_WIDTH_TYPE_MESSAGE = 'A column width is a finite whole number of weight units';
export const ROUNDING_POSITION_TYPE_MESSAGE =
  'A rounding position is a finite whole number of decimal places';
export const LIMIT_TYPE_MESSAGE = 'A limit must be a number';
export const PAGE_FIELD_NAME_MESSAGE =
  'A page marker names one of "number", "count" or "report". A report also declares the rounding it is written at.';
export const PRESENTATION_FORMAT_PROFILE_MESSAGE =
  'A format profile needs a name, and the empty string is not one. The name belongs to the model author; the caller maps it to a declared writing at render time.';
export const PRESENTATION_FORMAT_KIND_MESSAGE =
  'A format names one of "money", "decimal" or "date". A page counter accepts "decimal" alone, and a page report "money" or "decimal".';

export const SAFE_SCHEMA_MESSAGES: ReadonlySet<string> = new Set([
  KEEP_TOGETHER_VALUE_MESSAGE,
  COLUMN_WIDTH_TYPE_MESSAGE,
  ROUNDING_POSITION_TYPE_MESSAGE,
  LIMIT_TYPE_MESSAGE,
  PAGE_FIELD_NAME_MESSAGE,
  PRESENTATION_FORMAT_KIND_MESSAGE,
  PRESENTATION_FORMAT_PROFILE_MESSAGE,
  'A path must be dot-separated identifiers, e.g. section.item.field',
  'A colour is six hexadecimal digits behind a hash, as #1b3a6f',
  'A currency is an ISO 4217 alphabetic code in upper case, three letters: "EUR", "USD", "JPY". Lower case is refused so that one currency has one spelling',
]);
