# Guarantees and limits

This page says what Openview promises, under which conditions, and what it does not promise.
Read it before you build something on top of a guarantee you assumed.

## PDF, and only PDF

v1 prints PDF. HTML and image outputs, charts, e-mail delivery, archiving and signature stamps are
out of scope — not postponed features you can work around, but things the engine does not do.

## The same document, every time — under the same profile

The same template and the same data set produce the same bytes, twice, on two machines. That holds
only when thirteen things match, because each of them can change what a layout engine writes:

<!-- docs-vocabulary: PROFILE_FIELDS -->

- `platform` — the operating system.
- `architecture` — the CPU architecture.
- `node` — the Node version.
- `v8` — its JavaScript engine.
- `icu` — the internationalisation library, which decides how numbers and dates are spelled.
- `unicode` — the Unicode version behind it.
- `engine` — the version of `@openview/engine`.
- `adapter` — the version of `@openview/adapter-puppeteer`.
- `puppeteer` — the Puppeteer version.
- `chromium` — the browser build that lays the document out.
- `fonts` — the digest of every embedded face.
- `pdfCanonicalizer` — the version of the pass that rewrites the PDF to fixed metadata.
- `launchArguments` — the arguments the browser was launched with.

The reservation worth knowing: two ICU builds do not write the same bytes. In `1 234,50 €` under
`fr-FR`, the thousands separator is U+202F since CLDR 42 / ICU 72 and U+00A0 before it. That is not
a bug we can fix from here — it is why the guarantee is stated against a profile rather than
absolutely.

## Fonts are embedded, never borrowed

<!-- docs-value: FONT_FAMILIES=3 -->
<!-- docs-value: FONT_FACES=12 -->

The engine carries 3 families and 12 faces of its own, under the SIL Open Font License 1.1, pinned
by digest. No font of the host is ever consulted. A family outside the catalogue is refused, never
substituted: a document that silently changed typeface between two machines would break the
guarantee above without saying so.

## Nothing is ever truncated

What does not fit is refused. A block taller than a page, a grid zone whose content overflows, a
band that exceeds its reserved height: each stops the render with a code. A silently cropped
invoice is a wrong document that looks right, which is the one failure a print engine must not
have.

## You can read the cut without printing

<!-- docs-api: @openview/engine createPaginationPort -->

`createPaginationPort()` runs the same pipeline and returns where the pages break, what each page
carries forward, and the notices the layout produced — without exporting a PDF. It is the port to
use for a preview, or to check a document before printing it.

## The safety net

Six frozen documents, 21 pages, are compared byte for byte on every CI run. A change in the layout
that alters one of them fails the build and names the invoice and the page. It is a regression net
under one visible combination of features, not a replacement for the functional suites.

## What we do not decide

Openview computes what the template asks it to compute. It decides no tax rate, no legal rounding,
no exchange rate, no mandatory wording. The accuracy and the compliance of a produced document
belong to the integrating application and to the author of the template — the clause in full is in
the [project README](../../../README.md).

Back to [the contents](./00-contents.md).
