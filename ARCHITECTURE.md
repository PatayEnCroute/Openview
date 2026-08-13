# Openview - Architecture & Stack Technique

Document de référence décrivant l'architecture technique, les principes de conception, les design patterns et la stack logicielle du projet Openview.

---

## 1. Vision et Positionnement

Openview est un **moteur d'édition embarquable** : un concepteur visuel de modèles de documents et un moteur de rendu, installés dans l'application d'un tiers. Ce n'est ni un logiciel de gestion, ni un outil de facturation, ni une source de données.

Le type de document — facture, rapport, relevé, bon de livraison, contrat, étiquette, courrier, bordereau — est décidé par l'intégrateur. Openview ne connaît aucun de ces métiers : il exécute un modèle sur un jeu de données qu'on lui remet, sans rien attendre de sa structure ni de ses noms de champs.

* **Philosophie :** *Headless & Embeddable*. Openview ne détient ni les données, ni leur stockage, ni les modèles : l'application hôte les possède et les fournit. Ce découplage n'est pas un confort d'architecture — c'est ce qui interdit à Openview de devenir une seconde source de vérité à côté du logiciel qui l'héberge.
* **Cibles des utilisateurs finaux :** Non-développeurs (création et édition visuelle de modèles par blocs).
* **Cibles des intégrateurs :** Développeurs cherchant une brique logicielle robuste et modulaire à intégrer dans leurs applications web.

---

## 2. Briques Système et Rôles

La solution est découpée en quatre modules complémentaires organisés au sein du monorepo :

1. **`@openview/core` (Le Cœur)**
   * **Rôle :** définition du contrat de **modèle** (AST), schémas TypeScript partagés, parsing et validation Zod. `core` décrit la forme d'un *modèle* ; il ne nomme aucun champ métier et n'en réserve aucun. Le **catalogue de données** — la liste des champs disponibles et leurs libellés — est déclaré par l'application intégratrice et transmis à l'éditeur : `core` en connaîtra la forme, jamais le sens, et ne portera **jamais** de schéma pour le jeu de données lui-même.
   * **Contrainte :** TypeScript pur, 0 dépendances UI ou serveur.

2. **`@openview/designer` (Le Designer)**
   * **Rôle :** interface graphique d'édition visuelle permettant de construire des modèles à partir du **catalogue de données déclaré par l'application hôte** — insertion de champs, répétitions, conditions. Le catalogue vient de l'hôte ; le Designer n'en propose aucun par défaut.
   * **Technologie :** Composant React embarquable.
   * **Charte visuelle :** [`packages/designer/DESIGN.md`](packages/designer/DESIGN.md).

3. **`@openview/engine` (Le Moteur de Rendu)**
   * **Rôle :** service de rendu backend chargé d'injecter le jeu de données **fourni par l'application hôte** dans un modèle, pour produire le document final (PDF, HTML, etc.). Le moteur ne va chercher aucune donnée de lui-même, et **n'a pas d'horloge** : « aujourd'hui » lui est transmis comme n'importe quelle autre valeur. C'est la condition du déterminisme exigé par le lot E6 de la [roadmap moteur](docs/roadmap/engine.md) — un moteur qui lit l'heure ne peut pas produire deux fois le même document.
   * **Technologie :** Node.js + Puppeteer / Playwright.

4. **`@openview/viewer` (Le Visualiseur)**
   * **Rôle :** Composant front-end léger d'affichage du document généré permettant l'interaction et la modification de variables à la volée.
   * **Technologie :** Composant React léger.
   * **Charte visuelle :** [`packages/viewer/DESIGN.md`](packages/viewer/DESIGN.md).

---

## 3. Patrons de Conception (Design Patterns) Recommandés

Pour garantir une maintenabilité maximale et guider le développement assisté par IA, Openview s'appuie sur les patrons d'architecture suivants :

### 🌲 A. Patron Composite (AST - Abstract Syntax Tree)
* **Domaine :** `@openview/core` & `@openview/designer`.
* **Principe :** Un modèle de document est représenté sous la forme d'un arbre de nœuds imbriqués (Containers, Sections, Blocs texte, Images, Boucles `for-each`, Conditions `if`). Le patron Composite permet de manipuler les blocs individuels et les conteneurs de manière uniforme.

