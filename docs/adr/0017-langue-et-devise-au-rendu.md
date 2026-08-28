# ADR 0017 — Langue et devise au rendu

- **Statut :** 🟢 **Accepté** (2026-08-27), implémenté dans `@openview/core`, `@openview/engine`,
  `@openview/adapter-puppeteer`, avec une démonstration dans `apps/playground`
- **Date :** 2026-08-27
- **Impact :** `@openview/core` (une déclaration `format` optionnelle sur trois segments,
  estampille **11**, reprise de la collecte C10), `@openview/engine`
  (`RenderEngineOptions.presentationSelection`, une session de présentation locale au rendu, deux
  codes de refus, une réserve de marqueur mesurée sur des chaînes réelles),
  `@openview/adapter-puppeteer` (la facture de référence en deux écritures),
  `apps/playground` (deux sélecteurs indépendants). `@openview/designer` et `@openview/viewer`
  sortent du lot **inchangés**.
- **`RenderRequest` reste `{ template, data }`.** Le choix des écritures est un argument de
  construction du port, pas un troisième champ de requête et pas une clé réservée du jeu de
  données. `RenderPort`, `RenderRequest` et `RenderResult` ne bougent pas.
- **Le port de mesure ne bouge pas.** Aucun champ n'est ajouté à `PdfLayoutMeasurement` :
  `clippedMarkerCount`, livré par C11, est exactement la barrière dont E4 avait besoin.
- **Estampille 11, migration 10 → 11 par estampille seule.** Les trois champs `format` sont
  optionnels : un build v10 les dépouillerait en silence et un `onSave` persisterait la perte.
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, les workflows et les seuils de couverture sortent du lot **inchangés**.
  **Aucune dépendance n'est ajoutée.**
- **J3 n'est pas atteint.** Les deux PDF diagonaux existent et sont valides, mais **aucune
  relecture métier n'a eu lieu**. Le lot est techniquement livré ; le jalon reste ouvert.
