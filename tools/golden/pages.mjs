/**
 * Page-level diagnosis: one pdf per page, and the E5 certificate that page was cut by.
 *
 * A batch that only says "the bytes changed" leaves the reader to open two documents and hunt. This
 * derives, from the stored pdf and from the candidate alike, a deterministic single-page document
 * per rank, so a comparison can name the pages that moved. The derivation is a diagnosis, never a
 * reference: what is committed is the whole document the client receives.
 *
 * The over-diagnosis is deliberate and accepted. Faces are subset once for the whole file, so one
 * page gaining a glyph can move the bytes of its neighbours. Naming a conservative set of pages is
 * the honest answer; a pixel diff belongs to the viewer lot, not here.
 */

/* Reached by its built path, not through the package entry point: `canonicalizePdf` is deliberately
   not a public export of the adapter, and E7 is not a reason to make it one. */
import { canonicalizePdf } from '../../packages/adapter-puppeteer/dist/canonicalize-pdf.js';
import { fromAdapter } from '../reproducibility/profile.mjs';
import { canonicalJson } from './canonical-json.mjs';

const { PDFDocument } = fromAdapter('pdf-lib');

/**
 * Bumped whenever the bytes this module produces for an unchanged page could change.
 *
 * The manifest carries it, and a mismatch fails before a single digest is interpreted: comparing
 * pages extracted by two different algorithms would report a document defect that never happened.
 */
export const PAGE_EXTRACTOR_VERSION = 1;

/** How many pages a pdf really holds, read from the bytes rather than from what produced them. */
export async function pageCountOf(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  return document.getPageCount();
}

/**
 * The single-page document of one rank, canonicalised the way a delivered document is.
 *
 * Loaded without touching the metadata, copied rather than trimmed, and saved without object
 * streams: three choices that keep the output a function of the input alone.
 */
export async function extractPage(bytes, number) {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  const count = source.getPageCount();
  if (!Number.isInteger(number) || number < 1 || number > count) {
    throw new RangeError(`page ${number} is not one of the ${count} pages of this document`);
  }
  const isolated = await PDFDocument.create();
  const [page] = await isolated.copyPages(source, [number - 1]);
  if (page === undefined) {
    throw new RangeError(`page ${number} could not be copied out of this document`);
  }
  isolated.addPage(page);
  const saved = await isolated.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  /* The same canonicaliser the delivered document goes through: fixed metadata, no trailer id. A
     `create()` stamps the moment it ran, and an extraction that carried it would differ from itself
     on every run. */
  return await canonicalizePdf(saved);
}

/**
 * The E5 certificate of one page: how it was cut, and nothing about what it says.
 *
 * Carries the page result of that rank and the notices that name it. No html, no measurement, no
 * cursor and no bound value: this text is published as a ci artefact.
 */
export function certificateOf(pagination, number) {
  const page = pagination.pages.find((one) => one.number === number);
  if (page === undefined) {
    throw new RangeError(`the pagination carries no page ${number}`);
  }
  const notices = pagination.notices.filter((notice) => notice.pages.includes(number));
  return canonicalJson({ page, notices });
}

/** The sheet the whole document was composed on. */
export function sheetCertificateOf(pagination) {
  return canonicalJson(pagination.sheet);
}

/** Every notice of the document, in the order the engine emitted them. */
export function noticesCertificateOf(pagination) {
  return canonicalJson(pagination.notices);
}
