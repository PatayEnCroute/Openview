# Roadmap — `@openview/engine` (le moteur)

> **Rôle produit :** transformer un modèle et un jeu de données en **document
> final**. C'est la brique qui fait passer Openview de « projet bien structuré » à
> « quelque chose qui produit des documents ».
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

**Rien.** La brique est une coquille vide : aucun document ne sort d'Openview
aujourd'hui. C'est ici que se joue la crédibilité du projet, et c'est le chantier
le plus lourd des cinq.

Format retenu pour la première version : **le PDF, et lui seul**. HTML et image
sont écartés — mais on n'écrira rien qui interdise de les ajouter ensuite.

---

## Les lots, dans l'ordre

### E1. Une facture d'une page sort en PDF

**Pourquoi.** C'est le premier moment où Openview existe vraiment. Périmètre
volontairement pauvre : une facture courte, un tableau qui tient sur la page, les
**formules du modèle évaluées** (totaux, agrégations, échéance, arrondis déclarés), le
logo, l'apparence du modèle respectée.

**Prêt quand** le playground affiche : « choisir un modèle, choisir un jeu de
données, télécharger le PDF » — et que le PDF obtenu est présentable.

**Poids :** L — **Dépend de :** [core](core.md) vague 1 — **Jalon : J2**

### E2. Le tableau déborde proprement

**Pourquoi.** Dès la deuxième facture réelle, les lignes ne tiennent plus sur une
page. Il faut alors : passer à la page suivante, **répéter l'en-tête des
colonnes**, répéter l'en-tête et le pied de page du modèle, et numéroter
« page 2 / 4 ».

**Prêt quand** une facture de soixante lignes produit quatre pages lisibles, dont
aucune ne commence par une ligne orpheline ou un tableau sans en-tête.

**Poids :** L — **Dépend de :** E1

### E3. Les exigences comptables

**Pourquoi.** C'est le niveau d'exigence retenu, et ce qui sépare une démo d'un
outil utilisable en gestion :

- le **total reporté** de page en page (« report : 12 480,00 € ») ;
- les **blocs insécables** jamais coupés (cadre de totaux, mentions, adresse) ;
- les **mentions légales** et le cadre de paiement **sur la dernière page uniquement**.

