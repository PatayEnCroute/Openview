# Openview

Moteur open-source et modulaire d'édition, de rendu et de visualisation de documents dynamiques pour les applications web.

## 🚀 Vision du Projet

Openview est une solution conçue pour être intégrée directement dans d'autres logiciels afin de résoudre toutes les problématiques liées aux éditions (factures, rapports, étiquettes, contrats, etc.).

Pensée sous une approche *Headless & Embeddable*, la solution offre une flexibilité totale grâce à des composants prêts à l'emploi et une API découplée du stockage.

### 🎯 Cibles & Positionnement

* **Utilisateurs finaux :** Non-développeurs (création et édition visuelle de modèles par blocs).
* **Intégrateurs :** Développeurs cherchant une brique logicielle modulaire et robuste à intégrer dans leurs applications web.

## ⚖️ Calculs, conformité et responsabilité

Openview **calcule ce que le modèle lui demande de calculer, et rien d'autre**. Un
modèle peut additionner, agréger les lignes d'un tableau, poser des conditions,
calculer une échéance : c'est une capacité de calcul et de mise en page. **Ce n'est pas
un moteur fiscal.**

**Openview ne décide d'aucune règle fiscale, comptable ou légale.** Il ne détermine
jamais, notamment :

* un **taux de TVA** ou de toute autre taxe, ni le régime applicable, ni une exonération ;
* une règle d'**exigibilité**, de prorata ou de calcul d'assiette ;
* une règle d'**arrondi légal** — l'arrondi est déclaré par le modèle, donc choisi par son auteur ;
* un **taux de change** : afficher « $ » ne convertit rien ;
* les **mentions obligatoires** d'un document, qui sont du contenu de modèle ;
* la conformité à un **format de facturation électronique** ou à une obligation déclarative, dans quelque pays que ce soit.

**L'exactitude et la conformité des documents produits relèvent de l'application
intégratrice et de l'auteur du modèle.** L'application intégratrice est la source de
vérité : c'est elle qui connaît ses taux, ses règles et ses obligations, et c'est elle
qui fournit les données. Openview les met en page et exécute les formules écrites dans
le modèle — fidèlement, mais sans les juger.

Ce partage n'est pas une précaution de circonstance, c'est une décision de conception.
Un générateur de documents qui recalculerait une TVA deviendrait une **seconde source
de vérité** à côté du logiciel de gestion : le jour où les deux divergent d'un centime,
la facture est fausse et plus personne ne sait laquelle avait raison. Openview refuse
délibérément ce rôle.

Rien ne vous empêche d'exprimer ces règles dans vos données ou dans vos formules :
c'est même prévu pour. Mais c'est alors **votre** règle, sous votre responsabilité.

**Avant toute mise en production, faites vérifier les documents produits par les
personnes qui en répondent.** Un document généré par Openview n'est pas une preuve de
conformité.

Cette clause précise le périmètre fonctionnel du projet. Elle s'ajoute à l'exclusion
de garantie de la licence [Apache 2.0](LICENSE) et ne la remplace pas.

## 🏛️ Architecture et Rôles

La solution s'articule autour de quatre briques fondamentales :

* **Le Cœur (`@openview/core`)** : Définition du contrat de données, types TypeScript partagés (AST), parsing et validation des schémas de templates via Zod.
* **Le Designer (`@openview/designer`)** : Composant d'édition visuelle permettant aux utilisateurs de construire des modèles (templates) à partir de schémas de données dynamiques (variables, boucles, conditions).
* **L'Hébergeur / Moteur (`@openview/engine`)** : Service backend ou bibliothèque de rendu chargé d'injecter dynamiquement les données dans les templates pour générer le document final (ex: PDF).
* **Le Visualiseur (`@openview/viewer`)** : Composant front-end léger permettant d'afficher le document généré et d'interagir si besoin en modifiant des variables à la volée.

👉 Pour plus de détails techniques et les design patterns appliqués, consultez le document [ARCHITECTURE.md](ARCHITECTURE.md).

Les décisions d'architecture tranchées sont consignées dans [`docs/adr/`](docs/adr/), et les chartes visuelles des deux composants React dans [`packages/designer/DESIGN.md`](packages/designer/DESIGN.md) et [`packages/viewer/DESIGN.md`](packages/viewer/DESIGN.md).

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
├── AGENTS.md                 # Règles de codage imposées aux agents IA
├── .github/                  # Workflows CI/CD (GitHub Actions & Sécurité)
├── tools/                    # Outillage partagé (Biome, Vitest, scripts)
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

Le document de référence est **la facture**, au niveau d'exigence d'un logiciel de
gestion. Les cinq briques sont publiées **d'un seul bloc** : rien n'est mis à
disposition avant que la chaîne complète produise un document.

- [ ] **J1** — Une facture comptable est entièrement *décrite* par un modèle (`@openview/core`)
- [ ] **J2** — Un modèle et des données produisent une facture d'une page en PDF (`@openview/engine`)
- [ ] **J3** — La facture comptable sort : multi-pages, totaux reportés, deux langues (`@openview/engine`)
- [ ] **J4** — On voit la facture avant de la produire, à l'identique (`@openview/viewer`)
- [ ] **J5** — Une application tierce obtient son PDF sans installer le moteur (service de rendu)
- [ ] **J6** — Un gestionnaire non développeur produit sa facture et écrit une formule, seul (`@openview/designer`)
- [ ] **J7** — Publication : documentation par brique, exemples, démo en ligne

Le détail — décisions produit, périmètre de chaque brique, hors-périmètre assumé,
risques et ordre de sacrifice en cas de retard — vit dans
[`docs/roadmap/`](docs/roadmap/README.md), avec une feuille de route par brique.

## 🤝 Contribuer

Les contributions sont bienvenues. Le guide [CONTRIBUTING.md](CONTRIBUTING.md)
décrit la mise en route, les quatre portes de validation exécutées par la CI et
les règles de code appliquées automatiquement par le linter.

Les échanges se tiennent selon notre [Code de Conduite](CODE_OF_CONDUCT.md).
Pour signaler une faille de sécurité, suivez [SECURITY.md](SECURITY.md) — jamais
via une issue publique.

## 📄 Licence

Ce projet est distribué sous licence **[Apache 2.0](LICENSE)**.