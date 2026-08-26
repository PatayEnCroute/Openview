# ADR 0001 — Langage d'expression des templates

- **Statut :** 🟢 **Accepté — option C** (2026-08-11), implémentée dans `@openview/core`
- **Date :** 2026-08-11
- **Impact :** `@openview/core` (contrat de données), `@openview/engine` (évaluation), `@openview/designer` (édition)
- **Implémentation :** [`src/expression/expression.ts`](../../packages/core/src/expression/expression.ts) (représentation) et [`src/expression/evaluate.ts`](../../packages/core/src/expression/evaluate.ts) (évaluateur)
- **Amendé par :** [ADR 0003](0003-formules-agregations-et-dates-civiles.md) (2026-08-13) — le
  paragraphe « Rien d'autre » ci-dessous. L'arithmétique et un jeu fermé d'opérations nommées
  entrent dans l'algèbre ; **le refus du parseur, de l'appel de fonction générique et de l'accès
  indexé dynamique reste entier.**

---

## Contexte

Un template Openview contient des parties dynamiques : `{{ invoice.total }}`,
`for each ligne de invoice.lines`, `si remise > 0 alors afficher…`. Le mécanisme
qui exprime et évalue ces parties est **le cœur fonctionnel du produit**, et il
n'est décrit ni dans le README, ni dans ARCHITECTURE.md, ni dans AGENTS.md.

Aujourd'hui, `LoopNode.each` et `ConditionNode.when` sont typés
`ExpressionSource = string` : un placeholder opaque, que rien dans `core`
n'interprète. Ce choix est provisoire et documenté comme tel dans
[`packages/core/src/ast/nodes.ts`](../../packages/core/src/ast/nodes.ts).

Deux contraintes cadrent la décision :

1. **Les auteurs de templates sont des non-développeurs.** Ils construisent leurs
   modèles visuellement dans `@openview/designer`. Toute syntaxe qu'il faut
   apprendre et taper à la main est un échec produit.
2. **Openview s'embarque dans des applications tierces et rend des templates
   rédigés par des utilisateurs.** Évaluer une expression, c'est exécuter
   l'entrée d'un utilisateur. La surface de sécurité est le critère dominant.

---

## Options

### A. Chemins seuls (`invoice.lines`, `customer.name`)

Résolution de chemin, sans opérateur.

- ✅ Trivial à implémenter, aucune surface d'injection, rapide.
- ❌ Ne couvre pas les conditions. Masquer un bloc selon la donnée — `si remise > 0`,
  mais tout autant une clause de contrat ou un pied de page réglementaire — est le
  premier besoin de toute édition ; sans comparaison, le produit ne fait pas son
  travail.

### B. Un langage textuel, avec parseur maison ou bibliothèque

Une grammaire réduite (`a.b`, comparaisons, `&&`/`||`, littéraux), soit écrite,
soit empruntée à une bibliothèque d'expressions sandboxée.

- ✅ Ergonomique pour un intégrateur développeur ; compact en stockage.
- ❌ Il faut écrire **et maintenir** un parseur, ou assumer une dépendance de
  plus dans le chemin critique de sécurité.
- ❌ Le Designer doit faire l'aller-retour texte ↔ interface visuelle : il doit
  parser pour afficher, et générer du texte valide pour enregistrer. C'est deux
  fois le travail, et la source d'incohérences classique.
- ⛔ Si l'implémentation dérive un jour vers `new Function` ou `eval`, c'est une
  RCE dans le processus de rendu. Le risque n'est pas théorique : c'est le
  raccourci naturel quand la grammaire devient contraignante.

### C. Expressions structurées (AST JSON), *recommandé*

L'expression n'est pas une chaîne mais un nœud typé, validé par Zod comme le
reste de l'arbre :

```jsonc
{ "op": "gt", "left": { "path": "line.discount" }, "right": { "literal": 0 } }
```

- ✅ **Aucun parseur, donc aucune surface d'injection.** Il n'y a rien à
  échapper : la structure *est* le contrat, et Zod la valide.
- ✅ **Le Designer la manipule directement.** Un sélecteur de champ, un
  opérateur, une valeur — la représentation stockée correspond exactement à ce
  que l'interface édite. Pas d'aller-retour texte.
- ✅ Le Visiteur de l'AST s'étend naturellement à l'arbre d'expression.
- ✅ `collectExpressions()` devient une analyse statique fiable : on sait
  exactement quelles clés de données un template consomme, avant tout rendu.
- ❌ Verbeux en stockage et pénible à écrire à la main pour un intégrateur.
- ❌ Ajouter un opérateur demande de toucher le schéma, l'évaluateur et l'UI.