> **Le report est le seul calcul que le moteur décide lui-même** : il dépend de
> l'endroit où la page se coupe, que personne d'autre ne peut connaître. Tous les
> autres montants sont calculés par les **formules du modèle**, et leur exactitude
> appartient à l'auteur du modèle — voir la
> [règle d'arbitrage](core.md#règle-darbitrage--la-capacité-est-à-nous-la-responsabilité-est-à-lintégrateur).

**Prêt quand** un utilisateur métier lit une facture de trois pages produite par
Openview et ne relève aucune anomalie de mise en page.

**Poids :** XL — **Dépend de :** E2 — **Jalon : J3**

> C'est le lot le plus coûteux de toute la roadmap. Il est aussi celui qu'on ne peut
> pas sacrifier : une pagination comptable ajoutée après coup se paie deux fois.

### E4. Langue et devise au rendu

**Pourquoi.** Le contrat sait décrire un modèle bilingue (core C5) ; le moteur doit
l'honorer : montants, dates, séparateurs, symbole monétaire, libellés fixes.

**Prêt quand** le même modèle, appelé deux fois, produit une facture
français/euros et une facture anglais/dollars, toutes deux correctes.

**Poids :** M — **Dépend de :** E3

### E5. Le moteur sait dire où il coupe

**Pourquoi.** La promesse retenue est un **aperçu identique au PDF, garanti**. Elle
n'est tenable que si le moteur ne se contente pas de produire un fichier, mais sait
aussi restituer la découpe qu'il a décidée — quelle ligne sur quelle page, où
tombent les reports. Sans ce lot, le [viewer](viewer.md) devra deviner, et la
garantie tombe.

**Prêt quand** le moteur peut répondre, pour une facture donnée, « voici les quatre
pages et ce que chacune contient », sans produire le PDF.

**Poids :** M — **Dépend de :** E3 — **Condition de : J4**

### E6. Le même document, à chaque fois

**Pourquoi.** Deux exécutions du même modèle sur deux machines doivent donner le
même document, au caractère près : polices, images, et surtout **résultats de
formules** — un montant qui varie d'un centime selon la machine ruinerait la confiance
plus sûrement qu'un défaut de mise en page.

**Conséquence non négociable : le moteur ne lit ni l'horloge, ni le fuseau, ni la
locale de la machine.** Toute date, y compris « aujourd'hui », arrive dans le jeu de
données sous le nom que l'intégrateur lui a donné. Un moteur qui interroge son
environnement ne peut pas, par construction, produire deux fois le même document.

Les arrondis déclarés par le modèle
([core](core.md) C2) doivent être honorés à la lettre. Sans ce lot, ni contrôle
automatique, ni confiance possible.

**Prêt quand** la même facture produite dix fois, sur deux machines, donne dix
fichiers équivalents.

**Poids :** M — **Dépend de :** E4

### E7. Le lot de documents figés de non-régression

**Pourquoi.** C'est l'outil qui rend la suite tenable en solo à temps partiel : un
petit ensemble de documents figés auxquels toute évolution est comparée. Le premier
filet de sécurité du projet.

**En v1, ce lot ne contient que des factures** — une page, multi-pages, avec report,
deux langues, cas limites — parce qu'elles concentrent les contraintes les plus
dures et qu'un lot qu'on ne peut pas énumérer n'est pas un filet. D'autres types de
documents s'y ajouteront quand un besoin réel le justifiera, jamais par principe.

**Prêt quand** une modification volontairement fautive du moteur est signalée
automatiquement, en désignant la facture et la page concernées.

**Poids :** M — **Dépend de :** E6

### E8. Le moteur survit à un document hostile

**Pourquoi.** Rendre un modèle, c'est exécuter ce que quelqu'un d'autre a écrit. Un
modèle peut boucler à l'infini, réclamer une image de 400 Mo, ou tenter d'aller lire
des fichiers ou des adresses internes du serveur. **Les formules aggravent ce point :
une formule est du calcul, donc quelque chose qui peut tourner trop longtemps ou
grossir sans fin** — il faut la borner en temps comme en taille. Ce lot est
**obligatoire avant d'ouvrir le [service](service-de-rendu.md)** : sans lui, on publie
une porte d'entrée.

**Prêt quand** une petite collection de modèles délibérément hostiles est refusée
ou interrompue proprement, sans mettre le moteur à genoux, et que chaque refus est
journalisé.

**Poids :** L — **Dépend de :** E1 — **Condition de : J5**

### E9. La documentation du moteur

**Pourquoi.** Publication groupée : chaque brique doit être installable et
utilisable par un développeur inconnu. Ici : comment obtenir un PDF en dix lignes,
et ce qui se passe quand ça échoue.

**Prêt quand** quelqu'un d'extérieur produit sa première facture sans nous écrire.

**Poids :** S — **Dépend de :** E7 — **Condition de : J7**

---

## Ce que cette brique ne fait pas

- Elle ne **conserve** rien : ni modèle, ni document produit. C'est l'application hôte qui décide où tout cela vit.
- Elle ne **cherche** aucune donnée : elle reçoit un modèle et un jeu de données de son appelant, et n'interroge aucune base, aucun référentiel, aucune horloge. Openview n'est pas une source de données. Elle charge en revanche les ressources que le modèle désigne — images, polices : ce sont des requêtes sortantes, et c'est exactement la surface que le lot E8 doit borner par une liste blanche.
- Elle ne **corrige** pas un modèle invalide : elle le refuse, avec le message du [contrat](core.md).
- Elle n'affiche rien à l'écran : c'est le [viewer](viewer.md).
- Elle n'est pas un serveur : c'est le [service de rendu](service-de-rendu.md).

Hors périmètre v1 : HTML, image, graphiques, envoi par courriel, archivage, tampons
de signature, génération en lot de milliers de documents.

---

## La brique est finie quand

Une facture de trois pages et soixante lignes, avec reports, blocs insécables,
mentions sur la dernière page, sort en PDF dans deux langues et deux devises ; le
résultat est identique à chaque exécution ; toute régression est détectée
automatiquement ; et un modèle hostile ne fait pas tomber le moteur.
