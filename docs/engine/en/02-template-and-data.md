# Templates and data

This page answers one question: what exactly are the two things you hand to a render?
It is for the developer who got a PDF out and now wants to use their own document.

## The template is the document

<!-- docs-api: @openview/core parseTemplate CURRENT_SCHEMA_VERSION -->
<!-- docs-api: @openview/core TemplateShapeError TemplateMigrationError -->

A template is stored JSON: a page setup, a tree of blocks, and the formulas the blocks print. It
comes from the visual designer, or from your own storage — Openview does not keep it for you.

`parseTemplate()` is the door. It validates the document, migrates it if it was written by an
older release, and refuses it otherwise: a `TemplateShapeError` names what is wrong, with a path.
Call it once, when you load the document, never inside a render loop.

<!-- docs-value: CURRENT_SCHEMA_VERSION=11 -->

Stored documents carry a schema version, at 11 today. Older versions are migrated on the way in.
A document written by a **newer** release is refused with a `TemplateMigrationError` telling you to
upgrade — silently dropping a field it does not know would be worse.

## The data set is yours

<!-- docs-api: @openview/core collectTemplateDataPaths RenderRequest -->

`RenderRequest.data` is an opaque bag of keys you name. Openview reserves no field, expects no
structure, and never validates it: there is no `DataSchema` in this project, and there will not be
one. Your catalogue is yours to check against.

What a template *reads* is knowable, and that is the useful direction:
`collectTemplateDataPaths(template)` returns every path the document will look up — for the
demonstration invoice, `invoice.reference`, `invoice.customer`, `invoice.issuedOn`,
`invoice.termDays`, `invoice.lines` and `invoice.notice`. Compare that list to what your data set
holds and you know, before rendering, whether the document can be filled.

## Today is data

The engine reads no clock, no time zone and no machine locale. A due date is computed from a date
you supplied — in the demonstration invoice, `issuedOn` plus `termDays` — and never from the day
the render happens. Two renders of the same request, a month apart, produce the same document.

That is a deliberate constraint, and it is what makes a document reproducible at all.

## Writings: language, currency, dates

<!-- docs-api: @openview/engine PresentationSelection -->

Formatting is split in two, on purpose.

The **template** names *profiles* — logical roles like `amount` — at each site that prints a
figure or a date. The demonstration invoice names exactly one.

The **caller** maps each profile to one of the writings the template declares, through
`presentationSelection` at port construction. The demonstration invoice declares `fr-eur` and
`en-usd`; selecting one or the other changes the locale, the currency symbol and the date style of
every value, without touching the stored document.

Two things it does **not** do, and knowing this saves an hour:

- it does not translate the labels written in the template — "Description", "Total" are content;
- it does not translate the text that arrives in your data set — that language is yours.

A site whose profile you did not map is refused with `presentation-refused`. That is a refusal, not
a fallback: an unwritten amount is more dangerous than a stopped render.

Next: [every way a render can refuse](./03-when-it-fails.md).
