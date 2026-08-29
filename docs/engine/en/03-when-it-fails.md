# When it refuses

This page tells you what a refusal is made of, and what to do about each one.
It is the page to keep open when you wire Openview into a service.

## The shape of a refusal

<!-- docs-api: @openview/engine DocumentRenderError DocumentRenderErrorDetails -->

Everything a render refuses is a `DocumentRenderError`: a message, a `code` from the closed list
below, and a `details` object. Catch it, log the code and the details, and you have the address of
the problem.

`details` carries up to thirteen fields, all optional, and only the ones the site knows:
`nodeId` and `path` locate the declaration, `occurrence` says which repetition was being built,
`actualType` names what arrived, `formatKind` and `presentationRefusal` explain a writing refusal,
`region` and `pageNumber` place it on the page, `limit` and `observed` compare a ceiling to what
was reached, `phase` says where the render stood, `resourceKind` says what kind of resource was
involved, and `diagnostics` forwards the structured findings of `@openview/core`.

**A refusal never carries a value from your data set.** You will not find the offending amount in
the message — you will find its address. That is deliberate: a log line is not the place where a
customer's figures leak.

## The ten phases

<!-- docs-vocabulary: DOCUMENT_RENDER_PHASES -->

- `admission` — the request is checked before anything is built.
- `transport` — the request is copied across the worker boundary of the hardened runtime.
- `validation` — the template and the options are validated.
- `materialization` — the document tree is built and the formulas are evaluated.
- `resource` — images are authorised, loaded and decoded.
- `measurement` — the browser measures boxes and lines.
- `pagination` — the content is cut into pages.
- `serialization` — the HTML of the document is written.
- `export` — the browser prints the PDF.
- `cleanup` — the render releases what it held.

`details.phase` is the source when it is there. Not every refusal carries one: a code is not
assigned to a phase artificially.

## The thirty-one codes

<!-- docs-vocabulary: DOCUMENT_RENDER_ERROR_CODES -->

- `template-refused` — the stored document has a shape the engine cannot build, or the hardened
  runtime refused to copy the request. Fix the template, or the size of the request.
- `expression-refused` — a formula could not be evaluated. `details.diagnostics` names the site.
- `missing-binding-value` — the template read a path your data set does not hold. Add the field, or
  fix the template.
- `non-printable-binding-value` — the value at that path is not something a document can print, a
  list or an object for instance.
- `presentation-refused` — a site asks for a writing profile you did not select, or the selected
  writing cannot be honoured. Check `presentationSelection`.
- `unformattable-binding-value` — the value is not what the site writes: a non-finite number where
  an amount belongs, or something that is not a civil date where a date belongs.
- `unsupported-font-family` — the template names a family outside the embedded catalogue. Nothing
  is substituted; pick one of the three.
- `unsupported-font-character` — a character has no glyph in the embedded faces. The document would
  print a blank, so it is refused.
- `unsupported-image-source` — this backend prints base64 `data:` png, jpeg and webp only. An http
  source, a file path or svg is refused here.
- `image-load-failed` — an embedded image did not decode, and alternative text does not stand in
  for a picture in a PDF.
- `oversized-atomic-resource` — a block that cannot be cut, an image or a grid, is taller than a
  page. Shrink it, or let it be cut.
- `page-band-overflow` — a header or footer reaches past the height reserved for it.
  `details.region` says which side.
- `page-report-refused` — a carried-forward figure is not a finite number, or its rounding and its
  writing disagree on the number of digits.
- `grid-content-overflow` — the content of a grid zone reaches past the zone the model declared. A
  zone is never clipped and never resized.
- `pagination-impossible` — the cut cannot progress: something needs a page it can never get.
- `layout-measurement-failed` — the browser returned a measurement the engine cannot trust. It
  stops rather than print an unmeasured document.
- `pdf-export-failed` — the printer produced nothing. On a first run, this is usually a missing
  Chromium; the original error travels as `cause`.
- `adapter-capability-mismatch` — the declared sheet is outside the range this backend was measured
  on. It will not silently rescale.
- `materialization-limit-exceeded` — the document builds more objects than one render may.
  `details.limit` is the ceiling.
- `page-limit-exceeded` — the document is cut into more pages than one render may produce.
- `html-limit-exceeded` — the serialised HTML is larger than one render may write.
- `pdf-limit-exceeded` — the produced PDF is larger than the printer may stream out.
- `resource-policy-refused` — a document reached a source the runtime does not authorise, or went
  past a resource ceiling. Only manifest entries and self-contained bitmaps are loaded.
- `resource-load-failed` — an authorised source could not be obtained.
- `resource-integrity-failed` — the bytes obtained do not match the digest the manifest declares.
  Nothing was handed to the browser.
- `render-capacity-exceeded` — the hardened runtime has no free slot and no room in its queue. Back
  off, or give it more slots.
- `render-timeout` — the render did not finish within the time one document may hold a slot.
- `render-cancelled` — the caller aborted it, through the signal you passed.
- `render-memory-limit-exceeded` — the isolated worker exhausted the heap it was given. That
  ceiling does not cover array buffers or the browser: see page 04.
- `render-worker-failed` — the isolated worker died, or answered outside the protocol. Its slot is
  rebuilt before anything else is admitted.
- `runtime-closed` — the runtime is closed and admits nothing more.

## The errors that are not refusals of a render

<!-- docs-api: @openview/core TemplateShapeError TemplateMigrationError -->
<!-- docs-api: @openview/engine InvalidRenderSafetyLimitsError -->
<!-- docs-api: @openview/adapter-puppeteer InvalidProtectedConfigurationError -->

Four more errors can reach you, and none of them comes from a render:

- `TemplateShapeError`, around `parseTemplate()`, when the JSON is not a valid template;
- `TemplateMigrationError`, when the document was written by a newer release than yours;
- `InvalidRenderSafetyLimitsError`, when the engine ceilings you passed are unusable;
- `InvalidProtectedConfigurationError`, when the hardened runtime is configured with a limit,
  a manifest or an option it refuses.

An unusable configuration is refused rather than replaced by a default: `slots: 0` accepts nothing,
and a silently corrected ceiling is a ceiling nobody knows about.

## Turning a refusal into a message

<!-- docs-api: @openview/core diagnosticsOf -->

When the person who has to act is the author of the template, `diagnosticsOf(error)` gives you the
structured findings behind the refusal — code, path, and site — so you can build a message that
points at the declaration rather than at a stack trace.

Next: [what to do with a document you do not control](./04-untrusted-documents.md).
