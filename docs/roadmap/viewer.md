# Roadmap — `@openview/viewer` (l'aperçu)

> **Rôle produit :** montrer le document **avant** de le produire, pour le vérifier
> avant que l'application hôte ne l'imprime, ne l'envoie ou ne l'archive. C'est la
> brique de la confiance.
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

**Rien.** Coquille vide.

Deux décisions cadrent entièrement cette brique :

1. Son rôle est l'**aperçu avant génération** — pas le document interactif. La
   promesse « l'utilisateur modifie une variable et voit le document se recalculer »
   est reportée en v2, alors que c'est l'idée la plus différenciante du projet. C'est
   un renoncement assumé, à rouvrir dès que le v1 est publié.
2. La fidélité promise est **« identique au PDF, garanti »**. C'est le mot *garanti*
   qui coûte cher : il transforme un simple afficheur en engagement à tenir sur
   chaque évolution du [moteur](engine.md).

---

## Une dépendance à assumer d'emblée

L'aperçu ne peut pas décider lui-même où couper les pages : il afficherait une
pagination plausible et différente du PDF, et la garantie serait fausse dès la
première facture longue. **Le viewer affiche la découpe que le moteur lui donne**
(lot E5 de la [roadmap moteur](engine.md)). Sans E5, cette brique ne peut pas
démarrer honnêtement.

> ✅ **E5 est livré** (2026-08-28,
> [ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md)) : la dépendance est levée, et V1 peut
> démarrer. `createPaginationPort()` rend, sans produire un octet de PDF :
>
> - **l'HTML autonome**, celui-là même que le moteur remet à l'imprimeur ;
> - **un manifeste par page** : ce que la page peint, dans quelle région, sous quel rôle, entier ou
>   coupé ;
> - **la frontière de report** de chaque page et les lignes qui la ferment ;
> - **les replis `keepTogether`** que la suite retenue n'a pas pu honorer.
>
> Ces types vivent dans `@openview/core` : le viewer les importe **sans dépendre de `engine`**, donc
> sans embarquer Chromium dans le bundle client.
>
> **Trois obligations qui pèsent sur V1, et qu'aucune porte ne tiendra à sa place :**
>
> 1. **Ne rien recalculer.** Pas d'expression réévaluée, pas d'écriture résolue, pas d'appel à
>    `Intl`, pas de largeur de colonne recalculée, et surtout **aucune repagination**. Les
>    caractères ICU sont déjà écrits dans la source.
> 2. **Ne jamais injecter l'HTML dans le DOM de l'hôte.** Il porte des données rendues et se traite
>    comme le PDF. Le contexte prévu est un `iframe srcDoc` **sandboxé sans scripts** ; E5 livre une
>    source qui fonctionne sous cette contrainte et une sonde hostile qui le prouve dans un Chromium
>    réel. `dangerouslySetInnerHTML` est hors de question.
> 3. **Ne pas lire le DOM avec des sélecteurs.** La chaîne HTML est **opaque** : ses classes, sa
>    structure et l'ordre de ses attributs ne sont pas un contrat. Ce qu'il faut savoir d'une page
>    est dans le manifeste. Un besoin réel de désigner un nœud à l'écran est un signal de
>    réouverture côté moteur, pas un sélecteur à écrire côté viewer.
>
> **L'attente E4-9 reste ouverte de ce côté.** Sa moitié moteur est fermée : il existe une voie
> publique sans second ICU. La moitié viewer se ferme quand V1 affiche cette source sans la
> retoucher, et V3 la compare effectivement au PDF.

Second point à savoir dès maintenant : l'**éditeur réutilisera cette surface
d'affichage** pour son aperçu en cours d'édition. Ce n'est pas du périmètre en plus,
c'est une contrainte de conception — le viewer doit pouvoir vivre encastré dans un
autre écran, pas seulement en pleine page.

---

## Les lots, dans l'ordre

### V1. Le document s'affiche

**Pourquoi.** Voir ses pages à l'écran, dans l'ordre, avec leurs marges et leur
format réels. Rien de plus.

**Prêt quand** la facture de référence multi-pages s'affiche dans le playground,
page après page, et qu'on reconnaît le PDF.

**Poids :** M — **Dépend de :** moteur E5 ✅ *(livré, la voie est ouverte)*