- **Plan d'implémentation :**
  [docs/plans/e4-langue-et-devise-au-rendu.md](../plans/e4-langue-et-devise-au-rendu.md) —
  **périmé** depuis ce lot ; les écarts sont au
  [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`core/src/ast/types.ts`](../../packages/core/src/ast/types.ts) et
  [`schemas.ts`](../../packages/core/src/ast/schemas.ts) (`PresentationFormat` et les trois
  champs), [`core/src/ast/shape.ts`](../../packages/core/src/ast/shape.ts) (l'attente que le site
  impose), [`core/src/template/migrate.ts`](../../packages/core/src/template/migrate.ts)
  (10 → 11), [`engine/src/document/presentation.ts`](../../packages/engine/src/document/presentation.ts)
  (session, cache, gardes, refus),
  [`engine/src/document/materialize.ts`](../../packages/engine/src/document/materialize.ts)
  (le formatage suit l'évaluation),
  [`engine/src/pagination/markers.ts`](../../packages/engine/src/pagination/markers.ts) et
  [`reports.ts`](../../packages/engine/src/pagination/reports.ts) (enveloppes, borne de
  magnitude), [`engine/src/html/build.ts`](../../packages/engine/src/html/build.ts) (arrondi puis
  écriture),
  [`adapter-puppeteer/src/__tests__/reference-document.ts`](../../packages/adapter-puppeteer/src/__tests__/reference-document.ts)
  (un modèle, deux orthographes)

---

## Contexte

C6 avait livré le contrat de présentation — locale, devise, décimales, style de date, et trois
formateurs — sans aucun moyen de le relier à un endroit du document. Le croquis `format?: string`
qu'il avait différé prenait le nom d'une écriture directement dans le site, ce qui obligeait à
**modifier le modèle** pour changer de langue. E4 devait donc trancher la forme stockée avant
d'écrire une ligne de moteur.

Le lot ne pouvait pas non plus appliquer les formateurs globalement : `20260014` est un numéro de
commande, et une facture qui l'imprime `20 260 014` est fausse. Openview ne connaît ni montant, ni
identifiant, ni langue de document ; il fallait que le **modèle** désigne les sites et que
l'**appelant** choisisse les écritures.

## Décisions

### 1. Le site stocke `{ kind, profile }`

Un binding, un compteur de page et un report de page peuvent porter `format`. `kind` nomme lequel
des trois formateurs C6 écrit la position ; `profile` est un nom logique que l'auteur du modèle
possède — `amount`, `quantity`, ou n'importe quel autre. Un compteur n'accepte que `decimal`, un
report `money` ou `decimal` : la matrice est refusée par le schéma, pas au rendu.

Le profil n'est **jamais** une clé de `presentations`. C'est cette indirection qui fait qu'un même
site stocké bascule de FR/EUR à EN/USD sans être édité, et c'est le seul point où le croquis C6
est amendé.

### 2. L'appelant sélectionne les écritures à la construction du port

`RenderEngineOptions.presentationSelection` associe chaque profil à une clé de
`Template.presentations`. Un rendu dans une autre langue est un second port sur le même modèle.
Ni `RenderRequest`, ni `data` ne portent quoi que ce soit de nouveau — la propriété des noms du jeu
de données reste entière. Les deux tables sont lues avec `Object.hasOwn`, donc un profil nommé
`constructor` n'atteint rien tant qu'il n'est pas réellement déclaré, et une clé de ce nom
réellement déclarée reste utilisable.

### 3. Une session de présentation vit le temps d'un rendu

`createPresentationSession` est créée à côté du budget d'évaluation et vit sur
`MaterializedDocument`. Elle résout un profil à la **première** utilisation et met en cache par
**clé d'écriture réelle** : deux profils qui visent la même écriture partagent une résolution, et
`extendBands` réemploie la session du premier passage. Un site qu'aucune page n'atteint — condition
fausse, boucle vide, bande jamais peinte — ne résout rien, ce qui permet à un modèle stocké de
porter des sites qu'une configuration donnée n'imprime pas.

Aucune session ne survit à son rendu, et aucune n'est exportée.

### 4. Seule la branche `ok: true` du résolveur atteint un formateur

`resolvePresentation` est le seul chemin. Rien dans le moteur n'assemble un objet `Presentation`.
La session transporte `{ presentation, id }` — l'`id` est **opaque et local au rendu** : il sert à
distinguer deux écritures dans une signature de réserve sans qu'aucun nom choisi par l'appelant ne
puisse être relu depuis une signature ou un diagnostic.

### 5. Échec, jamais blanc

Deux codes rejoignent le catalogue fermé d'`engine` :

| Code | Couvre |
| :--- | :--- |
| `presentation-refused` | profil non sélectionné, clé absente, déclaration invalide, locale non honorée, échelle incompatible avec l'arrondi d'un report |
| `unformattable-binding-value` | nombre requis mais type différent, nombre non fini, date civile invalide, formateur sans sortie |

`details` ne porte que des littéraux fermés : `formatKind`, `presentationRefusal`, `actualType`,
`limit`. Ni le profil, ni la clé d'écriture, ni la valeur liée n'entrent dans un message. Un
profil non sélectionné ne reçoit **pas** de fausse cause core : le résolveur n'a pas été appelé,
donc `presentationRefusal` est absent.

### 6. Un report est arrondi puis écrit

`roundDecimal(report, decimals, mode)` d'abord, formateur ensuite. `Intl` ne reçoit jamais de
`roundingMode`. Pour empêcher le formateur de réarrondir, l'écriture choisie pour un report doit
vérifier `maxFractionDigits === max(decimals, 0)` ; une incompatibilité est un refus, jamais une
correction silencieuse. La sonde minimale est `2.5`, zéro décimale, `halfEven` : la valeur remise
au formateur est `2`, là où formater d'abord aurait produit `3`.

### 7. La réserve d'un marqueur écrit est mesurée sur des chaînes réelles

E4 remplace, **pour les marqueurs formatés seulement**, la paire « alphabet canonique × 25
caractères ». Pour chaque forme de marqueur, une enveloppe est construite **avec le formateur du
rendu** :

- compteur : zéro, la borne `progressionBound`, et une répétition de chaque chiffre à la longueur
  maximale — un chiffre répété est le nombre le plus large de sa longueur, et le groupement d'une
  locale ne dépend que de la longueur ;
- report : zéro, les deux signes de la borne de magnitude, et les formes fractionnaires extrêmes
  que l'écriture autorise, à **un chiffre entier de plus** que la magnitude, parce que l'arrondi
  qui s'éloigne de zéro reporte (999,99 arrondi à l'unité écrit les quatre chiffres de 1000).