### 🧭 A bis. Patron Visiteur (parcours de l'AST)
* **Domaine :** `@openview/core`.
* **Principe :** Le Composite se parcourt via des visiteurs, pas via des `switch`
  disséminés. Rendu, validation, collecte de variables et recherche par id sont
  autant de parcours : sans Visiteur, chaque nouveau type de bloc impose de
  modifier tous les sites d'appel.

### 🔌 B. Architecture Hexagonale (Ports & Adapteurs)
* **Domaine :** `@openview/core` & `@openview/engine`.
* **Principe :** Le cœur du projet définit des interfaces (Ports) pour le stockage ou le rendu sans dépendre directement d'implémentations concrètes (Adapteurs comme Puppeteer, Playwright ou Canvas).
* **Conséquence concrète :** Puppeteer n'est **pas** une dépendance directe de
  `@openview/engine`. Il embarque Chromium (~150–300 Mo) que tout intégrateur ne
  voulant que du HTML paierait au téléchargement. Il vit dans un paquet adapteur
  distinct, derrière un port.
* **Limite à respecter :** on n'introduit un Port que lorsqu'un second adaptateur
  existe réellement ou est planifié à trois mois. Extraire une interface plus tard
  est facile ; retirer une abstraction inutile ne l'est jamais.

### 🎯 C. Patron Stratégie (Strategy Pattern)
* **Domaine :** `@openview/engine`.
* **Principe :** Séparation des moteurs d'exportation via une interface `RenderStrategy` (`PdfRenderStrategy`, `HtmlRenderStrategy`, `ImageRenderStrategy`). Permet de permuter facilement le format de sortie.

### ⛓️ D. Patron Pipeline
* **Domaine :** `@openview/engine`.
* **Principe :** Découpage du processus de fusion et de rendu en étapes isolées et testables :
  `Validation Zod` ➔ `Injection de Données` ➔ `Génération DOM` ➔ `Assainissement XSS` ➔ `Impression PDF`.
* **⚠️ Ce n'est pas une Chaîne de Responsabilité.** Un Pipeline exécute **toutes**
  les étapes en transformant la donnée ; une CoR autorise un maillon à interrompre
  la propagation. Le rendu de document exige un Pipeline : une chaîne avec abandon
  anticipé produirait des documents silencieusement tronqués.

### ↺ E. Patron Commande (Command Pattern)
* **Domaine :** `@openview/designer`.
* **Principe :** Encapsulation de chaque action utilisateur (ajout, suppression, modification de bloc) dans un objet `Command` avec méthodes `execute()` et `undo()` pour gérer l'historique Annuler/Rétablir (*Undo/Redo*).

### 🧩 F. Patron Registre (Registry Pattern)
* **Domaine :** `@openview/core` & `@openview/designer`.
* **Principe :** Registre dynamique de types de blocs permettant aux intégrateurs d'enregistrer des composants et briques personnalisées.

---

## 4. Stack Technique Validée

| Brique | Rôle | Technologie |
| :--- | :--- | :--- |
| **Monorepo** | Organisation globale | **pnpm workspaces + Turborepo** |
| **Langage** | Socle global | **TypeScript 7.x** |
| **`@openview/core`** | Contrat, schémas & parsing | **TypeScript pur + Zod** |
| **`@openview/designer`** | Édition visuelle | **React 19 + Tailwind CSS + Shadcn/ui** |
| **`@openview/viewer`** | Affichage & Interaction | **React 19 + Tailwind CSS + Shadcn/ui** |
| **`@openview/engine`** | Moteur de rendu & Pipeline | **Node.js 24 + Puppeteer / Playwright** |

---

## 5. Structure du Monorepo

```text
openview/
├── AGENTS.md                 # Règles de codage imposées aux agents IA
├── .github/                  # Workflows CI/CD et sécurité
├── tools/                    # Outillage partagé (Biome, Vitest, scripts)
├── docs/adr/                 # Décisions d'architecture (ADR)
├── packages/
│   ├── core/                 # @openview/core (Types AST, Zod parsing et contrats)
│   ├── designer/             # @openview/designer (Interface graphique d'édition)
│   │   └── DESIGN.md         #   └─ Charte visuelle & design system
│   ├── engine/               # @openview/engine (Pipeline de fusion et moteur de rendu)
│   └── viewer/               # @openview/viewer (Composant d'affichage interactif)
│       └── DESIGN.md         #   └─ Charte visuelle & design system
├── apps/
│   └── playground/           # Application locale de test de bout en bout
├── package.json              
├── pnpm-workspace.yaml       
├── tsconfig.base.json        
└── README.md
```