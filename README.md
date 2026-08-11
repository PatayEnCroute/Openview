# Openview

Moteur open-source et modulaire d'édition, de rendu et de visualisation de documents dynamiques pour les applications web.

## 🚀 Vision du Projet

Openview est une solution conçue pour être intégrée directement dans d'autres logiciels afin de résoudre toutes les problématiques liées aux éditions (factures, rapports, étiquettes, contrats, etc.).

Pensée sous une approche *Headless & Embeddable*, la solution offre une flexibilité totale grâce à des composants prêts à l'emploi et une API découplée du stockage.

### 🎯 Cibles & Positionnement

* **Utilisateurs finaux :** Non-développeurs (création et édition visuelle de modèles par blocs).
* **Intégrateurs :** Développeurs cherchant une brique logicielle modulaire et robuste à intégrer dans leurs applications web.

## 🏛️ Architecture et Rôles

La solution s'articule autour de quatre briques fondamentales :

* **Le Cœur (`@openview/core`)** : Définition du contrat de données, types TypeScript partagés (AST), parsing et validation des schémas de templates via Zod.
* **Le Designer (`@openview/designer`)** : Composant d'édition visuelle permettant aux utilisateurs de construire des modèles (templates) à partir de schémas de données dynamiques (variables, boucles, conditions).
* **L'Hébergeur / Moteur (`@openview/engine`)** : Service backend ou bibliothèque de rendu chargé d'injecter dynamiquement les données dans les templates pour générer le document final (ex: PDF).
* **Le Visualiseur (`@openview/viewer`)** : Composant front-end léger permettant d'afficher le document généré et d'interagir si besoin en modifiant des variables à la volée.

👉 Pour plus de détails techniques et les design patterns appliqués, consultez le document [ARCHITECTURE.md](ARCHITECTURE.md).

## 🛠️ Stack Technique & Structure du Monorepo

Le projet est structuré sous la forme d'un Monorepo.

### Stack Technique Validée

| Brique | Rôle | Technologie |
| :--- | :--- | :--- |
| **Monorepo** | Organisation globale | **pnpm workspaces + Turborepo** |
| **Langage** | Socle global | **TypeScript 7.x** |
| **`@openview/core`** | Contrat, schémas & parsing | **TypeScript pur + Zod** |
| **`@openview/designer`** | Édition visuelle | **React 19 + Tailwind CSS + Shadcn/ui/components** |
| **`@openview/viewer`** | Affichage & Interaction | **React + Tailwind CSS + Shadcn/ui/components** |
| **`@openview/engine`** | Moteur de rendu & Pipeline | **Node.js 24 + Puppeteer / Playwright** |

### 📁 Structure du Monorepo

```text
openview/
├── .agents/                  # Directives et règles de codage pour les agents IA
├── .github/                  # Workflows CI/CD (GitHub Actions & Sécurité)
├── packages/
│   ├── core/                 # @openview/core (AST, schémas Zod et contrats)
│   ├── designer/             # @openview/designer (Interface graphique d'édition)
│   ├── engine/               # @openview/engine (Pipeline de fusion et moteur de rendu)
│   └── viewer/               # @openview/viewer (Composant d'affichage interactif)
├── apps/
│   └── playground/           # Application de test locale de bout en bout
├── package.json              
├── pnpm-workspace.yaml       
└── README.md
```

## 🗺️ Feuille de route (Roadmap)

- [ ] Étape 1 : Définition du contrat de données et structuration du cœur (`@openview/core`)
- [ ] Étape 2 : Implémentation du moteur de fusion et de rendu (`@openview/engine`)
- [ ] Étape 3 : Développement du composant de lecture et d'interaction (`@openview/viewer`)
- [ ] Étape 4 : Conception de l'éditeur visuel de templates (`@openview/designer`)
- [ ] Étape 5 : Mise en place du Playground pour les tests d'intégration locaux

## 🤝 Contribuer

Les contributions sont bienvenues. Le guide [CONTRIBUTING.md](CONTRIBUTING.md)
décrit la mise en route, les quatre portes de validation exécutées par la CI et
les règles de code appliquées automatiquement par le linter.

Les échanges se tiennent selon notre [Code de Conduite](CODE_OF_CONDUCT.md).
Pour signaler une faille de sécurité, suivez [SECURITY.md](SECURITY.md) — jamais
via une issue publique.

## 📄 Licence

Ce projet est distribué sous licence **[Apache 2.0](LICENSE)**.