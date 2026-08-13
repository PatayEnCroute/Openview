---
name: Openview Designer System
colors:
  surface: '#F8FAFC'
  surface-dim: '#E2E8F0'
  surface-bright: '#FFFFFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#F1F5F9'
  surface-container: '#E2E8F0'
  surface-container-high: '#CBD5E1'
  surface-container-highest: '#94A3B8'
  on-surface: '#0F172A'
  on-surface-variant: '#475569'
  inverse-surface: '#0F172A'
  inverse-on-surface: '#F8FAFC'
  outline: '#CBD5E1'
  outline-variant: '#E2E8F0'
  surface-tint: '#6366F1'
  primary: '#4F46E5'
  on-primary: '#FFFFFF'
  primary-container: '#EEF2FF'
  on-primary-container: '#312E81'
  inverse-primary: '#818CF8'
  secondary: '#0EA5E9'
  on-secondary: '#FFFFFF'
  secondary-container: '#E0F2FE'
  on-secondary-container: '#0369A1'
  tertiary: '#F59E0B'
  on-tertiary: '#92400E'
  tertiary-container: '#FEF3C7'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#FEE2E2'
  on-error-container: '#991B1B'
  background: '#F8FAFC'
  on-background: '#0F172A'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.375rem
  md: 0.5rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

# Openview Designer - Charte Visuelle & Spécifications Design System

Ce document définit l'identité visuelle, la philosophie d'interface utilisateur (UI), l'expérience utilisateur (UX) et les spécifications de composants du paquet **`@openview/designer`**.

> **Sources de vérité en amont.** Le modèle de document est défini par
> [`@openview/core`](../core/src/ast/nodes.ts) et la représentation des liaisons
> dynamiques par l'[ADR 0001](../../docs/adr/0001-expression-language.md). En cas
> de divergence, le code et l'ADR l'emportent sur ce document.
>
> **Jetons partagés.** Le bloc de métadonnées en tête de ce fichier est identique
> à celui de [`@openview/viewer`](../viewer/DESIGN.md) : les deux paquets
> partagent une seule et même palette. Toute modification doit être reportée dans
> les deux fichiers — la dette est décrite en fin du document du viewer.

---

## 1. Philosophie & Principes d'Interface (Shadcn/ui Aesthetics)

Openview Designer est un studio visuel d'édition de **modèles** de documents — jamais de documents remplis — conçu pour être **embarqué (*embeddable*)** dans n'importe quel logiciel hôte (ERP, CRM, SaaS métier) ou utilisé en **mode studio indépendant**.

Les champs manipulables dans l'éditeur sont ceux du **catalogue déclaré par l'application hôte**. Le Designer n'en propose aucun par défaut et n'en réserve aucun : il affiche les libellés que l'intégrateur a déclarés, dans le vocabulaire de son métier.

### Principes Clés
1. **Économie de moyens & Prévention de la fatigue visuelle** :
   - Fond neutre Slate (`#F8FAFC` en clair, `#020617` en sombre).
   - Les panneaux d'outils fournissent un cadre sobre et discret pour mettre en valeur le canevas de document.
2. **Contraste WYSIWYG Haute Fidélité** :
   - La feuille de document A4 s'affiche en blanc pur (`#FFFFFF`) avec une ombre portée douce (`shadow-md`), afin d'offrir un rendu fidèle du document final imprimé.
3. **Signalétique Visuelle des Blocs Spéciaux** :
   - **Blocs Standards (Texte, Image, Tableau)** : Contour bleu Indigo (`#4F46E5`) lors de la sélection.
   - **Blocs Logiques (Boucle `for-each`, Condition `if/else`)** : Marqueurs et badges en Ambre (`#F59E0B`) ou Cyan (`#0EA5E9`) pour faire ressortir la structure logique du modèle d'un coup d'œil.

> ⚠️ **Le bloc Tableau n'existe pas encore dans le modèle.** L'AST de
> `@openview/core` définit `text`, `image`, `container`, `loop` et `condition` ;
> `BlockType` dans [`src/types.ts`](src/types.ts) y ajoute `table` sans
> contrepartie côté cœur. Deux options, à trancher : un tableau est un
> `container` conventionnel avec un style dédié, ou c'est un type de nœud à part
> entière — auquel cas il faut l'ajouter à `DocumentNode`, à son schéma Zod et au
> `NodeVisitor`, dont la branche `never` rendra l'oubli impossible à ignorer.

---

## 2. Palette de Couleurs (Shadcn Slate & Indigo)

| Élément | Couleur / Classe Tailwind | Valeur Hex |
| :--- | :--- | :--- |
| **Fond d'application** | `bg-slate-50` / `dark:bg-slate-950` | `#F8FAFC` / `#020617` |
| **Panneaux (Sidebar & Inspector)** | `bg-slate-100` / `dark:bg-slate-900` | `#F1F5F9` / `#0F172A` |
| **Bordures** | `border-slate-200` / `dark:border-slate-800` | `#E2E8F0` / `#1E293B` |
| **Couleur Primaire (Accent & Sélections)** | `bg-indigo-600` / `text-indigo-600` | `#4F46E5` |
| **Accents des liaisons dynamiques** | `bg-sky-500` / `text-sky-600` | `#0EA5E9` |
| **Avertissements & Boucles Logiques** | `bg-amber-500` / `text-amber-600` | `#F59E0B` |