---

## Décision retenue

**Option C**, avec un jeu d'opérateurs délibérément minimal en v1 : `path`,
`literal`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `isEmpty`.

Rien d'autre tant qu'un cas d'usage réel ne l'exige pas — c'est la règle
anti-sur-ingénierie d'[AGENTS.md](../../AGENTS.md) §3 appliquée ici.

> **Amendement du 2026-08-13 ([ADR 0003](0003-formules-agregations-et-dates-civiles.md)).** Le
> cas d'usage est arrivé : le lot C1 de la [roadmap du contrat](../roadmap/core.md) — un modèle
> qui ne sait pas dire « total = somme des lignes » ne peut pas décrire une facture. L'algèbre
> passe donc à **18 kinds** et gagne l'arithmétique, les agrégations, une condition interne, la
> concaténation, la mise en majuscules et trois opérations de date civile.
>
> **Ce que l'amendement ne touche pas, et qui reste la substance de cette décision :**
>
> - **pas de parseur** — l'expression reste un arbre validé par Zod, donc il n'y a toujours rien
>   à échapper ;
> - **pas d'appel de fonction générique** — aucun `{ kind: 'call'; fn: string; args: [] }`. Chaque
>   opération est un kind à **champs nommés** et arité fixe, ce qui garde l'arbre fini et
>   terminant par construction, garde le message de refus lisible (« champ `days` manquant »
>   plutôt que « 2 éléments attendus, 1 reçu ») et ferme la place où `tva()` finirait par
>   s'écrire ;
> - **pas de fonctions définies par l'utilisateur**, pas de référence par nom ;
> - **pas d'accès indexé dynamique** ;
> - **pas de coercion**, et l'amendement l'*étend* au lieu de l'éroder : `concat` refuse un
>   nombre, et la mise en chaîne s'écrit explicitement `text(valeur)` ;
> - **pas d'horloge, pas de lecture d'environnement** — voir la troisième décision
>   d'implémentation ci-dessous, que l'ADR 0003 outille au lieu de la relâcher.
>
> La distinction qui porte tout l'amendement : *élargir un jeu fermé d'opérations nommées n'est
> pas ouvrir un espace de noms.* Le premier se relit ; le second se remplit et ne se vide jamais.

L'option B reste ouverte **par-dessus** : une syntaxe textuelle pourra plus tard
compiler *vers* l'AST structuré, comme sucre syntaxique pour développeurs. C'est
le seul ordre qui fonctionne — l'inverse (structurer après coup un langage
textuel déjà stocké chez des clients) impose une migration douloureuse.

---

## Conséquences, telles qu'implémentées

- `ExpressionSource = string` a disparu. `LoopNode.each` et `ConditionNode.when`
  portent désormais un `Expression` structuré.
- **`CURRENT_SCHEMA_VERSION` reste à 1**, aucune migration n'est nécessaire :
  le changement atterrit avant la première release, aucun template n'existe.
  C'était précisément l'objectif du calendrier.
- L'évaluateur vit dans `@openview/core` — pur, testable, isomorphe — parce que
  le Designer en a besoin pour prévisualiser autant que l'Engine pour rendre.
- `collectExpressions()` devient `collectDataPaths()` : la représentation
  structurée rend l'analyse **exacte** plutôt qu'heuristique, y compris pour un
  chemin enfoui dans une comparaison imbriquée.
- Les segments `__proto__`, `constructor` et `prototype` sont refusés **au
  parsing**, donc un template malveillant n'atteint jamais le stockage. Les
  chemins viennent d'utilisateurs ; c'est le premier pas d'une évasion de bac à
  sable.

### Trois décisions prises à l'implémentation

**Aucune coercion dans les comparaisons.** JavaScript évalue `'10' < '9'` à
`true`. `gt`/`gte`/`lt`/`lte` exigent deux nombres ou deux chaînes et lèvent
une erreur typée sinon ; `eq`/`neq` refusent les non-primitifs, qui se
compareraient par référence. Un template comparant une chaîne numérique à un
nombre est un bug de forme de données qui doit remonter.

**Aucune truthiness JavaScript dans les conditions.** Une condition doit
s'évaluer à un booléen strict. Sans cette règle, `{ path: 'invoice.total' }`
serait faux pour un total de `0` — une facture qui masque silencieusement une
ligne à zéro. Les auteurs disposent de `isEmpty`, `not` et des comparaisons.

