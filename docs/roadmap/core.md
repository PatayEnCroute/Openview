# Roadmap — `@openview/core` (le contrat)

> **Rôle produit :** définir ce qu'un modèle de document *sait dire*. Tout ce que
> le contrat ne sait pas exprimer est impossible à rendre et impossible à éditer :
> cette brique est le plafond de verre des quatre autres.
>
> Les critères de recette de cette brique sont énoncés sur des factures. La facture
> est le **document de référence** du projet, c'est-à-dire le niveau d'exigence à
> atteindre, pas le périmètre : elle concentre les contraintes les plus dures, et
> une brique qui les tient rend les autres éditions accessibles sans lot
> supplémentaire.
>
> Retour à la [vue d'ensemble](README.md).

---

## Où on en est

C'est la seule brique déjà entamée, et ses fondations sont bonnes : un modèle sait
décrire du texte mêlant du fixe et des données, des images, des regroupements, des
**répétitions** (une ligne par article) et des **conditions** (afficher ce bloc
seulement si…). Un modèle porte un numéro de version et sait être converti d'une
version à l'autre — la promesse « un modèle enregistré aujourd'hui s'ouvre encore
dans dix ans » est déjà outillée.

**Ce qui manque pour une facture est plus important que ce qui existe.** Un modèle
sait aujourd'hui *comparer* deux valeurs ; il ne sait pas **calculer**. Il ne sait pas
non plus décrire une **page** (format, marges, en-tête répété), un **tableau** à
colonnes, ni la moindre **apparence** — pas une police, pas un filet, pas une couleur.
Ces quatre manques sont le contenu de la vague 1.

---

## Règle d'arbitrage : la capacité est à nous, la responsabilité est à l'intégrateur

> **Openview calcule ce qu'on lui demande. Il ne décide d'aucune règle fiscale ou
> légale, et ne garantit aucune conformité.** L'exactitude des montants relève de
> l'application intégratrice et de l'auteur du modèle.

La frontière ne porte donc **pas** sur la puissance de l'outil — formules et
agrégations sont pleinement dans le périmètre — mais sur qui répond des chiffres.

| Sujet | Position |
| :--- | :--- |
| Additionner, multiplier, agréger des lignes, poser une condition, calculer une échéance | **Openview le fait**, sur demande du modèle |
| Le **taux** de TVA applicable, la règle d'exigibilité, le régime d'exonération, les mentions obligatoires | **Jamais Openview.** Ce sont des données ou des choix de l'intégrateur |
| **Comment** un montant s'arrondit | **Le modèle le déclare** (lot C2) — la décision reste celle de son auteur |
| Le **report de page** (« report : 12 480,00 € ») | **Le [moteur](engine.md)** : seul lui sait où il coupe |
| La **conformité** du document produit — facture, relevé, contrat ou tout autre | **L'intégrateur.** Énoncé sans détour dans le README et la documentation |

**Comment cette limite est tenue :** par une **clause explicite** dans le README et la
documentation. C'est la seule mesure retenue.

> **Recommandation non retenue, notée ici pour mémoire :** interdire tout nom de
> fonction à consonance fiscale (`tva()`, `taxe()`, `arrondiLegal()`). Une fonction
> ainsi nommée déplace la responsabilité chez nous par sa seule existence, quoi qu'en
> dise la documentation. La mesure était quasi gratuite ; elle reste disponible si la
> question se pose. Voir le risque correspondant en
> [§6 de la vue d'ensemble](README.md#6-risques-assumés).

---

## Deux vagues, et pourquoi

L'ordre retenu est « brique par brique ». Une nuance s'impose pourtant ici :
une partie du contrat ne sert **qu'à l'éditeur** (la grille, les calques, le
catalogue de données). La décrire avant d'avoir vu une seule page sortir, c'est
concevoir à l'aveugle, puis la refaire.

> **Proposition :** la **vague 1** est terminée avant d'ouvrir le moteur ; la
> **vague 2** attend que la facture comptable soit sortie (J3), parce qu'à ce
> moment-là on saura ce que l'éditeur doit réellement produire.

---

## Vague 1 — de quoi décrire une facture (avant le moteur)

### C1. Formules et agrégations

**Pourquoi.** C'est ce qui rend un modèle autonome : il calcule au lieu de réclamer à
l'application hôte une donnée toute prête pour chaque case. Périmètre retenu, en
quatre familles :

| Famille | Contenu |
| :--- | :--- |
| **Nombres** | Les quatre opérations, les parenthèses, les pourcentages |
| **Agrégations** | Somme, compte, moyenne, minimum, maximum sur les lignes d'un tableau |
| **Conditions** | « si… alors… sinon » à l'intérieur d'une formule, et non seulement autour d'un bloc |
| **Textes et dates** | Coller deux champs, mettre en majuscules ; échéance = date de facture + 30 jours ; **nombre de jours entre deux dates fournies** (par exemple entre l'échéance et la date de traitement transmise par l'application hôte) |

**Prêt quand** une facture calcule elle-même son total de lignes, son montant de
remise, son reste à payer et sa date d'échéance, à partir de données brutes — et
qu'une formule fautive est refusée avec un message qui désigne l'erreur.

**Poids :** L — **Dépend de :** rien — *c'est le lot le plus lourd du contrat*

**Ce que ce lot n'est pas :**

- une **règle fiscale** : aucun taux, aucun régime, aucun arrondi « légal » n'est connu d'Openview ;
- des **fonctions définies par l'utilisateur** (macros, bibliothèque de formules réutilisables) ;
- des **références croisées** entre modèles, ou vers une valeur d'une autre page — le report de page est traité par le [moteur](engine.md) ;
- une **traçabilité** du calcul (« d'où vient ce montant ? »). Écartée du v1 ; c'est pourtant la meilleure défense le jour où un chiffre sera contesté, à rouvrir si cela arrive ;
- une **lecture de l'environnement** : ni horloge, ni fuseau, ni locale système, ni aucune source extérieure. Le jeu de données fourni est la seule entrée. « Aujourd'hui » est une donnée comme une autre, nommée par l'intégrateur ; c'est ce qui rend le déterminisme du lot E6 du [moteur](engine.md) possible.

> Le langage d'expressions actuel et ses limites sont consignés dans
> [ADR 0001](../adr/0001-expression-language.md). Ce lot l'élargit franchement :
> l'ADR devait être amendé dans le même mouvement, sinon la décision écrite et le code
> divergeaient dès le premier lot. ✅ **Fait le 2026-08-13** — l'ADR 0001 porte sa ligne
> « Amendé par », et l'[ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md)
> énonce les dix décisions du lot : l'algèbre passe à 18 kinds, l'arithmétique est en
> IEEE-754 sans arrondi implicite, les dates sont bornées à la « date civile pure », et
> le versionnement du schéma passe à 2 avec sa migration.
>
> Le *comment* de ce lot — découpage en incréments, contrat définitif, plan de
> test, arbitrages tranchés — vit dans
> [docs/plans/c1-formules-et-agregations.md](../plans/c1-formules-et-agregations.md).

### C2. Les arrondis, déclarés par le modèle

**Pourquoi.** C'est le point exact où naît le fameux « écart d'un centime », et la
décision retenue est cohérente avec la limite de responsabilité : **chaque montant
calculé déclare comment il s'arrondit** (précision, sens de l'arrondi). Openview
n'impose aucune règle par défaut qui pourrait être tenue pour une position fiscale.

**Prêt quand** deux modèles arrondissant différemment produisent deux résultats
différents et prévisibles sur le même jeu de données, et qu'aucun total ne diffère de
la somme des montants affichés au-dessus de lui.

**Poids :** S — **Dépend de :** C1 — *jamais reporté : des arrondis ajoutés après coup
faussent tous les modèles déjà écrits*

### C3. Le tableau de lignes

**Pourquoi.** La répétition existe, la notion de **tableau** non : des colonnes,
une largeur par colonne, un en-tête de colonnes, un alignement par colonne
(libellés à gauche, montants à droite). C'est le cœur visuel d'une facture, et le
support des agrégations du lot C1.

**Prêt quand** un tableau à cinq colonnes typé (désignation, quantité, prix
unitaire, remise, montant) est décrit dans un modèle, en-tête compris, et que sa
dernière ligne peut être une somme de ce qui précède.

**Poids :** M — **Dépend de :** C1

### C4. La page

**Pourquoi.** Rien ne décrit aujourd'hui la feuille : format, orientation, marges,
en-tête et pied de page répétés, numérotation. Or l'exigence retenue est
**multi-pages comptable** : sans ces notions, le moteur n'a rien à respecter.

**Prêt quand** un modèle impose son format et ses marges, déclare ce qui se répète
en haut et en bas de chaque page, et ce qui n'apparaît que sur la dernière.

**Poids :** M — **Dépend de :** rien

### C5. L'apparence

**Pourquoi.** Un document sans police, sans couleur et sans filet ne convaincra
personne, quelle que soit la justesse des chiffres. Périmètre volontairement
resserré : polices et tailles, graisse et italique, couleurs de texte et de fond,
bordures et filets, alignements, espacements.

**Prêt quand** deux factures visuellement très différentes sont décrites sans
changer une seule donnée.

**Poids :** L — **Dépend de :** C3

### C6. Langue, devise et formats

**Pourquoi.** Décision structurante prise tôt : un même modèle doit produire une
facture en français/euros et en anglais/dollars. Cela concerne les montants, les
dates, les séparateurs de milliers, la position du symbole monétaire, et les libellés
fixes du modèle.

**Prêt quand** un unique modèle de facture produit deux documents corrects dans
deux langues et deux devises, sans duplication du modèle.

**Poids :** L — **Dépend de :** C2, C5

> **Attention, ce lot ne fait pas de conversion.** Afficher « $ » n'est pas convertir
> des euros en dollars : un taux de change est une donnée, et son choix appartient à
> l'intégrateur — même règle que la TVA.

### C7. Les blocs insécables

**Pourquoi.** Exigence comptable : un bloc de mentions légales, un cadre de
totaux, une adresse ne se coupent jamais en deux entre deux pages. Le contrat doit
permettre de le dire ; le moteur devra l'honorer.

**Prêt quand** un modèle marque un bloc comme insécable et un autre comme
sécable, et que la distinction est lisible par le moteur.

**Poids :** S — **Dépend de :** C4

### C8. Un refus compréhensible

**Pourquoi.** L'intégrateur et, plus tard, l'utilisateur final verront ces
messages. « Modèle invalide » n'aide personne : il faut dire *quel bloc*, *quel
champ*, et *ce qu'on attendait*. Avec le lot C1, ce sujet grandit : une formule peut
diviser par zéro, additionner un texte, ou pointer un champ disparu — et c'est un
non-développeur qui lira le message.

**Prêt quand** dix erreurs typiques — dont cinq erreurs de formule — produisent dix
messages qu'un utilisateur corrige seul.

**Poids :** M — **Dépend de :** C1 à C7

### C9. La pérennité, à chaque ajout

**Pourquoi.** Les huit lots ci-dessus modifient le contrat. La mécanique de
conversion existe : la promesse ne tient que si **chaque** ajout est accompagné de
sa conversion, dans le même mouvement. Repoussée, elle ne se fait jamais.

**Prêt quand** un modèle écrit avant C1 s'ouvre et se rend correctement après C8.

**Poids :** S par lot, jamais reporté — **Dépend de :** chaque lot ci-dessus

---

## Vague 2 — de quoi alimenter l'éditeur (après J3)

### C10. Le catalogue de données de l'intégrateur

**Pourquoi.** Décision retenue : l'application hôte déclare les données
disponibles, avec des libellés métier (« Nom du client », « Lignes de la
commande »). L'éditeur ne proposera que celles-là — c'est aussi ce qui permettra à la
barre de formule de proposer des champs plutôt que d'attendre des noms techniques.

**Prêt quand** un catalogue déclaré par une application hôte suffit à savoir, pour
un modèle donné, si toutes ses données existent — et à lister les libellés
proposables à l'utilisateur.

**Poids :** M — **Dépend de :** J3 atteint

### C11. Grille, colonnes et calques

**Pourquoi.** L'éditeur retenu repose sur une grille pas à pas qui facilite
l'alignement, des colonnes, et des calques pour la profondeur. Le contrat doit
savoir décrire ce que l'utilisateur construira, sinon l'éditeur produira des
modèles que le moteur ne saura pas rendre.

**Prêt quand** un modèle décrit un découpage en lignes et colonnes, un pas de
grille, et un fond de page (filigrane, cachet) placé sur un calque distinct.

**Poids :** L — **Dépend de :** C10, et des enseignements du moteur sur le
multi-pages. *C'est le lot le plus risqué du contrat : voir le risque « calques et
multi-pages » en [§6 de la vue d'ensemble](README.md#6-risques-assumés).*

---

## Ce que cette brique ne fait pas

Elle **décrit**, elle ne **produit** rien : aucune page, aucun pixel, aucun PDF.
Elle ne connaît ni écran, ni serveur, ni imprimante. Si une question commence par
« à quoi ça ressemble », elle appartient au [moteur](engine.md) ou au
[viewer](viewer.md).

Hors périmètre du contrat en v1 : règles fiscales et conversion de devises,
fonctions définies par l'utilisateur, traçabilité des calculs, graphiques, tables des
matières, signature, formulaires remplissables, positionnement libre au millimètre.

---

## La brique est finie quand

Une facture comptable réelle — trois pages, une soixantaine de lignes, totaux
calculés par le modèle, arrondis déclarés, échéance calculée, mentions légales, logo,
deux langues, deux devises — est **entièrement décrite** par un modèle, et qu'un
modèle ou une formule mal formés sont refusés avec un message que leur auteur comprend
seul.
