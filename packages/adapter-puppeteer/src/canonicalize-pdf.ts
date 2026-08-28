import { PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';

/**
 * The instant every canonical document is stamped with, written the way the pdf spells it.
 *
 * A literal rather than a `Date`: this adapter reads no clock at all, and the unix epoch here is a
 * constant of the serialisation. The date a business document shows is a value of the caller's data
 * set under a name the caller chose -- never a metadata field this adapter fills in.
 */
const EPOCH = 'D:19700101000000Z';

/** The producer every canonical document names, in place of the browser that happened to print it. */
const PRODUCER = 'Openview';

/** The eight info entries a canonical document keeps. Every other key is the browser talking. */
const CANONICAL_INFO_KEYS: ReadonlySet<string> = new Set([
  '/Title',
  '/Author',
  '/Subject',
  '/Keywords',
  '/Creator',
  '/Producer',
  '/CreationDate',
  '/ModDate',
]);

/**
 * Rewrites a printed pdf into its canonical form.
 *
 * Chromium writes the moment of printing, its own version and the title of the loaded document into
 * the info dictionary, so two identical renders differ by those bytes alone. This reloads the file
 * and writes fixed metadata instead of patching the bytes: replacing a substring would depend on
 * the layout the browser happens to produce today, and a browser upgrade that moved the dictionary,
 * added a trailer id or turned on object streams would silently stop canonicalising anything.
 *
 * Reads no clock, no environment variable and no file. The pages, their contents and their embedded
 * resources are carried through untouched.
 */
export async function canonicalizePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });

  document.setTitle(PRODUCER);
  document.setCreator(PRODUCER);
  document.setProducer(PRODUCER);
  document.setAuthor('');
  document.setSubject('');
  document.setKeywords([]);

  /* Anything still in the info dictionary past the eight canonical keys was written by the browser,
     not by the document, and a trailer id is drawn afresh at every print. Both are invisible to a
     reader and both show up in a byte comparison. */
  const info = document.context.lookup(document.context.trailerInfo.Info);
  if (info instanceof PDFDict) {
    for (const key of info.keys()) {
      if (!CANONICAL_INFO_KEYS.has(key.asString())) {
        info.delete(key);
      }
    }
    /* Written as literals for the same reason the constant is one: the two dates go in without a
       `Date` ever being constructed. */
    info.set(PDFName.of('CreationDate'), PDFString.of(EPOCH));
    info.set(PDFName.of('ModDate'), PDFString.of(EPOCH));
  }
  /* `delete` rather than an assignment: the trailer record types the entry as present, and the
     canonical form has no id at all rather than an empty one. */
  delete document.context.trailerInfo.ID;

  return await document.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
}