**Aucune horloge, et aucun accès à l'environnement.** L'algèbre ne comporte ni
`now()`, ni `today`, ni lecture de locale ou de fuseau : « aujourd'hui » est une
donnée comme une autre, fournie par l'intégrateur sous le nom qu'il veut. Ce n'est
pas une convention de nommage qu'Openview imposerait — c'est la conséquence du
déterminisme exigé par le lot E6 du [moteur](../roadmap/engine.md) : deux
exécutions du même modèle doivent donner le même document au caractère près, ce
qu'un évaluateur qui lit l'horloge ne peut pas garantir. La règle vaut d'avance
pour le formatage (lot C6) : une date se **formate**, elle ne se fabrique pas.

> **Tenue, et désormais outillée.** L'[ADR 0003](0003-formules-agregations-et-dates-civiles.md)
> ajoute trois opérations de date **sans** ajouter d'horloge : `dateAdd`, `dateDiff` et
> `endOfMonth` sont des fonctions pures de leurs arguments, calculées par arithmétique entière
> dans `civil-date.ts` — sans un seul `Date`, sans un seul `Intl`. « Aujourd'hui » reste une
> donnée que l'intégrateur nomme. Et la règle cesse de reposer sur la seule vigilance d'un
> relecteur : un `override` Biome et un plugin GritQL refusent désormais la lecture
> d'environnement dans `core` et `engine`.

---

## Ce qui reste ouvert

**Question 2 — donnée manquante : blanc ou erreur ?** Partiellement tranchée par
la séparation des responsabilités : `core` *signale* l'absence (`undefined`), et
c'est la **pipeline de rendu** qui appliquera la politique. Deux cas ont
toutefois reçu un comportement, parce qu'il fallait bien en choisir un :

- une condition sur une donnée absente vaut `false` — la branche est masquée,
  le document ne s'interrompt pas ;
- une boucle sur une donnée absente n'itère pas — zéro ligne, pas d'erreur.

Reste à décider pour les **valeurs textuelles** rendues dans le document : un
`{{ invoice.total }}` absent doit-il imprimer un blanc ou faire échouer le
rendu ? À trancher à l'étape 2, quand `DataBindingStep` existera.

> **[ADR 0010](0010-un-refus-comprehensible.md) a eu l'occasion de fermer cette question, et
> l'a laissée ouverte volontairement.** La roadmap demandait à C8 de « pointer un champ
> disparu », ce qui aurait signifié un code `missing-data` dans `core` — donc l'inverse
> exact des deux comportements ci-dessus, plus la propagation scalaire de `undefined`, plus
> `isEmpty(path)`, qui **utilise** légitimement cette absence. La façade C8 n'a donc reçu
> aucun code d'absence, et trois assertions de son lot **épinglent** les trois comportements
> pour qu'un lot ultérieur ne les renverse pas par inadvertance. La politique reste au
> `DataBindingStep`, seul endroit qui connaisse la position finale d'impression.

> [ADR 0002](0002-data-binding-and-loop-scope.md) a depuis fourni la
> représentation manquante — un texte porte des segments, dont certains sont des
> liaisons. La question restante est donc purement une question de *politique*, et
> elle en emporte une seconde : comment une valeur non textuelle devient du texte.
> ADR 0002 y ajoute aussi la portée de boucle, que celui-ci avait laissée
> implicite.

**Question 3 — typage des lectures.** ✅ **Tranchée le 2026-08-26 par
l'[ADR 0015](0015-le-catalogue-de-donnees-de-l-integrateur.md).** Le paragraphe ci-dessous a
posé la question dans le bon sens, et la réponse ne s'en écarte pas d'un pouce : le catalogue
appartient à l'hôte, `core` n'en réserve rien, et `checkTemplateDataCompatibility(template,
catalogue)` **ne prend pas de jeu de données**. La moitié manquante — le type attendu à chaque
lecture — est un vocabulaire fermé de neuf attentes, dérivé garde par garde de la sémantique
runtime, et non un vérificateur de types général. `collectDataPaths()` sort du lot inchangé :
C10 répond à une autre question, par occurrence et non par chemin dédupliqué.

Formulation d'origine, conservée parce qu'elle reste exacte : **un modèle ne déclare pas le schéma des données, il déclare ce qu'il en
lit.** Le catalogue des champs disponibles appartient à l'application
intégratrice, qui le transmet au Designer (`dataCatalogue`,
[`types.ts`](../../packages/designer/src/types.ts)) ; `core` ne le connaît pas et
n'a pas à le connaître. `collectDataPaths()` fournit déjà une moitié — quels
chemins un modèle lit ; il manque le type attendu à chaque lecture. Les deux
réunis permettraient de confronter un modèle au catalogue de l'hôte *avant*
rendu. C'est une vérification de compatibilité entre deux parties, jamais un
schéma qu'Openview imposerait à l'appelant.
