# Openview - Directives & Rules pour les Agents IA

Ce document définit les règles de codage, les patrons de conception et l'architecture stricte que tout assistant ou agent IA (Gemini, Claude, Copilot, ChatGPT) **DOIT** suivre lorsqu'il génère ou modifie du code dans le monorepo **Openview**.

---

## 🛑 1. Règles d'Or & Typage Strict

1. **Typage Strict sans concession :**
   - **Interdiction formelle d’utiliser `any`** ou des tricheurs de typage (`as unknown as X`).
   - Utilisez des types explicites ou des génériques typés.
   - Activez et respectez `noUncheckedIndexedAccess` (vérifiez toujours l'existence d'un élément d'un tableau avant d'y accéder).

2. **Validation des Schémas (Schema-First) :**
   - Tout contrat de donnée ou schéma de template doit être défini et validé dans `@openview/core` à l’aide de **Zod** avant d’être consommé par `@openview/engine` ou `@openview/designer`.
   - Ne faites jamais confiance aux données externes sans parsing préalable via `Zod`.

3. **Gestion des Erreurs :**
   - **Interdiction des `try/catch` vides** qui étouffent les exceptions.
   - Toute erreur capturée doit être journalisée ou relancée avec un message explicite et typé.

---

## 🏛️ 2. Architecture & Séparation des Responsabilités

- **`@openview/core`** : Contient uniquement du TypeScript pur et des schémas Zod (0 dépendances UI React ou serveur Node/Puppeteer).
- **`@openview/designer`** : Composant UI React d'édition visuelle. Ne contient pas de logique serveur ou de génération PDF directe.
- **`@openview/engine`** : Service backend (Node.js). Gère le pipeline de fusion JSON/Template et le rendu Puppeteer/Playwright.
- **`@openview/viewer`** : Composant UI React d'affichage et d'interaction léger.

👉 **Aucun couplage direct** entre l'UI et le stockage de données (approche *Headless & Embeddable*).

---

## 🧩 3. Patrons de Conception (Design Patterns) Obligatoires pour l'IA

Lors de la génération de code, l'agent IA **DOIT** structurer son implémentation selon les design patterns suivants :

1. **Composite Pattern (Nœuds AST dans `@openview/core`)** :
   - Modélisez la structure du template comme un arbre de nœuds (`BaseNode`, `ContainerNode`, `TextNode`, `ImageNode`, `LoopNode`).
   - Traitez les conteneurs et les feuilles de façon uniforme.

2. **Strategy Pattern (Moteurs de Rendu dans `@openview/engine`)** :
   - Pour tout nouveau format de rendu (PDF, HTML, Image), créez une classe implémentant `RenderStrategy`.

3. **Pipeline Pattern (Pipeline de Fusion dans `@openview/engine`)** :
   - Découpez la génération de documents en étapes séquentielles et isolées (`ValidationStep` ➔ `DataBindingStep` ➔ `DomBuildStep` ➔ `SanitizeStep` ➔ `PdfExportStep`).

4. **Command Pattern (Actions annulables dans `@openview/designer`)** :
   - Toute modification de l'arbre AST dans l'éditeur visuel doit passer par un objet `Command` (`execute()`, `undo()`) pour garantir l'historique Undo/Redo.

5. **Registry Pattern (Enregistrement de Blocs)** :
   - Utilisez un registre dynamique pour associer le type de bloc (ex: `'barcode'`) à son schéma Zod et son composant d'édition.

---

## 🔄 4. Workflow de Développement Recommandé pour l'IA

Lorsqu'on demande à l'IA d'implémenter une nouvelle fonctionnalité :
1. **Étape 1 (Cœur)** : Créer ou mettre à jour les types AST et les schémas Zod dans `@openview/core`.
2. **Étape 2 (Tests Core)** : Écrire les tests unitaires Vitest correspondant dans `packages/core/src/*.test.ts`.
3. **Étape 3 (Engine / Designer)** : Implémenter l'étape de rendu dans `@openview/engine` ou l'interface dans `@openview/designer`.
4. **Étape 4 (Validation)** : Exécuter `pnpm run type-check` pour vérifier la concordance globale des types.

---

## 🧪 5. Quality & Testing

- **Tests unitaires obligatoires :** Chaque nouvelle fonction créée dans `@openview/core` ou `@openview/engine` doit comporter un fichier de test associé (`*.test.ts`) utilisant **Vitest**.
- **Non-duplication :** Avant d'écrire une fonction utilitaire, vérifiez si elle n'existe pas déjà dans `@openview/core`.

---

## 🔒 6. Sécurité

- **Assainissement XSS :** Tout contenu HTML ou template rendu dynamiquement dans `@openview/viewer` ou `@openview/engine` doit être assaini (*sanitized*).
- **Secrets :** Aucun secret, clé API ou valeur confidentielle ne doit figurer dans le code.

---

## ⚙️ 7. Pièges CI/CD & Monorepo à Éviter

1. **Précédence du Build sur le Type-Check :**
   - En environnement CI, les fichiers d'avertissement/déclarations `.d.ts` dans `./dist` doivent exister pour que les paquets consommateurs compilent. Exécutez systématiquement `build` avant `type-check` (ou utilisez Turborepo `dependsOn: ["^build"]`).

2. **Action pnpm GitHub Actions (`pnpm/action-setup@v4`) :**
   - Ne spécifiez **jamais** l'attribut `version` dans le fichier YAML du workflow si `packageManager` est défini dans `package.json` afin d'éviter les erreurs de conflit de version.
