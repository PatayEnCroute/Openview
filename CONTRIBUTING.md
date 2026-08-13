# Contribuer à Openview

Merci de votre intérêt. Ce document décrit ce qui est attendu d'une contribution
et comment vérifier votre travail localement avant d'ouvrir une Pull Request.

---

## 🚀 Mise en route

Prérequis : **Node.js ≥ 24** et **pnpm ≥ 11** (le champ `packageManager` fixe la
version exacte, activez-la avec `corepack enable`).

```bash
pnpm install
```

L'installation configure aussi le hook de pre-commit (`core.hooksPath`). Il
**vérifie** le contenu indexé avant chaque commit — exactement ce que le commit
va enregistrer, et non le contenu du répertoire de travail. Il ne corrige rien :
lancez `pnpm run lint:fix` puis réindexez.

## 🧪 Les quatre portes de validation

La CI exécute exactement ces commandes. Faites-les passer en local d'abord.

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

| Commande | Ce qu'elle vérifie |
| :--- | :--- |
| `pnpm run lint` | Biome : formatage, ordre des imports, et les règles d'[AGENTS.md](AGENTS.md) que le compilateur ne peut pas exprimer |
| `pnpm run build` | Compilation TypeScript de tous les paquets |
| `pnpm run type-check` | Typage strict, **fichiers de test inclus** |
| `pnpm run test:coverage` | Vitest avec un seuil de couverture à 90 % |

Correction automatique de ce qui est corrigeable :

```bash
pnpm run lint:fix
```

## 📐 Règles de code non négociables

Elles sont détaillées dans [AGENTS.md](AGENTS.md). Les quatre suivantes sont
**appliquées mécaniquement** — inutile de discuter avec le linter, il gagnera :

- Pas de `any`, pas de `as unknown as X`, pas de `@ts-ignore`.
- Pas d'assertion non-nulle `!` : elle annule `noUncheckedIndexedAccess`.
- Pas de `try/catch` vide. Un commentaire dans le `catch` ne compte pas comme
  traitement de l'erreur ; journalisez-la ou relancez une erreur typée.
- Toute fonction de `@openview/core` ou `@openview/engine` a un `*.test.ts`.

### Trois règles que rien n'arrêtera à votre place

Elles ne sont tenues que par la revue — voir le tableau en tête
d'[AGENTS.md](AGENTS.md), qui dit ce qui vous arrêtera réellement :

- Tout contrat **de donnée** d'Openview (modèle, nœuds, expressions) est validé par
  un schéma **Zod** de `@openview/core` ; les **ports**, eux, restent des
  interfaces TypeScript. Seule exception côté données : le **jeu de données de
  l'intégrateur** n'a pas de schéma dans `core` et n'en aura jamais — sa forme
  appartient à l'application hôte.
- Openview ne réserve **aucun nom de champ** et n'attend **aucune structure de
  données**. Une fonctionnalité qui oblige l'intégrateur à nommer un champ comme
  Openview l'a décidé est à refuser.
- Ni horloge, ni fuseau, ni locale système, ni aléa dans `core` et `engine` :
  « aujourd'hui » est une donnée fournie.

### Sens des dépendances

Le linter refuse les imports qui violent l'architecture :

- `@openview/core` n'importe **ni** React, **ni** Puppeteer, **ni** un paquet frère.
- `@openview/engine` n'importe pas la couche UI.
- `@openview/designer` et `@openview/viewer` n'importent pas `@openview/engine`
  (cela embarquerait Chromium dans le bundle navigateur).

## 🔀 Pull Requests

1. Une PR = un sujet. Les PR qui mélangent un correctif, un refactor et une
   nouvelle dépendance sont renvoyées.
2. Remplissez la checklist du template de PR.
3. **Nouvelle dépendance :** justifiez-la dans la description. Si pnpm ajoute une
   entrée `minimumReleaseAgeExclude` dans `pnpm-workspace.yaml`, expliquez
   pourquoi le paquet est digne de confiance — cette dérogation contourne une
   protection supply-chain.
4. Les commits suivent [Conventional Commits](https://www.conventionalcommits.org/fr/)
   (`feat:`, `fix:`, `ci:`, `docs:`, `refactor:`, `test:`, `chore:`).

## 🔒 Sécurité

Ne signalez **jamais** une vulnérabilité via une issue publique. La procédure est
décrite dans [SECURITY.md](SECURITY.md).

## 📄 Licence

En contribuant, vous acceptez que votre travail soit distribué sous licence
[Apache 2.0](LICENSE).
