# Quand il refuse

Cette page dit de quoi un refus est fait, et quoi faire de chacun d'eux.
C'est celle à garder ouverte quand vous branchez Openview dans un service.

## La forme d'un refus

<!-- docs-api: @openview/engine DocumentRenderError DocumentRenderErrorDetails -->

Tout ce qu'un rendu refuse est une `DocumentRenderError` : un message, un `code` pris dans la liste
fermée ci-dessous, et un objet `details`. Attrapez-la, journalisez le code et les détails, et vous
tenez l'adresse du problème.

`details` porte jusqu'à treize champs, tous optionnels, et seulement ceux que le site connaît :
`nodeId` et `path` localisent la déclaration, `occurrence` dit quelle répétition était construite,
`actualType` nomme ce qui est arrivé, `formatKind` et `presentationRefusal` expliquent un refus
d'écriture, `region` et `pageNumber` le situent sur la page, `limit` et `observed` comparent un
plafond à ce qui a été atteint, `phase` dit où en était le rendu, `resourceKind` dit quelle sorte de
ressource était en jeu, et `diagnostics` relaie les constats structurés de `@openview/core`.

**Un refus ne transporte jamais une valeur de votre jeu de données.** Vous ne trouverez pas le
montant fautif dans le message — vous trouverez son adresse. C'est délibéré : une ligne de journal
n'est pas l'endroit où fuitent les chiffres d'un client.

## Les dix phases

<!-- docs-vocabulary: DOCUMENT_RENDER_PHASES -->

- `admission` — la requête est contrôlée avant que rien ne soit construit.
- `transport` — la requête est copiée à travers la frontière de thread du runtime durci.
- `validation` — le modèle et les options sont validés.
- `materialization` — l'arbre du document est construit et les formules sont évaluées.
- `resource` — les images sont autorisées, chargées et décodées.
- `measurement` — le navigateur mesure les boîtes et les lignes.
- `pagination` — le contenu est découpé en pages.
- `serialization` — l'HTML du document est écrit.
- `export` — le navigateur imprime le PDF.
- `cleanup` — le rendu libère ce qu'il tenait.

`details.phase` fait foi quand il est là. Tous les refus n'en portent pas : aucun code n'est
affecté à une phase artificiellement.

## Les trente et un codes

<!-- docs-vocabulary: DOCUMENT_RENDER_ERROR_CODES -->

- `template-refused` — le document stocké a une forme que le moteur ne sait pas construire, ou le
  runtime durci a refusé de copier la requête. Corrigez le modèle, ou la taille de la requête.
- `expression-refused` — une formule n'a pas pu être évaluée. `details.diagnostics` nomme le site.
- `missing-binding-value` — le modèle a lu un chemin que votre jeu de données ne porte pas. Ajoutez
  le champ, ou corrigez le modèle.
- `non-printable-binding-value` — la valeur à ce chemin n'est pas imprimable dans un document : une
  liste ou un objet, par exemple.
- `presentation-refused` — un site demande un profil d'écriture que vous n'avez pas sélectionné, ou
  l'écriture choisie ne peut pas être honorée. Vérifiez `presentationSelection`.
- `unformattable-binding-value` — la valeur n'est pas ce que le site écrit : un nombre non fini là
  où un montant est attendu, ou autre chose qu'une date civile là où une date est attendue.
- `unsupported-font-family` — le modèle nomme une famille hors du catalogue incorporé. Rien n'est
  substitué ; prenez l'une des trois.
- `unsupported-font-character` — un caractère n'a pas de glyphe dans les faces incorporées. Le
  document imprimerait un blanc, il est donc refusé.
- `unsupported-image-source` — ce dos d'impression n'imprime que des `data:` base64 png, jpeg et
  webp. Une source http, un chemin de fichier ou du svg sont refusés ici.
- `image-load-failed` — une image incorporée n'a pas décodé, et un texte alternatif ne remplace pas
  une image dans un PDF.
- `oversized-atomic-resource` — un bloc qu'on ne peut pas couper, une image ou une grille, est plus
  haut qu'une page. Réduisez-le, ou laissez-le être coupé.
- `page-band-overflow` — un en-tête ou un pied dépasse la hauteur qui lui est réservée.
  `details.region` dit de quel côté.
