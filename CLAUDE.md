# CLAUDE.md

Les règles de ce dépôt vivent dans un fichier unique, [AGENTS.md](AGENTS.md), pour
que tous les agents lisent la même chose. Ce fichier ne fait que l'importer.

@AGENTS.md

---

## Rappel express

Avant de proposer un changement, faites passer les quatre portes — ce sont
exactement les commandes de la CI :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Quatre réflexes qui coûtent cher ici :

- **Ne desserrez jamais une contrainte pour débloquer une compilation.** Modifier
  `tsconfig`, `biome.jsonc` ou un plugin GritQL parce qu'il vous refuse quelque
  chose, c'est supprimer le garde-fou plutôt que le bug (AGENTS.md §7).
- **`!`, `@ts-ignore` et `as unknown as` sont bloquants**, pas déconseillés. Un
  blocage signifie que le type est faux ou que la donnée n'est pas validée par
  Zod (§1.1).
- **`await` explicite partout.** TypeScript 7 prive le projet de linting typé,
  donc de `no-floating-promises` : aucun outil ne rattrapera une promesse
  oubliée (§1.5).
- **Openview ne connaît aucune donnée métier.** Le jeu de données appartient à
  l'application intégratrice : ne réservez aucun nom de champ, n'écrivez pas de
  schéma Zod pour `RenderRequest.data`, et n'introduisez pas d'horloge —
  « aujourd'hui » est une donnée fournie (AGENTS.md, « Ce qu'Openview n'est pas »).
