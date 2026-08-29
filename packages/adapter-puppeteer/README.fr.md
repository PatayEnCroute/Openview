# @openview/adapter-puppeteer

Le dos d'impression Chromium du port PDF d'[`@openview/engine`](../engine/README.fr.md). Le moteur
décide de la mise en page ; ce paquet l'imprime.

C'est un paquet séparé pour une raison : Puppeteer télécharge un Chromium (150–300 Mo) à
l'installation. Un intégrateur qui ne veut que la mise en page n'en paie jamais le prix.

## Installation

```bash
npm install @openview/core @openview/engine @openview/adapter-puppeteer
pnpm add @openview/core @openview/engine @openview/adapter-puppeteer
yarn add @openview/core @openview/engine @openview/adapter-puppeteer
```

### Avec pnpm, autorisez le téléchargement

pnpm ne joue pas le script d'installation d'une dépendance sans autorisation : le Chromium n'est
donc pas téléchargé, et le premier rendu échoue en `pdf-export-failed`. Autorisez-le une fois :

```bash
pnpm approve-builds
```

Ou déclarez-le, comme le fait ce dépôt dans son
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) :

```yaml
allowBuilds:
  puppeteer: true
```

## Deux façades, et la question qui les départage

<!-- docs-api: @openview/adapter-puppeteer createPuppeteerPdfStrategy -->
<!-- docs-api: @openview/adapter-puppeteer createPuppeteerRenderRuntime -->

`createPuppeteerPdfStrategy()` est le chemin direct : un navigateur par rendu, fermé par le
pipeline. Utilisez-le quand vous contrôlez le modèle **et** le jeu de données.

`createPuppeteerRenderRuntime()` est le chemin durci, et le seul qu'on peut pointer vers un
document qu'on ne contrôle pas. Lui seul borne le temps, la mémoire, la concurrence et chaque
octet qu'un document peut faire charger à ce processus. Il vous appartient, et vous le fermez.

La question n'est pas la taille du document, c'est qui l'a écrit. Voir la
[page 04 du guide](../../docs/engine/fr/04-untrusted-documents.md).

## Le guide

Tout le reste vit avec le moteur :
[français](../../docs/engine/fr/00-contents.md),
[anglais](../../docs/engine/en/00-contents.md).

## Licence

Apache-2.0.
