# @openview/adapter-puppeteer

The Chromium print backend behind the PDF port of
[`@openview/engine`](../engine/README.md). The engine decides the layout; this package prints it.

It is a separate package for one reason: Puppeteer downloads a Chromium build (150–300 MB) on
install. An integrator who only wants layout never pays for one.

## Install

```bash
npm install @openview/core @openview/engine @openview/adapter-puppeteer
pnpm add @openview/core @openview/engine @openview/adapter-puppeteer
yarn add @openview/core @openview/engine @openview/adapter-puppeteer
```

### With pnpm, allow the download

pnpm does not run a dependency's install script unless you allow it, so the Chromium build is never
fetched and the first render fails with `pdf-export-failed`. Approve it once:

```bash
pnpm approve-builds
```

Or declare it, which is what this repository does in its
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml):

```yaml
allowBuilds:
  puppeteer: true
```

## Two façades, and the question that picks one

<!-- docs-api: @openview/adapter-puppeteer createPuppeteerPdfStrategy -->
<!-- docs-api: @openview/adapter-puppeteer createPuppeteerRenderRuntime -->

`createPuppeteerPdfStrategy()` is the direct path: one browser per render, closed by the pipeline.
Use it when you control both the template and the data set.

`createPuppeteerRenderRuntime()` is the hardened one, and the only one to point at a document you
do not control. It alone bounds time, memory, concurrency, and every byte a document can make this
process load. You own it, and you close it.

The question is not how large the document is; it is who wrote it. See
[page 04 of the guide](../../docs/engine/en/04-untrusted-documents.md).

## The guide

Everything else lives with the engine:
[English](../../docs/engine/en/00-contents.md),
[French](../../docs/engine/fr/00-contents.md).

## Licence

Apache-2.0.
