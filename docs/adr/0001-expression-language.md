# ADR 0001 — Langage d'expression des templates

- **Statut :** 🟡 **Proposé — décision requise avant l'étape 2 (engine)**
- **Date :** 2026-08-11
- **Impact :** `@openview/core` (contrat de données), `@openview/engine` (évaluation), `@openview/designer` (édition)

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
- ❌ Ne couvre pas les conditions. `si remise > 0` est le cas d'usage n°1 sur une
  facture ; sans comparaison, le produit ne fait pas son travail.

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

## Décision proposée

**Option C**, avec un jeu d'opérateurs délibérément minimal en v1 : `path`,
`literal`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `isEmpty`.

Rien d'autre. Pas d'arithmétique, pas d'appel de fonction, pas d'accès indexé
dynamique tant qu'un cas d'usage réel ne l'exige pas — c'est la règle
anti-sur-ingénierie d'[AGENTS.md](../../AGENTS.md) §3 appliquée ici.

L'option B reste ouverte **par-dessus** : une syntaxe textuelle pourra plus tard
compiler *vers* l'AST structuré, comme sucre syntaxique pour développeurs. C'est
le seul ordre qui fonctionne — l'inverse (structurer après coup un langage
textuel déjà stocké chez des clients) impose une migration douloureuse.

---

## Conséquences si l'option C est retenue

- `ExpressionSource = string` disparaît au profit d'un `Expression` structuré, et
  `LoopNode.each` / `ConditionNode.when` changent de type. **À faire avant tout
  enregistrement de template réel** : après, c'est une migration de schéma.
- `CURRENT_SCHEMA_VERSION` passe à 2 avec la migration correspondante — sauf si
  le changement atterrit avant la première release, ce qui est l'objectif.
- L'évaluateur vit dans `@openview/core` (pur, testable, isomorphe), pas dans
  `engine` : le Designer en a besoin pour prévisualiser.

---

## Ce qui reste à trancher

1. **Confirmez-vous l'option C ?** C'est la question bloquante ; les autres en
   découlent.
2. **Chemins manquants :** une donnée absente rend-elle une chaîne vide, ou
   est-ce une erreur de rendu ? Une facture au total manquant qui s'imprime avec
   un blanc est un incident client.
3. **Typage des données :** le template déclare-t-il le schéma Zod des données
   qu'il attend, permettant de valider un jeu de données *avant* rendu ?