La magnitude sûre d'un report est la **somme saturée des valeurs absolues** de toutes les
contributions matérialisées : la valeur absolue de n'importe quel sous-ensemble est bornée par
elle, quelles que soient les compensations. Saturer à `Number.MAX_VALUE` reste sûr — la borne ne
fait que croître, donc un document pathologique demande une réserve absurde et est refusé, jamais
rogné.

Un marqueur **sans** écriture garde exactement la voie canonique : chiffres les plus larges pour un
compteur, alphabet canonique × 25 pour un report.

### 8. Une devise inconnue mais bien formée n'a pas de table de secours

`currency: 'ZZZ'` traverse le résolveur puis `formatMoney` et imprime `ZZZ`. Le moteur n'a aucune
liste ISO, aucun repli vers EUR ou USD, aucun refus spécifique.

### 9. Les espaces d'ICU traversent sans normalisation

Le moteur sérialise exactement la chaîne rendue par core. Le séparateur de groupement étroit
(U+202F) et l'espace insécable avant le symbole (U+00A0) traversent l'HTML et le PDF intacts. Les
tests ne figent aucune chaîne monétaire entre versions d'ICU : ils comparent la sortie
d'intégration au formateur core **du même build**.

### 10. C10 déduit l'attente depuis le site

| Site binding | Attente catalogue |
| :--- | :--- |
| sans `format` | `printable` |
| `money`, `decimal` | `number` |
| `date` | `civil-date` |

Un profil ne rejoint jamais `collectDataPaths()` : un intégrateur ne se voit jamais demander de
déclarer un champ nommé `amount`. Les champs de page ne lisent aucune donnée et n'ajoutent aucune
attente.

### 11. Les deux commutateurs restent indépendants

Les mots basculent par une expression `if` lisant un chemin **que la fixture nomme elle-même** ;
les valeurs basculent par `presentationSelection`. Les quatre combinaisons sont rendues et
téléchargeables. Aucune table langue ↔ devise n'existe : croiser des mots français et des dollars
est indépendant par conception, et la cohérence appartient à l'application intégratrice.

## Ce que l'exécution a corrigé du plan

**La baseline annoncée rouge était verte.** Le plan relevait
`reference-document.test.ts` à 31 échecs sur 37 après 434 913 ms sur
`feat/c11-grille-colonnes-et-calques`. Sur `main` à `31b8973`, le même fichier seul passe
**37 sur 37 en 130 s**. Le défaut ne se reproduit pas et n'est donc imputé à personne ; en
revanche, la suite **complète** lancée en parallèle a produit un dépassement du délai de 60 s sur
`puppeteer-pdf-strategy.test.ts`, que le même fichier ne reproduit pas seul. C'est une saturation
de machine, pas une régression, et c'est un signal à surveiller si la CI se met à osciller.

**La modification locale d'`App.tsx` à préserver n'existait plus** : la branche C11 a été
fusionnée entre la rédaction du plan et l'exécution. `App.tsx` sort du lot inchangé.

**`MarkerReserve` change de forme, ce que le plan n'avait pas prévu.** Elle perd `digits` et gagne
`placeholderOf(run)`. La raison est directe : le texte qu'une sonde affiche dans un marqueur ne
peut plus être `'0'.repeat(n)` quand la réserve a été mesurée sur des chaînes localisées entières.
Le remplaçant est **l'une des chaînes mesurées**, donc il tient dans la boîte par construction.

**La voie « mesure de chaînes entières » a été retenue sans arbitrage coûteux (P4).** La classe CSS
des marqueurs désactivait déjà `font-kerning` et `font-variant-ligatures`, et la sonde utilise la
même classe : la condition que le plan posait pour la voie de repli était donc *déjà* remplie, et
c'est la voie principale qui restait la bonne — pour une écriture localisée, l'alphabet n'est pas
les quatorze caractères canoniques et multiplier une largeur par un nombre de caractères deviné est
exactement « l'alphabet imaginé » que D11 refuse.

