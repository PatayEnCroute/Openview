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

**Poids :** M — **Dépend de :** moteur E5

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
