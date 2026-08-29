# Garanties et limites

Cette page dit ce qu'Openview promet, sous quelles conditions, et ce qu'il ne promet pas.
Lisez-la avant de bâtir quoi que ce soit sur une garantie que vous auriez supposée.

## Du PDF, et rien que du PDF

La v1 imprime du PDF. Les sorties HTML et image, les graphiques, l'envoi par courriel, l'archivage
et les tampons de signature sont hors périmètre — pas des fonctionnalités reportées qu'on peut
contourner, mais des choses que le moteur ne fait pas.

## Le même document à chaque fois — sous le même profil

Le même modèle et le même jeu de données produisent les mêmes octets, deux fois, sur deux machines.
Cela ne tient que si treize choses coïncident, parce que chacune peut changer ce qu'un moteur de
mise en page écrit :

<!-- docs-vocabulary: PROFILE_FIELDS -->

- `platform` — le système d'exploitation.
- `architecture` — l'architecture du processeur.
- `node` — la version de Node.
- `v8` — son moteur JavaScript.
- `icu` — la bibliothèque d'internationalisation, qui décide de l'écriture des nombres et des dates.
- `unicode` — la version d'Unicode derrière elle.
- `engine` — la version de `@openview/engine`.
- `adapter` — la version de `@openview/adapter-puppeteer`.
- `puppeteer` — la version de Puppeteer.
- `chromium` — le build du navigateur qui met le document en page.
- `fonts` — l'empreinte de chaque face incorporée.
- `pdfCanonicalizer` — la version de la passe qui réécrit le PDF avec des métadonnées fixes.
- `launchArguments` — les arguments de lancement du navigateur.

La réserve à connaître : deux builds d'ICU n'écrivent pas les mêmes octets. Dans `1 234,50 €` en
`fr-FR`, le séparateur de milliers est U+202F depuis CLDR 42 / ICU 72 et U+00A0 avant. Ce n'est pas
un défaut que nous puissions corriger d'ici — c'est pourquoi la garantie est énoncée contre un
profil, et non dans l'absolu.

## Les polices sont incorporées, jamais empruntées

<!-- docs-value: FONT_FAMILIES=3 -->
<!-- docs-value: FONT_FACES=12 -->

Le moteur porte 3 familles et 12 faces qui lui appartiennent, sous SIL Open Font License 1.1,
épinglées par empreinte. Aucune police de l'hôte n'est jamais consultée. Une famille hors catalogue
est refusée, jamais substituée : un document qui changerait discrètement de caractère entre deux
machines casserait la garantie ci-dessus sans le dire.

## Rien n'est jamais tronqué

Ce qui ne tient pas est refusé. Un bloc plus haut qu'une page, une zone de grille dont le contenu
déborde, un bandeau qui dépasse sa hauteur réservée : chacun arrête le rendu avec un code. Une
facture rognée en silence est un document faux qui a l'air juste, et c'est le seul échec qu'un
moteur d'impression n'a pas le droit d'avoir.

## La découpe se lit sans imprimer

<!-- docs-api: @openview/engine createPaginationPort -->

`createPaginationPort()` joue le même pipeline et rend où les pages se coupent, ce que chaque page
reporte, et les constats produits par la mise en page — sans exporter de PDF. C'est le port d'un
aperçu, ou d'un contrôle avant impression.

## Le filet

Six documents figés, 21 pages, sont comparés octet par octet à chaque exécution de la CI. Une
évolution du rendu qui en modifie un fait échouer la construction en nommant la facture et la page.
C'est un filet de non-régression sur une combinaison visible, pas un remplaçant des suites
fonctionnelles.

## Ce que nous ne décidons pas

Openview calcule ce que le modèle lui demande de calculer. Il ne décide aucun taux de taxe, aucun
arrondi légal, aucun taux de change, aucune mention obligatoire. L'exactitude et la conformité d'un
document produit relèvent de l'application intégratrice et de l'auteur du modèle — la clause
complète est dans le [README du projet](../../../README.md).

Retour [au sommaire](./00-contents.md).