**La facture de référence garde ses deux orthographes au lieu d'être remplacée.** Le plan disait
« modèle unique » ; l'exécution enfile une table d'écritures de site à travers **le même
`referenceDocumentRaw`**, comme l'apparence l'était déjà et comme C11 dérive déjà sa variante en
calques. Sans écriture, le document est **au caractère près** celui qu'E1, E3 et C11 impriment —
leurs 37 cas passent sans modification, ce qui rend la garantie « un segment non formaté garde son
rendu canonique » observable sur un document réel plutôt que sur une fixture de laboratoire.

**`MarkerWriting` porte la fonction à côté de l'écriture résolue.** Le §4.3 du plan disait
« aucun run ne garde profil ou clé si la `Presentation` résolue suffit ». Elle ne suffit pas : deux
profils peuvent viser la même écriture avec deux fonctions différentes — la facture de référence le
fait exprès, `date` et `money` partagent la clé `amount` —, donc le `kind` voyage avec.

**`invalid-writing` est inatteignable par `parseTemplate`.** `PresentationTableSchema` valide chaque
entrée à la porte, donc un template parsé ne porte que des écritures valides. La cause reste
distinguée et couverte, mais au niveau unitaire, sur une table qui n'est pas passée par la porte.

**Un défaut préexistant du playground a été trouvé, laissé en place, puis corrigé.** Vérifié sur
`main` avant toute modification E4 : `grid-content-overflow` sur `zone-titre`.

**La portée a été mesurée deux fois avant d'être écrite ici, et les deux premières lectures étaient
fausses.** Une première note ne citait que le jeu `soixante-lignes` ; une seconde a corrigé en
« les deux jeux de soixante lignes, dans les deux écritures », ce qui est exact mais tait la
dimension qui décide réellement. La mesure, prise en rétablissant le `rowSpan` fautif : **4 des 16
combinaisons échouaient, toutes sur l'apparence A** — ses deux jeux de soixante lignes, dans ses
deux écritures. L'apparence **B rendait déjà**, sur les quatre mêmes combinaisons. Le discriminant
est donc la **typographie du gabarit**, pas la donnée ni l'écriture : A compose son titre en
Georgia 9,5 pt et le renvoie sur une troisième ligne, B en Arial 8,5 pt et s'en tient à deux. Le nom
de client long est la donnée qui déclenche, la fonte est ce qui décide.

Une zone de grille n'est ni rognée ni redimensionnée, donc le moteur avait raison de refuser et la
correction appartenait à la vitrine : `zone-titre` déclare `rowSpan: 4`, sur les rangs 3 et 4 que la
grille laissait libres — le même span que la zone de marque à côté d'elle. La grille garde ses six
rangs, la hauteur du document ne change pas, et aucune ligne du moteur n'a été touchée. Les **16**
combinaisons gabarit × jeu de données × écriture rendent un PDF, vérifié contre le pont.

**Ce que l'épisode enseigne au-delà du correctif :** une portée de défaut se mesure en rétablissant
la faute, jamais en raisonnant sur le cas où on l'a rencontrée. Deux notes successives l'ont
raisonnée, et toutes deux ont manqué la dimension du gabarit.

## Recette

- **Sans navigateur :** la matrice de sélection (absente, profil absent, clé absente, clé héritée,
  deux profils une écriture, cent lectures une résolution, trois clés trois résolutions), les trois
  causes du résolveur, les gardes de type des trois fonctions, l'échelle d'un report, les
  enveloppes (symbole, espaces, signes, `ZZZ`, saturation), la borne de magnitude sur des
  contributions qui se compensent, et l'ordre arrondi → écriture espionné sur `2.5 halfEven`.