### V2. La pagination affichée est celle du PDF

**Pourquoi.** C'est là que se gagne ou se perd la promesse. Les sauts de page, les
reports de totaux, les blocs insécables et la numérotation doivent tomber à
l'écran exactement là où ils tombent dans le fichier.

**Prêt quand** sur les factures de référence, chaque page affichée contient
exactement le contenu de la page correspondante du PDF.

**Poids :** L — **Dépend de :** V1

### V3. La garantie est vérifiée automatiquement

**Pourquoi.** Une garantie au pixel adossée à une relecture humaine ne survit pas
six mois : la première régression de saut de page passera inaperçue. Ce lot compare
automatiquement l'aperçu et le PDF sur les factures de référence, et refuse toute
divergence.

**Prêt quand** une modification volontairement fautive du moteur ou de l'aperçu est
signalée automatiquement, en désignant la page fautive.

**Poids :** M — **Dépend de :** V2, moteur E7 — **Jalon : J4**

> 📥 **Le corpus E7 existe et attend V3 (2026-08-29).** Six documents synthétiques, 21 pages, un
> registre énumérable et un manifeste versionné vivent dans `tools/golden/` et
> `tests/golden/e7/references/` ([ADR 0020](../adr/0020-le-lot-de-documents-figes-de-non-regression.md)).
> V3 peut appeler le même registre ou lire son manifeste depuis son propre harnais E2E, plutôt que
> de composer une seconde liste de factures de référence.
>
> **Ce que le corpus ne fait pas, et que V3 doit faire :** E7 compare des PDF entre eux. La parité
> **aperçu ↔ PDF** exige le viewer réel et un rasteriseur commun, et reste entière. Le diagnostic
> mono-page d'E7 est conservateur — une fonte sous-ensemble partagée peut faire différer plusieurs
> pages — ce que seul un diff de pixels tranchera. `@openview/viewer` continue de n'importer ni
> `@openview/engine`, ni l'adaptateur, ni `tools/golden`.

> Ce lot **est** la décision « identique, garanti ». Le retirer, c'est revenir à
> « fidèle, sans garantie » — ce qui est un choix défendable, mais qui doit alors
> être annoncé comme tel dans la documentation et le README.

### V4. Confort de lecture

**Pourquoi.** Vérifier une facture, c'est zoomer sur un montant, sauter à la
dernière page, relire les mentions. Périmètre resserré : zoom, navigation entre les
pages, plein écran, impression directe depuis l'aperçu.

**Prêt quand** un utilisateur métier vérifie une facture de quatre pages sans jamais
ouvrir le PDF.

**Poids :** M — **Dépend de :** V2

### V5. Ce qu'on voit quand ça calcule, et quand ça échoue

**Pourquoi.** Un aperçu qui reste blanc pendant trois secondes est un aperçu cassé,
aux yeux de l'utilisateur. Et un modèle refusé doit expliquer pourquoi, dans les mots
du [contrat](core.md), pas par une page vide.

**Prêt quand** l'attente est visible et bornée, et qu'un modèle invalide affiche un
message que son auteur comprend.

**Poids :** S — **Dépend de :** V1

### V6. La documentation de l'aperçu

**Pourquoi.** Publication groupée : un développeur inconnu doit savoir insérer
l'aperçu dans son écran en quelques minutes, et savoir ce qui est garanti — et ce qui
ne l'est pas.

**Prêt quand** quelqu'un d'extérieur affiche sa première facture sans nous écrire.

**Poids :** S — **Dépend de :** V4 — **Condition de : J7**

---

## Ce que cette brique ne fait pas

- Elle ne **modifie** rien : aucune édition, aucun clic qui change le modèle. C'est le [designer](designer.md).
- Elle ne **produit** pas le PDF : elle montre ce que le [moteur](engine.md) produira.
- Elle ne **conserve** rien.

Hors périmètre v1 : le **document interactif** (modifier des variables à la volée et
voir le document se recalculer), les commentaires et annotations, la comparaison de
deux versions d'un document, la signature.

---

## La brique est finie quand

Un utilisateur métier vérifie à l'écran une facture comptable de plusieurs pages,
décide qu'elle est bonne, et retrouve **exactement** ce document dans le PDF — et
qu'un contrôle automatique le prouve à chaque évolution.
