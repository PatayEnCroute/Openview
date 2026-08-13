---
name: Openview Viewer System
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

# Openview Viewer - Charte Visuelle & Spécifications Design System

Ce document définit l'identité visuelle, l'expérience utilisateur (UX) et les spécifications de composants du composant **`@openview/viewer`**.

> **Sources de vérité en amont.** Le modèle de document est défini par
> [`@openview/core`](../core/src/ast/nodes.ts) et la représentation des liaisons
> dynamiques par l'[ADR 0001](../../docs/adr/0001-expression-language.md). En cas
> de divergence, le code et l'ADR l'emportent sur ce document.
>
> **Jetons partagés.** Le bloc de métadonnées en tête de ce fichier est identique
> à celui de [`@openview/designer`](../designer/DESIGN.md) : les deux paquets
> partagent une seule et même palette. Toute modification doit être reportée dans
> les deux fichiers tant qu'ils ne sont pas alimentés par une source unique
> (voir la note de fin).

---

## 1. Philosophie & Principes d'Interface (Shadcn/ui Aesthetics)

Openview Viewer est un composant front-end léger qui affiche le document produit par le moteur à partir d'un modèle et du jeu de données fourni par l'application hôte : lecture, navigation multi-pages, et modification interactive des variables.

### Principes Clés
1. **Focalisation sur le Document** :
   - Le composant est ultra-léger et sobre. L'attention est portée 100% sur le rendu du document A4.
2. **Contrôles de Navigation Rétractables / Flottants** :
   - Barre de pagination (Page X sur Y), zoom (In/Out/Fit) et impression/téléchargement PDF.
3. **Mode d'interaction avec les variables** :
   - Volet latéral ou modale permettant de saisir les valeurs des **champs déclarés par l'application hôte** pour voir le document se mettre à jour en temps réel.
   - Les libellés et les types affichés viennent du catalogue de l'intégrateur. Le viewer n'en connaît aucun par défaut : il rend un formulaire à partir de ce qu'on lui déclare, il n'impose aucune structure.

---

## 2. Palette de Couleurs (Harmonisée avec Designer)

| Élément | Couleur / Classe Tailwind | Valeur Hex |
| :--- | :--- | :--- |
| **Fond d'application / Viewer** | `bg-slate-50` / `dark:bg-slate-950` | `#F8FAFC` / `#020617` |
| **Barre d'outils de visualisation** | `bg-slate-100` / `dark:bg-slate-900` | `#F1F5F9` / `#0F172A` |
| **Bordures** | `border-slate-200` / `dark:border-slate-800` | `#E2E8F0` / `#1E293B` |
| **Couleur Primaire (Action & Focus)** | `bg-indigo-600` / `text-indigo-600` | `#4F46E5` |
| **Bouton d'Impression / Téléchargement** | `bg-sky-600` / `text-sky-600` | `#0EA5E9` |

---

## 3. Composants Shadcn/ui Utilisés dans le Viewer

- **Barre d'outils de navigation** : `<Button variant="ghost">`, `<Select>` (Zoom 50-200%).
- **Volet d'édition de variables** : `<Sheet>` (Volet coulissant à droite) ou `<Popover>`.
- **Alertes et notifications** : `<Toast>` (lors de l'exportation PDF réussie).

---

## 4. Dette connue de ce design system

Deux points à résoudre avant la première implémentation, notés ici pour ne pas
les redécouvrir plus tard :

1. **Les jetons sont dupliqués.** Le bloc de métadonnées est identique, ligne
   pour ligne, entre ce fichier et celui de `@openview/designer` — deux copies
   d'environ 85 lignes qui divergeront à la première retouche de palette. La
   cible est une source unique consommée par la configuration Tailwind des deux
   paquets. Ce n'est pas fait ici : le format de ce bloc semble alimenter un
   outillage externe, et le casser à l'aveugle serait pire que la duplication.

2. **Le mode sombre n'a pas de jetons.** Les tableaux de palette documentent des
   valeurs sombres (`#020617`, `#0F172A`, `#1E293B`) qui n'ont aucune
   contrepartie dans les métadonnées, lesquelles ne décrivent que le thème clair.
   Une implémentation qui se fierait aux seuls jetons produirait une interface
   sans mode sombre, alors que la charte en promet un.