- **Dans Chromium :** la même facture de soixante lignes rendue en **français/euros** et en
  **anglais/dollars** depuis **un seul objet template**, sur **quatre feuilles A4** dans les deux
  cas ; le report localisé après arrondi sur les feuilles 2 à 4 ; `20260016` et les codes article
  inchangés ; les quatre appariements mots/valeurs atteignables ; `ZZZ` imprimé sur un document
  dédié ; et cinq refus de bout en bout dont un qui prouve que **rien n'atteint l'imprimeur**.
- **Un rendu qui aboutit est la preuve d'absence de rognage** : le pipeline refuse sur tout
  `clippedMarkerCount` non nul, donc une figure localisée un caractère trop large aurait levé
  `layout-measurement-failed` au lieu de produire des octets.
- **Playground :** les deux sélecteurs sont indépendants, le pont n'accepte qu'un **identifiant de
  variante** vérifié dans sa propre liste blanche — une table d'écritures postée par la page est
  refusée en `unknown-selection`.

### Les ablations, jouées et mesurées

Chaque mutation a été appliquée au code de production, la cible relancée, puis la mutation
annulée. **Douze sur douze ont été tuées.**

| Mutation volontaire | Verdict |
| :--- | :--- |
| formater tous les nombres, même sans déclaration | 🔴 tuée — le site canonique n'imprime plus `12.5` |
| prendre le profil pour une clé d'écriture | 🔴 tuée — la suite ne se collecte même plus : un profil **n'est pas** une clé |
| résoudre à chaque valeur (cache retiré) | 🔴 tuée — l'identité `toBe` sur cent lectures |
| remplacer `Object.hasOwn` par `in` | 🔴 tuée — `constructor` sélectionne une fonction héritée |
| assembler une `Presentation` à la main | 🔴 tuée — trois causes du résolveur disparaissent |
| formater avant `roundDecimal` | 🔴 tuée — `2.5 halfEven` imprime 3 |
| normaliser les espaces au sérialiseur | 🔴 tuée — sept cas, dont le séparateur étroit |
| replier une devise inconnue sur EUR | 🔴 tuée — dans les tests de `core`, pas d'`engine` : la mutation d'une source de `core` n'atteint pas un test d'`engine`, qui lit le `dist` |
| garder la réserve canonique pour un marqueur écrit | 🔴 tuée — neuf cas, dont « deux devises, deux formes » |
| ignorer `clippedMarkerCount` | 🔴 tuée |
| laisser C10 sur `printable` | 🔴 tuée — quatre cas de compatibilité |
| oublier l'estampille | 🔴 tuée — onze cas de la chaîne historique |

**Une treizième mutation du plan n'a pas de site.** « Coupler langue et sélection » ne mute rien :
la propriété est l'**absence** de tout code de couplage. Elle est prouvée par les quatre paires du
`it.each` Chromium et par le pont vérifié en direct — quatre combinaisons rendues, et une table
d'écritures postée par la page refusée en `unknown-selection`.

## Dettes explicites

- **E4-9 — même ICU à l'aperçu et au rendu : dette de E5 / viewer.** E4 vérifie le PDF avec l'ICU
  du processus qui construit l'HTML. Aucun aperçu public n'existe encore ; cette ADR ne déclare
  donc pas l'égalité livrée.
- **J3 — relecture métier non tenue.** Les deux PDF de séance existent comme artefacts temporaires,
  pas comme goldens de CI. Le jalon exige, en plus, une séance tenue par un gestionnaire ou un
  comptable et un compte rendu sans anomalie générique ouverte.
- **Identité multi-machine des chaînes et des PDF** reste E6 ; un **corpus PDF figé** reste E7 ;
  les **limites hostiles et la concurrence** restent E8.

## Signaux de réouverture

- une facture arabe ou persane réelle demande un système de chiffres non latin ;
- deux intégrateurs externes demandent une sélection **par rendu** sur un port partagé ;
- un format réel nouveau apparaît (pourcentage, unité, notation scientifique) ;
- la réserve conservative refuse des documents réalistes dont les reports restent courts ;
- un troisième parcours d'expression apparaît, ce qui rendrait le Visitor obligatoire là où
  l'[ADR 0004](0004-les-arrondis-declares-par-le-modele.md) l'a amendé.

Chacun exige un mandat distinct ; aucun n'est anticipé dans le contrat E4.