---

## 3. Ergonomie & Disposition à 3 Colonnes

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BARRE D'OUTILS SUPÉRIEURE (Header Toolbar)                                             │
│ [Undo/Redo] | Mode: [Édition / Prévisualisation] | [Variables JSON] | [Bouton Exporter]  │
├───────────────────┬────────────────────────────────────────────────┬───────────────────┤
│ PALETTE & ARBRE   │ CANEVAS DE DOCUMENT (WYSIWYG)                  │ INSPECTEUR        │
│ (Gauche - 240px)  │ (Centre - Fluid)                               │ (Droite - 280px)  │
│                   │                                                │                   │
│ • Blocs (Texte,   │ ┌────────────────────────────────────────────┐ │ • Styles          │
│   Image, Table,   │ │ Page A4 (Grille, Marges)                   │ │   (Typo, Marge)   │
│   Boucle `for`)   │ │                                            │ │                   │
│ • Arbre AST       │ │  [Bloc Sélectionné - Bordure Indigo]       │ │ • Champs déclarés │
│ • Variables JSON  │ │                                            │ │   {{ client.nom }}│
│                   │ └────────────────────────────────────────────┘ │ • Condition `if`  │
└───────────────────┴────────────────────────────────────────────────┴───────────────────┘
```

`client.nom` est un exemple, pas une convention (voir §1).

---

## 4. Modes d'Intégration & Composant Embarquable

Le composant `@openview/designer` doit pouvoir être utilisé selon **3 modes**
d'affichage, pilotés par la propriété `layoutMode` de
[`OpenviewDesignerOptions`](src/types.ts) :

1. **Mode Full Studio (`layoutMode="fullscreen"`)** :
   - Mode plein écran indépendant avec en-tête complet et tous les panneaux latéraux.
2. **Mode Embarqué (`layoutMode="embedded"`)** :
   - S'insère dans un conteneur d'une application hôte (ex: carte dans un dashboard ERP) avec une bannière d'intégration discrète (`Connected to Host API`).
3. **Mode Compact (`layoutMode="compact"`)** :
   - Surface réduite, panneaux repliés, pour une édition rapide — typiquement au sein d'une fenêtre modale ouverte par le logiciel hôte.

> ⚠️ **À confirmer.** Le brouillon de ce document nommait ces modes
> `full` / `embedded` / `modal` sous une propriété `mode`. Le type exporté dit
> `layoutMode` avec `fullscreen` / `embedded` / `compact`, et c'est cette version
> qui fait foi ici. `compact` et `modal` ne décrivent toutefois pas la même
> chose : `compact` est une densité d'affichage, `modal` un mode de présentation
> qui relève plutôt de l'hôte. À trancher avant la première implémentation.

---

## 5. Mapping des Composants React (Shadcn/ui)

| Fonctionnalité Designer | Composant Shadcn/ui React 19 |
| :--- | :--- |
| **Onglets d'inspection & de palette** | `<Tabs />`, `<TabsList />`, `<TabsTrigger />`, `<TabsContent />` |
| **Sélecteurs de types de blocs & typographies** | `<Select />`, `<SelectTrigger />`, `<SelectItem />` |
| **Panneaux de propriétés repliables** | `<Accordion />`, `<AccordionItem />`, `<AccordionTrigger />` |
| **Modale de prévisualisation JSON & Export** | `<Dialog />`, `<DialogContent />`, `<DialogHeader />` |
| **Menus contextuels et actions d'exportation** | `<DropdownMenu />`, `<DropdownMenuItem />` |
| **Info-bulles des boutons de la barre d'outils** | `<Tooltip />`, `<TooltipProvider />`, `<TooltipContent />` |

---

## 6. Accessibilité & Typographie

- **Typographie Principale** : `Inter` pour tous les textes, boutons, menus et contrôles UI.
- **Typographie Technique** : `JetBrains Mono` pour l'arbre de variables JSON, les liaisons dynamiques et le code CSS.

### Notation des liaisons dynamiques

La forme `{{ invoice.total }}` est une **notation d'affichage**, destinée à
l'utilisateur — `invoice` y est un exemple, pas une convention. Ce n'est **pas** un
langage de gabarit et il n'y a rien à parser :
conformément à l'[ADR 0001](../../docs/adr/0001-expression-language.md), une
liaison est un objet `Expression` structuré, validé par Zod. Le Designer édite
cet objet directement et se contente de l'afficher sous cette forme lisible.

Cette distinction n'est pas cosmétique : implémenter réellement un moteur de
gabarit textuel (Mustache, Handlebars) rouvrirait la surface d'injection que
l'ADR ferme.
