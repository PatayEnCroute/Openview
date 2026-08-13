# Roadmap — `@openview/designer` (l'éditeur)

> **Rôle produit :** permettre à un **non-développeur** de créer et d'adapter ses
> modèles de documents. C'est la brique qui porte la promesse du projet — et la seule
> dont le succès se mesure sur une personne, pas sur un fichier.
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

**Rien.** Coquille vide. Une charte visuelle existe
([`packages/designer/DESIGN.md`](../../packages/designer/DESIGN.md)), pas l'éditeur.

Cinq décisions le cadrent : mise en page en **colonnes + grille pas à pas** (avec
aide à l'alignement) **+ calques** pour la profondeur ; données proposées à partir du
**catalogue déclaré par l'intégrateur** ; **les formules sont écrites par
l'utilisateur non-développeur** dans une barre de formule assistée ; premier pas
depuis une **bibliothèque de modèles livrés** ; validation par un **utilisateur
métier**.

> La décision sur les formules fait de cette brique **la plus lourde des cinq**.
> Écrire une formule sans être développeur suppose de choisir ses champs dans une
> liste, de voir le résultat en direct et d'être guidé quand on se trompe : c'est le
> chantier où les tableurs ont passé trente ans.

---

## Le garde-fou qui gouverne toute la brique

> **L'éditeur ne doit jamais permettre de construire un modèle que le moteur ne sait
> pas rendre.** Un utilisateur qui met une heure sur un modèle et découvre au
> téléchargement que sa page est cassée ne revient pas.

Conséquence directe : chaque possibilité offerte dans l'éditeur doit déjà être
décrite par le [contrat](core.md) et honorée par le [moteur](engine.md). L'éditeur
est la dernière brique construite, et ce n'est pas un hasard.

---

## Les lots, dans l'ordre

### D1. Ouvrir un modèle et le voir

**Pourquoi.** Le point de départ minimal : afficher un modèle livré, se déplacer
dedans, sélectionner un bloc et comprendre ce qu'on a sélectionné.

**Prêt quand** la facture livrée s'ouvre, et qu'un clic sur le total dit clairement
« ceci est le total à payer, calculé à partir des lignes ».

**Poids :** M — **Dépend de :** [viewer](viewer.md) V2, [core](core.md) C10

### D2. Changer ce qui se change tout le temps

**Pourquoi.** Dans la vraie vie, 80 % du besoin est là : remplacer le logo, changer
les couleurs, corriger une mention légale, ajuster un libellé, changer la police.
Aucun déplacement de bloc, aucune structure touchée.

**Prêt quand** un gestionnaire transforme la facture livrée en facture de son
entreprise — logo, couleurs, coordonnées, mentions — sans jamais déplacer un bloc.

**Poids :** L — **Dépend de :** D1

### D3. Annuler, rétablir, ne jamais perdre son travail

**Pourquoi.** Ce n'est pas une fonctionnalité, c'est une **propriété** de l'éditeur :
sans elle, un utilisateur non technique n'ose rien essayer, et l'éditeur paraît
hostile. Elle doit exister dès la première modification possible, pas être ajoutée
après coup.

**Prêt quand** vingt modifications successives s'annulent et se rétablissent dans
l'ordre, et qu'une fermeture accidentelle ne perd rien.

**Poids :** M — **Dépend de :** D2 *(à concevoir avec D2, pas après)*

### D4. Insérer une donnée

**Pourquoi.** L'utilisateur choisit dans une liste de données lisibles — « Nom du
client », « Lignes de la commande », « Total à payer » — déclarée par l'application
hôte. Il ne tape jamais un nom technique, et il est averti si un modèle utilise une
donnée qui n'existe plus.

**Prêt quand** un utilisateur ajoute le numéro de commande et la date d'échéance dans
son en-tête, sans aide et sans documentation.

**Poids :** L — **Dépend de :** D3

### D5. La grille : placer et aligner

**Pourquoi.** C'est la mise en page retenue : découper en lignes et colonnes, et
déplacer pas à pas sur une grille qui aide à aligner. L'enjeu produit n'est pas la
liberté, c'est qu'un document **reste droit** : deux blocs alignés doivent le rester.

**Prêt quand** un utilisateur construit un en-tête à trois colonnes (logo,
coordonnées, cadre facture) parfaitement aligné, au clavier comme à la souris.

**Poids :** XL — **Dépend de :** D4, [core](core.md) C11

### D6. Le tableau de lignes et les conditions, en langage métier

**Pourquoi.** Un non-développeur ne dira jamais « boucle » ni « expression
conditionnelle ». Il dira « une ligne par article » et « n'afficher ce cadre que s'il
y a une remise ». C'est un travail de **formulation** autant que d'interface.

**Prêt quand** un utilisateur ajoute une colonne au tableau des lignes et masque le
bloc « acompte » quand il n'y a pas d'acompte, sans savoir ce qu'est une condition.

**Poids :** XL — **Dépend de :** D5

### D7. La barre de formule

**Pourquoi.** C'est la décision la plus engageante de la roadmap : **l'utilisateur
final écrit ses propres formules**. Quatre choses sont indissociables, et une seule
qui manque suffit à rendre l'ensemble inutilisable pour un non-développeur :

| Ce qu'il faut | Pourquoi ce n'est pas optionnel |
| :--- | :--- |
| **Choisir ses champs dans une liste** | Personne ne devine un nom technique. Le catalogue de l'intégrateur ([core](core.md) C10) fournit des libellés lisibles |
| **Voir le résultat en direct** | Une formule dont on ne voit pas le résultat est une formule qu'on n'ose pas écrire |
| **Être guidé quand on se trompe** | Division par zéro, champ disparu, texte additionné : le message doit dire quoi corriger, pas « erreur de syntaxe » |
| **Comprendre où s'applique la formule** | « Somme des montants » de *quel* tableau ? La portée doit être visible, sinon les agrégations produisent des chiffres faux en silence |

**Prêt quand** un gestionnaire écrit lui-même « reste à payer = total − acompte » et
« échéance = date de facture + 30 jours », se trompe une fois, comprend le message, et
corrige sans aide.

**Poids :** XL — **Dépend de :** D6, [core](core.md) C1

> **Le lot le plus exposé de la roadmap.** Si le temps manque, il retombe en *mode
> avancé* : les formules restent visibles et fonctionnelles, mais seules celles des
> modèles livrés existent, et c'est l'intégrateur qui les écrit. La capacité est
> conservée, le confort est reporté. Voir
> [§7 de la vue d'ensemble](README.md#7-si-le-temps-manque--ordre-de-sacrifice).

### D8. Enregistrer et rouvrir

**Pourquoi.** Openview ne conserve rien (décision retenue : l'intégrateur stocke).
L'éditeur doit donc savoir **remettre** proprement un modèle à l'application hôte et
en **accepter** un en retour, et l'utilisateur doit comprendre que son travail est
sauvegardé — ou qu'il ne l'est pas encore.

**Prêt quand** un modèle édité, remis à l'application d'exemple, rouvert le
lendemain, est identique — et que l'état « enregistré / non enregistré » est visible
en permanence.

**Poids :** M — **Dépend de :** D3

### D9. La bibliothèque de modèles de départ

**Pourquoi.** Décision retenue : l'utilisateur ne part jamais d'une page blanche.
Trois modèles livrés — **facture**, rapport, contrat. Ils sont la vitrine du projet et
fixent le niveau de qualité attendu. Ils sont aussi une charge permanente : chaque
évolution du contrat oblige à les retoucher.

**Prêt quand** les trois modèles s'ouvrent, se rendent correctement, et sont assez
soignés pour qu'on ose les montrer.

**Poids :** L — **Dépend de :** D7 — *premier candidat à la réduction (à un seul
modèle) en cas de retard*

### D10. Les calques

**Pourquoi.** Décision retenue pour la profondeur. Périmètre à tenir volontairement
étroit : **fonds de page, filigranes, cachets** — c'est-à-dire ce qui se place
derrière ou devant le contenu sans participer au flux du document.

**Prêt quand** un filigrane « DUPLICATA » et un fond de page apparaissent sur toutes
les pages d'une facture de trois pages, derrière le tableau, sans perturber la
pagination.

**Poids :** L — **Dépend de :** D5, [core](core.md) C11

> Le point le plus risqué techniquement : superposer des éléments « en profondeur »
> sur un document dont le contenu se déplace de page en page. Traité en dernier, et
> deuxième candidat au sacrifice.

### D11. La séance de validation métier

**Pourquoi.** C'est **la** preuve de qualité retenue, et le seul moyen de savoir si
la promesse « utilisable par un non-développeur » est tenue. Une séance
d'observation : la personne fait, on ne l'aide pas, on note où elle bloque. Avec la
barre de formule dans le périmètre, cette séance devient franchement plus exigeante :
c'est là qu'on saura si les formules sont utilisables ou seulement disponibles.

**Prêt quand** un gestionnaire, sans aide et sans formation, part d'un modèle livré,
produit la facture de son entreprise **et écrit au moins une formule juste**, en moins
d'une heure.

**Poids :** S en charge, **critique en organisation** — **Dépend de :** D9 —
**Jalon : J6**

> **Action ouverte :** cette personne n'est pas identifiée. Sans elle, J6 ne peut pas
> être prononcé. Voir [§8 de la vue d'ensemble](README.md#8-décisions-encore-ouvertes).

### D12. La documentation de l'éditeur

**Pourquoi.** Deux publics, deux documents : le **développeur** qui insère l'éditeur
dans son application et déclare son catalogue de données ; l'**utilisateur final** qui
a besoin d'un guide court et illustré — dont une page sur les formules, qui sera la
plus lue et la plus relue.

**Prêt quand** un intégrateur inconnu affiche l'éditeur avec son propre catalogue de
données sans nous écrire.

**Poids :** M — **Dépend de :** D11 — **Condition de : J7**

---

## Ce que cette brique ne fait pas

- Elle ne **produit** pas le document : elle produit un **modèle**. Le PDF vient du [moteur](engine.md).
- Elle ne **conserve** rien : c'est l'application hôte.
- Elle ne **décide** d'aucune règle de calcul métier ou fiscale : elle permet de les écrire, l'auteur du modèle en répond ([règle d'arbitrage](core.md#règle-darbitrage--la-capacité-est-à-nous-la-responsabilité-est-à-lintégrateur)).
- Elle ne gère ni comptes, ni droits, ni « qui a le droit de modifier quel modèle ».
- Elle ne connaît **aucun nom de champ d'avance** : la liste des données proposées, leurs libellés et leur organisation viennent entièrement du catalogue déclaré par l'application hôte. Openview n'embarque aucun vocabulaire métier.

Hors périmètre v1 : positionnement libre au millimètre, travail à plusieurs sur un
même modèle, bibliothèque de formules réutilisables entre modèles, commentaires et
validation dans l'outil, historique des versions publié, import de modèles existants
(Word, HTML, autre outil), thèmes et chartes graphiques réutilisables.

---

## La brique est finie quand

Un gestionnaire qui n'a jamais vu Openview ouvre un modèle livré, l'adapte à son
entreprise, ajoute une colonne à son tableau de lignes, masque un bloc conditionnel,
**écrit une formule et la corrige seul**, enregistre, et obtient une facture comptable
conforme — sans aide, sans documentation, et sans jamais pouvoir construire un modèle
que le moteur refusera.
