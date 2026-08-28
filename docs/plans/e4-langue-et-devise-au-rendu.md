# Plan d'implémentation — `@openview/engine` lot E4 : langue et devise au rendu

> **Document d'implémentation.** Il ferme le périmètre, les décisions, les représentations,
> les sondes, les tests, les risques et l'ordre d'exécution d'E4. Après livraison, une ADR
> d'exécution prendra le relais et ce plan sera marqué périmé.
>
> **Statut : ⛔ PÉRIMÉ.** Le lot est livré le 2026-08-27 ; l'
> [ADR 0017](../adr/0017-langue-et-devise-au-rendu.md) fait foi, y compris sur les écarts à ce
> plan (§ « Ce que l'exécution a corrigé du plan »). Ce document est conservé pour l'historique du
> raisonnement et **ne doit plus être suivi** : sa baseline, sa forme de `MarkerReserve` et son
> ordonnancement ont tous été corrigés à l'exécution.
>
> **Baseline relevée le 2026-08-27 :** `HEAD=686f735`, branche
> `feat/c11-grille-colonnes-et-calques`, schéma stocké en version **10**. Une modification locale
> préexistante de `apps/playground/src/App.tsx` est hors périmètre et doit être préservée.
> `pnpm run lint`, `pnpm run build` et `pnpm run type-check` passent. La baseline
> `pnpm run test:coverage` n'est pas verte : `reference-document.test.ts` a annoncé **31 échecs
> sur 37** après 434 913 ms, puis la commande est restée bloquée et a été interrompue. Ce défaut
> doit être reproduit et qualifié avant le premier changement E4 ; il n'est pas imputé au lot.
>
> **Briques principales :** `@openview/core`, `@openview/engine`,
> `@openview/adapter-puppeteer`, playground · **Dépend de :** E3 · **Poids roadmap :** M ·
> **Prévision révisée :** L si les sondes de réserve passent, davantage sinon · **Jalon :** J3,
> après une vraie revue métier.

---

## 0. Résultat attendu

Un **même modèle** de facture de soixante lignes est rendu au moins deux fois :

1. libellés français et valeurs en français/euros ;
2. libellés anglais et valeurs en anglais/dollars.

Les deux sorties sont des PDF valides de quatre pages, avec les mêmes règles de pagination E3 :
en-têtes répétés, reports entrants, blocs insécables, veuves/orphelines et mentions finales. Les
montants, quantités, prix unitaires, dates, numéros de page et reports sont écrits aux seuls sites
que le modèle a désignés. Les numéros de commande, références, SKU et autres identifiants restent
du texte brut, même s'ils ne contiennent que des chiffres.

Le lot démontre également que :

- une écriture inconnue ou inutilisable fait **échouer** le rendu, jamais imprimer un blanc ;
- une valeur de mauvais type à un site formaté fait échouer le rendu sans exposer sa valeur ;
- chaque écriture effectivement employée est résolue au plus une fois par rendu ;
- l'arrondi déclaré est appliqué avant le formatage ;
- les espaces insécables et symboles produits par ICU traversent l'HTML et le PDF sans
  normalisation ;
- la largeur réservée aux marqueurs localisés est calculée avant toute coupe et ne dépend pas de
  la page finalement choisie ;
- langue des mots et écriture des valeurs restent deux commutateurs indépendants.

Openview ne reconnaît toujours ni facture, ni montant, ni langue de document. Le modèle désigne les
sites et leurs catégories d'écriture ; l'appelant choisit les écritures déclarées ; le moteur
applique ce choix sans lire la machine.

---

## 1. État du dépôt et écarts à combler

### 1.1 Ce que C6 et E3 livrent déjà

| Besoin E4 | Baseline disponible | Règle de réemploi |
| :--- | :--- | :--- |
| Déclarer les écritures | `Template.presentations` | aucune table parallèle dans `engine` |
| Valider une écriture | `resolvePresentation(table, name)` et résultat discriminé | seule la branche `ok: true` peut alimenter un formateur |
| Écrire les valeurs | `formatMoney`, `formatDecimal`, `formatDate` | ne pas recopier `Intl`, ne pas bâtir une `Presentation` |
| Arrondir exactement | `roundDecimal` | report : arrondir puis formater |
| Dates civiles | chaîne `YYYY-MM-DD`, calendrier grégorien, UTC | aucun objet `Date` dans `engine` |
| Liaison des valeurs | `materializeDocument()` et `printableText()` | le formatage suit l'évaluation et précède la mesure |
| Champs de page | `number`, `count`, `report` survivent à la liaison | conserver leur valeur inconnue jusqu'à la composition |
| Report entrant | cumul brut et arrondi porté par chaque marqueur | ne pas formater la contribution ni le cumul en amont |
| Réserve de marqueur | sonde de glyphes et largeur fixe avant pagination | remplacer la borne canonique, pas ajouter une boucle de point fixe |
| Refus sûrs | `DocumentRenderError` et détails journalisables | aucun nom d'écriture, profil ou valeur liée dans les messages |
| Recette | facture de 60 lignes, 4 pages, PDF Puppeteer | enrichir une seule référence, pas créer un moteur de facture |

### 1.2 Les six écarts réels

**Aucun site n'est stocké.** `TextBindingSegment` ne dit pas si sa valeur est une date, un montant,
un nombre ou un identifiant. Les trois fonctions C6 existent, mais les appliquer globalement
changerait `20260014` en un autre numéro de commande.

**La sélection n'atteint pas le moteur.** `RenderRequest` porte délibérément deux champs,
`template` et `data`. `RenderEngineOptions` ne porte aujourd'hui que les limites. Lire une locale
système ou réserver une clé de `data` est interdit.

**Un rendu peut utiliser plusieurs écritures.** Une écriture monétaire à deux décimales ne suffit
pas pour une quantité à trois décimales et un prix unitaire à quatre. Une sélection globale unique
contredirait E4-3.

**Le report est encore écrit canoniquement.** `markerText()` arrondit correctement puis appelle
`String`. Les compteurs et reports localisés ont besoin de la même session de présentation que les
liaisons, sans déplacer leur résolution après la pagination.

**La réserve E3 est invalidée par la localisation.** Elle ne mesure que
`0123456789-+.e`, ignore les séparateurs, espaces, symboles et signes bidirectionnels, et borne le
report canonique à 25 caractères. `Intl.NumberFormat` en notation standard peut écrire bien plus
de caractères.

**C10 décrit encore tout binding comme `printable`.** Un binding déclaré `date` doit exiger une
date civile et un binding `money` ou `decimal` un nombre. Sans cette reprise, la recette du
catalogue accepte un câblage que le rendu refusera ensuite.

### 1.3 La contradiction héritée du croquis C6

C6 a différé un croquis `format?: string`. Pris comme « nom direct dans `presentations` », il ne
peut pas satisfaire simultanément :

- E4-1 : le site décide quelle fonction appeler ;
- E4-3 : plusieurs écritures dans un rendu ;
- E4-4 : le choix vient d'un argument de l'appelant ;
- le critère de recette : le **même site stocké** bascule de FR/EUR à EN/USD.

Un nom direct fige le site sur une écriture et oblige à modifier le modèle pour changer de langue.
E4 doit donc amender ce croquis avant d'ouvrir la forme stockée. La recommandation de ce plan est
un site `{ kind, profile }` et une sélection `profile → clé de présentation` fournie par l'appelant.
Cet arbitrage est la porte d'entrée `INC-0` ; aucun schéma n'est modifié avant sa validation produit.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E4

- une déclaration de format optionnelle sur les bindings et champs de page ;
- trois catégories fermées : `money`, `decimal`, `date` ;
- un nom de profil arbitraire, détenu par l'auteur du modèle ;
- une sélection explicite de profils vers des clés de `Template.presentations` ;
- une estampille de schéma et sa migration seule ;
- la revalidation C10 des bindings formatés ;
- une session de présentation locale au rendu et son cache ;
- la politique de refus « échec, jamais blanc » ;
- l'écriture localisée des bindings, compteurs et reports ;
- l'ordre arrondi puis formatage pour le report ;
- une réserve géométrique sûre pour les marqueurs localisés ;
- la préservation exacte des espaces et symboles ICU ;
- une facture de référence bilingue à quatre combinaisons visibles ;
- deux PDF diagonaux, des tests sans navigateur, des sondes Chromium, une recette visuelle et une
  revue métier ;
- les ablations qui prouvent que les garanties ne sont pas seulement couvertes, mais sensibles.

### 2.2 Exclus, avec leur propriétaire

| Exclu d'E4 | Motif | Propriétaire |
| :--- | :--- | :--- |
| Déduire un format d'un chemin, d'un id ou d'une valeur | réserverait une convention métier | jamais le moteur |
| Kind d'expression `format` | élargissement irréversible déjà refusé par C6 | aucun lot sans nouvel arbitrage |
| Pourcentages, unités, notation scientifique, spell-out | aucun contrat C6 ne les décrit | futur besoin versionné |
| Conversion de devise | change la valeur et exige taux/date/source | intégrateur |
| Traduction automatique des libellés | les mots viennent du modèle et de ses données | intégrateur / Designer |
| Couplage langue des mots ↔ écriture des valeurs | interdirait des combinaisons légitimes | Designer : avertissement éventuel |
| Système de chiffres déclarable | C6 l'épingle à `latn` | futur lot avec estampille |
| Calendrier déclarable ou autre fuseau | changerait le datum civil | hors périmètre définitif |
| Égalité ICU viewer/moteur | nécessite l'aperçu et son environnement | E5 / lots viewer, E4-9 |
| Identité multi-machine des chaînes/PDF | E4 promet le même build ; E6 traite l'environnement complet | E6 |
| Corpus PDF figé | un test d'or ICU est explicitement interdit ici | E7 |
| Limites hostiles et concurrence | autre classe de risque | E8 |
| Nouvelle Strategy, nouveau Port ou dépendance | une seule implémentation réelle suffit | interdit par anti-sur-ingénierie |

### 2.3 Définition d'un « site correctement choisi »

Un site est un segment stocké qui porte explicitement :

- la **fonction** (`money`, `decimal` ou `date`) ;
- un **profil logique** arbitraire (`amount`, `quantity`, `unitPrice`, ou tout autre nom choisi par
  l'auteur).

L'appelant fournit, hors données, la clé de présentation associée à chaque profil pour cette
configuration de port. Le moteur ne déduit rien. Un segment sans format garde exactement le
comportement canonique E1/E3.

---

## 3. Décisions d'architecture

### D1 — Le site stocke `{ kind, profile }`, pas une clé d'écriture directe

Contrat recommandé :

```ts
export const PRESENTATION_FORMAT_KINDS = ['money', 'decimal', 'date'] as const;

export type PresentationFormatKind = (typeof PRESENTATION_FORMAT_KINDS)[number];

export interface PresentationFormat {
  readonly kind: PresentationFormatKind;
  readonly profile: string;
}

export interface NumericPresentationFormat {
  readonly kind: 'money' | 'decimal';
  readonly profile: string;
}

export interface DecimalPresentationFormat {
  readonly kind: 'decimal';
  readonly profile: string;
}
```

Application aux segments :

```ts
export interface TextBindingSegment {
  readonly kind: 'binding';
  readonly value: PrintableExpression;
  readonly format?: PresentationFormat | undefined;
  readonly typography?: Typography | undefined;
}

export interface TextPageCountSegment {
  readonly kind: 'pageField';
  readonly field: 'number' | 'count';
  readonly format?: DecimalPresentationFormat | undefined;
  readonly typography?: Typography | undefined;
}

export interface TextPageReportSegment {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  readonly format?: NumericPresentationFormat | undefined;
  readonly typography?: Typography | undefined;
}
```

Un compteur n'est jamais une date ni une monnaie. Un report peut être décimal ou monétaire. Un
binding peut employer les trois fonctions. Le profil est une chaîne non vide, sans nom réservé et
sans valeur par défaut.

### D2 — L'appelant sélectionne les écritures dans `RenderEngineOptions`

```ts
export interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
  readonly presentationSelection?: Readonly<Record<string, string>> | undefined;
}
```

Exemple, pour un même modèle :

```ts
const french = createPdfRenderPort(strategy, {
  presentationSelection: {
    amount: 'fr-eur-2',
    quantity: 'fr-decimal-3',
    unitPrice: 'fr-eur-4',
  },
});

const english = createPdfRenderPort(strategy, {
  presentationSelection: {
    amount: 'en-usd-2',
    quantity: 'en-decimal-3',
    unitPrice: 'en-usd-4',
  },
});
```

Le choix est un argument de construction du port, réutilisable pour plusieurs rendus. Il n'ajoute
aucun champ à `RenderRequest`, ne lit aucune clé de `data` et ne crée aucun contexte ambiant.
`Object.hasOwn()` protège la lecture des deux tables : sélection et présentations. Une clé nommée
`constructor` reste licite si elle est réellement déclarée.

### D3 — Les alternatives sont explicitement rejetées

| Alternative | Défaut décisif |
| :--- | :--- |
| `format?: string` = clé directe | le même site ne bascule pas sans modifier le modèle |
| une écriture globale par rendu | ne couvre pas montant, quantité et prix unitaire à précisions différentes |
| `{ kind, writing }` + alias global implicite | deux orthographes du même concept, et le choix reste ambigu |
| troisième champ de `RenderRequest` | contredit ADR 0008 et le contrat du port |
| clé réservée dans `data` | viole la propriété des noms de l'intégrateur |
| callback de sélection | abstraction et surface d'exécution inutiles pour une table finie |
| format dérivé du type de donnée | confond type technique et intention de présentation |
| kind d'expression `format` | union stockée irréversible déjà refusée |

### D4 — La sélection est paresseuse, mais sa session dure tout le rendu

Une `PresentationSession` interne reçoit :

- `template.presentations` ;
- `options.presentationSelection` ;
- un `Map<string, PresentationResolution>` indexé par **clé réelle d'écriture**.

Un site est résolu seulement s'il est matérialisé. Une condition fausse, une boucle vide ou une
bande jamais atteinte ne peut donc pas refuser le rendu. Deux profils qui sélectionnent la même
écriture partagent une seule résolution. `extendBands()` réemploie la session créée au premier
passage : une écriture présente dans le flux puis dans une bande tardive n'est pas résolue deux
fois.

La session n'est ni globale, ni exportée, ni conservée après `render()`. Elle peut vivre sur
`MaterializedDocument`, à côté du budget et du générateur de clés, pour rendre sa durée de vie
explicite.

### D5 — Seule la branche `ok: true` atteint les formateurs

La session appelle exclusivement :

```ts
resolvePresentation(template.presentations, selectedWriting)
```

Elle ne construit jamais un objet compatible avec `Presentation`. Le `switch` sur les trois
`PresentationRefusal` se termine par un `const exhaustive: never`. Les tests espions et l'ablation
E4-10 prouvent que chaque formateur reçoit la référence renvoyée par le résolveur.

La cache porte sur la résolution, pas sur la chaîne formatée : deux valeurs égales peuvent être
formatées deux fois, mais la même écriture n'est jamais reparsée ni ré-honorée.

### D6 — E4-8 est fermé : toute absence ou faute fait échouer le rendu

La politique est **échec, jamais blanc**. Elle prolonge la décision déjà prise par E1 pour un
binding visible manquant : un vide dans une position imprimée est plus dangereux qu'un refus.

Deux codes rejoignent le catalogue fermé d'`engine` :

```ts
'presentation-refused'
'unformattable-binding-value'
```

`presentation-refused` couvre : profil non sélectionné, clé absente de la table, écriture invalide,
locale non honorée et écriture incompatible avec le report déclaré. Quand le résolveur a rendu une
cause, `details.presentationRefusal` porte le littéral fermé correspondant. Un profil absent n'a
pas de fausse cause core.

`unformattable-binding-value` couvre : nombre requis mais type différent, nombre non fini, date
civile invalide et `undefined` rendu par un formateur. `details.actualType` et
`details.formatKind` peuvent être joints ; ni la valeur, ni le profil, ni la clé d'écriture ne le
sont.

Les messages restent constants par site. Les diagnostics core sont joints lorsqu'ils existent,
sans aplatir la cause dans le message.

### D7 — Un binding est évalué avant d'être formaté

Ordre exact :

```text
expression du modèle → valeur évaluée → garde de type → formateur C6 → texte matérialisé
```

- sans `format`, `printableText()` reste inchangé ;
- `money` et `decimal` exigent un nombre fini ;
- `date` exige une chaîne civile valide ;
- aucun nombre n'est converti depuis une chaîne ;
- aucune date n'est construite depuis un instant ou un objet `Date` ;
- aucun format n'est choisi depuis `valueTypeOf()`.

Le moteur ne rajoute aucun arrondi métier sur un binding. Si la valeur doit être arrondie avant
affichage, le modèle porte déjà une expression `round`. Le maximum de fraction de l'écriture reste
une règle de présentation déclarée, jamais une règle de calcul inventée par E4.

### D8 — Le report est arrondi puis formaté, sans seconde politique d'arrondi

Pour un marqueur report :

```text
report brut → roundDecimal(report, decimals, mode) → formatMoney/formatDecimal
```

`Intl` ne reçoit jamais `roundingMode`. La sonde minimale est `2.5`, zéro décimale,
`halfEven` : la valeur transmise au formateur doit être `2`, pas `2.5` ; formater d'abord aurait
appliqué le défaut `halfExpand` et produit `3`.

Pour empêcher le formateur de réarrondir ensuite à une échelle plus grossière, l'écriture choisie
pour un report doit vérifier :

```text
maxFractionDigits === max(decimals, 0)
```

Les décimales négatives produisent donc une écriture sans fraction. `minFractionDigits` reste une
décision de remplissage de zéros de l'auteur et doit seulement respecter le contrat C6. Une
incompatibilité est un `presentation-refused`, jamais une correction silencieuse.

### D9 — Les champs de page portent leur présentation jusqu'à la composition

`MaterialPageCountRun` conserve éventuellement une écriture décimale résolue.
`MaterialPageReportRun` conserve éventuellement une écriture monétaire ou décimale résolue, en
plus de `decimals` et `mode`. Un champ sans format conserve la sortie canonique E3.

La valeur de page n'est jamais calculée à la matérialisation. Seuls le kind et la `Presentation`
déjà résolue traversent le paginateur ; `markerText()` applique le formateur quand `PageValues`
existe.

### D10 — La réserve localisée est calculée avant toute coupe

E4 remplace la paire « alphabet canonique + 25 caractères » pour tout marqueur formaté. Il ne
cherche pas un point fixe pagination ↔ valeur ↔ largeur.

Pour chaque marqueur, une **enveloppe de chaînes** est construite avec le même formateur que le
rendu :

- `number` et `count` : zéro, la borne `progressionBound(document)`, les signes pertinents et des
  échantillons de chiffres/séparateurs jusqu'au nombre maximal de chiffres ;
- `report` : zéro, les deux signes de la borne de magnitude et les formes fractionnaires extrêmes
  permises par l'écriture ;
- monnaie : mêmes cas avec symbole et espaces effectivement rendus par ICU.

La magnitude sûre d'un report est la somme saturée des valeurs absolues de toutes les
contributions matérialisées. Toute somme d'un sous-ensemble déjà achevé est bornée par elle, y
compris en présence d'annulations. La saturation à `Number.MAX_VALUE` reste sûre ; elle peut rendre
une réserve immense et provoquer un refus explicite sur un document pathologique, jamais un
rognage.

Les signatures de réserve incluent typographie **et** identité de format/écriture. Deux marqueurs
de même fonte mais de devises différentes ne partagent pas aveuglément une borne.

### D11 — La sonde mesure l'enveloppe réelle, pas un alphabet imaginé

La voie recommandée est de mesurer les chaînes complètes de l'enveloppe. Elle capture kerning,
ligatures, espaces étroits, signes et symbole monétaire, et évite de prétendre que
`largeur_du_glyphe_le_plus_large × caractères` est exact pour une fonte proportionnelle.

Si le nombre de chaînes rend la sonde trop coûteuse, la voie de repli est une borne par glyphes
avec `font-kerning: none` et `font-variant-ligatures: none` sur **les marqueurs et la sonde**. Cette
voie n'est admise qu'après une sonde Chromium prouvant qu'elle ne change pas la hauteur de ligne ni
le PDF de référence.

La largeur finale est le maximum mesuré, avec le même arrondi CSS que les autres réserves. Le
`clippedMarkerCount` de la mesure finale reste la barrière : toute valeur non nulle donne
`layout-measurement-failed`. `overflow: hidden` ne transforme jamais un rognage en succès.

### D12 — Les espaces ICU traversent sans normalisation

Le moteur sérialise exactement la chaîne rendue par core. Il ne remplace ni U+202F, ni U+00A0, ni
un signe bidirectionnel. Les tests ne figent pas une chaîne monétaire complète entre versions ICU :
ils comparent la sortie d'intégration à la sortie du formateur core du même build, puis vérifient
la présence et l'ordre des catégories `formatToParts`/points de code importants.

La recette française vérifie notamment le séparateur de groupement étroit et l'espace insécable
avant `€` sur les builds CI actuels. Le PDF est inspecté visuellement pour confirmer qu'aucun retour
à la ligne ne sépare nombre et symbole.

### D13 — Une devise inconnue mais bien formée n'a pas de table de secours

Une présentation déclarant `currency: 'ZZZ'` passe par `resolvePresentation`, puis
`formatMoney`. La sortie contient `ZZZ`. Le moteur n'a aucune liste ISO, aucun fallback vers EUR ou
USD et aucun refus spécifique. L'ablation qui remplace `ZZZ` par une devise connue doit être tuée.

### D14 — C10 déduit l'attente depuis le site, jamais depuis le chemin

Dans la collecte de compatibilité du catalogue :

| Site binding | Attente catalogue |
| :--- | :--- |
| sans `format` | `printable` |
| `money` | `number` |
| `decimal` | `number` |
| `date` | `civil-date` |

Les tables d'acceptation existantes restent inchangées : il n'existe pas de datatype `money`.
Les page fields ne lisent aucune donnée et n'ajoutent donc aucune attente catalogue. Le profil de
présentation ne rejoint jamais `collectDataPaths()`.

### D15 — La forme stockée prend une seule estampille, 10 → 11 sur la baseline

Les trois champs `format?` sont optionnels ; un build v10 les dépouillerait en silence. Si la
baseline n'a pas changé au début de l'exécution :

- `CURRENT_SCHEMA_VERSION` passe de 10 à 11 ;
- `TEMPLATE_MIGRATIONS` gagne une entrée 10→11 d'estampille seule ;
- une fixture historique v11 porte au moins un binding formaté et un report formaté ;
- un document v10 migre sans ajout de format et garde sa sortie canonique ;
- un build v10 devant un document v11 refuse par version au lieu de perdre les sites.

Le numéro 11 n'est pas réservé par ce plan. L'incrément emploie la prochaine version disponible au
jour de l'exécution. Types, schémas, migration, fixture et tests de compatibilité entrent dans le
même commit.

### D16 — Les deux commutateurs restent indépendants et visibles

Les mots basculent par une expression `if` lisant un chemin **choisi par la fixture intégratrice**.
Les valeurs basculent par `presentationSelection`. Le playground montre quatre combinaisons :

| Mots | Valeurs | Statut |
| :--- | :--- | :--- |
| FR | FR/EUR | recette diagonale |
| FR | EN/USD | valide, indépendance visible |
| EN | FR/EUR | valide, indépendance visible |
| EN | EN/USD | recette diagonale |

Les combinaisons croisées sont étiquetées « indépendantes par conception ; cohérence à la charge
de l'intégrateur ». E4 n'ajoute aucune table langue ↔ devise.

### D17 — `RenderRequest` et les frontières de paquets restent intacts

`RenderRequest` garde exactement `{ template, data }`. `core` n'importe aucun frère. `engine`
importe les contrats et formateurs de `core`, jamais React ni Puppeteer. L'adaptateur reçoit encore
un HTML fermé, une feuille et des images ; il ne connaît ni présentations, ni profils, ni données.

Le lot n'ajoute aucune dépendance et ne modifie aucun fichier protégé de configuration.

### D18 — E4-9 reste une dette explicite de J4

E4 peut vérifier le PDF avec l'ICU du processus qui construit l'HTML. Il ne peut pas garantir que
le futur viewer emploie le même ICU, car aucun aperçu public n'existe encore. L'ADR d'exécution
recopie E4-9 comme dette E5/viewer ; elle ne déclare pas l'aperçu identique livré.

---

## 4. Représentation interne et flux

### 4.1 Session de présentation

Fichier proposé : `packages/engine/src/document/presentation.ts`.

Responsabilités unitaires :

1. lire le profil avec `Object.hasOwn()` ;
2. lire la clé réelle dans `presentations` uniquement via `resolvePresentation` ;
3. mettre en cache le résultat par clé réelle ;
4. transformer chaque cause en refus moteur sûr ;
5. vérifier la compatibilité report/échelle ;
6. appeler la fonction correspondant au kind avec une garde de type fermée.

Le module ne connaît ni AST complet, ni HTML, ni pagination. `materialize.ts` lui donne le site,
la valeur et les détails sûrs ; `markers.ts`/`build.ts` lui donnent les nombres de page et de
report.

### 4.2 Flux complet d'un rendu

```text
createPdfRenderPort(strategy, options)
  → parse/validate Template v11
  → create PresentationSession(template.presentations, selection)
  → materialize reachable bands + root
      → evaluate binding
      → resolve profile lazily (cached by writing key)
      → guard type and format
  → reserve localized markers from formatted envelopes
  → natural measurement
  → optional extendBands with the SAME session
  → reserve and measure widened document
  → paginate
  → round report then format page fields
  → measure final pages and reject clipping
  → print PDF
  → await session.close()
```

### 4.3 Données portées par les runs

La représentation interne peut rester minimale :

- binding formaté : devient immédiatement `MaterialTextRun` ;
- page count formaté : garde `DecimalPresentationFormat` résolu ;
- page report formaté : garde `NumericPresentationFormat` résolu ;
- aucun run ne garde profil ou clé si la `Presentation` résolue suffit ;
- la signature de réserve reçoit une identité opaque et locale au rendu pour distinguer les
  écritures sans journaliser leur nom.

Deux runs sélectionnant la même écriture doivent tenir la **même référence** `Presentation` dans
les tests internes. Ce test rend observable la garantie « résolution unique » sans exporter la
session.

---

## 5. Fichiers visés

### 5.1 `@openview/core`

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/core/src/ast/types.ts` | types de format et champs optionnels sur les trois segments |
| `packages/core/src/ast/schemas.ts` | schémas Zod-first, profils non vides, unions fermées |
| `packages/core/src/ast/__tests__/nodes.test.ts` | clés type/schéma et bindings formatés |
| `packages/core/src/ast/__tests__/page-report.test.ts` | matrice count/report et formats interdits |
| `packages/core/src/data-catalogue/compatibility.ts` | attentes `number` / `civil-date` selon le kind |
| `packages/core/src/data-catalogue/__tests__/compatibility.test.ts` | quatre branches de compatibilité |
| `packages/core/src/template/template.ts` | version courante suivante |
| `packages/core/src/template/migrate.ts` | marche d'estampille seule |
| `packages/core/src/template/__tests__/compatibility-fixtures.ts` | fixture actuelle avec sites formatés |
| `packages/core/src/template/__tests__/compatibility.test.ts` | perte silencieuse, chaîne et refus newer |
| `packages/core/src/index.ts` | exports publics strictement nécessaires |

`visitor.ts` conserve ses kinds : le format est une propriété de segment, pas un nouveau segment.
Ses tests doivent néanmoins prouver que les chemins d'expression restent collectés et que les
profils ne deviennent pas des chemins de données.

### 5.2 `@openview/engine`

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/engine/src/strategy/pdf.ts` | sélection de profils dans `RenderEngineOptions` |
| `packages/engine/src/document/presentation.ts` | session, cache, résolution, formatage et refus |
| `packages/engine/src/document/materialize.ts` | session partagée, bindings et page fields |
| `packages/engine/src/document/types.ts` | présentation résolue portée par les marqueurs |
| `packages/engine/src/document/printable.ts` | conserver la voie canonique ; aides de garde si utiles |
| `packages/engine/src/errors.ts` | deux codes et détails fermés sûrs |
| `packages/engine/src/pagination/markers.ts` | signatures, enveloppes, borne de report et réserve |
| `packages/engine/src/pagination/reports.ts` | exposer/collecter la borne sans changer le cumul |
| `packages/engine/src/pagination/types.ts` | contrat de réserve adapté |
| `packages/engine/src/html/build-page.ts` | sonde des enveloppes localisées |
| `packages/engine/src/html/build.ts` | `markerText` arrondi puis formateur |
| `packages/engine/src/html/css.ts` | seulement si la sonde impose la voie sans kerning |
| `packages/engine/src/pipeline/render-pdf.ts` | création/session/cache et nouvelle réserve |
| `packages/engine/src/__tests__/*` | tests unitaires ciblés et intégration sans navigateur |

Créer `packages/engine/src/document/__tests__/presentation.test.ts` et, si les tests de réserve
grossissent, `packages/engine/src/pagination/__tests__/markers.test.ts`, conformément à la règle
locale `__tests__/`.

### 5.3 Adaptateur et playground

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/adapter-puppeteer/src/__tests__/reference-document.ts` | modèle unique, 6 écritures, sites explicites et libellés bilingues |
| `packages/adapter-puppeteer/src/__tests__/reference-document.test.ts` | deux PDF diagonaux, espaces, reports, pages et refus |
| `apps/playground/src/examples/reference-invoice.ts` | miroir lisible de la facture de référence |
| `apps/playground/src/examples/catalogue.ts` | variantes de mots et d'écriture sans nom réservé moteur |
| `apps/playground/src/rendering/client.ts` | identifiant de variante de démonstration |
| `apps/playground/src/rendering/RenderDownloadPanel.tsx` | deux sélecteurs indépendants et quatre combinaisons |
| `apps/playground/dev/render-bridge.ts` | table blanche variante → options de port |

`apps/playground/src/App.tsx` n'est modifié que si l'exécution en a un besoin direct, et seulement
après réconciliation avec la modification utilisateur déjà présente. Le plan ne l'autorise pas à
écraser ce travail.

### 5.4 Documentation d'exécution

- créer l'ADR suivante disponible, sans réserver aveuglément `0017` ;
- amender ADR 0008 sur le croquis de site, la version réelle, E4-8 et l'échelle des reports ;
- fermer la question 2 d'ADR 0001 par « échec, jamais blanc » ;
- consigner la reprise C10 issue d'ADR 0015 ;
- marquer E4 livré dans `docs/roadmap/engine.md` seulement après les portes techniques ;
- ne marquer J3 atteint qu'après compte rendu de la revue métier ;
- marquer ce plan périmé et pointer vers l'ADR finale.

---

## 6. Sondes bloquantes avant production

### P1 — Le contrat de sélection couvre la matrice réelle

Prototype minimal avec trois profils et six écritures. Prouver :

- FR et EN changent les trois écritures sans modifier le template ;
- deux profils peuvent viser la même clé ;
- une clé héritée (`constructor`) n'est pas lue sans `Object.hasOwn()` ;
- une clé propre du même nom reste utilisable ;
- aucune sélection n'est exigée si aucun site exécuté n'est formaté.

**Sortie :** arbitrage produit signé sur D1/D2, ou retour au plan avant toute estampille.

### P2 — `halfEven` précède réellement ICU

Sur un report `2.5`, `decimals: 0`, `mode: 'halfEven'`, espionner l'argument du formateur : `2`.
La mutation « formater `2.5` directement » doit produire `3` et faire échouer le test.

### P3 — Les deux builds CI préservent la structure des espaces

Sur Node 24 et 26 :

- résoudre `fr-FR` / EUR ;
- obtenir les `formatToParts` et points de code de `1234.5` ;
- faire traverser cette chaîne au sérialiseur engine ;
- vérifier qu'aucun point de code n'est changé ;
- ne jamais comparer un fichier PDF binaire ou une chaîne entière comme golden inter-version.

### P4 — La mesure de chaînes entières borne mieux que la mesure de glyphes

Dans Chromium, comparer sur les polices de la recette :

- largeur de chaque enveloppe complète ;
- somme des largeurs isolées ;
- ancien `widest × count` ;
- effet de kerning/ligatures désactivés.

**Décision :** retenir la mesure de chaînes si son nombre de boîtes et sa durée restent acceptables.
La voie glyphes n'entre en production qu'avec la preuve CSS décrite en D11.

### P5 — La somme des absolus borne les reports possibles

Construire des contributions positives, négatives, imbriquées, fragmentées et annulées. Pour chaque
coupe produite par les fixtures sans navigateur, vérifier :

```text
abs(incomingReport) <= saturatedSumOfAbsoluteContributions
```

Inclure `Number.MAX_VALUE`, saturation et contribution non finie déjà refusée. Aucun changement de
l'ordre stable de sommation E3 n'est autorisé.

### P6 — La réserve ne change pas après les coupes

Sur 9→10 pages, devise longue `ZZZ`, séparateurs français, report négatif et fraction maximale :

- calculer la réserve une fois avant pagination ;
- paginer et composer ;
- vérifier `clippedMarkerCount === 0` ;
- comparer les coupures d'une même enveloppe lorsque seule la valeur finale du marqueur change.

### P7 — Une résolution reste unique à travers `extendBands`

Placer un profil dans le flux et le même dans une bande `exceptFirst`. Forcer le passage de
l'hypothèse une page à plusieurs pages. Espionner `resolvePresentation` : un appel pour la clé
réelle, et la même référence dans les runs.

### P8 — La facture reste présentable dans les deux diagonales

Rendre les deux PDF avec Puppeteer, les rasteriser ou les ouvrir pour inspection, puis vérifier :

- quatre pages ou recalibrage documenté si la localisation change la hauteur ;
- aucun montant rogné ;
- aucun symbole séparé du nombre ;
- report entrant cohérent sur pages 2 à 4 ;
- en-têtes, mentions et cadre final inchangés dans leur rôle ;
- dates, quantités et prix unitaires à leur écriture propre ;
- identifiants strictement inchangés.

---

## 7. Matrice de tests

### 7.1 `@openview/core`

| Contrat | Cas obligatoires |
| :--- | :--- |
| Schémas de site | kind valide/invalide, profil vide, clé inconnue supprimée/refusée selon contrat Zod |
| Binding | trois kinds acceptés, absence compatible, forme type = forme schéma |
| Count | `decimal` accepté ; `money` et `date` refusés |
| Report | `money`/`decimal` acceptés ; `date` refusé ; arrondi toujours requis |
| Migration | v10→v11 estampille seule, chaîne complète, document newer lisible |
| Perte silencieuse | build/schéma antérieur dépouille le champ sans estampille ; test explicatif conservé |
| Visiteur | expression visitée une fois ; profil absent de `collectDataPaths()` |
| Catalogue | printable, number money, number decimal, civil-date date |
| Compatibilité | number accepte number seulement ; civil-date accepte date seulement ; messages/chemins précis |
| Surface publique | exports remesurés, aucun prédicat interne exposé par commodité |

### 7.2 `@openview/engine` sans navigateur

| Contrat | Cas obligatoires |
| :--- | :--- |
| Sélection | absente, profil absent, clé absente, clé propre héritée, deux profils/une écriture |
| Résolveur | trois refus core, switch exhaustif, branche `ok` seule |
| Cache | une clé répétée 100 fois → une résolution ; trois clés → trois résolutions |
| Portée | condition fausse/boucle vide ne résout pas ; bande tardive réemploie la session |
| Money | nombre fini accepté ; chaîne/null/infini refusés sans valeur dans l'erreur |
| Decimal | mêmes gardes ; `-0` traité par core |
| Date | date civile minimale/maximale ; chaîne invalide et type non chaîne refusés |
| Canonique | segment sans format identique bit pour bit au comportement existant |
| Report | `halfEven`, `halfExpand`, décimales négatives, incompatibilité de max fraction |
| Count | page number/count localisés, 9→10 chiffres, absence de monnaie/date |
| Réserve | symboles, espaces, signe, devise `ZZZ`, trois précisions, saturation |
| Sécurité erreur | aucun bound value, HTML, profil, clé ou template dans message/details |
| Pipeline | `close()` attendu sur succès et tous les nouveaux refus |

### 7.3 Adaptateur Puppeteer

La fixture de référence déclare au moins six présentations :

| Profil | Français | Anglais | Sites |
| :--- | :--- | :--- | :--- |
| `amount` | EUR, 2 décimales | USD, 2 décimales | montants de ligne, sous-totaux, total, report |
| `quantity` | décimal, jusqu'à 3 | décimal, jusqu'à 3 | quantités, numéro et total de pages |
| `unitPrice` | EUR, jusqu'à 4 | USD, jusqu'à 4 | prix unitaires |

La date emploie le profil `amount` avec `kind: 'date'` : la même écriture porte aussi le
`dateStyle`, et sa devise n'intervient pas. Cette réutilisation contribue à prouver le cache par
clé réelle.

Sites à épingler explicitement :

- date d'émission et échéance : `date` ;
- quantité : `decimal/quantity` ;
- prix unitaire : `money/unitPrice` ;
- montant de ligne, totaux et report : `money/amount` ;
- page courante et nombre de pages : `decimal/quantity` ;
- numéro de commande, numéro de facture, SKU, références : **aucun format** ;
- taux/remises : décision écrite site par site dans la fixture, sans déduction du nom.

Assertions :

- les deux sorties commencent par `%PDF-` et ont quatre pages ;
- le HTML capturé contient les chaînes produites par les formateurs core du même build ;
- les reports des pages 2, 3 et 4 sont localisés après arrondi ;
- `20260014` et les SKU sont strictement présents sous leur forme source ;
- FR/EUR et EN/USD partent du même objet template ;
- au moins trois clés d'écriture distinctes sont employées par rendu ;
- aucun marqueur n'est rogné ;
- la variante `ZZZ` imprime `ZZZ` dans un test ciblé, hors facture principale.

### 7.4 Playground

Le pont de développement n'accepte pas une map arbitraire envoyée par le navigateur. Il accepte un
identifiant de variante connu, vérifié dans une table blanche locale, puis construit/réemploie le
port correspondant. Les deux sélecteurs UI sont :

1. langue des mots, qui change le jeu de données au chemin choisi par la démo ;
2. écriture des valeurs, qui choisit la configuration du port.

Les quatre combinaisons doivent être téléchargeables. Les croisées ne sont ni cachées ni refusées.

### 7.5 Ablations obligatoires

| Mutation volontaire | Test qui doit rougir |
| :--- | :--- |
| formater tous les nombres automatiquement | identifiant `20260014` |
| remplacer le profil par une clé directe | même template FR puis EN |
| résoudre à chaque valeur | compteur d'appels/cache |
| retirer `Object.hasOwn()` | clé héritée |
| construire une `Presentation` manuelle | identité de référence/résolveur |
| formater avant `roundDecimal` | cas `2.5 halfEven` |
| normaliser les espaces | points de code HTML |
| remplacer `ZZZ` par EUR | devise inconnue bien formée |
| garder la réserve canonique E3 | marqueur monétaire rogné |
| ignorer `clippedMarkerCount` | mesure finale ciblée |
| coupler langue et sélection | combinaisons croisées playground |
| laisser C10 sur `printable` | recette catalogue date/nombre |
| oublier l'estampille | compatibilité newer/perte silencieuse |

---

## 8. Ordre d'exécution

### INC-0 — Baseline, arbitrage et sondes

1. reproduire `reference-document.test.ts` seul avec diagnostic complet et temps borné ;
2. attribuer ou corriger la baseline avant de mélanger ses échecs à E4 ;
3. confirmer `CURRENT_SCHEMA_VERSION`, prochain numéro d'ADR et worktree ;
4. obtenir l'arbitrage produit D1/D2 sur `{ kind, profile }` et la sélection de port ;
5. exécuter P1 à P7 sur des branches/fixtures jetables ;
6. figer la stratégie de réserve retenue ;
7. rédiger le squelette de l'ADR d'exécution et le registre des écarts.

**Porte de sortie :** baseline qualifiée, contrat approuvé, sondes vertes, aucun fichier protégé à
modifier.

### INC-1 — Contrat core, migration et C10

1. ajouter types et schémas de format ;
2. étendre les trois segments sans nouveau kind ;
3. poser l'estampille et sa marche seule ;
4. compléter fixtures et tests de compatibilité ;
5. adapter la collecte C10 ;
6. remesurer les exports et chemins ;
7. passer les quatre portes.

**Commit atomique obligatoire :** forme stockée + schéma + migration + fixture + tests.

### INC-2 — Session de présentation et bindings

1. étendre `RenderEngineOptions` ;
2. écrire `PresentationSession` ;
3. ajouter les deux codes et détails sûrs ;
4. câbler le formatage des bindings ;
5. conserver la voie canonique sans format ;
6. prouver résolution unique, paresse, `Object.hasOwn()` et E4-10 ;
7. passer les quatre portes.

### INC-3 — Champs de page, report et réserve

1. porter les présentations résolues dans les runs ;
2. appliquer arrondi puis formatage ;
3. vérifier l'échelle report/écriture ;
4. calculer la borne de magnitude ;
5. remplacer la sonde/réserve canonique pour les marqueurs formatés ;
6. conserver la voie canonique des marqueurs non formatés ;
7. prouver absence de clipping et invariance avant coupe ;
8. passer les quatre portes.

### INC-4 — Facture de référence et intégration Puppeteer

1. enrichir le template de référence avec six écritures ;
2. désigner tous les sites, y compris les non-sites ;
3. rendre les libellés bilingues par expression du modèle ;
4. produire les deux diagonales ;
5. vérifier HTML, PDF, quatre pages, reports et identifiants ;
6. recalibrer seulement le contenu de fixture si la longueur localisée change la pagination ;
7. exécuter P8 et les tests ciblés avant la couverture globale.

### INC-5 — Playground et indépendance des commutateurs

1. exposer deux sélecteurs séparés ;
2. blanchir les variantes côté pont ;
3. rendre les quatre combinaisons ;
4. étiqueter les combinaisons croisées ;
5. préserver/réconcilier le travail utilisateur dans `App.tsx` ;
6. vérifier manuellement les téléchargements.

### INC-6 — Recette visuelle et métier

1. conserver les deux PDF de séance comme artefacts temporaires de revue, pas goldens CI ;
2. faire relire les quatre pages FR/EUR puis EN/USD par un gestionnaire ou comptable ;
3. consigner date, rôle du relecteur, anomalies et décision ;
4. corriger tout défaut de présentation générique dans E4 ;
5. renvoyer toute règle métier demandée à l'intégrateur, sans l'ajouter au moteur.

**Porte J3 :** aucune anomalie générique ouverte et compte rendu métier réel. Sans relecteur, E4
peut être techniquement livré mais J3 reste explicitement non atteint.

### INC-7 — Ablations, documentation et fermeture

1. exécuter chaque ablation du §7.5 ;
2. finaliser l'ADR avec les résultats mesurés et écarts au plan ;
3. amender ADR 0001/0008/0015 selon le mandat ;
4. mettre à jour la roadmap E4 et le statut J3 exact ;
5. marquer ce plan périmé ;
6. exécuter les quatre portes dans l'ordre exact ;
7. relire le diff pour secrets, commentaires français dans le code, assertions interdites,
   promesses flottantes et modifications de configuration.

---

## 9. Correspondance avec les onze attentes héritées

| Attente | Réponse du plan | Preuve de sortie |
| :--- | :--- | :--- |
| E4-1 sites | `{ kind, profile }` explicite | identifiants non formatés + matrice de fixture |
| E4-2 ordre | `roundDecimal` puis formateur | `2.5 halfEven` + report PDF |
| E4-3 résolution unique | cache par clé réelle, session de rendu | appel unique et réemploi `extendBands` |
| E4-4 argument | `RenderEngineOptions.presentationSelection` | aucun champ request/data, deux ports |
| E4-5 devise inconnue | aucun fallback | `ZZZ` imprimé |
| E4-6 espaces | aucune normalisation, réserve réelle | points de code + inspection PDF |
| E4-7 épingles | appel aux formateurs core sans options ICU | revue/imports + ablation |
| E4-8 politique | refus fatal, cause conservée | codes/détails/switch exhaustif |
| E4-9 même ICU | dette maintenue vers E5/viewer | ADR finale ne sur-promet pas J4 |
| E4-10 résolveur seul | zéro `Presentation` manuelle | identité de référence + revue |
| E4-11 deux commutateurs | sélecteurs indépendants | quatre combinaisons playground |

---

## 10. Risques, signaux et replis

| Risque | Signal précoce | Réponse prévue |
| :--- | :--- | :--- |
| Le produit refuse les profils | arbitrage INC-0 | revenir au contrat avant toute migration ; ne pas bricoler un alias |
| La mesure de chaînes coûte trop de boîtes | P4 dépasse le budget de la baseline | voie glyphes avec CSS prouvée, ou enveloppes réduites mais démontrées |
| Une réserve extrême rend la zone inutilisable | fixture hostile refuse tôt | refus explicite accepté ; aucun rognage ni point fixe |
| La localisation fait passer la facture à 5 pages | P8 | ajuster la fixture/typographie, jamais l'algorithme pour viser quatre |
| ICU 24/26 diffère | P3 | assertions structurelles/dynamiques, pas golden de chaîne |
| Un report est réarrondi par ICU | échelle incompatible | refus par D8 ; jamais corriger `decimals` silencieusement |
| Le cache fuit entre rendus | test deux renders avec tables différentes | session locale stricte, aucun module singleton |
| Une bande tardive résout deux fois | P7 | stocker/réutiliser la session dans `MaterializedDocument` |
| C10 rejette des données auparavant valides | bindings nouvellement formatés | attendu : le modèle a déclaré une exigence plus forte ; absence de format reste compatible |
| La baseline Puppeteer reste rouge | test ciblé INC-0 | traiter séparément ou documenter un blocage reproductible avant E4 |
| Le travail local `App.tsx` chevauche la vitrine | diff avant INC-5 | réconcilier, ne jamais restaurer/écraser |
| La revue métier demande taux ou mentions calculées | compte rendu INC-6 | renvoyer au modèle/intégrateur ; ne pas élargir E4 |

### Signaux de réouverture ultérieure

- une vraie facture arabe/persane demande un système de chiffres non latin ;
- deux intégrateurs externes demandent une sélection par rendu sur un port partagé ;
- un nouveau format réel apparaît (pourcentage, unité, scientifique) ;
- la réserve conservative refuse des documents réalistes malgré des reports toujours courts ;
- un consommateur externe de core rend insuffisante l'obligation documentaire E4-10.

Chacun exige un mandat distinct ; aucun n'est anticipé dans le contrat E4.

---

## 11. Définition de terminé

E4 est techniquement terminé si et seulement si :

- [ ] l'arbitrage `{ kind, profile }` / sélection est enregistré ;
- [ ] le schéma courant a une marche continue et la compatibilité historique reste verte ;
- [ ] un segment non formaté garde son rendu canonique ;
- [ ] tous les sites de la facture de référence sont explicitement classés ;
- [ ] aucun identifiant numérique n'est formaté ;
- [ ] trois écritures distinctes au moins sont résolues par rendu, chacune une seule fois ;
- [ ] les trois causes du résolveur restent distinguées et un profil absent échoue ;
- [ ] un formateur ne reçoit jamais une `Presentation` bâtie à la main ;
- [ ] le report `halfEven` est arrondi avant formatage ;
- [ ] `ZZZ` s'imprime sans fallback ;
- [ ] U+202F/U+00A0 et les autres caractères ICU ne sont pas normalisés ;
- [ ] `clippedMarkerCount` vaut zéro sur toute la matrice ;
- [ ] les deux PDF diagonaux sont valides, lisibles et à quatre pages ;
- [ ] les quatre combinaisons sont accessibles dans le playground ;
- [ ] E4-9 reste attribué à E5/viewer ;
- [ ] toutes les ablations rougissent ;
- [ ] aucune dépendance, configuration protégée, lecture d'environnement ou clé réservée n'est
  introduite ;
- [ ] `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` passe dans
  cet ordre ;
- [ ] l'ADR d'exécution fait foi et ce plan est marqué périmé.

J3 n'est atteint qu'avec, en plus :

- [ ] une séance métier effectivement tenue sur les deux PDF ;
- [ ] un compte rendu sans anomalie générique ouverte ;
- [ ] la roadmap ne prétend pas davantage que ce que cette revue démontre.

---

## 12. Contrôle avant démarrage

Au début de l'exécution, relire et noter dans l'ADR :

1. `git status --short --branch` et les changements utilisateur à préserver ;
2. `CURRENT_SCHEMA_VERSION` et la dernière migration ;
3. le prochain numéro d'ADR réellement libre ;
4. la baseline ciblée `reference-document.test.ts` ;
5. les versions Node/ICU des deux jobs CI sans modifier le workflow ;
6. l'arbitrage produit D1/D2 ;
7. le résultat des huit sondes ;
8. la stratégie de réserve retenue et sa preuve ;
9. les fichiers protégés, qui doivent rester hors diff ;
10. le créneau et le relecteur de la séance métier.

Ce contrôle est une porte : une estampille ne se pose pas pendant qu'un contrat de site reste en
discussion, et une recette E4 ne se déclare pas verte sur une baseline Puppeteer non qualifiée.
