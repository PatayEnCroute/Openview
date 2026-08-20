# Openview

Moteur d'édition embarquable, open-source et modulaire : un concepteur visuel de modèles de documents et un moteur de rendu, à installer dans l'application d'un tiers. Ce n'est ni un logiciel de gestion, ni un outil de facturation, ni une source de données — l'application intégratrice possède les données et décide de ce que contient le document ; Openview le décrit, le met en page et l'imprime.

## 🚀 Vision du Projet

Openview s'intègre dans le logiciel d'un tiers pour y traiter le problème des éditions : décrire un document une fois, le remplir avec les données de l'application hôte, l'imprimer à l'identique à chaque exécution.

Facture, rapport, relevé, bon de livraison, contrat, étiquette, courrier, bordereau : le type de document est un choix de l'intégrateur, pas une fonctionnalité d'Openview. Openview ne connaît aucun de ces métiers — il exécute un modèle sur un jeu de données qu'on lui remet.

L'approche est *headless* et *embeddable* : Openview ne détient ni les données, ni les modèles, ni leur stockage. Il expose des composants prêts à l'emploi et une API que l'application hôte pilote.

### 🎯 Cibles & Positionnement

* **Utilisateurs finaux :** Non-développeurs (création et édition visuelle de modèles par blocs).
* **Intégrateurs :** Développeurs cherchant une brique logicielle modulaire et robuste à intégrer dans leurs applications web.
* **Ce qu'Openview n'est pas :** ni un logiciel de gestion, ni un outil de facturation, ni une source de données. Il ne détient aucun référentiel, n'interroge aucune base et n'invente aucune valeur. C'est l'application intégratrice qui déclare son catalogue de données, fournit le jeu de données et possède les noms des champs.

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

**Openview n'a pas d'horloge non plus.** « Aujourd'hui » n'est pas une valeur qu'il
fabrique : c'est une donnée du jeu fourni, nommée par l'intégrateur comme il
l'entend. Ce n'est pas une convention imposée — c'est la condition du déterminisme
promis par le [moteur](docs/roadmap/engine.md) : un moteur qui lit l'heure ne peut
pas produire deux fois le même document.

**Avant toute mise en production, faites vérifier les documents produits par les
personnes qui en répondent.** Un document généré par Openview n'est pas une preuve de
conformité.

Cette clause précise le périmètre fonctionnel du projet. Elle s'ajoute à l'exclusion
de garantie de la licence [Apache 2.0](LICENSE) et ne la remplace pas.

## 🏛️ Architecture et Rôles

La solution s'articule autour de quatre briques fondamentales :

* **Le Cœur (`@openview/core`)** : Définition du contrat de **modèle** (AST), types TypeScript partagés, parsing et validation Zod. Il décrit la forme d'un modèle, jamais celle des données de l'intégrateur : aucun nom de champ métier n'y est nommé ni réservé.
* **Le Designer (`@openview/designer`)** : Composant d'édition visuelle permettant de construire des modèles à partir du **catalogue de données déclaré par l'application hôte** — insertion de champs, répétitions, conditions. Le catalogue vient de l'hôte ; le Designer n'en propose aucun par défaut.
* **L'Hébergeur / Moteur (`@openview/engine`)** : Service backend ou bibliothèque de rendu chargé d'injecter le jeu de données **fourni par l'application hôte** dans un modèle, pour générer le document final (ex: PDF). Il ne va chercher aucune donnée de lui-même.
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

Le document de référence est **la facture** — le niveau d'exigence à atteindre, pas
le périmètre du produit. Elle est choisie parce qu'elle concentre les contraintes
les plus dures d'une édition : multi-pages comptable, totaux reportés de page en
page, blocs **insécables** non coupés dès qu'ils peuvent tenir sur une page et
repli documenté au-delà, deux langues et deux devises. Ce qui rend une facture
possible rend possibles les autres éditions — rapports, relevés, bons de
livraison, contrats, courriers, bordereaux. Les jalons ci-dessous parlent donc de
factures, et pour cette raison seule.

Les cinq briques sont publiées **d'un seul bloc** : rien n'est mis à disposition
avant que la chaîne complète produise un document.

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