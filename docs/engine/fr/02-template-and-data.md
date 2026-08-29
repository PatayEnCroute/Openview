# Modèles et données

Cette page répond à une question : que sont exactement les deux choses qu'on donne à un rendu ?
Elle s'adresse au développeur qui a obtenu son PDF et veut maintenant utiliser son propre document.

## Le modèle, c'est le document

<!-- docs-api: @openview/core parseTemplate CURRENT_SCHEMA_VERSION -->
<!-- docs-api: @openview/core TemplateShapeError TemplateMigrationError -->

Un modèle est du JSON stocké : une mise en page, un arbre de blocs, et les formules que ces blocs
impriment. Il vient de l'éditeur visuel, ou de votre propre stockage — Openview ne le conserve pas
pour vous.

`parseTemplate()` est la porte. Il valide le document, le migre s'il a été écrit par une version
antérieure, et le refuse sinon : une `TemplateShapeError` nomme ce qui ne va pas, avec un chemin.
Appelez-la au chargement du document, jamais dans une boucle de rendu.

<!-- docs-value: CURRENT_SCHEMA_VERSION=11 -->

Les documents stockés portent une version de schéma, à 11 aujourd'hui. Les versions antérieures
sont migrées à l'entrée. Un document écrit par une version **plus récente** est refusé par une
`TemplateMigrationError` qui vous dit de mettre à jour — supprimer en silence un champ inconnu
serait pire.

## Le jeu de données est le vôtre

<!-- docs-api: @openview/core collectTemplateDataPaths RenderRequest -->

`RenderRequest.data` est un sac opaque de clés que vous nommez. Openview ne réserve aucun champ,
n'attend aucune structure et ne le valide jamais : il n'y a pas de `DataSchema` dans ce projet, et
il n'y en aura pas. Votre catalogue est à vous de vérifier.

Ce qu'un modèle **lit**, en revanche, est connaissable, et c'est le sens utile :
`collectTemplateDataPaths(template)` rend tous les chemins que le document ira chercher — pour la
facture de démonstration, `invoice.reference`, `invoice.customer`, `invoice.issuedOn`,
`invoice.termDays`, `invoice.lines` et `invoice.notice`. Comparez cette liste à ce que porte votre
jeu de données et vous savez, avant de rendre, si le document peut être rempli.

## « Aujourd'hui » est une donnée

Le moteur ne lit ni horloge, ni fuseau, ni locale de la machine. Une échéance est calculée à partir
d'une date que vous avez fournie — dans la facture de démonstration, `issuedOn` plus `termDays` —
et jamais à partir du jour du rendu. Deux rendus de la même requête, à un mois d'intervalle,
produisent le même document.

C'est une contrainte délibérée, et c'est elle qui rend un document reproductible.

## Écritures : langue, devise, dates

<!-- docs-api: @openview/engine PresentationSelection -->

Le formatage est coupé en deux, exprès.

Le **modèle** nomme des *profils* — des rôles logiques comme `amount` — à chaque site qui imprime
un chiffre ou une date. La facture de démonstration en nomme exactement un.

L'**appelant** associe chaque profil à l'une des écritures que le modèle déclare, par
`presentationSelection` à la construction du port. La facture de démonstration déclare `fr-eur` et
`en-usd` ; choisir l'un ou l'autre change la locale, le symbole de devise et le style de date de
toutes les valeurs, sans toucher au document stocké.

Deux choses que cela ne fait **pas**, et le savoir vous épargne une heure :

- cela ne traduit pas les libellés écrits dans le modèle — « Description », « Total » sont du
  contenu ;
- cela ne traduit pas les textes qui arrivent dans votre jeu de données — cette langue est la vôtre.

Un site dont vous n'avez pas associé le profil est refusé par `presentation-refused`. C'est un
refus, pas un repli : un montant non écrit est plus dangereux qu'un rendu arrêté.

Suite : [toutes les façons dont un rendu peut refuser](./03-when-it-fails.md).