- `page-report-refused` — un report de page n'est pas un nombre fini, ou son arrondi et son écriture
  ne s'accordent pas sur le nombre de décimales.
- `grid-content-overflow` — le contenu d'une zone de grille dépasse la zone déclarée par le modèle.
  Une zone n'est jamais rognée ni redimensionnée.
- `pagination-impossible` — la découpe ne progresse pas : quelque chose réclame une page qu'il
  n'obtiendra jamais.
- `layout-measurement-failed` — le navigateur a rendu une mesure à laquelle le moteur ne peut pas
  se fier. Il s'arrête plutôt que d'imprimer un document non mesuré.
- `pdf-export-failed` — l'imprimeur n'a rien produit. Au premier essai, c'est en général un Chromium
  absent ; l'erreur d'origine voyage en `cause`.
- `adapter-capability-mismatch` — la feuille déclarée est hors des bornes sur lesquelles ce dos
  d'impression a été mesuré. Il ne la redimensionnera pas en silence.
- `materialization-limit-exceeded` — le document construit plus d'objets qu'un rendu ne le permet.
  `details.limit` porte le plafond.
- `page-limit-exceeded` — le document est découpé en plus de pages qu'un rendu ne peut en produire.
- `html-limit-exceeded` — l'HTML sérialisé dépasse ce qu'un rendu peut écrire.
- `pdf-limit-exceeded` — le PDF produit dépasse ce que l'imprimeur peut lire en flux.
- `resource-policy-refused` — un document a atteint une source que le runtime n'autorise pas, ou a
  franchi un plafond de ressources. Seules les entrées du manifeste et les images autonomes passent.
- `resource-load-failed` — une source autorisée n'a pas pu être obtenue.
- `resource-integrity-failed` — les octets obtenus ne correspondent pas à l'empreinte déclarée par
  le manifeste. Rien n'a été remis au navigateur.
- `render-capacity-exceeded` — le runtime durci n'a plus de slot libre ni de place en file.
  Temporisez, ou donnez-lui plus de slots.
- `render-timeout` — le rendu n'a pas fini dans le temps qu'un document peut tenir un slot.
- `render-cancelled` — l'appelant l'a annulé, par le signal que vous avez passé.
- `render-memory-limit-exceeded` — le worker isolé a épuisé le tas qui lui était donné. Ce plafond
  ne couvre ni les `ArrayBuffer`, ni le navigateur : voir la page 04.
- `render-worker-failed` — le worker isolé est mort, ou a répondu hors protocole. Son slot est
  reconstruit avant que quoi que ce soit d'autre y soit admis.
- `runtime-closed` — le runtime est fermé et n'admet plus rien.

## Les erreurs qui ne sont pas des refus de rendu

<!-- docs-api: @openview/core TemplateShapeError TemplateMigrationError -->
<!-- docs-api: @openview/engine InvalidRenderSafetyLimitsError -->
<!-- docs-api: @openview/adapter-puppeteer InvalidProtectedConfigurationError -->

Quatre autres erreurs peuvent vous atteindre, et aucune ne vient d'un rendu :

- `TemplateShapeError`, autour de `parseTemplate()`, quand le JSON n'est pas un modèle valide ;
- `TemplateMigrationError`, quand le document vient d'une version plus récente que la vôtre ;
- `InvalidRenderSafetyLimitsError`, quand les plafonds moteur que vous passez sont inutilisables ;
- `InvalidProtectedConfigurationError`, quand le runtime durci reçoit une limite, un manifeste ou
  une option qu'il refuse.

Une configuration inutilisable est refusée plutôt que remplacée par un défaut : `slots: 0`
n'accepte rien, et un plafond corrigé en silence est un plafond que personne ne connaît.

## Transformer un refus en message

<!-- docs-api: @openview/core diagnosticsOf -->

Quand la personne qui doit agir est l'auteur du modèle, `diagnosticsOf(error)` vous rend les
constats structurés derrière le refus — code, chemin, site — de quoi construire un message qui
désigne la déclaration plutôt qu'une trace d'appels.

Suite : [que faire d'un document qu'on ne contrôle pas](./04-untrusted-documents.md).
