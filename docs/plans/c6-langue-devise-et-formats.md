# Plan d'implémentation — `@openview/core` lot C6 : langue, devise et formats

> ⛔ **PÉRIMÉ — le lot est livré (2026-08-20).** Ce document ne fait plus foi : c'est
> [ADR 0008](../adr/0008-langue-devise-et-formats.md) qui porte les décisions, les mesures et les
> onze attentes envers l'aval, et elle **corrige** ce plan sur trois points nommés dans sa section
> « Ce que l'exécution a corrigé du plan ».
>
> Le plus important des trois, pour un lecteur qui reviendrait ici chercher du texte à recopier :
> **le §3 prescrit ses docstrings verbatim, et `AGENTS.md` §1.6 les interdit désormais** — pas de
> numéro de lot, pas de hachage de commit, pas d'historique de brouillon, pas de dépôt de métriques,
> pas de majuscules de plaidoirie dans le code. Le **contrat** de ce plan a été livré tel quel ; sa
> **prose** ne l'a pas été, et ne doit pas l'être.
>
> ⛔ **Le numéro de version promis à E4 est réattribué, et c'est la seule correction de fond
> apportée après la livraison.** Ce plan écrit `7 → 8` en une douzaine d'endroits — `A-4`, `A-5`,
> `R-17`, le tableau de coût du §2.0, celui du §6.1 — et l'estampille du champ `format?` de segment
> y est chiffrée comme *le numéro 8*. **Un plan ne peut pas réserver un numéro : il chiffre un
> coût.** Ce coût est **une estampille**, et l'estampille prend la **prochaine version disponible
> au jour de la livraison**, pas celle qui était libre au jour de l'écriture.
>
> **L'ordre réel, acté :** la roadmap place [C7](../roadmap/core.md#c7-les-blocs-insécables) avant
> [E4](../roadmap/engine.md#e4-langue-et-devise-au-rendu), donc **C7 prend `7 → 8`** et le coût
> d'E4 devient **`8 → 9`**. Partout ci-dessous, lisez « une estampille, `version courante →
> version suivante` » — jamais « la version 8 ». Le chiffrage, lui, ne bouge pas d'un pouce :
> c'est toujours **une** estampille et **une** migration d'identité, la modification la moins
> chère de ce dépôt.


> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers touchés,
> contrat définitif, tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans
> `docs/roadmap/` — ni les *décisions* structurantes, qui se consignent dans `docs/adr/`. Il est
> **périssable** : une fois le lot livré, il ne fait plus foi, et c'est l'ADR 0008 qui restera.
>
> **Statut : ✅ PRÊT À EXÉCUTER — `INC-0` peut être ouvert.**
>
> Le dossier est passé par une revue externe (2026-08-19), qui a relevé **dix-huit défauts** :
> **dix-sept sont corrigés dans ce document**, un est **réfuté par la mesure** (R-01 — la base
> était bonne), et les **trois arbitrages neufs** qu'elle a ouverts sont **tranchés** (2026-08-20).
> Le défaut principal était réel et il est réparé : le [§4], le [§5.2] et le [§5.3] prescrivaient
> encore le contrat **d'avant l'amendement de D-06** — `declarableLocale`, `zz` refusé au parse, un
> message que le [§3.3] avait explicitement retiré —, si bien qu'un exécutant appliquant `INC-0`
> **écrivait du code mort et un test vert pour une raison fausse**.
>
> **Deux décisions ont changé le contrat depuis la revue**, et elles sont portées dans le [§3] :
> **A-7** — `resolvePresentation` rend un **résultat discriminé** (`{ ok: true, writing }` /
> `{ ok: false, refusal }`) ; **A-5** — le champ `format?` de segment est **différé à E4**, coût
> acté d'une estampille `7 → 8`.
>
> ⚠️ **Ce que « prêt » signifie ici, et ce que ça ne signifie pas.** Ça signifie : *rien dans ce
> plan ne prescrit plus quelque chose de faux, et aucune décision de contrat n'est ouverte.* Ça ne
> signifie pas *mesuré* : `A-7` a changé les quatre sorties de `resolve.ts`, donc **la suite de
> tests, la couverture et trois lignes de la matrice de mutation sont à rejouer**, et les quatre
> portes n'ont **jamais** tourné dans le dépôt. Ces mesures sont désormais des **critères de sortie
> d'`INC-0` et d'`INC-1`** [§4], et non des blocages du plan : **un plan est prêt quand ses
> inconnues sont assignées, pas quand elles sont toutes résolues.**
>
> ⛔ **Trois arbitrages restent ouverts et bloquent `INC-5`, pas le code** — `A-1`, `A-2`, `A-3`,
> avec les mandats `M-2`, `M-3`, `M-7`. Ils portent tous sur des **textes** (une ADR acceptée, deux
> « prêt quand » de roadmap), et `INC-5` est l'incrément qui les écrit. `INC-0` à `INC-4`
> s'exécutent sans qu'aucun soit tranché.
>
> **Date :** 2026-08-19, **révisé le 2026-08-20** (revue externe + arbitrages A-5 à A-7) ·
> **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> ✅ **Base de mesure : `origin/main` = `b3a82ea`, et elle est BONNE.** Le dossier est mesuré
> contre `c806aaa`, et [mesuré] `c806aaa` **est** dans `origin/main` — PR **#25**, fusionnée le
> 2026-08-19 15:04 UTC par le merge `b3a82ea`, dont les parents sont `bca73f6` et `c806aaa`.
> `origin/main` porte donc bien le repli du `-0` de `guards.ts:129`. **Aucun remesurage n'est
> requis pour cette raison.**
>
> ⚠️ **Ce qui est vrai, en revanche, et qui est une précondition d'exécution :** le `main`
> **local** a divergé. `320bea6` n'est **pas** le parent de `c806aaa` — ils sont **frères** sur
> `bca73f6` —, et `320bea6` (un fichier, `apps/playground/src/App.tsx`) **n'a jamais été poussé**.
> Le `main` local est donc à la fois **en avance d'un commit** et **en retard de deux** :
>
> ```
> bca73f6 ──┬── c806aaa ──┬── b3a82ea   ← origin/main
>           └── 320bea6              ← main local, non poussé
> ```
>
> **À faire avant INC-0, et c'est de l'hygiène de dépôt, pas du lot :** aligner le `main` local sur
> `origin/main` et régler le sort de `320bea6`. Tant que ce n'est pas fait, les quatre portes
> lancées en local mesurent un arbre qui n'existe nulle part.
>
> **Et [D-19] garde le motif rétréci que le §« Réserves de méthode » lui donne déjà** (point 5) :
> l'algèbre repliant `-0` à `guards.ts:129`, le repli de `format.ts` ne couvre plus que le `-0`
> **porté par la donnée** — que `c806aaa` refuse délibérément de normaliser (« *rewrite a `-0` the
> caller's DATA carries* » : `min`/`max` rendent un élément, `path` rend le datum). **La décision
> tient ; c'est son unique motif qui a changé, et il est écrit.**
>
> ⚠️ **Le poids annoncé par la roadmap est « L ». Ce plan annonce « XL »**, et le dit ici plutôt
> que de laisser le lecteur le découvrir : le lot hérite de **vingt promesses** laissées par C1 à
> C5, de **deux questions ouvertes structurantes**, de la contrainte d'outillage la plus serrée du
> dépôt, et d'une estampille de schéma. La roadmap **n'est pas corrigée** par ce plan — ce serait
> rouvrir l'ordonnancement de la vague 1 en passant ([M-5]).

---

## Les sept arbitrages, en une page

> ⚠️ **Le dossier en annonçait quatre. La revue externe du 2026-08-19 en a ouvert trois de plus**,
> et deux d'entre eux (`A-5`, `A-7`) portent sur la **forme stockée** et sur la **surface
> publique** — ce sont donc des questions qui ne se rattrapent pas après INC-2 et INC-3.

| # | Question | ⛔ | Recommandation | Ce que l'autre branche réécrit |
| :-- | :--- | :-: | :--- | :--- |
| **A-1** | Une locale que la machine qui **ouvre** le document ne connaît pas rend-elle le document **inouvrable**, ou **ouvrable avec une écriture non résolue** ? | **OUI** | **refus au rendu** | `D-06` devient irréversible de fait ; Openview doit **publier une version d'ICU minimale**, donc détenir un référentiel — ce que `D-06` et `D-08` refusent |
| **A-2** | Le critère de recette de `core.md:261-262` est **mot pour mot** celui d'E4, et `core` ne rend rien : qui le porte ? | **OUI** | `core` **déclare**, E4 **produit** | Le lot **ne peut pas être déclaré fini** : aucun contrat de `core` ne satisfait le critère actuel |
| **A-3** | Ce contrat dépend d'ICU, alors qu'une ADR **acceptée** écrit que la brique « ne lit rien de l'environnement, **ni ICU** ». | **OUI** | **amender**, en disant ce qui reste vrai | Renoncer à ICU impose une table de typographie déclarée : déterminisme intégral, mais Openview détient un référentiel linguistique — **le §3 est à réécrire entièrement** |
| **A-4** | `numberingSystem` doit-il être **déclarable**, ou épinglé en dur ? | — | **épinglé** aujourd'hui | Un sixième champ et **une estampille** (`7 → 8`) — la modification la moins chère du dépôt |
| **A-5** | 🆕 Le **lien déclaratif site → profil d'écriture** (`format?` sur un segment) doit-il être livré **par C6**, qui dépense déjà l'estampille `6 → 7`, ou différé à E4 ? | ✅ **TRANCHÉ** 2026-08-20 | **DIFFÉRÉ à E4**, coût **acté** : une estampille `7 → 8` | Livrer laissait C6 **hors de `ast/**`** au prix de deux champs d'AST, deux paires `*_KEYS_IN_STEP`, les fixtures **et le premier invariant croisé du lot** — donc sa propre campagne, sur un lot déjà **XL**. L'estampille gratuite établissait la **fenêtre** de décision, pas la réponse. ⛔ Différé en connaissance de cause : E4 câble les sites **à la main**, et `20260014` peut s'imprimer `20 260 014` |
| **A-6** | 🆕 La **langue des libellés** (un `if` d'expression lisant une donnée) et l'**écriture des valeurs** (le nom passé à `resolvePresentation`) sont **deux sélecteurs indépendants**. Les laisse-t-on diverger ? | ✅ **TRANCHÉ** 2026-08-20 | **séparés, et le plan le DIT** — attente `E4-11`, combinaison croisée montrée à l'écran [§6.4] | Les coudre **interdirait un document correct** : anglais + euros pour un client britannique d'une société française, c'est-à-dire `en-FR` — le tag que [A-1] défend sur toute sa longueur. Et cela ferait d'Openview l'arbitre de « ces deux déclarations se contredisent », une règle métier. **Zéro changement de contrat** |
| **A-7** | 🆕 `resolvePresentation` rend-il une `Presentation` **structurelle**, ou un **formateur résolu** dont les trois fonctions sont les méthodes ? | ✅ **TRANCHÉ** 2026-08-20 | **RÉSULTAT DISCRIMINÉ** (`{ ok, writing }` / `{ ok, refusal }`) ; forme structurelle **conservée**, formateur-objet **refusé** | On paie pour la garantie qui avait un **consommateur** : l'avertissement Designer (`D-06b`) recevait un `undefined` muet, il reçoit `'unhonoured-locale'`. Pas pour celle qui n'en a pas encore — `E4-10` n'a d'appelant que l'équipe qui écrit E4. ⛔ **Contrepartie obligatoire :** l'**ADR 0008 recopie verbatim** le tableau des **cinq** familles [§3.5]. Bénéfice non cherché : les quatre sorties du résolveur étaient **indistinguables**, la matrice gagne trois cibles tuables |

**Ce que « bloquant » veut dire ici, et ce qu'il ne veut pas dire.** Les ⛔ de `A-1` à `A-3`
n'empêchent pas d'écrire le code : le [§3] est complet, il compile, il est mesuré. Ils empêchent de
**déclarer le lot fini**, parce que `INC-5` porte l'ADR et son amendement, et **qu'une ADR ne
s'écrit pas contre une question ouverte**.

✅ **`A-4` à `A-7` sont tranchés, et deux d'entre eux n'étaient PAS de cette famille — c'est ce que
la revue a corrigé.** `A-5` portait sur la **forme stockée**, `A-7` sur la **signature publique** :
tous deux bloquaient un **commit** (`INC-2`, `INC-0`), pas une ADR. Ils ont donc été tranchés
**dans leur fenêtre**, et le [§3] porte le résultat d'`A-7` — le résultat discriminé — plutôt que
de l'annoncer.

---

## Revue externe du 2026-08-19 — le registre des dix-huit corrections

Une relecture externe a été menée sur le dossier **après** sa clôture, contre le dépôt et contre
deux exécutions d'ICU. Elle est consignée ici **en entier**, y compris les points où elle se
trompe, parce qu'un registre qui ne garde que les touches est un registre qui ment.

**Ce qu'elle a établi, en une phrase :** le [§3] tient, et le reste du dossier ne l'a pas suivi.
L'amendement de **D-06** — la scission `declarableLocale` → `wellFormedLocale` / `honouredLocale`
— a été porté dans le contrat, dans les décisions et dans les mesures, **mais pas dans les
incréments ni dans le plan de test**. Trois sections prescrivent donc encore le contrat mort.

### Le registre

| # | Ce qui est faux, ou incomplet | Verdict | Corrigé où |
| :-- | :--- | :--- | :--- |
| **R-01** | Le dossier est « mesuré contre `c806aaa` », présenté comme le HEAD dont `320bea6` serait le parent | ⛔ **PARTIELLEMENT RÉFUTÉ — et une première rédaction de ce registre s'est trompée dans l'autre sens.** [mesuré] `c806aaa` **est** dans `origin/main`, par la PR **#25** (merge `b3a82ea`, parents `bca73f6` + `c806aaa`) : **la base de mesure est bonne, aucun remesurage n'est dû**. Ce qui est faux, c'est la **filiation** : `320bea6` n'est pas le parent de `c806aaa`, ils sont **frères** sur `bca73f6` — et `320bea6` **n'est pas poussé**. Le défaut réel est donc un `main` **local divergent**, pas un dossier mesuré à côté | en-tête ; [§C.0.2] — **hygiène de dépôt, pas blocage** |
| **R-02** | `INC-0` prescrit `locale.ts (declarableLocale)` et un `.refine(tag => declarableLocale(tag) !== undefined)` | ✅ **confirmé** — le nom a **disparu** au [§3.2], qui écrit qu'il « *n'est pas réemployé* » | [§4], INC-0 et INC-1 |
| **R-03** | Le tableau des refus donne `locale: 'zz'` (N01) et `'fr-XX'` (N02) **refusés au parse**, avec le message « *…honours exactly as written…* » | ✅ **confirmé** — le [§3.3] les fait **parser** et retire ce message, au point que le test l'épingle par un `not.toContain` | [§5.2] |
| **R-04** | Le contrôle positif **P14** vérifie l'absence de `declarableLocale` du barrel | ✅ **confirmé** — il y a désormais **deux** prédicats à tenir hors du barrel | [§5.3] |
| **R-05** | Le tableau « Les dix fichiers » affecte les fichiers à `INC-1 … INC-5` ; le [§4] les affecte à `INC-0 … INC-5`, et réunit `resolve.ts` et `format.ts` dans un seul incrément | ✅ **confirmé** — décalage d'un cran sur **neuf lignes sur dix**, plus une coupe qui n'existe pas | [§3], tableau des dix fichiers |
| **R-06** | « **Le lot ne modifie AUCUN fichier de test existant** », suivi trois lignes plus bas de « *un seul, `migrate.test.ts`, plus une ligne de `style.test.ts`* » | ✅ **confirmé** — contradiction dans le même encadré | [§3], même encadré |
| **R-07** | `E4-3` : « résoudre l'écriture **une fois par rendu**, jamais par valeur » | ✅ **confirmé** — incompatible avec le [§2.0], qui décrit un modèle déclarant **six** écritures dont trois servent **dans le même rendu** (montants, quantités, prix unitaires) | [§2], [§6.1], INC-1 |
| **R-08** | Le [§6.4] exige simultanément « le **même** `renderData` », « un sélecteur qui ne change que le **nom** d'écriture » et « les libellés qui basculent par `if` » | ✅ **confirmé** — impossible : le `if` lit une **donnée**, donc changer la seule clé d'écriture ne le fait pas basculer | [§6.4] |
| **R-09** | `A-1`, branche B : « le refus reste **typé et localisé** à l'écriture concernée » | ✅ **confirmé** — `resolvePresentation` rendait `undefined` : ni type, ni cause, ni chemin. ✅ **REMÉDIÉ par A-7** : le refus porte désormais `refusal`, donc il **est** typé et **nomme** sa cause. Reste sans **chemin**, et le plan le dit | [§8] A-1, A-7 ; [§3.4] |
| **R-10** | `A-3` cite l'ADR 0003 comme disant que « **la brique** ne lit rien de l'environnement — ni horloge, ni fuseau, ni locale, ni ICU » | ✅ **confirmé** — [vérifié, `0003:238-242`] le sujet de la phrase est « **une opération de date** », dans le **critère d'admissibilité de l'algèbre**. C6 n'ajoute aucune opération. `:783-784` a pour sujet `toLocaleUpperCase`. **L'ADR 0003 n'interdit pas ce contrat** ; le conflit réel est avec **E6** | [§7.4] M-3, [§8] A-3 |
| **R-11** | `M-7` (l'énoncé d'E6 face à deux ICU) est classé « **non bloquant pour C6** » | ✅ **confirmé** — c'est C6 qui introduit la dépendance à CLDR. L'amendement d'A-3 rend `engine.md:100-105` faux au moment même où il est écrit | [§7.4] M-7, [§8] |
| **R-12** | « L'agrégat **monte** dans tous les cas » | ✅ **confirmé comme incomplet** — l'arithmétique n'est faite qu'en **lignes**. [vérifié, `vitest.config.ts:22`] le seuil porte sur **quatre** métriques : `lines`, `functions`, `branches`, `statements` | [§C.7.4], [§C.8] |
| **R-13** | Le résumé d'en-tête annonce « **33 `it`, 102 `expect`, 33/33 verts** » sans dire que ce n'est **pas** le fichier du plan | ✅ **confirmé** — le [§C.6.0] l'écrit, l'en-tête ne le reprenait pas : le fichier final (**~40 `it`**) **n'a été exécuté par personne** | en-tête ; [§C.6.0] |
| **R-14** | [§3.4] : « un appelant qui saute cette fonction — **aucune porte, et aucune n'est possible dans `core`** » | ✅ **confirmé faux** — une porte existait : le formateur-objet. ✅ **TRANCHÉ (A-7) : elle est pesée puis REFUSÉE**, parce qu'elle invalidait une campagne réellement exécutée. `E4-10` reste documentaire, et la contrepartie est **obligatoire** : l'ADR 0008 recopie le tableau des cinq familles | [§3.4], [§3.5], [§8] A-7 |
| **R-15** | [§3.4] appelle `honouredLocale(declared.locale)` **avant** le `safeParse` | ✅ **confirmé** — [mesuré] `Intl.getCanonicalLocales(null)` lève un **`TypeError`**, que le `catch` de `wellFormedLocale` **relance** (il ne rattrape que `RangeError`). Une écriture bâtie à la main portant `locale: null` traverse donc une signature `Presentation | undefined` en exception | [§3.4] |
| **R-16** | Le message de refus dit « **BCP-47** », et l'honorat est présenté comme « ce moteur connaît le tag » | ✅ **confirmé, remède réfuté** — voir ci-dessous | [§3.2], [§3.3], [§5.3] |
| **R-17** | Le remède au trou `E4-1` est « *un champ optionnel de segment → **une** estampille* », présenté comme un coût futur | ✅ **confirmé comme incomplet** — C6 dépense déjà `6 → 7`, donc l'estampille du champ serait **gratuite** ; c'est **différer** qui en coûte une seconde. ✅ **TRANCHÉ (A-5) : différé quand même**, parce qu'une estampille gratuite ne rend pas gratuits deux champs d'AST, deux paires de clés, les fixtures et un invariant croisé. Le coût `7 → 8` est **acté** à la charge d'E4 | [§2.0], [§6.1], [§8] A-5 |
| **R-18** | `E4-2` : « arrondir **puis** formater », `maxFractionDigits` devant valoir les décimales du `round` | ✅ **confirmé comme invérifiable**, et **il le reste** : `A-5` ayant différé le lien déclaratif, il n'y a **rien à vérifier** avant E4. La précondition est donc écrite comme telle — une obligation dont le lot dit qu'aucune porte ne la tient, avec son remède structurel nommé (le champ de segment) | [§7.2], [§8] A-5 |

### R-16, en détail — parce que la revue a raison sur le fait et tort sur le remède

**Le fait est établi** [mesuré, Node v24.11.1 / ICU 77.1] :

```
en-Latn-US   canonique : en-Latn-US   honoré (égalité) : NON   resolvedOptions().locale : en
en-GB-oed    Intl.getCanonicalLocales lève RangeError   (tag grandfathered, valide en BCP-47)
```

Deux conséquences, et il faut les séparer :

1. **`Intl.getCanonicalLocales` n'accepte pas tout BCP-47.** Les tags *grandfathered* irréguliers
   — `en-GB-oed` et `i-klingon` lèvent, là où `art-lojban` est converti en `jbo` — sont refusés
   par **ECMA-402**, pas par BCP-47. Le message du [§3.3] doit dire « **structurellement valide au
   sens d'ECMA-402** », et non « bien formé BCP-47 » : le dossier mesure lui-même **50 tags qui
   lèvent** et cite `en-GB-oed` en tête [§3.2].
2. **L'égalité `resolvedOptions().locale === canonique` est une POLITIQUE, pas un test de
   capacité.** Elle refuse `en-Latn-US`, `fr-Latn-FR`, `ca-ES-valencia`, `ha-Latn-NG`, `es-005` —
   tous **légitimes**, tous **connus** d'ICU, tous silencieusement équivalents à un tag plus court.

**Et le remède que la revue propose — `supportedLocalesOf` — est réfuté par la mesure**, ce qui
est le résultat le plus utile de cette relecture :

```
balayage de 2 080 tags bien formés (20 langues x 8 écritures x 13 régions), ICU 77.1
  honoré par l'égalité ET supporté          :    43
  honoré par l'égalité seulement            :     0
  SUPPORTÉ seulement (refusé par l'égalité) : 2 037
  exemples : fr-US, fr-GB, fr-DE, fr-BR, fr-CN, fr-419, fr-001, fr-Latn
```

`supportedLocalesOf` tronque jusqu'à la **langue** : il répond « oui » pour `fr-US` et `fr-Latn`,
qui s'impriment en `fr`. **Il ne teste donc pas « honoré tel qu'écrit » — il teste « la langue est
connue ».** Ce qu'il fait bien, et qui est exactement l'autre moitié : [mesuré] `zz` → `[]`,
`xx-YY` → `[]`, c'est-à-dire qu'il détecte **précisément** le repli sur la locale de l'**hôte**,
qui est le défaut que tout ce lot existe à supprimer.

> ⛔ **Ce qu'il faut donc écrire, et que le dossier n'écrivait pas :** l'égalité **n'est pas** « ce
> qu'ICU supporte », c'est **une politique d'Openview** — *une écriture n'est honorée que si ICU la
> résout vers elle-même* — **strictement plus stricte** que la capacité d'ICU, et son coût est
> nommable : elle oblige l'auteur à écrire le tag **minimisé** (`en` et non `en-Latn-US`, `ca-ES`
> et non `ca-ES-valencia`). C'est cette politique, et non une capacité, que `D-06` doit énoncer, et
> c'est **elle** que l'avertissement du Designer (`D-06b`) doit savoir expliquer : « *ce tag est
> connu, mais sous une forme plus courte* » n'est pas le même message que « *ce tag est inconnu* ».

### Ce que la revue a soulevé et qui ne demande **aucune** correction

| Attaque | Pourquoi elle ne mord pas |
| :--- | :--- |
| « `TextPageFieldSegment` doit être couvert, le dépôt attribue à C6 le format des numéros de page » | **À moitié.** [vérifié, `ast/types.ts:92-95`] le dépôt attribue bien à C6 « *the display FORMAT — language, digits, "sur" against "of"* », et le [§7.1.b] le dissèque déjà : la moitié **langue** est honorée gratuitement par le `if` de C1, la moitié **chiffres** est déclinée (`numberingSystem` épinglé, M-4). Le trou `E4-1` y est **le plus bénin du document** : un `pageField` est la seule valeur dont le moteur sait **par construction** qu'elle est un nombre, puisque ce sont E2/E3 qui la produisent. Il faut néanmoins que **A-5**, s'il est retenu, ouvre le champ sur **les deux** kinds de segment |
| « Le plan reconnaît une faiblesse structurelle, donc il n'est pas exécutable » | **Non.** Reconnaître un trou avec son propriétaire, son coût chiffré et sa piste écartée est ce que le dépôt demande. Ce qui est corrigé ici, c'est que le **chiffrage était faux** (R-17), pas que le trou soit tu |
| « Une seule écriture par rendu » serait une décision de conception | **Non, une formulation.** [D-11] et le [§6.1] motivent `E4-3` par le **coût** (`resolvePresentation` construit deux formateurs de contrôle), jamais par une exclusivité. C'est le mot « l'écriture » au singulier qui fabrique la contradiction |

---

## Ce qui a été mesuré, et ce qui ne l'a pas été

Le protocole complet est en tête du [§3]. En résumé : un bac à sable **hors du dépôt**, une copie
intégrale de `packages/core/src`, un `tsconfig` qui **étend** `tsconfig.base.json` et reprend les
options de `packages/core/tsconfig.json`, des **jonctions Windows** vers le `zod` et le
`typescript` du dépôt, une **réplique de `biome.jsonc` et des trois `.grit`** à diff vide, et
**deux binaires Node réellement présents sur le poste** : `v24.11.1` (ICU **77.1**) et
`ms-playwright-go/1.50.1` `v22.13.1` (ICU **76.1**).

- **Le contrat compile : `tsc` exit 0**, sur les **deux** configurations — production seule, puis
  tests compris avec le mapping `vitest` du dépôt.
- **Il passe le linter : zéro diagnostic sur 10 fichiers, tests compris, et zéro `biome-ignore`.**
  Le **contrôle négatif a été joué d'abord**, parce qu'un harnais qui ne rougit jamais ne prouve
  rien : arité zéro **refusée**, objet d'options hoisté **refusé**, et — mesure la plus utile du
  dossier — **le même précédé d'un `biome-ignore` refusé quand même**. *L'échappatoire
  qu'`AGENTS.md` §1.1 semble offrir **n'existe pas** pour un plugin GritQL.*
- **Il s'exécute sur deux versions d'ICU : 33 `it`, 102 `expect`, 33/33 verts sur ICU 77.1 ET sur
  ICU 76.1.** C'est la mesure qui valide la discipline d'assertion du [§5] : **aucune chaîne
  formatée n'est figée**, jamais.
  ⛔ **Ces 33 `it` ne sont PAS le fichier que ce plan prescrit** (R-13). Le fichier final est la
  **fusion** de deux campagnes — les 7 assertions de fermeture de A, le test neuf et les 4 tests
  réécrits de B, les entrées `N23` et `R01`–`R11` — soit **de l'ordre de 40 `it`**, et **cette
  fusion n'a été exécutée par personne** [§C.6.0]. Le rédacteur de l'incrément de test **mesure**
  ce compte, il ne le recopie pas.
- **Il s'émet et s'importe : 117 → 126 valeurs exportées**, par émission ESM réelle puis import —
  et non par comptage à la main.
- **Vingt-trois refus au *parse* et onze au *rendu*** ont été rejoués par `safeParse` : `code`,
  `path` et **messages réels**. **Tous rendent exactement UNE issue** — la règle de coupure de
  [D-16] tient, et le défaut « deux issues pour une faute » découvert par l'exécution de C5 ne se
  reproduit pas.
- **Vingt-neuf mutations, vingt-trois tuées.** Les six survivantes sont **nommées avec ce qu'elles
  enseignent** [§C.6], et l'une d'elles est la régression `C-1` elle-même, désormais tuée.
- **Quatre assertions existantes rougissent**, mesurées et non déduites : trois dans
  `migrate.test.ts`, une à `style.test.ts:134`. *Le dossier avait annoncé « douze » — c'était
  surévalué d'un facteur quatre.*
- **La couverture monte — en LIGNES, et seulement en lignes** : taux propre du lot **98,10 %**,
  agrégat de `packages/core/src/**` à **90,59 % dans le pire cas** — le pire cas étant l'hypothèse
  basse `A = 90` que la seule CI verte garantit. Une unique plage reste non couverte, et elle est
  **nommée plutôt que maquillée** ([§C.7]).
  ⛔ **L'argument « l'agrégat ne peut que monter » n'est établi que pour `lines`** (R-12).
  [vérifié, `vitest.config.ts:22`] le seuil du dépôt est
  `{ lines: 90, functions: 90, branches: 90, statements: 90 }` : **quatre** métriques, dont
  **trois** que la métrique substitut de ce dossier — lignes du JavaScript émis via
  `NODE_V8_COVERAGE` — ne calcule pas du tout. Un lot à 98 % de lignes peut être sous 90 % de
  **branches**, et c'est le cas le plus plausible ici, puisque le lot est **dense en gardes**
  (deux prédicats à coupure, quatre refus successifs dans le résolveur, trois `undefined`
  d'entrée). **À mesurer au premier incrément, par `pnpm run test:coverage`**, et non déduit.

**Ce qui n'est PAS mesuré**, et que le [§9] tient pour acquis : les **quatre portes dans le dépôt**
(elles y écrivent des caches et un `dist` — le cadre de planification l'interdit), `pnpm run build`
et l'émission des `.d.ts` de production, la **couverture réelle** par `@vitest/coverage-v8` sur le
TypeScript source (la nôtre est mesurée en lignes du JavaScript émis via `NODE_V8_COVERAGE`, donc
les chiffres de la CI ne seront **pas** identiques — la conclusion est robuste à cet écart, le
chiffre exact non), **l'agrégat de couverture réel à HEAD**, la sonde jetable de l'ADR 0003 sur
`noJsRestrictedProperties`, et la **revue humaine** du critère de recette. Enfin, les tests du bac à
sable tournent contre un **shim `vitest` de vingt lignes**, pas contre `vitest` : une divergence de
sémantique entre son `toStrictEqual` et le vrai est possible et **non vérifiée**.

---

## La faiblesse structurelle du lot, écrite en tête plutôt qu'enterrée

**Le contrat livre de quoi écrire une valeur. Il ne livre jamais la liste des valeurs à écrire —
et il ne le peut pas.**

Le formatage est une **fonction** ([D-02], et les trois conceptions concurrentes y ont convergé
indépendamment). Rien dans le document stocké ne dit donc **quels sites** s'écrivent ainsi. La
vitrine lie `commande.numero`, qui vaut `20260014` : une écriture appliquée à tous les nombres
imprimerait **`20 260 014`**, qui désigne une autre commande. Et Openview **ne peut pas** reconnaître
un total d'un numéro de pièce sans réserver un nom de champ — ce que la règle de périmètre
d'`AGENTS.md` interdit en toutes lettres.

C'est l'attente **`E4-1`**, elle est écrite trois fois dans ce plan, avec son propriétaire, son
remède chiffré (un champ optionnel de segment, classe *perte silencieuse*, donc **une** estampille)
et **la piste écartée avec son motif** — faire de `round(x, n, mode)` le marqueur implicite « ceci
est une valeur à écrire » coûterait zéro forme stockée, et elle est refusée parce qu'elle
changerait **en silence** le sens de documents v6 déjà écrits.

> ⛔ **Le chiffrage de ce remède était FAUX, et la correction retourne l'argument (R-17).** « Une
> estampille » n'est pas le coût de **livrer** le champ dans C6 : c'est le coût de le **différer**.
> `D-14` fait déjà passer `CURRENT_SCHEMA_VERSION` de **6 à 7** dans ce lot, et un champ optionnel
> de segment est **exactement la même classe** — *perte silencieuse* — donc il monterait sur
> **cette** estampille, à **coût d'estampille nul**. Différé, il en coûte une **seconde** (`7 → 8`)
> au lot E4 — et le [§6.1] l'écrit noir sur blanc (« *différer le champ de segment coûte une
> estampille au lot qui en aura besoin* ») sans en tirer la conséquence.
>
> ✅ **Tranché le 2026-08-20 (A-5) : DIFFÉRÉ, et le coût est ACTÉ.** L'argument ci-dessus est exact
> et **il n'a pas suffi** : il établit que la fenêtre de décision était réelle — avant `INC-2` —,
> pas que la réponse devait être « livrer ». Une estampille gratuite ne rend pas gratuits **deux
> champs d'AST, deux paires `*_KEYS_IN_STEP`, les fixtures, et le premier invariant croisé du lot**,
> sur un lot déjà coté **XL**. Ce que le report préserve : C6 reste **entièrement hors de
> `ast/**`**. Ce qu'il coûte, sans adoucissement : **E4 paiera `7 → 8`**, et jusque-là aucun
> document ne peut désigner ses sites. **Développement complet en [§8, A-5].**

> **Ce que cette faiblesse implique pour la lecture du critère de recette**, et c'est pourquoi elle
> est en tête : même la moitié « écriture » du critère n'est **pas entièrement démontrable par
> `core` seul**. La formulation proposée en [A-2] dit « *chacune de ses valeurs **peut** être
> écrite* », et ce « peut » est **exact** — il ne promet pas la liste.

**Deux faiblesses mineures, dites ici pour la même raison.** La **cardinalité** : un modèle qui
écrit montants, quantités et prix unitaires en deux langues déclare **six** entrées ; le lot livre
le mécanisme, pas l'ergonomie, et un Designer devra le rendre supportable. Et le **Designer n'est
pas instruit** : panneau d'édition d'une table d'écritures, sélecteur dans l'aperçu, avertissement
quand un modèle déclare une table que rien ne consomme — rien n'est nommé, et D5/D9 en hériteront
sans préavis.

---

## Revue de contradiction

**Trois conceptions concurrentes du même contrat ont été rédigées indépendamment**, chacune
gouvernée par une contrainte différente — l'une par le **contrat minimal**, l'une conçue **à
rebours depuis le document rendu**, l'une par la **réversibilité et les lots d'aval** — puis
confrontées décision par décision, attaquées sur quatre fronts (périmètre, versionnement,
outillage, avocat du diable), synthétisées, et **la synthèse a été réattaquée**.

**Elles convergent sur trois points, et une convergence de trois raisonnements indépendants est un
signal plus fort qu'un argument :**

1. **Le formatage est une FONCTION**, jamais un champ de segment ni un kind d'expression. La
   mécanique tue les deux : `concat` aplatit ses parties en chaîne **avant** que le segment
   n'existe (`requireText` refuse un nombre), et `TextPageFieldSegment` ne porte **aucune**
   `Expression`. Une fonction atteint les deux ; rien d'autre ne le fait.
2. **La moitié CONTENU du critère est déjà livrée par C1/C5.** Un `binding` sur un `if` rend
   « Facture » et « Invoice » depuis **un seul objet `Template`** — mesuré deux fois, dont une
   contre un `dist` reconstruit hors dépôt. **C6 n'ajoute rien pour les libellés**, et ce plan le
   dit en tête plutôt qu'en annexe.
3. **`declaredScaleOf` n'existe pas**, sous aucune orthographe — et [D-05] explique pourquoi c'est
   une dissolution du problème et non un contournement du garde-fou qui le surveille.

**Elles divergent sur trois points, et aucun n'a été tranché discrètement** : le **canal de
sélection de la langue**, la **forme stockée**, et les **listes closes**. Les trois sont
développés au [§2], avec la branche retenue et le motif de chaque rejet.

### Ce que la contradiction a corrigé

Une soixantaine de constats, disposés un par un. **Huit ont changé la forme du contrat**, dont
cinq de fond :

- **⛔ Un tag validé au *save time* ne l'est PAS au *run time* sur un autre ICU.** [mesuré, deux
  binaires réels] **527 tags acceptés contre 525** ; les divergents sont `cls` et — **`en-FR`**,
  c'est-à-dire le tag naturel de la moitié anglaise d'une facture française, **le cas d'usage même
  du critère de recette**. La même table rendait `success: true` sur un ICU et `false` sur l'autre :
  *ce n'est pas une écriture perdue, c'est le document entier qui ne s'ouvre pas*, dans la classe
  « refus illisible » d'`AGENTS.md` §1.2 — **sauf que le remède prescrit pour cette classe,
  l'incrément de `schemaVersion`, n'existe pas ici** : les deux machines portent le même build.
  → La validation est **scindée** : la **grammaire** au parse (spécifiée par ECMA-402, donc
  stable), l'**honorat** au rendu (porté par CLDR, donc pas stable). [D-06]
- **Les tuples clos de locales et de devises sont refusés.** [mesuré] le prédicat **structurel**
  accepte **22 tags légitimes que le tuple refuse** (`de-DE`, `br-FR`, `es-419`, `zh-Hans-CN`…),
  identiquement sur les deux ICU. Une liste close ferait d'Openview le détenteur d'un référentiel,
  et ferait dépendre le contrat d'une question produit **cotée bloquée**. [D-06, D-08]
- **Le kind d'expression `format` est refusé, et le refus est GRATUIT.** [mesuré]
  `grep -c "concat(" apps/playground/src/App.tsx` rend **0**, et les deux `concat` du modèle
  n'enfouissent aucune valeur à formater. Le motif qui justifiait la seule décision *irréversible*
  du dossier avait **zéro instance** dans le seul consommateur réel. *La mécanique reste vraie ;
  c'est la prévalence qui est réfutée* — et l'objection est conservée avec sa réfutation.
- **`EvaluationOptions.presentation` est refusé** : c'est le « troisième entrant d'évaluation » que
  `ast/types.ts:67-71` déclare **publiquement** que `core` ne prend pas, et le dépôt a payé une
  décision entière (ADR 0006, décision B) pour que `evaluateExpression` reste une fonction de
  `(expression, scope)`.
- **Le théorème « `max = max(min, scaleOf(value))` » est refusé** : [mesuré] `0.02 + 63.24` vaut
  `63.260000000000005`, donc la règle imprimerait **dix-sept chiffres** — sur la valeur même que
  l'ADR 0004 avait mesurée comme *sauvée* par ICU.

**Et trois gestes manquaient, tous ajoutés :** **trois options épinglées et non une**
(`timeZone`, `calendar`, `numberingSystem` — le second fait sortir `th-TH` en calendrier bouddhique
et le troisième touche **les montants**) ; `Object.hasOwn` sur la lecture de la table (sans lui,
`table['constructor']` rend un objet dont `.locale` vaut `undefined`, c'est-à-dire
`Intl.NumberFormat(undefined, opts)` — **l'angle mort d'arité zéro que tout ce lot existe pour
rendre inatteignable**) ; et la **revalidation complète des trois champs** au rendu, là où un seul
l'était.

### Attaques réfutées, conservées avec leur réfutation

Ce dépôt garde les objections mortes, « parce que c'est la réfutation qu'on relira le jour d'une
réouverture ». Les deux plus utiles :

- **La contradiction que l'ADR 0004 D10 avait nommée ne se déclenche pas.** Elle n'était armée que
  si C6 classait la table décimale d'ICU parmi les **règles métier**, ce qui aurait obligé à
  amender deux fichiers protégés. Le lot ne fait pas cela : il lit une règle **existante** — la
  décision 16, « les arrondis sont déclarés par le modèle » — et il avait mandat pour cette lecture
  (`docs/adr/0004-…:659` : « *le classement appartient à C6, qui l'instruira* »).
- **`toFixed` n'est substituable à rien**, et il n'est banni par aucune règle du dépôt — donc il
  fallait le mesurer pour le refuser. [mesuré, 1 000 000 de tirages à graine fixe] il diverge
  d'`Intl` **et** de `roundDecimal` sur **1,2064 %** des valeurs, tandis qu'`Intl` et `roundDecimal`
  divergent sur **0,0000 %**. Mécanisme : les deux derniers arrondissent la forme décimale courte,
  `toFixed` arrondit le binaire exact.

---

## Réserves de méthode, que ce plan doit à son lecteur

**1. L'en-tête, le [§8] et l'assemblage sont de l'orchestrateur**, écrits à partir du dossier de
synthèse. Les [§0], [§1], [§2], [§3] et [§C] sont le texte de cinq rédacteurs ; les [§4], [§5],
[§6] et [§7] sont repris **sans réécriture** des dossiers qui les portaient.

**2. Un agent a modifié cinq fichiers du dépôt hors mandat pendant la campagne de mesure, puis les
a revertés lui-même et l'a déclaré.** Vérification de l'orchestrateur : `git status --porcelain`
ne rend que les deux fichiers d'outillage de prévisualisation, et le `reflog` ne porte **aucune**
écriture d'agent. Les mesures ont été recomptées après revert et sont inchangées. *Le fait est
consigné plutôt qu'omis, parce que c'est exactement le risque que la règle « un plan n'écrit pas
de code » existe pour couvrir.*

**3. `git status --porcelain` rend deux lignes, et ce n'est pas C6** : `.claude/launch.json` et
`apps/playground/vite.config.ts` portent un réglage d'outillage de prévisualisation, écrit à la
demande de l'utilisateur pendant la planification, **sans rapport avec le lot**.

**4. ⚠️ Le bac à sable est périmé contre HEAD sur trois fichiers** — `arithmetic.ts`, `compare.ts`
et `guards.ts` ont changé avec `c806aaa`. **Aucun code du [§3] ne doit être recopié depuis le bac
à sable sans être confronté à HEAD** pour ces trois-là.

**5. Le commit `c806aaa` préempte partiellement [D-19].** Il replie le `-0` **dans l'algèbre**,
à `guards.ts:129` (`return value === 0 ? 0 : value` dans `requireFiniteResult`), et sa docstring
motive le geste par le formatage à venir — « *it stays invisible only while nothing formats it* ».
[D-19] survit avec un **motif rétréci** : le repli du formateur ne couvre plus que le `-0` porté
par les **données** de l'intégrateur, que le commit décline explicitement de réécrire. *Le compte
de parcours d'expression reste à **2** [vérifié], donc l'amendement d'`AGENTS.md` §3.B tient et la
prémisse de X-1 est intacte.*

**6. Le point faible connu, et il est nommé plutôt que caché.** Les quatre attaques ont relu le
contrat dans une forme **antérieure** à sa forme finale. Une **réattaque** a été menée sur le
contrat final pour cette raison précise — et elle a trouvé le blocage `C-1`, qui était le plus
grave du dossier. Mais **les corrections que la réattaque a imposées n'ont pas été réattaquées à
leur tour** : la scission de la validation de locale, la revalidation au rendu et la renumérotation
des refus sont **mesurées** mais **non contre-attaquées**. C'est la limite de ce plan, et le
premier endroit où regarder si quelque chose casse à l'exécution.

---

## 0. Le cadre : le contrat déclare une écriture, il n'en trace aucune

`@openview/core` **décrit**, il ne **produit** rien : aucune page, aucun pixel, aucun PDF. C'est la
phrase que les cinq plans précédents ont écrite en tête, et elle reste vraie ici — mais elle ne
suffit plus, et c'est le seul endroit du document où le dire coûte quelque chose.

**Car C6 est le premier lot dont le livrable est une fonction qui rend une chaîne qu'un lecteur
lira.** `formatMoney(1234.5, …)` rend `1 234,50 €`. Ce n'est pas un pixel, ce n'est pas une page, et
pourtant c'est **du document** : les caractères exacts qu'un client verra sur sa facture sortent
d'une fonction de `core`. Les cinq lots précédents n'ont jamais rien produit de tel — C1 des nombres,
C2 des nombres arrondis, C3 une structure, C4 une géométrie, C5 des **attributs** d'apparence que
personne ne peint. Un total valait `60` et rien ne disait comment l'écrire. Après C6, quelque chose
le dit, et ce quelque chose est dans `core`.

Trois conséquences en découlent, et les trois sont des difficultés propres au lot. Elles sont écrites
ici plutôt que découvertes au [§3].

**Première difficulté : la ligne « déclarer / produire » se déplace, et il faut dire où elle se
repose.** C5 avait tracé la sienne — *déclarer une police n'est pas la résoudre* — et elle tenait
parce que `core` ne pouvait mécaniquement pas résoudre une police : `packages/core` compile avec
`types: []` et `lib: ["ES2022"]`, donc `document`, `window` et `process` y sont des erreurs de
compilation. Cet argument **ne protège pas C6** : `Intl` est dans `lib: ["ES2022"]`, donc il est
atteignable, donc le compilateur ne tranchera rien. La ligne de ce lot est donc écrite à la main, et
la voici :

> **Une chaîne n'est pas une page.** `core` produit **la suite de caractères** qu'une valeur prend
> dans une écriture déclarée. Il ne décide ni de la police qui la peint (C5), ni de la place qu'elle
> occupe (C4), ni de son passage à la ligne, ni de sa direction d'écriture, ni de ce qui arrive quand
> elle est trop longue pour sa colonne. La chaîne est **complète et opaque** : le moteur la pose, il
> ne la recompose pas.

**Deuxième difficulté : c'est le premier lot dont on peut voir le résultat sans moteur** — et c'est
une bonne nouvelle qu'il faut immédiatement borner. Le playground exécute déjà `core` et affiche déjà
des chaînes issues des expressions ; le site exact est `apps/playground/src/App.tsx:848`, et il est
littéralement `String(value)` [vérifié]. Remplacer ce site par un appel aux trois formateurs du lot
change ce que la page imprime, **sans une ligne de moteur**. C'est un progrès réel, et le [§6] doit
dire ce qu'il ne prouve pas : la moitié **mécanique** du critère de recette (les mêmes chemins de
données, les mêmes valeurs numériques, deux chaînes différentes) devient démontrable ; la moitié
« deux documents **corrects** » (`docs/roadmap/core.md:261-262`) reste un jugement humain, et
`docs/roadmap/README.md:145` rappelle que la personne qui le porte n'est pas identifiée [cité].

**Troisième difficulté, et c'est la vraie : ce lot doit lire une bibliothèque de l'environnement dans
une brique construite pour être incapable d'en lire une.** `Intl` **est** ICU, ICU est livré avec le
binaire Node, et deux binaires n'en portent pas la même version. Toute la doctrine de déterminisme du
dépôt — l'interdit d'horloge, de fuseau, de locale système, d'aléa (AGENTS.md, « Ce qu'Openview n'est
pas ») — a été écrite pour rendre ce genre de lecture **inatteignable**. L'ADR 0003 va plus loin et
nomme ICU : `docs/adr/0003-formules-agregations-et-dates-civiles.md:285-289` écrit que `civil-date.ts`
ne fait que de l'arithmétique entière, « **aucun `Date`, aucun `Intl`, aucune horloge** », et que les
trois pièges classiques — dont « `Intl`/ICU dépendant de la version » — « ne sont pas évités, ils sont
rendus **inatteignables** » [cité].

**Ce lot rouvre ce que cette phrase avait fermé, et il ne peut pas ne pas le faire.** La distinction
qui le sauve est ancienne dans le dépôt et elle est outillée : *formater dans une locale que le
**modèle** déclare est permis ; lire celle de la **machine** ne l'est pas* (AGENTS.md, « Ce qui est
vérifié par une machine »). Elle reste juste, et elle ne suffit pas : une locale déclarée par le
modèle est **honorée par ICU**, donc la version d'ICU entre dans le résultat par la porte de
l'honorat, pas par celle de la lecture. C'est le blocage **C-1** de la réattaque, il est **mesuré**,
il a coûté un amendement à **D-06**, et il fait l'objet de l'arbitrage **A-3** qui remonte au
propriétaire du produit. Ce plan ne le cache pas en annexe : il ouvre dessus.

**Ce que le contrat ne fait toujours pas, et ne fera pas dans ce lot.** Il ne convertit aucune devise
— `docs/roadmap/core.md:266-268` l'interdit nommément, et l'interdit est le même que celui de la TVA.
Il ne réserve aucun nom de champ pour la langue, la devise ou « aujourd'hui » [D-03]. Il n'introduit
aucune horloge : `formatDate` reçoit une date civile fournie, jamais lue. Il ne traduit **aucun
libellé** — un libellé bilingue est déjà exprimable aujourd'hui, mesuré au [§1.2], et le lot n'ajoute
rien sur ce terrain. Et il ne peint rien : les attentes que le lot crée envers un moteur futur sont
nommées avec leur propriétaire au [§7], jamais dans une docstring de `core`.

---

## 1. Pourquoi C6, et pourquoi maintenant

> **Protocole de mesure de cette section.** Toutes les mesures ci-dessous ont été prises à
> **HEAD `c806aaa`** (« fix(core): fermer les switch d'operateurs et normaliser le zero negatif »,
> 2026-08-19 16:05 +0200), et non à `320bea6` comme l'annonçait le dossier de conception — **le dépôt
> a avancé d'un commit pendant l'instruction du lot** [mesuré : `git rev-parse HEAD`].
> `git status --porcelain` rend **exactement deux lignes**, `M .claude/launch.json` et
> `M apps/playground/vite.config.ts`, toutes deux d'outillage de prévisualisation et sans rapport
> avec ce lot [mesuré]. **Conséquence à connaître :** `320bea6..c806aaa` retire 10 lignes nettes à
> `apps/playground/src/App.tsx` (2 insertions / 12 suppressions, `git diff --stat`), donc **toutes
> les citations `App.tsx:NNN` du dossier de récolte sont décalées de −10** au-delà de la ligne 844.
> Le cas emblématique : `const fr` était cité `:1477`, il est à **`:1467`** [mesuré].
> Les chiffres marqués [mesuré] portent leur commande ; ceux marqués [déduit] sont de l'arithmétique
> sur deux mesures ; « non mesuré » apparaît en toutes lettres partout où il est la réponse juste.

### 1.1 Ce que la roadmap impose, et où elle se trouve réellement

`docs/roadmap/core.md:254-268`, **quinze lignes**, citées intégralement parce que c'est le seul texte
qui commande ce lot :

> ### C6. Langue, devise et formats
>
> **Pourquoi.** Décision structurante prise tôt : un même modèle doit produire une
> facture en français/euros et en anglais/dollars. Cela concerne les montants, les
> dates, les séparateurs de milliers, la position du symbole monétaire, et les libellés
> fixes du modèle.
>
> **Prêt quand** un unique modèle de facture produit deux documents corrects dans
> deux langues et deux devises, sans duplication du modèle.
>
> **Poids :** L — **Dépend de :** C2, C5
>
> > **Attention, ce lot ne fait pas de conversion.** Afficher « $ » n'est pas convertir
> > des euros en dollars : un taux de change est une donnée, et son choix appartient à
> > l'intégrateur — même règle que la TVA.

**⚠️ Avant toute chose : ces numéros de ligne ne sont pas ceux que le dépôt écrit.** Dix-neuf
citations `core.md:NNN` désignant C6 sont périmées, dont **deux ADR qui font foi** — la correction
**R-1** du [§7] les recense une par une. Le décalage n'est pas constant, et c'est pourquoi une
substitution globale serait fausse :

| Ce qui est désigné | Ligne citée dans le dépôt | **Ligne réelle à `c806aaa`** | Décalage |
| :--- | :--- | :--- | ---: |
| La section C6 entière | `core.md:186-200` | **`core.md:254-268`** | +68 / +68 |
| Le « Pourquoi » — les cinq objets | `core.md:186-196` | **`core.md:256-259`** | +70 |
| Le « Prêt quand » | — | **`core.md:261-262`** | — |
| `**Poids :** L — **Dépend de :** C2, C5` | `core.md:196` **et** `core.md:229` | **`core.md:264`** | +68 / **+35** |
| L'interdit de conversion | — | **`core.md:266-268`** | — |

[mesuré : `grep -n "^### C[0-9]\|Dépend de :" docs/roadmap/core.md`, puis lecture de chaque cible.]
Ce que désignent aujourd'hui les lignes figées : `core.md:186` ouvre la note « ✅ Livré » de **C4**,
et `core.md:229` est **au milieu de la note « ✅ Livré » de C5**. Aucune ne dit plus rien de C6.
**Deux ADR publiés pointent donc vers un texte qui parle d'autre chose**, et c'est une dette du dépôt
que ce lot hérite sans l'avoir créée.

**Quatre choses à relever dans ce libellé, parce qu'elles gouvernent tout le reste du plan.**

**Premièrement, l'énumération est le vrai périmètre, et non le critère.** Le « Pourquoi » nomme
**cinq objets** : *les montants, les dates, les séparateurs de milliers, la position du symbole
monétaire, et les libellés fixes du modèle*. C'est cette liste — et non le « prêt quand » — qui porte
la charge de justification de chaque champ du contrat. Le lot le suit sur quatre des cinq et
**refuse le cinquième**, et le refus est le geste le plus lourd de ce plan : **les libellés fixes ne
sont pas traduits par C6**, parce qu'ils sont **déjà exprimables sans lui** — mesuré au [§1.2], et le
[§7] nomme le propriétaire de ce refus. Les quatre autres se rangent proprement : les montants et les
séparateurs de milliers sont `formatMoney` / `formatDecimal`, la position du symbole monétaire est
une **conséquence de la locale** et non un champ (personne ne déclare « symbole à droite » : on
déclare `fr-FR`), et les dates sont `formatDate`.

**Deuxièmement, « deux documents corrects » est la moitié du critère que ce lot ne peut pas
mécaniser.** Le [§6] tranche qui juge. Et **A-2 / M-2** relève que ce critère est, *mot pour mot*,
celui d'E4 (`docs/roadmap/engine.md:82-83` : « toutes deux **correctes** ») alors que `core` ne rend
rien : la coupe juste est écrite deux lignes plus haut, **`engine.md:79-80`** — « *le contrat sait
décrire un modèle bilingue (core C6) ; le moteur doit **l'honorer*** » [cité ; le dossier écrit
`:78-79`, décalage d'une ligne, mesuré]. Le mandat M-2
demande de retirer « corrects » de `core.md`, **et l'attaque a montré qu'il devait aussi toucher
`engine.md`** — sans quoi B3 est déplacé et non résolu.

**Troisièmement, « sans duplication du modèle » est la seule contrainte dure de l'énoncé.** Elle
interdit qu'une seconde langue se déclare en fabriquant un second `Template`. C'est ce qui condamne
sans autre argument la branche « deux modèles jumeaux », et c'est aussi ce qui rend la moitié
« libellés » du critère **déjà satisfaite** aujourd'hui [§1.2].

**Quatrièmement, l'encadré « ce lot ne fait pas de conversion » est une instruction, pas un rappel.**
Il autorise le plan à refuser, et il l'oblige à écrire ses refus. Le [§7] en compte **trente-six**, et
la famille la plus peuplée est exactement celle-là : tout ce qui ressemble à un taux, une table de
change ou une échelle monétaire dérivée. **D-04** en est la conséquence la plus contre-intuitive du
lot : les deux bornes de fraction sont **toujours explicites**, ce qui rend la table CLDR
« devise → unités mineures » **inatteignable** — parce qu'une table qui décide que le yen n'a pas de
décimale est une règle monétaire, et Openview n'en écrit aucune.

Le lot sert le **jalon J1** : « une facture comptable complète, **en deux langues**, est **décrite**
dans un modèle » (`docs/roadmap/README.md:92`) [cité]. *Décrite* — jamais rendue. C6 est le dernier
lot de `core` qui porte le membre « en deux langues » de cette phrase.

### 1.2 L'écart est réel, il est visible à l'écran, et il est mesuré

C5 avait chiffré son écart par une absence : « le barrel expose 185 symboles, **aucun** ne nomme une
couleur ». Le même compte tient ici, et il est plus court à énoncer.

**Le barrel de `core` expose aujourd'hui 117 valeurs, et pas une seule ne nomme une langue, une
locale, une devise ou un format** [mesuré : `Object.keys(require('packages/core/dist/index.js')).length`
= **117** ; le filtre `/locale|currenc|format|Present|Intl|lang/i` sur ces 117 noms rend **une seule**
correspondance, `PAGE_BAND_OCCURRENCES`, qui est un faux positif sur `format`]. Le contrat du lot
porte ce compte à **126** [mesuré sur émission ESM réelle du bac à sable, `s6-corrections.md`].

Mais l'absence, ici, ne reste pas une absence : **elle s'imprime**. C'est ce qui distingue C6 des
cinq lots précédents, et les trois mesures ci-dessous sont l'argument entier de ce paragraphe.

#### La vitrine imprime de l'ISO dans une facture française, exactement comme l'ADR 0003 l'avait annoncé

`docs/adr/0003-formules-agregations-et-dates-civiles.md:275-281`, écrit il y a deux lots, en
prévision de celui-ci [cité] :

> ### `YYYY-MM-DD` est une représentation d'ÉCHANGE, pas un format d'affichage
>
> Comme `TextBindingSegment.value` accepte désormais `dateAdd`, un modèle imprimerait cette chaîne
> telle quelle : **jusqu'à C6, le playground puis le moteur afficheraient de l'ISO dans une facture
> française.** **C6 possède l'affichage** […]

**La prédiction s'est réalisée, et elle se mesure sans lancer de serveur.** Le nœud de texte `dates`
du modèle de facture (`apps/playground/src/App.tsx:543-556`) porte trois liaisons — l'échéance, le
« 45 jours fin de mois » et les jours de retard — et le playground les met en chaîne par
`rawSegments` (`:643-661`, `JSON.stringify`) puis par `runsDeSegments` (`:848`, `String(value)`).
En rejouant ces expressions **contre le `dist` de `packages/core`** avec le jeu de données réel de la
page [mesuré, `node p1-mesure-dates.cjs`] :

| Ce que la page affiche aujourd'hui | Ce que la même valeur donne sous le contrat du lot (`fr-FR`, `dateStyle: 'long'`) | et en `en-US` |
| :--- | :--- | :--- |
| `"2026-02-19"` | **19 février 2026** | February 19, 2026 |
| `"2026-03-31"` | **31 mars 2026** | March 31, 2026 |

La ligne complète, telle que la section « Dates » la rend :
`"Échéance " + "2026-02-19" + " — 45 jours fin de mois " + "2026-03-31" + " — jours de retard " + 19`
[mesuré]. **Guillemets compris** — c'est `JSON.stringify` d'une chaîne. La page le sait et le dit :
`apps/playground/src/App.tsx:753-754` écrit en toutes lettres « *les rendre en `31/03/2026`
appartient au lot C6* », et la docstring de `rawSegments` (`:636-638`) le répète. **Le dépôt attend
ce lot par écrit, à deux endroits, dans le fichier qui l'affiche.**

#### Les montants de la facture s'impriment nus, sans symbole, sans séparateur, sans décimale

Le nœud `totals` porte quatre liaisons calculées, et l'ADR 0003 cite nommément leurs quatre valeurs.
Rejouées contre le `dist`, puis passées par la stringification réelle de la page
(`App.tsx:848`, `String(value)`) [mesuré, `node p1-mesure-totaux2.cjs`] :

| | Chaîne produite |
| :--- | :--- |
| **Ce que la vitrine imprime** | `Total HT 60 — remise 6 — reste à payer 54 — prix moyen 20` |
| Sous le contrat, `fr-FR` / `EUR` | `Total HT 60,00 € — remise 6,00 € — reste à payer 54,00 € — prix moyen 20,00 €` |
| Sous le contrat, `en-US` / `USD` | `Total HT $60.00 — remise $6.00 — reste à payer $54.00 — prix moyen $20.00` |

**Une facture française qui imprime « 60 » pour soixante euros n'est pas une facture.** Et la
troisième ligne est le critère de recette lui-même : **le même objet `Template`**, **le même jeu de
données**, deux écritures.

#### Et surtout : une locale française est déjà codée à la main dans la vitrine

C'est la trace la plus concrète du trou, et c'est du code de production du dépôt.
**`apps/playground/src/App.tsx:1466-1467`** [cité] :

```ts
/** L'écriture française d'un nombre calculé, pour que la prose et le tableau concordent. */
const fr = (value: number): string => String(value).replace('.', ',');
```

**Un formateur de locale écrit à la main, avec un `replace` de virgule.** Trois sites l'appellent
(`:2120` deux fois, `:2123`, `:2130`), et ce qu'il *sait faire* est exactement : remplacer un point
par une virgule. Voici, mesuré, ce qu'il ne sait pas faire — les valeurs de la colonne de gauche
étant celles que la page lui passe réellement, obtenues en rejouant les trois modèles d'arrondi
contre le `dist` [mesuré, `node p1-mesure-totaux.cjs` et `p1-mesure-fr.cjs`] :

| Valeur | `fr()` imprime | `fr-FR`/`EUR` sous le contrat | Ce qui manque |
| :--- | :--- | :--- | :--- |
| `63.26` (modèle A, affiché `:2120`) | `63,26` | `63,26 €` | **le symbole monétaire** |
| `63.24` (modèle B, affiché `:2120`) | `63,24` | `63,24 €` | le symbole |
| `2.125` (ligne dyadique, affichée `:2123`) | `2,125` | **`2,13 €`** | **les deux bornes de décimales** — un montant à trois décimales |
| `1.125` (ligne dyadique, affichée `:2123`) | `1,125` | **`1,13 €`** | idem |
| `1234.5` | `1234,5` | **`1 234,50 €`** | **le séparateur de milliers**, la décimale de queue, le symbole |
| `0.1 + 0.2` | **`0,30000000000000004`** | **`0,30 €`** | tout, et l'échappement d'un artefact IEEE-754 dans un document |

**Quatre défauts, et le quatrième est le plus grave.** `fr()` ne connaît ni séparateur de milliers,
ni symbole monétaire, ni bornes de décimales ; il est **aveugle à la seconde langue** (il n'a pas
d'argument de locale : la francité est dans son nom, pas dans son code) ; et **il expose le double
brut** dès que la valeur n'est pas déjà arrondie. Sur la page d'aujourd'hui il ne le fait pas — les
montants qu'il reçoit sortent tous d'un nœud `round` à deux décimales, et c'est **par chance de jeu
de données**, non par construction. `fr(0.1 + 0.2)` rend `0,30000000000000004` [mesuré], et rien dans
la vitrine n'empêche qu'une ligne future y tombe.

**C'est l'analogue exact de ce que le plan C5 reprochait à l'état antérieur du même fichier** —
« une quinzaine de constantes CSS écrites en React, dont **aucune ne vient du modèle** ». Ici il n'y
en a qu'une, mais elle est pire : une constante CSS ne prétend pas parler français.

#### Ce que l'écart n'est PAS — la moitié « libellés » est déjà là, et le dire honnêtement

L'énumération du « Pourquoi » nomme cinq objets, et le cinquième est « les libellés fixes du
modèle ». **Il ne manque rien.** Mesuré, contre le `dist` de `packages/core`, sans une ligne de C6
[mesuré, `node p1-mesure-libelles.cjs`] : un `if` sur un chemin de langue, placé dans un nœud de
texte d'un `Template` **parsé** par `parseTemplate`, rend

```
chemins lus : ["rendu.langue"]
fr -> "Facture"
en -> "Invoice"
```

…**avec un seul et même objet `Template`**. Le §1.4 (d) en tire la conséquence, qui est
inconfortable et qui doit être écrite ici plutôt qu'enterrée : **une moitié du critère de recette de
C6 est satisfaite par le contrat livré à C1**.

### 1.3 Ce que C6 débloque, et ce qu'il ne débloque pas

**Il débloque E4, et il est le seul à pouvoir le faire.** `docs/roadmap/engine.md:79-80` :
« *Le contrat sait **décrire** un modèle bilingue (core C6) ; le moteur doit **l'honorer** : montants,
dates, séparateurs, symbole monétaire, libellés fixes* » [cité]. **Nuance mesurée, et elle compte
pour le §1.4 (a) :** E4 déclare « **Dépend de :** E3 » (`engine.md:85`) — **pas de C6** [mesuré :
`grep -n "Dépend de :" docs/roadmap/engine.md`]. Le lien C6 → E4 vit dans la prose du « Pourquoi »,
jamais dans une ligne de dépendance. **Le dépôt n'a donc jamais écrit noir sur blanc que C6 précède
E4** ; il l'a seulement supposé.

**Il débloque C8 et C9, mécaniquement.** `docs/roadmap/core.md:292` : C8 « **Dépend de :** C1 à C7 »
[cité] — donc C6 est en amont de C8, pas en aval, et le §1.4 (c) s'appuie sur cette ligne. C9
(« **Dépend de :** chaque lot ci-dessus », `core.md:302`) reçoit de C6 une entrée de migration de
plus, et ce lot la lui donne au format attendu — **estampille seule**, `CURRENT_SCHEMA_VERSION`
**6 → 7** [D-14].

**Il débloque la démonstration bilingue de la vitrine, et sans moteur.** C'est la deuxième difficulté
du [§0] : le site `App.tsx:848` devient un appel aux trois formateurs, et la page imprime `60,00 €`
là où elle imprime `60` [mesuré au §1.2]. **C'est le premier lot de `core` dont la vitrine puisse
montrer le livrable au lieu de le décrire.** Le [§4] en fait un incrément et le [§6] en fait un
critère.

**Il ne débloque AUCUN pixel, et l'état des deux paquets d'aval est mesuré, pas supposé :**

| Paquet | Contenu de `src/` | Lignes | Ce qu'il exporte |
| :--- | :--- | ---: | :--- |
| `@openview/engine` | `index.ts`, `index.test.ts` | **6** (`index.ts`) | `ENGINE_VERSION = '0.1.0'` |
| `@openview/viewer` | `index.ts` — **et rien d'autre** | **6** | `VIEWER_VERSION = '0.1.0'` |

[mesuré : `ls -R packages/viewer/src packages/engine/src`, `wc -l`, `cat`.] Après C6, un modèle saura
déclarer une écriture française et une écriture anglaise, et **rien ne les rendra**. C'est exactement
la réserve que C4 puis C5 ont écrite pour eux-mêmes, et elle se transpose mot pour mot.

**Il ne débloque pas non plus l'aperçu du viewer, et l'écrire évite une promesse fausse.** La chaîne
déclarée est longue : `docs/roadmap/viewer.md:58` donne V1 « **Dépend de :** moteur E5 », et
`engine.md` place E5 après E4 [mesuré]. Entre C6 et le premier aperçu affiché il y a donc **E1…E5**,
c'est-à-dire tout le moteur. Ce que C6 débloque du côté aperçu, ce n'est pas l'aperçu : c'est la
**garantie que l'aperçu et le PDF écriront le même montant** — parce qu'ils appelleront la même
fonction au lieu d'en écrire chacun une. C'est le motif de `mmFromPt` transposé, et le [§2] le
reprend comme motif d'appartenance.

**Il ne débloque pas C7, et c'est délibéré.** C7 « **Dépend de :** C4 » (`core.md:279`), pas de C6.
Rien de ce lot ne touche à l'insécabilité, et le [§7] refuse nommément d'y toucher.

### 1.4 Arguments contraires, examinés et écartés — dont un qui n'est PAS écarté

Cette sous-section est la plus utile du [§1], et le dépôt conserve les objections mortes avec leur
réfutation. **L'un des quatre arguments ci-dessous survit** : il est *déplacé*, pas réfuté, et il
remonte au propriétaire du produit.

#### (a) « C6 appartient au moteur, pas à `core` » — ⚠️ NON RÉFUTÉ, déplacé

C'est l'argument le plus fort du dossier, il a été soutenu par l'avocat du diable, et **il n'est pas
écarté ici.** Ses trois pièces sont vérifiées :

1. **La coupe officielle du dépôt le dit.** `core` **décrit**, `engine` **produit**
   (`engine.md:79-80`). Or le « Prêt quand » de C6 emploie le verbe d'`engine` : « *produit deux
   documents corrects* » (`core.md:261-262`), et c'est **mot pour mot** le critère d'E4
   (`engine.md:82-83`). C'est l'arbitrage **A-2 / M-2**.
2. **Le dépôt n'a jamais tranché lequel des deux formate.** `biome.jsonc:196-197` [cité] :
   « *banning `Intl` would also ban `Intl.NumberFormat('fr-FR')`, **which lots C6 and E4 need*** ».
   La configuration attend `Intl` **dans les deux lots**, et elle ouvre l'autorisation à
   `packages/core/**` **et** `packages/engine/**` (`biome.jsonc:198`) [vérifié].
3. **`core` est le paquet construit pour être incapable de lire l'environnement** — c'est l'ADR 0003
   cité au [§0]. Y placer ICU est le choix le plus coûteux des candidats possibles.

**La réfutation partielle, et il faut dire qu'elle est partielle.** Si `core` ne porte que la
déclaration et qu'`engine` porte le formateur, alors le formateur est écrit **deux fois** — une fois
dans `engine`, une fois pour l'aperçu — et la promesse d'« aperçu identique au PDF, garanti »
(décision produit 7, jalon J4) devient une promesse tenue par deux implémentations indépendantes.
C'est le précédent `mmFromPt` de C5, mesuré là-bas à **31,5 % de divergence entre deux écritures de
la même conversion**, et une divergence de formatage serait bien plus voyante qu'une divergence de
double.

**Mais cet argument n'établit pas que le formateur appartient à `core` : il établit qu'il appartient
à un endroit partagé par `engine` et `viewer`.** `core` est le candidat naturel — c'est la racine du
graphe de dépendances (AGENTS.md §2), donc le seul paquet que les trois consommateurs importent déjà
— et c'est aussi le plus cher, puisque c'est celui dont la pureté était une garantie et non une
commodité. **Verdict : l'attaque n'est pas réfutée, elle est déplacée.** Elle produit l'arbitrage
**A-3 / M-3**, qui remonte au propriétaire du produit avec deux citations à sa charge —
`ADR 0003:241` (« ni horloge, ni fuseau, ni locale, **ni ICU** ») et `ADR 0003:783-784`
(dépendre d'ICU « **casse E6 pour de bon** »). **Et le mandat M-3 doit être élargi :** le texte
proposé ne parle que des **chaînes** produites, alors que **C-1 démontre une dépendance de validité
d'entrée** — sur ICU 76.1, une table qui déclare `en-FR` faisait **refuser le document entier**
avant la correction.

#### (b) « C6 dépend de C5 » — l'affirmation de la roadmap est FAUSSE au sens mécanique

`docs/roadmap/core.md:264` écrit « **Dépend de :** C2, C5 ». **Les deux moitiés n'ont pas le même
statut, et la seconde ne survit pas à la mesure.**

| Dépendance déclarée | Réalité mesurée sur le contrat du lot |
| :--- | :--- |
| **C2** — les arrondis | ✅ **vraie, et matérielle.** `presentation/types.ts:1` importe `MAX_ROUND_DECIMALS` depuis `expression/types.js`, la constante livrée par C2 (`packages/core/src/expression/types.ts:149`, `= 15`). Les deux bornes de fraction de [D-04] s'y adossent plutôt que d'inventer un second plafond |
| **C5** — l'apparence | ❌ **fausse au sens mécanique.** `presentation/` compte **exactement deux imports hors dossier** — `../expression/civil-date.js` et `../expression/types.js` — et **aucun** ne vient de `style/` [mesuré : `grep -rn "from '\.\./" sandbox-FINAL/core/src/presentation/*.ts` rend 2 lignes] |

**Ce que C5 apporte tout de même, et il faut le nommer pour ne pas faire dire à la mesure plus
qu'elle ne dit : un PRÉCÉDENT, pas une dépendance.** Le dossier `presentation/` est calqué fichier
pour fichier sur `style/` — `types.ts` / `schemas.ts` / façade / `__tests__/` — et **six docstrings du
lot citent `style/` comme précédent méthodologique** : la coupure d'un `.check` à charge utile plutôt
qu'un `.refine` d'objet ([D-16], correction que **l'exécution de C5 a payée**), l'annotation d'un
schéma récursif, l'ordre du barrel imposé par Biome, le refus de replier deux cas en un. **Aucune de
ces six lignes n'est un `import`** [mesuré]. Un précédent se lit, il ne se compile pas.

**Et l'ordre reste le bon, pour une raison que la roadmap n'écrit pas.** C'est l'argument que le plan
C5 avait posé d'avance : « *C6 doit se brancher sur des positions de contenu existantes, et si C5 en
créait une seconde, C6 aurait **deux** endroits à traduire* ». C5 n'en a créé aucune — il n'a livré
que des attributs — donc le risque ne s'est pas matérialisé. **La dépendance déclarée était une
assurance, et elle n'a pas servi.** C'est un fait à connaître, pas un mérite à revendiquer ; il est
noté au [§7] comme correction possible de `core.md:264`, et **il n'appartient pas à ce lot de la
faire**.

#### (c) « C6 devrait passer après C8, pour que le refus soit compréhensible d'abord » — écarté, et la mesure est ce qui l'écarte

L'argument est sérieux dans sa forme générale : un lot qui multiplie les refus a intérêt à ce que le
mécanisme de refus lisible existe avant lui, sinon il livre vingt messages que C8 devra reprendre.
**Il tombe pour deux raisons, et la seconde est mesurée.**

**Premièrement, la roadmap l'interdit dans ce sens.** `core.md:292` : C8 « **Dépend de :** C1 à C7 »
[cité]. Inverser demanderait de réécrire la ligne de dépendance la plus large du document — celle
qui existe précisément pour que C8 voie **tous** les refus avant d'écrire les phrases.

**Deuxièmement, et c'est ce qui rend l'argument sans objet : le lot ne crée aucun code d'erreur.**
[mesuré] `packages/core/src/errors.ts` est **byte-identique** entre le dépôt et le bac à sable du
contrat (`diff` silencieux, 266 lignes), et **le dossier `presentation/` ne contient pas un seul
`throw`**. Les vingt refus au *save time* du lot sont des `ZodError` portés par les `path` et les
`message` que le schéma écrit — exactement la matière que C8 reprendra, et **rien** que C8 devrait
défaire. C4 et C5 avaient tenu la même ligne ; ce lot la tient aussi [D-11].

**Ce qui reste vrai de l'argument, et qui est reporté au [§7] plutôt qu'écarté :** les vingt messages
de refus du lot sont écrits **pour un développeur**, pas pour un non-développeur, et le [§7] les
inscrit nommément à l'inventaire que C8 héritera — avec C8 comme propriétaire, et non « personne ».

#### (d) « Il n'y a rien à faire : tout est déjà là » — VRAI pour la moitié CONTENU du critère, et il faut le dire en toutes lettres

C'est l'argument qui gêne le plus, et **il est mesuré vrai sur une moitié du critère de recette.**

Le « Prêt quand » demande « *un unique modèle de facture [qui] produit deux documents corrects dans
deux langues et deux devises, sans duplication du modèle* ». Sa moitié **contenu** — les libellés
fixes, cinquième objet du « Pourquoi » — **fonctionne aujourd'hui, sans une ligne de C6** :

```
$ node p1-mesure-libelles.cjs          # contre packages/core/dist, HEAD c806aaa
chemins lus : ["rendu.langue"]
fr -> "Facture"
en -> "Invoice"
un seul objet Template : true
```

[mesuré] Un `{ kind: 'if' }` sur un chemin de langue, dans un `Template` **parsé** par
`parseTemplate` : `collectTemplateDataPaths` rend `["rendu.langue"]`, `evaluateExpression` rend
`Facture` puis `Invoice` sur deux jeux de données, **avec le même objet `Template`**, et aucun
sous-arbre n'est dupliqué. La campagne de récolte l'avait mesuré **deux fois**, dont une contre un
`dist` reconstruit ; ce plan le remesure ici contre le `dist` publié. **Trois conditions du critère
sur quatre sont satisfaites par le contrat livré à C1.**

**Ce qui reste, et c'est tout le lot :**

| Ce que le critère demande | État sans C6 | Qui le comble |
| :--- | :--- | :--- |
| Libellés fixes en deux langues | ✅ **fait**, mesuré ci-dessus | C1 (`if`), déjà livré |
| Un seul `Template`, aucun sous-arbre dupliqué | ✅ **fait**, mesuré ci-dessus | C1 / C3, déjà livrés |
| Montants avec séparateur, symbole et décimales | ❌ la vitrine imprime `60` | **C6** [§1.2] |
| Dates lisibles plutôt qu'ISO | ❌ la vitrine imprime `"2026-02-19"` | **C6** [§1.2] |
| **Que le modèle DÉCLARE quelle écriture il veut** | ❌ **rien ne le permet** : 0 des 117 exports | **C6**, et c'est [D-01] |
| Deux documents « corrects » | — | revue humaine, non identifiée (`README.md:145`) |

**Et la cinquième ligne est le cœur du lot, pas la troisième.** Sans elle, un intégrateur pourrait
toujours écrire son formateur à la main — c'est exactement ce que fait `App.tsx:1467` — mais **rien
dans le modèle ne dirait qu'il est français**. `packages/core/src/ports/render.ts:27-28` publie
aujourd'hui, dans `main`, la phrase suivante [cité] :

> *Language and currency are a different matter entirely: **the template declares them** (roadmap
> core, C6). What is refused here is reading them off the machine.*

**La seconde moitié est vraie et outillée ; la première est fausse depuis qu'elle est publiée** —
aucun champ de `Template` ne déclare quoi que ce soit de tel [mesuré : 0 sur 117 exports]. [D-01]
n'ajoute donc pas une fonctionnalité : **il rend vraie une phrase que le dépôt publie déjà.**

#### (e) « Attendre qu'ICU soit épinglé, ou embarquer sa propre table CLDR » — écarté, et sur un coût plutôt que sur un goût

C-1 rend la tentation forte : si la version d'ICU peut changer un verdict, autant ne pas dépendre
d'ICU. Les deux formes de cette idée sont écartées, et les motifs ne sont pas les mêmes.

- **Épingler ICU** (`--with-intl=full-icu` figé, ou un `Intl` en dépendance npm) est **hors mandat**
  d'un lot de `core` : cela contraint le runtime de tout intégrateur, ce qu'un moteur *embarquable*
  ne fait pas. AGENTS.md §7 interdit d'ailleurs d'ajouter une dépendance sans justification en PR, et
  celle-ci pèserait des mégaoctets pour un lot dont le livrable tient en sept fichiers.
- **Embarquer une table** — séparateurs, positions de symbole, noms de mois — est refusé par le
  périmètre : ce serait « une table de règles embarquée », exactement ce que
  `docs/adr/0003-…:239-240` interdit à `civil-date.ts`, et il faudrait ensuite la maintenir pour
  toutes les locales du monde. Openview n'est pas une source de données (`README.md:17`), et une
  table CLDR recopiée en est une.

**Ce que le lot fait à la place, et c'est la correction C-1 :** il **scinde** la validation. La
**syntaxe** d'un tag (grammaire BCP-47, spécifiée par ECMA-402) est jugée au *parse* — verdict
identique sur toute machine, **mesuré : 31 789 tags acceptés et le même `sha256` d'ensemble sur ICU
77.1 et ICU 76.1, 0 divergence**. L'**honorat** (la donnée CLDR, qui dépend d'ICU) n'est jugé qu'au
*rendu* — **531 tags contre 529, divergence légitime et nommée**. Le critère de coupure est écrit
au [§2] : *un champ **stocké** ne peut être jugé que par un verdict identique sur toute machine*.

#### Verdict, et pourquoi maintenant

Cinq arguments instruits, **quatre écartés et un maintenu**. Le maintenu — (a) — ne conteste pas
que le lot doive être fait, ni qu'il doive l'être maintenant : il conteste **où** le formateur vit,
et il produit un arbitrage qui remonte, pas un report.

**Pourquoi maintenant tient en trois lignes vérifiées.** C2 est livré et le lot s'y adosse
matériellement. C5 est livré, et sa livraison a **fermé** le risque que la roadmap couvrait par la
ligne « Dépend de : C5 » — il n'a créé aucune seconde position de contenu à traduire. Et C6 est le
**dernier** lot de `core` qui porte le membre « en deux langues » du jalon J1 : tant qu'il n'est pas
livré, J1 n'est pas prononçable, et E4 n'a rien à honorer.

---

## 2. Ce qui est décidé, et ce que ça engage

> **Forme imposée du dépôt**, pour chacune : `**Décision.**` à l'indicatif, sans conditionnel ·
> `**Pourquoi.**`, le motif tel qu'il s'écrit **avant** la décision, avec ses mesures et leur
> commande · `**Écarté.** (a) … (b) … (c) …`, chaque branche avec le motif de **son** rejet ·
> `**Réversible**` / `**Irréversible**`, avec le **signal de réouverture** quand il en a un.
>
> **Vingt-deux décisions**, plus une vingt-troisième née de la réattaque (`D-06b`) qui
> n'appartient pas à ce lot mais que ce lot crée. Le décompte se lit ainsi : **D-01 à D-03** le
> canal — où la déclaration vit et qui la sélectionne ; **D-04 et D-05** les nombres et l'échelle ;
> **D-06, D-06b, D-07, D-08** la validation et ses deux portes ; **D-09 et D-10** les trois options
> épinglées ; **D-11 à D-13** la politique d'erreur, la surface et le défaut ; **D-14** l'estampille ;
> **D-15 à D-20** les six décisions de mécanique fine que l'exécution a imposées ; **D-21 et D-22**
> l'horloge absente et le nom du dossier.
>
> ⚠️ **Aucune de ces décisions ne s'accorde de dérogation à `AGENTS.md`.** Trois textes du dépôt
> doivent être amendés pour que le lot soit livrable — `docs/roadmap/core.md:261-262`,
> `docs/roadmap/engine.md:82-83`, `docs/adr/0003-…:241-242` et `:783-784` — et les trois sont
> portés en **arbitrage ⛔** au §7, jamais consommés en silence ici.
>
> ⚠️ **Deux décisions ont été RÉÉCRITES après une réattaque du contrat déjà mesuré**, et elles
> portent la trace de leur première rédaction plutôt que de la cacher : **D-06** est amendée
> (la validation de locale est scindée en deux portes), **D-07** est confirmée et *renforcée* par
> un contre-exemple qu'aucune des trois conceptions concurrentes n'avait produit. La version
> initiale de D-06 est conservée dans son propre développement, **avec la mesure qui l'a tuée** :
> c'est cette mesure qu'on relira le jour d'une réouverture, pas la décision finale.

---

### 2.0 La faiblesse du lot, écrite en tête : le contrat livre un VERBE, et jamais la liste des SITES

C5 avait ouvert son plan sur « zéro invariant croisé, donc une surface de refus strictement plus
faible que C4 ». La faiblesse de C6 est d'une autre nature, et elle est plus grave : elle n'est pas
une surface de refus manquante, c'est **une moitié du critère de recette que `core` ne peut pas
atteindre**, et le motif en est le périmètre lui-même.

**Le fait, en une phrase.** Le formatage étant livré comme une **fonction** — ni champ de segment,
ni kind d'expression, ni type de colonne — **rien dans le document stocké ne distingue un numéro de
commande d'un total.** `commande.numero` vaut `20260014` et se lie **brut** dans la vitrine
[vérifié, `apps/playground/src/App.tsx`] ; une écriture appliquée sans discernement à tous les
nombres imprimerait `20 260 014`, qui désigne **une autre commande**.

**Et Openview ne peut pas refermer ce trou sans se renier.** Reconnaître un total supposerait de
reconnaître un nom de champ, c'est-à-dire de réserver un nom que l'intégrateur n'a pas choisi. Le
test de périmètre d'`AGENTS.md` tranche sans appel : « *si une fonctionnalité oblige l'intégrateur à
nommer un champ comme Openview l'a décidé, elle est à refuser* » [cité]. **La faiblesse est donc une
conséquence du périmètre, pas une négligence** — ce qui ne la rend ni moins réelle ni moins coûteuse
pour le lot qui en héritera.

Trois conséquences, et il faut les écrire ensemble parce qu'elles se soutiennent :

| Conséquence | Ce qu'elle coûte | Héritier |
| :--- | :--- | :--- |
| **Le critère de recette de `core.md:261-262` n'est pas démontrable par `core` seul** | C6 démontre : *une valeur, deux écritures déclarées, deux chaînes différentes portant les mêmes chiffres, depuis un seul objet `Template`*. Il ne démontre **pas** : *une facture français/euros et une facture anglais/dollars* | **arbitrage produit (A-2 / M-2)** — la coupe juste est déjà écrite par le dépôt, `engine.md:78-79` : « *le contrat sait **décrire** un modèle bilingue (core C6) ; le moteur doit **l'honorer*** » [cité] |
| **Le câblage valeur par valeur revient au moteur** | E4 devra décider, site par site, quelle valeur passe par quel formateur, sans que le document l'y aide | **lot E4** (attente **E4-1**) |
| **Le remède est daté, chiffré, et son report est ACTÉ** | Un **champ optionnel sur un segment** : classe *perte silencieuse*, donc **une estampille et une migration d'estampille** — la modification la moins chère que ce dépôt connaisse. Le kind d'expression, lui, aurait été **irréversible**. ⛔ Le chiffrage se retourne (R-17) : ce lot dépense déjà `6 → 7`, donc le champ y monterait **gratuitement**, et c'est **différer** qui coûte. ✅ **A-5 a tranché : différé** — l'estampille est gratuite, les deux champs d'AST, les deux paires de clés, les fixtures et le premier invariant croisé du lot ne le sont pas. **E4 paiera `7 → 8`** | ✅ **tranché (A-5)** → **lot E4**, coût `7 → 8` **acté** |

**Ce que la faiblesse n'est PAS, et il faut le dire aussi net que le reste.** Elle n'est pas un
argument pour rouvrir le kind `format`. Le refuser reste **gratuit**, et c'est mesuré :
`grep -c "concat(" apps/playground/src/App.tsx` rend **0** [mesuré] — aucun `concat` n'enfouit dans
le seul consommateur réel une valeur qu'il faudrait formater. On ne prend pas aujourd'hui la seule
décision irréversible du dossier pour un besoin dont l'unique instance connue vaut zéro.

#### La deuxième faiblesse, moins grave et plus visible : la cardinalité

Le contrat pose « **une entrée = une écriture complète** » : locale, devise, deux bornes, style de
date, cinq champs tous requis. Un modèle qui écrit des **montants** (2 décimales), des **quantités**
(0 décimale) et des **prix unitaires** (4 décimales) en **deux langues** déclare donc **six**
entrées, dont quatre répètent la même locale et la même devise.

C'est verbeux, et c'est assumé. Trois raisons, dont deux sont des mesures :

1. **Une écriture partielle rouvrirait l'héritage.** Si `minFractionDigits` pouvait manquer, il
   faudrait un défaut ; le seul défaut plausible est la table CLDR devise → unités mineures ; et
   cette table est un **arrondi**, que la décision 16 d'ADR 0004 donne au modèle. [mesuré] sur
   `1234.5678` en `fr-FR` : `JPY` rend `"1 235 JPY"` — **des chiffres disparaissent** — et `TND`
   rend `"1 234,568 TND"`.
2. **`currency` est requis même dans une écriture qui n'imprime jamais d'argent.** C'est une verrue
   avouée : elle coûte trois lettres par entrée et achète l'**univocité de l'absence** — un
   `undefined` de `formatMoney` n'a jamais pour cause « cette écriture n'avait pas de devise ». Un
   relecteur qui préfère `currency?` a un argument réel ; il paie une seconde cause d'`undefined`.
3. **L'ergonomie est un manque, pas une décision.** Un panneau qui édite une table d'écritures, un
   sélecteur d'écriture dans l'aperçu, un avertissement quand un modèle déclare une table que rien
   ne consomme : **rien de tout cela n'est instruit ici.** *Héritiers : lots D1/D5 (Designer)*, et
   ils l'apprennent par ce paragraphe.

#### 🆕 La quatrième, découverte par la revue externe : DEUX sélecteurs indépendants

**Un document bilingue a deux commutateurs, et rien ne les lie.**

| Ce qui bascule | Par quel canal | Qui l'actionne |
| :--- | :--- | :--- |
| **Les mots** — `Facture` / `Invoice` | un `if(eq(path('rendu.langue'), 'fr'), …)`, livré par **C1** | une **donnée** du jeu de données |
| **L'écriture des valeurs** — locale, devise, décimales, date | le **nom** passé à `resolvePresentation`, livré par **ce lot** ([D-02]) | un **argument d'appel** |

**Conséquence, et elle est produit avant d'être technique :** un appelant peut demander l'écriture
`en-USD` en laissant `rendu.langue = 'fr'`, et obtenir **des libellés français avec des montants en
dollars**. Aucune porte ne le voit — ni le parse (les deux déclarations sont valides séparément),
ni le rendu (les deux mécanismes réussissent), ni un test (il n'existe pas d'invariant à écrire, la
table de correspondance appartiendrait à Openview).

**Ce n'est PAS un argument pour unifier les deux canaux**, et il faut le dire aussi net : dériver le
nom d'écriture d'une expression déclarée par le modèle ajouterait une **forme stockée**, rouvrirait
« d'où vient la clé » que [D-02] ferme, et remettrait à Openview le soin de décider **quand** deux
déclarations se contredisent — c'est-à-dire une règle métier. C'est l'arbitrage **A-6**, et sa
recommandation est de **laisser les deux canaux séparés en le DISANT**, pas de les coudre.

**Ce que le lot doit donc livrer en plus, et c'est peu :** la façade [§3.6] nomme cette divergence
comme une **obligation d'intégration** — au même titre que `E4-10` — et le [§6.4] la met en scène à
l'écran plutôt que de la masquer. C'est l'attente **`E4-11`**.

#### La troisième, doctrinale : ce contrat dépend d'ICU, et une ADR acceptée dit qu'il ne le doit pas

⛔ **Deux citations ont été RECTIFIÉES ici, et la rectification change la cible de l'arbitrage
(R-10).** Le dossier écrivait que **la brique** « *ne lit rien de l'environnement — ni horloge, ni
fuseau, ni locale, ni ICU* ». [vérifié, `docs/adr/0003-…:238-242`] **le sujet de cette phrase n'est
pas la brique** : c'est « *une opération de date* », et la phrase est la **condition 2 du critère
d'admissibilité dans l'algèbre d'expressions**. De même, `:783-784` a pour sujet
`toLocaleUpperCase`, une **opération de l'algèbre**, et non un usage quelconque d'ICU.

**Conséquence : C6 n'ajoute aucune opération à l'algèbre, donc il ne viole ni l'une ni l'autre.**
`AGENTS.md` autorise d'ailleurs explicitement `Intl.NumberFormat('fr-FR')` et
`Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })` littéral, « *parce que C6 et E4 en ont
besoin* ». **L'amendement d'ADR 0003 reste utile — c'est une clarification, et une phrase qu'on
lit comme une règle de brique doit cesser de pouvoir se lire ainsi — mais il n'est PAS une
dérogation, et ce n'est pas lui qui bloque.**

**Ce qui bloque réellement, c'est E6**, dont l'énoncé est bien, lui, au niveau de la brique :
`docs/roadmap/engine.md:100-105` promet « *le même document, **au caractère près*** » entre deux
machines. **Ce contrat dépend d'ICU.** Il en dépend de la façon la plus contrainte qu'on ait su écrire —
locale déclarée par le **modèle**, trois options épinglées en littéral, deux bornes explicites,
aucune chaîne formatée figée dans un test — mais il en dépend, et la dépendance a **trois** effets
mesurés, dont deux que la première rédaction du dossier n'avait pas vus :

| Effet | Mesure | Portée |
| :--- | :--- | :--- |
| Les **chaînes** produites diffèrent entre builds | `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0** avant le symbole ; le U+202F est arrivé avec **CLDR 42 / ICU 72** [mesuré] | typographie |
| L'ensemble des locales **honorées** diffère entre builds | **531** contre **529** sur 31 846 tags ; divergents : `en-FR` et `cls` [mesuré, ICU 77.1 et 76.1, deux binaires réels] | rendu — **absence nommée**, E4-8 |
| La **canonicalisation** elle-même diffère | `'cls'` → `'sa'` / `'cls'` ; `'nbx'` → `'gll'` / `'ekc'` [mesuré] | rendu |

**Ce qui reste vrai, et c'est la garantie que le lot offre réellement :** *deux rendus du même
document par le même build produisent la même chaîne* ; **et la validité d'un document stocké ne
dépend d'aucun build** — [mesuré] ensemble accepté au parse **identique au SHA-256 près** sur
31 846 tags, sur les deux ICU. Cette seconde propriété n'était **pas** vraie dans la première
rédaction du contrat : c'est exactement ce que la scission de D-06 a été écrite pour obtenir, et
c'est le seul défaut du dossier qui ait mérité d'être qualifié de bloquant.

**Héritier : le propriétaire du produit (mandat M-3, ⛔).** L'amendement d'ADR 0003 doit couvrir les
**trois** effets, et non la seule typographie : le texte proposé au §7 le dit, après avoir été
élargi une fois.

---

### Vue d'ensemble — les vingt-deux décisions, leur réversibilité, et qui hérite de leur refus

Un lecteur doit pouvoir décider ici, en une page, s'il est d'accord. La colonne « héritier » nomme
le lot ou la personne qui reçoit **ce que la décision refuse** ; « — » signifie que le refus est
définitif et n'a pas d'héritier, ce qui est le cas le plus fréquent et le plus sain.

| # | Décision | Forme stockée ? | Réversible ? | Héritier de ce qu'elle refuse |
| :-- | :--- | :--- | :--- | :--- |
| **D-01** | La table vit sur **`Template`**, jamais sur `RenderRequest` | **oui** | avec migration | — (le troisième champ est refusé par une docstring publiée) |
| **D-02** | L'appelant sélectionne par **ARGUMENT**, jamais par lecture de machine | non | oui (signature) | **lot E4** (E4-4) : d'où vient la clé |
| **D-03** | L'espace de noms des clés appartient à l'**AUTEUR** du modèle | **oui** | oui | — |
| **D-04** | Les **deux** bornes de fraction sont **toujours** explicites | **oui** | avec migration | — (la table CLDR devient inatteignable, pas seulement inutilisée) |
| **D-05** | Le maximum est **déclaré**, jamais dérivé : `scaleOf` **n'est pas écrit** | non | oui | — ; **X-1 dissous** |
| **D-06** | ⛔ **AMENDÉE** — la validation de locale est **scindée** : grammaire au parse, honorat au rendu | **oui** | oui | **produit (A-1)**, tranché « refus au rendu », à entériner |
| **D-06b** | 🆕 Une locale n'est plus refusée **à la frappe** : le Designer **avertit** | non | oui | **lots V / Designer** |
| **D-07** | Le refus du `-u-` est une condition **à part entière**, sur la forme **canonique** | **oui** | oui | — |
| **D-08** | La devise est validée par la **FORME**, jamais contre un registre | **oui** | oui | **intégrateur** (la conformité ISO 4217) |
| **D-09** | **Trois** options épinglées : `timeZone`, `calendar`, `numberingSystem` | non | oui | — |
| **D-10** | `calendar` épinglé **en dur** ; `numberingSystem` épinglé **aujourd'hui** | non | avec migration | **produit (M-4)** : une facture arabe ou persane |
| **D-11** | **Zéro** code d'erreur nouveau, **zéro** site nouveau | non | — | **lot C8** (qui hérite des messages) |
| **D-12** | Les prédicats de locale ne sont **pas exportés** du barrel | non | oui | — |
| **D-13** | `presentations` est **optionnel**, **sans défaut** — l'inverse de ce que la v5 a fait pour `page` | **oui** | avec migration | — (« il n'existe pas de devise qui existe partout ») |
| **D-14** | `CURRENT_SCHEMA_VERSION` **6 → 7**, **estampille seule** | **oui** | ⛔ **irréversible** | — |
| **D-15** | **`Object.hasOwn`** sur la lecture de la table | non | oui | — |
| **D-16** | **Deux** prédicats d'objet, tous deux **à coupure**, en `.check` à charge utile | non | oui | — |
| **D-17** | `MAX_FRACTION_DIGITS` est **importé** de `MAX_ROUND_DECIMALS`, jamais réénoncé | **oui** (la borne) | avec migration | — |
| **D-18** | **Aucune** annotation `z.ZodType<T>` sur aucun schéma de ce dossier | non | oui | — |
| **D-19** | Le **zéro négatif exact** est replié, et lui seul | non | oui | — |
| **D-20** | **Aucun** `roundingMode` passé à ICU | non | oui | **lot E4** (E4-2 : arrondir PUIS formater) |
| **D-21** | **Pas un seul objet `Date` construit** — `dayNumberOf(v) × 86 400 000` | non | oui | — |
| **D-22** | Le dossier s'appelle **`presentation/`**, et non `format/` | non | oui | — |

**Deux lectures de ce tableau valent d'être faites à voix haute.**

**Une seule décision est irréversible, et c'est l'estampille.** `D-14` est prise **maintenant**
parce qu'`AGENTS.md §1.2` écrit que « *cette décision est irréversible dès le premier template
client* » [cité] et que la reporter est le seul geste que le dépôt qualifie de non rattrapable.
Toutes les autres sont réversibles, quatre d'entre elles au prix d'une migration — c'est-à-dire au
prix du mécanisme que `D-14` installe précisément. **`D-14` est donc ce qui rend les vingt et une
autres réversibles**, et c'est l'argument le plus court en sa faveur.

**Neuf décisions sur vingt-deux ne créent aucune forme stockée.** Elles décident d'une mécanique
(`D-15`, `D-16`, `D-19`, `D-21`), d'une politique (`D-11`, `D-20`), d'une surface (`D-12`, `D-18`)
ou d'un nom (`D-22`). Aucune de celles-là ne peut coûter un jour de migration : elles se
réécrivent dans un commit. C'est délibéré — **le dossier a poussé le maximum de décisions hors de
la forme stockée**, et la forme stockée qui reste tient en cinq champs et un `Record`.

---

### Les trois blocages dissous, et la démonstration de chacun

Trois questions ouvertes par la récolte et par les relectures adverses sont **refermées par ce
contrat**, et non renvoyées. Un relecteur voudra vérifier celles-là en premier, parce qu'un blocage
qu'on dit dissous est le lieu où un dossier ment le plus facilement. Les trois démonstrations sont
donc données ici en entier, avec ce qu'il faut pour les contredire.

#### X-3 — Aucun canal de langue n'est ouvert, parce que le seul canal ouvert est celui que la docstring publiée exige déjà

**Le blocage, tel qu'il était posé.** Openview ne lit ni horloge, ni fuseau, ni locale système.
Formater exige pourtant de savoir *dans quelle langue*. D'où vient cette information sans qu'un
canal d'environnement s'ouvre ?

**La citation intégrale, parce que le dossier l'avait lue à moitié.** [cité]
`packages/core/src/ports/render.ts:23-29` :

```
 * There is no third field on purpose. No clock, no *system* locale, no ambient
 * context: "today" is a datum like any other, supplied under whatever name the
 * caller chose. That is not a naming convention Openview imposes -- it falls out of
 * the determinism the engine owes (roadmap engine, E6): a renderer that reads the
 * machine clock cannot produce the same document twice. Language and currency are a
 * different matter entirely: the template declares them (roadmap core, C6). What is
 * refused here is reading them off the machine.
```

Cette phrase a **deux** moitiés, et une conception concurrente du dossier n'en avait retenu qu'une.
La moitié **négative** — « *What is refused here is reading them off the machine* » — autorise un
argument d'appel. La moitié **affirmative** — « ***the template declares them*** *(roadmap core,
C6)* » — exige que le **modèle** porte la déclaration. Une conception qui ne stocke rien et fait
tout arriver par arguments respecte la première **en contredisant la seconde**, dans un fichier
publié en `dist/**/*.d.ts`. C'est ce qu'une relecture adverse a qualifié de bloquant, et elle
avait raison.

**Le contrat honore les deux moitiés, et c'est pour cela que rien ne s'ouvre :**

| Moitié de la phrase | Ce que le contrat fait |
| :--- | :--- |
| « *the template declares them* » | **D-01** — `Template.presentations?: PresentationTable`, une table **stockée**, **versionnée**, **migrée**. Le modèle est auto-suffisant à la lecture : ouvrir le document suffit à savoir dans quelles écritures il peut être rendu |
| « *What is refused here is reading them off the machine* » | **D-02** — la **sélection** est un argument de fonction, `resolvePresentation(table, writing)`. Pas de troisième champ, pas de clé dans `data`, pas d'option d'évaluation, aucun appel qui interroge l'hôte |

**Les trois canaux fermés le restent, et chacun pour son propre motif — ce ne sont pas trois fois
le même refus :**

| Canal refusé | Motif du refus | Statut |
| :--- | :--- | :--- |
| **`RenderRequest.presentation?: string`** (un troisième champ) | La docstring écrit « *There is no third field **on purpose*** ». Un lot de `core` qui ajoute le champ qu'un fichier de `core` déclare refuser publiquement n'amende pas une décision : il la contredit sans l'instruire | fermé, **sans héritier** |
| **Une clé réservée dans `RenderRequest.data`** (`data.__locale`, `data.rendu.langue`…) | Réserverait un nom dans un espace qui appartient à l'intégrateur. `AGENTS.md §1.2` : `RenderRequest.data` est « *un sac opaque de clés que l'appelant nomme* » [cité] et n'aura jamais de schéma | fermé, **sans héritier** |
| **`EvaluationOptions.presentation`** | Serait exactement le « troisième entrant d'évaluation » que `packages/core/src/ast/types.ts:67-71` déclare **publiquement** que `core` ne prend pas : « *`core` gains no third evaluation input, no page-aware operand and no reserved key in the caller's data* » [cité] | fermé, **sans héritier** |

**Pourquoi le canal retenu, lui, n'ouvre rien.** Trois propriétés, et la troisième est celle qui
compte :

1. **C'est un argument de fonction, donc il n'est pas ambiant.** Il ne se lit nulle part ; il est
   fourni, à un appel, par un appelant qui l'a choisi.
2. **Il ne nomme aucun champ de données.** La clé d'écriture est un nom que l'**auteur du modèle**
   a écrit dans sa propre table (**D-03**) ; Openview ne lui impose ni `"default"`, ni `"fr"`, ni
   aucune convention.
3. **Il n'introduit aucune valeur que le document ne porte pas déjà.** L'argument ne dit pas *quelle
   langue* : il dit *quelle entrée de la table que ce document contient*. Un appelant qui passe un
   nom non déclaré n'obtient pas une langue par défaut, il obtient `undefined` — et
   l'`undefined` est une **absence nommée** (E4-8), pas un repli.

> **Le test qui tranche, et il est mécanique :** *un canal ouvre l'environnement si, en changeant
> de machine sans changer ni le document ni l'appel, la sortie change.* Ici, le document porte la
> table, l'appel porte le nom, et la seule chose qui reste à la machine est **quel jeu CLDR elle
> embarque** — ce que la troisième faiblesse du §2.0 nomme, chiffre et remonte en arbitrage plutôt
> que de le taire.

**Ce que X-3 laisse ouvert, et qui n'est pas de C6 :** *d'où l'appelant du moteur tire-t-il le nom
de l'écriture ?* La réponse appartient à **E4** et à l'**intégrateur** (attente **E4-4**), et la
seule chose que C6 en dit est ce qu'elle **ne doit pas** être : ni une lecture de machine, ni une
clé réservée dans `data`.

---

#### M-1 — Deux promesses jugées conjointement insatisfiables le deviennent par UN dispositif, parce que ce dispositif n'est ni un champ ni un kind

**Le blocage, tel que la critique l'avait construit.** Il est le plus fort du dossier, et il se
démontrait en deux moitiés dont chacune éliminait une branche.

**Moitié A — une valeur enfouie dans un `concat` est inatteignable par un format porté par le
segment.** [vérifié] `evaluateConcat`
(`packages/core/src/expression/evaluator/operations/text.ts:26-49`) passe **chaque partie** par
`requireText`, et `requireText` (`packages/core/src/expression/evaluator/guards.ts`) **refuse un
nombre** :

```ts
export function requireText(value, site, at): string | undefined {
  if (isAbsent(value)) return undefined;
  if (typeof value !== 'string') {
    return fail({ code: 'operand-type', … },
      `Joining and case folding operate on text, got …. Wrap a number in text(...) rather than relying on a coercion the algebra refuses.`);
  }
  return value;
}
```

Conséquences mécaniquement forcées : un montant dans un `concat` est **obligatoirement** enveloppé
dans `text(...)`, donc mis en chaîne par `String(raw)` **avant** que le segment n'existe ;
`dateAdd(d, 30)` rend une **chaîne** ISO, donc `concat('Échéance ', dateAdd(d, 30))` ne présente au
segment qu'un texte, sans date à formater ; et `if(c, montantA, montantB)` ne montre au segment que
le résultat, jamais les branches. **Un champ `format` posé sur le segment ne voit rien de tout
cela.**

**Moitié B — un `pageField` ne porte aucune `Expression`, donc un kind d'expression ne peut pas
l'atteindre.** [vérifié] `packages/core/src/ast/types.ts:97-107` :

```ts
export interface TextPageFieldSegment {
  readonly kind: 'pageField';
  readonly field: PageField;
  readonly typography?: Typography | undefined;
}
```

Et la promesse à honorer, [vérifié] `packages/core/src/ast/types.ts:92-95` : « *the display
**FORMAT** of that value — language, digits, "sur" against "of" (lot **C6**)* ». Le `pageField` est
résolu par le pipeline de rendu, **jamais** par `evaluateExpression` — c'est la décision B de
l'ADR 0006. **Un kind d'expression de formatage ne peut donc pas atteindre un numéro de page.**

**La jonction, qui était le blocage :** la moitié A élimine le champ-sur-segment, la moitié B
élimine le kind-d'expression. **Aucun des deux mécanismes envisagés n'honore les deux promesses.**
La critique en concluait — et c'était juste, sous ses prémisses — que C6 devait livrer **deux**
dispositifs, ou **décliner nommément** l'une des deux promesses.

**Ce que le contrat répond, et pourquoi ce n'est pas une esquive.** Il livre **un seul** dispositif,
qui n'est **ni** un champ **ni** un kind : **une fonction**, appliquée au moment du rendu, à une
valeur déjà produite.

| Promesse | Champ sur segment | Kind d'expression | **Une fonction** |
| :--- | :---: | :---: | :---: |
| Formater un montant enfoui dans un `concat` | ❌ le segment ne voit qu'un texte | ✅ | ✅ le moteur formate **avant** de composer |
| Formater une date rendue par `dateAdd` | ❌ | ✅ | ✅ |
| Formater le numéro d'un `pageField` | ✅ | ❌ aucune `Expression` à décorer | ✅ le moteur formate la valeur que E2/E3 lui donnent |
| Ne rien élargir dans une union **stockée** | ✅ | ❌ **irréversible** | ✅ **rien n'est élargi du tout** |

**Une fonction atteint les deux parce qu'elle n'est accrochée à rien.** Le champ-sur-segment échoue
parce qu'il est accroché au **segment**, qui arrive trop tard dans la chaîne ; le kind échoue parce
qu'il est accroché à l'**algèbre**, où le `pageField` n'entre jamais. La fonction n'a pas de point
d'accrochage : elle prend une valeur et une écriture, et rend une chaîne. C'est précisément
pourquoi elle traverse les deux barrages — et c'est aussi, exactement, **pourquoi elle ne sait pas
quels sites formater**, ce que le §2.0 écrit comme la faiblesse du lot. **Le blocage n'est pas
esquivé : il est payé, une fois, en E4-1.**

**Vérification indépendante de la moitié « langue », et elle est plus favorable qu'annoncé.**
L'ADR 0006 avait choisi son mécanisme B en écrivant qu'il « ***offre C6 gratuitement*** »
[cité, `docs/adr/0006-la-page.md:569-572`]. Le cadeau est **réel, et il porte sur la langue seule** :
« Page », « / », « sur », « of » ne sont **pas** dans le `pageField`, ce sont des segments `literal`
et `binding` **voisins** du même `TextNode`. Un `binding` portant
`if(eq(path('rendu.langue'), 'fr'), 'sur', 'of')` les rend dans les deux langues **depuis un seul
objet `Template`** — c'est le mécanisme de **C1, déjà livré**, mesuré deux fois dans le dossier
dont une contre un `dist` reconstruit à HEAD. **C6 n'ajoute rien ici.** Le cadeau ne porte en
revanche **pas** sur les chiffres : le lot doit créditer l'ADR 0006 pour ce qu'elle a donné, et ne
pas s'en réclamer pour ce qu'elle n'a pas donné.

**Et la conséquence de méthode, qui vaut pour tout le lot :** puisque « sur » / « of » se traduit
par un `if`, **aucun catalogue de libellés n'est nécessaire nulle part** — ni pour la page, ni pour
un en-tête de tableau, ni pour un report de page. Un catalogue devrait réserver des noms de clés,
ce que la règle de périmètre interdit ; et le `if` fait une chose qu'une table de traductions ne
fait pas : il **réordonne** (`Facture n° 14 — ACME` contre `ACME — Invoice no. 14`).

---

#### X-1 — Le seuil du Visitor n'est pas franchi, et la différence entre « dissous » et « contourné » est morale autant que technique

**Le blocage, tel qu'il était posé.** `AGENTS.md §3.B` amendé par l'ADR 0004 laisse les deux
parcours de l'algèbre d'expressions en `switch`, **à condition** qu'ils se terminent par
`const exhaustive: never = expression`, et fixe un **seuil de retrait** : l'apparition d'un
**troisième** parcours. Le seuil est surveillé mécaniquement [cité,
`docs/adr/0004-…:726-728`] : `git grep -n "case 'round':" -- packages/core/src | wc -l` doit rendre
**2**. La question posée à C6 était : *le formatage d'un nombre a-t-il besoin de connaître l'échelle
déclarée par une expression `round`, donc d'un troisième parcours ?*

**La réponse du contrat, et elle n'est pas une orthographe.** **`scaleOf` n'existe pas.
`declaredScaleOf` non plus.** Ni en `switch`, ni en `if`, ni sous un autre nom : **la fonction n'est
pas écrite du tout** (**D-05**). L'échelle qui compte est **déclarée** par l'écriture — deux bornes,
toujours explicites (**D-04**) — et n'est jamais dérivée d'une valeur ni d'un nœud. Le lot n'écrit
**aucun nouveau `switch`** sur les kinds d'expression, ni sur quoi que ce soit d'autre.

**Le critère reste donc à 2 pour la seule raison acceptable :** il n'y a pas de troisième parcours,
et non parce qu'une orthographe aurait été choisie pour endormir un `grep`.

**Pourquoi cette distinction mérite d'être écrite, et pourquoi le dépôt l'a prévue.** L'ADR 0004
avait anticipé, mot pour mot, la faute que ce lot aurait pu commettre — et elle l'avait anticipée
en expliquant pourquoi elle avait choisi `-n` plutôt que `-l` [cité, `docs/adr/0004-…:729-735`] :

> « ⚠️ **`-n` et non `-l`, et la différence est le garde-fou lui-même.** `-l` liste les
> **fichiers** appariés : un troisième parcours ajouté *dans un fichier existant* — un second
> `switch` sur les kinds dans `evaluate.ts`, par exemple — laisserait le compte à 2 et le critère
> muet, au moment précis où la condition de retrait de l'amendement serait remplie. `-n` compte les
> **lignes** appariées, donc les `case` eux-mêmes, et passe à 3 où que le parcours atterrisse. **Un
> critère aveugle à une forme réaliste de l'événement qu'il surveille ne surveille rien.** »

**Le lot ne s'expose à aucune des deux formes que cette phrase décrit.** Il n'ajoute pas de parcours
dans un fichier existant ; il n'ajoute pas de parcours du tout ; il ne consomme jamais l'AST
d'expression. Le critère de l'ADR 0004 reste **exact**, au sens fort : il continue de surveiller ce
qu'il prétend surveiller, et il ne rend 2 que parce que 2 est vrai.

**Un seul faux positif du critère est à consigner, et il n'est pas de C6 :** `git grep` ne sait pas
ignorer un commentaire, donc **épeler la commande dans une docstring** ferait passer le compte à 3
sans qu'aucun parcours existe. La mitigation est une **consigne** — ne jamais épeler la commande
dans le code — et non un garde-fou. Elle est écrite ici pour que l'ADR de C6 la porte, et le lot la
respecte : aucune de ses docstrings n'épelle `case 'round':`.

**Ce que X-1 laisse ouvert :** le jour où un troisième parcours d'expression apparaît **par une
autre cause**, le Visitor d'expressions redevient obligatoire et l'amendement §3.B se retire. Ce
signal appartient au lot qui écrira ce parcours ; **il n'a pas d'héritier nommé aujourd'hui**,
parce qu'aucun lot planifié n'en écrit un.

---

### D-01 — La table d'écritures vit sur `Template`, et c'est la moitié affirmative d'une docstring publiée qui redevient vraie

**Décision.** `Template` porte un champ optionnel `presentations?: PresentationTable`, où
`PresentationTable = Readonly<Record<string, Presentation>>` et où chaque `Presentation` porte
**cinq** champs requis : `locale`, `currency`, `minFractionDigits`, `maxFractionDigits`,
`dateStyle`. La table est **stockée** dans le document, donc **validée par Zod**, **versionnée** et
**migrée**. `RenderRequest` n'est pas modifié.

**Pourquoi.** *(Raisonné sur une citation, mesuré sur le poids.)* `packages/core/src/ports/render.ts:27-28`
publie, dans un fichier qui part en `dist/**/*.d.ts` : « *Language and currency are a different
matter entirely: **the template declares them** (roadmap core, C6)* » [cité]. Cette phrase est un
**contrat déjà publié**, et il n'est honoré que si le modèle porte la déclaration. Le bénéfice
n'est pas cosmétique : **le modèle devient auto-suffisant à la lecture.** Ouvrir un `Template`
suffit à savoir dans quelles écritures il peut être rendu — un Designer peut le montrer, un
intégrateur peut l'auditer, un test peut le figer, et deux moteurs qui ouvrent le même fichier
lisent la même déclaration.

**Le coût, mesuré, parce qu'une forme stockée se paie sur la vitrine.** [mesuré] avec le compteur
de `assertBoundedShape` (valeurs JSON, profondeur) : une table de **deux** écritures ajoute
**+10 valeurs** et **+0 niveau de profondeur** — elle est aussi profonde que `page.margins`.
Quatre écritures : **+20 valeurs**. Sur le modèle réel de la vitrine (**620 nœuds, profondeur 18**),
c'est **+1,6 %** de valeurs et **+0** de profondeur, contre des plafonds par défaut de **100 000**
nœuds et **64** niveaux. Le garde de `parseTemplate` le vérifie au runtime plutôt que sur parole, et
[mesuré] un document v6 portant déjà une table passe `parseTemplate` et ressort estampillé **7**
avec sa table intacte.

**Écarté.**
**(a) Un troisième champ sur `RenderRequest`.** Contredirait « *There is no third field **on
purpose*** » dans le fichier même qui attribue la déclaration au modèle. Refuser coûte **zéro** :
la table stockée fait mieux que ce champ, puisqu'elle voyage avec le document.
**(b) Une clé de `RenderRequest.data`.** Réserverait un nom appartenant à l'intégrateur ; interdit
par la règle de périmètre, sans compensation possible.
**(c) Une table à côté du `Template`, passée en second argument de `parseTemplate`.** Rend le
document non auto-suffisant, donc reproduit exactement le défaut de (a) avec une surface d'API en
plus.

**Réversible avec migration.** C'est une forme stockée : la retirer ou la déplacer demande une
estampille, que **D-14** installe. *Signal de réouverture :* un besoin d'écriture par **document
rendu** plutôt que par **modèle** — c'est-à-dire un intégrateur qui veut rendre un même modèle avec
une écriture qu'il n'a pas écrite dans le modèle. Ce jour-là, la réponse est un argument, pas un
champ : voir **D-02**.

---

### D-02 — L'appelant sélectionne par un ARGUMENT, et les trois questions se séparent proprement

**Décision.** `resolvePresentation(presentations: PresentationTable | undefined, writing: string)`
rend un **`PresentationResolution`** — `{ ok: true, writing }` ou `{ ok: false, refusal }`. Le nom
de l'écriture est un **argument de fonction**. Il n'y a ni troisième champ sur `RenderRequest`, ni
clé réservée dans `data`, ni option d'évaluation.

> ⚠️ **Le type de retour a changé après la revue externe (A-7, 2026-08-20)** ; le **canal de
> sélection**, qui est l'objet de cette décision, n'a pas bougé d'un caractère. La rédaction
> initiale rendait `Presentation | undefined`, ce qui confondait **trois** causes de refus dans un
> seul silence [§3.4]. **D-02 reste réversible pour la même raison qu'avant : c'est une signature,
> pas une forme stockée** — et le résultat discriminé le prouve, puisqu'il vient d'être changé.

**Pourquoi.** *(Raisonné.)* Trois questions étaient confondues dans la formulation initiale du lot,
et les séparer est ce qui fait tenir tout le reste :

| La question | Qui y répond | Par quel mécanisme |
| :--- | :--- | :--- |
| **Ce que le document dit** — ses mots, `Facture` ou `Invoice` | le **modèle** | un `if` d'expression, **déjà livré par C1** |
| **Comment ça s'écrit** — langue, devise, décimales, style de date | le **modèle** | la table de **D-01** |
| **Laquelle des écritures est employée** pour ce rendu-ci | l'**appelant** | l'argument `writing` de `resolvePresentation` |
| **Ce que la machine préfère** | **personne** | aucun mécanisme, jamais |

La quatrième ligne est le point. Un canal de sélection est dangereux quand il **peut** être rempli
par l'environnement ; un argument de fonction ne le peut pas, il faut qu'un appelant l'écrive.

**Écarté.**
**(a) `EvaluationOptions.presentation`.** C'est le « troisième entrant d'évaluation » que
`packages/core/src/ast/types.ts:67-71` déclare **publiquement** que `core` ne prend pas [cité] :
« *`core` gains no third evaluation input, no page-aware operand and no reserved key in the
caller's data* ». Le refus est **gratuit** — le formatage n'est pas de l'évaluation, il vient
après.
**(b) Une entrée par défaut (`"default"`) ou un repli silencieux.** Un repli imprimerait un
document plausible et faux quand un appelant se trompe de nom : la sortie ne dirait pas qu'elle a
été choisie par personne. `undefined` le dit.
**(c) Faire porter la sélection au moteur en dur, sans argument.** Rendrait le lot inutilisable
autrement que par E4, et transformerait une décision d'intégration en constante de code.

**Réversible** — c'est une signature de fonction, pas une forme stockée. *Héritier de ce qu'elle
laisse ouvert :* **lot E4** (attente **E4-4**) et l'**intégrateur** : d'où le moteur tient-il le
nom ? D'une option d'adaptateur, **jamais** d'une lecture de machine, **jamais** d'une clé réservée
dans `data`.

---

### D-03 — L'espace de noms des clés appartient à l'AUTEUR du modèle, et Openview n'y réserve rien

**Décision.** Aucune clé n'est réservée, aucune n'est privilégiée, aucune convention ne lie un nom
d'entrée à une langue. `"fr"` et `"en"` sont des exemples de rédaction, jamais des noms attendus.
Un modèle peut nommer ses écritures `"montant-fr"`, `"quantite"`, `"a"`, `"b"` — le contrat ne
regarde que la **forme** de la clé, et il n'en refuse qu'une : la chaîne vide (**D-16**).

**Pourquoi.** *(Raisonné, sur le test de périmètre du dépôt.)* `AGENTS.md` donne le critère en une
phrase : « *si une fonctionnalité oblige l'intégrateur à nommer un champ comme Openview l'a décidé,
elle est à refuser* » [cité]. Une convention `"fr"` → français serait une **table de correspondance
détenue par Openview**, c'est-à-dire un référentiel, ce que `README.md:17` refuse explicitement
(« *ni une source de données […] Il ne détient aucun référentiel* »). Et elle serait **fausse dès
le second cas d'usage** : un modèle qui écrit des montants et des quantités en deux langues a
besoin de **quatre** entrées, dont deux partagent la même langue.

**Écarté.**
**(a) Une entrée `"default"` employée quand `writing` ne correspond à rien.** Réserve un nom, et
crée un repli silencieux que **D-02** refuse par ailleurs.
**(b) Une clé structurée (`"fr-FR/EUR/2"`).** Réintroduit une grammaire de nommage détenue par
Openview, avec un parseur à écrire — c'est-à-dire le défaut de (a) plus une surface d'analyse.
**(c) Un tableau ordonné plutôt qu'un `Record`.** L'index devient le nom, donc Openview décide que
le premier élément est le principal : la même réservation, déguisée en position.

**Réversible.** *Signal de réouverture :* aucun connu. Une convention de nommage n'a jamais été
demandée par un texte du dépôt.

---

### D-04 — Les deux bornes de fraction sont TOUJOURS explicites, et c'est ce qui rend la table CLDR inatteignable

**Décision.** `minFractionDigits` et `maxFractionDigits` sont **requis**, entiers, dans `[0, 15]`,
avec `min ≤ max`. Il n'y a **aucune** valeur par défaut, aucun héritage, aucune dérivation.

**Pourquoi.** *(Mesuré.)* Sans les deux bornes, `Intl.NumberFormat` applique la table CLDR des
**unités mineures** de la devise. Cette table n'est pas une convention typographique : **c'est un
arrondi**, et un arrondi qui **fait disparaître des chiffres**. [mesuré] sur `1234.5678`, en
`fr-FR` :

| Devise | Sans bornes déclarées | Avec `min = max = 2` |
| :--- | :--- | :--- |
| `EUR` | `"1 234,57 €"` | `"1 234,57 €"` |
| `JPY` | **`"1 235 JPY"`** — zéro décimale, **deux chiffres perdus** | `"1 234,57 JPY"` |
| `TND` | **`"1 234,568 TND"`** — trois décimales | `"1 234,57 TND"` |

Or `docs/adr/0004-…` décision 16 donne **les arrondis au modèle**, et le même fichier avait délégué
le classement de cette table précise : « *Le classement appartient à C6, qui l'instruira* » [cité,
`docs/adr/0004-…:659`]. **Ce lot exerce la délégation** : la table CLDR est un arrondi, donc elle
appartient au modèle, donc elle doit être **déclarée**. Deux bornes explicites ne la désactivent
pas — elles la rendent **inatteignable**, ce qui est plus fort : il n'existe aucun document valide
dont l'écriture laisse ICU décider du nombre de décimales.

**Pourquoi les DEUX bornes, et pas seulement le maximum.** Un minimum sous le maximum est une
**politique de zéros de queue** : `1.5` s'écrit `1,50` ou `1,5` selon ce qu'on déclare. Un document
qui décide cela **par valeur** l'a décidé **par accident**. Et le zéro de remplissage est nommément
attribué à C6 par le dépôt [cité, `docs/adr/0004-…:660-661` : « *Le zéro de remplissage (`1.50`)
est du remplissage … et il appartient à C6* »] : deux bornes le livrent sans champ
supplémentaire.

**Écarté.**
**(a) Hériter des unités mineures de la devise** (le comportement par défaut d'ICU). C'est un
arrondi non déclaré ; il contredit la décision 16 d'ADR 0004 et il perd des chiffres, mesuré
ci-dessus.
**(b) Le théorème « `max = max(min, scaleOf(value))` »**, proposé par une conception concurrente.
Voir **D-05** : il imprime la queue IEEE-754.
**(c) Un champ `padZeros: boolean` à côté d'un `decimals: number`.** Serait une **seconde
orthographe d'un même fait** — le critère que C5 a employé pour refuser `textTransform`
[cité, `docs/adr/0007-l-apparence.md:126`]. Deux bornes disent la même chose une seule fois.
**(d) Des bornes optionnelles avec défaut `2`.** `2` est la convention d'une partie du monde, pas
de tout le monde ; et un défaut réintroduit exactement la question « qui a décidé ça ? » que la
décision existe pour fermer.

**Réversible avec migration.** *Signal de réouverture :* un intégrateur qui demande que la devise
décide, en connaissance du fait qu'il demande un arrondi non déclaré. Ce jour-là, la conversation
est un **arbitrage produit**, pas un champ.

---

### D-05 — Le maximum est DÉCLARÉ et jamais dérivé : `scaleOf` n'est pas écrit, et c'est ce qui dissout X-1

**Décision.** Aucune fonction ne dérive une échelle d'une valeur. Ni `scaleOf`, ni
`declaredScaleOf`, ni un équivalent sous un autre nom : **elles ne sont pas écrites**. Le lot
n'ajoute **aucun** `switch`, et ne parcourt **jamais** l'AST d'expression.

**Pourquoi.** *(Mesuré.)* Une conception concurrente proposait de faire du maximum de décimales
l'**échelle propre de la valeur** — « le nombre de décimales qu'elle a réellement ». La mesure
suffit à la refuser : [mesuré] `0.02 + 63.24` vaut **`63.260000000000005`** en IEEE-754. La règle
imprimerait **dix-sept** chiffres après la virgule, sur une somme de deux montants à deux
décimales. Deux bornes déclarées en impriment quatre — deux avant la virgule, deux après —, et
c'est ce que le lecteur attend.

L'ironie est utile à écrire : **c'est la valeur même que l'ADR 0004 avait mesurée comme « sauvée »
par ICU.** ICU la sauve parce qu'il applique une échelle **externe** à la valeur. Une échelle
dérivée **de** la valeur ne la sauve pas — elle la révèle.

**Le second bénéfice, et il est structurel.** Une fonction `declaredScaleOf` aurait dû lire un nœud
`round` pour savoir combien de décimales le modèle a déclarées, donc **parcourir l'algèbre
d'expressions** — un **troisième** parcours, c'est-à-dire le seuil de retrait de l'amendement
§3.B d'`AGENTS.md`. Le critère `git grep -n "case 'round':" -- packages/core/src | wc -l` reste à
**2** [mesuré], **parce que la fonction n'est pas écrite**, et non parce qu'une orthographe aurait
été choisie pour l'endormir. La démonstration complète est au bloc **X-1** ci-dessus ; elle mérite
d'être relue avant d'être crue.

**Écarté.**
**(a) `scaleOf(value)` — l'échelle binaire de la valeur.** Imprime `63.260000000000005`. Mesuré.
**(b) `declaredScaleOf(expression)` — l'échelle du `round` qui alimente la valeur.** Exige un
troisième parcours de l'algèbre, donc retire l'amendement §3.B et impose le Visitor d'expressions
à un lot qui n'en a aucun autre besoin. Et il ne répond toujours pas à la question qui compte —
*combien de décimales ce site doit-il imprimer* — puisque la valeur peut n'avoir jamais été
arrondie.
**(c) Exporter `scaleOf` « pour le moteur ».** La règle anti-sur-ingénierie refuse un export dont
la seule justification est qu'il pourrait servir ; et l'échelle qui compte est déclarée, pas
dérivée.

**Réversible** — rien n'est stocké, rien n'est exporté. *Signal de réouverture :* l'apparition
d'un troisième parcours d'expression **par une autre cause** ; ce jour-là, le Visitor d'expressions
devient obligatoire et l'argument (b) change de coût. **Héritier : personne** — le refus est
définitif dans le périmètre connu.

---

### D-06 — ⛔ AMENDÉE — La locale est validée structurellement, mais par DEUX portes : la grammaire à l'ouverture, l'honorat au rendu

C'est la décision la plus retravaillée du lot, et la seule qu'une réattaque du contrat **déjà
mesuré** a fait tomber. Elle est écrite ici dans les deux temps, parce que **c'est la mesure qui
l'a tuée qu'on relira le jour d'une réouverture**, pas la formulation finale.

#### La première rédaction, et son motif — qui reste juste

**Décision (rédaction initiale).** Une locale est acceptée si et seulement si trois conditions
sont vraies : elle est **canonicalisable** (`Intl.getCanonicalLocales` ne lève pas), sa forme
canonique **ne porte pas d'extension `-u-`**, et `resolvedOptions().locale === canonical` sur
**les deux** formateurs (`NumberFormat` **et** `DateTimeFormat`). Tout cela **au parse**.

**Pourquoi cette validation-là, plutôt qu'une liste close.** *(Mesuré.)* Une liste close de
locales ferait d'Openview le détenteur d'un **référentiel**, ce que `README.md:17` interdit
nommément. Et elle serait fausse : [mesuré] un tuple écrit à la main oublie
`de-DE`, `br-FR`, `es-419`, `zh-Hans-CN` — quatre tags parfaitement légitimes que la validation
structurelle accepte sans qu'aucune liste ait à être tenue à jour. **La validation structurelle
n'a rien perdu de sa justesse ; c'est l'endroit où on l'applique qui était faux.**

#### La mesure qui l'a tuée — 31 772 tags, deux binaires réels

Le troisième test — `resolvedOptions().locale === canonical` — n'est pas un test de **forme**,
c'est un test **d'environnement** : il demande « *cet ICU-ci embarque-t-il un fichier de locale
pour ce tag ?* ». Monté sur un champ **stocké**, il fait dépendre l'ouverture d'un document de la
version d'ICU de la machine qui l'ouvre.

[mesuré, deux binaires réels : `node v24.11.1` / ICU **77.1** et `ms-playwright-go/1.50.1`
v22.13.1 / ICU **76.1**], sur 31 772 tags balayés :

| | ICU 77.1 | ICU 76.1 |
| :--- | ---: | ---: |
| tags acceptés par le prédicat combiné | **527** | **525** |

**Deux tags divergent, et l'un des deux est `en-FR`.** `en-FR`, c'est « anglais tel qu'on l'écrit
en France » : **le tag qu'un auteur écrira spontanément pour la moitié anglaise d'une facture
française**, c'est-à-dire le cas d'usage même du critère de recette du lot. Bout en bout, sur le
JavaScript émis, la **même table** rendait [mesuré] :

| | ICU 77.1 | ICU 76.1 |
| :--- | :--- | :--- |
| `PresentationTableSchema.safeParse(table).success` | `true` | **`false`** |
| issue | — | `{ code: 'custom', path: ['en','locale'] }` |

**Ce n'est pas une écriture perdue : c'est le document entier qui ne s'ouvre pas.** La table est un
champ de `Template` ; une issue sur `presentations.en.locale` fait échouer `TemplateSchema.parse`,
donc `parseTemplate`, donc l'ouverture. Et le message **accusait l'auteur** d'une faute de la
machine. C'est la classe « **refus illisible** » que décrit `AGENTS.md §1.2` — sauf que le remède
qu'`AGENTS.md` prescrit pour cette classe, l'incrément de `schemaVersion`, **n'existe pas ici** :
le refus dépend de la **donnée** et de la **machine**, jamais de la version.

#### La rédaction retenue — la scission, et le critère de la coupure

**Décision.** `declarableLocale` **disparaît**. Elle n'est pas renommée : la garder sous son nom
avec un sens amputé était le piège, puisque le dossier lui donne partout le sens **combiné** et
que des rédacteurs successifs transcriraient du faux. Deux fonctions la remplacent, chacune
nommant la question qu'elle pose :

```ts
function wellFormedLocale(tag: string): string | undefined   // PARSE  -- grammaire
function honouredLocale(tag: string): string | undefined     // RENDU  -- donnee CLDR
```

`honouredLocale` **appelle** `wellFormedLocale`, puis interroge les deux formateurs. Ni l'une ni
l'autre n'est exportée du barrel (**D-12**) : [mesuré] les **126** exports sont **inchangés** par
la scission.

**Le critère de la coupure, et il n'est ni « ce qui est cher » ni « ce qui est tôt » :**

> **Un champ STOCKÉ ne peut être jugé que par un verdict identique sur toute machine.**

| Porte | Ce qu'elle teste | Pourquoi elle est là |
| :--- | :--- | :--- |
| **Parse** — `wellFormedLocale` | `getCanonicalLocales` ne lève pas ; la forme **canonique** ne porte pas de `-u-` | La **grammaire** BCP-47 est spécifiée par **ECMA-402**. Elle n'est pas portée par les données CLDR, donc elle ne bouge pas d'un build à l'autre |
| **Rendu** — `honouredLocale` | `wellFormedLocale`, **puis** `resolvedOptions().locale === canonical` sur les deux formateurs | L'honorat demande si **ce build** embarque un fichier de locale. CLDR en gagne et en perd à chaque version |

**Ce que la scission conserve intégralement.** La garantie de la rédaction initiale — *aucune
écriture remise à un formateur n'a échappé à l'honorat* — est **conservée**, parce qu'aucun
formateur n'est atteint hors de `resolvePresentation` **une fois C-2 refermé** (voir **D-08** et
l'attente **E4-10**). Le refus retombe sur un `undefined`, donc **E4-8 s'applique tel quel** et
**zéro code d'erreur nouveau** n'est créé (**D-11**).

#### La preuve que la scission referme le défaut — 31 846 tags, le schéma réellement émis

Pas une réplique du prédicat : **le `PresentationSchema` réellement émis par le lot**, passé sur
31 846 tags sur chacun des deux binaires [mesuré] :

```
                          ICU 77.1        ICU 76.1
PARSE  acceptes           31 789          31 789
PARSE  sha256(ensemble)   aed8d898...     aed8d898...     <== IDENTIQUE, 0 divergence
PARSE  seulement sur 77   []
PARSE  seulement sur 76   []

RENDER acceptes           531             529
RENDER seulement sur 77   ["cls", "en-FR"]                <== legitime : l'honorat est de la donnee
```

**L'ensemble accepté au parse est identique au SHA-256 près.** C'est la grandeur que le défaut
accusait de bouger, et elle ne bouge plus. Et le scénario complet, rejoué sur la même table
`{ fr: 'fr-FR', en: 'en-FR' }` [mesuré] :

| | ICU 77.1 | ICU 76.1 |
| :--- | :--- | :--- |
| **avant** — `safeParse(table).success` | `true` | **`false`** — *le document n'ouvre pas* |
| **après** — le document s'ouvre | **`true`** | **`true`** |
| après — l'écriture `fr` rend | `1 234,50 €` | `1 234,50 €` |
| après — l'écriture `en` rend | `€1,234.50` | **`undefined`** → absence nommée (E4-8) |

**Une découverte de méthode, qui corrige le dossier plutôt que de le confirmer.** La réattaque
justifiait la coupure en écrivant que la partie syntaxique était « stable sur les 31 772 tags
sondés, les deux ensembles `RANGE` étant identiques ». [mesuré] **c'est vrai, et la preuve était
vide** : sur ce corpus, `getCanonicalLocales` **ne lève jamais**, sur aucun des deux ICU — les deux
ensembles étaient identiques *parce qu'ils étaient tous deux vides*. Le corpus, fait de tags de 2
lettres, 3 lettres et 2 lettres + région, est **bien formé par construction** et ne touche jamais
la frontière qu'il prétendait mesurer. Un corpus de frontière de **161 tags** a donc été ajouté —
26 tags *grandfathered*, 80 alias dépréciés, 51 malformations systématiques (`''`, `'fr_FR'`,
`'fr--FR'`, `'@'`, `'fr@euro'`, `'de-DE.UTF-8'`, sous-étiquettes trop longues, variantes
dupliquées) : **50 lèvent, exactement les mêmes sur les deux builds, zéro divergence de verdict.**
La frontière est touchée, et elle ne bouge pas.

**Le message d'erreur est réécrit, et c'est du fond.** L'ancien accusait l'auteur d'une faute de la
machine (« *a BCP-47 tag **this engine honours exactly as written*** ») ; le nouveau ne décrit que
ce que l'auteur a écrit **et nomme l'autre porte** : « *…whether a given engine **KNOWS** the tag is
a separate question, asked at **render time**, because its answer depends on the ICU build that
opens the document rather than on the document* ». Le test l'épingle par trois assertions, dont une
**négative** (`not.toContain('honours exactly as written')`), pour qu'un retour en arrière
rougisse.

**Écarté.**
**(a) Garder tout le prédicat au parse** (la rédaction initiale). Rend un document bilingue
inouvrable selon la machine, et oblige à **réécrire** — pas à amender — la matrice de
réversibilité, le mandat M-3, l'attente E4-9, le plan de test et la documentation d'intégration,
laquelle devrait alors publier une **version d'ICU minimale**, c'est-à-dire faire d'Openview le
détenteur d'un référentiel de fait.
**(b) Tout descendre au rendu, sans porte de parse.** Laisse entrer `'i-klingon'`, `''` et
`'fr_FR'` dans un document stocké : le Designer n'a plus **aucun** retour, et une faute de frappe
se persiste sans un mot.
**(c) Rogner l'extension `-u-` plutôt que la refuser**, pour élargir l'acceptation. Voir **D-07** :
un modèle dont l'intention stockée et la sortie imprimée divergent, sans que rien entre les deux
ne s'en aperçoive.
**(d) `PRESENTATION_LOCALES`, un tuple clos.** Ferait d'Openview un détenteur de référentiel ; et
[mesuré] refuse 22 tags légitimes que la validation structurelle accepte.

**Réversible.** ⛔ **Mais l'arbitrage `A-1` doit être entériné par le propriétaire du produit**
avant la livraison : la question — *un document déclarant une locale que la machine ne connaît pas
est-il inouvrable, ou ouvrable avec une écriture non résolue ?* — est une **politique de
portabilité de format**, pas un choix technique. Le contrat est écrit et mesuré dans le sens
« **refus au rendu** » ; c'est la recommandation, et elle est motivée. *Signal de réouverture :* un
produit qui déciderait qu'un document doit refuser de s'ouvrir plutôt que de rendre une moitié —
auquel cas les six reprises listées en (a) deviennent le travail à faire.

---

### D-06b — 🆕 Une locale n'est plus refusée à la frappe : le Designer AVERTIT, il ne bloque plus

**Décision.** Le parse ne jugeant que la grammaire, une locale bien formée mais inconnue de l'ICU
courant — `'zz'`, `'fr-XX'`, `'xx-YY'` — **se stocke sans plainte** et n'est refusée qu'au rendu.
Le Designer doit donc **avertir depuis `resolvePresentation`**, au lieu de refuser la saisie
depuis le schéma.

**Pourquoi.** *(Raisonné, et c'est le prix nommé de la scission.)* C'est la contrepartie exacte de
**D-06** : ce qu'on gagne en portabilité du format stocké, on le perd en immédiateté du retour à
l'auteur. Le taire serait faire porter la surprise à un lot qui n'a pas participé à la décision.
Le mécanisme existe déjà et ne demande rien de neuf — ✅ **et depuis A-7 il en dit davantage** :
`resolvePresentation` rend `{ ok: false, refusal: 'unhonoured-locale' }`, c'est-à-dire **la cause
nommée** et non plus un `undefined` dont un panneau d'édition devait deviner le sens. C'est
précisément le signal qu'il doit afficher.

⚠️ **Ce que le Designer doit encore calculer lui-même, et le plan le dit plutôt que de le laisser
découvrir :** `'unhonoured-locale'` ne distingue pas « ce moteur ignore cette langue » de « ce tag
est **sur-spécifié**, sa forme courte marcherait » — [mesuré] `en-Latn-US` est connu d'ICU et se
résout en `en`, donc il atterrit ici à côté de `'zz'`, qui se résout sur la locale de l'**hôte**.
`Intl.NumberFormat.supportedLocalesOf([tag])` tranche en une ligne, depuis un paquet navigateur qui
a le droit d'interroger son propre moteur. `core` ne le fait pas : ce serait un quatrième membre
d'union pour un besoin qui vit entièrement côté Designer (R-16, [§3.1]).

**Écarté.**
**(a) Ne rien écrire et laisser le Designer découvrir.** C'est ce que le dossier a fait pour trois
autres manques d'ergonomie ; ici, la cause est une décision de **ce** lot, donc la dette lui
appartient.
**(b) Ajouter un avertissement dans le schéma** (une issue non bloquante). Zod n'a pas de niveau
« avertissement » ; l'implémenter serait un mécanisme neuf pour un besoin d'IHM.

**Réversible.** **Héritier : lots V / Designer**, et ils l'apprennent par cette ligne.

---

### D-07 — Le refus de `-u-` est une condition à part entière, et `en-US-posix` prouve qu'elle doit porter sur la forme CANONIQUE

**Décision.** Une locale dont la forme **canonique** contient une extension `-u-` est **refusée au
parse**. Elle n'est **pas rognée**. Le test porte sur la forme **canonique**, jamais sur le tag
brut.

**Pourquoi ce n'est pas une redondance avec l'honorat.** *(Mesuré.)* On pourrait croire que le test
d'égalité `resolvedOptions().locale === canonical` écarte déjà les extensions. **Il ne les écarte
pas :** [mesuré] `'fr-FR-u-nu-thai'` est **canonique** *et* les deux formateurs le résolvent vers
lui-même — **l'égalité l'accepte**. Seul un refus nommé l'écarte.

**Pourquoi refuser plutôt que rogner.** Rogner laisserait un modèle dont l'**intention stockée** et
la **sortie imprimée** divergent, sans que rien entre les deux ne s'en aperçoive : l'auteur a écrit
`-u-nu-thai`, le document dit `-u-nu-thai`, et la facture sort en chiffres latins parce que
**D-09** épingle `numberingSystem`. Un refus dit à l'auteur que sa demande n'est pas honorée ; un
rognage la lui vole en silence.

**Le contre-exemple qui décide où porte le test, et il est neuf.** [mesuré] parmi les 161 tags de
frontière :

```
en-US-posix   =>   en-US-u-va-posix
```

**Un tag qui ne porte AUCUN `-u-` se canonicalise EN un tag qui en porte un.** Il y en a huit dans
le corpus dont la forme canonique porte `-u-`, et `en-US-posix` est le seul dont la forme écrite
n'en porte pas. Conséquence directe : **un test sur le tag brut aurait laissé passer `en-US-posix`
au parse ET au rendu**, et le contrat aurait remis à `Intl` l'extension qu'il affirme refuser. La
conception d'origine avait raison de tester la forme canonique ; elle n'avait pas ce
contre-exemple. Il est désormais **épinglé par un test dédié** (`N23`) et par une **mutation** de la
matrice, laquelle rougit si quelqu'un déplace le test sur le brut.

**Une conséquence de bord, nommée plutôt que masquée.** [mesuré] la canonicalisation **dérive**
entre builds : `'cls'` → `'sa'` (ICU 77) / `'cls'` (ICU 76), `'nbx'` → `'gll'` / `'ekc'`. **La
chaîne rendue dérive ; le verdict ne dérive pas** — aucune des deux dérives ne traverse le test du
`-u-`. Et la chaîne dérivante **n'atteint jamais le stockage** : le schéma ne normalise pas, donc
ce qui est persisté est ce que l'auteur a écrit ; la forme canonique ne vit qu'à l'intérieur d'un
rendu.

**Écarté.**
**(a) Rogner le `-u-` au parse.** Réécrit le document de l'auteur, et fait diverger intention et
sortie.
**(b) Accepter le `-u-` et laisser ICU l'honorer.** Contredit **D-09** : l'option épinglée gagne
contre l'étiquette [mesuré, `ja-JP-u-ca-japanese` avec `calendar: 'gregory'` rend `2026年8月19日`,
pas l'ère Reiwa], donc l'auteur aurait une déclaration ignorée sans le savoir.
**(c) Tester le `-u-` sur le tag brut** — plus simple, et **faux**, `en-US-posix` le prouve.

**Réversible.** *Signal de réouverture :* le jour où `numberingSystem` deviendrait déclarable
(**D-10** / mandat **M-4**), l'extension `-u-nu-` cesserait d'être une déclaration ignorée et le
refus mériterait d'être réexaminé — **pas avant**.

---

### D-08 — La devise est validée par la FORME et jamais contre un registre, et la revalidation au rendu est ce qui referme la dernière porte ouverte

**Décision.** `currency` doit satisfaire `^[A-Z]{3}$`. Aucun registre ISO 4217 n'entre dans le
paquet. Et **la même validation est rejouée au rendu**, dans `resolvePresentation`.

**Pourquoi la forme seule.** *(Mesuré.)* Une devise inconnue mais bien formée **s'imprime
elle-même** : [mesuré] `'ZZZ'` → `"1 234,50 ZZZ"`, `'BTC'` → `"1 234,50 BTC"`. Il n'y a donc rien à
protéger : le comportement d'ICU est déjà celui d'un contrat qui ne détient pas de référentiel. Une
liste close, elle, ferait d'Openview le détenteur d'un référentiel monétaire et devrait être tenue
à jour à chaque décision d'un État.

**Pourquoi la forme est plus STRICTE qu'ICU, délibérément.** [mesuré] ICU accepte `'eur'` et
imprime `€`. Accepter la minuscule donnerait **deux orthographes d'un même fait** — le motif que
C5 a employé pour refuser `textTransform`. La regex est donc plus stricte, et elle n'est **plus
laxiste sur aucun point** : `'zz'`, `'ZZZZ'`, `'12A'`, `'ZZ1'` lèvent tous
`RangeError: Invalid currency code` chez ICU [mesuré], et la regex les refuse **avant** qu'ICU les
voie.

**Pourquoi la revalidation au rendu, et pourquoi elle n'était pas là au premier jet.** C'est la
correction **C-2** du dossier, et elle est plus large que le défaut signalé. Le résolveur
revalidait **la locale seule**, avec un argument écrit noir sur blanc dans sa propre docstring :
« *because `Presentation.locale` is a `string` and a template is not always parsed* » [cité]. **Cet
argument vaut mot pour mot pour `currency` (un `string`) et pour l'ordre des deux bornes (deux
`number`)** — les trois champs que le type ne protège pas ; seul `dateStyle` l'est, parce que c'est
une union littérale. **Le contrat appliquait donc à 1 champ sur 3 un raisonnement qu'il avait écrit
pour les 3.** [mesuré] sur le JavaScript émis, avant correction, avec une écriture bâtie à la main :

| Écriture construite hors du résolveur | `formatMoney` | `formatDecimal` | `formatDate` |
| :--- | :--- | :--- | :--- |
| `locale: 'zz'` | `"1 234,50 €"` **(langue de l'HÔTE)** | `"1 234,50"` **(hôte)** | `"19 août 2026"` **(hôte)** |
| `locale: 'i-klingon'` ou `''` | **`RangeError`** | **`RangeError`** | **`RangeError`** |
| `currency: 'AB'` | **`RangeError`** | `"1 234,50"` | `"19 août 2026"` |
| `min 5 > max 2` | **`RangeError`** | **`RangeError`** | `"19 août 2026"` |
| `min: -1` | **`RangeError`** | **`RangeError`** | `"19 août 2026"` |
| `min: 2.5` | `"1 234,50 €"` | `"1 234,50"` | `"19 août 2026"` |

**Quatre familles de `RangeError`, et non deux** — la locale malformée en est une, invisible tant
qu'on ne teste que `'zz'`, qui est bien formé. **Et `formatDate` lève aussi : aucun des trois
formateurs n'est exempt.** La première ligne est la pire : **la lecture silencieuse
d'environnement que tout ce lot existe pour empêcher était atteignable par un appel exporté, en une
ligne, sans cast et sans rien contourner.**

**Le remède, et l'ordre des deux gestes est une décision de couverture, pas un goût :**

```ts
const locale = honouredLocale(declared.locale);                          // 1. honorat, ET syntaxe
if (locale === undefined) return undefined;
const parsed = PresentationSchema.safeParse({ ...declared, locale });    // 2. les cinq champs
if (!parsed.success) return undefined;
return parsed.data;
```

Écrit dans l'ordre évident — `safeParse` d'abord, honorat ensuite — **la moitié syntaxique de
`honouredLocale` deviendrait inatteignable**, puisque le schéma aurait déjà refusé tout tag
malformé. Ce paquet a supprimé deux branches mortes pendant ce lot pour cette raison exacte ;
l'ordre inverse en aurait introduit une troisième. Dans l'ordre retenu, [mesuré] **`resolve.js` est
couvert à 100 %** et les deux chemins de refus de `honouredLocale` sont exercés par des tests
ordinaires. Bénéfice de bord : `parsed.data` **est** la copie, construite par zod, donc débarrassée
des clés que le schéma ne connaît pas — « ne jamais rendre l'objet stocké » est conservé, et un
test l'épingle par `Object.keys(resolved).toHaveLength(5)`.

**Ce que le remède ne peut pas atteindre**, et qui part par écrit comme les neuf autres attentes :
un appelant qui **saute** `resolvePresentation`. D'où l'attente **E4-10** — « *le moteur ne
construit JAMAIS une `Presentation` à la main ; il n'emploie que celle que `resolvePresentation`
lui rend* ». Et la façade **conserve** son affirmation fausse (« *every door that reaches `Intl`
already goes through it* ») **en la nommant fausse**, à côté de la phrase plus étroite qui, elle,
est vraie : *toute écriture que `resolvePresentation` rend a passé les deux portes*. L'écart entre
les deux **est** exactement E4-10.

**Écarté.**
**(a) `PRESENTATION_CURRENCIES`, un tuple clos.** Référentiel détenu par Openview ; et il
vieillirait.
**(b) Accepter la minuscule** comme ICU. Deux orthographes d'un même fait.
**(c) Un type de colonne « monétaire » sur `TableColumn`.** Déjà refusé par C3 **en nommant C6**
[cité, `packages/core/src/ast/types.ts:545-546`] ; le reprendre rouvrirait l'arbitrage n° 1 de C3,
dont le coût est « rejouer, pas amender ». **Héritier : lot C3 (livré)**, réouverture = arbitrage
produit.
**(d) `currency?` optionnel** dans une écriture qui n'imprime pas d'argent. Achète trois lettres et
paie une seconde cause d'`undefined` : voir §2.0, c'est une verrue assumée et un relecteur peut la
contester.

**Réversible.** *Héritier de ce que le refus laisse ouvert :* l'**intégrateur** — la conformité
d'un code monétaire à ISO 4217 est sa responsabilité, et **E4-5** interdit au moteur d'ajouter une
table de secours.

---

### D-09 — Trois options sont épinglées, pas une, et la troisième touche les MONTANTS et non les dates

**Décision.** Tous les appels à `Intl` de ce lot épinglent **trois** options, écrites en **littéral
en ligne** : `timeZone: 'UTC'`, `calendar: 'gregory'`, `numberingSystem: 'latn'`. Aucune n'est
déclarable par le modèle.

**Pourquoi.** *(Mesuré, et la mesure est spectaculaire.)* Une locale **seule** ne détermine ni le
calendrier ni le système de chiffres : CLDR les choisit. [mesuré] sur la date **correcte**
`2026-08-19` :

| Locale / style | Avec la locale seule | Avec les trois options épinglées |
| :--- | :--- | :--- |
| `th-TH` / `short` | **`"19/8/69"`** — année bouddhique **2569** | `"19/8/26"` |
| `fa-IR` / `long` | **`"۲۸ مرداد ۱۴۰۵"`** — année persane **1405**, chiffres orientaux | `"19 اوت 2026"` |

**Une année fausse de 543 et une de 621, depuis une date correcte, sans erreur nulle part.** Ce
n'est pas une coquetterie typographique : c'est un document qui affirme une autre date que celle
que le jeu de données porte.

**Et `numberingSystem` touche les montants, pas seulement les dates** — c'est le point que le
dossier a failli manquer, parce qu'on classe spontanément les chiffres orientaux du côté des dates.
[mesuré] `Intl.NumberFormat('ar-EG')` rend **`١٬٢٣٤٫٥`** pour `1234.5`. Sans épinglage, une facture
en `ar-EG` sort avec des **montants** en chiffres arabes orientaux.

**L'option gagne contre l'étiquette, et c'est mesuré plutôt que supposé.** [mesuré]
`ja-JP-u-ca-japanese` avec `calendar: 'gregory'` rend **`2026年8月19日`**, pas l'ère Reiwa. C'est ce
qui rend **D-07** cohérente : une extension `-u-ca-` dans le tag serait une déclaration **ignorée**,
donc elle est refusée plutôt que silencieusement écrasée.

**Une contrainte d'écriture imposée par l'outillage, et elle est écrite ici pour épargner une heure
au rédacteur.** `AGENTS.md` documente deux **faux positifs** du plugin `no-environment-read` :
`Intl.DateTimeFormat('fr-FR', options)` avec `options` déclaré ailleurs, et
`Intl.DateTimeFormat(...args)`, sont **refusés** alors qu'ils sont corrects — le motif GritQL
compare du **texte source**, pas une valeur. **Le lot doit donc écrire son objet d'options en
ligne.** [mesuré] le contrôle négatif le confirme sur Biome 2.5.8 : la forme à `options` déclaré
ailleurs est refusée, et un `biome-ignore` **ne la sauve pas** — l'échappatoire n'existe pas pour un
plugin. Ni `biome.jsonc` ni les `.grit` ne sont touchés (`AGENTS.md §7`).

**Écarté.**
**(a) Épingler `timeZone` seul**, comme le message de `biome.jsonc:273` le laisse entendre
aujourd'hui. Laisse passer le calendrier **et** le système de chiffres : mesuré ci-dessus.
**(b) Laisser le modèle déclarer les trois.** Le calendrier est une **conversion du donné** (voir
**D-10**) ; le fuseau ferait mentir `civil-date.ts`, qui ne porte pas d'heure.
**(c) Ne rien épingler et documenter le risque.** Une documentation ne rattrape pas une année
fausse de 543 dans un PDF.

**Réversible** pour `numberingSystem` (**D-10**), **pas envisagé** pour les deux autres.

---

### D-10 — `calendar` est épinglé EN DUR ; `numberingSystem` est épinglé aujourd'hui et déclarable un autre jour

**Décision.** Les deux options ne sont pas classées ensemble, alors qu'elles sont épinglées
ensemble. `calendar: 'gregory'` est **en dur, définitivement**. `numberingSystem: 'latn'` est **en
dur aujourd'hui**, et recommandé comme candidat à un champ optionnel futur, sur mandat.

**Pourquoi la dissymétrie.** *(Raisonnée, sur deux textes du dépôt.)*

- **Changer de calendrier est une conversion du donné.** `2026-08-19` et `2569-08-19` sont **deux
  nombres différents**, pas deux orthographes d'un seul. L'encadré du lot dans `core.md` écrit
  « *ce lot ne fait pas de conversion* », et `civil-date.ts` fixe le donné en **grégorien
  proleptique** : l'imprimer dans un autre calendrier ferait **mentir l'arithmétique qui l'a
  produit**. Un `dateAdd` de 30 jours calculé en grégorien et affiché en bouddhique n'est pas une
  traduction, c'est une incohérence interne au document.
- **Changer de système de chiffres est la MÊME valeur écrite autrement.** `١٬٢٣٤` et `1 234` sont
  le même nombre. C'est donc légitimement « comment ça s'écrit », c'est-à-dire le périmètre du lot.

**Pourquoi le refuser quand même, aujourd'hui.** Deux motifs, dont un mesuré :
**(i)** **aucun texte du dépôt ne le demande** — ni `core.md`, ni le critère de recette, ni une ADR ;
**(ii)** [mesuré] **ICU ignore un système inconnu en silence** — `numberingSystem: 'zzzz'` se résout
en `latn`, **sans erreur**. L'exposer obligerait donc à le **valider structurellement** comme la
locale, c'est-à-dire à écrire une troisième porte de validation dépendante d'ICU, avec le même
problème de portabilité que **D-06** vient de payer cher.

**Le coût du refus, écrit sans adoucissement.** Une facture en `ar-EG` sort en **chiffres latins**.
La promesse « *digits* » de `packages/core/src/ast/types.ts:92-95` est donc **déclinée**, pas
honorée. C'est défendable — la conformité appartient à l'intégrateur — ce n'est pas neutre.

**Le remède le jour venu, et il est chiffré :** un **champ optionnel** sur `Presentation` + une
**estampille**, et un document qui omet le champ garde exactement la sortie d'aujourd'hui. Classe
*perte silencieuse*, donc migration d'estampille : la modification la moins chère du dépôt.

**Écarté.**
**(a) Rendre `calendar` déclarable.** Conversion du donné ; refusé pour tout le produit.
**(b) Rendre `numberingSystem` déclarable maintenant.** Exige une porte de validation neuve pour un
besoin dont aucune instance réelle n'existe.
**(c) Dériver le système de chiffres de la locale** (ne rien épingler). C'est le comportement par
défaut, et il produit `١٬٢٣٤٫٥` sur les montants sans que personne l'ait demandé.

**Réversible avec migration.** **Héritier : le propriétaire du produit — mandat M-4.** *Signal de
réouverture :* une facture arabe ou persane commandée par un intégrateur.

---

### D-11 — Zéro code d'erreur nouveau, zéro site nouveau : la ligne de C4 et de C5 est tenue

**Décision.** `SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` et `LIMIT_ERROR_CODES` sont **inchangés**.
Aucune classe d'erreur n'est créée. Les deux prédicats d'objet (**D-16**) produisent
`code: 'custom'`, qui n'est entrée d'aucun des trois catalogues. [vérifié]

**Pourquoi c'est possible, alors qu'une conception concurrente avait dû créer une erreur.** *(La
raison est architecturale, pas économique.)* Le contrat a **deux portes**, et chacune a une seule
cause d'absence :

| Porte | `undefined` signifie | Cause |
| :--- | :--- | :--- |
| `resolvePresentation` | l'**écriture** n'est pas utilisable | faute de **modèle ou d'appel** : nom non déclaré, locale que ce moteur n'honore pas, écriture invalide |
| un formateur | la **valeur** n'est pas écrivable | faute de **valeur** : nombre non fini, date que `dayNumberOf` refuse |

**Une absence, une cause, à chaque porte.** C'est exactement l'objection qui avait poussé une
conception concurrente à inventer `UndeclaredLocaleError` : avec une porte unique, un `undefined`
aurait eu quatre causes possibles et n'aurait rien dit. Avec deux portes, il en a une par porte, et
le type le dit. **La séparation en deux portes est donc ce qui paie le zéro code d'erreur** — et
elle a un second bénéfice, indépendant : la locale se résout **une fois par document** quand les
valeurs se formatent **N fois** (attente **E4-3**).

**Écarté.**
**(a) `UndeclaredLocaleError`.** Rendue inutile par la séparation ; et une classe d'erreur dans
`core` est une entrée de catalogue que **C8** devra ensuite porter en message.
**(b) Une issue Zod typée pour les deux prédicats d'objet.** Ajouterait deux entrées à un catalogue
pour deux refus que `code: 'custom'` exprime déjà avec un **chemin** utilisable par un Designer.

**Réversible** — mais **héritier nommé : lot C8**, qui hérite des messages. Le lot lui laisse
**zéro** entrée de plus à traiter, et c'est le résultat, pas une intention.

---

### D-12 — Les deux prédicats de locale ne sont PAS exportés du barrel

**Décision.** `wellFormedLocale` et `honouredLocale` ne figurent ni dans
`presentation/presentation.ts`, ni dans `index.ts`. [mesuré] la surface publique est de **126**
valeurs, et la scission de D-06 ne l'a pas fait bouger : scinder une fonction interne en deux
n'ajoute rien à la surface.

**Pourquoi.** *(Raisonné, sur un précédent exact.)* Aucun consommateur hors du paquet ne les nomme,
et la **règle anti-sur-ingénierie** d'`AGENTS.md` refuse un export dont la seule justification est
qu'il pourrait servir. Le précédent est net : `prefixPath` (`errors.ts`) et `aliasSchema`
(`expression/identifiers.ts`) sont **délibérément absents** d'`index.ts` [vérifié]. Et le motif de
fond est plus fort qu'une question de propreté : **exporter `honouredLocale` inviterait un
appelant à valider lui-même puis à construire une `Presentation` à la main**, c'est-à-dire à faire
exactement ce que l'attente **E4-10** interdit.

**Écarté.**
**(a) Exporter `honouredLocale` « pour que le Designer puisse avertir ».** Le Designer avertit
depuis `resolvePresentation` (**D-06b**), qui rend déjà le signal.
**(b) Exporter les deux « pour les tests ».** Les tests du paquet les atteignent par import relatif ;
un export pour tester est une surface publique payée par un usage privé.

**Réversible.** *Signal de réouverture :* un consommateur externe **réel**.

---

### D-13 — `presentations` est OPTIONNEL et sans défaut, et c'est l'inverse de ce que la v5 a fait pour `page` — sans incohérence

**Décision.** Le champ est `presentations?: PresentationTable | undefined`. Il n'a **aucune** valeur
par défaut, et la migration 6 → 7 **n'en invente aucune**. Absent signifie « ce modèle ne déclare
aucune écriture ».

**Pourquoi ce n'est pas une incohérence avec la v5.** *(Raisonné, et l'asymétrie a un motif.)* La
v5 a donné un défaut à `page` : une feuille A4. Un lecteur pourrait y voir une politique
contradictoire. Elle ne l'est pas, et la différence tient en une phrase :

| | `page` (v5) | `presentations` (v7) |
| :--- | :--- | :--- |
| Ce qu'un défaut devrait nommer | un **format de feuille** | une **langue** et une **monnaie** |
| Le défaut existe-t-il ? | **oui** — A4 est faux pour une partie du monde, mais il **existe** partout | **non** — *il n'existe pas de devise qui existe partout* |
| Qui peut le décider ? | « une décision produit, prise par le propriétaire du produit » | personne : ce serait détenir un référentiel (`README.md:17`) |

**Et la migration n'a rien à inventer**, ce qui est la conséquence pratique : « absent » est
exactement ce que déclarait **tout document écrit avant ce lot**. L'estampille suffit (**D-14**).

**Écarté.**
**(a) Un défaut `{ default: { locale: 'en-US', currency: 'USD', … } }`.** Choisit une langue et une
monnaie au nom de l'intégrateur ; refusé par périmètre.
**(b) Rendre le champ requis** avec une table vide obligatoire. Force une migration qui **écrit**
dans tous les documents existants pour n'y rien ajouter, et transforme une absence en objet vide —
c'est le geste que **C5** a refusé en établissant que « la forme canonique d'un style absent est
l'absence ».

**Réversible avec migration.**

---

### D-14 — `CURRENT_SCHEMA_VERSION` passe de 6 à 7 par une ESTAMPILLE SEULE, et l'estampille EST tout le mécanisme

**Décision.** `CURRENT_SCHEMA_VERSION` vaut **7**. La migration 6 → 7 est
`(input) => ({ ...input, schemaVersion: 7 })` : elle ne transforme rien. C'est la **seule décision
irréversible** du lot, et elle est prise maintenant.

**Pourquoi une estampille pour un champ optionnel qui ne casse rien.** *(Raisonné sur `AGENTS.md
§1.2`, qui décrit exactement ce cas.)* Le lot ajoute **une** forme stockée, sur **un** site
d'accroche, **optionnelle**. Aucune union ne s'élargit, donc **aucun build antérieur ne rencontrera
de discriminant inconnu** : ce n'est pas le « refus illisible ». **C'est la PERTE SILENCIEUSE, et
c'est la classe dangereuse :**

> `z.object` **supprime** les clés qu'il ne connaît pas. Un build **v6** qui ouvre un document
> **v7** l'accepte **sans aucune erreur** — la version n'a pas bougé pour lui — **et dépouille
> toute la table**. Un `onSave` persiste la perte. Après quoi chaque montant du document retombe à
> la mise en chaîne nue, et personne n'a vu passer d'erreur.

Avec l'estampille, le même document rend `TemplateMigrationError: … written by a newer release of
Openview; upgrade before opening it.` — **et c'est l'estampille SEULE qui produit ce message**,
indépendamment de la forme neuve. C'est pourquoi `AGENTS.md` écrit qu'« *une migration qui ne
transforme rien n'est pas une migration fantôme : elle estampille, et l'estampille est tout ce qui
produit ce message* » [cité].

**Pourquoi maintenant et pas « quand la forme sera stable ».** `AGENTS.md §1.2` ferme la porte :
« *cette décision est irréversible dès le premier template client : ne la reportez pas* » [cité], et
« *il n'y a pas de dérogation pré-v1.0 au versionnement* » — la dérogation pré-v1.0 porte sur les
**rétrécissements**, jamais sur le versionnement.

**Ce que l'estampille coûte, mesuré :** **quatre assertions** du dépôt rougissent, dans **deux**
fichiers — trois dans `packages/core/src/template/migrate.test.ts` (la liste littérale des paires
`[from, to]`, et deux `toBe(6)` dont les **titres** disent « *stamps a v5 document to 6* ») et une
dans `packages/core/src/style/__tests__/style.test.ts:134` (`toHaveLength(117)` → **126**)
[vérifié par relecture, `migrate.test.ts:158-165, 191, 210`]. Tout le reste du dépôt passe par
`CURRENT_SCHEMA_VERSION` et **reste vert** [vérifié : neuf autres sites, dont
`ast/__tests__/fixtures.ts`, `page/__tests__/page.test.ts`, `ast/__tests__/table.test.ts`,
`expression/evaluator/__tests__/limits-scope.test.ts` et `apps/playground/src/App.tsx`]. Le poste
« douze tests » qu'une première estimation avait avancé était **surévalué d'un facteur quatre**.

**Écarté.**
**(a) Ne pas estampiller**, au motif qu'un champ optionnel ne casse aucun build. C'est vrai pour le
**refus** et faux pour la **perte** : c'est précisément la classe que le paragraphe ci-dessus
décrit, et elle ne produit aucune erreur lisible.
**(b) Attendre C7 ou C8 pour estampiller une fois pour deux lots.** Un document écrit entre-temps
par un build neuf est dépouillé par un build ancien, sans trace. Le coût d'une estampille est de
quatre assertions ; le coût d'une perte silencieuse est un document faux chez un client.

⛔ **Irréversible**, au sens d'`AGENTS.md §1.2`. Aucun signal de réouverture : une version ne se
retire pas.

---

### D-15 — `Object.hasOwn` sur la lecture de la table, et ce n'est PAS de la programmation défensive

**Décision.** `resolvePresentation` lit la table par `Object.hasOwn(presentations, writing)` avant
tout accès, et jamais par une lecture d'index nue.

**Pourquoi ce n'est pas un réflexe mais une mesure.** *(Mesuré, et le résultat est le pire cas
possible pour ce lot précis.)* [mesuré] `z.record` **jette** une clé `__proto__` — aucun document ne
peut polluer un prototype par ce champ, et le refus `N20` du plan de test le rejoue. **Mais l'objet
rendu hérite d'`Object.prototype`.** Sur une table issue de `{"ok": {…}}` :

```
Object.keys(table)        -> ['ok']
table['constructor']      -> une FONCTION
```

Écrit `presentations[writing]`, le résolveur répondrait donc un **non-`undefined` plausible** pour
au moins onze noms que personne n'a déclarés — `constructor`, `toString`, `valueOf`,
`hasOwnProperty`… — et cet objet aurait un `.locale` valant **`undefined`**.

> **Et `undefined` passé à `Intl.NumberFormat` est exactement `Intl.NumberFormat(undefined, opts)`,
> c'est-à-dire l'angle mort d'arité zéro qu'`AGENTS.md` recense parmi ses trois angles morts
> muets — et que TOUT ce lot existe pour rendre inatteignable.**

Sans `Object.hasOwn`, la lecture d'environnement que D-06, D-08 et E4-10 ferment à trois endroits
serait rouverte par une **clé héritée**, sur un chemin qu'aucun test naïf n'explore. **La décision
n'est donc pas « soyons prudents », c'est « voici la treizième porte, elle est fermée ».**

**Écarté.**
**(a) La lecture d'index nue**, en s'appuyant sur `noUncheckedIndexedAccess` pour typer le résultat
`Presentation | undefined`. Le type est correct **et le runtime ment** : la valeur existe, elle
n'est simplement pas une `Presentation`.
**(b) `Object.create(null)` sur la table.** Zod ne le produit pas ; l'imposer demanderait une
transformation, donc de ne plus rendre ce que le document porte.
**(c) Une liste de noms interdits.** Réintroduit un référentiel détenu par Openview, pour un
problème que `Object.hasOwn` résout en une expression.

**Réversible** — c'est une ligne. Le test `R10` (« nom hérité (`constructor`) » → `undefined`)
l'épingle, et une mutation de la matrice rougit si quelqu'un la remplace par un accès direct.

---

### D-16 — Deux prédicats d'objet, tous deux À COUPURE, tous deux en `.check` à charge utile — et la forme est le remède d'un défaut découvert en C5

**Décision.** Deux prédicats seulement : `refuseInvertedBounds` (min > max) et
`refuseUnnamedWriting` (nom d'entrée vide). Tous deux écrits en `.check` **à charge utile**, tous
deux commençant par une **coupure** — si des issues sont déjà accumulées, le prédicat ne fait rien.
Ni `.refine`, ni `.check(z.superRefine(fn))`.

**Pourquoi la coupure, et pourquoi c'est une correction et non un raffinement.** *(Raisonné sur un
défaut réellement observé.)* `.refine` et `.check(z.superRefine(fn))` ne voient **pas** les issues
déjà accumulées. Or une faute *continuable* sur un champ **retire ce champ de la valeur** : le
prédicat lirait alors `undefined`, le comparerait, et ajouterait une **seconde** issue **fausse**
pour **une seule** faute. C'est le défaut que l'exécution de C5 a découvert, et le remède que le
dépôt énonce déjà n'est pas un autre prédicat mais **la règle de coupure de `checkTableWiring`**.

**Le résultat, mesuré, et c'est la ligne qui le démontre.** [mesuré] sur le JavaScript réellement
émis, **toutes** les entrées du tableau de refus rendent **exactement 1 issue**, sans exception —
23 entrées au parse. La ligne décisive est `N22` : une entrée au **nom vide** portant **en plus**
une devise `'eur'` rend **une** issue, `invalid_format` sur `["", "currency"]`, et **pas** de
seconde issue pour le nom.

**Une correction de rédaction qui vaut d'être conservée, parce qu'elle est contre-intuitive.**
Le premier jet écrivait le refus du nom vide comme `z.record(z.string().min(1), …)` — la forme
idiomatique. [mesuré] **c'était faux** : zod rend alors `code: 'invalid_key'`, `path: []` et **son
propre** message, `"Invalid key in record"`. C'est-à-dire un refus **non typé**, sur le **chemin
vide**, exactement ce que ce dépôt passe son temps à supprimer — un Designer ne peut pas marquer la
ligne fautive. Le prédicat écrit à la main met **la clé fautive dans le chemin**.

**Le compte, et pourquoi deux et pas trois.** Le commit `bca73f6` a migré `.superRefine(fn)` vers
`.check(z.superRefine(fn))` ailleurs dans le dépôt : c'est **la bonne forme là où il n'y a pas de
coupure à exprimer** (`ast/schemas.ts:359`, `page/schemas.ts:162`) [vérifié à HEAD], et la mauvaise
ici. Les deux formes coexistent donc, avec un critère explicite plutôt qu'une préférence.

**Écarté.**
**(a) `.refine` pour les deux.** Ne voit pas les issues accumulées ; produit la seconde issue
fausse.
**(b) Un prédicat unique validant tout l'objet.** Perd le chemin précis, donc le Designer perd le
champ à marquer.
**(c) Un `.check` sur `TemplateSchema`.** Serait « *le premier de ce fichier* », coût que C5 avait
chiffré et refusé de payer. Le lot ne le consomme pas : ses deux prédicats vivent sur
`PresentationSchema` et `PresentationTableSchema`. [vérifié] `template/template.ts` ne contient
aucun `.check` ni `.refine` à HEAD. **Héritier : lot C5**, à qui le budget qu'il a chiffré reste
disponible.

**Réversible.**

---

### D-17 — `MAX_FRACTION_DIGITS` est IMPORTÉ de `MAX_ROUND_DECIMALS`, jamais réénoncé — et ce n'est pas le plafond d'ICU

**Décision.** `MAX_FRACTION_DIGITS` vaut **15**, par **import** de `MAX_ROUND_DECIMALS`. Aucune
valeur littérale n'est réécrite.

**Pourquoi le lien est plus fort qu'une question de propreté.** *(Raisonné.)* Une écriture **plus
fine que le plus fin arrondi déclarable** est une écriture qu'aucun arrondi déclaré ne peut
alimenter : les chiffres au-delà du quinzième ne pourraient venir que d'une valeur **que personne
n'a arrondie** — c'est-à-dire du bruit IEEE-754, imprimé. La borne n'est donc pas « la même valeur,
tant qu'à faire » : c'est **la même valeur pour une raison**, et l'importer plutôt que la recopier
est ce qui empêche les deux de diverger un jour sans que rien ne le signale.

**Ce que ce n'est PAS : le plafond d'ICU.** [mesuré] `maximumFractionDigits: 100` **passe**, `101`
lève `RangeError`. Le plafond d'ICU est une propriété du **moteur**, et ce serait le mauvais nombre
à publier dans un contrat **stocké** : ES2020 garantissait 20, ES2023 est monté à 100, et un
document **n'est pas reparsé** quand l'hôte est mis à jour. Publier 100 reviendrait à faire dépendre
la validité d'un document de la version du moteur — le défaut exact que **D-06** vient de fermer.

**Écarté.** **(a)** Recopier `15`. **(b)** Publier le plafond d'ICU. **(c)** Ne pas borner du tout
et laisser ICU lever — un `RangeError` non typé au lieu d'un refus Zod avec chemin.

**Réversible avec migration** — c'est une borne sur une forme stockée.

---

### D-18 — Aucune annotation `z.ZodType<T>` sur aucun schéma de ce dossier

**Décision.** Ni `PresentationSchema` ni `PresentationTableSchema` ne porte d'annotation de type
explicite. Les types sont **inférés** de zod.

**Pourquoi, alors qu'`AGENTS.md §1.2` impose un patron avec annotation.** *(Lecture stricte du
texte, et une mesure.)* Le patron obligatoire vise **l'AST récursif**, et lui seul — il existe
parce que « *les types récursifs Zod sont un piège à `any`* ». **Rien ici n'est récursif.** Et
`style/schemas.ts` a mesuré deux fois ce que l'annotation coûte quand elle n'est pas nécessaire :
annoter un schéma **et amputer** un champ de l'objet **compile à exit 0**, parce que `z.infer` d'un
schéma annoté rend… **l'annotation**. L'annotation ne garde donc rien ; elle **masque**.

**La garde réelle**, à sa place : la paire d'assertions `keyof` / valeur du fichier de tests, qui
compare le type inféré et le type écrit à la main dans les deux sens.

**Écarté.** **(a)** Annoter « par cohérence avec le patron ». Introduit le trou mesuré ci-dessus.
**(b)** Ne pas écrire le type `Presentation` du tout et ne garder que l'inférence — perd la
docstring publiée sur les champs, qui est ce que l'intégrateur lit.

**Réversible.**

---

### D-19 — Le zéro négatif est replié, et SEULEMENT l'exact

**Décision.** `formatMoney` et `formatDecimal` replient `-0` sur `0` par `value === 0 ? 0 : value`.
Rien d'autre n'est replié.

**Pourquoi.** *(Mesuré.)* [mesuré] `Intl.NumberFormat('fr-FR', { min: 2, max: 2 }).format(-0)` rend
**`"-0,00"`**. Or `0 * -1` et « une remise de rien » produisent `-0` très ordinairement, et
`-0,00 €` sur une ligne de total est un défaut qu'un lecteur signalera.

**Pourquoi ici et pas dans l'algèbre.** Le `-0` de l'algèbre est **arithmétiquement juste** ; c'est
son **écriture** qui est fausse. Corriger l'algèbre reviendrait à modifier une valeur pour un motif
d'affichage — exactement l'inverse du périmètre du lot.

**Pourquoi l'exact et rien d'autre.** `-0.001` écrit à deux décimales rend toujours `"-0,00"`, et
**c'est correct** : la valeur **est** négative. Cacher le signe reviendrait à **inventer un
nombre**.

**Écarté.** **(a)** Replier tout ce qui s'arrondit à zéro — invente un nombre. **(b)** Ne rien
replier — imprime `-0,00 €`. **(c)** Corriger dans l'algèbre — modifie une valeur pour un motif
d'affichage.

**Réversible.**

---

### D-20 — Aucun `roundingMode` n'est passé à ICU, et le refus est mesuré plutôt que supposé

**Décision.** Aucun appel de ce lot ne passe `roundingMode`. Le défaut d'ICU (`halfExpand`) est
laissé tel quel.

**Pourquoi.** *(Mesuré sur 200 000 tirages.)* Le mode de départage est **déjà déclaré par le
modèle**, au nœud `round` de C2. Le repasser à `Intl` créerait une **seconde source** pour le même
fait, et deux orthographes d'un arrondi sont la façon dont deux moteurs produisent deux documents.
La mesure dit ce que le silence coûte, et ce qu'il ne coûte pas [mesuré, famille monétaire à trois
décimales écrite à deux places] :

| Chaîne testée | Divergence avec « formater seul » |
| :--- | ---: |
| `roundDecimal` du dépôt en **`halfExpand`**, puis formater | **0,0000 %** — coïncidence parfaite |
| `roundDecimal` du dépôt en **`halfEven`**, puis formater | **4,9275 %** |

**Ce que la mesure impose, et à qui.** Elle ne dit pas « tout va bien » : elle dit que **l'ordre des
opérations appartient au moteur**. D'où l'attente **E4-2** — « **arrondir PUIS formater, jamais
l'inverse** », et le `maxFractionDigits` de l'écriture doit valoir les décimales du `round` qui
alimente la valeur. **Héritier : lot E4.** *Signal de réouverture :* un modèle qui déclare
`halfEven` et dont le rendu le contredit — le cas est chiffré à 4,9275 %, il n'est pas
hypothétique.

**Écarté.** **(a)** Passer le mode déclaré par le `round`. Exige de **lire l'expression**, donc un
troisième parcours de l'algèbre : voir **D-05** et **X-1**. **(b)** Épingler `halfExpand`
explicitement. Ne change rien à la sortie et crée une seconde source pour le même fait.

**Réversible.**

---

### D-21 — Pas UN SEUL objet `Date` n'est construit, et `Date.UTC` est refusé bien qu'`AGENTS.md` l'autorise

**Décision.** `formatDate` convertit par `dayNumberOf(value) * 86_400_000` et passe le **nombre** à
`Intl.DateTimeFormat.prototype.format`. Le constructeur `Date` n'est employé à **aucune arité**, et
`Date.UTC` **non plus**.

**Pourquoi le constructeur est exclu :** il est banni à toute arité dans `core` par `AGENTS.md`, et
le plugin `no-environment-read` mord. Ce n'est pas une décision, c'est une contrainte.

**Pourquoi `Date.UTC` est exclu, alors qu'il est explicitement AUTORISÉ.** *(Mesuré, et c'est le
seul endroit du lot où le contrat est plus strict que l'outillage.)* `AGENTS.md` liste `Date.UTC(…)`
parmi ce qui « passe délibérément ». [mesuré] il **projette les années 0–99 sur 1900–1999** :

```
Date.UTC(42, 0, 1)   ->   1942-01-01, pas 0042-01-01
```

Or `civil-date.ts` **accepte** `0042-01-01` : `MIN_YEAR = 1` [vérifié, `civil-date.ts:53-54`]. Un
`Date.UTC` déplacerait donc **en silence** une date que le contrat déclare valide, de dix-neuf
siècles, sans erreur nulle part. **Une règle outillée qui autorise une forme n'est pas une raison de
l'employer quand une mesure montre qu'elle ment.**

**Ce que la conversion arithmétique coûte, vérifié plutôt que supposé.** Les bornes de
`civil-date.ts` sont `MIN_YEAR = 1` et `MAX_YEAR = 9999` [vérifié, `civil-date.ts:53-54, 101-102`].
Le pire horodatage produit vaut donc environ **3,15 × 10¹⁴ ms**, très en deçà des **±8,64 × 10¹⁵**
au-delà desquels `Intl` lèverait. **D-21 ne cache donc aucune `RangeError` de plage** [déduit d'une
lecture, arithmétique vérifiable].

**Le bénéfice de bord, qui est en réalité le principal :** avec `timeZone: 'UTC'` épinglé
(**D-09**), la chaîne rendue ne dépend d'aucun fuseau, d'aucune heure et d'aucun objet mutable.
`formatDate` est une fonction pure d'une chaîne `YYYY-MM-DD` et d'une écriture — et c'est ce que
`civil-date.ts:24-26` demandait en désignant nommément **C6** comme propriétaire de la conversion
`YYYY-MM-DD` → `31/03/2026` [cité].

**Écarté.**
**(a) `new Date(value)`.** Banni, et dépendant du fuseau à l'analyse.
**(b) `Date.UTC(y, m, d)`.** Autorisé par l'outillage, **faux** sur les années 0–99, mesuré.
**(c) Un motif de date parsé** (`'dd/MM/yyyy'`) plutôt qu'une énumération de styles. Refusé **deux
fois** par le dépôt, dans deux lots, contre le même besoin : « *c'est un parseur, avec son
échappement et **sa surface d'injection*** » [cité, `docs/adr/0006-la-page.md:953-954`]. Remplacé
par les quatre styles ECMA-402 de `DateStyle`, cohérents avec le choix de C2 (« deux modes au
vocabulaire ECMA-402 »). **Héritier : personne — le refus vaut pour tout le produit** ; un besoin de
motif se traite par un **cinquième style nommé**, jamais par un parseur.

**Réversible** — c'est une expression arithmétique. *Signal de réouverture :* aucun.

---

### D-22 — Le dossier s'appelle `presentation/`, et non `format/`

**Décision.** Le lot livre `packages/core/src/presentation/` : `types.ts`, `schemas.ts`,
`locale.ts`, `resolve.ts`, `format.ts`, la façade `presentation.ts`, et `__tests__/`.

**Pourquoi le nom compte.** *(Raisonné, sur le précédent immédiat.)* Le dossier porte le nom de ce
que le **modèle déclare** — une table d'écritures, stockée, versionnée, migrée — et **non du verbe
qui la consomme**. C'est exactement le geste de C5 : `style/` porte `Typography` et `BoxStyle`, et
**ne s'appelle pas `paint/`**. Un dossier nommé `format/` désignerait l'action du moteur, et
inviterait le lot suivant à y déposer du rendu — c'est-à-dire à faire entrer dans `core` ce que
`core` refuse.

Le fichier `format.ts` existe **à l'intérieur**, et c'est cohérent : les trois formateurs sont, eux,
des verbes.

**Écarté.** **(a)** `format/` — nomme le verbe. **(b)** `i18n/` — annonce un catalogue de messages
et un port de traduction, dont le lot ne livre ni l'un ni l'autre, et dont
`AGENTS.md` refuse nommément le port. **(c)** `locale/` — nomme un champ sur cinq.

**Réversible** — un renommage de dossier.

---

### Ce que ces vingt-deux décisions engagent, et envers qui

Une décision qui refuse quelque chose crée une dette. Le tableau ci-dessous rassemble ce que les
vingt-deux laissent derrière elles, **avec le propriétaire de chaque ligne** — c'est le point 4 du
registre du dépôt, et une promesse déclinée sans héritier serait une faute. Le détail de chaque
attente, ses mesures et son signal de réouverture vivent au §7 ; ce qui suit est l'index.

| # | Ce qui est engagé | Née de | Propriétaire |
| :-- | :--- | :--- | :--- |
| **E4-1** | ⛔ **Choisir les sites** et la fonction, valeur par valeur — le contrat ne distingue pas un numéro de commande d'un total, et il ne le doit pas | §2.0, M-1 | **lot E4**, + arbitrage produit si un champ de segment doit s'ouvrir |
| **E4-2** | **Arrondir PUIS formater**, jamais l'inverse ; `maxFractionDigits` doit valoir les décimales du `round` qui alimente la valeur | D-20 | **lot E4** |
| **E4-3** | Résoudre **chaque écriture employée** au plus **une fois par rendu**, jamais une fois par **valeur**. ⚠️ **Reformulé (R-07)** : « *l'écriture, une fois par rendu* » se lisait « *une seule écriture par rendu* », ce que le [§2.0] contredit — un modèle qui écrit montants, quantités et prix unitaires emploie **trois** écritures dans **un** rendu. Le motif est le **coût** (`resolvePresentation` canonicalise et construit deux formateurs de contrôle), jamais une exclusivité | D-11 | **lot E4** |
| **E4-4** | D'où vient la **clé d'écriture** : une option d'adaptateur, jamais une machine, jamais une clé de `data` | D-02 | **lot E4** + intégrateur |
| **E4-5** | Une devise inconnue **s'imprime elle-même** ; le moteur n'ajoute **aucune** table de secours | D-08 | **lot E4** |
| **E4-6** | L'espace insécable et sa version CLDR (**U+202F** / **U+00A0**) : ni normalisation, ni chaîne figée en test | §2.0 | **E4** (rendu), **E2/E5** (mise en page), **QA** (tests d'or) |
| **E4-7** | `calendar` et `numberingSystem` sont épinglés **par le contrat** : le moteur ne les repasse pas, ne les surcharge pas, ne propage pas d'étiquette `-u-` | D-07, D-09 | **lot E4** |
| **E4-8** | ✅ **ALLÉGÉ par A-7** — les deux absences sont désormais **deux TYPES** et non deux lectures d'un même `undefined` : le résolveur rend `{ ok: false, refusal }` (faute de modèle **ou** d'appel, **avec sa cause**), un formateur rend `undefined` (valeur sans forme écrite, **une** cause). Ce qui reste à E4 : trancher « **blanc ou échec de rendu** », question 2 d'ADR 0001, toujours **ouverte** — et fermer son `switch` sur `PresentationRefusal` par `const exhaustive: never` (AGENTS.md §3.B) | D-11, **A-7** | **E4** / **E3** |
| **E4-9** | Le viewer et le moteur emploient le **même ICU**, ou la promesse d'aperçu identique (J4) tombe | §2.0 | **lots V (viewer)**, **E5** |
| **E4-10** | 🆕 Le moteur **ne construit jamais** une `Presentation` à la main ; il n'emploie que celle que `resolvePresentation` lui rend. ⚠️ Obligation **documentaire** aujourd'hui — l'arbitrage **A-7** propose d'en faire une **signature** | D-08 | **lot E4** |
| **E4-11** | 🆕 **Tenir cohérents les DEUX commutateurs** : la langue des **mots** (un `if` lisant une donnée, livré par C1) et l'**écriture des valeurs** (le nom passé au résolveur, livré par ce lot). Ils sont indépendants **par conception**, et aucune porte d'Openview ne voit une facture à libellés français et montants en dollars | §2.0, **A-6** | **lot E4** + **intégrateur** ; avertissement au **Designer** |
| **D-06b** | 🆕 Une locale n'est plus refusée à la frappe : le Designer **avertit** depuis le résolveur | D-06 | **lots V / Designer** |
| **M-2** | ⛔ Le **critère de recette** de `core.md:261-262`, et le mot « correctes » d'`engine.md:82-83` | §2.0 | **propriétaire du produit** |
| **M-3** | ⛔ L'amendement d'**ADR 0003** — trois effets, dont la **validité d'entrée** et non la seule typographie | §2.0 | **propriétaire du produit** |
| **M-4** | `numberingSystem` déclarable — réouverture sur mandat | D-10 | **propriétaire du produit** |
| **A-1** | ⛔ Entériner « refus au **rendu** » — politique de **portabilité de format** | D-06 | **propriétaire du produit** |

**Deux lectures, pour finir.** Dix des quinze lignes appartiennent à **E4** ou au Designer : c'est
la signature d'un lot de `core` qui livre un contrat et refuse d'écrire le moteur à sa place.
Les cinq autres sont des **arbitrages** que le lot ne s'accorde pas à lui-même — trois textes du
dépôt doivent être amendés par leur propriétaire pour que ce contrat soit honnête, et **aucun des
trois n'est amendé en silence par une décision de cette section**.

---

## 3. Le contrat définitif

### 3.0 Le protocole du bac à sable — avant le code, parce qu'une mesure sans protocole n'est pas une mesure

> **Convention de provenance, valable pour tout ce document.** Un chiffre porte soit son relevé
> reproduit ici même, soit un renvoi à l'un des **dossiers de travail de la conception** — la
> récolte, les trois conceptions concurrentes, les quatre attaques, la campagne de mesure de
> rattrapage, la réattaque et le rapport de correction —, soit la mention **[déduit]** ou
> **[non vérifié]**. Ces dossiers vivent **hors du dépôt**, avec les bacs à sable, et ils sont
> éphémères : **tout ce dont l'exécution a réellement besoin est dans ce document**. Un chiffre
> sans provenance est une faute dans ce dépôt ; un chiffre absent ne l'est pas.
>
> **Répertoire.** `…\scratchpad\c6\sandbox-FINAL\core\` — **hors du dépôt**, et le dépôt n'est
> touché en rien. Le contrôle a été rejoué : `git status --porcelain` ne rend que les **deux
> lignes** de l'outillage de prévisualisation déclarées par la consigne, et **aucun fichier non
> suivi** [vérifié].
>
> **Ce qui est compilé.** Une **copie intégrale** de `packages/core/src` — les 19 fichiers de test
> compris —, sur laquelle le contrat de ce document est appliqué. Ce n'est **pas** un contrat
> isolé : c'est `core` tel qu'il sera après le lot. Un jumeau non modifié de la même copie vit
> dans `sandbox-FINAL/base/core/`, et c'est **lui** qui sert de référence à tous les `diff` de
> [§3.7] à [§3.9] : les trois fichiers modifiés y sont **identiques au HEAD `320bea6`** — 204,
> 362 et 237 lignes des deux côtés [vérifié, `wc -l` sur les deux arbres].
>
> **Ce qui pointe vers le dépôt, en lecture seule.** `typescript@7.0.2` et `zod@3.25.76` par
> **jonction Windows** (`<JUNCTION>`, vérifiée par `dir /AL`), respectivement vers
> `node_modules/typescript` et `packages/core/node_modules/zod` du dépôt. ⚠️ **Un `ln -s` de Git
> Bash ne suffit pas** : sans droit de lien symbolique, MSYS **copie** le répertoire, la copie est
> partielle, et le harnais devient muet sans le dire — c'est le piège que le plan C5 a documenté
> à ses dépens, et il est reconduit ici.
>
> **`tsconfig.json` du bac à sable — il ÉTEND celui du dépôt, il ne le recopie pas :**
>
> ```json
> {
>   "extends": "C:/_Gargouilles/Openview/tsconfig.base.json",
>   "compilerOptions": {
>     "module": "NodeNext", "moduleResolution": "NodeNext",
>     "lib": ["ES2022"], "types": [],
>     "outDir": "./dist", "rootDir": "./src",
>     "composite": false, "incremental": false,
>     "declarationMap": false, "sourceMap": false
>   },
>   "include": ["src/**/*"],
>   "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"]
> }
> ```
>
> Donc : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`,
> `noUnusedParameters`, `noImplicitReturns`, `useUnknownInCatchVariables` — **tous actifs**, tels
> que la porte 3 les applique, parce qu'ils sont **hérités** et non recopiés.
>
> **Et un second `tsconfig`, parce que les tests doivent être type-checkés eux aussi :**
>
> ```json
> {
>   "extends": ["./tsconfig.json", "C:/_Gargouilles/Openview/tools/tsconfig.typecheck.json"],
>   "compilerOptions": {
>     "paths": { "vitest": ["C:/_Gargouilles/Openview/node_modules/vitest/dist/index.d.ts"] }
>   },
>   "include": ["src/**/*"], "exclude": ["node_modules", "dist"]
> }
> ```
>
> [vérifié] `--listFiles` montre `presentation/__tests__/presentation.test.ts` **dans le
> programme** et `vitest/dist/index.d.ts` **résolu** : le fichier de tests est réellement
> type-checké, il ne passe pas au travers.
>
> **Les deux binaires, et ils sont tous deux réels.** Ce lot est le premier de `core` dont le
> comportement dépend d'ICU, donc une seule version de Node ne prouve rien :
>
> | | chemin | node | ICU | CLDR |
> | :--- | :--- | :--- | :--- | :--- |
> | récent | `node` (PATH) | v24.11.1 | **77.1** | 47.0 |
> | ancien | `…/ms-playwright-go/1.50.1/node.exe` | v22.13.1 | **76.1** | 46.0 |
>
> La CI du dépôt tourne `node: [24, 26]` (`.github/workflows/ci.yml:59`), donc **deux jeux CLDR en
> production** : l'écart mesuré ici n'est pas un artefact de laboratoire, c'est la matrice de la CI.
>
> **Le harnais d'exécution des tests — et c'est la limite la plus importante de ce protocole.**
> Les tests **ne tournent pas sous `vitest`**. Ils sont compilés en ESM (`run/tsconfig.json`,
> `noCheck: true`, la vérification de type étant faite séparément par `tsconfig.verif.json`) puis
> exécutés contre un **shim `vitest` de vingt lignes** (`sandbox-FINAL/run/vitest.mjs`) qui
> implémente `describe`, `it`, et douze matchers (`toBe`, `toStrictEqual`, `toHaveLength`,
> `toBeDefined`, `toBeUndefined`, `toContain`, `toBeLessThanOrEqual`, `toThrow`, et trois formes
> `not.*`). Ce shim exécute le fichier de test **du lot seul**. Conséquences, écrites en clair :
> les 627 tests existants de `core` **ne sont pas rejoués ici** — leur verdict est celui de
> [§3.10], **déduit** de la lecture du diff et non mesuré —, et un matcher que le shim n'implémente
> pas serait un `TypeError` plutôt qu'un échec d'assertion. Le fichier de test n'en emploie aucun
> autre [vérifié].
>
> **Baseline vérifiée avant toute modification** — sans quoi un exit 0 ne prouve rien :
>
> ```
> $ tsc -p base/core/tsconfig.json --noEmit        => EXIT=0
> ```
>
> **Contrôle négatif, joué AVANT la mesure et non après.** Pour Biome, la réplique
> `sandbox-FINAL/biome-probe/` est une copie **identique** de `biome.jsonc` et de
> `tools/biome/*.grit` du dépôt (`diff` vide des deux côtés, [vérifié]), Biome **2.5.8**. On y
> ajoute d'abord une ligne interdite à `locale.ts` :
>
> ```
> × `new Intl.*` called with no argument falls back to the host locale, which is an
>   environment read (AGENTS.md). …
>   > 186 │ const NEGATIVE_CONTROL = new Intl.NumberFormat().resolvedOptions().locale;
> Checked 10 files. No fixes applied.  Found 1 error.
> ```
>
> **La réplique mord.** Deux autres formes ont été essayées et refusées elles aussi : le faux
> positif annoncé par AGENTS.md (`new Intl.DateTimeFormat('fr-FR', opts)` avec `opts` déclaré
> ailleurs) est bien **refusé** — c'est la contrainte que [§3.5] accepte en écrivant ses options
> en ligne —, et un `biome-ignore` posé devant un diagnostic de **plugin** ne le supprime **pas**,
> aucune des cinq orthographes. La ligne retirée, le vrai passage rend
> `Checked 10 files in 324ms. No fixes applied.` — **zéro erreur, zéro avertissement**.
>
> **Ce que le bac à sable NE mesure PAS, et il faut le dire à la première page :**
>
> | Non mesuré | Pourquoi, et ce qui reste affirmé |
> | :--- | :--- |
> | **Les quatre portes DANS le dépôt** | Aucune n'a été jouée dans `C:/_Gargouilles/Openview` : la consigne l'interdit, et `lint`/`build` **écrivent** (caches Biome et Turbo, `dist`). Ce qui est mesuré est joué sur la copie, avec la configuration du dépôt **héritée** plutôt que recopiée |
> | **`pnpm run build`** | Jamais joué. Le lot n'ajoute ni entrée `exports`, ni fichier hors `src`, ni dépendance : [déduit] et rien de plus |
> | **La couverture réelle par `@vitest/coverage-v8`** | Jamais jouée. Le chiffre de [§3.10] est un **substitut** : lignes de JavaScript **émis**, commentaires et lignes vides retirés, mesurées par `NODE_V8_COVERAGE` sur le shim. La règle `coverage.include` du dépôt est appliquée des deux côtés (seuls `*.{test,spec}.ts` exclus, donc `__tests__/fixtures.ts` compte, comme en CI) |
> | **Les 627 tests existants** | Non rejoués. Les **quatre assertions qui rougissent** de [§3.7]–[§3.9] sont identifiées par lecture et par leur littéral, pas par exécution |
> | **Le playground, le Designer, le Viewer, l'engine** | Aucun n'est touché par ce lot, et aucun n'est compilé ici |
>
> ⚠️ **UN DERNIER AVERTISSEMENT, ET IL S'ADRESSE AU RÉDACTEUR QUI TRANSCRIRA CE BAC À SABLE.** La
> copie `sandbox-FINAL/core/src` a été prise **avant** le commit `bca73f6`, et elle est donc
> **périmée** sur trois fichiers du dépôt [mesuré, `diff` contre HEAD `320bea6`] :
> `expression/evaluator/operations/arithmetic.ts`, `expression/evaluator/operations/compare.ts` et
> `expression/evaluator/guards.ts`. Le dépôt y porte le `default: { const exhaustive: never = op }`
> de l'amendement AGENTS.md §3.B, que la copie n'a pas. **Ces trois fichiers ne doivent PAS être
> repris du bac à sable.** Effet sur les chiffres de couverture : **−8 lignes émises**, isolées et
> déduites en [§3.10]. Effet sur le lot : **aucun** — `presentation/` ne touche ni l'un ni l'autre.

---

### Les dix fichiers, et ce que le lot ne touche pas

⚠️ **Le tableau ci-dessous ne compte que la production et les tests de `packages/core`.** Le lot
touche **dix fichiers** dans `core` — sept neufs, trois modifiés — et **rien d'autre dans le
code**. La vitrine et les documents (roadmap, ADR, plan) relèvent de [§4] et n'apparaissent pas
ici, parce qu'ils ne portent pas de contrat.

#### Production — le dossier neuf `packages/core/src/presentation/`

> ⛔ **La colonne « Incrément » était FAUSSE sur neuf lignes sur dix (R-05).** Elle numérotait
> `INC-1 … INC-5` là où le [§4] numérote `INC-0 … INC-5`, et coupait `resolve.ts` de `format.ts`
> alors que le [§4] les livre **dans le même incrément**. Elle est réalignée sur le [§4], qui fait
> foi ; en cas de nouvelle divergence, **c'est le [§4] qu'on lit**, parce que c'est lui qui porte
> les critères de sortie et les messages de commit.

| § | Chemin réel | Nature | Lignes | Incrément |
| :-- | :--- | :--- | --: | :-- |
| **3.1** | `packages/core/src/presentation/types.ts` | ➕ nouveau | 212 | **INC-0** |
| **3.2** | `packages/core/src/presentation/locale.ts` | ➕ nouveau | 184 | **INC-0** |
| **3.3** | `packages/core/src/presentation/schemas.ts` | ➕ nouveau | 193 | **INC-0** |
| **3.4** | `packages/core/src/presentation/resolve.ts` | ➕ nouveau | 117 | **INC-1** |
| **3.5** | `packages/core/src/presentation/format.ts` | ➕ nouveau | 215 | **INC-1** |
| **3.6** | `packages/core/src/presentation/presentation.ts` | ➕ nouveau — **la façade** | 111 | **INC-0** (forme partielle) → élargie en **INC-1** |

> **L'ordre de lecture ci-dessus est l'ordre des dépendances, et il n'a pas eu à être forcé.**
> `types.ts` n'importe que `MAX_ROUND_DECIMALS` ; `locale.ts` n'importe **rien** ; `schemas.ts`
> importe les deux précédents ; `resolve.ts` importe les trois ; `format.ts` n'importe que
> `types.ts` et `civil-date.ts` ; la façade n'importe que le dossier. **Aucun cycle**, et aucune
> arête vers un paquet frère. C5 a dû assumer une numérotation inversée (son `types.ts` dépendait
> de son `units.ts`) ; ici le hasard est favorable, et il ne coûte rien de le dire.

#### Production — fichiers modifiés

| § | Chemin réel | Nature | Lignes (avant → après) | Incrément |
| :-- | :--- | :--- | :-- | :-- |
| **3.7** | `packages/core/src/template/template.ts` | ✏️ modifié | 204 → **258** | **INC-2** |
| **3.8** | `packages/core/src/template/migrate.ts` | ✏️ modifié | 362 → **397** | **INC-2** |
| **3.9** | `packages/core/src/index.ts` | ✏️ modifié | 237 → **253** | **INC-3** |

#### Tests

| § | Chemin réel | Nature | Incrément |
| :-- | :--- | :--- | :-- |
| **3.10** | `packages/core/src/presentation/__tests__/presentation.test.ts` | ➕ nouveau (585 l., **33 `it` mesurés / ~40 attendus après fusion**, cf. [§C.6.0]) | **INC-0** → **INC-3** |
| — | `packages/core/src/template/__tests__/migrate.test.ts` | ✏️ **modifié** — 3 assertions | **INC-2** |
| — | `packages/core/src/style/__tests__/style.test.ts` | ✏️ **modifié** — 1 assertion (`:134`) | **INC-3** |

> ⛔ **Correction (R-06) : le lot MODIFIE deux fichiers de test existants.** L'encadré précédent
> écrivait « *le lot ne modifie AUCUN fichier de test existant* » puis, trois lignes plus bas,
> « *un seul, `migrate.test.ts`, plus une ligne de `style.test.ts`* » — les deux phrases ne peuvent
> pas être vraies. La vraie est la seconde : **quatre assertions du dépôt rougissent**, trois dans
> `migrate.test.ts` (INC-2) et une à `style.test.ts:134` (INC-3), et **corriger une assertion est
> modifier le fichier qui la porte**. Elles sont maintenant des **lignes du tableau**, avec leur
> incrément, plutôt qu'une phrase qui se contredit.
>
> Ce qui reste vrai, et qui est le résultat que la phrase fausse voulait annoncer : **aucun fichier
> de test n'est réécrit, et aucune fixture d'AST ne bouge.** C5 avait **sept** fichiers de test à
> reprendre ; ce lot en a **deux**, pour **quatre** assertions. La différence tient à ce que C6
> **n'ajoute aucun champ sur un nœud** : ni `*_KEYS_IN_STEP` ni fixture d'AST n'est concernée.

#### Ce que le lot NE touche PAS — et pour chacun, pourquoi c'est un résultat

| Chemin | Pourquoi c'est un résultat, et non une abstention |
| :--- | :--- |
| `packages/core/src/errors.ts` | **Zéro code d'erreur nouveau, zéro classe nouvelle, zéro site nouveau.** C4 et C5 avaient tenu cette ligne ; C6 la tient aussi, et c'est **la double porte d'absence** qui le permet : `resolvePresentation` rend `{ ok: false, refusal }` pour une faute de **modèle ou d'appel**, un formateur rend `undefined` pour une faute de **valeur**. `SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` et `LIMIT_ERROR_CODES` sont **inchangés** [vérifié]. ⚠️ **Et il faut dire ce qu'A-7 ajoute quand même**, sinon la ligne est trop belle : le lot publie désormais un **troisième tuple de littéraux** de refus (`PresentationRefusal`), à côté de `DATE_STYLES` et `PAGE_FIELDS`. Ce n'est **ni** une classe d'erreur, **ni** une entrée de catalogue, **ni** un `throw` — c'est une **réponse**, et c'est l'appelant qui décide si elle est fatale (question 2 d'ADR 0001). La ligne « zéro code d'erreur » tient **à la lettre** ; la formule « rien à nommer » ne tient plus, et elle est retirée |
| `packages/core/src/ast/**` | **Aucun champ sur aucun nœud.** L'écriture est déclarée **au niveau du document**, pas au niveau du site — c'est le manque que la façade [§3.6] nomme en tête, et il est assumé. Conséquence mécanique : `visitor.ts` ne bouge pas, les unions `BlockNode` / `DocumentNode` ne bougent pas, aucune paire `*_KEYS_IN_STEP` ne rougit |
| `packages/core/src/expression/**` | **Aucune expression nouvelle, aucun kind nouveau.** `format(x, …)` a été examiné et **refusé** : élargir une union stockée est la seule décision **irréversible** que ce lot pouvait prendre. Le lot **lit** `MAX_ROUND_DECIMALS` [§3.1] et **appelle** `dayNumberOf` [§3.5], il n'écrit pas dans ce dossier. Le critère `git grep -c "case 'round':"` reste à **2** : aucun `switch` neuf |
| `packages/core/src/template/guard.ts` | **Aucune porte bornée nouvelle** : une écriture n'est jamais un fragment autonome, elle vit sur un `Template`, et `parseTemplate` la valide déjà. `DEFAULT_SHAPE_LIMITS` ne bouge pas — l'estampille 6 → 7 est une identité, donc **delta 0 valeur, 0 niveau**, par construction et non par mesure (le spread n'ajoute aucune clé) |
| `packages/core/src/page/**`, `style/**` | Le lot ne les lit ni ne les écrit. `presentation/` est **parallèle** à `style/`, pas dedans : `style/` dit à quoi une chose ressemble, `presentation/` dit dans quelle langue et quelle monnaie une **valeur** s'écrit |
| `packages/core/src/ports/render.ts` | ⛔ **La docstring `:27-28` devient VRAIE et n'est pas touchée.** Elle publie déjà « *Language and currency are a different matter entirely: **the template declares them** (roadmap core, C6)* » [cité]. Ce lot est ce qui rend la moitié affirmative exacte. **Aucun troisième champ sur `RenderRequest`** — la même docstring écrit « *There is no third field on purpose* », et la sélection se fait **par argument** [§3.4] |
| `packages/designer/src/**`, `packages/viewer/src/**`, `packages/engine/src/**` | Rien à faire dans ce lot. ⚠️ Le Designer hérite néanmoins d'une **obligation nommée**, `D-06b` : une locale n'est plus refusée à la frappe, elle doit être **avertie depuis le résolveur** [§3.2]. C'est le prix nommé de la couture, et il tombe dans un manque que le dossier reconnaît déjà — le Designer n'a été instruit nulle part |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `vitest.config.ts`, `turbo.json`, `package.json`, `pnpm-workspace.yaml` | `AGENTS.md` §7. **Aucune dépendance nouvelle** — `Intl` est la plateforme, pas un paquet. Et le contrat a **rencontré** la contrainte plutôt que de l'esquiver : le faux positif du plugin `no-environment-read` sur un objet d'options hoisté est **subi**, pas contourné (les trois épingles de [§3.5] sont écrites **en ligne**), et **aucun `biome-ignore`** n'est posé |
| `AGENTS.md` | **Aucune entrée.** Le lot ne découvre aucune sixième forme d'incompatibilité ; il découvre une **dépendance à ICU**, qui part en arbitrage `A-3` et non en règle |

---

### 3.1 `packages/core/src/presentation/types.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable**, avec les 19 fichiers de test de `core`. **212 lignes**
mesurées, **~275 après A-7** [⚠️ à remesurer], dont **une interface, trois alias, un tuple et
trois constantes** — le reste est de la justification, et c'est le registre du dossier `style/`.

Ce fichier ne contient **aucun schéma** et **aucune fonction**. La règle de modularité
d'AGENTS.md §2 (« isolez les contrats de types purs ») est appliquée ici parce que `page/` et
`style/` la respectent déjà et que C3 a payé le découpage d'`ast/` après coup.

> ⚠️ **Deux des cinq types de ce fichier ne sont PAS une forme stockée, depuis A-7.**
> `PresentationRefusal` et `PresentationResolution` sont des types de **retour** : rien ne les
> persiste, `TemplateSchema` ne les connaît pas, et **aucune estampille ne bouge si l'un des deux
> s'élargit**. Ils vivent ici et non dans `resolve.ts` pour la raison que le dépôt applique
> partout — les contrats de type purs se rassemblent, et `resolve.ts` exporte **une fonction** —
> mais un lecteur doit pouvoir les distinguer de `Presentation` en une ligne, d'où cet
> avertissement plutôt qu'un commentaire enfoui.

```ts
import { MAX_ROUND_DECIMALS } from '../expression/types.js';

/**
 * The four date skeletons CLDR names, and the whole of what a writing may say about a date.
 *
 * They are SKELETONS, not patterns: `long` means "the long form of THIS locale", which is
 * `19 fevrier 2026` in `fr-FR` and `February 19, 2026` in `en-US` -- MEASURED, both from one
 * civil date and one pinned option set. That is exactly the recipe criterion's promise for
 * dates (roadmap core, C6: "les dates"), and it is the reason no pattern string appears here.
 *
 * A PATTERN (`dd/MM/yyyy`) is refused, and the refusal is a scope decision rather than a taste.
 * A pattern makes the template the owner of the ORDER of the fields, so one model can no longer
 * produce two documents: the day-month inversion between `fr-FR` and `en-US` would have to be
 * written twice, which is the duplication the lot exists to remove. A pattern is also the one
 * form that CANNOT be honoured without reading a table this package does not own.
 *
 * `dateStyle` and not `{ year, month, day }`: the component form is expressible, but it leaves
 * the SEPARATOR and the ORDER to CLDR anyway, so it buys a longer contract for the same
 * dependency. What it would buy is a date without a year, which no invoice asks for.
 *
 * NO TIME, and that is inherited rather than decided: `expression/civil-date.ts` fixes what a
 * date IS in this package -- "a string `YYYY-MM-DD`, proleptic Gregorian, no time and no zone"
 * -- and adds that "turning that into `31/03/2026` belongs to lot C6". This is that lot, and it
 * does not widen the datum it was handed. `timeStyle`, `hour12` and a time zone other than UTC
 * would each need an INSTANT, and an instant is a clock.
 */
export const DATE_STYLES = ['short', 'medium', 'long', 'full'] as const;

export type DateStyle = (typeof DATE_STYLES)[number];

/** No writing prints a negative number of decimals. ICU refuses it too -- MEASURED, `RangeError: minimumFractionDigits value is out of range`. */
export const MIN_FRACTION_DIGITS = 0;

/**
 * The finest writing a template may declare, IMPORTED from the rounding algebra rather than
 * restated.
 *
 * `template/guard.ts` states the rule this follows -- "The same schema and the same ceiling as
 * `EvaluationLimits`, IMPORTED RATHER THAN RESTATED" -- and here the tie is stronger than
 * tidiness. A writing finer than the finest rounding a model can DECLARE (`round`'s literal
 * position, `[-15, 15]`) is a writing no declared rounding can ever feed, so the digits past
 * the fifteenth could only come from a value nobody rounded: IEEE-754 noise, printed.
 *
 * It is NOT ICU's ceiling. MEASURED on Node 24.11.1 / ICU 77.1: `maximumFractionDigits: 100` is
 * accepted and `101` raises `RangeError: maximumFractionDigits value is out of range`. ICU's
 * ceiling is a property of the ENGINE and would be the wrong bound to publish in a stored
 * contract -- ES2020 guaranteed only 20, ES2023 raised it to 100, and a document is not
 * reparsed when the host is upgraded. Fifteen is a property of this contract.
 */
export const MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS;

/**
 * ONE WRITING of the values a document prints: which language, which money, how many decimals,
 * which date form. A template declares a TABLE of these, and the caller picks one by name.
 *
 * ## What this type settles, and what it deliberately leaves open
 *
 * `ports/render.ts` publishes both halves of the rule and only the second one was honoured
 * until now: "There is no third field on purpose. No clock, no *system* locale, no ambient
 * context [...] Language and currency are a different matter entirely: **the template declares
 * them** (roadmap core, C6)." This type is where the template declares them. It is stored on
 * `Template`, so a model is SELF-SUFFICIENT ON READ: nothing about how it writes has to travel
 * beside it, and `RenderRequest` gains no third field.
 *
 * What it does NOT settle is WHICH SITES of a document are written this way. That question
 * needs a per-site marker -- a field on a segment, or an expression kind -- and this lot ships
 * neither; see the barrel {@link ../presentation.js} for why, and for what it costs. The
 * consequence has to be read plainly: **C6 hands the engine everything it needs to write a
 * value, and does not tell it which values to write.** That is lot E4's half of the seam, and
 * `docs/roadmap/engine.md` cuts it in exactly those words -- "Le contrat sait DECRIRE un modele
 * bilingue (core C6) ; le moteur doit L'HONORER".
 *
 * ## Why the two fraction bounds are REQUIRED, and both of them
 *
 * Because the alternative is a rounding this contract never declared. ICU carries a CLDR table
 * from currency to minor units, and it is an ARITHMETIC table, not a typographic one --
 * MEASURED on `1234.5678` in `fr-FR`: `JPY` prints `1 235 JPY` (zero decimals) and `TND` prints
 * `1 234,568 TND` (three). Digits disappear. ADR 0004 decision 16 says the arrondis are
 * declared by the model, so a table nobody declared cannot be the one that decides. Naming both
 * bounds makes that table UNREACHABLE -- MEASURED, the same value with `min = max = 2` prints
 * `1 234,57 JPY` and `1 234,57 TND` -- and the two ADR 0004 options stop being exclusive.
 *
 * Both, and not just the maximum: a minimum below the maximum is a trailing-zero policy
 * (`10,5` where the line above reads `10,50`), and a document that decides it per value has
 * decided it by accident.
 *
 * ## Why `currency` is required even in a writing that prints no money
 *
 * A model that writes counts declares a second entry -- `"quantite-fr"` beside `"montant-fr"`
 * -- and that entry names a currency it never uses. The waste is one three-letter string, and
 * it buys a property worth more: {@link formatMoney} is TOTAL over every declared writing, so
 * its `undefined` has exactly ONE cause (a non-finite value) rather than two. An optional
 * currency would merge "this line has no amount" with "this writing was never meant for money",
 * and the caller could not tell a data fault from an authoring fault. `errors.ts` already
 * refuses that merge for `InvalidEvaluationLimitsError`, in the other direction.
 *
 * ## Every field is required, and the object carries no default of any kind
 *
 * `template/template.ts` measured the alternative on its own `page` field: "A `z.default()`
 * would be worse than optional, and that IS measured: a document with no page parses and comes
 * out carrying a sheet Openview chose, at every parse, silently." A default LOCALE would be
 * worse still -- it would make Openview the owner of a language, which `README.md:17` refuses
 * -- and a default CURRENCY would make it the owner of a money.
 *
 * The declaration is nonetheless OPTIONAL AT THE DOCUMENT LEVEL, which is not the same thing:
 * see `Template.presentations`. Absent means "this model declares no writing", and that is the
 * behaviour of every document written before this lot.
 */
export interface Presentation {
  /**
   * A BCP-47 language tag the rendering engine honours EXACTLY AS WRITTEN. The type is a
   * `string` and forbids nothing, which is the reproach `style/types.ts` levels at its own
   * `Color` alias and answers the same way -- by saying so.
   *
   * ## ⛔ TWO GATES, AND WHICH ONE A STORED DOCUMENT MEETS
   *
   * `PresentationSchema` checks the tag's GRAMMAR: well-formed BCP-47, no `-u-` extension. That
   * verdict is the same on every engine -- MEASURED over 31 933 tags on ICU 76.1 and 77.1, ZERO
   * divergences -- which is the property a STORED field has to have.
   *
   * `resolvePresentation` checks that THIS engine KNOWS the tag, at render time. That verdict is
   * NOT the same on every engine -- MEASURED, 527 tags accepted on ICU 77.1 against 525 on 76.1,
   * `'en-FR'` among the two that move -- so gating a stored document on it would make the
   * document open on one machine and fail to open on another, with a message accusing the author
   * of a tag that is correct. The full argument is the seam note in `locale.ts`.
   *
   * The consequence to carry: `'zz'`, `'xx-YY'` and `'fr-XX'` ARE STORABLE, and are refused at
   * render rather than at parse. A Designer warns from the resolver, not from the schema.
   *
   * ## Neither gate is ever a closed list
   *
   * MEASURED, over 3 944 well-formed tags on ICU 76.1 and 77.1 alike: the honour test accepts 213
   * and refuses the rest, and among the accepted are `de-DE`, `br-FR`, `es-419` and
   * `zh-Hans-CN` -- tags a hand-written tuple forgets. A closed list would also make Openview the
   * holder of a language REFERENTIAL, which is the one thing `README.md:17` says it is not.
   *
   * What "exactly as written" excludes is the SILENT FALLBACK. MEASURED: `'zz'` and `'xx-YY'`
   * resolve to the host's locale, and `'fr-XX'` to `'fr'` -- no error, no warning, a document
   * formatted in the render server's language. Only a MALFORMED tag is loud (`'i-klingon'`
   * raises `RangeError`), and the loud one is the half the schema catches.
   *
   * A `-u-` extension is refused rather than trimmed, and that is measured too: `'fr-FR-u-nu-thai'`
   * PASSES the equality test -- both formatters resolve it to itself -- so the extension has to
   * be refused by name. Trimming it would leave a template whose stored intent and printed
   * output disagree, with nothing in between to notice; and the options below win against the
   * extension anyway -- MEASURED, `ja-JP-u-ca-japanese` with `calendar: 'gregory'` prints
   * `2026年8月19日` and not `令和8`.
   */
  readonly locale: string;
  /**
   * An ISO 4217 alphabetic code, checked by SHAPE (`^[A-Z]{3}$`) and never against a register.
   *
   * Openview holds no list of currencies, for the reason it holds no list of languages. A
   * well-formed code ICU does not know prints ITSELF -- MEASURED, `'ZZZ'` yields
   * `1 234,50 ZZZ` and `'BTC'` yields `1 234,50 BTC` -- so an unknown money degrades to a
   * legible document rather than to an exception, and no minor-unit count is inherited from
   * anywhere because both fraction bounds are declared above.
   *
   * The shape is STRICTER than ICU's, deliberately: ICU accepts `'eur'` and prints `1 234,50 €`
   * (MEASURED), so lower case would be a second spelling of one fact -- the objection
   * `page/types.ts` raises against `margins: 20` beside four edges. It is looser than ICU's in
   * no direction: `'zz'`, `'ZZZZ'`, `'12A'` and `'ZZ1'` all raise `RangeError: Invalid currency
   * code` (MEASURED), and the regular expression refuses all four before ICU sees them.
   *
   * NOT a conversion, and the roadmap says so in its own caveat: "Afficher « $ » n'est pas
   * convertir des euros en dollars : un taux de change est une donnee, et son choix appartient a
   * l'integrateur."
   */
  readonly currency: string;
  /** Lower bound, in `[MIN_FRACTION_DIGITS, MAX_FRACTION_DIGITS]` and never above the maximum below. */
  readonly minFractionDigits: number;
  /**
   * Upper bound, in `[MIN_FRACTION_DIGITS, MAX_FRACTION_DIGITS]`.
   *
   * ICU refuses an inverted pair rather than swapping it -- MEASURED, `min = 3, max = 2` raises
   * `RangeError: maximumFractionDigits value is out of range` -- so the schema refuses it too,
   * where the message can name the two fields instead of one.
   *
   * WHEN THIS BOUND IS BELOW THE VALUE'S OWN SCALE, ICU ROUNDS, and it rounds with ITS default
   * mode. That is an expectation this contract places on the engine rather than a thing it can
   * enforce; see the barrel, and ADR 0004's list of engine-side obligations.
   */
  readonly maxFractionDigits: number;
  /** The form dates take in this writing. One per writing, not one per site -- see {@link DATE_STYLES}. */
  readonly dateStyle: DateStyle;
}

/**
 * The table a template stores: writings, by a name the MODEL AUTHOR chose.
 *
 * The key space belongs to the author, exactly as the field names of `RenderRequest.data`
 * belong to the integrator. Openview reserves no key: there is no `"default"`, no `"fr"`, no
 * fallback entry, and no convention linking a key to a language. A model that needs money and
 * counts in two languages declares four entries and names them however it likes -- the engine
 * composes the name it asks for, and that composition is the engine's business, not this
 * contract's. The scope test of AGENTS.md is the one that settles it: "si une fonctionnalite
 * oblige l'integrateur a nommer un champ comme Openview l'a decide, elle est a refuser".
 *
 * A RECORD and not an ARRAY of `{ id, ... }`: the lookup is by name at render time, the
 * uniqueness of the name is free rather than a cross-field invariant to check (the reproach
 * `ast/schemas.ts` answers with `checkTableWiring`), and JSON round-trips it without an order
 * nobody meant to declare.
 *
 * ⚠️ A RECORD IS NOT A MAP, and the difference is measured. `z.record` DROPS a `__proto__` key
 * -- so no document can pollute a prototype through this field -- but the object it returns
 * still INHERITS from `Object.prototype`, so `table['constructor']` is a FUNCTION and
 * `table['toString']` is one too. A lookup written `presentations[writing]` therefore answers a
 * plausible non-`undefined` for at least eleven names nobody declared, whose `.locale` is
 * `undefined`, which is the arity-zero call to `Intl` this whole lot exists to make
 * unreachable. {@link resolvePresentation} uses `Object.hasOwn`, and that is why.
 */
export type PresentationTable = Readonly<Record<string, Presentation>>;

/**
 * ⛔ WHY A WRITING COULD NOT BE RESOLVED -- THREE CAUSES, AND THEY ARE NOT INTERCHANGEABLE.
 *
 * ## This union exists because `T | undefined` was the WRONG idiom for one function
 *
 * `T | undefined` is this package's idiom for "no answer", and it holds wherever there is ONE
 * cause: `civilDateOf` (not a civil date), `dayNumberOf` (same), `resolveTypography` (nothing
 * declared), {@link formatMoney} (the value is not finite). An earlier draft of
 * {@link resolvePresentation} used it too, under the heading "one absence, one cause" -- and then
 * listed THREE causes in the next sentence: no such writing, a writing this engine does not
 * honour, a writing that would not have parsed. The heading was the contract; the sentence was
 * the truth. This union is the sentence.
 *
 * ## What each member means, and why a caller cannot merge them
 *
 * `'unknown-writing'` -- THE CALL is wrong. The table has no entry under that name (or has no
 * table at all). The remedy is on the caller's side: it composed a name nobody declared.
 *
 * `'invalid-writing'` -- THE DOCUMENT is wrong, and it is wrong in a way that TRAVELS. The entry
 * exists and `PresentationSchema` refuses it, so it would have been refused on every machine.
 * This is reachable only through a writing that never met the schema -- one built in memory by a
 * designer, written as a literal in a test, or composed in TypeScript by an integrator.
 *
 * `'unhonoured-locale'` -- NEITHER is wrong, and that is the whole point of the seam. The
 * document is portable and the call is correct; THIS ENGINE does not honour the tag as written.
 * MEASURED, 527 tags honoured on ICU 77.1 against 525 on 76.1. A Designer must say "this build
 * does not know that tag" here, and must NOT accuse the author of a malformed one.
 *
 * ## A closed list Openview owns -- and it is not a referential
 *
 * `README.md:17` refuses that Openview hold a list of languages or of currencies, and this lot
 * holds neither. What it holds here is a list of ITS OWN GATES, which is the opposite kind of
 * object: adding a member describes a refusal this package already performs, it does not decide
 * anything about the world.
 *
 * ⚠️ ONE MEMBER IS DELIBERATELY ABSENT, AND IT IS NAMED SO THAT NOBODY RE-DERIVES IT BY ACCIDENT.
 * `'unhonoured-locale'` does not distinguish "this engine has no data for that language" from
 * "the tag is over-specified and its shorter form WOULD be honoured" -- MEASURED,
 * `'en-Latn-US'` is supported by ICU and resolves to `'en'`, so it lands here beside `'zz'`,
 * which resolves to the HOST's locale. The distinction is real and it is the Designer's, not
 * this package's: `Intl.NumberFormat.supportedLocalesOf([tag])` answers it in one line, from a
 * browser package that is allowed to ask its own engine. Adding a fourth member later costs
 * NOTHING STORED -- this union is a RETURN type, never persisted, so no `schemaVersion` moves.
 */
export type PresentationRefusal = 'unknown-writing' | 'invalid-writing' | 'unhonoured-locale';

/**
 * What {@link resolvePresentation} answers: ONE writing, or the REASON there is none.
 *
 * Discriminated on `ok` rather than on the presence of a field, so a consumer narrows with one
 * `if` and an exhaustive `switch` over {@link PresentationRefusal} closes with
 * `const exhaustive: never` -- the control AGENTS.md 3.B's amendment rests on, which a bare
 * `undefined` made impossible to write at all.
 *
 * NOT AN ERROR, and the distinction is what keeps this lot at zero new error codes: there is no
 * class in `errors.ts`, no entry in `SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` or
 * `LIMIT_ERROR_CODES`, and nothing is thrown. A refusal to resolve is an ANSWER, and it is the
 * caller who decides whether it is fatal -- which is exactly what ADR 0001's open question 2
 * ("blank or failed render") reserves for the engine.
 */
export type PresentationResolution =
  | { readonly ok: true; readonly writing: Presentation }
  | { readonly ok: false; readonly refusal: PresentationRefusal };
```

#### Ce qui s'y joue

| Décision | Où elle s'incarne, dans ce fichier |
| :--- | :--- |
| **D-01** — la table vit sur le modèle | la docstring de `Presentation` cite `ports/render.ts` **des deux côtés** : la moitié affirmative (« *the template declares them* ») devient vraie, la moitié négative (« *no third field* ») est conservée |
| **D-03** — aucune clé réservée | `PresentationTable` est un `Record<string, …>` sans convention. **Pas de `"default"`, pas de `"fr"`, pas d'entrée de repli** |
| **D-04** — les deux bornes sont **requises** | deux champs `number` non optionnels, et la justification mesurée `JPY` / `TND` vit dans la docstring plutôt que dans le seul plan |
| **D-06** *(amendée)* — les deux portes | la docstring de `locale` porte désormais la section « **TWO GATES** » et dit **laquelle un document stocké rencontre**. C'est la trace de C-1 dans le type lui-même |
| **D-07** — le `-u-` est refusé, jamais rogné | annoncé ici, **exécuté** en [§3.2] |
| **D-08** — la devise par la forme | annoncé ici, **exécuté** en [§3.3] |
| **D-15** — `Object.hasOwn` | la docstring de `PresentationTable` porte la mesure (« *au moins onze noms* ») ; le code est en [§3.4] |
| **D-22** — le dossier s'appelle `presentation/` | rien ici, tout dans la façade [§3.6]. C'est délibéré : un nom de dossier ne se justifie pas dans un fichier du dossier |

> ⛔ **`MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS` est la seule arête que ce fichier crée, et elle
> est portante.** Ce n'est pas une commodité : une écriture plus fine que le plus fin arrondi qu'un
> modèle peut **déclarer** est une écriture qu'aucun arrondi déclaré ne peut alimenter. Les
> chiffres au-delà du quinzième ne pourraient venir que d'une valeur que personne n'a arrondie — du
> bruit IEEE-754, imprimé. Le test [§3.10] épingle **les deux moitiés** (`MAX_FRACTION_DIGITS ===
> MAX_ROUND_DECIMALS` **et** `=== 15`), pour qu'aucune ne puisse dériver seule.
>
> **Et le plafond n'est PAS celui d'ICU** [mesuré, ICU 77.1] : `maximumFractionDigits: 100` passe,
> `101` lève. Publier le plafond d'ICU dans une forme **stockée** serait publier une propriété du
> **moteur** — ES2020 garantissait 20, ES2023 est monté à 100, et un document n'est pas reparsé
> quand l'hôte monte de version.

> ⚠️ **Ce que ce type ne tranche PAS, et il faut le lire en clair.** Il ne dit pas **quels sites**
> d'un document sont écrits ainsi. Un modèle imprime un numéro de commande, une quantité et un
> total ; le document stocké ne les distingue pas, et **il ne le doit pas** — reconnaître un total
> exigerait de réserver un nom de champ. [mesuré] la vitrine lie `commande.numero` (`20260014`) à
> l'état brut, et une écriture appliquée à tous les nombres imprimerait `20 260 014`, qui désigne
> une autre commande. **C6 remet au moteur tout ce qu'il faut pour écrire une valeur, et ne lui dit
> pas quelles valeurs écrire.** C'est la moitié E4 de la couture, et `engine.md:78-79` la coupe mot
> pour mot [cité].

---

### 3.2 `packages/core/src/presentation/locale.ts` — **nouveau — la couture, et la décision la plus travaillée du lot**

**Compilé à exit 0 dans le bac à sable. 184 lignes**, dont **deux fonctions de neuf et de dix
lignes** et **une constante**. Le reste — près de cent trente lignes — est une note de couture, et
elle est écrite dans le fichier plutôt que dans ce plan parce que c'est la ligne qu'un futur
contributeur voudra « simplifier » en réunissant les deux fonctions.

> ⛔ **C'est ici que la correction C-1 a mordu.** La rédaction précédente n'avait **qu'une**
> fonction, `declarableLocale`, qui posait les deux questions **au parse**. Elle rendait le
> document `en-FR` — le tag naturel de la moitié anglaise d'une facture française, c'est-à-dire le
> cas d'usage du critère de recette lui-même — **inouvrable sur ICU 76.1 et ouvrable sur ICU 77.1**
> [mesuré, deux binaires réels]. Le nom `declarableLocale` **disparaît** et n'est pas réemployé :
> le dossier lui donne partout le sens **combiné**, et un rédacteur qui le retrouverait avec un
> sens amputé transcrirait du faux.

```ts
/**
 * The Unicode extension marker. A canonical tag carrying it is REFUSED, never trimmed.
 *
 * Trimming would be a third spelling of one fact: the author wrote `-u-nu-thai`, the formatters
 * pin `numberingSystem` anyway, and deleting the request in silence leaves a template whose
 * stored intent and printed output disagree with nothing in between to notice.
 *
 * The test runs on the CANONICAL form and not on the tag as written, and that is MEASURED rather
 * than tidy: `'en-US-posix'` carries no `-u-` and canonicalises to `'en-US-u-va-posix'`, which
 * does. A check on the raw string would let that one through and then hand `Intl` an extension
 * this contract says it refuses.
 */
const UNICODE_EXTENSION = '-u-';

/**
 * ⛔ ONE PREDICATE WAS SPLIT IN TWO HERE, AND THE SEAM IS THE MOST CONSIDERED DECISION OF THIS
 * LOT. An earlier draft asked a single question -- "can this tag be DECLARED?" -- and answered it
 * with BOTH tests below at once, AT PARSE TIME. That is wrong, and it is wrong in a way only a
 * measurement across two engines exposes.
 *
 * `Presentation.locale` is a STORED field. It is written on one machine, at one moment, by one
 * build of ICU, and it is read on another machine, later, by another build. A gate placed at
 * parse time therefore judges a TRAVELLING document, so ITS VERDICT MUST BE THE SAME EVERYWHERE
 * OR THE FORMAT IS NOT PORTABLE. The two tests do not have that property in equal measure, and
 * the difference is not one of degree:
 *
 * - WELL-FORMEDNESS IS GRAMMAR. `Intl.getCanonicalLocales` raises on a tag BCP-47's grammar
 *   rejects, and that grammar is specified by ECMA-402 rather than carried in CLDR data.
 *   MEASURED over 31 933 tags on ICU 76.1 (CLDR 46) and ICU 77.1 (CLDR 47) -- 31 772 systematic
 *   tags plus 161 chosen at the boundary (every grandfathered tag of BCP-47, 80 deprecated
 *   aliases, 51 malformations) -- the two builds raise on EXACTLY the same 50 tags, and agree on
 *   the extension test for all 31 933. ZERO divergences.
 * - HONOUR IS DATA. `resolvedOptions().locale === canonical` asks whether THIS build ships a
 *   locale file for the tag, and CLDR gains and loses locales between releases. MEASURED on the
 *   same corpus: 527 tags honoured on ICU 77.1 against 525 on ICU 76.1. The two that move are
 *   `'cls'` and -- this is the one that matters -- `'en-FR'`, the tag the author of a bilingual
 *   French invoice writes for the English half of the model, which is to say the tag named by
 *   this lot's own recipe criterion.
 *
 * Had the honour test stayed at parse time, the SAME template would have opened on Node 24 and
 * FAILED TO OPEN on Node 22, with a `custom` issue on `presentations.en.locale` accusing the
 * author of a tag that is perfectly correct. Not a missing writing -- a document that does not
 * open, from a fault belonging to the reader's ICU build. AGENTS.md 1.2 has a name for that
 * class, "le refus illisible", and the remedy it prescribes there -- an increment of
 * `schemaVersion` -- CANNOT APPLY, because the refusal depends on the machine and not on the
 * document.
 *
 * So the seam is: {@link wellFormedLocale} at parse, {@link honouredLocale} at render. NOTHING IS
 * LOST. Every writing the engine receives has still passed the honour test, because
 * {@link resolvePresentation} is what builds one and it calls `honouredLocale` before handing it
 * back. A tag this engine does not honour yields `{ ok: false, refusal: 'unhonoured-locale' }`
 * from the resolver -- the one refusal a Designer must NOT blame on the author -- and this file
 * still owns no error code.
 *
 * WHAT THE SEAM COSTS, NAMED: a Designer can no longer refuse a locale as the author types it,
 * because at that instant the only available answer is "well-formed". It must WARN from the
 * resolver instead. That is one more line in a gap this lot already admits -- the Designer was
 * not instructed here at all.
 */

/**
 * Whether a language tag is WELL-FORMED and free of Unicode extensions -- the question a STORED
 * document is judged on -- returning the canonical spelling on success and `undefined` on
 * refusal.
 *
 * ## Two conditions, in the order that makes each one cheap
 *
 * MALFORMED -> `Intl.getCanonicalLocales` raises `RangeError` (MEASURED on `'i-klingon'`:
 * "Incorrect locale information provided"; also on `''`, `'fr_FR'`, `'fr--FR'`, `'root'`,
 * `'en-a-bbb-a-ccc'` and 44 others of the boundary corpus). CANONICAL BUT EXTENDED -> refused by
 * name; MEASURED, `'fr-FR-u-nu-thai'` PASSES the honour test on both formatters, so the extension
 * has to be caught here or not at all.
 *
 * ## What it deliberately does NOT ask
 *
 * Whether this engine KNOWS the tag. That is {@link honouredLocale}, and the note above says why
 * the two cannot share a gate. The consequence to hold on to: `'zz'`, `'xx-YY'` and `'fr-XX'` ALL
 * PASS HERE. They are grammatically impeccable and merely unknown, and BEING UNKNOWN IS A
 * PROPERTY OF THE READER, NOT OF THE DOCUMENT.
 *
 * ## What it returns, and why not a boolean
 *
 * The CANONICAL tag, because {@link honouredLocale} and {@link resolvePresentation} both need it:
 * handing the raw tag back to `Intl` would re-canonicalise it and would accept `'FR-fr'` while
 * having compared against `'fr-FR'` (MEASURED, `'FR-fr'` canonicalises to `'fr-FR'` and is
 * legitimate). `T | undefined` is this package's idiom for "no answer" -- `civilDateOf`,
 * `dayNumberOf`, `shiftDay`, `resolveTypography` -- and it is what lets this file own no error
 * code.
 *
 * ⚠️ THE SPELLING IT RETURNS IS NOT ITSELF STABLE ACROSS BUILDS, which is a different fact from
 * its VERDICT being stable. MEASURED over the same 31 933 tags: two canonicalisations drift,
 * `'cls'` yielding `'sa'` on ICU 77.1 and `'cls'` on ICU 76.1, `'nbx'` yielding `'gll'` against
 * `'ekc'`. Neither drift crosses the extension test, so NO VERDICT MOVES -- which is the only
 * property a stored gate needs. The drifting STRING never reaches storage either: this schema
 * does not normalise, so what is persisted is what the author wrote, and the canonical form lives
 * only inside one render.
 *
 * NOT EXPORTED FROM THE BARREL, together with {@link honouredLocale}. No consumer outside this
 * package names either, and AGENTS.md's anti-over-engineering rule refuses an export whose only
 * justification is that it might be wanted; the precedent is exact, `prefixPath` in `errors.ts`
 * and `aliasSchema` in `expression/identifiers.ts` are both deliberately absent from `index.ts`.
 */
export function wellFormedLocale(tag: string): string | undefined {
  let canonical: string | undefined;
  try {
    // `[0]` and no length test: `getCanonicalLocales` takes ONE tag here, so it returns one
    // element or it raises. A `length === 1 ? ... : undefined` ternary was the first spelling and
    // it is REMOVED, because its else branch is unreachable -- a dead branch is a branch a
    // coverage threshold pays for and no honest test can cover. `noUncheckedIndexedAccess`
    // already types this `string | undefined`, which is the answer the ternary was inventing.
    const canonicalised = Intl.getCanonicalLocales(tag);
    canonical = canonicalised[0];
  } catch (error) {
    // A malformed tag raises `RangeError`, and THAT is the refusal this function answers for.
    // Anything else is a fault of the platform rather than of the tag, so it propagates
    // untouched: swallowing it would turn an engine defect into a document written in a
    // language nobody chose. `useUnknownInCatchVariables` is on, hence the narrowing.
    if (!(error instanceof RangeError)) {
      throw error;
    }
    canonical = undefined;
  }
  if (canonical === undefined || canonical.includes(UNICODE_EXTENSION)) {
    return undefined;
  }
  return canonical;
}

/**
 * Whether THIS ENGINE honours a language tag EXACTLY AS WRITTEN -- the question a RENDER is
 * judged on -- returning the canonical spelling on success and `undefined` on refusal.
 *
 * ## Why the question exists at all, when `Intl` accepts everything
 *
 * Because `Intl` accepting everything is the failure. MEASURED on Node 24.11.1 / ICU 77.1, host
 * `fr-FR`: `Intl.NumberFormat('zz').resolvedOptions().locale` is `'fr-FR'`, `'xx-YY'` is
 * `'fr-FR'`, `'fr-XX'` is `'fr'`. No error, no warning -- a document written in the render
 * server's language, plausible and printable and wrong in a way nothing downstream can detect.
 * That is the exact defect ADR 0003 refuses when it writes that this package "ne lit rien de
 * l'environnement -- ni horloge, ni fuseau, ni locale, ni ICU", and the one lot E6 cannot
 * survive.
 *
 * The test is EQUALITY WITH THE CANONICAL TAG, and it names no locale of its own. That matters:
 * a check written against the host's locale would itself be an environment read, and a check
 * written against a closed tuple would make Openview the holder of a language referential --
 * `README.md:17` refuses that, and MEASURED, a tuple of the six obvious tags refuses `de-DE`,
 * `br-FR`, `es-419` and `zh-Hans-CN`, which are legitimate.
 *
 * ## Why it runs at RENDER and never at parse
 *
 * See the seam note above {@link wellFormedLocale}. In one line: its answer depends on the CLDR
 * data of the machine that asks -- MEASURED at 527 accepted tags against 525 between two ICU
 * builds -- so a stored document gated on it would open on one machine and not on another, and
 * `'en-FR'` is one of the two tags that move.
 *
 * ## Both formatters are asked
 *
 * And the redundancy is measured rather than assumed: over 3 944 well-formed non-extended tags,
 * `NumberFormat` and `DateTimeFormat` NEVER disagreed (213 accepted by both, 3 731 refused by
 * both, zero disagreements). That is not a proof that they cannot -- they are backed by different
 * CLDR data files, and the lot's own CI runs two ICU versions (`node: [24, 26]`) -- and the
 * failure the second call guards is SILENT: dates in the host's language under a locale numbers
 * honour. The cost is one object per RENDER, not per value, because {@link resolvePresentation}
 * runs this once and hands the result on.
 *
 * The comparison is written as ONE condition rather than two, so no branch of this function is
 * unreachable on an ICU where the two agree. A dead line is a line a coverage threshold pays for
 * and no test can honestly cover.
 */
export function honouredLocale(tag: string): string | undefined {
  const canonical = wellFormedLocale(tag);
  if (canonical === undefined) {
    return undefined;
  }
  // The pinned options below do NOT move `resolvedOptions().locale` -- MEASURED on nine tags,
  // `numberingSystem`, `calendar`, `timeZone`, `style` and the two fraction bounds all leave it
  // untouched -- so a bare constructor is enough here, and the formatters built later agree.
  if (
    new Intl.NumberFormat(canonical).resolvedOptions().locale !== canonical ||
    new Intl.DateTimeFormat(canonical, { timeZone: 'UTC' }).resolvedOptions().locale !== canonical
  ) {
    return undefined;
  }
  return canonical;
}
```

#### Le critère de coupure, énoncé une fois pour toutes

> **Un champ STOCKÉ ne peut être jugé que par un verdict identique sur toute machine.**

Ce n'est ni « ce qui est cher », ni « ce qui est tôt ». C'est la seule ligne qui rende un format
portable, et elle tombe exactement entre les deux questions :

| | `wellFormedLocale` | `honouredLocale` |
| :--- | :--- | :--- |
| **Question posée** | ce tag respecte-t-il la grammaire BCP-47, et est-il sans `-u-` ? | **ce build** embarque-t-il un fichier de locale pour ce tag ? |
| **Nature de la réponse** | **grammaire**, spécifiée par ECMA-402 | **donnée**, portée par CLDR |
| **Porte** | **parse** (`PresentationSchema`) | **rendu** (`resolvePresentation`) |
| **Verdict stable entre ICU ?** | ✅ **oui** — 0 divergence sur 31 933 tags | ❌ **non** — 527 contre 525 |
| **Exportée du barrel ?** | non | non |

#### 🆕 R-16 — « honoré » est une POLITIQUE d'Openview, pas la capacité d'ICU, et il faut le dire

Le dossier appelait `honouredLocale` un test de ce que « *ce build connaît le tag* ». **C'est
inexact, et l'inexactitude est du côté sévère** — ce qui est le bon côté, mais pas une raison de
ne pas la nommer.

[mesuré, Node v24.11.1 / ICU 77.1] :

```
tag            canonique       égalité   supportedLocalesOf   resolvedOptions().locale
en-Latn-US     en-Latn-US      REFUSÉ    supporté             en
fr-Latn-FR     fr-Latn-FR      REFUSÉ    supporté             fr
ca-ES-valencia ca-ES-valencia  REFUSÉ    supporté             ca-ES
ha-Latn-NG     ha-Latn-NG      REFUSÉ    supporté             ha
es-005         es-005          REFUSÉ    supporté             es
zz             zz              REFUSÉ    NON supporté         fr-FR  <- la locale de l'HÔTE
```

**Trois faits, et ils ne disent pas la même chose :**

1. **Un tag qu'ICU « supporte » n'est pas un tag qu'ICU rend *tel quel*.** ICU **minimise** :
   `en-Latn-US` est résolu en `en`, ce qui est *correct* linguistiquement et *différent* de ce que
   l'auteur a écrit.
2. **`supportedLocalesOf` ne peut pas remplacer l'égalité**, et c'est mesuré : sur un balayage de
   **2 080 tags bien formés**, il en accepte **2 080** contre **43** pour l'égalité — il répond
   « oui » à `fr-US`, `fr-Latn`, `fr-419`, qui s'impriment tous en `fr`. Il teste « la **langue**
   est connue », jamais « le **tag** est honoré ».
3. **Il fait pourtant une chose que l'égalité ne fait pas seule** : il isole exactement le repli
   sur l'**hôte** (`zz` → `[]`), qui est le défaut central du lot.

> ⛔ **L'énoncé correct, et c'est celui que `D-06` doit porter :** *une écriture est honorée si et
> seulement si les deux formateurs résolvent son tag **vers lui-même**.* C'est une **politique
> d'Openview**, strictement plus stricte qu'ICU, et elle a un **coût nommable** : l'auteur doit
> écrire le tag **minimisé**. `en` et non `en-Latn-US` ; `ca-ES` et non `ca-ES-valencia`.
>
> **Ce que la politique achète en échange**, et c'est ce qui la justifie : elle est la seule
> formulation où « le document dit ce qu'il imprime » reste vrai **caractère pour caractère**. Un
> `en-Latn-US` accepté imprimerait en `en` — donc un document dont l'intention stockée et la sortie
> divergent, exactement le défaut pour lequel [D-07] refuse de **rogner** un `-u-` plutôt que de le
> refuser. **La politique est cohérente ; c'est sa description qui ne l'était pas.**
>
> **Conséquence directe sur `D-06b` (le Designer avertit) :** l'avertissement doit distinguer
> **deux causes**, sinon il est inutilisable. `Intl.NumberFormat.supportedLocalesOf([tag])` non
> vide **et** égalité fausse ⇒ « *ce tag est connu, écrivez-le sous sa forme courte : `en`* ».
> `supportedLocalesOf` vide ⇒ « *ce tag est inconnu de ce moteur* ». Le premier message est
> **actionnable**, le second ne l'est pas — et aujourd'hui le résolveur ne rend ni l'un ni l'autre,
> seulement `undefined` (**R-09**, **A-7**).

#### Deux découvertes de la remesure, qui corrigent le dossier lui-même

**① La preuve de stabilité syntaxique de la réattaque était VIDE.** Elle affirmait que les deux
ensembles de tags qui lèvent sont identiques sur les deux ICU. [mesuré] c'est vrai — **parce qu'ils
sont tous deux vides** :

```
$ node s6-work/y1-split-sweep.mjs
raises          0 0   diff77only= []  diff76only= []
syntaxAccepted  31772 31772   diff77only= []  diff76only= []
```

Le corpus de 31 772 tags, fait de tags à 2 lettres, 3 lettres et 2 lettres + région, est
**entièrement bien formé par construction** : il ne touche jamais la frontière qu'il prétendait
mesurer. **La conclusion était juste ; l'argument ne l'établissait pas.** Un corpus de frontière de
**161 tags** a donc été ajouté — les **26 tags grandfathered** de BCP-47, **80 alias dépréciés**,
**51 malformations** systématiques (`''`, `'fr_FR'`, `'fr--FR'`, `'root'`, `'@'`, `'fr@euro'`,
`'de-DE.UTF-8'`, `'en-a-bbb-a-ccc'`, sous-étiquettes trop longues, variantes dupliquées) :

```
corpus size 161 | ICU 77.1 vs 76.1
raise verdict divergences : 0
SYNTAX verdict divergences: 0
canonical spelling drift  : 2        (cls -> 77:sa 76:cls ; nbx -> 77:gll 76:ekc)
raises on 77 (50): ["1","12","en-GB-oed","i-ami",…,"fr-Latn-Latn"]
```

**50 tags lèvent, exactement les mêmes sur les deux builds.** La frontière est touchée, et elle ne
bouge pas.

**② `en-US-posix` décide où porte le test du `-u-`, et il l'a décidé contre l'intuition.**

```
en-US-posix  =>  en-US-u-va-posix
```

Un tag qui **ne porte aucun `-u-`** se canonicalise **en un tag qui en porte un**. Le corpus en
contient huit dont la forme canonique porte `-u-` ; `en-US-posix` est le seul dont la forme écrite
n'en porte pas. **Conséquence directe : le test du `-u-` DOIT porter sur la forme canonique.** Un
test sur le tag brut aurait laissé passer celui-là au parse **et** au rendu, et le contrat aurait
remis à `Intl` l'extension qu'il affirme refuser. La conception d'origine avait raison ; elle
n'avait pas ce contre-exemple. Il est désormais épinglé par un test [§3.10] **et** par la mutation
**M29** [§5].

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Réunir les deux fonctions en une, ou remonter l'honorat au parse | **porte 4** — c'est la mutation **M28**, ☠️ **tuée** par le test « *STORES a well-formed tag this engine does not know* » |
| Porter le test du `-u-` sur le tag brut | **porte 4** — mutation **M29**, ☠️ **tuée** par l'assertion `en-US-posix` |
| Retirer l'un des deux formateurs de l'honorat | **aucune porte** — mutations **M02** / **M03**, **survivantes**, et le motif est écrit : les deux formateurs n'ont jamais divergé sur 3 944 tags, donc en retirer un ne change rien d'**observable**. Le garde est écrit contre un futur possible, pas contre un présent mesuré |
| Un `catch {}` vide à la place du `throw` | **porte 1** — `no-silent-catch`, AGENTS.md §1.3 |
| `new Intl.NumberFormat()` à arité zéro | **porte 1** — mordu, **contrôle négatif joué** [§3.0] |
| Normaliser le tag avant de le stocker | **aucune porte** — c'est une décision, écrite dans la docstring : le schéma **ne normalise pas**, donc la dérive `cls → sa` n'atteint jamais le stockage |

> ⚠️ **La seule plage non couverte de tout le lot est dans ce fichier**, et c'est assumé :
> `if (!(error instanceof RangeError)) { throw error; }`. Elle **ne peut pas** être couverte
> honnêtement — la signature prend un `string`, et sur un `string` `getCanonicalLocales` ne lève
> que `RangeError`. La couvrir exigerait un cast qu'AGENTS.md §1.1 interdit ; la supprimer
> violerait §1.3. **Trois lignes, nommées, plutôt qu'un `catch` muet.**

---

### 3.3 `packages/core/src/presentation/schemas.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable. 193 lignes**, dont **deux schémas exportés**, **deux
prédicats d'objet non exportés**, **un schéma de champ factorisé**, **une expression régulière** et
**deux messages constants**.

C'est le fichier des refus. Tout ce qu'il refuse est décidable **au save time** et **sans données**
— sauf la moitié que C-1 a fait descendre au rendu, et c'est précisément la ligne que ce fichier
doit rendre visible.

```ts
import { z } from 'zod/v4';
import { wellFormedLocale } from './locale.js';
import {
  DATE_STYLES,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  type Presentation,
} from './types.js';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const INVERTED_BOUNDS_MESSAGE =
  'minFractionDigits is above maxFractionDigits. A writing prints at least its minimum and at most its maximum, so the pair has to be ordered.';

/**
 * Refuses a pair of fraction bounds in the wrong order, ONCE the rest of the object is sound.
 *
 * ## Why `.check` with a payload, and not `.refine` or `.superRefine`
 *
 * For the reason `style/schemas.ts` measured on its own empty-style guard, transposed to a
 * cross-field invariant: a CONTINUABLE fault on one of the two fields (`too_big`, `too_small`,
 * `invalid_type` on a non-integer) leaves that field OUT of the payload's value, so a predicate
 * that reads it sees `undefined`, compares it, and adds a SECOND issue for the SAME fault. Two
 * issues for one mistake is the defect the execution of lot C5 discovered, and the remedy this
 * repository already states is not another predicate but a CUT-OFF RULE -- `checkTableWiring`
 * walks the rows only when the column list itself is sound, "because an author who has one
 * thing to fix must be told once".
 *
 * `.check` is the one zod 4 form that can express it, because its payload carries `issues`
 * beside `value`. `z.superRefine`'s context does not, which is why the pairing this repository
 * adopted at commit `bca73f6` -- `.check(z.superRefine(fn))`, used by `ast/schemas.ts` and
 * `page/schemas.ts` -- is the WRONG one here and the right one there: those two guards have no
 * cut-off to express.
 *
 * The path is `maxFractionDigits` and not the empty path. An issue with an empty path is
 * precisely the defect for which `z.strictObject` was refused elsewhere in this package: it
 * names the object rather than the field, and an editor cannot put a marker on it.
 *
 * The code is `custom`, which is NOT an entry in `SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` or
 * `LIMIT_ERROR_CODES`. Lots C4 and C5 each shipped zero new error codes; this lot ships zero
 * as well, and zero new error sites.
 */
const refuseInvertedBounds = (payload: z.core.ParsePayload<Presentation>): void => {
  if (payload.issues.length > 0) {
    return;
  }
  if (payload.value.minFractionDigits <= payload.value.maxFractionDigits) {
    return;
  }
  payload.issues.push({
    code: 'custom',
    message: INVERTED_BOUNDS_MESSAGE,
    path: ['maxFractionDigits'],
    input: payload.value,
  });
};

const fractionDigitsSchema = z
  .int(
    'A number of fraction digits is a whole number, present on every writing: 2 for cents, 0 for a count, never 2.5',
  )
  .min(
    MIN_FRACTION_DIGITS,
    `A number of fraction digits cannot be negative (minimum ${MIN_FRACTION_DIGITS})`,
  )
  .max(
    MAX_FRACTION_DIGITS,
    `A writing declares at most ${MAX_FRACTION_DIGITS} fraction digits, the finest rounding a model can declare (MAX_ROUND_DECIMALS). Past it, the digits could only come from a value nobody rounded`,
  );

/**
 * The Zod side of the writing contract.
 *
 * ## The locale check here asks the SYNTACTIC half of the question, and only that half
 *
 * `Presentation.locale` is a `string`, and a `string` forbids nothing -- the reproach
 * `style/types.ts` levels at its own `Color` alias. Here saying so is not enough, because the
 * failure mode is not a wrong colour but a SILENT ENVIRONMENT READ: MEASURED, `'zz'` and
 * `'xx-YY'` come back as the host's locale from `Intl` with no error at all. So the guard is
 * this schema plus {@link resolvePresentation}, and neither of them is optional.
 *
 * ⛔ BUT THE TWO HALVES ARE NOT INTERCHANGEABLE, AND THIS ONE IS THE PORTABLE HALF. What this
 * schema asks is {@link wellFormedLocale}: BCP-47 grammar, no `-u-` extension. What it must NOT
 * ask is whether the reader's ICU KNOWS the tag, because that answer moves between builds --
 * MEASURED, 527 tags honoured on ICU 77.1 against 525 on ICU 76.1, `'en-FR'` among the two that
 * move -- and a stored document gated on a moving answer opens on one machine and not on
 * another. `'zz'`, `'xx-YY'` and `'fr-XX'` therefore PARSE, and are refused later by
 * {@link resolvePresentation}, at render, where a machine-dependent answer belongs. The full
 * argument is the seam note in `locale.ts`; it is the most considered decision of this lot and it
 * is not a relaxation of the guard, it is a relocation of one half of it.
 *
 * It is a `.refine` on the FIELD rather than a `.check` on the object, and the reason is the one
 * the cut-off above is about: a field-level refusal carries the path `['locale']` and produces
 * exactly ONE issue, because `.refine` is skipped when the underlying `z.string()` has already
 * failed. An object-level check would have to re-derive which field was at fault.
 *
 * `.refine` and not `.superRefine`: the repository migrated `.superRefine(fn)` to
 * `.check(z.superRefine(fn))` at commit `bca73f6` because the bare method is deprecated in zod
 * 4; `.refine` is not, and `expression/identifiers.ts` and `expression/schemas.ts` use it for
 * exactly this shape of single-field predicate.
 *
 * ## No `z.ZodType<Presentation>` annotation, on this schema or any other in this file
 *
 * The obligatory pattern of AGENTS.md 1.2 targets the RECURSIVE AST and only it. Nothing here
 * is recursive, and `style/schemas.ts` measured what the annotation costs twice over: annotating
 * a schema and then AMPUTATING a field from the object compiles at exit 0, because `z.infer` of
 * an annotated schema yields the ANNOTATION. The real guard is the key assertion in
 * `presentation/__tests__/`.
 *
 * ## What this schema does NOT do
 *
 * It does not normalise. A tag that parses comes out as the author wrote it, `'FR-fr'` included
 * -- {@link resolvePresentation} is what canonicalises, at render time, where the canonical form
 * is actually needed. Normalising on parse would rewrite the author's document, which is the
 * objection `style/schemas.ts` records against folding the case of a colour.
 *
 * It does not check the currency against a register, and it never will: see
 * {@link Presentation.currency}. It does not check that a locale and a currency belong together
 * -- `fr-FR` with `USD` is a legitimate French-language invoice in dollars, and deciding
 * otherwise would be a business rule, which AGENTS.md forbids this package outright.
 */
export const PresentationSchema = z
  .object({
    locale: z
      .string()
      .refine(
        (tag) => wellFormedLocale(tag) !== undefined,
        'A locale must be a structurally valid language tag under ECMA-402, carrying no "-u-" extension: "fr-FR", "en-GB", "zh-Hans-CN". Whether a given engine HONOURS the tag -- resolves it to itself rather than to something shorter -- is a separate question, asked at render time, because its answer depends on the ICU build that opens the document rather than on the document',
      ),
    currency: z
      .string()
      .regex(
        CURRENCY_PATTERN,
        'A currency is an ISO 4217 alphabetic code in upper case, three letters: "EUR", "USD", "JPY". Lower case is refused so that one currency has one spelling',
      ),
    minFractionDigits: fractionDigitsSchema,
    maxFractionDigits: fractionDigitsSchema,
    dateStyle: z.enum(DATE_STYLES, 'A date style is one of "short", "medium", "long", "full"'),
  })
  .check(refuseInvertedBounds);

const UNNAMED_WRITING_MESSAGE =
  'A writing needs a name, and the empty string is not one: it is the one name a caller cannot ask for on purpose.';

/**
 * Refuses a table entry whose key is empty, ONCE nothing else is wrong with the table.
 *
 * ## Why not `z.record(z.string().min(1), ...)`, which is the obvious spelling
 *
 * MEASURED, and it is the reason this helper exists at all. A key schema that fails yields
 * `code: 'invalid_key'`, `path: []` and the message `"Invalid key in record"` -- ZOD'S OWN
 * message, not the one passed to `.min(1)`, on the EMPTY path. That is the untyped refusal this
 * repository spends its entry points removing: it names the table rather than the entry, and an
 * editor has nothing to put a marker on.
 *
 * Written here, the same fault yields a `custom` issue whose path IS the offending key, so a
 * Designer can highlight the row. The cut-off is the one `refuseInvertedBounds` states: an
 * entry that is itself unsound has already been named, and an author who has one thing to fix
 * must be told once.
 */
const refuseUnnamedWriting = (payload: z.core.ParsePayload<Record<string, Presentation>>): void => {
  if (payload.issues.length > 0) {
    return;
  }
  for (const name of Object.keys(payload.value)) {
    if (name === '') {
      payload.issues.push({
        code: 'custom',
        message: UNNAMED_WRITING_MESSAGE,
        path: [name],
        input: payload.value,
      });
    }
  }
};

/**
 * The stored table: writings by the name the MODEL AUTHOR chose.
 *
 * The KEY is validated, minimally: it must not be empty -- see {@link refuseUnnamedWriting} for
 * the measured reason that check is written by hand rather than declared on the key schema.
 * Nothing else about a name is this package's business; see {@link PresentationTable}.
 *
 * ⚠️ MEASURED, and it is the reason `resolvePresentation` exists as a function rather than as a
 * property read: `z.record` DROPS a `__proto__` key from its input (so this field cannot pollute
 * a prototype), but the object it RETURNS inherits from `Object.prototype` all the same. On a
 * table parsed from `{"ok": {...}}`, `Object.keys` yields `['ok']` and `table['constructor']`
 * yields a FUNCTION. A naive `presentations[writing]` therefore answers something non-`undefined`
 * for names nobody declared.
 */
export const PresentationTableSchema = z
  .record(z.string(), PresentationSchema)
  .check(refuseUnnamedWriting);
```

#### La coupure — D-16, et pourquoi elle n'est pas un détail de forme

Le défaut que ce fichier évite a été **découvert à l'exécution de C5** : un même faute produisait
**deux issues**. La cause est mécanique et vaut pour tout invariant croisé écrit naïvement — une
faute **continuable** sur un des deux champs (`too_big`, `too_small`, `invalid_type` sur un
non-entier) laisse ce champ **hors** de la valeur du payload, donc un prédicat qui le lit voit
`undefined`, le compare, et **ajoute une seconde issue pour la même faute**.

Le remède n'est pas un prédicat de plus, c'est une **règle de coupure** — `if (payload.issues.length
> 0) return;` — et le dépôt l'énonce déjà pour `checkTableWiring` : « *un auteur qui a une chose à
corriger doit se l'entendre dire une fois* ».

| Forme | Peut exprimer la coupure ? | Employée ici ? |
| :--- | :--- | :--- |
| `.refine(fn)` sur l'**objet** | ❌ ne voit pas les issues déjà présentes | non |
| `.superRefine(fn)` nu | ❌ **déprécié** en zod 4 (migré au commit `bca73f6`) | non |
| `.check(z.superRefine(fn))` | ❌ le contexte ne porte pas `issues` | non — c'est la forme **juste ailleurs** (`ast/`, `page/`), parce que ces gardes n'ont **pas** de coupure à exprimer |
| **`.check(payload => …)`** | ✅ le payload porte `issues` **à côté de** `value` | **oui, les deux** |

[mesuré] **toutes les entrées du tableau de refus rendent exactement 1 issue.** La coupure tient.

> ⚠️ **Le chemin est `['maxFractionDigits']`, jamais le chemin vide.** Une issue à chemin vide
> nomme l'**objet** et non le **champ** : un éditeur n'a rien où poser un marqueur. C'est
> exactement la raison pour laquelle `z.strictObject` a été refusé ailleurs dans ce paquet.
>
> ⚠️ **Et `refuseUnnamedWriting` existe parce que l'orthographe évidente est mauvaise, et c'est
> mesuré.** `z.record(z.string().min(1), …)` rend `code: 'invalid_key'`, `path: []` et le message
> **de zod** (`"Invalid key in record"`) — pas celui passé à `.min(1)`. Écrit à la main, le même
> défaut rend un `custom` **dont le chemin EST la clé fautive**, donc une ligne qu'un Designer peut
> surligner.

#### Le message de la locale a été RÉÉCRIT, et c'est du fond

L'ancien accusait l'auteur d'une faute de la machine :

> ~~« A locale must be a BCP-47 tag **this engine honours exactly as written** […] A tag ICU does
> not know […] silently resolves to the host machine's language »~~

Le nouveau ne décrit que ce que l'auteur a écrit, **et nomme l'autre porte** — c'est la seule
manière qu'a un message de parse d'être vrai sur toutes les machines qui liront le document. Le
test l'épingle par trois assertions dont **une négative** (`not.toContain('honours exactly as
written')`), pour qu'un retour en arrière rougisse [§3.10].

> 🆕 **Et il a été réécrit une seconde fois (R-16), sur deux mots.** « *well-formed **BCP-47*** »
> était faux par excès : [mesuré] `Intl.getCanonicalLocales('en-GB-oed')` lève un `RangeError`,
> alors qu'`en-GB-oed` est un tag *grandfathered* **valide en BCP-47** — le dossier compte
> lui-même **50 tags qui lèvent** et cite celui-là en tête [§3.2]. Ce que `wellFormedLocale`
> teste est la **validité structurelle au sens d'ECMA-402**, qui est un sous-ensemble strict.
> Et « *whether a given engine KNOWS the tag* » est devenu « *HONOURS the tag — resolves it to
> itself rather than to something shorter* », parce qu'ICU **connaît** `en-Latn-US` et ne
> l'honore pas : la porte de rendu est une **politique**, pas une capacité.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Un champ ajouté au schéma et pas à l'interface (ou l'inverse) | **porte 3**, par `PRESENTATION_KEYS_IN_STEP` [§3.10] — l'assertion est une **annotation**, donc c'est `type-check` qui la joue |
| Une **dérive de type** d'un champ (le schéma dit `string`, l'interface dit `number`) | **porte 3**, par `PRESENTATION_VALUES_IN_STEP` |
| Un champ qui passe **optionnel** dans un objet dont tous les champs le seraient | **aveugle** dans le cas général — [C5, mesuré] — mais **sans objet ici** : `Presentation` n'a **aucun** champ optionnel |
| Retirer la coupure `if (payload.issues.length > 0) return;` | **porte 4** — c'est la mutation **M13**/**M14** pour l'une, et le test « *reports ONE issue per fault, never two* » |
| Annoter `PresentationSchema: z.ZodType<Presentation>` puis **amputer** un champ | **aucune porte** — [C5, mesuré] cela compile à exit 0, parce que `z.infer` d'un schéma annoté rend **l'annotation**. C'est pourquoi l'annotation est **refusée** ici, et pourquoi le vrai garde est le test |
| Remettre l'honorat dans ce `.refine` | **porte 4** — mutation **M28**, ☠️ tuée |

---

### 3.4 `packages/core/src/presentation/resolve.ts` — **nouveau — la seule porte qui interroge la machine**

**Compilé à exit 0 dans le bac à sable. 117 lignes** mesurées, **~135 après A-7** [⚠️ à
remesurer], dont **une fonction de dix-huit lignes**. La couverture mesurée était de **100 %** ;
elle est **à rejouer**, parce qu'A-7 change les quatre sorties et R-15 a déplacé une branche vers
`locale.ts`.

> ✅ **A-7 est TRANCHÉ (2026-08-20) : résultat discriminé, forme structurelle conservée.** Cette
> fonction rend désormais un `PresentationResolution` et non plus un `Presentation | undefined` ;
> `Presentation` reste la **forme stockée**, et `formatMoney` / `formatDecimal` / `formatDate`
> restent **trois fonctions libres** prenant une écriture en second argument. Ce qui a été
> **refusé** dans le même geste : le formateur-objet (`w.money(v)`), qui fermait `E4-10` par une
> signature mais invalidait toute la campagne du [§C]. **`E4-10` reste donc une obligation
> documentaire**, et l'ADR 0008 doit recopier le tableau des cinq familles pour la rendre
> opposable — c'est la contrepartie explicite du choix. Développement en [§8, A-7].
>
> ⛔ **Bénéfice qu'il faut nommer, parce qu'il ne se voit pas :** les quatre sorties de cette
> fonction étaient **indistinguables** — un même `undefined` pour trois causes plus une. Une
> mutation qui échangeait deux refus était donc **invisible à tout test**. Avec le résultat
> discriminé, chacune des quatre est **assertable**, et la matrice de mutation gagne trois cibles
> tuables qu'elle n'avait pas.

```ts
import { honouredLocale } from './locale.js';
import { PresentationSchema } from './schemas.js';
import type { PresentationResolution, PresentationTable } from './types.js';

/**
 * Picks ONE writing out of a template's table, by the name the CALLER asks for, and hands back a
 * VALIDATED copy whose locale is canonical -- or the REASON there is none.
 *
 * ## This is where the caller chooses, and the only place anything chooses
 *
 * The name is an ARGUMENT. It is not read from `RenderRequest` -- `ports/render.ts` says "There
 * is no third field on purpose" and this lot does not add one -- it is not read from
 * `RenderRequest.data`, whose keys belong to the integrator and would have to be reserved, and
 * it is not read from the machine, which is the whole subject. So the three questions separate
 * cleanly: the MODEL declares what it SAYS (its words, with `if(eq(path(...), 'fr'), 'Facture',
 * 'Invoice')`, which lots C1 and C5 already ship) and HOW it is WRITTEN (this table); the CALLER
 * picks WHICH of the declared writings; the machine is never asked.
 *
 * ## `Object.hasOwn`, and it is not defensive programming
 *
 * MEASURED: `z.record` drops a `__proto__` key, so a stored table cannot pollute a prototype --
 * but the object it returns INHERITS from `Object.prototype`, so `table['constructor']` is a
 * function and `table['toString']` is one too. Written `presentations[writing]`, this function
 * would answer a non-`undefined` for at least eleven names nobody declared, whose `.locale` is
 * `undefined` -- and `Intl.NumberFormat(undefined, opts)` is precisely the arity-zero read of
 * the host's locale that AGENTS.md lists among the linter's declared blind spots. The lookup is
 * guarded so that the blind spot is unreachable rather than merely unlikely.
 *
 * `expression/identifiers.ts` already refuses `__proto__`, `constructor` and `prototype` as
 * scope-binding names, for the sibling reason. Here the names are the AUTHOR's and cannot be
 * restricted -- a writing legitimately called `"constructor"` is silly but not illegal -- so the
 * guard is on the READ instead of on the key.
 *
 * ## ⛔ THIS FUNCTION IS THE ONLY GATE THAT ASKS THE MACHINE, AND IT ASKS THE WHOLE WRITING
 *
 * Two obligations meet here, and an earlier draft honoured them one third of the way.
 *
 * FIRST, THE HONOUR TEST, which this function alone runs. `PresentationSchema` deliberately does
 * not -- see the seam note in `locale.ts`: `resolvedOptions().locale === canonical` answers
 * differently on two ICU builds (MEASURED, 527 tags accepted against 525, `'en-FR'` among the two
 * that move), so a stored document gated on it would not be portable. Placing it HERE keeps the
 * guarantee whole, because nothing else builds the writing the engine formats with.
 *
 * SECOND, THE WHOLE OBJECT IS RE-PARSED, and not merely its locale. The argument for revalidating
 * is that `Presentation` is a structural type and A TEMPLATE IS NOT ALWAYS PARSED: a designer
 * builds one in memory, a test writes a literal, an integrator composes one in TypeScript, and
 * none of those paths meets `PresentationSchema`. THAT ARGUMENT HOLDS WORD FOR WORD FOR
 * `currency` (a `string`) AND FOR THE TWO BOUNDS (two `number`s) -- only `dateStyle` is protected
 * by the type, because it is a literal union. An earlier draft revalidated ONE of the three
 * fields the type does not protect, and MEASURED, the other two escaped as exceptions out of
 * functions typed `string | undefined`: `currency: 'AB'` raises `RangeError: Invalid currency
 * code : AB`, and `minFractionDigits: 5, maxFractionDigits: 2` raises `RangeError:
 * maximumFractionDigits value is out of range.`. A `safeParse` of the whole object closes all
 * three at once, and it costs no more than the single check it replaces.
 *
 * `parseTemplate` sets the precedent -- it bounds the shape before migrating AND after -- and the
 * cost EARNS its place here rather than in the formatters: this runs ONCE PER RENDER, the
 * formatters run once per value.
 *
 * WHAT IT STILL DOES NOT REACH: a caller that skips this function and calls a formatter with a
 * writing of its own making. That is written down as an obligation with an owner -- E4-10 in the
 * barrel, "the engine never builds a `Presentation` by hand" -- which is the geometry this lot
 * applies to its ten other expectations.
 *
 * ⚠️ AN EARLIER DRAFT ADDED "no mechanism in `core` can prevent that", AND THAT IS FALSE. One
 * exists: this function could return a FORMATTER -- an object closing over the three functions and
 * over the writing it validated -- so that no public overload takes a hand-built `Presentation`.
 * ARBITRATION A-7 CONSIDERED IT AND REFUSED IT (2026-08-20), keeping the free functions and the
 * stored shape, and taking the discriminated result instead. The ground was not elegance: the
 * formatter object would have invalidated the whole measured campaign -- 33 tests on two ICU
 * builds, 29 mutations, the export count -- for a hole whose only reachable caller is the lot that
 * writes the engine. THE CONSEQUENCE IS ACCEPTED AND MUST BE WRITTEN WHERE IT BINDS: E4-10 stays
 * an obligation, and ADR 0008 carries the table of the five fault families verbatim, so that the
 * obligation is citable rather than merely documented.
 *
 * ## ⛔ THE ORDER OF THE TWO IS A CORRECTNESS DECISION, AND AN EARLIER DRAFT GOT IT BACKWARDS
 *
 * `safeParse` runs FIRST. The honour test runs on the tag the schema has already accepted.
 *
 * An earlier draft ran the honour test first, on the ground that it kept both refusal paths of
 * {@link honouredLocale} reachable through this function. That ground was real and it was
 * OUTWEIGHED, because reading `declared.locale` before validating it re-opens the very hole the
 * `safeParse` was added to close. `Presentation` is a STRUCTURAL type: `locale` is a `string` by
 * annotation only, and a caller in plain JavaScript can hand a `null`. MEASURED:
 * `Intl.getCanonicalLocales(null)` raises `TypeError: Cannot convert undefined or null to object`
 * -- NOT a `RangeError` -- so the catch in {@link wellFormedLocale} RE-THROWS it by design
 * (swallowing a non-`RangeError` would turn an engine defect into a document in nobody's
 * language). The exception therefore escapes a signature that promises `Presentation | undefined`,
 * which is the same class of fault as the four `RangeError` families the `safeParse` was written
 * to stop, one gate earlier.
 *
 * WHAT THE OLD ORDER BOUGHT, AND HOW IT IS PAID FOR INSTEAD: with the schema first, the syntactic
 * half of {@link honouredLocale} can no longer refuse anything THROUGH THIS FUNCTION, because the
 * schema already refused every malformed tag. That branch is covered by a DIRECT test of
 * {@link honouredLocale} instead -- the predicates are not exported from the barrel, but the test
 * file lives inside this package and imports `./locale.js` like any sibling. A branch covered by
 * a unit test is not a dead branch; a `TypeError` out of a total signature is a defect.
 *
 * ## ⛔ ONE ABSENCE PER DOOR -- AND THIS DOOR HAS THREE CAUSES, SO IT NAMES THEM
 *
 * An earlier draft returned `Presentation | undefined` under the heading "one absence, one cause,
 * twice over", and then listed THREE causes in the next sentence: no such writing, a writing this
 * engine does not honour, a writing that would not have parsed. THE HEADING WAS THE CONTRACT AND
 * THE SENTENCE WAS THE TRUTH. `T | undefined` is this package's idiom wherever there is genuinely
 * one cause -- `civilDateOf`, `dayNumberOf`, `resolveTypography`, and {@link formatMoney}, whose
 * single cause really is a non-finite value -- and applying it here merged three different faults
 * with three different remedies into one silence.
 *
 * So this function returns {@link PresentationResolution}. THE OTHER DOOR IS UNCHANGED:
 * {@link formatMoney} still answers `string | undefined`, because THE VALUE having no written
 * form is one cause and stays one. The two absences are now two different TYPES rather than two
 * readings of one `undefined`, which is what expectation E4-8 asked a reader to do by hand.
 *
 * STILL NO NEW ERROR CODE, and the claim is narrower than it looks so it is worth spelling out:
 * nothing is thrown, no class joins `errors.ts`, and `SHAPE_ERROR_CODES`,`OPERAND_ERROR_CODES`
 * and `LIMIT_ERROR_CODES` are untouched. What the lot DOES add to its public surface is a third
 * tuple of string literals beside `DATE_STYLES` and `PAGE_FIELDS` -- one that names THIS
 * PACKAGE'S OWN GATES, not a fact about the world. And it adds ZERO exported VALUES: both new
 * types erase at emit, so the barrel's count stays at 126 (MEASURED premise, to be re-run).
 *
 * On success the object is a COPY, with the canonical tag substituted -- `'FR-fr'` in, `'fr-FR'`
 * out (MEASURED, both are the same locale and only the second compares equal to itself) -- and it
 * is the object `safeParse` built, so a key the schema does not know is gone from it. It is never
 * the stored object: `template/migrate.ts` measured what sharing one costs, when a module-level
 * page was handed out by reference and a caller's normalisation reached back into a later,
 * unrelated parse.
 */
export function resolvePresentation(
  presentations: PresentationTable | undefined,
  writing: string,
): PresentationResolution {
  // ONE conditional read rather than an early return followed by a narrowing, and the reason is
  // coverage rather than brevity: `noUncheckedIndexedAccess` types the index read
  // `Presentation | undefined`, so a separate `if (declared === undefined)` after a successful
  // `Object.hasOwn` is a branch NO test can reach -- MEASURED, it was the one uncovered range of
  // this file. Folded into the ternary, every path below is exercised by an ordinary test.
  const declared =
    presentations !== undefined && Object.hasOwn(presentations, writing)
      ? presentations[writing]
      : undefined;
  if (declared === undefined) {
    // THE CALL is wrong: a name nobody declared, or no table at all.
    return { ok: false, refusal: 'unknown-writing' };
  }
  // The schema runs BEFORE anything reads a field, and that order is a CORRECTNESS decision --
  // see the note above. `declared` is a structural `Presentation`, so `locale` is only a `string`
  // by TYPE: a caller in plain JavaScript can hand a `null`, and `Intl.getCanonicalLocales(null)`
  // raises a `TypeError` (MEASURED) that `wellFormedLocale` RE-THROWS, since its catch narrows to
  // `RangeError`. Parsing first turns that exception into the answer this signature promises.
  const parsed = PresentationSchema.safeParse(declared);
  if (!parsed.success) {
    // THE DOCUMENT is wrong, and portably so: this entry never met the schema, and no engine
    // would have accepted it. The issues themselves are NOT forwarded -- a caller that wants
    // them parses the table with `PresentationTableSchema`, which is what a Designer does.
    return { ok: false, refusal: 'invalid-writing' };
  }
  const locale = honouredLocale(parsed.data.locale);
  if (locale === undefined) {
    // NEITHER is wrong: the document is portable and the call is correct, and THIS ENGINE does
    // not honour the tag as written. This is the one refusal a Designer must not blame on the
    // author -- see `PresentationRefusal`, and the fourth member it deliberately does not have.
    return { ok: false, refusal: 'unhonoured-locale' };
  }
  // `parsed.data` is what zod built, so a key the schema does not know is already gone; the spread
  // substitutes the canonical spelling and nothing else. `'FR-fr'` in, `'fr-FR'` out.
  return { ok: true, writing: { ...parsed.data, locale } };
}
```

#### C-2 — la revalidation complète, et le défaut était plus large qu'annoncé

La réattaque annonçait **deux** `RangeError` (bornes inversées, `currency: 'AB'`) et un repli
silencieux (`'zz'`). [mesuré] sur le JS émis **avant** correction, écritures bâties à la main :

| écriture bâtie à la main | `formatMoney` | `formatDecimal` | `formatDate` |
| :--- | :--- | :--- | :--- |
| `locale: 'zz'` | `"1 234,50 €"` **(hôte)** | `"1 234,50"` **(hôte)** | `"19 août 2026"` **(hôte)** |
| `locale: 'i-klingon'` | **RangeError** *Incorrect locale information provided* | **RangeError** | **RangeError** |
| `locale: ''` | **RangeError** | **RangeError** | **RangeError** |
| `currency: 'AB'` | **RangeError** *Invalid currency code : AB* | `"1 234,50"` | `"19 août 2026"` |
| `min 5 > max 2` | **RangeError** *maximumFractionDigits…* | **RangeError** | `"19 août 2026"` |
| `min: -1` | **RangeError** *minimumFractionDigits…* | **RangeError** | `"19 août 2026"` |
| `min: 2.5` | `"1 234,50 €"` | `"1 234,50"` | `"19 août 2026"` |

**Trois corrections au constat de la réattaque :**

1. **Quatre familles de `RangeError`, pas deux.** La locale **malformée** en est une, et la
   réattaque ne l'avait pas vue parce qu'elle n'a testé que `'zz'`, qui est bien formé.
2. **`formatDate` lève aussi.** La réattaque ne visait que les deux formateurs de nombres ;
   **aucun des trois n'est exempt.**
3. **`min: 2.5` ne lève pas** — ICU accepte un non-entier, le schéma le refuse. **La revalidation
   gagne donc un cas de plus que l'exception ne signalait.**

D'où le `safeParse` **complet** : trois champs sur cinq ne sont pas protégés par le type (`currency`
est un `string`, les deux bornes sont des `number`) ; seul `dateStyle` l'est, parce que c'est une
union littérale. **Un tiers du travail avait été fait ; il en manquait deux.**

> ⛔ **L'ORDRE DES DEUX GESTES A ÉTÉ INVERSÉ — R-15, et c'est une correction de fond.**
> La rédaction précédente appelait `honouredLocale(declared.locale)` **avant** le `safeParse`, au
> motif que l'ordre inverse rendrait la **moitié syntaxique** de `honouredLocale` inatteignable
> *par cette fonction*. Le motif était réel ; il est **surclassé par une mesure** :
>
> ```
> Intl.getCanonicalLocales(null)  ->  TypeError: Cannot convert undefined or null to object
> ```
>
> **Un `TypeError`, pas un `RangeError`** — donc le `catch` de `wellFormedLocale` le **relance**,
> à dessein (avaler autre chose qu'un `RangeError` transformerait un défaut de moteur en document
> écrit dans une langue que personne n'a choisie). Une écriture bâtie à la main portant
> `locale: null` — que la revalidation existait précisément pour intercepter — **traversait donc
> la signature `Presentation | undefined` en exception**, un cran avant la porte censée l'arrêter.
> C'est la **cinquième** famille du tableau C-2, et elle échappait à son remède.
>
> **Ce que l'ancien ordre achetait, et comment il est payé autrement.** La branche syntaxique de
> `honouredLocale` n'est plus atteignable *depuis le résolveur* : elle est couverte par un **test
> direct de `honouredLocale`**. Les deux prédicats ne sont pas exportés du **barrel**, mais le
> fichier de test vit **dans le paquet** et importe `./locale.js` comme n'importe quel voisin —
> c'est déjà ce que fait le `describe` de la locale [§3.10]. **Une branche couverte par un test
> unitaire n'est pas une branche morte** ; un `TypeError` hors d'une signature totale est un
> défaut. Le premier se corrige par un `it`, le second par personne.
>
> **Bénéfice de bord, conservé :** `parsed.data` **est** la copie — construite par zod, donc
> débarrassée des clés que le schéma ne connaît pas ; le spread ne substitue que la graphie
> canonique. La règle « ne jamais rendre l'objet stocké » tient, et le test l'épingle par
> `Object.keys(resolved).toHaveLength(5)`.
>
> ⚠️ **À remesurer :** la couverture de `resolve.js` et `locale.js` était de **100 %** dans
> l'ancien ordre. Le nouvel ordre déplace une branche du résolveur vers `locale.ts` ; le chiffre
> **n'a pas été rejoué**, et l'incrément doit le mesurer plutôt que de le recopier.

#### `Object.hasOwn` — D-15, et ce n'est pas de la programmation défensive

[mesuré] `z.record` **écarte** une clé `__proto__` de son entrée — donc ce champ ne peut pas
polluer un prototype — mais l'objet qu'il **rend** hérite de `Object.prototype` malgré tout. Sur
une table parsée depuis `{"ok": {…}}`, `Object.keys` rend `['ok']` et `table['constructor']` rend
une **fonction**.

Écrite `presentations[writing]`, cette fonction répondrait donc un non-`undefined` **pour au moins
onze noms que personne n'a déclarés**, dont le `.locale` vaut `undefined` — c'est-à-dire
`Intl.NumberFormat(undefined, opts)`, **l'appel d'arité zéro qu'AGENTS.md liste parmi les angles
morts déclarés du linter**, et que tout ce lot existe pour rendre inatteignable. La garde est sur
la **lecture**, et non sur la clé, parce que les noms appartiennent à l'auteur : une écriture
légitimement appelée `"constructor"` est saugrenue, elle n'est pas illégale.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Remplacer `Object.hasOwn` par une lecture d'index nue | **porte 4** — test « *answers undefined for a name nobody declared, including the inherited ones* » |
| Retirer le `safeParse` (**le correctif C-2**) | **porte 4** — mutation **M27**, ☠️ **tuée** par « *REVALIDATES all five fields* » |
| Rendre `declared` au lieu de `parsed.data` | **porte 4** — mutation **M05**, ☠️ tuée par l'assertion de canonicalisation et par le compte de clés |
| **Remettre l'honorat AVANT le `safeParse`** | **porte 4** — c'est désormais un test : « *answers undefined, and does not throw, for a writing whose locale is `null`* ». ⚠️ Il exige un appelant non typé ; le fichier de test le fabrique **sans cast** en passant par un `JSON.parse` d'une table littérale, faute de quoi `AGENTS.md §1.1` interdirait de l'écrire |
| Un appelant qui **saute** cette fonction et bâtit une `Presentation` à la main | ⛔ **aucune porte, et c'est un choix ASSUMÉ depuis A-7** — c'est **E4-10**, une obligation avec un propriétaire [§3.6], et l'**ADR 0008 recopie le tableau des cinq familles** pour la rendre opposable. ⚠️ Le dossier écrivait « *aucune porte n'est possible dans `core`* » : **c'était faux** (R-14), une porte existait — le formateur-objet — et elle a été **pesée puis refusée**, pas ignorée [§8, A-7] |
| **Échanger deux refus** (`'unknown-writing'` ↔ `'invalid-writing'`) | **porte 4** — 🆕 possible **depuis A-7 seulement** : avant, les quatre sorties étaient un même `undefined`, donc cette mutation était **invisible**. Trois cibles tuables de plus dans la matrice |

---

### 3.5 `packages/core/src/presentation/format.ts` — **nouveau — trois fonctions totales, et pas un seul `Date`**

**Compilé à exit 0 dans le bac à sable. 215 lignes**, dont **trois fonctions exportées**, **une
fonction privée de trois lignes** et **une constante**. [mesuré] **couvert à 100 %**.

```ts
import { dayNumberOf } from '../expression/civil-date.js';
import type { Presentation } from './types.js';

/**
 * Milliseconds in a civil day. The only arithmetic between a date of this package and `Intl`.
 *
 * `expression/civil-date.ts` yields a DAY NUMBER -- days since 1970-01-01, "an arbitrary origin
 * here, not a clock" -- and `Intl.DateTimeFormat.prototype.format` accepts a NUMBER of
 * milliseconds. So the whole conversion is one multiplication, and NOT ONE `Date` OBJECT IS
 * BUILT anywhere in this lot. That is not a stylistic win: `new Date(y, m, d)` builds in the
 * host time zone, the constructor is banned at every arity by `noJsRestrictedProperties`, and
 * `Date.UTC` -- which AGENTS.md does allow -- maps years 0 to 99 onto 1900 to 1999, so it would
 * silently misplace `0042-01-01`, a date `civil-date.ts` accepts.
 *
 * MEASURED at both ends of the supported range with `dateStyle: 'long'` in `fr-FR`:
 * `0001-01-01` prints `1 janvier 1` and `9999-12-31` prints `31 decembre 9999`.
 */
const MS_PER_DAY = 86_400_000;

/**
 * The zero every writing prints. `Object.is(-0, 0)` is false, and ICU can tell.
 *
 * MEASURED: `Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
 * .format(-0)` yields `"-0,00"`. A negative zero is what `0 * -1` and a discount of nothing
 * produce, and `-0,00 €` on a total line is a defect a reader will report. It is folded here and
 * NOT in the algebra, because the algebra's `-0` is arithmetically correct -- it is only its
 * WRITING that is wrong, and writing is this file's subject.
 *
 * It folds the exact negative zero and nothing else. `-0.001` written with two decimals still
 * prints `-0,00`, and that is not a bug to fix here: the value really is negative, the writing
 * really was declared to two places, and hiding the sign would be inventing a number.
 */
function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * A number written as MONEY in a declared writing, or `undefined` if the value has no written
 * form.
 *
 * ## The single cause of `undefined`
 *
 * The value is not finite. That is the only one -- see {@link resolvePresentation} for the other
 * absence and its own single cause. MEASURED, ICU prints the three non-finite doubles rather than
 * refusing them: `NaN` yields `"NaN"` and `Infinity` yields `"∞"`. Three characters that look
 * like a value on a total line are worse than no characters at all, and the algebra already
 * refuses a non-finite result with `not-finite`; this is that refusal one step later, for a
 * caller formatting a number the algebra never produced.
 *
 * ## ⛔ WHAT MAKES IT SAFE PER VALUE IS THE WRITING, NOT THIS FUNCTION -- A CORRECTION
 *
 * An earlier draft of this docstring added that the non-finite value "is what makes this function
 * safe to call per value without a second thought". THE CAUSE-OF-ABSENCE CLAIM IS TRUE; THAT
 * SECOND ONE WAS FALSE, and the correction matters more than its size. This function is total
 * over any writing {@link resolvePresentation} handed back, and over NOTHING ELSE. `Presentation`
 * is a structural type: `currency` is a `string` and the two bounds are `number`s, so a writing
 * built by hand can carry values `PresentationSchema` would have refused, and ICU RAISES on four
 * families of them -- MEASURED, every one out of a signature that promises `string | undefined`:
 *
 *     currency: 'AB'                  -> RangeError: Invalid currency code : AB
 *     min: 5, max: 2                  -> RangeError: maximumFractionDigits value is out of range.
 *     min: -1                         -> RangeError: minimumFractionDigits value is out of range.
 *     locale: 'i-klingon' (or `''`)   -> RangeError: Incorrect locale information provided
 *
 * The last of the four reaches {@link formatDate} too, so no formatter in this file is exempt.
 * And a FIFTH fault is worse than an exception because it is silent: `locale: 'zz'` prints in the
 * HOST's language, which is the exact defect this whole lot exists to remove.
 *
 * NONE OF THE FIVE IS REACHABLE THROUGH {@link resolvePresentation}, which parses all five fields
 * and runs the honour test before handing a writing on. The remedy is written as an obligation
 * rather than as a type -- E4-10 in the barrel: the engine never builds a `Presentation` by hand,
 * it uses only the one the resolver returns.
 *
 * ⚠️ AND A SIXTH FAULT, WHICH THE `safeParse` DID NOT COVER UNTIL THE ORDER WAS FIXED: a `locale`
 * that is `null` rather than a bad string. MEASURED, `Intl.getCanonicalLocales(null)` raises a
 * `TypeError`, which is re-thrown rather than caught. See {@link resolvePresentation}: the schema
 * now runs before any field is read.
 *
 * ⚠️ "AN OBLIGATION RATHER THAN A TYPE" IS A CHOICE, NOT A NECESSITY, and an earlier draft
 * presented it as a necessity. A resolver returning a FORMATTER -- these three functions closed
 * over a validated writing -- would make the hand-built case unrepresentable. ARBITRATION A-7
 * WEIGHED IT AND KEPT THESE THREE FUNCTIONS FREE (2026-08-20), because the formatter object
 * invalidated a campaign that had actually been run. So the obligation stands, and the price of
 * keeping it an obligation is paid in ADR 0008, which carries the five families above verbatim.
 * WHAT A-7 DID TAKE is the discriminated result on {@link resolvePresentation}: a refusal now
 * names its cause, which is what a Designer needs and what a bare `undefined` never gave it.
 *
 * ## What is passed to ICU, and what is deliberately not
 *
 * BOTH FRACTION BOUNDS, always, because that is what makes CLDR's currency-to-minor-units table
 * unreachable -- MEASURED, `1234.5678` in `fr-FR` prints `1 235 JPY` and `1 234,568 TND` by
 * default and `1 234,57` for both once the pair is named. That table is an ARITHMETIC, and ADR
 * 0004 decision 16 gives arithmetic to the model.
 *
 * `numberingSystem: 'latn'`, pinned. MEASURED: `ar-EG` prints `١٬٢٣٤٫٥` by default, so the
 * numbering system reaches the AMOUNTS and not only the dates. It is pinned rather than declared
 * for one reason and it is reversible: no text of this repository asks for eastern digits, and
 * ICU IGNORES AN UNKNOWN SYSTEM IN SILENCE (MEASURED -- `numberingSystem: 'zzzz'` resolves to
 * `latn` with no error), so exposing the field would oblige this contract to validate it
 * structurally, exactly as it validates a locale. The day a real Arabic invoice exists, the
 * field is one OPTIONAL entry on `Presentation` plus one stamp -- the cheapest class of change
 * this repository knows -- and a document that omits it keeps today's output.
 *
 * `roundingMode` is NOT passed, and the reason is measured rather than assumed. ICU's default is
 * `halfExpand`, and over 200 000 three-decimal money draws written to two places, rounding with
 * this repository's own `roundDecimal` in `halfExpand` BEFORE formatting agrees with formatting
 * alone on 100.0000 % of them (0 divergences). In `halfEven` the two disagree on 4.9275 %.
 * Passing a mode here would therefore be a SECOND SPELLING of the mode a `round` expression
 * already declares, and two spellings of one rounding is how two engines produce two documents.
 * The obligation that follows -- round first, then format -- belongs to the engine and is
 * written down as such; see the barrel.
 *
 * `useGrouping` is not passed: ICU's default is grouping on, which is what the roadmap's
 * "separateurs de milliers" asks for, and omitting it is the difference between taking a
 * convention and inventing one. `currencyDisplay`, `signDisplay` and `notation` are not passed:
 * each is a preference no text of this repository has asked for, and each is addable later
 * without touching a stored shape.
 *
 * A formatter is built PER CALL and never cached. A cache keyed on the writing would be STATE in
 * `core`, and state is how two renders of one document differ.
 */
export function formatMoney(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    style: 'currency',
    currency: writing.currency,
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * A number written as a PLAIN QUANTITY in a declared writing -- no currency symbol -- or
 * `undefined` if the value is not finite.
 *
 * Same single cause of absence, same pinned numbering system, same two bounds; see
 * {@link formatMoney} for every measurement behind them, INCLUDING the correction about what
 * "safe per value" does and does not mean. This function never touches `currency`, so the
 * invalid-code family cannot reach it -- MEASURED, `currency: 'AB'` prints here and raises there
 * -- but the two bound families and the malformed locale reach it unchanged.
 *
 * TWO FUNCTIONS AND NOT ONE WITH A `style` PARAMETER, and the choice is the amendment AGENTS.md
 * 3.B carries: a parameter would need a dispatch, a dispatch needs `const exhaustive: never` to
 * be safe, and the exhaustiveness would buy nothing over two total functions the compiler
 * already keeps apart. It also keeps the criterion `git grep -n "case 'round':" | wc -l` at TWO,
 * because this lot writes no new `switch` at all.
 *
 * WHICH OF THE TWO A GIVEN SITE NEEDS IS NOT DECIDED HERE, AND CANNOT BE. A model that prints
 * an order number, a quantity and a total prints three numbers, and nothing in the stored
 * document distinguishes them: the playground binds `commande.numero` (`20260014`) raw, and a
 * writing applied to every number would print `20 260 014` -- a different order. Openview cannot
 * recognise a total either, since it reserves no field name (AGENTS.md, scope rule). So the
 * choice belongs to whoever wires the values, and this lot names that as an obligation with an
 * owner rather than pretending to discharge it. See the barrel.
 */
export function formatDecimal(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * A civil date -- `YYYY-MM-DD`, this package's one date -- written in a declared writing, or
 * `undefined` when the string is not a civil date this package recognises.
 *
 * That is the only cause of absence here, and the correction {@link formatMoney} carries applies
 * to this function as well: MEASURED, a MALFORMED locale (`'i-klingon'`, `''`) raises `RangeError:
 * Incorrect locale information provided` out of this signature too, and an UNKNOWN one (`'zz'`)
 * prints the date in the host's language in silence. Neither is reachable through
 * {@link resolvePresentation}; both are why E4-10 exists.
 *
 * ## The three pinned options, and why THREE and not one
 *
 * AGENTS.md tools only `timeZone`, and the linter's silence on the other two is a blind spot
 * rather than a permission. MEASURED, on `2026-08-19` with nothing but a locale:
 *
 *     th-TH  dateStyle 'short'  ->  "19/8/69"        (Buddhist year 2569)
 *     fa-IR  dateStyle 'long'   ->  "۲۸ مرداد ۱۴۰۵"  (Persian year, eastern digits)
 *
 * A year that is off by 543 and a year that is off by 621, from a CORRECT date, with no error
 * anywhere. `calendar: 'gregory'` and `numberingSystem: 'latn'` remove both -- the same two
 * dates then print `"19/8/26"` and `"19 اوت 2026"` -- and the option WINS AGAINST THE TAG:
 * MEASURED, `ja-JP-u-ca-japanese` with `calendar: 'gregory'` prints `2026年8月19日`, not the
 * Reiwa year. (The tag could not reach here anyway -- {@link honouredLocale} refuses every
 * `-u-` extension -- but a pin that depends on another guard is a pin waiting to be removed.)
 *
 * `calendar: 'gregory'` is pinned HARD and will not become a declarable field, unlike
 * `numberingSystem`. A calendar change is a CONVERSION of the datum -- `2026-08-19` and
 * `2569-08-19` are different numbers, not two spellings of one -- and the roadmap's own caveat
 * on this lot is that "ce lot ne fait pas de conversion". `civil-date.ts` fixes the datum as
 * proleptic Gregorian; printing it in another calendar would make the document disagree with the
 * arithmetic that produced it.
 *
 * The options object is written INLINE, and that is a constraint rather than a style: AGENTS.md
 * records two measured FALSE POSITIVES of the `no-environment-read` plugin, and both are the
 * same one -- `Intl.DateTimeFormat('fr-FR', options)` with `options` declared elsewhere is
 * REFUSED, because the pattern compares source text and needs the token `timeZone` spelled in
 * this call's argument list. Hoisting the three pins into a shared constant would be refused by
 * a rule that is right for the wrong reason, and no `biome-ignore` can rescue it -- MEASURED,
 * none of the five spellings suppresses a PLUGIN diagnostic in Biome 2.5.8.
 *
 * ## Why the date is parsed here rather than trusted
 *
 * `dayNumberOf` is this package's one reader of a civil date, and it validates by ROUND TRIP, so
 * `2026-02-30` and `2025-02-29` are refused "with no month-length table and no leap-year rule
 * written by hand". Reusing it rather than slicing the string is AGENTS.md 5's non-duplication
 * rule, and it is also what keeps the accepted range identical to the algebra's -- `0001-01-01`
 * to `9999-12-31`, both measured to print.
 */
export function formatDate(value: string, writing: Presentation): string | undefined {
  const dayNumber = dayNumberOf(value);
  if (dayNumber === undefined) {
    return undefined;
  }
  return new Intl.DateTimeFormat(writing.locale, {
    timeZone: 'UTC',
    calendar: 'gregory',
    numberingSystem: 'latn',
    dateStyle: writing.dateStyle,
  }).format(dayNumber * MS_PER_DAY);
}
```

#### D-21 — **pas un seul `Date` construit**, et ce n'est pas de l'élégance

| Écriture | Verdict |
| :--- | :--- |
| `new Date(y, m, d)` | ⛔ construit **dans le fuseau de l'hôte** — et le constructeur est **banni à toute arité** par `noJsRestrictedProperties` (porte 1) |
| `Date.UTC(y, m, d)` | ✅ **autorisé** par AGENTS.md — et **piégé** : [mesuré] il projette les années **0 à 99 sur 1900 à 1999**, donc il déplacerait **en silence** `0042-01-01`, que `civil-date.ts` accepte |
| **`dayNumberOf(value) * 86 400 000`** | ✅ retenu. `civil-date.ts` rend un **numéro de jour** — « *jours depuis 1970-01-01, une origine arbitraire ici, pas une horloge* » —, `format()` accepte un **nombre de millisecondes**, et toute la conversion est **une multiplication** |

[mesuré] aux deux bouts de la plage supportée, `dateStyle: 'long'` en `fr-FR` : `0001-01-01` rend
`1 janvier 1`, `9999-12-31` rend `31 décembre 9999`. **La plage acceptée est exactement celle de
l'algèbre**, sans une table de longueurs de mois ni une règle bissextile écrites à la main — c'est
la règle de non-duplication d'AGENTS.md §5, et elle est ici gratuite.

#### D-09 — **trois options épinglées**, et l'outillage n'en couvre qu'une

AGENTS.md n'outille que `timeZone`. Le silence du linter sur les deux autres est un **angle mort**,
pas une permission — et les deux mesures suivantes suffisent à le montrer :

```
th-TH  dateStyle 'short'  ->  "19/8/69"        (année bouddhique 2569)
fa-IR  dateStyle 'long'   ->  "۲۸ مرداد ۱۴۰۵"  (année persane, chiffres orientaux)
```

Une année fausse de **543** et une année fausse de **621**, depuis une date **correcte**, **sans
aucune erreur**. Avec `calendar: 'gregory'` et `numberingSystem: 'latn'`, les mêmes rendent
`"19/8/26"` et `"19 اوت 2026"`.

Et le système de chiffres **atteint les montants**, pas seulement les dates : [mesuré] `ar-EG` rend
`١٬٢٣٤٫٥` sur un nombre. C'est pourquoi `numberingSystem: 'latn'` est épinglé sur **les trois**
formateurs et pas seulement sur celui des dates.

| Épingle | Statut | Réversibilité |
| :--- | :--- | :--- |
| `timeZone: 'UTC'` | **dur** | aucune — un autre fuseau exigerait un **instant**, et un instant est une horloge |
| `numberingSystem: 'latn'` | **dur pour ce lot, réversible** | ⚠️ le jour où une vraie facture arabe existe : **un champ optionnel + une estampille**, la classe de changement la moins chère du dépôt, et un document qui l'omet garde la sortie d'aujourd'hui. Il n'est pas exposé aujourd'hui parce qu'ICU **ignore en silence** un système inconnu ([mesuré], `'zzzz'` retombe sur `latn`), donc l'exposer obligerait à le valider structurellement |
| `calendar: 'gregory'` | **dur, et définitif** | ⛔ **aucune** — un changement de calendrier est une **conversion du datum** : `2026-08-19` et `2569-08-19` sont deux nombres différents, pas deux orthographes d'un même. La roadmap écrit que « *ce lot ne fait pas de conversion* » |

> ⚠️ **L'objet d'options est écrit EN LIGNE, et c'est une contrainte subie, pas un style.**
> AGENTS.md consigne deux faux positifs mesurés du plugin `no-environment-read`, et ce sont le
> même : `Intl.DateTimeFormat('fr-FR', options)` avec `options` déclaré ailleurs est **REFUSÉ**,
> parce que le motif compare du **texte source** et exige le jeton `timeZone` dans la liste
> d'arguments de **cet** appel. Hisser les trois épingles dans une constante partagée serait donc
> refusé par une règle **juste pour une mauvaise raison** — et aucun `biome-ignore` ne la sauve
> ([mesuré], aucune des cinq orthographes ne supprime un diagnostic de **plugin** en Biome 2.5.8).
> Le contrat **rencontre** la contrainte et la paye ; il ne retouche pas le plugin (§7).

#### Deux autres décisions incarnées ici

**Le zéro négatif est replié — et seulement l'exact.** [mesuré] `Intl.NumberFormat('fr-FR',
{min:2,max:2}).format(-0)` rend `"-0,00"`. Un `-0` est ce que produisent `0 * -1` et une remise de
rien, et `-0,00 €` sur une ligne de total est un défaut qu'un lecteur signale. Il est replié **ici
et pas dans l'algèbre**, parce que le `-0` de l'algèbre est **arithmétiquement correct** : c'est
son **écriture** qui est fausse, et l'écriture est le sujet de ce fichier. `-0.001` écrit à deux
décimales rend toujours `-0,00`, et ce n'est **pas** un bug à corriger : la valeur est réellement
négative, l'écriture a réellement été déclarée à deux places, et masquer le signe serait inventer
un nombre.

**`roundingMode` n'est PAS passé, et le motif est mesuré.** Le défaut d'ICU est `halfExpand`. Sur
**200 000** tirages monétaires à trois décimales écrits à deux places, arrondir avec le
`roundDecimal` du dépôt en `halfExpand` **avant** de formater est d'accord avec le formatage seul
sur **100,0000 %** des cas (0 divergence) ; en `halfEven`, les deux divergent sur **4,9275 %**.
Passer un mode ici serait donc une **seconde orthographe** du mode qu'une expression `round`
déclare déjà — et deux orthographes d'un arrondi, c'est ainsi que deux moteurs produisent deux
documents. L'obligation qui en découle — **arrondir d'abord, formater ensuite** — appartient au
moteur et est écrite comme telle [§3.6].

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Retirer une épingle (`calendar`, `numberingSystem`) | **porte 4** — deux tests, l'un par `toContain('2026')` **et** `not.toContain('2569')`, l'autre par **comptage de chiffres latins** sur `ar-EG` |
| Retirer une des deux bornes de fraction passées à ICU | **porte 4** — le test « *makes the CLDR currency-to-minor-units table unreachable* », qui compte les **chiffres** de `JPY`, `TND` et `EUR` et les exige **égaux** |
| Construire un `Date` | **porte 1** — `noJsRestrictedProperties`, toute arité. Et le test « *builds no Date object at all* » le rejoue à la porte 4 |
| Hisser l'objet d'options dans une constante | **porte 1** — faux positif du plugin, **connu et subi** |
| Figer une chaîne formatée dans un test | **aucune porte** — c'est une **discipline**, et elle est tenue : [mesuré] `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0** avant le symbole, le U+202F ayant été introduit par **CLDR 42 / ICU 72**. La CI tourne `node: [24, 26]` |
| Mettre en cache un formateur | **aucune porte** — refusé par décision : un cache serait de l'**état** dans `core`, et l'état est la façon dont deux rendus d'un document diffèrent |
| Passer une écriture bâtie à la main | ⛔ **aucune porte aujourd'hui** — **E4-10**, obligation documentaire. ⚠️ **R-14** : une porte **existe** — que le résolveur rende un formateur plutôt qu'un sac de champs. Arbitrage **A-7** |

---

### 3.6 `packages/core/src/presentation/presentation.ts` — **nouveau — la façade, et l'endroit où les refus sont écrits**

**Compilé à exit 0 dans le bac à sable. 111 lignes**, dont **cinq lignes d'`export`**. Le patron
est `page/page.ts`, `style/style.ts` et `ast/nodes.ts` : `page/` et `style/` sont **nés divisés**,
C3 a dû payer le découpage d'`ast/` après coup, **et ce dossier naît divisé**.

```ts
/**
 * The writing contract: what a template says about the LANGUAGE, the MONEY and the SHAPE OF THE
 * DIGITS its values take -- and the four pure functions that honour it.
 *
 * Barrel by design -- consumers import from here, never from ./types.js, ./schemas.js,
 * ./locale.js, ./resolve.js or ./format.js, so the split inside this folder stays free to
 * change. Lot C3 had to pay for that split after the fact; `page/` and `style/` were born
 * divided, and so is this folder.
 *
 * The folder is called `presentation/` and not `format/` because it is named after WHAT THE
 * MODEL DECLARES -- a table of writings, stored, versioned and migrated -- rather than after the
 * verb that consumes it, exactly as `style/` carries `Typography` and is not called `paint/`.
 *
 * ## WHAT THIS LOT ADDS FOR THE LABELS: NOTHING, AND THAT IS THE FIRST THING TO SAY
 *
 * The recipe criterion of `docs/roadmap/core.md` names five things -- "les montants, les dates,
 * les separateurs de milliers, la position du symbole monetaire, et les libelles fixes du
 * modele". THE FIFTH IS ALREADY SHIPPED, and it was shipped by lot C1. A single stored
 * `Template` prints `Facture` or `Invoice` from `if(eq(path('rendu.langue'), 'fr'), 'Facture',
 * 'Invoice')` -- measured twice on this repository's own build, once against a `dist`
 * reconstructed at HEAD. The conditional is not a workaround: it also reorders, which a table of
 * translations cannot (`Facture n° 14 — ACME` against `ACME — Invoice no. 14`).
 *
 * So this lot is about the four remaining items, all of which are the WRITING OF A VALUE, and it
 * adds no label mechanism, no message catalogue and no translation table. A catalogue would also
 * have to reserve key names, which the scope rule of AGENTS.md refuses outright.
 *
 * ## The three questions, and who answers each
 *
 * WHAT THE DOCUMENT SAYS -- the model, with `if` (lot C1, already shipped).
 * HOW A VALUE IS WRITTEN -- the model, with the table below (this lot).
 * WHICH OF THE DECLARED WRITINGS -- the caller, by passing a name to
 * {@link resolvePresentation}. Never `RenderRequest` (`ports/render.ts`: "There is no third
 * field on purpose"), never a key of `RenderRequest.data` (its names belong to the integrator),
 * never the machine.
 *
 * ## ⛔ WHAT THIS CONTRACT DOES NOT DECIDE, AND CANNOT
 *
 * WHICH SITES OF A DOCUMENT ARE WRITTEN THIS WAY. A model prints an order number, a quantity and
 * a total; the stored document does not distinguish them, and it must not -- recognising a total
 * would mean reserving a field name. The playground binds `commande.numero` (`20260014`) raw,
 * and a document-wide writing would print `20 260 014`, which designates a different order.
 *
 * The two mechanisms that WOULD express it are both refused by this lot, and the refusals are
 * of very different cost:
 *
 * - AN EXPRESSION KIND (`format(x, ...)`) is the only IRREVERSIBLE decision the design of this
 *   lot could have taken: a new kind widens a stored union, and a widened union cannot be
 *   narrowed again once a client has saved a document. It is refused on a measured ground --
 *   the motive advanced for it was that `concat` flattens its parts before a segment exists, and
 *   the only real consumer contains ZERO `concat` calls that bury a value to be written
 *   (`grep -c "concat(" apps/playground/src/App.tsx` -> 0).
 * - AN OPTIONAL FIELD ON A SEGMENT is reversible in the cheapest class this repository knows: it
 *   is the SILENT LOSS case, so it costs one stamp and one identity migration, and nothing else.
 *
 * Refusing the first is therefore free, and the second stays available for the lot that proves
 * it is needed -- which will be lot E4, in front of a real invoice. Until then the wiring is an
 * OBLIGATION ON THE ENGINE, named with its owner. `docs/roadmap/engine.md` already cuts the seam
 * there: "Le contrat sait DECRIRE un modele bilingue (core C6) ; le moteur doit L'HONORER."
 *
 * ## ⛔ The engine's obligations, in one place, because a docstring is not where they live
 *
 * Lot C5 established that the debts a contract creates are named in the ADR, with an owner, and
 * verifiable at a later lot -- not scattered through the code that creates them. This lot's list
 * belongs to ADR 0004's successor; it is repeated here only so that no reader of this barrel can
 * miss that it exists. ROUND BEFORE FORMATTING, never after (measured: formatting alone
 * contradicts a declared `halfEven` on 4.9275 % of a 200 000-draw money family, and agrees with
 * `halfExpand` on 100.0000 %). CHOOSE THE SITES, and the function, per value. RESOLVE THE
 * WRITING ONCE per render, not per value. TREAT `undefined` FROM {@link resolvePresentation} AS
 * AN AUTHORING FAULT and `undefined` from a formatter as an absent value -- ADR 0001 question 2
 * ("blanc ou echec") is still open and still the engine's. DO NOT PIN A FORMATTED STRING IN A
 * TEST: this repository's CI runs `node: [24, 26]`, hence two CLDR data sets, and MEASURED,
 * `1 234,50 €` in `fr-FR` carries U+202F between the digits and U+00A0 before the symbol, where
 * U+202F arrived with CLDR 42 / ICU 72. And, added by the reattack of this contract, NEVER BUILD
 * A `Presentation` BY HAND (E4-10): use only the one {@link resolvePresentation} returns -- it is
 * the single place that re-parses all five fields and asks whether this engine honours the tag,
 * and MEASURED, a hand-built writing reaches `Intl` with four RangeError families and one silent
 * fall-back to the host's language.
 *
 * A TENTH EXPECTATION FOLLOWS FROM THE SAME REATTACK, and it belongs to the Designer rather than
 * to the engine: A LOCALE IS NO LONGER REFUSED AS THE AUTHOR TYPES IT. Parse asks grammar only,
 * so `'zz'` is stored without complaint and refused at render. A Designer must therefore WARN
 * from {@link resolvePresentation}. That is the named price of the seam, and it is a price paid
 * to make a stored document open on every ICU build rather than on the one that wrote it.
 *
 * ## What this barrel deliberately does NOT export
 *
 * `wellFormedLocale` and `honouredLocale` -- the two halves of the locale question, split because
 * one of them is portable between ICU builds and the other is not (the seam note in `locale.ts`).
 * No consumer outside this package names either; `prefixPath` and `aliasSchema` set that
 * precedent.
 *
 * ⚠️ AN EARLIER DRAFT OF THIS PARAGRAPH ADDED "and every door that reaches `Intl` already goes
 * through it", of a single predicate. THAT WAS FALSE FOR THE EXPORTED SURFACE, and saying so is
 * the point of this warning. {@link formatMoney}, {@link formatDecimal} and {@link formatDate}
 * take a STRUCTURAL `Presentation`, so a caller can build one by hand and reach `Intl` without
 * either predicate. What IS true is narrower, and it is enough: EVERY WRITING
 * {@link resolvePresentation} RETURNS HAS PASSED BOTH. The gap between those two statements is
 * exactly E4-10 above -- an obligation, because no mechanism in `core` can close it.
 *
 * Any list of locales or currencies -- Openview holds no referential (`README.md:17`). Any
 * `scaleOf` or `declaredScaleOf` -- the writing is declared by the two bounds, so no function
 * here derives an author's intent from a value's binary form. Any bounded door of its own -- a
 * writing is never a standalone fragment, it lives on a `Template`, and `parseTemplate`
 * validates it already.
 */
export { formatDate, formatDecimal, formatMoney } from './format.js';
export { resolvePresentation } from './resolve.js';
export { PresentationSchema, PresentationTableSchema } from './schemas.js';
export type { DateStyle, Presentation, PresentationTable } from './types.js';
export { DATE_STYLES, MAX_FRACTION_DIGITS, MIN_FRACTION_DIGITS } from './types.js';
```

#### Ce qu'il force, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| Un symbole renommé dans un fichier interne et pas ici | **porte 3** (`TS2459` / `TS2305`) |
| **Un export oublié dans ce barrel** | **aucune porte** — c'est le test de compte d'exports de [§3.10], via [§3.9] |
| **Un export de TROP** — typiquement l'un des deux prédicats de locale | **porte 4** — l'assertion `not.toContain` sur les trois noms (`wellFormedLocale`, `honouredLocale`, **`declarableLocale`**, ce dernier étant épinglé pour qu'un retour à la rédaction d'avant C-1 rougisse) |
| L'ordre des lignes d'`export` | **aucune porte**, et il n'est pas indifférent : les `export … from` d'un module ESM sont évalués **dans l'ordre d'écriture**. `./format.js`, `./resolve.js` et `./schemas.js` viennent avant `./types.js`, et **aucun d'eux n'importe une valeur de `./types.js`** au runtime sauf `schemas.js` — [vérifié] sur le JavaScript émis, l'import réussit. La ligne est écrite ici pour qu'un futur contributeur ne « range » pas le fichier par alphabet sans le savoir |

> ⛔ **La façade porte une phrase FAUSSE, conservée et nommée fausse.** C'est la correction C-2, et
> la forme retenue est délibérée : la rédaction précédente affirmait « *every door that reaches
> `Intl` already goes through it* ». [mesuré] c'est **faux pour la surface exportée** — les trois
> formateurs prennent une `Presentation` **structurelle**, donc un appelant peut en bâtir une à la
> main et atteindre `Intl` sans passer par aucun prédicat. La phrase n'est pas **remplacée** par
> une phrase vraie et muette : elle est **conservée comme aveu**, à côté de la phrase plus étroite
> qui, elle, est vraie — « *toute écriture que `resolvePresentation` rend a passé les deux* » — et
> **l'écart entre les deux est nommé comme étant exactement E4-10**. C'est la règle de forme n° 2
> du dépôt : on conserve l'objection morte **avec** sa réfutation, parce que c'est la réfutation
> qu'on relira le jour d'une réouverture.

#### Les dix attentes envers l'aval, chacune avec son propriétaire — et pourquoi elles ne vivent PAS ici

C5 a inventé le geste et ce lot le reprend : **une dette vit dans l'ADR, jamais dans une
docstring**. Le barrel n'en porte qu'un rappel, pour qu'aucun lecteur ne puisse ignorer qu'elles
existent. Leur place est l'ADR successeur d'ADR 0004.

| # | Attente | Propriétaire | Vérifiable à |
| :-- | :--- | :--- | :--- |
| **E4-1** | **Choisir les sites** et la fonction, valeur par valeur | **E4**, avec arbitrage produit s'il faut ouvrir un champ de segment | E4 |
| **E4-2** | **Arrondir PUIS formater**, jamais l'inverse [mesuré : 4,9275 % de divergence en `halfEven`, 0,0000 % en `halfExpand`] | **E4** | E4, sur une facture à `halfEven` |
| **E4-3** | **Résoudre chaque écriture employée au plus une fois par rendu**, jamais une fois par valeur — ⚠️ **reformulé (R-07)** : un rendu peut légitimement en employer **plusieurs** (montants, quantités, prix unitaires) | **E4** | E4 |
| **E4-4** | **La clé d'écriture est un argument** — jamais une lecture de machine, jamais une clé réservée dans `data` | **E4**, et l'intégrateur | E4 |
| **E4-5** | Une devise inconnue **mais bien formée s'imprime elle-même** ; **aucune table de secours** | **E4** | E4 |
| **E4-6** | **L'espace insécable et sa version CLDR** — U+202F / U+00A0, arrivés avec CLDR 42 | **E4** (rendu), **E2/E5** (mise en page), **QA** (tests d'or) | E2, E4 |
| **E4-7** | Le calendrier et le système de chiffres sont **épinglés par le contrat** : ne pas les repasser, ne pas les surcharger | **E4** | E4 |
| **E4-8** | ✅ **allégé par A-7** : le résolveur rend `{ ok: false, refusal }` — **la cause survit** —, un formateur rend `undefined` (une cause). Reste à E4 : « blanc ou échec », question 2 d'ADR 0001, **ouverte** ; et un `switch` clos par `const exhaustive: never` | **E4** / **E3** | E3 |
| **E4-9** | Le viewer et le moteur emploient le **même ICU**, ou la promesse d'aperçu identique (J4) tombe | **V-lots**, **E5** | J4 |
| **E4-11** | 🆕 **Tenir cohérents les DEUX commutateurs** — les mots basculent par un `if` lisant une **donnée** (C1), les valeurs par le **nom** passé au résolveur (ce lot). Ils sont indépendants **par conception** ([D-02], **A-6**), et rien dans Openview ne voit `rendu.langue = 'fr'` servi avec l'écriture `en-usd` : **libellés français, montants en dollars**, parse vert, rendu vert | **E4** + **intégrateur** ; avertissement **Designer** | E4 |
| 🆕 **E4-10** | ⛔ **Le moteur ne construit JAMAIS une `Presentation` à la main** — il n'emploie que celle que `resolvePresentation` lui rend, c'est-à-dire la branche `ok: true` du résultat. [mesuré] **cinq** familles de fautes — quatre `RangeError`, plus un `TypeError` sur `locale: null` (R-15) — et un repli silencieux sur la langue de l'hôte sont atteignables autrement, **en une ligne, sans cast**. ⚠️ **A-7 a pesé la fermeture par signature (le formateur-objet) et l'a refusée** : l'obligation reste documentaire, et **l'ADR 0008 recopie ce tableau de cinq familles** pour la rendre opposable | **E4** | E4 |
| 🆕 **D-06b** | ⛔ **Une locale n'est plus refusée à la frappe** : le parse ne juge que la grammaire, donc `'zz'` se stocke sans plainte et se refuse au rendu. Le Designer doit **avertir depuis `resolvePresentation`** — ✅ **et depuis A-7 il en a les moyens** : le refus porte `refusal: 'unhonoured-locale'`, donc l'avertissement peut être écrit sans deviner la cause. ⚠️ Ce que le Designer doit **encore** faire lui-même : distinguer « tag inconnu » de « tag sur-spécifié dont la forme courte marcherait » (`en-Latn-US`), par un `supportedLocalesOf` de trois lignes — `core` ne le tranche pas (R-16, [§3.1]) | **lots V / Designer** | V |

> ⚠️ **Les deux dernières lignes sont neuves, et elles sont le prix nommé des corrections C-1 et
> C-2.** `D-06b` en particulier tombe dans un manque que le dossier reconnaît déjà : **le Designer
> n'a été instruit nulle part** dans ce lot.

#### Ce que le barrel n'exporte PAS, et le compte

**Neuf valeurs et cinq types** (⚠️ **trois avant A-7** : `PresentationRefusal` et
`PresentationResolution` s'y ajoutent), et rien d'autre. ⛔ **Le compte de VALEURS ne bouge pas —
il reste 126** : les deux types neufs s'effacent à l'émission, donc `style.test.ts:134` passe bien
de 117 à 126 et pas au-delà. C'est la propriété qui a rendu A-7 abordable. Le compte est mesuré au
niveau du barrel public
[§3.9] : **117 → 126**.

| Absent du barrel | Motif |
| :--- | :--- |
| `wellFormedLocale`, `honouredLocale` | aucun consommateur hors du paquet ne les nomme ; la règle anti-sur-ingénierie d'AGENTS.md refuse un export dont la seule justification est qu'il **pourrait** servir. Précédents exacts : `prefixPath` (`errors.ts`) et `aliasSchema` (`expression/identifiers.ts`), tous deux délibérément absents d'`index.ts`. ⛔ **Et scinder le prédicat en deux n'a rien ajouté à la surface** — [mesuré] 126 avant, 126 après : c'est précisément l'intérêt de ne pas l'exporter |
| `declarableLocale` | **n'existe plus** ; épinglé négativement par le test pour qu'un retour en arrière rougisse |
| toute liste de locales ou de devises | Openview ne détient **aucun référentiel** (`README.md:17`), et [mesuré] un tuple des six tags évidents refuse `de-DE`, `br-FR`, `es-419` et `zh-Hans-CN` |
| `scaleOf` / `declaredScaleOf` | **X-1 est dissous, pas contourné** : l'échelle qui compte est **déclarée** par les deux bornes, donc aucune fonction ne dérive l'intention d'un auteur de la forme binaire d'une valeur. La fonction n'est pas écrite du tout |
| une porte bornée `parsePresentation` | une écriture n'est **jamais** un fragment autonome : elle vit sur un `Template`, et `parseTemplate` la valide déjà |
| `CURRENCY_PATTERN`, `MS_PER_DAY`, `withoutNegativeZero`, les deux prédicats de `.check` | des orthographes internes ; les publier serait publier un vocabulaire de plus |

---

### 3.7 `packages/core/src/template/template.ts` — **modifié**

**Compilé à exit 0**, 204 → **258 lignes**. Le fichier du bac à sable `base/core/` est
**identique au HEAD `320bea6`** [vérifié], donc le diff ci-dessous est un diff contre le dépôt.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **un import** (ligne 4) · la section `## What version 7 means`, **36 lignes de docstring** avant la ligne 147 · **un champ**, `presentations`, avec ses 22 lignes de docstring, entre `page` et `root` |
| **Ce qui change** | **une valeur** : `CURRENT_SCHEMA_VERSION` passe de `6` à `7`, ligne **147** |
| **Ce qui ne change pas** | `Template`, `TemplateSummary` · le champ `page` et **sa docstring entière** · les sections v2 à v6, **conservées telles quelles** parce qu'elles restent vraies pour leurs versions · **aucun `z.default()` nulle part** |

#### ① L'import — ligne 4, après `PageSetupSchema`

```ts
import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import { PageSetupSchema } from '../page/page.js';
import { PresentationTableSchema } from '../presentation/presentation.js';   // ← AJOUT
```

> **Il importe le BARREL et non `../presentation/schemas.js`, et c'est délibéré.** C5 avait dû
> assumer une **dérogation mesurée** en sens inverse — son `style/types.ts` importe
> `MAX_SHEET_MM` depuis `page/types.js` plutôt que depuis le barrel, parce que le barrel fermait un
> cycle ESM `page/schemas.js → ast/nodes.js → ast/schemas.js` et produisait un
> `ReferenceError: Cannot access 'ContainerNodeSchema' before initialization`.
> **Ici il n'y a pas de cycle** : `presentation/` n'importe **rien** de `template/`, `ast/` ou
> `page/`, et sa seule arête sortante est `expression/` (deux imports, `MAX_ROUND_DECIMALS` et
> `dayNumberOf`), qui est en amont de tout le monde. [vérifié] sur le JavaScript émis : l'import
> réussit, `Object.keys(await import('./index.js'))` rend 126.

#### ② La section de version — avant la ligne 147

```ts
 * ## What version 7 means
 *
 * Version 7 is version 6 plus lot C6, the writing: ONE stored shape, `Presentation` -- a locale,
 * a currency, two fraction bounds and a date style -- and ONE accrual site, an OPTIONAL
 * `presentations` table on the template itself. No node type, no segment kind, no expression
 * kind: the union of the algebra is UNMOVED, and that is a decision rather than an accident (see
 * `presentation/presentation.ts`).
 *
 * It is the SILENT LOSS case described above, and NOT the illegible refusal -- the one field is
 * optional, so no older build meets an unknown discriminant. That makes it the dangerous class,
 * for the reason version 6 states: a version 6 build opening a version 7 document ACCEPTS IT
 * WITH NO ERROR AT ALL and strips the whole table, after which an `onSave` persists the loss and
 * every amount in the document reverts to bare stringification.
 *
 * With the stamp, that same document yields
 * `TemplateMigrationError: Template uses schema version 7 but this build understands at most 6.
 * It was written by a newer release of Openview; upgrade before opening it.` -- and THE STAMP
 * ALONE IS WHAT PRODUCES IT, independently of the new shape.
 *
 * The field is OPTIONAL and not required-with-a-compatibility-value, which is the opposite of
 * what version 5 did for `page`, and the difference is not an inconsistency. A compatibility
 * SHEET is "une decision produit, prise par le proprietaire du produit", and A4 is wrong for part
 * of the world but EXISTS everywhere; a compatibility WRITING would have to name a LANGUAGE and a
 * MONEY, and `README.md:17` is explicit that Openview holds no such referential. An absent table
 * means "this model declares no writing", which is exactly what every document written before
 * this lot declared, so the migration below has nothing to invent.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C6 before that one is
 * publishable, for the reason version 2 already records -- and "not publishable" is as WEAK here
 * as it was for C1, C2, C3 and C5 rather than as strict as for C4: this lot narrows nothing.
 */
export const CURRENT_SCHEMA_VERSION = 7;
```

#### ③ Le champ — **entre `page` et `root`**, ligne 195

```ts
  page: PageSetupSchema,
  /**
   * The writings this model declares, by the name its AUTHOR chose. Lot C6.
   *
   * OPTIONAL, with no schema default, and the two halves of that are decided separately.
   * Optional because an absent table means "this model declares no writing", which is what every
   * document written before this lot says, and because requiring it would oblige the 6 -> 7
   * migration to INVENT a language and a money for every stored document -- a referential
   * `README.md:17` says Openview does not hold. No default for the reason `page` records one
   * line above: a `z.default()` makes a document come out carrying something Openview chose, at
   * every parse, silently.
   *
   * That the field is optional is NOT what protects an older build from it. An older build strips
   * a key it does not know whether the newer schema calls it required or optional; only
   * {@link CURRENT_SCHEMA_VERSION} protects against that, and version 7 exists for this field
   * alone.
   *
   * An EMPTY table is accepted and is not the same statement as an absent one: absent says the
   * author never opened the question, empty says the author opened it and declared nothing yet.
   * Neither is refused, because a template under construction is a legitimate template -- the
   * same reason `page.header` accepts an empty band list.
   */
  presentations: PresentationTableSchema.optional(),
  root: ContainerNodeSchema,
```

> ⛔ **POURQUOI EXACTEMENT LÀ, ET PAS AILLEURS.** C5 a écrit `page` **avant** `root` avec un
> argument publié, qu'on relit ici mot pour mot : « *Written before `root` because the geometry
> precedes the content in a document's reading order, and because a field appended at the end
> blends into the optional timestamps* » [cité, `template.ts:193-194`]. Cet argument a **deux**
> moitiés, et **les deux transposent** :
>
> - **L'ordre de lecture.** `page` dit sur **quelle feuille** on écrit ; `presentations` dit dans
>   **quelle langue et quelle monnaie** on écrit. Ce sont les deux **conditions d'écriture** d'un
>   document, et elles précèdent le **contenu** exactement comme la géométrie le précède. Un
>   lecteur qui ouvre le JSON lit : voici la feuille, voici les écritures, voici ce qui est écrit.
>   Placer `presentations` **après** `root` inverserait cet ordre et rangerait une **condition**
>   derrière la chose qu'elle conditionne.
> - **Le fond de tiroir.** Un champ ajouté **à la fin** se noie parmi `createdAt` / `updatedAt`,
>   qui sont optionnels et **techniques**. `presentations` est optionnel et **porteur d'intention
>   d'auteur** : le confondre visuellement avec deux horodatages serait une faute de lisibilité que
>   C5 a déjà nommée.
>
> **Et il vient APRÈS `page` plutôt qu'avant**, parce que `page` est **requis** et
> `presentations` **optionnel** : le champ requis reste le premier des deux, et le diff ne touche
> aucune ligne voisine — une seule insertion, aucun déplacement.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| `z.literal(CURRENT_SCHEMA_VERSION)` suit la constante | **porte 3, gratuitement** — le schéma **lit** la constante (`template.ts:168`) |
| Les littéraux racine du dépôt qui écrivent `schemaVersion: CURRENT_SCHEMA_VERSION` | **aucune reprise** : ils sont dé-littéralisés depuis C2 |
| **Passer la constante à 7 sans ajouter l'entrée de migration** | **porte 4 : trois assertions rouges** — `migrate.test.ts:158-164` (liste littérale des paires), `:191` et `:210` (`toBe(6)`). ⚠️ Et `migrate.test.ts:165`, `toHaveLength(CURRENT_SCHEMA_VERSION - 1)`, **reste VERT** (6 = 6) : **il ne protège rien ici**, et c'est le littéral qui tire |
| Ajouter le champ **sans** passer la constante à 7 | **aucune porte** — et c'est exactement la **perte silencieuse** : un build v6 ouvrant le document l'accepte **sans erreur** et dépouille la table. **C'est tout le motif de l'estampille** |
| Écrire `presentations` **requis** | compilerait, et **casserait la migration** : elle devrait inventer une langue et une monnaie pour chaque document stocké |
| Un `z.default()` sur le champ | **aucune porte** — refusé par décision, et le motif est **mesuré sur `page`** : un document sans table sortirait en portant une écriture qu'**Openview** a choisie, à chaque parse, en silence |

---

### 3.8 `packages/core/src/template/migrate.ts` — **modifié**

**Compilé à exit 0**, 362 → **397 lignes**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **une** entrée `{ from: 6, to: 7 }` dans `TEMPLATE_MIGRATIONS`, **après la ligne 251** (le `},` qui ferme l'entrée 5 → 6) et **avant le `];` de la ligne 252** |
| **Ce qui change** | rien |
| **Ce qui ne change pas** | **les cinq entrées existantes ne sont PAS fusionnées** · `compatibilityPage()` · `TemplateMigration` · `readSchemaVersion`, `runMigrations`, `migrateToCurrent`, `parseTemplate` · **la seconde passe du garde de forme reste** |

#### Le geste

```ts
  {
    from: 6,
    to: 7,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the fifth time and
     * for exactly the reason the 1 -> 2 entry states.
     *
     * A v6 document is STRUCTURALLY a v7 document: lot C6 adds ONE optional field on the template
     * and widens no union, so there is nothing to transform, and the shape it yields is bounded
     * because it changes neither depth nor value count -- delta exactly 0, by construction rather
     * than by measurement, since the object spread adds no key.
     *
     * ## Why this one is a stamp and NOT a transformation, which was a real question
     *
     * Writing a COMPATIBILITY WRITING into every existing document is the alternative, and it is
     * refused on a stronger ground than the compatibility typography of the entry above. That one
     * needed a product mandate; this one could not have one. A compatibility writing names a
     * LOCALE and a CURRENCY -- `fr-FR` and `EUR`, presumably, because that is the language this
     * repository is written in -- and `README.md:17` says Openview holds no such referential,
     * while the scope rule of AGENTS.md refuses any feature that obliges an integrator to accept
     * a name Openview decided. A4 is a sheet size that exists everywhere; there is no currency
     * that exists everywhere.
     *
     * So no document written before this lot declares any writing, and that is the honest
     * outcome: its values keep the bare stringification `text()` has always produced, and the
     * engine's obligations for a template with no table are named with their owner rather than
     * left for each renderer to invent.
     *
     * The reserve of the five entries above transposes word for word: the version guard reads the
     * STAMP, not the content. A document stamped `6` but already carrying a `presentations` table
     * -- hand-made, or written by an unstamped mid-lot build -- is not refused. It parses, and
     * comes out `schemaVersion: 7`, keeping its table, because the current schema knows the field.
     */
    migrate: (input) => ({ ...input, schemaVersion: 7 }),
  },
```

#### Le motif de refus d'une écriture de compatibilité — **il n'existe pas de devise qui existe partout**

C'est la ligne la plus importante de cette sous-section, et elle est **plus forte** que celle de
l'entrée 4 → 5 :

| | 4 → 5 (`page`) | 5 → 6 (`style`) | **6 → 7 (`presentations`)** |
| :--- | :--- | :--- | :--- |
| Alternative à l'estampille | une **feuille** de compatibilité | une **typographie** de base | une **écriture** de compatibilité |
| Ce qu'elle exige | un **mandat produit** | un **mandat produit** | ⛔ **un mandat qu'on ne peut PAS obtenir** |
| Pourquoi | A4 est faux pour une partie du monde, **mais il EXISTE partout** | `family: 'Helvetica'` désigne une ressource qui peut ne pas exister sur la machine de rendu | une écriture nomme une **LANGUE** et une **MONNAIE**. `README.md:17` dit qu'Openview **ne détient aucun référentiel**, et la règle de périmètre d'AGENTS.md refuse toute fonctionnalité qui oblige un intégrateur à accepter un nom qu'Openview a décidé |
| Décision | écrite **une fois**, datée, visible | **estampille seule** | **estampille seule** |

**Le résultat honnête :** aucun document écrit avant ce lot ne déclare d'écriture, ses valeurs
gardent la stringification nue que `text()` a toujours produite, et les obligations du moteur face à
un modèle **sans** table sont nommées avec leur propriétaire [§3.6] plutôt que laissées à
l'invention de chaque renderer.

> ⚠️ **« Une migration qui ne transforme rien n'est pas une migration fantôme »** (AGENTS.md §1.2).
> Elle **estampille**, et l'estampille est **tout** ce qui produit le message lisible. Écrire
> `migrate: (input) => ({ ...input, schemaVersion: 7 })` est un travail **complet**.
>
> **La réserve des cinq entrées précédentes transpose mot pour mot** : le garde de version lit
> **l'estampille**, pas le contenu. Un document estampillé `6` mais portant **déjà** une table —
> fait à la main, ou écrit par un build de mi-lot non estampillé — **n'est pas refusé** : il parse
> et ressort en `schemaVersion: 7` **en gardant sa table**, parce que le schéma courant connaît le
> champ. C'est mesuré par le test « *carries a table through the stamp on a document that already
> had one* » [§3.10].

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Une entrée dont `migrate` n'estampille pas | **porte 4** — `runMigrations` refuse de boucler et jette `Migration 6 -> 7 left schemaVersion at …` |
| Un `from` qui ne suit pas | **porte 4** — `No migration registered from schema version 6` |
| **Fusionner les six entrées** en une 1 → 7 | **porte 4** — la liste littérale de `migrate.test.ts:158-164` |
| L'estampille sans transformation | **aucun coût de forme** : delta **0 valeur, 0 niveau**, **par construction** (le spread n'ajoute aucune clé) et non par mesure — c'est une nuance que ce plan écrit, là où C5 pouvait dire « mesuré sur `RECIPE_TEMPLATE` » |
| Écrire `{ presentations: …, ...input }` au lieu du test de valeur | **aucune porte** — le défaut est consigné dans la docstring de l'entrée 4 → 5, et **ce lot ne le recopie pas** : il n'a rien à écrire du tout |

---

### 3.9 `packages/core/src/index.ts` — **modifié — et c'est ici que le compte d'exports change**

**Compilé à exit 0**, 237 → **253 lignes**. Et le compte est **mesuré sur le JavaScript émis, pas
raisonné** : le bac à sable est compilé en ESM réel, puis `Object.keys(await import('./index.js'))`
rend **126** valeurs exportées, contre **117** avant le lot — soit **+9 valeurs**, exactement les
neuf de la liste ci-dessous.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **deux blocs `presentation/`**, insérés **ligne 199**, après `export type { TemplateStoragePort } from './ports/storage.js';` et **avant** le bloc de types de `style/` : **3 types et 9 valeurs** |
| **Ce qui change** | rien d'autre. **Aucun bloc existant ne gagne une ligne** — contrairement à C5, dont les deux tuples d'alignement vivaient dans `ast/` et obligeaient à toucher deux blocs voisins |
| **Ce qui ne change pas** | l'ordre alphabétique des blocs par chemin de module (`ast/`, `errors`, `expression/`, `page/`, `ports/`, **`presentation/`**, `style/`, `template/`) — `presentation/` s'insère **entre `ports/` et `style/`**, ce qui est sa place alphabétique et **évite un diff sur les lignes voisines** |

#### Le geste

```ts
export type {
  DateStyle,
  Presentation,
  PresentationTable,
} from './presentation/presentation.js';
export {
  DATE_STYLES,
  formatDate,
  formatDecimal,
  formatMoney,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  PresentationSchema,
  PresentationTableSchema,
  resolvePresentation,
} from './presentation/presentation.js';
```

> **L'ordre à l'intérieur du bloc de valeurs n'est pas alphabétique au sens naïf**, et ce n'est pas
> un oubli : c'est l'ordre que `biome check --write` produit (les majuscules et les minuscules
> triées ensemble, casse ignorée), appliqué au bac à sable puis recopié. **Le fichier est linté
> comme le reste** [§3.0].

#### Le compte — **mesuré, par émission ESM réelle puis import**

| | avant C6 | après C6 | delta |
| :--- | --: | --: | --: |
| **Valeurs exportées** | **117** *(mesuré)* | **126** *(mesuré)* | **+9** |
| Types exportés | 90 *([déduit], relevé de C5)* | **95** | **+5** *(3 + 2 depuis A-7)* |
| Total nominal | 207 | **221** | **+14** |

**Les neuf valeurs :** `DATE_STYLES`, `MAX_FRACTION_DIGITS`, `MIN_FRACTION_DIGITS`,
`PresentationSchema`, `PresentationTableSchema`, `formatDate`, `formatDecimal`, `formatMoney`,
`resolvePresentation`.
**Les cinq types :** `DateStyle`, `Presentation`, `PresentationTable`, et — **depuis A-7** —
`PresentationRefusal` et `PresentationResolution`. Les deux derniers ne sont **pas** une forme
stockée : ce sont des types de **retour**, rien ne les persiste, et les élargir ne coûte **aucune
estampille** [§3.1].

> ⚠️ **Le chiffre des TYPES reste raisonné, et le plan l'écrit plutôt que de le masquer.** Un type
> n'apparaît pas dans `Object.keys` d'un module JavaScript : la seule mesure possible porte sur les
> **valeurs**. C'est la limite que `style/__tests__/style.test.ts` énonce déjà, et le test de ce lot
> la réénonce en commentaire au lieu de la faire oublier.
>
> ⛔ **Et le compte est INCHANGÉ par la scission de C-1** [mesuré] : `wellFormedLocale` et
> `honouredLocale` sont **tous deux absents** de la surface, comme l'était `declarableLocale`.
> **Scinder un prédicat en deux n'ajoute rien à la surface publique** — c'est précisément l'intérêt
> de ne pas l'exporter, et c'est ce qui a permis d'appliquer C-1 sans toucher au compte.

#### ⛔ Le test du dépôt qui rougit

`packages/core/src/style/__tests__/style.test.ts:134` écrit :

```ts
    expect(values).toHaveLength(117);
```

**Cette ligne devient `126`**, et elle est **le seul filet mécanique du barrel public**. Elle
appartient à l'incrément qui ajoute les exports (INC-5), pas à une annexe : un lot qui la corrige
avant d'ajouter ses neuf valeurs a mis le filet en défaut au lieu de le faire tirer.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Un symbole exporté qui n'existe pas dans `presentation/presentation.js` | **porte 3**, `TS2305` |
| **Un symbole OUBLIÉ dans ce barrel** | **aucune porte** — rien ne compare la surface publique à l'intention. C'est le **contrôle négatif du compte** de [§3.10] : la boucle `toContain` sur les neuf noms, **plus** le `toHaveLength(126)` |
| **Un symbole EN TROP** — l'un des deux prédicats de locale | **porte 4** — les trois `not.toContain` de [§3.10] |
| Exporter `CURRENCY_PATTERN` ou `MS_PER_DAY` | compilerait ; refusé par décision (un vocabulaire interne publié) |
| Exporter une assertion `*_IN_STEP` | **impossible** : elles vivent dans `__tests__/`, que `packages/core/tsconfig.json` **exclut de `dist`** |

---

### 3.10 `packages/core/src/presentation/__tests__/presentation.test.ts` — **nouveau**

**Compilé à exit 0** (par `tsconfig.verif.json`, donc **type-checké comme la CI le fait**) et
**exécuté** : **585 lignes, 33 `it`, 102 `expect`**, `assertions: 33 passed, 0 failed` **sur ICU
77.1 ET sur ICU 76.1**.

> ⚠️ **Le contenu détaillé de ce fichier — les sept règles d'assertion, les entrées `N01`…`N23`, le
> tableau de rendu `R01`…`R11` et les 29 mutations — est le §5 de ce plan.** Cette sous-section
> décrit sa **structure** et les trois choses qui appartiennent au contrat plutôt qu'au plan de
> test : ce que le compilateur y joue, la discipline d'assertion, et ce que le harnais ne prouve
> pas.

#### La structure — sept `describe`, et chacun répond d'une décision

| `describe` | `it` | Ce qu'il verrouille |
| :--- | --: | :--- |
| *the public surface of the writing contract* | 2 | le compte **126**, les neuf noms présents, les **trois** noms absents, et la liaison `MAX_FRACTION_DIGITS === MAX_ROUND_DECIMALS === 15` |
| *a locale is judged twice, and the two judgements are deliberately not the same* | 4 | ⛔ **la couture C-1** : les quatre tags qu'un tuple clos oublie, le tag bien formé **stocké puis refusé au rendu**, le `-u-` refusé **au parse** (avec `en-US-posix`), le tag malformé pris **par le `RangeError`** |
| *every refusal is named once, with a path and a legible message* | 5 | **une issue par faute**, le chemin sur le **champ**, le message réécrit de la locale (dont un `not.toContain`), la devise, les cinq champs manquants, le style de date et le nom vide |
| *picking a writing out of a table* | 5 | `Object.hasOwn` et les noms **hérités**, la table absente, ⛔ **la revalidation des cinq champs (C-2)**, la copie et le compte de clés |
| *a number is written the way the model declared, and never the way ICU would* | 6 | l'aller-retour par `Number()`, **la table CLDR inatteignable comptée en chiffres**, les deux bornes, la queue IEEE-754, les trois doubles non finis, le zéro négatif, **une valeur deux écritures** |
| *a date is written in the calendar the contract pins, not the one the locale prefers* | 5 | le calendrier grégorien, les chiffres latins, **une date deux écritures**, la plage exacte de l'algèbre, **aucun `Date` construit** |
| *the stored shape, its stamp and its migration* | 6 | l'estampille **7**, l'entrée `6 → 7` enregistrée, la migration **sans transformation**, la table **portée à travers** l'estampille, table vide **≠** table absente |

#### Les deux assertions que le COMPILATEUR joue, et le trou qu'elles n'ont pas ici

```ts
export const PRESENTATION_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PresentationSchema>,
  keyof Presentation
> = true;

export const PRESENTATION_VALUES_IN_STEP: MutuallyAssignable<
  z.infer<typeof PresentationSchema>,
  Presentation
> = true;
```

`keyof` attrape la **présence** — un champ retiré du schéma, un champ ajouté ; la paire de valeurs
attrape une **dérive de type**. [C5, mesuré sur une matrice de huit mutations] **aucune des deux ne
subsume l'autre**, et les deux réunies restent aveugles à **un champ qui devient optionnel dans un
objet dont tous les champs le seraient**.

⛔ **Ce troisième angle mort N'EXISTE PAS ICI** : `Presentation` n'a **aucun** champ optionnel.
C'est une propriété du contrat, pas une chance — et c'est la seule raison pour laquelle ce lot n'a
qu'**une** paire d'assertions là où C5 en avait **huit**.

Elles sont écrites `const` et non `it`, parce qu'il n'y a **rien à exécuter** : le garde est
l'**annotation**, et c'est `pnpm run type-check` qui la joue. Elles sont **exportées** pour ne pas
être signalées inutilisées par `noUnusedLocals`.

#### La discipline d'assertion — **aucune chaîne formatée n'est figée nulle part**

C'est la contrainte la plus structurante du fichier, et elle est **mesurée** plutôt que prudente :
[mesuré] `1 234,50 €` en `fr-FR` porte **U+202F** (espace fine insécable) entre les chiffres et
**U+00A0** avant le symbole, et le U+202F est arrivé avec **CLDR 42 / ICU 72**. La CI tourne
`node: [24, 26]`. **Une chaîne figée casserait sur l'une des deux.**

| Propriété à démontrer | Forme d'assertion employée, sans chaîne figée |
| :--- | :--- |
| la valeur survit à l'écriture | `Number(printed) === value`, sur une écriture sans groupement |
| la table CLDR devise est inatteignable | **comptage de chiffres** : `JPY`, `TND` et une devise inconnue rendent **les mêmes chiffres** qu'`EUR` |
| le calendrier est épinglé | `toContain('2026')` **et** `not.toContain('2569')` / `not.toContain('1405')` |
| le système de chiffres est épinglé | comptage de chiffres **latins** sur `ar-EG` |
| le trou de locale existe | **égalité contre le tag, jamais valeur d'hôte** : `Intl.NumberFormat('zz').resolvedOptions().locale !== 'zz'` |
| deux écritures, un modèle | `formatMoney(v, FR) !== formatMoney(v, EN)` **et** mêmes chiffres |
| le zéro négatif | `formatMoney(-0, FR) === formatMoney(0, FR)` |

> ⛔ **Le test n'a JAMAIS besoin de l'arité zéro**, et c'est ce qui lui permet de passer Biome :
> `Intl.NumberFormat('zz')` porte un tag **explicite**, donc le plugin `no-environment-read` ne
> mord pas ([mesuré] : le fichier passe), et la propriété — « *un tag inconnu retombe sur la
> machine* » — est démontrée **sans jamais figer la locale de l'hôte**. Le test est donc vrai sur
> n'importe quelle machine et n'importe quel ICU.
>
> ⚠️ **Et les tags employés restent tous dans l'INTERSECTION des deux ensembles honorés.** C'est
> vérifié par la verdeur sur les deux binaires, **et le test de couture le dit explicitement** :
> aucun tag divergent (`en-FR`, `cls`) n'y est nommé, **délibérément** — un test qui s'appuierait
> sur un tag divergent serait exactement le défaut que C-1 corrige, retourné contre le harnais.

#### Une correction de rédaction qui mérite d'être écrite

Le premier jet du fichier écrivait `{ dateStyle: 'iso' } as unknown as Partial<Presentation>`.
[mesuré] **le plugin `no-double-cast` ne l'a PAS vu** — ce qui est exactement ce qu'AGENTS.md
annonce (« revue humaine uniquement » pour certaines formes). Il a été **retiré**, pas annoté : le
helper `firstIssue` prend un `unknown`, donc **aucun cast n'est nécessaire**. C'est la seule
manière de traiter un angle mort d'outillage : supprimer le besoin, jamais l'annoter.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Toute régression de C-1 (l'honorat remonté au parse) | **porte 4** — mutation **M28**, ☠️ tuée par « *STORES a well-formed tag this engine does not know* » |
| Toute régression de C-2 (le `safeParse` retiré) | **porte 4** — mutation **M27**, ☠️ tuée par « *REVALIDATES all five fields* » |
| Le test du `-u-` porté sur le tag brut | **porte 4** — mutation **M29**, ☠️ tuée par l'assertion `en-US-posix` |
| L'honorat entièrement retiré | **porte 4** — mutation **M26**, ☠️ tuée **deux fois** |
| Retirer un des deux formateurs de l'honorat | ⚠️ **aucune porte** — **M02 / M03 survivent**, et le motif est écrit [§3.2] |
| Le shim `vitest` qui masquerait un matcher manquant | ⚠️ **risque du harnais, nommé en [§3.0]** : ce serait un `TypeError`, pas un échec d'assertion. Le fichier n'emploie aucun matcher hors des douze implémentés [vérifié] |

---

### Le récapitulatif des portes, pour ce §3 seul

| Porte | Commande | Verdict |
| :--- | :--- | :--- |
| **1 — Biome** | `biome check --config-path=. packages/core/src` sur la réplique | **`Checked 10 files. No fixes applied.`** — 0 erreur, 0 avertissement, **tests compris**, et **le contrôle négatif mord d'abord** |
| **2 — build** | `pnpm run build` | ⚠️ **NON JOUÉ** — aucune entrée `exports`, aucun fichier hors `src`, aucune dépendance ajoutée. **[déduit]** |
| **3 — type-check** | `tsc -p core/tsconfig.json --noEmit` **et** `tsc -p core/tsconfig.verif.json --noEmit` | **exit 0** des deux côtés, **tests compris** |
| **4 — tests** | shim ESM, deux binaires | **33 / 33** sur **ICU 77.1** et sur **ICU 76.1** |

**Zéro `biome-ignore`** dans tout le lot [mesuré] : 2 occurrences du mot, **toutes deux en prose**
(`format.ts` et le fichier de test), dans une phrase disant qu'aucun `biome-ignore` ne sauve un
diagnostic de plugin. **Aucune directive de suppression.**

**Couverture — le substitut, et son arithmétique.** Métrique : lignes de JavaScript **émis**,
commentaires et lignes vides retirés, règle `coverage.include` du dépôt appliquée des deux côtés.

| Grandeur | Valeur |
| :--- | ---: |
| `packages/core/src` (arbre de travail) | **2 008** |
| après C6 (bac à sable) | **2 158** |
| delta net mesuré | **+150** |
| dont **imputables au lot** | **+158** (`presentation/` **150**, `migrate.js` +5, `template.js` +2, `index.js` +1) |
| dont **dérive du bac à sable**, non imputable | **−8** (voir l'avertissement de [§3.0]) |
| **non couvertes par les seuls tests du lot** | **3** — la plage `locale.js:116-118`, **et elle seule** |
| **couverture propre du lot** | **98,10 %** (155 / 158) |

Soit `A` le taux agrégé de `packages/core/src/**` avant le lot ; la CI est verte, donc `A ≥ 90`.

```
agrégat = (A/100 × 2008 + 155) / 2166
A = 90  ->  90,59 %      A = 95  ->  95,23 %      A = 100  ->  99,86 %
```

> ⛔ **Dans le pire cas — un dépôt posé exactement sur le plancher — l'agrégat MONTE à 90,59 %.**
> Un lot dont le taux propre dépasse l'agrégat ne peut que le faire monter, et le seuil du dépôt
> est sans `perFile`, donc aucun fichier n'est jugé isolément. ⚠️ **Ce chiffre reste un
> substitut** : `@vitest/coverage-v8` n'a **pas** été joué [§3.0].

---

## §C — La campagne de mesure

Cette section existe pour une raison unique : **le lot C6 est un lot dont presque toutes les
décisions sont des affirmations sur le comportement d'ICU**, et une affirmation sur ICU qui n'a pas
été exécutée est une opinion. Le dossier a donc été mesuré en cinq vagues — une récolte, une
campagne de rattrapage (`m1`), une attaque par l'outillage (`v2`), un contrat compilé (`s1`), et une
réattaque suivie d'un remesurage intégral (`s5`/`s6`). Ce qui suit en donne les commandes, les
sorties, et — c'est la moitié qui compte — **ce qui n'a pas été mesuré**.

**Trois conventions tenues partout dans cette section :**

1. **Un chiffre porte sa commande.** Un chiffre sans commande est marqué [déduit] ou [non vérifié].
2. **Le contrôle négatif passe avant le contrôle positif.** Un harnais qui ne rougit jamais ne
   prouve rien, et le dossier a produit au moins un cas — la stabilité syntaxique de la réattaque
   (§C.4.3) — où une preuve était **vide** sans que personne le voie.
3. **Aucune valeur de la machine hôte n'entre dans un test.** Les sondes qui touchent la locale ou
   le fuseau sont écrites comme des **égalités contre l'hôte**, jamais comme des valeurs attendues.
   Les chaînes `Europe/Paris` et `fr-FR` qui apparaissent dans les journaux ci-dessous sont des
   **sorties de sonde**, et elles ne doivent jamais devenir des assertions.

---

### C.0 — Contrôle d'intégrité du dépôt : deux lignes présentes, et un HEAD qui a bougé

#### C.0.1 L'arbre de travail — deux lignes, et elles ne sont pas de ce lot

```
$ cd C:/_Gargouilles/Openview && git status --porcelain
 M .claude/launch.json
 M apps/playground/vite.config.ts
```

[mesuré] **Deux lignes, pas zéro.** Les annoncer comme un arbre propre serait exactement la faute
que ce dépôt attend qu'on ne commette pas, donc elles sont nommées :

| Fichier | Origine | Rapport avec C6 |
| :--- | :--- | :--- |
| `.claude/launch.json` | réglage de l'outillage de prévisualisation, écrit par l'orchestrateur **à la demande de l'utilisateur** | **aucun** |
| `apps/playground/vite.config.ts` | idem | **aucun** |

Elles **n'ont pas été revertées, ni commentées, ni comptées comme une violation** — ce sont des
réglages d'environnement de travail, antérieurs et extérieurs à la planification du lot. **Toute
autre ligne aurait été une violation** du cadre de planification, et il n'y en a pas eu : aucun
fichier `??` n'a jamais été relevé, et aucun rapport de la campagne n'a écrit sous
`C:/_Gargouilles/Openview`.

#### C.0.2 ⛔ Le HEAD a changé pendant la vie du dossier, et il faut le dire

Le dossier écrit `320bea6` partout — `m1-mesures.md:3`, `v2-outillage.md:22`, `s6-corrections.md:52`.
[mesuré] **ce n'est plus le HEAD :**

```
$ git rev-parse HEAD
c806aaab9fe91ead5372b7a237a618a2eb841552
$ git log --oneline -2
c806aaa fix(core): fermer les switch d'operateurs et normaliser le zero negatif
320bea6 fix: rétrécir explicitement value avant String() pour Sonar (playground)
$ git log -1 --format='%ci'
2026-08-19 16:05:33 +0200
```

`320bea6` **existe toujours** (`git cat-file -t 320bea6` → `commit`) : c'est le **parent** de HEAD.
Le dépôt a donc avancé **d'un commit** pendant la campagne, et l'horodatage le situe précisément
entre la synthèse et le remesurage.

> ⛔ **CORRECTION DU 2026-08-20 (R-01) — les deux phrases ci-dessus sont fausses, et la topologie
> réelle est plus rassurante que ce qu'elles décrivent.** `320bea6` n'est **pas** le parent de
> `c806aaa` : [mesuré] `git log -1 --format='%p' c806aaa` rend **`bca73f6`**, et `320bea6` a **le
> même parent**. Ce sont des **frères**, non une lignée.
>
> ```
> $ git log -1 --format='%H %p' b3a82ea
> b3a82ea…  bca73f6 c806aaa            <- merge de la PR #25, dans main
> $ git merge-base --is-ancestor c806aaa origin/main ; echo $?
> 0                                    <- c806aaa EST dans origin/main
> $ git merge-base --is-ancestor 320bea6 origin/main ; echo $?
> 1                                    <- 320bea6 n'y est PAS : local, non poussé
> $ git log --oneline -1 origin/main
> b3a82ea Merge pull request #25 from …/fix/exhaustivite-operateurs-et-zero-negatif
> ```
>
> **Ce que cela change, et c'est dans le bon sens :** le lot est mesuré contre un état qui **est**
> dans `origin/main`. Le « HEAD qui a bougé » n'était pas une dérive de la campagne — c'était la
> **PR #25 en cours de fusion**, et elle a abouti. La base canonique du plan est donc
> **`b3a82ea`**, et les cinq campagnes mesurées « contre `320bea6` » l'ont été contre un arbre
> qui ne diffère de `bca73f6` que par un fichier de la **vitrine** (`App.tsx`, 12 insertions) —
> aucun fichier de `packages/core`, donc **aucune mesure de `core` n'est affectée** [vérifié,
> `git show --stat 320bea6`].
>
> **Ce qui reste à faire, et c'est le seul point d'action :** le `main` **local** est divergent
> (en avance de `320bea6`, en retard de `c806aaa` + `b3a82ea`). Il faut l'aligner avant de lancer
> les quatre portes en local, sans quoi elles mesurent un arbre qui n'existe pas en amont.
> Le §C.0.3 reste valide **mot pour mot** : les trois fichiers du bac à sable antérieurs à
> `c806aaa` ne doivent pas être recopiés.

**Cela explique un incident que `s6-corrections.md` §0.1 consigne sans en connaître la cause.**
Vers 16:00, `git status --porcelain` a rendu **sept** lignes au lieu de deux [mesuré, s6] :

```
 M .claude/launch.json                                              <- déclarée
 M apps/playground/vite.config.ts                                   <- déclarée
 M packages/core/src/expression/evaluator/guards.ts                 <- NON DÉCLARÉE
 M packages/core/src/expression/evaluator/operations/arithmetic.ts  <- NON DÉCLARÉE
 M packages/core/src/expression/evaluator/operations/compare.ts     <- NON DÉCLARÉE
 M packages/core/src/expression/evaluator/__tests__/arithmetic.test.ts       <- NON DÉCLARÉE
 M packages/core/src/expression/evaluator/__tests__/compare-logical.test.ts  <- NON DÉCLARÉE
```

puis à 16:07 elles avaient disparu, `arithmetic.ts` portant un mtime de **16:05:33**. [déduit, mais
la coïncidence est exacte à la seconde] **ces cinq lignes étaient le commit `c806aaa` en cours de
rédaction, puis committé** — 16:05:33 est à la fois le mtime relevé et la date du commit. Ce
n'était donc ni une écriture d'un agent de planification, ni une anomalie : c'était le propriétaire
du dépôt qui travaillait. La conclusion de `s6` — « aucune mesure contaminée, recomptage post-retour
identique à 2 008 lignes » — reste valide, et la cause est maintenant nommée.

#### C.0.3 ⚠️ Conséquence réelle et permanente : le bac à sable est périmé sur trois fichiers

Le commit `c806aaa` porte l'amendement d'`AGENTS.md` §3.B — le `default: { const exhaustive: never
= op; … }` qui ferme les `switch` d'opérateurs. [mesuré, `diff` bac à sable ↔ dépôt] :

```
DIFFERS    expression/evaluator/operations/arithmetic.ts
DIFFERS    expression/evaluator/operations/compare.ts
DIFFERS    expression/evaluator/guards.ts
```

| | |
| :--- | :--- |
| **Effet sur le lot C6** | **aucun** — `presentation/` ne touche aucun de ces trois fichiers |
| **Effet sur les chiffres** | **−8 lignes émises**, isolées et déduites de l'arithmétique de couverture (§C.7.4) |
| ⛔ **Effet sur la TRANSCRIPTION** | **ces trois fichiers ne doivent PAS être recopiés depuis le bac à sable.** Ils y sont antérieurs à `c806aaa` |

#### C.0.4 Où chaque campagne a été mesurée

Cinq campagnes, toutes contre `320bea6` — `m1` (rattrapage, `sandbox2/`), `v2` (outillage, `verif/`),
`s1` (contrat compilé, `sandbox-FINAL/`), `s5` (réattaque, `s5-work/`), `s6` (remesurage,
`s6-work/` + `sandbox-FINAL/`, relevé final à `c806aaa`).

**Aucune des quatre portes n'a été lancée dans le dépôt.** Les seules commandes qui l'ont touché
sont des **lectures** (`git status`, `git rev-parse`, `git log`, `grep`, `sed -n`, `ls`, `diff`,
`cp -r` **en source**) et l'exécution **en lecture** de trois binaires qui y résident — `tsc`,
`biome`, et la jonction vers `zod` —, tous invoqués depuis le bac à sable avec des chemins de sortie
hors dépôt.

---

### C.1 — La compilation : exit 0 sur les deux configurations, et ce que « exit 0 » ne couvre pas

#### C.1.1 Les deux configurations, et pourquoi il en faut deux

La CI joue `tsc` **deux fois** avec deux périmètres différents [vérifié,
`C:/_Gargouilles/Openview/package.json:14-20`, `packages/core/package.json:37-40`] :

| Porte | Commande réelle | Périmètre |
| :-- | :--- | :--- |
| 2 `build` | `tsc` (par paquet) | `src/**` **hors** `*.test.ts` |
| 3 `type-check` | `tsc -p tsconfig.typecheck.json` | `src/**`, **tests compris** |

Un contrat qui ne mesure que la porte 2 rate les diagnostics de la porte 3 : `v2-outillage.md`
§1.2 l'a démontré en mesurant **3 diagnostics** sur une conception concurrente (`TS2741` ×2 et
`TS2322`) **uniquement** à la porte 3, la porte 2 rendant exit 0. Le contrat retenu est donc mesuré
sur les deux.

#### C.1.2 Les commandes et leurs sorties

```bash
cd C:/_Gargouilles/Openview
node ./node_modules/typescript/bin/tsc -p <SB>/core/tsconfig.json       --noEmit   # -> exit 0
node ./node_modules/typescript/bin/tsc -p <SB>/core/tsconfig.verif.json --noEmit   # -> exit 0
```

[mesuré, `s1` §5.1 puis **rejoué à l'identique** après les corrections C-1/C-2, `s6` §7.1]
**exit 0 sur les deux, avant et après correction.**

- `tsconfig.json` **étend** le `tsconfig.base.json` **réel** du dépôt et reprend mot pour mot les
  options de `packages/core/tsconfig.json` : `module`/`moduleResolution` `NodeNext`,
  `lib: ["ES2022"]`, `types: []`, `rootDir: ./src`, la même liste `exclude` des quatre orthographes
  de test. Seules `composite`, `incremental`, `declarationMap` et `sourceMap` passent à `false` —
  elles ne produisent que des artefacts de build et rien de sémantique.
- `tsconfig.verif.json` ajoute `tools/tsconfig.typecheck.json` du dépôt et mappe `vitest` vers ses
  `.d.ts` réels. [vérifié] `--listFiles` montre `presentation/__tests__/presentation.test.ts`
  **dans le programme** et `vitest/dist/index.d.ts` résolu : le fichier de tests est réellement
  type-checké, ce n'est pas une affirmation.

C'est la configuration **stricte réelle** : `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`.

#### C.1.3 Le contrôle de fidélité du banc — et il n'est pas décoratif

[mesuré, `m1` §0.2] le `src` **intact** de HEAD compile **exit 0, sans un seul diagnostic**, sous ce
même `tsconfig`, hors dépôt, avec le seul `zod` du dépôt. Le bac à sable est donc **une réplique
fidèle et non une approximation** — c'est ce qui autorise à imputer au contrat tout diagnostic
observé ensuite.

**Deux pièges de montage, mesurés, qui coûtent une heure chacun :**

| Piège | Symptôme | Correctif |
| :--- | :--- | :--- |
| `ln -s` de Git Bash **copie** au lieu de lier (piège hérité du plan C5) | **55 faux `TS7006`** sur des rappels de `it.each` | `mklink /J` / `New-Item -ItemType Junction` |
| `package.json` sans `{"type":"module"}` | `tsc` en `NodeNext` émet du **CommonJS** — ce qui a forcé une conception concurrente à retrancher « 3 artefacts CommonJS » de son comptage à la main | déclarer `"type": "module"` dans le bac à sable |

#### C.1.4 Ce que « exit 0 » ne couvre pas — à lire avec le §C.7

`pnpm run build` **n'a pas été rejoué**. Les deux commandes ci-dessus sont `--noEmit` ; l'émission
réelle d'un `dist` avec ses `.d.ts` de production, `composite: true` et `declarationMap`, **n'est pas
mesurée**. [non vérifié]

---

### C.2 — Le linter : le contrôle négatif d'abord, et le `biome-ignore` qui ne sauve rien

#### C.2.1 La fidélité de la réplique, vérifiée avant de s'en servir

```
$ diff <SB>/biome-probe/biome.jsonc               C:/_Gargouilles/Openview/biome.jsonc
$ diff -r <SB>/biome-probe/tools/biome            C:/_Gargouilles/Openview/tools/biome
```

[vérifié] **Les deux `diff` sont vides**, revérifiés à `m1` §2.1 et à `s6` §7.2. La réplique
exécute donc le `biome.jsonc` du dépôt — son quatrième `override`, ses 20 entrées
`noJsRestrictedProperties`, la déclaration du plugin — et les trois `.grit` du dépôt, avec le
binaire du dépôt, [mesuré] **Biome 2.5.8**.

**Contrôle de la réplique sur le dépôt intact** [mesuré, `v2` §3.1] :
`cd <V>/biome-BASE && biome check .` → `Checked 69 files. No fixes applied.` — **zéro diagnostic**.
La réplique **n'est pas plus sévère que la CI**.

> 📌 **Un point de périmètre qui a servi partout ensuite : la porte 1 lint les FICHIERS DE TEST**,
> ainsi que le formateur et les assists. Une conception dont le code de production passe le plugin
> GritQL mais dont le *test* ne le passe pas **casse quand même la CI** — c'est ce qui a tué une
> conception concurrente.

#### C.2.2 ⛔ Le contrôle négatif — la réplique mord-elle ?

**C'est la mesure à faire en premier, et le dossier l'a faite en premier.** Trois refus, dont le
troisième est le plus utile du lot.

```bash
printf 'const NEGATIVE_CONTROL = new Intl.NumberFormat().resolvedOptions().locale;' >> …/locale.ts
biome check --config-path=. packages/core/src
```
```
× `new Intl.*` called with no argument falls back to the host locale, which is an
  environment read (AGENTS.md). …
  > 186 │ const NEGATIVE_CONTROL = new Intl.NumberFormat().resolvedOptions().locale;
Checked 10 files. No fixes applied.  Found 1 error.
```

| # | Forme injectée | Verdict mesuré | Ce qu'elle prouve |
| :-- | :--- | :--- | :--- |
| **1** | `new Intl.NumberFormat()` — **arité zéro** | ⛔ **REFUSÉ** (plugin) | la règle nominale mord |
| **2** | `new Intl.DateTimeFormat('fr-FR', opts)`, `opts` **déclaré ailleurs** | ⛔ **REFUSÉ** | le **faux positif** qu'`AGENTS.md` annonce est **confirmé**, pas supposé |
| **3** | `new Intl.DateTimeFormat()` **précédé d'un `biome-ignore`** | ⛔ **REFUSÉ QUAND MÊME** | ⛔ **l'échappatoire n'existe pas** |

#### C.2.3 ⛔ La mesure la plus utile du lot : `biome-ignore` est INOPÉRANT sur un plugin GritQL

`AGENTS.md` §1.1 écrit : « *`biome-ignore` — sauf justification écrite dans le commentaire **et**
dans la PR* ». Cette phrase **laisse croire à une soupape**. [mesuré, `v2` §3.2, cinq orthographes,
sondes `negctl3`/`negctl4`] :

| Suppression écrite | Effet mesuré |
| :--- | :--- |
| `// biome-ignore lint/plugin: …` | diagnostic **maintenu** + `suppressions/unused` |
| `// biome-ignore plugin: …` | diagnostic **maintenu** |
| `// biome-ignore plugin/no-environment-read: …` | diagnostic **maintenu** + `suppressions/parse` |
| `// biome-ignore-all plugin: …` | diagnostic **maintenu** |
| `// biome-ignore lint/nursery/noJsRestrictedProperties: …` | diagnostic **maintenu** + `suppressions/unused` |

`Found 5 errors` sur cinq lignes suppressées.

> ⛔ **Aucune justification n'est recevable, parce que le mécanisme n'existe pas.** Sur
> `no-double-cast.grit`, `no-silent-catch.grit` et `no-environment-read.grit`, l'autorisation
> d'`AGENTS.md` §1.1 est **vide**. Un contributeur qui lit `AGENTS.md` croit disposer d'une soupape
> qui n'est pas là.
>
> **Les trois issues réelles pour qui a besoin d'une forme refusée sont donc :** réécrire le code,
> obtenir un **mandat `AGENTS.md` §7** pour amender le `.grit`, ou passer par un **angle mort
> documenté** du plugin — cette troisième voie étant elle-même refusée par le plan (§C.6.3).
>
> **C'est la mesure qui retire une échappatoire, et c'est pour cela qu'elle vaut d'être écrite au
> plan et non seulement au rapport.**

#### C.2.4 Le passage positif, une fois le contrôle négatif retiré

```
$ biome check packages/core/src
Checked 10 files in 324ms. No fixes applied.        <- 0 erreur, 0 avertissement
```

[mesuré, `s1` §5.2 puis rejoué à `s6` §7.2 après correction] **Zéro diagnostic, fichier de tests
compris.**

**Zéro `biome-ignore`** dans tout le lot : [mesuré] `grep` en rend **2 occurrences, toutes deux en
PROSE** (`format.ts:193`, `presentation.test.ts:154`), dans une phrase qui dit précisément
qu'aucun `biome-ignore` ne sauve un diagnostic de plugin. **Aucune directive de suppression.**

Deux corrections de route méritent d'être écrites, parce qu'elles enseignent :

- Le tri des imports/exports et le formatage à 100 colonnes ont été appliqués par
  `biome check --write` **puis recopiés dans le bac à sable** — le fichier de tests est linté comme
  le reste.
- Un premier jet de test écrivait `{ dateStyle: 'iso' } as unknown as Partial<Presentation>`.
  [mesuré] **le plugin `no-double-cast` ne l'a PAS vu.** C'est exactement ce qu'`AGENTS.md` annonce
  (« revue humaine uniquement » pour certaines formes). Il a été **retiré, pas annoté** : le helper
  `firstIssue` prend `unknown`, donc aucun cast n'est nécessaire.

#### C.2.5 La formulation opposable de la contrainte « objet d'options en ligne »

Trois formulations circulaient dans le dossier ; 25 sondes (séries **Q** et **R**) les départagent
[mesuré, `m1` §2.3–2.5, `sandbox2/biome-probe/…/probe4.ts`, `probe5.ts`]. Deux résultats suffisent :
`Intl.DateTimeFormat(loc, { ...base, dateStyle })` est ⛔ **REFUSÉ** quand
`Intl.DateTimeFormat(loc, { ...base, timeZone })` **passe** — **la seule différence étant le NOM de
l'identifiant abrégé** ; et `const timeZoneOptions = {…}; …(loc, timeZoneOptions)` est ⛔ **REFUSÉ**,
donc le `contains` de GritQL travaille **par nœud, pas par sous-chaîne** et **aucun contournement par
le nommage n'existe**.

> **Formulation à écrire telle quelle — celle d'`AGENTS.md` (« tout objet non littéral déclenche la
> règle ») est trop grossière et [mesuré] fausse :** *le garde-fou exige qu'un nœud identifiant nommé
> **exactement** `timeZone` apparaisse quelque part dans la liste d'arguments de **cet appel-ci** —
> clé littérale, clé abrégée, sous-objet, ou même autre argument. Il ne regarde ni la valeur, ni
> l'ordre, ni le niveau d'imbrication, et il ne reconnaît pas une sous-chaîne dans un nom plus long.*

#### C.2.6 Ce que le linter laisse passer ET qui lit quand même la machine

Le linter ne peut pas juger une **valeur d'exécution**. [mesuré, `sandbox2/runtime-zone.mjs`, **en
égalités contre l'hôte**] **quatre formes passent le garde-fou ET résolvent la zone de la machine** —
`{ ...base, timeZone: maybeZone }` avec `maybeZone === undefined`, `{ ...base, x: { timeZone } }`,
un `timeZone` porté par un **autre argument**, et `{ timeZone:'UTC', ...undef }` — **et une
cinquième, `.format()` à arité zéro, lit l'HORLOGE**.

✅ **La propriété abrégée n'en fait PAS partie** : `{ ...base, timeZone }` et `{ timeZone }`
résolvent `UTC`. C'est le seul cas sondé dont la réponse est bonne **des deux côtés** — muette au
linter parce que le jeton est là, correcte au runtime parce que la valeur l'est aussi. Le lot peut
donc l'écrire **sans dérogation**, à la condition — **non outillée** — que la liaison ne vaille
jamais `undefined`.

Le décompte complet des angles morts est de **treize**, dont **trois seulement sont déclarés** par
`tools/biome/no-environment-read.grit:36-39` [mesuré, `m1` §5.1] — huit défauts de **site**, cinq
défauts de **valeur**. La règle d'ICU qui les fabrique vaut la peine d'être retenue :

> **ICU jette sur ce qui est MAL FORMÉ et se tait sur ce qui est BIEN FORMÉ mais INCONNU.**
> [mesuré] `{ calendar: 'gregorian' }` → `RangeError: Invalid calendar` ; `{ timeZone:
> 'Mars/Olympus' }` → `RangeError` ; **mais** `{ calendar: 'zzz' }` sur `fa-IR` résout `persian`
> **en silence**, et `{ numberingSystem: 'zzz' }` sur `ar-SA` reste en chiffres `arab` **en
> silence**.

C'est **l'argument mesuré** — et non postulé — pour que tout ce que C6 confie à ICU passe par une
validation Zod à la frontière plutôt que par un `string` nu.

---

### C.3 — ICU, mesuré : sept propriétés que le contrat suppose, et qu'il fallait exécuter

Banc de cette section : `node v24.11.1`, **ICU 77.1**, CLDR 47.0, Unicode 16.0, machine
`Europe/Paris` / `fr-FR`, Windows 11. Sondes : `sandbox2/calendars.mjs`, `calendars2.mjs`,
`tofixed.mjs`, `idem.mjs`.

#### C.3.1 Les deux bornes de fraction rendent la table CLDR devise → unités mineures INATTEIGNABLE

C'est la mesure qui fonde **D-04**. `Intl` porte une table CLDR qui donne, par devise, un nombre
d'unités mineures — et cette table est un **défaut**, pas une loi :

```
JPY {}                          min=0 max=0  -> 1 235 JPY
JPY {min:2,max:2}               min=2 max=2  -> 1 234,57 JPY
TND {}                          min=3 max=3  -> 1 234,567 TND
TND {min:2,max:2}               min=2 max=2  -> 1 234,57 TND
EUR {}                          min=2 max=2  -> 1 234,57 €
CLP {}                          min=0 max=0  -> 1 235 $CL
```

[mesuré, sur `1234.5678`] **`0` pour JPY et CLP, `3` pour TND** — et **deux entrées explicites
l'écrasent intégralement**. Un contrat qui rendrait les bornes optionnelles laisserait donc une
règle métier non déclarée décider du nombre de décimales d'une facture ; les rendre **toujours
explicites** la rend inatteignable. C'est un refus obtenu **par construction**, pas par une garde.

⚠️ **La réserve subsiste et n'est pas refermée :** seul le **côté ICU** est mesuré. La liste des
divergences ICU / ISO 4217 n'a été lue à aucun registre, ni par la récolte ni par la campagne.
[non vérifié]

#### C.3.2 Les calendriers — trois années fausses, depuis une date correcte, sans une erreur

`Date.UTC(2026, 7, 19)`, `{ timeZone: 'UTC', dateStyle: 'long' }` :

| locale | `resolvedOptions().calendar` | `numberingSystem` | rendu |
| :--- | :--- | :--- | :--- |
| `fr-FR` | `gregory` | `latn` | `19 août 2026` |
| `en-US` | `gregory` | `latn` | `August 19, 2026` |
| **`ar-SA`** | **`gregory`** | **`arab`** | **`١٩ أغسطس ٢٠٢٦`** |
| **`fa-IR`** | **`persian`** | **`arabext`** | **`۲۸ مرداد ۱۴۰۵`** |
| **`th-TH`** | **`buddhist`** | `latn` | **`19 สิงหาคม 2569`** |
| `ja-JP` | `gregory` | `latn` | `2026年8月19日` |
| **`ja-JP-u-ca-japanese`** | **`japanese`** | `latn` | **`令和8年8月19日`** |
| **`ne-NP`** | `gregory` | **`deva`** | **`२०२६ अगस्ट १९`** |
| **`dz-BT`** | `gregory` | **`tibt`** | **`སྤྱི་ལོ་༢༠༢༦…`** |

⛔ **Trois dates différentes pour le même instant, qu'aucun modèle n'a déclarées** : `fa-IR` rend
**1405**, `th-TH` rend **2569**, `ja-JP-u-ca-japanese` rend **令和8**. Une année fausse de 621 et
une de 543.

**Et la mesure CORRIGE le dossier sur un point que tout le monde tenait pour acquis** : `ar-SA` ne
rend **pas** de date hégirienne sous ICU 77.1 — il résout `calendar = gregory`. Ce qui varie chez
`ar-SA`, c'est le **système de chiffres**. *Le piège est là, mais pas où on l'attendait* — et c'est
exactement pourquoi il fallait mesurer plutôt que raisonner.

**Le cas le plus dangereux pour une facture n'est dans aucune liste attendue :**

```
th-TH  dateStyle:'short'                      -> 19/8/69      <- 2569 TRONQUÉE à "69"
th-TH  dateStyle:'short', calendar:'gregory'  -> 19/8/26
fa-IR  { year:'numeric', month:'2-digit', day:'2-digit' }        -> ۱۴۰۵/۰۵/۲۸
fa-IR  + { calendar:'gregory', numberingSystem:'latn' }          -> 2026/08/19
```

Une facture thaïe imprimerait **`19/8/69`**. Rien ne le signale, et c'est **indétectable à la
relecture** par quelqu'un qui ne lit pas le thaï.

**L'épinglage neutralise-t-il ? — oui, intégralement** [mesuré] :

```
--- avec calendar: 'gregory' EXPLICITE ---
ar-SA                 gregory     arab     ١٩ أغسطس ٢٠٢٦
fa-IR                 gregory     arabext  ۱۹ اوت ۲۰۲۶
th-TH                 gregory     latn     19 สิงหาคม ค.ศ. 2026
ja-JP-u-ca-japanese   gregory     latn     2026年8月19日
```

> **Règle mesurée, et c'est elle qui rend l'épinglage fiable : L'OPTION GAGNE TOUJOURS CONTRE
> L'ÉTIQUETTE.** [mesuré] `ja-JP-u-ca-japanese` + `calendar:'gregory'` rend `2026年8月19日`, pas
> l'ère Reiwa ; la réciproque vaut aussi (`ar-SA-u-ca-gregory` + `calendar:'islamic-umalqura'`
> résout `islamic-umalqura`). Un intégrateur qui passerait `'th-TH-u-ca-buddhist'` **ne peut pas**
> contourner l'épinglage du contrat.

#### C.3.3 ⛔ Le piège JUMEAU — `numberingSystem` touche `NumberFormat`, donc les MONTANTS

`calendar: 'gregory'` **ne corrige pas les chiffres**. Il faut une **seconde** option — et le piège
ne s'arrête pas aux dates :

| locale | `nu` par défaut | `format(1234.5)` | avec `numberingSystem: 'latn'` |
| :--- | :--- | :--- | :--- |
| `fr-FR` | `latn` | `1 234,50` | `1 234,50` |
| **`ar-SA`** | **`arab`** | **`١٬٢٣٤٫٥٠`** | `1,234.50` |
| **`ar-EG`** | **`arab`** | **`١٬٢٣٤٫٥٠`** | `1,234.50` |
| **`fa-IR`** | **`arabext`** | **`۱٬۲۳۴٫۵۰`** | `1,234.50` |
| **`ne-NP`** | **`deva`** | **`१,२३४.५०`** | `1,234.50` |
| **`my-MM`** | **`mymr`** | **`၁,၂၃၄.၅၀`** | `1,234.50` |
| `hi-IN`, `th-TH` | `latn` | `1,234.50` | `1,234.50` |

⛔ **Aucun des huit rapports de récolte ne nommait celui-ci, et il touche le cœur du lot.** Un
modèle qui déclare `locale: 'ar-EG'` pour obtenir de l'arabe obtient **aussi**, sans l'avoir
demandé, des chiffres arabes orientaux **sur tous ses montants**.

#### C.3.4 📌 L'asymétrie du garde-fou — trois options à épingler, une seule surveillée

| Option | Sur | Ce qu'elle empêche | Surveillance |
| :--- | :--- | :--- | :--- |
| `timeZone: 'UTC'` | `DateTimeFormat` | la zone de la machine | **obligatoire** — le plugin refuse son absence |
| `calendar: 'gregory'` | `DateTimeFormat` | `1405`, `2569`, `令和8` | ❌ **aucune** |
| `numberingSystem: 'latn'` | `DateTimeFormat` **et `NumberFormat`** | `١٩`, `१,२३४`, `၁,၂၃၄` | ❌ **aucune** |

> **C'est le fait le plus important du point.** Le garde-fou du dépôt exige `timeZone` **et rien
> d'autre**. Les deux autres options réparent des lectures d'environnement **exactement du même
> genre** — un défaut CLDR que le modèle n'a jamais déclaré — et **aucune machine ne les surveille**.
> [mesuré] `Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC' })` passe **les quatre portes** et imprime
> **1405**.
>
> Ce qui n'est **pas** un arbitrage : **ne rien épingler est exclu**, et `19/8/69` le démontre mieux
> qu'un argument.

#### C.3.5 `toFixed` contre `Intl` contre `roundDecimal` — 4 000 000 de tirages

**Protocole entièrement rejouable** (`sandbox2/tofixed.mjs`) : générateur **`mulberry32`, graine
fixe `0xC6C6C6`** — `Math.random` est banni dans `core` et le bac à sable s'en passe **quand même**,
pour que chaque chiffre se reproduise. `roundDecimal` est importé du `dist` reconstruit à HEAD.
Comparateur ICU : `min = max = n`, `useGrouping: false`. Mode : `halfExpand`, **parce que c'est le
défaut d'ICU**, donc la seule comparaison honnête.

**Quatre distributions, 1 000 000 chacune. Une seule aurait menti** : une loi uniforme sur les
doubles ne produit **jamais** de demi exact et aurait rendu « 0 divergence », c'est-à-dire l'inverse
du vrai.

| Distribution | `toFixed`/`Intl` (**valeur**) | `toFixed`/`Intl` (**chaîne**) | `toFixed`/`roundDecimal` | `Intl`/`roundDecimal` |
| :--- | ---: | ---: | ---: | ---: |
| **A** — doubles uniformes `[0,10 000)`, `n ∈ {0..3}` | 0,0000 % | 0,0000 % | 0,0000 % | 0,0000 % |
| **B** — `k/1000`, `n = 2` *(riche en demis)* | **4,7985 %** | 4,7985 % | 4,7985 % | 0,0000 % |
| **C** — `k/10`, `n = 0` *(demis entiers)* | 0,0000 % | 0,0000 % | 0,0000 % | 0,0000 % |
| **D** — grands ordres (`10¹⁵`→`10²⁶`), `n = 2` | 0,0271 % | **82,9117 %** | 0,0271 % | 0,0000 % |
| **TOTAL — 4 000 000** | **1,2064 %** | **21,9276 %** | **1,2064 %** | **0,0000 %** |

> 1. **`toFixed(n)` vs `Intl(min=max=n)` : 1,2064 % en valeur, 21,9276 % en chaîne.**
> 2. **`toFixed(n)` vs `roundDecimal` : 1,2064 %** — *exactement le même compte, tirage pour tirage*.
> 3. **`Intl(min=max=n)` vs `roundDecimal` : 0,0000 %. ZÉRO divergence sur 4 000 000 de tirages**,
>    aucune distribution exceptée.

**Le mécanisme, qui vaut mieux qu'un taux.** [vérifié,
`expression/evaluator/operations/round.ts:187+`] `roundDecimal` travaille sur
`Math.abs(value).toExponential()`, c'est-à-dire sur **la plus courte forme décimale qui retourne à la
même valeur binaire** ; ICU fait la même chose ; `toFixed` arrondit **la valeur binaire exacte**
(`1.005` vaut `1.00499999999999989…`, donc `"1.00"` contre `"1.01"`). **L'équivalence
`Intl ≡ roundDecimal` n'est donc pas une propriété observée mais une CONSÉQUENCE d'un choix
d'implémentation partagé** — et cela dit ce qui la casserait : une réécriture de `roundDecimal` qui
abandonnerait `toExponential`.

**La distribution C est le contrôle qui rend le reste crédible.** `k/10` arrondi à 0 décimale produit
des demis **exactement représentables** : sur ceux-là, les **trois** s'accordent. La divergence de B
n'est donc pas un désaccord de **mode**, c'est un désaccord de **représentant** — sans C, on aurait
conclu au premier.

**`toFixed` est écarté par DEUX raisons distinctes** : il diverge de l'arrondi que C2 a déclaré
(**4,80 %** sur une famille de valeurs monétaires ordinaires), **et** il cesse d'écrire un nombre
décimal au-delà de 10²¹ — [mesuré] `"2.6481766370125118e+22"` là où ICU rend
`"26481766370125118000000.00"`. **Un document qui imprime `1e+21` sur une facture n'est pas un
document.** ⚠️ `roundDecimal` rend elle aussi `1e+21`, **parce qu'elle rend un NOMBRE et non une
chaîne** : la bascule exponentielle est un défaut de `toFixed` **en tant que formateur**, pas de
`roundDecimal`. *`roundDecimal` arrondit, `Intl` écrit, et `toFixed` prétend faire les deux en se
trompant sur chacun.*

#### C.3.6 📌 L'invariant d'ordre d'opérations — arrondir PUIS formater, jamais l'inverse

L'affirmation ne devait pas rester déduite. Même graine, `N = 1 000 000`, distribution B, [vérifié]
`ROUND_MODES = ['halfExpand', 'halfEven']` (`expression/types.ts:121`) — le dépôt n'en déclare que
**deux** :

| Mode déclaré | `format(round(v)) ≠ round(v)` | `format(v) ≠ round(v)` |
| :--- | ---: | ---: |
| `halfExpand` | **0** | **0** — 0,0000 % |
| `halfEven` | **0** | **49 910** — **4,9910 %** |

> ✅ **Formater APRÈS avoir arrondi est fidèle dans les DEUX modes : zéro divergence sur 2 000 000
> de comparaisons.** `Intl` avec `min = max = n` réécrit exactement le nombre qu'on lui donne.
> ⛔ **Formater SANS arrondir n'est fidèle qu'en `halfExpand`.** En `halfEven` — un mode que le
> contrat **déclare** — le formatage direct contredit le modèle sur **4,99 %** des montants à trois
> décimales.

Une mesure indépendante à **200 000** tirages retrouve le même ordre de grandeur (**4,9275 %**,
`s1` D-20), ce qui donne au chiffre deux points d'appui et non un.

**Conséquence de contrat** : aucun `roundingMode` n'est passé à ICU — ce serait une **seconde
orthographe** du mode qu'une expression `round` déclare déjà, et deux orthographes d'un arrondi sont
la façon dont deux moteurs produisent deux documents. L'obligation « arrondir puis formater »
appartient au **moteur**, et elle est écrite comme attente, pas comme espoir.

#### C.3.7 Les deux espaces de `fr-FR`, et pourquoi aucune chaîne formatée n'est figée nulle part

[mesuré] `Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(1234.5)`, points
de code :

```
0031 202F 0032 0033 0034 002C 0035 0030 00A0 20AC
     ^^^^ espace fine insécable (U+202F)          ^^^^ espace insécable (U+00A0)
```

**Deux espaces différents dans une chaîne de dix caractères**, et le **U+202F a été introduit par
CLDR 42 / ICU 72**. La CI tourne sur `node: [24, 26]` [vérifié, `.github/workflows/ci.yml:59`],
donc **deux jeux CLDR**. Une assertion `toBe('1 234,50 €')` écrite au clavier porte presque
certainement une espace ordinaire et serait fausse **partout** ; une assertion recopiée de la sortie
serait vraie **ici** et fausse ailleurs.

C'est la mesure qui fonde la discipline d'assertion du §5 du plan, et elle est vérifiée
*négativement* par la matrice de mutation : **aucune mutation n'a eu besoin d'une chaîne figée pour
être tuée** (§C.6).

#### C.3.8 Le zéro négatif, et la limite du repli

[mesuré] `Intl.NumberFormat('fr-FR', {min:2, max:2}).format(-0)` rend **`"-0,00"`**. `0 * -1` et une
remise de rien produisent `-0` ; `-0,00 €` sur une ligne de total est un défaut qu'un lecteur
signale.

Le repli est fait **ici** et pas dans l'algèbre : le `-0` de l'algèbre est arithmétiquement juste,
c'est son **écriture** qui est fausse. Et il ne porte **que sur le zéro exact** : [mesuré] `-0.001`
écrit à deux décimales rend toujours `-0,00`, **et c'est correct** — la valeur *est* négative, et
cacher le signe serait inventer un nombre.

#### C.3.9 Deux mesures qui décident d'écrire un nombre PLUTÔT que de reprendre celui d'ICU

**Le plafond.** [mesuré] `maximumFractionDigits: 100` **passe**, `101` lève `RangeError`. **Ce
plafond d'ICU est le mauvais nombre à publier dans un contrat stocké** : c'est une propriété du
**moteur** (ES2020 garantissait 20, ES2023 est monté à 100) et un document n'est pas reparsé quand
l'hôte est mis à jour. Le contrat importe donc `MAX_ROUND_DECIMALS` (**15**) au lieu de réénoncer un
nombre — lien mesurable par mutation (§C.6, M19).

**L'horodatage.** `Date.UTC(…)` est **autorisé** par `AGENTS.md` et pourtant **refusé** par le
contrat, pour une raison mesurée : **il projette les années 0–99 sur 1900–1999**, donc il déplacerait
**en silence** `0042-01-01`, que `civil-date.ts` accepte. Remplacé par
`dayNumberOf(value) * 86 400 000`. **Pas un seul objet `Date` n'est construit dans ce lot** — ce qui
referme aussi, par construction, l'angle mort n° 1 du plugin (l'alias `const Clock = Date`).

---

### C.4 — ⛔ La mesure sur DEUX ICU : elle a fait tomber une décision du contrat

**C'est la mesure la plus importante du dossier, et elle est arrivée tard.** Tout ce qui précède est
mesuré sur **un** binaire. Or `core` produit un **format stocké**, et un document voyage entre
machines. La question qui n'avait pas été posée est : *l'ensemble des locales que le contrat accepte
est-il le même sur deux builds d'ICU ?*

#### C.4.1 Le banc — deux binaires réels, pas deux hypothèses

| | chemin | node | ICU | CLDR |
| :--- | :--- | :--- | :--- | :--- |
| récent | `node` (PATH) | **v24.11.1** | **77.1** | 47.0 |
| ancien | `…/ms-playwright-go/1.50.1/node.exe` | **v22.13.1** | **76.1** | 46.0 |

[mesuré, revérifié à la rédaction de cette section :
`node -e "console.log(process.version, process.versions.icu, process.versions.cldr)"` sur chacun]
Ce sont **deux binaires présents sur la machine**, et le second n'a pas été installé pour l'occasion :
c'est le Node embarqué par Playwright. **Le dossier n'aurait pas eu cette mesure sans lui.**

Cet écart d'un ICU n'est pas artificiel : la CI tourne sur `node: [24, 26]`
[vérifié, `.github/workflows/ci.yml:59`], donc **deux jeux CLDR en production**.

#### C.4.2 Le balayage des 31 772 tags — l'écart 527 / 525

```bash
$ node                          s5-work/x1-icu-sweep.mjs > icu77.json
$ <node22>/node.exe             s5-work/x1-icu-sweep.mjs > icu76.json
```

Le script **réplique le prédicat de locale au caractère près** (canonicalisation, refus du `-u-`,
double `resolvedOptions()`), sur les 676 tags de deux lettres, les 17 576 de trois lettres, et
676 × 20 régions/scripts.

| | ICU 77.1 (Node 24) | ICU 76.1 (Node 22) |
| :--- | ---: | ---: |
| tags sondés | 31 772 | 31 772 |
| **acceptés par le prédicat** | **527** | **525** |

**Divergence : 2 tags, et le sens est asymétrique** [mesuré] :

- Acceptés sur ICU 77, **refusés** sur ICU 76 : **`en-FR`** et **`cls`** (→ `sa`).
- Acceptés sur ICU 76, refusés sur ICU 77 : **aucun**.

Vérification ciblée sur 23 tags plausibles (`s5-work/x4-tags.mjs`) : `de-DE`, `br-FR`, `es-419`,
`zh-Hans-CN`, `ar-EG`, `fa-IR`, `th-TH`, `en-DE`, `en-CH`, `fr-BE`, `fr-CH`, `nl-BE`, `de-CH`,
`en-CA`, `fr-CA`, `es-US`, `pt-PT`, `en-IN` sont **stables sur les deux. Seul `en-FR` bascule.**

> ⛔ **`en-FR` n'est pas un tag exotique : c'est LE tag du lot.** « Anglais tel qu'on l'écrit en
> France » est le tag que l'auteur d'une facture bilingue française écrira spontanément pour la
> moitié anglaise de son modèle — c'est-à-dire **exactement le cas d'usage du critère de recette**
> (`core.md:261-262`). Le contrat, dans sa forme d'alors, refusait sur Node 22 le tag le plus
> naturel de son propre critère de recette.

**Un second facet, plus discret, du même défaut** : `Intl.getCanonicalLocales` est **lui aussi**
dépendant de la version [mesuré, `s5-work/x6-canon.mjs`] — `'cls'` → `'sa'` sur ICU 77.1, `'cls'` sur
ICU 76.1. Comme le résolveur rend `{ ...declared, locale: canonical }`, **l'objet remis au moteur
peut porter une chaîne différente selon la machine**, pour un même document.

**La conséquence, mesurée de bout en bout sur le JavaScript émis du lot** (`s5-work/x2-parse.mjs`,
la même table dans `PresentationTableSchema.safeParse`) :

```js
{ fr: { locale: 'fr-FR', … }, en: { locale: 'en-FR', … } }
```

| | Node 24 / ICU 77.1 | Node 22 / ICU 76.1 |
| :--- | :--- | :--- |
| `safeParse(table).success` | **`true`** | ⛔ **`false`** |
| issue | — | `{ code:'custom', path:['en','locale'], message:'A locale must be a BCP-47 tag this engine honours exactly as written…' }` |

> ⛔ **Ce n'est pas une écriture perdue : c'est le document ENTIER qui ne s'ouvre pas.** La table est
> un champ de `Template` ; un `custom` sur `presentations.en.locale` fait échouer `TemplateSchema.parse`,
> donc `parseTemplate`, donc l'ouverture. Et le message **accuse l'auteur** alors que le tag est
> correct et que la cause est la **version d'ICU du lecteur**.
>
> C'est la classe « **refus illisible** » d'`AGENTS.md` §1.2 — **sauf que le remède qu'`AGENTS.md`
> prescrit pour cette classe (l'incrément de `schemaVersion`) n'existe pas ici** : le refus dépend
> de la **donnée** et de la **machine**, jamais de la version.

**Pourquoi le dossier avait raté ce point, alors qu'il avait les deux binaires en main.** Il **a**
croisé les deux ICU (`s4:320`, `s2:505` — « *zéro désaccord, identiquement sur ICU 76.1 et 77.1* »),
mais sur **un jeu de tags choisi à la main** et sur **l'accord entre les deux formateurs**. Aucune de
ces mesures ne portait sur **l'ensemble accepté lui-même**, qui est la grandeur qui bouge. **Le
dossier a regardé la bonne paire de binaires et posé la mauvaise question.** C'est le mode d'échec à
retenir : *une mesure bien exécutée sur la mauvaise grandeur ressemble à une preuve.*

#### C.4.3 ⚠️ Le contrôle négatif qui manquait — la preuve de stabilité syntaxique était VIDE

Le remède proposé était de **scinder** : garder la **syntaxe** au parse (annoncée « stable ») et
descendre l'**honorat** au rendu. La réattaque appuyait « stable » sur : « *aucun tag ne passe de
lève à ne lève pas — les deux ensembles `RANGE` sont identiques* ».

[mesuré, `s6-work/y1-split-sweep.mjs`] :

```
raises          0 0   diff77only= []  diff76only= []
syntaxAccepted  31772 31772   diff77only= []  diff76only= []
```

> ⛔ **Les deux ensembles `RANGE` sont identiques PARCE QU'ILS SONT TOUS DEUX VIDES.** Sur ces
> 31 772 tags, `getCanonicalLocales` **ne lève jamais**, sur aucun des deux ICU. Le corpus — deux
> lettres, trois lettres, deux lettres + région — est **entièrement bien formé par construction** :
> **il ne touche jamais la frontière qu'il prétend mesurer.**
>
> **La conclusion de la réattaque était juste ; son argument ne l'établissait pas.** C'est le
> deuxième cas du dossier où une mesure exacte ne prouve pas ce qu'on lui fait dire, et c'est
> pourquoi le contrôle négatif est écrit comme une convention en tête de cette section.

**Le corpus de frontière, 161 tags** (`s6-work/y2-malformed.mjs`) : les **26 tags grandfathered** de
BCP-47, **80 alias dépréciés** que CLDR remappe, **51 malformations** systématiques (`''`, `'fr_FR'`,
`'fr--FR'`, `'root'`, `'@'`, `'fr@euro'`, `'de-DE.UTF-8'`, `'en-a-bbb-a-ccc'`, sous-étiquettes trop
longues, variantes dupliquées…).

```
corpus size 161 | ICU 77.1 vs 76.1
raise verdict divergences : 0
SYNTAX verdict divergences: 0
canonical spelling drift  : 2        (cls -> 77:sa 76:cls ; nbx -> 77:gll 76:ekc)
raises on 77 (50): ["1","12","en-GB-oed","i-ami",…,"fr-Latn-Latn"]
```

✅ **50 tags lèvent, exactement les mêmes sur les deux builds. La frontière est cette fois touchée,
et elle ne bouge pas.** La stabilité syntaxique est désormais **établie** et non plus seulement
affirmée.

**La dérive de canonicalisation est nommée plutôt que masquée** : `'cls'` → `'sa'`/`'cls'`,
`'nbx'` → `'gll'`/`'ekc'`. **La chaîne rendue dérive ; le verdict ne dérive pas**, et aucune des deux
dérives ne traverse le test du `-u-`. La chaîne dérivante **n'atteint jamais le stockage** — le
schéma ne normalise pas, donc ce qui est persisté est ce que l'auteur a écrit.

#### C.4.4 ⛔ La découverte qui a changé la conception : `en-US-posix`

Parmi les 161 tags de frontière, un cas décide où porte le test du `-u-` [mesuré] :

```
en-US-posix  =>  en-US-u-va-posix
```

> **Un tag qui ne porte AUCUN `-u-` se canonicalise EN un tag qui en porte un.** Huit tags du corpus
> ont une forme canonique portant `-u-` ; `en-US-posix` est **le seul** dont la forme écrite n'en
> porte pas.
>
> Conséquence directe : **le test du `-u-` DOIT rester sur la forme CANONIQUE, jamais sur le tag
> brut.** Un test sur le brut aurait laissé passer `en-US-posix` au parse **et** au rendu, et le
> contrat aurait remis à `Intl` l'extension qu'il affirme refuser. La conception d'origine avait
> raison ; elle n'avait pas ce contre-exemple. Il est désormais épinglé **par un test** (N23) **et
> par une mutation** (M29-s6).

Le verdict syntaxique sur `en-US-posix` est **identique sur les deux ICU** : la coupure tient.

#### C.4.5 ⛔ LA PREUVE QUE LE DÉFAUT EST REFERMÉ

Pas une réplique du prédicat : **le `PresentationSchema` réellement émis par le lot**, passé sur
**31 846 tags** sur chacun des deux binaires (`s6-work/y5-parse-sweep.mjs`).

```
$ node        y5-parse-sweep.mjs > y5f-77.json
$ <node22>    y5-parse-sweep.mjs > y5f-76.json

corpus 31 846
                          ICU 77.1        ICU 76.1
PARSE  acceptés           31 789          31 789
PARSE  sha256(ensemble)   aed8d898…       aed8d898…     <== IDENTIQUE
PARSE  seulement sur 77   []
PARSE  seulement sur 76   []

RENDER acceptés           531             529
RENDER seulement sur 77   ["cls","en-FR"]               <== attendu : l'honorat est de la DONNÉE
```

> ⛔ **L'ensemble accepté au parse est identique AU BIT PRÈS — même SHA-256 de la liste ordonnée,
> zéro divergence sur 31 846 tags.** C'est exactement la grandeur que le défaut accusait de bouger,
> et elle ne bouge plus.
>
> La divergence **subsiste** — elle est irréductible, c'est une donnée CLDR — mais elle a **changé
> de porte** : elle vit désormais au **rendu**, où elle produit une **absence nommée** que le moteur
> sait déjà lire, et non un document illisible.

**Le scénario d'origine, rejoué de bout en bout sur le JS émis** (`s6-work/y4-parse-enfr.mjs`), avec
**la même table** que celle qui avait produit le défaut :

| | ICU 77.1 | ICU 76.1 |
| :--- | :--- | :--- |
| **avant** — `safeParse(table).success` | `true` | ⛔ **`false`** — *le document n'ouvre pas* |
| **après** — `DOCUMENT_OPENS` | ✅ **`true`** | ✅ **`true`** |
| après — `render_fr` | `1 234,50 €` | `1 234,50 €` |
| après — `render_en` | `€1,234.50` | **`undefined`** → absence nommée (attente E4-8) |

**Le document s'ouvre partout, la moitié française rend partout, et sur l'ICU ancien la moitié
anglaise dégrade en une absence** au lieu de rendre le document entier inouvrable avec un message
qui accuse l'auteur.

#### C.4.6 Ce que cette mesure impose au reste du dossier

| Effet | Détail |
| :--- | :--- |
| **Une décision amendée** | la validation de locale est **scindée** en deux fonctions, ni l'une ni l'autre exportée |
| **Zéro code d'erreur neuf** | la ligne « D-11 » tient : le refus au rendu est une **absence**, pas une erreur |
| **Surface publique inchangée** | **126 exports**, mesurés avant et après la scission — *scinder n'ajoute rien à la surface* |
| **Un mandat élargi** | l'amendement d'ADR doit couvrir la **validité d'entrée**, pas seulement les **chaînes produites** (§C.7.6) |
| **Une attente neuve au Designer** | une locale n'est plus refusée **à la frappe** : le Designer doit **avertir depuis le résolveur** |

**Et une garantie positive, formulable, qui est ce que la scission achète :**

> *Deux rendus du même document par le même build produisent la même chaîne ; et **la VALIDITÉ d'un
> document stocké ne dépend d'aucun build** — [mesuré] ensemble accepté au parse identique au
> SHA-256 près sur 31 846 tags, ICU 76.1 et 77.1.*

---

### C.5 — Les refus rejoués, avec leurs contrôles positifs

Aucun refus n'est annoncé sur parole : chacun est **rejoué par `safeParse` sur le JavaScript émis**
(`s6-work/y6-refusals.mjs`). Les deux tableaux ci-dessous sont les **entrées de test** du §5 du plan.

**Règle de renumérotation, énoncée d'abord** — parce que le dossier lie ces identifiants à des tests
et qu'une renumérotation en bloc coûterait plus qu'elle ne rapporte :

1. **Chaque identifiant `N` reste attaché à son ENTRÉE**, jamais à son verdict.
2. Le tableau gagne une **colonne « porte »**.
3. **`N01` et `N02` DÉMÉNAGENT** de *parse* vers *rendu* — **les deux seules entrées dont le verdict
   change**.
4. **`N23` est neuve** (`en-US-posix`).
5. Un **second tableau `R01`…`R11`** est créé pour la porte de rendu, dont le verdict n'est pas une
   issue mais une **absence**.

**Comptes : parse 22 → 23 entrées, dont 20 refusées ; rendu, 11 entrées neuves.**

#### C.5.1 Porte de parse — colonne « issues » : TOUTES à 1

| Id | Entrée | Verdict | issues | `code` | `path` |
| :-- | :--- | :--- | :-: | :--- | :--- |
| **N01** | `locale: 'zz'` | ⛔ **ACCEPTÉE** *(→ R01)* | 0 | — | — |
| **N02** | `locale: 'fr-XX'` | ⛔ **ACCEPTÉE** *(→ R02)* | 0 | — | — |
| N03 | `locale: 'fr-FR-u-nu-thai'` | refusée | 1 | `custom` | `locale` |
| N04 | `locale: 'i-klingon'` | refusée | 1 | `custom` | `locale` |
| N05 | `locale: ''` | refusée | 1 | `custom` | `locale` |
| N06 | `locale` absent | refusée | 1 | `invalid_type` | `locale` |
| N07 | `currency: 'eur'` | refusée | 1 | `invalid_format` | `currency` |
| N08 | `currency: 'ZZZZ'` | refusée | 1 | `invalid_format` | `currency` |
| N09 | `currency: '12A'` | refusée | 1 | `invalid_format` | `currency` |
| N10 | `currency` absent | refusée | 1 | `invalid_type` | `currency` |
| N11 | `minFractionDigits: -1` | refusée | 1 | `too_small` | `minFractionDigits` |
| N12 | `maxFractionDigits: 16` | refusée | 1 | `too_big` | `maxFractionDigits` |
| N13 | `minFractionDigits: 2.5` | refusée | 1 | `invalid_type` | `minFractionDigits` |
| N14 | `min 3 > max 2` | refusée | 1 | `custom` | `maxFractionDigits` |
| N15 | `maxFractionDigits` absent | refusée | 1 | `invalid_type` | `maxFractionDigits` |
| N16 | `dateStyle: 'iso'` | refusée | 1 | `invalid_value` | `dateStyle` |
| N17 | `dateStyle` absent | refusée | 1 | `invalid_value` | `dateStyle` |
| N18 | `'fr-FR'` (pas un objet) | refusée | 1 | `invalid_type` | *(vide)* |
| N19 | table à clé vide | refusée | 1 | `custom` | *(la clé vide)* |
| N20 | table portant `__proto__` | **ACCEPTÉE**, clés `["ok"]` | 0 | — | — |
| N21 | table `{ montant: 3 }` | refusée | 1 | `invalid_type` | `montant` |
| N22 | clé vide **et** `currency: 'eur'` | refusée | 1 | `invalid_format` | `["", "currency"]` |
| **N23** | 🆕 `locale: 'en-US-posix'` | refusée | 1 | `custom` | `locale` |

> ✅ **Vingt-trois entrées, et pas une seule ne rend deux issues.** C'est la vérification de la
> décision « **deux prédicats d'objet À COUPURE** » : le défaut « deux issues pour une faute »
> découvert par l'exécution du lot C5 ne se reproduit pas. Le cas décisif est `N22` — **une clé vide
> ET une devise minuscule**, deux fautes dans le même document, qui rend **une** issue parce que la
> coupure a fait son travail.
>
> ⚠️ **`N20` est un constat, pas une garantie.** `z.record` **jette** une clé `__proto__`, et
> l'objet rendu ne pollue rien — [mesuré] `Object.keys` → `['ok']` **et**
> `Reflect.get(Object.prototype, 'pwned')` → `undefined`. C'était mesuré mais **non assuré** avant
> qu'un test le tienne.

#### C.5.2 Porte de rendu — le verdict est une ABSENCE

| Id | Écriture / appel | parse | rendu |
| :-- | :--- | :--- | :--- |
| **R01** | `locale: 'zz'` — bien formé, inconnu d'ICU | **passe** | `undefined` |
| **R02** | `locale: 'fr-XX'` | **passe** | `undefined` |
| **R03** | `locale: 'xx-YY'` | **passe** | `undefined` |
| R04 | `locale: 'i-klingon'` — moitié syntaxique | refusé au parse | `undefined` |
| **R05** | 🆕 `currency: 'AB'` — **lèverait `RangeError`** | refusé au parse | `undefined` |
| **R06** | 🆕 `min 5 > max 2` — **lèverait `RangeError`** | refusé au parse | `undefined` |
| **R07** | 🆕 `minFractionDigits: -1` — **lèverait `RangeError`** | refusé au parse | `undefined` |
| **R08** | 🆕 `currency: 'eur'` | refusé au parse | `undefined` |
| R09 | nom que personne n'a déclaré | — | `undefined` |
| R10 | nom **hérité** (`constructor`) | — | `undefined` |
| R11 | table absente | — | `undefined` |
| **OK1** | une écriture saine | passe | ✅ **résolue** — *contrôle positif* |

**`R05` à `R08` sont le cœur de la seconde correction** : avant elle, ces quatre écritures étaient
**rendues** par le résolveur, et les trois premières faisaient **lever un formateur** ensuite.

#### C.5.3 Le contrôle positif qui manquait à la revalidation — quatre familles, pas deux

L'exception signalait **deux** `RangeError`. [mesuré, `s6-work/y3-throws-baseline.mjs`, sur le JS
émis **avant** correction] il y en a **quatre**, et **les trois formateurs sont concernés** :

| Écriture bâtie à la main | `formatMoney` | `formatDecimal` | `formatDate` |
| :--- | :--- | :--- | :--- |
| `locale: 'zz'` | `"1 234,50 €"` **(hôte)** | `"1 234,50"` **(hôte)** | `"19 août 2026"` **(hôte)** |
| `locale: 'i-klingon'` | **RangeError** | **RangeError** | ⛔ **RangeError** |
| `locale: ''` | **RangeError** | **RangeError** | ⛔ **RangeError** |
| `currency: 'AB'` | **RangeError** | `"1 234,50"` | `"19 août 2026"` |
| `min 5 > max 2` | **RangeError** | **RangeError** | `"19 août 2026"` |
| `min: -1` | **RangeError** | **RangeError** | `"19 août 2026"` |
| `min: 2.5` | `"1 234,50 €"` | `"1 234,50"` | `"19 août 2026"` |

**Trois corrections au constat initial :** (1) la **locale malformée** est une quatrième famille,
manquée parce que seul `'zz'` — qui est *bien formé* — avait été testé ; (2) **`formatDate` lève
aussi**, donc *aucun* des trois n'est exempt ; (3) **`min: 2.5` ne lève pas** — ICU accepte un
non-entier, le schéma le refuse : la revalidation gagne un cas de plus que l'exception n'en
signalait.

**Et l'ORDRE des deux gestes du résolveur est une décision de COUVERTURE, pas un goût.** Écrit dans
l'ordre évident — `safeParse` d'abord, honorat ensuite — la **moitié syntaxique** de l'honorat
deviendrait **inatteignable**, puisque le schéma aurait déjà refusé tout tag malformé : ce serait
une **branche morte** de plus, dans un lot qui en a supprimé deux. Dans l'ordre retenu, [mesuré]
**`resolve.js` et `schemas.js` sont couverts à 100 %**.

---

### C.6 — La matrice de mutation : ce que chaque porte tient réellement

Le lot C5 a inventé le geste, et il vaut d'être répété : **une matrice non exécutée ne prouve
rien.** Chaque mutation ci-dessous est **appliquée à une copie fraîche de `core/src`, recompilée
intégralement, puis suivie de l'exécution du fichier de tests**. Harnais :
`sandbox-FINAL/s2/matrix.mjs`, `matrix2.mjs`, `matrix3.mjs`, `matrix4.mjs`, `killers.mjs` ; journal
brut : `s2/matrix.log`.

**Et elle porte sur les QUATRE portes, pas seulement la quatrième** — c'est ce qui la rend
concluante là où une matrice « tests seuls » aurait rendu un faux négatif (M13).

#### C.6.0 ⚠️ Deux exécutions, deux numérotations — à lire avant les chiffres

Il y a eu **deux campagnes de mutation**, sur deux états du fichier de tests, et **leurs
identifiants `M26`–`M29` DÉSIGNENT DES CHOSES DIFFÉRENTES**. Un rédacteur qui les mélangerait
écrirait du faux ; la collision est donc nommée ici plutôt que laissée à découvrir.

| | Campagne **A** (`s2`) | Campagne **B** (`s6`) |
| :--- | :--- | :--- |
| Fichier de tests visé | le fichier **complété**, **39 `it` / 106 `expect`** | le fichier **livré**, **33 `it` / 102 `expect`** |
| Mutations | **31** | **29** |
| Tuées | **28** à la porte 4 + **1** à la porte 1 | **23** |
| Survivantes | **2**, documentées comme irréductibles | **6** |
| `M26` y désigne… | *la locale ignorée (`→ undefined`)* | *l'honorat retiré entièrement* |
| `M27` y désigne… | *la devise à 4 lettres* | *le `safeParse` du résolveur retiré* |
| `M28` y désigne… | *le plafond de fraction 15 → 50* | *l'honorat REMIS au parse* |
| `M29` y désigne… | *le `dateStyle` forcé à `short`* | *le test du `-u-` sur le tag **brut*** |

**Les deux campagnes sont cohérentes entre elles**, et l'écart s'explique en une phrase : la
campagne B est partie du fichier de `s1` (32 `it`) et lui a ajouté 1 test, **sans reprendre les 7
assertions de fermeture** que la campagne A avait écrites. Les **6 survivantes de B** sont donc
**exactement** celles que **A referme** — plus les 2 irréductibles.

> ⚠️ **Une réconciliation reste à faire, et elle n'est PAS mesurée.** Le fichier de tests final du
> plan est la **fusion** des deux : les 7 assertions de fermeture de A **et** le test neuf de B, les
> 4 tests réécrits par B, et les entrées `N23` / `R01`–`R11`. Le compte résultant — de l'ordre de
> **40 `it`** — **n'a été exécuté par personne**, et aucun document du dossier ne donne son chiffre.
> **Le rédacteur de l'incrément de test doit le mesurer et non le recopier.** [non vérifié]

#### C.6.1 Ce qui meurt, et par quel test (campagne A, 24 des 31)

Les 24 mutations tuées à la porte 4 couvrent chacun des sites du contrat : le refus du `-u-` (M01),
la copie et la canonicalisation (M05), les **trois épinglages** (M06, M07, M08), les **deux** bornes
de fraction (M09b, M10), le repli du zéro négatif (M11), la garde `Number.isFinite` (M12b), les deux
coupures de prédicat et leurs `.check` (M15, M17, M18, M30), la casse haute de la devise (M16), le
lien `MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS` (M19), l'**estampille** et sa migration (M20 — 4
blocs rouges —, M21, M22), un export du barrel (M23), la validation de la date (M24), le `.refine`
de locale (M25), l'emploi de la locale (M26ᴬ) et du `dateStyle` (M29ᴬ), et la validation des
**valeurs** de la table (M31). `exit` = nombre de blocs `it` en échec ; journal complet dans
`s2/matrix.log`.

**Trois enseignements de cette moitié :**

- **M25 est la mutation la plus meurtrière (5 blocs).** Le `.refine` de locale est le **point de
  passage unique** du parse vers `Intl` ; le retirer ouvre le trou entier. C'est la mesure qui
  justifie que le prédicat soit **une** fonction et non deux règles recopiées — et, incidemment,
  ce qui rendait la scission de §C.4 délicate à faire sans perdre la garantie.
- ⛔ **M26ᴬ n'était tuée que PAR ACCIDENT.** [mesuré] elle ne rougissait que l'aller-retour
  `Number()`, **et uniquement parce que la machine de test est en `fr-FR`** : sur un hôte `en-US`,
  `formatDecimal(123.5, EN)` sous locale ignorée rendrait toujours `"123.50"` et **la mutation
  survivrait**. C'était un test **dépendant de l'environnement dans un lot dont l'objet est de ne
  pas dépendre de l'environnement.** L'assertion `it`:565 le corrige.
- **M29ᴬ est tuée par un couplage fragile** — `toContain('2026')` ne mord que parce que la fixture
  déclare `dateStyle: 'long'`. [mesuré] `th-TH` + `short` rend `19/8/26`. **À écrire dans le
  commentaire du test**, sans quoi une « simplification » future le désarme silencieusement.

#### C.6.2 ⛔ Le fait le plus contre-intuitif du lot : la répartition est L'INVERSE de l'intuition

**M13 — retirer l'épinglage `timeZone: 'UTC'`.** [mesuré] **la porte 4 est MUETTE, et la porte 1
tue** :

```
$ biome check .../format.ts       (timeZone retiré)
  × `new Intl.DateTimeFormat` without an explicit `timeZone` formats in the HOST time zone,
    even when the locale is explicit (roadmap E6). Pass both: …
  Found 1 error.

$ node run.mjs                    (même mutation)
  39 passed, 0 failed             <- aucune assertion ne bouge
```

Pourquoi la porte 4 est muette : l'hôte est `Europe/Paris` (**+2 h en août**), donc minuit UTC reste
le même **jour civil**. Le test ne pouvait pas mordre — et **il ne le pourrait sur aucune machine
sans lire le fuseau**, ce que le lot s'interdit.

Et le **contrôle négatif complémentaire**, tout aussi utile : [mesuré] le même retrait appliqué à
`calendar: 'gregory'` (sonde L3), à `numberingSystem: 'latn'` (L2), ou le remplacement de la locale
par `undefined` (L5), **passe `biome check` sans un diagnostic**.

| Épinglage | Porte 1 (Biome) | Porte 4 (tests) |
| :--- | :-: | :-: |
| **`timeZone: 'UTC'`** | ✅ **SEUL GARDE** | ❌ muette (dépend du fuseau de l'hôte) |
| `calendar: 'gregory'` | ❌ muette | ✅ `it`:388 |
| `numberingSystem: 'latn'` | ❌ muette | ✅ `it`:388, `it`:401 |
| la locale réellement employée | ❌ muette | ✅ `it`:565 |

> ⛔ **À écrire dans le plan, pas seulement dans un rapport de mesure :** l'épinglage du fuseau est
> le seul des quatre dont la garantie repose **entièrement** sur une règle de plugin `.grit` — le
> fichier qu'`AGENTS.md` §7 interdit de modifier sans mandat, voisin d'une règle **nursery hors
> versionnement sémantique**. **Si le plugin est un jour assoupli, PLUS RIEN ne tient `timeZone`.**
>
> Et **cela ne peut pas être refermé par un test** : un test qui prouverait le fuseau devrait lire
> le fuseau. C'est un **point de vigilance de revue**, définitivement, et non une dette qu'un
> incrément solderait.
>
> Symétriquement, les trois autres épinglages ne tiennent que par la porte 4 : ce sont **les tests
> qui sont le garde-fou du calendrier et des chiffres**, et une « simplification » de la fixture les
> désarme (voir M29ᴬ).

#### C.6.3 Les survivantes, et ce que chacune enseigne

| Id | Ce qu'on retire | Pourquoi ça survit | Verdict |
| :-- | :--- | :--- | :--- |
| **M02** | la moitié `DateTimeFormat` du contrôle d'égalité | redondance **délibérée** : [mesuré] sur **3 944 tags**, les deux formateurs n'ont **jamais** divergé — 213 acceptés par les deux, 3 731 refusés par les deux, **zéro désaccord**, identiquement sur ICU 76.1 **et** 77.1 | ⛔ **irréductible** |
| **M03** | la moitié `NumberFormat` | idem, symétrique | ⛔ **irréductible** |
| **M04** | `Object.hasOwn` → lecture indexée | le cas `constructor` atteint le bon résultat **par accident** : la valeur héritée est une **fonction**, son `.locale` vaut `undefined`, et le prédicat de locale refuse déjà | **refermé** par `it`:521 |
| **M09** | `minimumFractionDigits` sur **une seule** des deux portes | l'autre porte suffisait à faire passer l'assertion | **réparé** en `M09b` (les deux portes) |
| **M13** | l'épinglage `timeZone: 'UTC'` | l'hôte est `Europe/Paris` : minuit UTC reste le même jour civil | ⛔ **refermé par la PORTE 1**, jamais par la 4 |
| **M14** | la coupure de `refuseInvertedBounds` | les six cas d'`issueCount` employaient tous une faute **abortive** ou non inversante | **refermé** par `it`:532 |
| **M27ᴬ** | la longueur exacte de la devise (3 → 3 ou 4) | aucun test n'écrivait `ZZZZ` | **refermé** par `it`:557 |
| **M28ᴬ** | le plafond de fraction 15 → 50 | le seul cas écrit était `99`, refusé **dans les deux mondes** | **refermé** par `it`:542 |

> **M02 et M03 ne peuvent pas être refermées, et c'est une PROPRIÉTÉ, pas un manque.** Un test qui
> les tuerait devrait exhiber un tag sur lequel les deux formateurs divergent — c'est-à-dire une
> donnée CLDR qui **n'existe pas** sur l'ICU courant et qui, si elle apparaissait, ferait **rougir**
> le test au lieu de le faire passer. **Le plan dit donc que ces deux mutations survivent, et
> pourquoi il est correct qu'elles survivent**, plutôt que d'inventer une assertion qui figerait une
> propriété d'ICU.
>
> **M28ᴬ et M27ᴬ enseignent la même chose sous deux formes :** un refus dont le seul cas de test est
> **très** au-delà de la borne (`99` contre un plafond de 15) ne teste pas la borne, il teste
> l'existence d'un refus. **Les deux extrémités doivent être écrites** — `max: 15` accepté **et**
> `max: 16` refusé.

**Les sept assertions de fermeture (campagne A), et la vérification croisée mutation par mutation :**

| Nouveau `it` | Mutation refermée | Assertion décisive |
| :--- | :-- | :--- |
| `:521` *reads only the OWN entries of a table* | M04 | `resolvePresentation(Object.create({ 'montant-fr': FR }), 'montant-fr')` → `{ ok: false, refusal: 'unknown-writing' }` *(⚠️ mesuré `→ undefined` avant A-7 ; l'assertion est à reprendre, et elle devient plus stricte)* |
| `:532` *tells an author once when one bound is BOTH out of range and inverted* | M14 | `issueCount(writing({ minFractionDigits: 99 }))` → **1** ; sans la coupure : **2** |
| `:542` *pins both ends of the declarable fraction range* | M28ᴬ | `max: 15` accepté **et** `max: 16` → `too_big` |
| `:557` *refuses a currency of four letters, and one carrying a digit* | M27ᴬ | `ZZZZ`, `ZZ`, `12A`, `ZZ1` → `invalid_format` |
| `:565` *writes one value two ways with NO currency* | M26ᴬ (**rendue indépendante de l'hôte**) | `formatDecimal(v, FR) !== formatDecimal(v, EN)` |
| `:578` *refuses a candidate that is not an object, and an entry that is not one* | M31 | `path === ''` sur le candidat ; `['montant']` sur l'entrée |
| `:590` *drops a `__proto__` key and pollutes nothing* | — (constat mesuré, non assuré) | `Object.keys` → `['ok']` **et** `Reflect.get(Object.prototype,'pwned')` → `undefined` |

```
M00-baseline                    exit=0  passed=39  failed=0
M02-drop-DateTimeFormat-half    exit=0  passed=39  failed=0   <- survivant ASSUMÉ
M03-drop-NumberFormat-half      exit=0  passed=39  failed=0   <- survivant ASSUMÉ
M04-hasOwn-to-index-read        exit=1  passed=38  failed=1   <- it:521
M13-drop-timeZone-pin           exit=0  passed=39  failed=0   <- tué à la PORTE 1
M14-drop-inverted-bounds-cutoff exit=1  passed=38  failed=1   <- it:532
M26-locale-ignored-undefined    exit=2  passed=37  failed=2   <- it:304 + it:565
M27-currency-4-letters          exit=1  passed=38  failed=1   <- it:557
M28-ceiling-loosened-to-50      exit=1  passed=38  failed=1   <- it:542
M31-record-value-unchecked      exit=2  passed=37  failed=2   <- it:232 + it:578
```

> **Bilan campagne A : 31 mutations — 28 tuées à la porte 4, 1 tuée à la porte 1, 2 irréductibles et
> documentées comme telles.**

#### C.6.4 Les quatre mutations de la campagne B — dont la régression elle-même

Après les corrections de §C.4 et §C.5, deux entrées **ne s'appliquaient plus** et devaient être
réécrites, faute de quoi la matrice se serait **silencieusement dégradée en `NOT-APPLIED`** — un
mode d'échec de matrice qu'il vaut la peine de nommer :

| Mutation | Ancien motif | Nouveau motif |
| :--- | :--- | :--- |
| M05 | `return { ...declared, locale };` | `return parsed.data;` |
| M25 | `(tag) => declarableLocale(tag) !== undefined` | `(tag) => wellFormedLocale(tag) !== undefined` |

Et **quatre mutations neuves épinglent les corrections elles-mêmes** :

| Mutation | Ce qu'elle retire | Verdict | Tuée par |
| :--- | :--- | :--- | :--- |
| **M26ᴮ** | l'honorat **entièrement** (les deux formateurs → `false`) | ☠️ **tuée** (2) | le test de couture + le test du résolveur |
| **M27ᴮ** | le `safeParse` du résolveur — **le correctif de revalidation** | ☠️ **tuée** (1) | *REVALIDATES all five fields* |
| **M28ᴮ** | ⛔ **l'honorat REMIS au parse — LA RÉGRESSION DE §C.4 ELLE-MÊME** | ☠️ **tuée** (1) | *STORES a well-formed tag this engine does not know* |
| **M29ᴮ** | le test du `-u-` porté sur le tag **brut** | ☠️ **tuée** (1) | l'assertion `en-US-posix` |

```
$ node s2/matrix4.mjs
ANCIENNE : 25 mutations, 19 tuées, 6 survivantes
NOUVELLE : 29 mutations, 23 tuées, 6 survivantes
survivants (identiques) : M02, M03, M04, M09, M13, M14
```

> ✅ **L'ensemble des survivants est INCHANGÉ : les corrections tuent quatre mutations de plus sans
> affaiblir un seul verrou existant.**
>
> ⛔ **Et M28ᴮ est la ligne qui compte** : le défaut mesuré en §C.4 — un document bilingue qui ne
> s'ouvre pas sur un autre ICU — est désormais **impossible à réintroduire sans rougir un test**.
> C'est la différence entre « on a corrigé » et « on a corrigé et verrouillé ».

---

### C.7 — ⛔ Ce qui reste NON MESURÉ

Cette sous-section est écrite en tête d'esprit plutôt qu'en annexe, parce que c'est elle qui borne
tout le reste. **Rien de ce qui suit n'est un détail, et rien n'y est minimisé.**

#### C.7.1 Les quatre portes n'ont JAMAIS été lancées dans le dépôt

Le cadre de planification l'interdit — elles y écrivent. **Toute la section C est mesurée dans un bac
à sable**, sur une **copie** de `packages/core/src`, avec le `biome.jsonc` et les `.grit` du dépôt
copiés à l'identique (`diff` vide, revérifié). La commande de la CI —

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

— **n'a pas été exécutée une seule fois.** [non vérifié] Ce que la campagne établit, c'est que **les
mêmes binaires, sur les mêmes configurations, sur le même code, rendent exit 0** ; ce n'est pas la
même chose que « la CI passera », et le premier incrément devra le mesurer.

#### C.7.2 `pnpm run build` n'est pas rejoué

Les deux `tsc` de §C.1 sont `--noEmit`, et le `tsconfig` de run est à `noCheck`. **L'émission réelle
d'un `dist` de production avec ses `.d.ts`, `composite: true` et `declarationMap` n'est pas
mesurée.** [non vérifié] C'est la porte la plus susceptible de révéler un problème que `--noEmit`
masque (ordre d'initialisation ESM, cycle de barrel) — et le plan C5 a précisément trouvé un
`ReferenceError: Cannot access 'ContainerNodeSchema' before initialization` **invisible aux portes 1,
2 et 3**.

#### C.7.3 Les tests tournent contre un SHIM `vitest` de 20 lignes

Pas contre vitest. Les matchers employés y sont **réimplémentés** (`toBe`, `toStrictEqual`,
`toHaveLength`, `toContain`, `toBeDefined`, `toBeUndefined`, `not.*`). **Une différence de sémantique
entre le `toStrictEqual` du shim (comparaison JSON) et celui de vitest est possible et non
vérifiée.** [non vérifié] Les `33 passed` et `39 passed` de cette section sont donc des assertions
**exécutées**, mais pas par le runner de la CI.

#### C.7.4 La couverture est mesurée en LIGNES DU JAVASCRIPT ÉMIS, pas par `@vitest/coverage-v8`

Métrique employée : lignes de JS émis, commentaires et lignes vides retirés, via `NODE_V8_COVERAGE`,
**règle `coverage.include` du dépôt appliquée des deux côtés** (seuls `*.{test,spec}.ts` exclus, donc
`__tests__/fixtures.ts` compte, comme en CI).

| Grandeur | Valeur |
| :--- | ---: |
| `packages/core/src` (arbre de travail) | **2 008** |
| après C6 (bac à sable) | **2 158** |
| dont **imputables au lot** | **+158** (`presentation/` **150**, `migrate.js` +5, `template.js` +2, `index.js` +1) |
| dont **dérive du bac à sable**, non imputable | **−8** (§C.0.3) |
| **non couvertes par les seuls tests du lot** | **3** |
| **couverture propre du lot** | **98,10 %** (155 / 158) |

Soit `A` le taux agrégé avant le lot ; la CI est verte donc `A ≥ 90` :

```
agrégat = (A/100 × 2008 + 155) / 2166
A = 90  ->  90,59 %      A = 95  ->  95,23 %      A = 100  ->  99,86 %
```

> ✅ **Dans le PIRE cas — un dépôt posé exactement sur le plancher — l'agrégat MONTE à 90,59 %.** Un
> lot dont le taux propre dépasse l'agrégat ne peut que le faire monter. Le seuil est **sans
> `perFile`** [vérifié], donc aucun fichier n'est jugé isolément.

⛔ **Les trois réserves qui vont avec, et elles sont sérieuses :**

1. **Les `statements` et `branches` que la CI calculera NE SERONT PAS identiques à ces chiffres.**
   La conclusion (taux propre très au-dessus du plancher ⇒ agrégat en hausse) est robuste à l'écart ;
   **le chiffre exact ne l'est pas.** [déduit]
2. ⛔ **Le taux agrégé RÉEL de `packages/core/src` à HEAD n'est pas mesuré.** Il est **borné** par
   `A ≥ 90` (CI verte) et le pire cas est publié. Obtenir le chiffre exigerait `pnpm run
   test:coverage`, que le cadre interdit. [non vérifié]
3. **La seule plage non couverte est nommée** : `locale.js:116-118`, le
   `if (!(error instanceof RangeError)) { throw error; }`. Il **ne peut pas** être couvert
   honnêtement — la signature prend un `string`, et sur un `string` `getCanonicalLocales` ne lève que
   `RangeError` ; le couvrir exigerait un cast (interdit §1.1), le supprimer violerait §1.3. **Il
   reste, et il est le seul.**

> 📌 **Un signalement sur le garde-fou, hors périmètre C6 mais mesuré ici :** [mesuré, `v2` §6.4] une
> conception concurrente livrait **~513 lignes de production neuves avec ZÉRO test** et **passait la
> porte 4** (93,54 % global) — avec un fichier de 197 lignes à **4,00 %**. Le seuil est agrégé sur le
> glob, `perFile` n'est pas déclaré et vaut `false` par défaut. **La porte 4, telle qu'écrite,
> n'arrête pas un sous-système entier non testé** ; ce qui l'arrête est `AGENTS.md` §5 et la revue.
> Remède possible : `thresholds.perFile: true`, ou un seuil de sous-glob. **À consigner, pas à
> corriger ici.**

#### C.7.5 La sonde jetable de l'ADR 0003 n'a pas été rejouée

`AGENTS.md` prescrit de rejouer, **à chaque montée de Biome**, la sonde qui vérifie que
`noJsRestrictedProperties` — une règle **nursery, hors versionnement sémantique** — existe toujours.
**Elle n'a pas été rejouée.** [non vérifié] Le contrôle négatif de §C.2.2 prouve que la règle **et**
le plugin mordent **sur Biome 2.5.8 aujourd'hui** ; il ne dit **rien** de la prochaine montée, où la
règle peut être renommée ou retirée **en silence**. Combiné à §C.6.2 — `timeZone` ne tient que par le
`.grit` — c'est le point de fragilité le plus structurel du lot.

#### C.7.6 La revue humaine, et les quatre choses qu'aucune machine ne rattrapera

`AGENTS.md` liste explicitement ce qui relève de la **revue humaine uniquement** ; la campagne l'a
confirmé par mesure plutôt que sur parole :

| Règle | Statut mesuré |
| :--- | :--- |
| Assertion `<X>v` (chevrons) | non détectée — GritQL parse ce dialecte en TSX |
| Promesses non attendues | aucun outil : TS 7 prive le projet de `no-floating-promises` |
| **Double cast `as unknown as`** | ⛔ [mesuré] **le plugin `no-double-cast` a manqué** un `as unknown as Partial<Presentation>` dans un fichier de test du lot. Il a été **retiré**, pas annoté |
| Patrons de conception, Zod-first | revue seule |

#### C.7.7 Les autres trous, nommés sans atténuation

| Ce qui n'est pas mesuré | Statut |
| :--- | :--- |
| **La liste ISO 4217** — seul le côté **ICU** de la table devise est mesuré ; aucun registre n'a été lu | [non vérifié] |
| **La reproductibilité sur une machine non `fr-FR` / non `Europe/Paris`** — d'où la discipline « égalité contre l'hôte, jamais valeur d'hôte » | [non vérifié] |
| **Les rendus non latins** (`٩`, `२`, `၁`, `令和`) sont recopiés de la console ; **aucun locuteur ne les a contre-vérifiés** | [non vérifié] |
| **Les sondes Biome P01–P43 de la récolte n'ont pas été rejouées** ; seules les séries Q, R et les contrôles négatifs neufs l'ont été | [non vérifié] |
| **Aucune facture bilingue n'a été RENDUE.** `core` ne rend rien, et aucun mini-moteur n'a été écrit hors dépôt pour faire semblant. Ce qui est démontré est strictement : *une valeur, deux écritures déclarées, deux chaînes différentes portant les mêmes chiffres, depuis un seul `Template`* | [mesuré, mais c'est **moins** que le critère de recette] |
| **Le test `'zz'` interroge une PROPRIÉTÉ d'ICU, pas une garantie de spécification.** Si un ICU futur reconnaissait `zz`, il rougirait — ce qui est **le bon comportement**, mais le relecteur doit le savoir | assumé |
| **Le compte de `it` du fichier de tests final** (fusion des deux campagnes de mutation, §C.6.0) | [non vérifié] |
| **Le comportement d'`Intl` sur un TROISIÈME ICU.** Tout ce dossier repose sur deux builds. Le calendrier par défaut d'`ar-SA` a déjà changé au fil de CLDR : **aucun rendu de §C.3 n'est un invariant de spécification** | [non vérifié] |

#### C.7.8 Deux faits d'environnement relevés en passant, absents de toute la récolte

- [vérifié] `packages/core/package.json` déclare **`zod: ^3.25.76`**, pas Zod 4 — et la jonction
  résolue est `node_modules/.pnpm/`**`zod@3.25.76`**. `AGENTS.md` §1.2 prescrit d'importer depuis
  `zod/v4`, qui est le **sous-chemin de compatibilité** de Zod 3.25. Ce n'est pas une contradiction —
  c'est le chemin de migration officiel — mais **le plan ne doit pas écrire « le dépôt est en
  Zod 4 »** : il est en **Zod 3.25.76 avec l'API v4 importée par sous-chemin**.
- [mesuré] `tsc --version` rend **7.0.2**, et `node_modules/typescript/lib/` **n'a pas** de
  `typescript.js` : la disparition de l'API JS du compilateur qu'`AGENTS.md` §1.5 annonce est
  **effective**, donc l'absence de `no-floating-promises` aussi.

---

### C.8 — Verdict, et de quelle révision il est le verdict

**Ce verdict porte sur le contrat tel qu'il existe dans `sandbox-FINAL/core/src/presentation/`
APRÈS les corrections de §C.4 et §C.5**, mesuré contre le dépôt à **`320bea6`** pour l'essentiel et
relevé une dernière fois à **`c806aaa`**, avec les trois fichiers périmés nommés en §C.0.3.

| Porte / grandeur | Résultat | Statut |
| :--- | :--- | :--- |
| `tsc` production (`--noEmit`) | **exit 0** | [mesuré] |
| `tsc` tests compris (`--noEmit`) | **exit 0** | [mesuré] |
| Biome — **contrôle négatif** | **mord** trois fois, dont le `biome-ignore` refusé | [mesuré] |
| Biome — passage | `Checked 10 files. No fixes applied.` — **0 diagnostic** | [mesuré] |
| `biome-ignore` dans le lot | **zéro directive** (2 occurrences, **prose**) | [mesuré] |
| Suite de tests | **33/33 verte sur ICU 77.1 ET 76.1** | [mesuré, shim] |
| Surface publique | **126** exports (117 + 9 valeurs), **inchangée par la scission** | [mesuré, émission ESM réelle] |
| Catalogues d'erreurs | **inchangés — zéro code neuf** | [vérifié] |
| Refus au parse | **23 entrées, 20 refusées, TOUTES à 1 issue** | [mesuré] |
| Refus au rendu | **11 entrées + 1 contrôle positif** | [mesuré] |
| Mutations | **31 (A) : 28+1 tuées, 2 irréductibles** · **29 (B) : 23 tuées, 6 survivantes** | [mesuré] |
| Portabilité du format stocké | **SHA-256 identique sur 31 846 tags, deux ICU** | [mesuré] |
| Couverture propre du lot | **98,10 %** ; agrégat au pire **90,59 %** (**monte**) | [mesuré, métrique substitut] |
| Tests existants qui rougissent | **4**, dans **2** fichiers, tous nommés | [mesuré] |
| **Les quatre portes dans le dépôt** | ⛔ **JAMAIS LANCÉES** | **[non vérifié]** |
| **`pnpm run build`** | ⛔ **non rejoué** | **[non vérifié]** |
| **Agrégat de couverture réel à HEAD** | ⛔ **non mesuré**, borné par `A ≥ 90` | **[non vérifié]** |

> **Le verdict, en une phrase :** *le contrat compile, passe le linter sur un harnais dont il est
> prouvé qu'il mord, refuse ce qu'il annonce refuser avec une issue et une seule, tient sur deux
> builds d'ICU pour la seule grandeur qui doit y tenir — la validité d'un document stocké — et
> verrouille par mutation la régression qui l'avait fait amender. **Il n'a pas passé la CI, et
> personne ne l'a écrit dans le dépôt.***
>
> ⛔ **Et ce verdict porte sur le [§3] SEUL. Il ne s'étend pas au dossier.** La revue externe du
> 2026-08-19 a montré que le [§4], le [§5.2] et une partie du [§5.3] prescrivent encore le contrat
> **d'avant l'amendement de `D-06`** — donc que ce verdict vert n'autorise **pas** à exécuter les
> incréments tels qu'ils étaient écrits. C'est **R-02**, **R-03** et **R-04**, et c'est ce qui a
> fait passer le plan de « prêt à exécuter » à « à réviser ».
>
> ⚠️ **Trois lignes de ce tableau sont à relire avec leur correction :**
>
> | Ligne | Ce qu'elle dit | Ce qu'il faut lire |
> | :--- | :--- | :--- |
> | Suite de tests **33/33** | verte | ce n'est **pas** le fichier du plan — la fusion (~40 `it`) **n'a jamais été exécutée** [§C.6.0], **R-13** |
> | Couverture, agrégat « **monte** » | établi | établi **en lignes seules**. `vitest.config.ts:22` exige aussi 90 % en `functions`, `branches`, `statements` — **non calculés**, **R-12** |
> | Mesuré contre `c806aaa` | un commit d'avance | **une branche non fusionnée** : `main` est à `320bea6`, **R-01** |
>
> **La campagne a fait tomber une décision du contrat** (§C.4) et **corrigé le dossier sur cinq
> points** dont deux qu'il tenait pour mesurés : `ar-SA` n'est pas hégirien (§C.3.2), et la preuve
> de stabilité syntaxique était vide (§C.4.3). **Ce sont ces deux-là qu'il faut relire le jour d'une
> réouverture** — pas les chiffres verts.

---

## 4. Les six incréments

> ✅ **SECTION RÉVISÉE — les deux décisions qui la bloquaient sont tranchées (2026-08-20).**
> Les incréments n'avaient pas suivi l'amendement de `D-06` (**R-02**) : `INC-0` est réécrit,
> la numérotation réalignée, `E4-3` reformulé, `INC-3` mis à jour pour les cinq types.
>
> **Ce qui est décidé et déjà porté dans le texte :**
>
> | Décision | Ce qu'elle change ici | Registre |
> | :--- | :--- | :--- |
> | **A-7** — résultat discriminé, formateur-objet refusé | `INC-0` publie deux types de plus (**valeurs inchangées : 126**) ; `INC-1` livre les quatre sorties nommées ; `INC-3` exporte **cinq** types | R-14, R-09 |
> | **A-5** — `format?` **différé** à E4 | `INC-2` reste **exactement** ce qu'il était : une forme stockée, une estampille, **rien dans `ast/**`** | R-17 |
> | **R-01** — la base est bonne | `c806aaa` **est** dans `origin/main` (PR #25). Aucun remesurage dû à ce titre ; reste à aligner le `main` **local** | R-01 |
>
> ⚠️ **Ce qui n'est pas décidé mais ASSIGNÉ — ce sont des critères de sortie, pas des blocages.**
> Chacun a désormais un incrément porteur, et c'est ce qui rend cette section exécutable :
>
> | À mesurer | Incrément porteur | Registre |
> | :--- | :--- | :--- |
> | Aligner le `main` local sur `origin/main`, régler `320bea6` | **avant `INC-0`** — hygiène de dépôt | R-01 |
> | **Fusionner puis exécuter** la suite (~40 `it`) avec le vrai `vitest`, et **reprendre les assertions du résolveur** que `A-7` change | **`INC-0`** puis **`INC-1`** | R-13, A-7 |
> | Rejouer la **couverture sur les quatre métriques** (`lines`, `functions`, `branches`, `statements`) | **`INC-1`** — c'est lui qui ferme `resolve.ts` et `format.ts` | R-12 |
> | Rejouer les **trois lignes de matrice** que `A-7` déplace, et **ajouter les trois cibles neuves** (échange de refus) | **`INC-1`** | A-7 |
> | Passer les **quatre portes réelles** dans le dépôt, `pnpm run build` compris | **`INC-0`**, et à chaque incrément | §C.7.1, §C.7.2 |
>
> **`INC-0` est ouvrable.** Aucune décision de contrat ne l'attend.

Chacun passe les quatre portes seul et laisse le dépôt **cohérent**. **Cohérent n'est pas
publiable**, et la distinction est celle que `packages/core/src/template/template.ts:17-21` écrit
dans le code : l'estampille se pose **une** fois, après la dernière forme persistée du lot, avec
pour corollaire *« aucun commit avant celui-là n'est publiable »*.

Les quatre portes, dans cet ordre, ce sont exactement celles de la CI :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

> ⛔ **Résultat qu'il faut annoncer avant le tableau, parce qu'il rompt avec C5 : ce lot n'a
> AUCUN incrément non publiable, et ce n'est pas une facilité.** C5 en avait deux parce que sa
> première forme persistée (`box` sur cinq types de nœud, `ast/types.ts`) et son estampille
> (`template/template.ts`) vivent dans des **fichiers différents**, séparés par deux incréments de
> résolution. C6 n'a **qu'une** forme persistée — `Template.presentations` — et elle est déclarée
> dans **le fichier même qui porte `CURRENT_SCHEMA_VERSION`** : [mesuré sur le bac à sable] la
> section `## What version 7 means` est ligne **148**, l'estampille ligne **179**, et le champ
> ligne **249**, dans l'unique `TemplateSchema` ouvert ligne **199**. Les
> séparer fabriquerait un commit non publiable **pour rien** : il faudrait rouvrir `template.ts`
> deux fois pour écrire deux moitiés d'une même décision. La règle d'AGENTS.md §1.2 est « une
> estampille, après la dernière forme persistée », pas « la forme et l'estampille dans deux
> commits » — et INC-2 la respecte à la lettre en les portant **ensemble**.

---

### 4.0 Les trois mesures qui gouvernent la coupe

Le découpage ci-dessous n'est pas un arrangement de convenance : trois mesures le contraignent, et
deux d'entre elles ont **corrigé** un premier découpage que j'avais écrit avant de mesurer.

#### (a) La matrice de mutation — INC-0 gagne son salaire, mais pas au même endroit que celui de C5

C5 a mis la porte de type en premier parce que sa matrice passait à **3 sur 4 exit 0** sans les
paires `*_KEYS_IN_STEP`. La question posée à ce lot est la même, et **elle a une réponse
mesurée** : `Presentation` est le **seul type stocké écrit à la main** du lot (`Template` reste
inféré de son schéma, donc ingardable par ce patron — c'est le signalement H de C5), et il est
gardé par les deux annotations `PRESENTATION_KEYS_IN_STEP` / `PRESENTATION_VALUES_IN_STEP`.

[mesuré] — six mutations réalistes, compilées une à une avec `tsc -p tsconfig.verif.json --noEmit`
(tests compris, `tools/tsconfig.typecheck.json` du dépôt), chacune **avec** puis **sans** les deux
annotations. Contrôle : sans mutation et sans annotations, **exit 0** ; baseline, **exit 0**.

| # | Mutation | Avec les paires | Sans les paires | Qui rattrape, sans les paires |
| :-- | :--- | :-: | :-: | :--- |
| M1 | un champ **optionnel** ajouté à l'interface seule (`roundingMode?: string \| undefined`) | **exit 1** | ⛔ **exit 0** | **personne** |
| M2 | un champ **optionnel** ajouté au schéma seul (`roundingMode: z.string().optional()`) | **exit 1** | ⛔ **exit 0** | **personne** |
| M3 | l'interface élargit `dateStyle: DateStyle` → `string` | exit 1 (2 err.) | exit 1 (1 err.) | `presentation/format.ts` |
| M4 | l'interface rend `minFractionDigits` optionnel | exit 1 (2 err.) | exit 1 (1 err.) | `presentation/schemas.ts` |
| M5 | le schéma remplace `z.enum(DATE_STYLES)` par `z.string()` | exit 1 (6 err.) | exit 1 (5 err.) | schéma + fixtures du test |
| M6 | l'interface renomme `currency` → `moneyCode` | exit 1 (15 err.) | exit 1 (13 err.) | schéma + `format.ts` + fixtures |

**Deux sur six passent les quatre portes en silence sans les paires, et ce sont exactement les
deux qui comptent.** Les quatre autres sont rattrapées parce que la production **consomme** le
champ ; M1 et M2 ne le sont pas parce qu'un champ **optionnel** n'est consommé nulle part — et
c'est précisément la dérive que **D-10 annonce comme prochaine** (« `numberingSystem` est un
candidat à un champ optionnel futur »). Le diagnostic tombe sur la paire de **clés**, ligne 35 du
fichier de tests : `error TS2322: Type 'true' is not assignable to type 'false'` [mesuré].

> **Où cette porte se place, et pourquoi elle ne peut pas précéder le type.** Chez C5, les quinze
> sites d'accrochage **existaient déjà** : la paire pouvait donc précéder le premier champ, et
> INC-0 était un incrément de test pur. Ici le type et son schéma **naissent ensemble**, et une
> paire qui précéderait la déclaration ne garderait rien. La porte voyage donc **dans le premier
> commit du lot**, et ce qu'elle précède n'est pas le premier champ de `Presentation` mais **la
> première forme stockée** — `Template.presentations`, INC-2. C'est la seule lecture qui garde le
> geste de C5 sans le mimer.

#### (b) Le filet des 117 — un seul incrément le rougit, et il porte sa correction

`packages/core/src/style/__tests__/style.test.ts:134` — `expect(values).toHaveLength(117)` — est
**le seul filet mécanique sur la surface publique** du paquet [cité, C5 §3.10]. L'attaque
versionnement a mesuré que les premiers incréments de deux conceptions étaient **faussement
annoncés publiables** parce qu'ils le rougissaient. Le mien est vérifié, pas déduit.

[mesuré] — le `src` complet du lot compilé en ESM, puis `Object.keys(await import('./index.js')).length` :

| État du dépôt | `Object.keys(core).length` | `style.test.ts:134` |
| :--- | ---: | :--- |
| HEAD | **117** | vert |
| tout `presentation/` présent, `Template.presentations`, version 7, migration 6 → 7 — **`index.ts` intact** | **117** | **vert** |
| le bloc de neuf valeurs ajouté à `index.ts` | **126** | ⛔ **ROUGE** |

**Conclusion opposable : INC-0, INC-1 et INC-2 laissent le compte à 117 et ne touchent pas ce
test. Seul INC-3 le rougit, et INC-3 porte la correction `117 → 126` dans le même commit.** Les
trois **types** ajoutés (`DateStyle`, `Presentation`, `PresentationTable`) n'apparaissent pas dans
les clés d'un module JavaScript : ils ne déplacent aucun compte, et c'est la limite que
`style.test.ts` énonce déjà pour elle-même.

#### (c) L'arithmétique de couverture — pourquoi production et tests ne se séparent JAMAIS

Le seuil est un **agrégat de glob** : `vitest.config.ts:47` déclare `'packages/core/src/**':
THRESHOLD` avec `THRESHOLD = { lines: 90, functions: 90, branches: 90, statements: 90 }`, **sans
`perFile`** [vérifié à HEAD]. Et `coverage.include` vaut `['packages/*/src/**/*.{ts,tsx}']`
[vérifié], donc un fichier qu'aucun test n'importe est **quand même compté**.

[mesuré] — lignes de JavaScript émis, commentaires et lignes vides retirés, sur le `src` de HEAD
puis sur celui du lot (métrique reproduite indépendamment de S1 et qui retrouve ses chiffres à une
ligne près) :

| Grandeur | Valeur |
| :--- | ---: |
| `packages/core/src` (production seule) à HEAD | **1 788** |
| après C6 | **1 933** |
| ajoutées par le lot | **+145**, dont **138** dans `presentation/` |
| `types.js` / `schemas.js` / `locale.js` / `resolve.js` / `format.js` / le barrel | **4 / 55 / 22 / 14 / 39 / 4** |
| `template/migrate.js` / `template/template.js` | **+5 / +2** |

Soit `A` le taux agrégé de `packages/core/src/**` à HEAD. La CI est verte, donc `A ≥ 90` — et
**on ne connaît rien de plus**, parce que l'obtenir exigerait `pnpm run test:coverage`, que le
cadre de planification interdit dans le dépôt. Un incrément qui ajoute `L` lignes **non couvertes**
reste vert si et seulement si :

```
(A/100 × 1788) / (1788 + L) ≥ 0,90     ⟺     L ≤ 1788 × (A/100 − 0,90) / 0,90
```

| `A` | `L` maximal toléré |
| ---: | ---: |
| **90** | ⛔ **0** |
| 92 | 39 |
| 95 | 99 |

> ⛔ **Au plancher que la CI garantit — et c'est la seule hypothèse qu'on ait le droit de faire —
> UNE SEULE ligne de production non couverte fait rougir la porte 4.** Il en découle une règle
> dure du découpage, et ce n'est pas une préférence de style : **aucun incrément ne livre une
> ligne de production que ses propres tests ne couvrent pas.** Le pire découpage envisagé — un
> incrément « les trois fichiers de forme » (`types` + `schemas` + `locale` = 81 lignes) sans son
> fichier de tests — donne, à `A = 90` : `1 609,2 / 1 869 = 86,10 %`, **rouge**.
>
> Le lot **entier**, lui, monte l'agrégat dans tous les cas, parce que son taux propre (97,95 %,
> mesuré par S1) dépasse `A` : à `A = 90`, `(1 609,2 + 142) / 1 933 = 90,60 %`. La dilution que
> l'une des deux attaques craignait est **réelle en principe et nulle ici** — et elle ne l'est que
> parce qu'il n'y a presque pas de ligne neuve non testée. Les deux attaques sont départagées par
> ce calcul, pas par un avis.

---

### Vue d'ensemble

```
INC-0 ──► INC-1 ──► INC-2 ──► INC-3 ──► INC-4 ──► INC-5
(forme +  (les deux  (le champ  (barrel   (vitrine) (ADR +
 porte)    portes)    + ESTAMPILLE) public)          clôture)
   │          │          ▲           │
   │          │          │           └── ⚠️ SEUL incrément qui rougit `toHaveLength(117)`
   │          │          │               — il porte la correction 117 → 126
   │          │          └── UNIQUE forme persistée + UNIQUE estampille, MÊME commit,
   │          │              MÊME fichier. Rougit les 3 assertions de `migrate.test.ts`.
   │          └── publiable seul : rien ne stocke encore une écriture
   └── publiable seul : la porte de type arrive AVEC la première déclaration,
       et AVANT la première forme stockée
```

| # | Titre | Poids | Publiable ? | Rougit `toHaveLength(117)` ? |
| :-- | :--- | :-: | :--- | :-: |
| **INC-0** | La forme déclarée, et sa porte de type | **M** | **oui, seul** | non [mesuré] |
| **INC-1** | Les deux portes de rendu | **M** | **oui, seul** | non [mesuré] |
| **INC-2** | La forme stockée **et** son estampille | **S** | **oui** — et c'est le seul commit qui persiste quoi que ce soit | non [mesuré] |
| **INC-3** | Le barrel public | **S** | oui | ⛔ **OUI** — correction portée |
| **INC-4** | La démonstration | **L** | oui | non |
| **INC-5** | L'ADR, l'amendement d'ADR 0003, et la clôture | **M** | oui | non |

> **La convention `**Commit.**` est celle de C2, C3 et C5**, avec le suffixe `(lot C6, INC-n)` que
> l'exécution de C4 a inventé et que C5 a adopté : écrire le message ici est ce qui évite qu'il
> soit improvisé, et le suffixe est ce qui rend l'incrément retrouvable dans un `git log`.

**Une contrainte d'ordre, et une seule.** `template/template.ts` importe `PresentationTableSchema`
de `presentation/`, donc INC-2 dépend d'INC-0. Aucun cycle n'en résulte : `presentation/` importe
`expression/` (`MAX_ROUND_DECIMALS`, `dayNumberOf`) et rien d'autre du paquet, et `template/`
importait déjà `expression/` [vérifié]. L'ordre INC-2 → INC-3 est en revanche **libre** : le barrel
ne persiste rien. Il est écrit ainsi pour que l'estampille tombe le plus tôt possible après la
seule forme stockée, ce qui est la formulation littérale de la règle.

---

### INC-0 — La forme déclarée, et sa porte de type · **M** · publiable seul

> ⛔ **CET INCRÉMENT A ÉTÉ RÉÉCRIT (R-02).** Sa rédaction précédente prescrivait
> `locale.ts (declarableLocale)` et un `.refine(tag => declarableLocale(tag) !== undefined)`,
> c'est-à-dire **le contrat d'avant l'amendement de `D-06`**. Ce nom **n'existe plus** : le [§3.2]
> écrit qu'il « *disparaît et n'est pas réemployé* ». Un exécutant qui appliquait INC-0 tel qu'il
> était écrit livrait une fonction que le [§3] ne connaît pas, un test qui **passait pour une
> raison fausse** (`'zz'` refusé au parse), et un message que le [§3.3] a explicitement retiré.
> **C'est le défaut qui a fait passer le plan de « prêt à exécuter » à « à réviser ».**

**Contenu.** Le dossier `packages/core/src/presentation/` en quatre fichiers de production —
`types.ts` (`Presentation`, `PresentationTable`, `DateStyle`, `DATE_STYLES`,
`MIN_FRACTION_DIGITS`, `MAX_FRACTION_DIGITS`), `schemas.ts` (`PresentationSchema`,
`PresentationTableSchema`, les deux prédicats à coupure `refuseInvertedBounds` /
`refuseUnnamedWriting`), `locale.ts` (**`wellFormedLocale` ET `honouredLocale`**, ni l'une ni
l'autre exportée du barrel), et la façade `presentation.ts` **dans sa forme partielle** — plus
`__tests__/presentation.test.ts` ouvert avec :

- **les deux annotations** `PRESENTATION_KEYS_IN_STEP` et `PRESENTATION_VALUES_IN_STEP` ;
- le `describe` de la locale, **en DEUX moitiés, parce que le contrat a deux portes** :
  - **au parse** — les tags acceptés que la validation **structurelle** accepte et qu'un tuple clos
    refuserait (`de-DE`, `br-FR`, `es-419`, `zh-Hans-CN`), le refus nommé du `-u-` **sur la forme
    canonique** (`en-US-posix` → `en-US-u-va-posix`), le refus par `RangeError` du tag malformé,
    et ⛔ **le contrôle positif `P15` : `'zz'` et `'fr-XX'` PARSENT**, parce que c'est lui, et lui
    seul, qui empêche qu'on rétablisse l'ancienne porte sans casser un test ;
  - **au rendu, par un test DIRECT de `honouredLocale`** — importée de `./locale.js`, le fichier
    de test vivant dans le paquet : `'zz'` et `'xx-YY'` refusés (repli hôte), `'fr-XX'` refusé
    (repli intra-langue), **`'en-Latn-US'` refusé** — c'est la ligne qui **énonce la politique**
    de **R-16**, et sans elle le contrat a une politique que rien ne déclare ;
- le `describe` des refus : **N03 … N22**, une issue par faute, chemin et message intégral —
  ⚠️ **N01 et N02 en sont RETIRÉS**, ils ne sont plus des refus de parse (**R-03**) ;
- l'`it` du plafond de fraction : `MAX_FRACTION_DIGITS === MAX_ROUND_DECIMALS === 15`.

**Pourquoi `locale.ts` est ici et pas dans INC-1, alors que sa moitié RENDU n'y sert pas.** Parce
que `schemas.ts` **importe `wellFormedLocale`** : `PresentationSchema.locale` est un
`z.string().refine(tag => wellFormedLocale(tag) !== undefined)`. La coupure « la forme et ses
refus » contre « les fonctions de rendu » ne passe donc pas entre le schéma et le prédicat, elle
passe **à l'intérieur de `locale.ts`** — et c'est une raison de plus de livrer le fichier entier
ici : **couper `honouredLocale` dans INC-1 séparerait la fonction de la note de couture qui
l'explique**, qui fait cent trente des cent quatre-vingt-quatre lignes du fichier.

**Pourquoi il ne se coupe jamais.** Parce que M1 et M2 de la matrice §4.0(a) passent les quatre
portes **en silence** sans les deux annotations, et parce que c'est cet incrément qui les écrit.
Un lot ultérieur qui ajoute le `numberingSystem` optionnel que D-10 recommande d'instruire tombe
**exactement** dans M1.

**Pourquoi il est publiable alors qu'il ajoute du code public.** Parce qu'il n'ajoute **aucune
forme stockée** : `Template` n'a pas de champ `presentations`, donc `TemplateSchema` — un
`z.object` — **dépouille** la clé de tout document qui la porterait. Un build antérieur n'a rien à
perdre, et le build de cet incrément n'écrit rien qu'un build antérieur perdrait. Il ne touche pas
non plus `index.ts` : le compte reste à **117** [mesuré], donc `style.test.ts:134` reste vert.

**Critère de sortie, mécanique.** La matrice de mutation passe de **2 sur 6 exit 0** à **6 sur 6
exit 1** [mesuré, §4.0(a)]. Et le contrôle négatif du linter est rejoué **sur ce commit** :
`new Intl.NumberFormat()` refusé, `new Intl.DateTimeFormat('fr-FR', opts)` avec `opts` hoisté
refusé, **le même précédé d'un `biome-ignore` refusé quand même** [mesuré par S1, Biome 2.5.8].

**Ce qu'il ne fait pas, et qui est un résultat.** Il ne touche **ni** `ast/visitor.ts`, **ni**
`template/paths.ts`, **ni** `expression/` : une écriture n'est pas un nœud, ne porte aucune
`Expression`, et n'est traversée par aucun des six parcours. **Zéro reprise de parcours**, et la
condition de validité est la même que celle de C5 : aucune position d'écriture n'accepte une
expression.

**Commit.** `feat(core): décrire une écriture — sa langue, sa monnaie, ses deux bornes et sa date (lot C6, INC-0)`

---

### INC-1 — Les deux portes de rendu · **M** · publiable seul

**Contenu.** `presentation/resolve.ts` (`resolvePresentation`), `presentation/format.ts`
(`formatMoney`, `formatDecimal`, `formatDate`), l'élargissement de la façade, et les trois
`describe` correspondants : la sélection par argument, l'écriture d'un nombre, l'écriture d'une
date.

**Pourquoi une coupure ici, et pas un seul gros incrément.** Parce que les deux moitiés répondent à
deux questions différentes et se relisent séparément : INC-0 dit **ce qu'un document déclare** et
**ce qu'il refuse** ; INC-1 dit **ce qu'on en fait**. La preuve que la coupure est réelle : INC-0
ne construit `Intl` qu'à une seule fin — vérifier qu'une locale est honorée — tandis qu'INC-1 est
le seul endroit du paquet qui **formate**.

**Les deux portes, et pourquoi il y en a deux et non une.** `resolvePresentation` répond
`undefined` pour une faute de **modèle ou d'appel** (nom non déclaré, locale que ce moteur
n'honore pas) ; un formateur répond `undefined` pour une faute de **valeur** (non finie, date que
`dayNumberOf` refuse). **Une absence, une cause, à chaque porte** — c'est ce qui permet à ce lot
de ne créer **aucun code d'erreur** (D-11), et c'est aussi la forme honnête au rendu : la locale
se résout **une fois par document**, les valeurs se formatent **N fois** (attente E4-3).

**Le piège de test, et il est structurel à ce lot.** [mesuré] `1 234,50 €` en `fr-FR` porte
**U+202F** entre les chiffres et **U+00A0** avant le symbole, et le U+202F est arrivé avec
**CLDR 42 / ICU 72**. La CI tourne sur `node: [24, 26]` (`.github/workflows/ci.yml:59`), donc deux
jeux CLDR : **un test qui figerait une chaîne formatée peut passer sur l'un et rougir sur
l'autre.** Aucune assertion de cet incrément ne fige une chaîne : elles comparent des **comptages
de chiffres**, des **égalités entre deux écritures**, des `toContain('2026')` / `not.toContain('2569')`,
et des allers-retours `Number(printed)`. La sonde 11 de [§6.5] fait de cette règle un critère.

**Publiable seul, même raison qu'INC-0** : aucune forme stockée, `index.ts` intact, compte à
**117** [mesuré]. Une fonction exportée d'un dossier qu'`index.ts` ne réexporte pas est
inatteignable pour un intégrateur — c'est une propriété, pas un défaut : elle est ce qui rend cet
incrément publiable.

**Commit.** `feat(core): écrire une valeur dans l'écriture que l'appelant nomme (lot C6, INC-1)`

---

### INC-2 — La forme stockée **et** son estampille · **S** · le seul commit qui persiste

**Contenu, en un seul commit et dans deux fichiers :**

- `template/template.ts` — le champ `presentations?: PresentationTable`, **optionnel, sans
  défaut**, écrit entre `page` et `root` ; `CURRENT_SCHEMA_VERSION` **6 → 7** ; la section de
  docstring `## What version 7 means` ;
- `template/migrate.ts` — l'entrée `{ from: 6, to: 7 }` ajoutée à `TEMPLATE_MIGRATIONS` **sans
  fusionner les cinq existantes**, **estampille seule** :
  `migrate: (input) => ({ ...input, schemaVersion: 7 })` ;
- `template/migrate.test.ts` — **les trois assertions qui rougissent**, corrigées ;
- `presentation/__tests__/presentation.test.ts` — le `describe` de la forme stockée : la chaîne
  épinglée à six paires, l'aller-retour d'un v6 estampillé sans transformation, un v6 **portant
  déjà une table** qui ressort estampillé avec sa table intacte, et **la table vide contre la
  table absente**, qui sont deux énoncés différents et tous deux acceptés (D-13).

**Pourquoi la forme et l'estampille dans le même commit.** Parce qu'il n'existe **qu'une** forme
persistée dans tout le lot, et qu'elle est déclarée **dans le fichier qui porte l'estampille**.
Les séparer produirait un commit non publiable dont le seul contenu serait la moitié d'une
décision, dans un fichier qu'il faudrait rouvrir au commit suivant. La règle d'AGENTS.md §1.2 est
« une estampille, après la dernière forme persistée » : elle est **satisfaite à la lettre**, et
c'est la comparaison avec C5 qui le montre — C5 avait deux fichiers et deux incréments entre les
deux, C6 n'a ni l'un ni l'autre.

**Ce qui justifie l'estampille, et c'est la classe dangereuse.** Un champ **optionnel** ajouté à
`Template` est le cas **PERTE SILENCIEUSE** d'AGENTS.md §1.2, pas le refus illisible : aucune
union ne s'élargit, donc aucun build antérieur ne rencontre de discriminant inconnu. Un build v6
ouvrant un document v7 l'**accepte sans aucune erreur** et **dépouille toute la table**, après quoi
un `onSave` persiste la perte et chaque montant retombe à la mise en chaîne nue. Avec l'estampille,
le même document rend `TemplateMigrationError: … written by a newer release of Openview; upgrade
before opening it.` — **et c'est l'estampille seule qui le produit**, indépendamment de la forme
neuve. Une migration qui n'estampille que **n'est pas une migration fantôme** : elle est *tout* ce
qui produit ce message.

**Les trois assertions rouges, mesurées et non déduites** [mesuré, exécution réelle contre le bac
à sable] :

| Fichier:ligne | Assertion | Avant | Après |
| :--- | :--- | :-: | :-: |
| `template/migrate.test.ts:158` | la liste littérale des paires `[from, to]` | 5 entrées | **6** |
| `template/migrate.test.ts:191` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** |
| `template/migrate.test.ts:210` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** |
| `template/migrate.test.ts:165` | `toHaveLength(CURRENT_SCHEMA_VERSION - 1)` | 5 = 5 | **6 = 6**, vert |

**Trois, et non douze.** Le poste « douze tests de `migrate.test.ts` » du dossier était
**surévalué d'un facteur quatre** ; tout le reste du dépôt passe par `CURRENT_SCHEMA_VERSION` et
reste vert [vérifié : `ast/__tests__/fixtures.ts:206`, `page/__tests__/page.test.ts:212,226,236`,
`style/__tests__/style.test.ts:480,559`, `ast/__tests__/table.test.ts:370`,
`expression/evaluator/__tests__/limits-scope.test.ts:442`, `apps/playground/src/App.tsx:292,1341`].

**Ce que la section de version ne recopie pas.** L'asymétrie `root` / `page` de la v5, que C5 avait
déjà refusé de recopier parce qu'elle est fausse pour un build v5. Et **le refus argumenté d'une
écriture de compatibilité** : une feuille de compatibilité (v5) était possible parce que l'A4
existe partout ; une **écriture** de compatibilité devrait nommer une **langue** et une
**monnaie**, et `README.md:17` dit qu'Openview « ne détient aucun référentiel ». **Il n'existe pas
de devise qui existe partout.** Absent = « ce modèle ne déclare aucune écriture », ce que
déclarait tout document écrit avant ce lot : la migration n'a **rien à inventer**.

> ⚠️ **Correction de citation, à porter dans le plan.** Le dossier cite `README.md:127` pour
> « Openview ne détient aucun référentiel ». [vérifié] `README.md:127` est le jalon **J4** ; la
> phrase est à **`README.md:17`**, et son écho de roadmap à **`docs/roadmap/README.md:125`**. La
> mauvaise référence apparaît dans plusieurs docstrings du bac à sable et **doit être corrigée
> avant le commit**, sans quoi le lot publie une citation fausse dans le paquet.

**Publiable, et le compte reste à 117** [mesuré : le `src` complet avec le champ, la version 7 et
la migration, `index.ts` intact, rend `Object.keys(core).length === 117`].

**Commit.** `feat(core): stocker les écritures d'un modèle, estampiller 7 (lot C6, INC-2)`

---

### INC-3 — Le barrel public · **S** · publiable

**Contenu.** `packages/core/src/index.ts` : **neuf valeurs** (`DATE_STYLES`,
`MAX_FRACTION_DIGITS`, `MIN_FRACTION_DIGITS`, `PresentationSchema`, `PresentationTableSchema`,
`formatDate`, `formatDecimal`, `formatMoney`, `resolvePresentation`) et **cinq types**
(`DateStyle`, `Presentation`, `PresentationTable`, et depuis **A-7** `PresentationRefusal` et
`PresentationResolution`). ⛔ **Le compte de valeurs reste 126** — les types n'émettent rien.
Plus, **dans le même commit** :

- le `describe` de surface publique dans `presentation/__tests__/presentation.test.ts` —
  `expect(values).toHaveLength(126)`, les neuf `toContain`, et **trois** `not.toContain` :
  `'wellFormedLocale'`, `'honouredLocale'` (les deux prédicats réels, **R-04**) et
  `'declarableLocale'` — ce dernier **épinglé négativement pour qu'un retour à la rédaction
  d'avant C-1 rougisse**, et pour cette raison seule ; ⚠️ **si `A-7` est retenu, le chiffre `126`
  et la liste des neuf sont à remesurer** ;
- **`packages/core/src/style/__tests__/style.test.ts:134` : `toHaveLength(117)` → `toHaveLength(126)`.**

> ⛔ **C'est le seul incrément du lot qui rougit le filet de surface publique, et il est le seul
> qui puisse porter sa correction.** [mesuré] : avec `presentation/`, le champ, la version 7 et la
> migration en place mais `index.ts` intact, `Object.keys(core).length` vaut **117** ; le bloc de
> neuf valeurs ajouté, il vaut **126**. Annoncer INC-0, INC-1 ou INC-2 publiables sans mesurer
> cela aurait été l'erreur exacte que l'attaque versionnement a trouvée chez deux conceptions.

**Pourquoi un test compte les exports.** Parce que le barrel est le seul endroit du dépôt où un
oubli est **totalement silencieux** : un symbole non exporté ne casse rien, il rend une
fonctionnalité inatteignable pour un intégrateur, et **aucune porte ne le voit**. Le compte est
**mesuré par émission ESM réelle puis import**, pas raisonné.

**Ce qui n'est délibérément PAS exporté, et chaque exclusion porte son motif** :
`wellFormedLocale` **et** `honouredLocale` — ⚠️ **deux** prédicats depuis la scission de `D-06`, et
non plus un seul nommé `declarableLocale` (**R-04**) ; aucun consommateur hors du paquet ne les
nomme, et toute porte qui atteint `Intl` passe déjà par l'un des deux ; les précédents sont exacts (`prefixPath` dans `errors.ts`,
`aliasSchema` dans `expression/identifiers.ts`, tous deux absents d'`index.ts`) · **aucune liste**
de locales ni de devises — Openview ne détient aucun référentiel (`README.md:17`) · **aucun
`scaleOf`** — l'échelle est déclarée, jamais dérivée, et la fonction **n'est pas écrite** (D-05) ·
**aucune sixième porte bornée** `parsePresentation` — une écriture n'est pas un fragment autonome,
elle vit dans un `Template` que `parseTemplate` valide déjà.

**Commit.** `feat(core): exposer le contrat d'écriture, et remesurer le compte du barrel (lot C6, INC-3)`

---

### INC-4 — La démonstration · **L** · publiable

**Contenu.** `apps/playground/src/App.tsx` : une table de **deux écritures** sur l'unique
`Template` de la vitrine, un sélecteur d'écriture, le câblage **site par site** des trois
fonctions, l'affichage des deux listes `collectTemplateDataPaths` **égales**, et **la suppression
de `const fr`** (`App.tsx:1477`). Le détail de ce que la page doit montrer, et de ce qu'elle ne
peut pas montrer, est en [§6.4].

**Pourquoi c'est L, et pourquoi c'est le premier candidat au sacrifice.** Le geste lourd est le
câblage : `runsDeSegments` (`App.tsx:827`) rend aujourd'hui `String(value)` à la ligne **856**
pour **toute** valeur liée, et c'est exactement le site que le contrat ne sait pas trancher
(E4-1). La vitrine doit donc décider **à la main**, valeur par valeur, ce qui s'écrit et comment —
et **le dire à l'écran**, sans quoi la démonstration prétendrait résoudre E4-1.

**Ce que la coupe coûte, nommé.** Le lot reste **livrable** et devient **non recevable** : le
critère de recette de [§6.3] est démontré par des `it`, mais la moitié *visible* — deux écritures
d'une même facture, côte à côte, lisibles par un humain — disparaît, et c'est la seule chose que
ce lot puisse montrer sans moteur.

⚠️ **Correction d'un énoncé de C5 que ce lot ne doit pas recopier.** C5 écrit qu'`apps/*` est
« hors du glob de Vitest, donc **aucune porte** ne relit ce fichier ». La première moitié est vraie
et la seconde est fausse : [vérifié] `vitest.config.ts` déclare `projects: ['packages/*']` et
`coverage.include: ['packages/*/src/**']`, donc **la porte 4 seule** est aveugle ;
`apps/playground/package.json` porte ses propres scripts `build` et `type-check`, et
`biome.jsonc:14` inclut `**`. **Trois portes sur quatre relisent `App.tsx`.** Ce qui manque est un
`it`, pas une porte.

**Commit.** `feat(playground): écrire la même facture dans deux écritures déclarées (lot C6, INC-4)`

---

### INC-5 — L'ADR, l'amendement d'ADR 0003, et la clôture · **M** · publiable

**Contenu.**

1. **`docs/adr/0008-langue-devise-et-formats.md`** — nouveau : les 22 décisions D-01 … D-22, les
   refus avec leur coût, et **les neuf attentes envers le moteur** (E4-1 … E4-9) avec leur
   propriétaire et le lot où chacune est vérifiable. C5 a établi le geste : **les dettes qu'un
   contrat crée vivent dans l'ADR, jamais éparpillées dans les docstrings qui les créent.**
2. **`docs/adr/0003-formules-agregations-et-dates-civiles.md`** — **amendé explicitement**. C'est
   le blocage B1, et il ne se contourne pas en silence.
3. **`docs/roadmap/core.md`** — C6 marqué livré, sur le gabarit de C2 et C5
   (`> ✅ **Livré le …**`), avec **le critère effectivement tenu** et le renvoi à E4 pour l'autre
   moitié [§6.1].
4. **`docs/roadmap/engine.md`** — E4 pointe les neuf attentes de l'ADR 0008 plutôt que de les
   redécouvrir.
5. **`docs/plans/c6-langue-devise-et-formats.md`** — marqué `⛔ PÉRIMÉ`, en dernier.

#### L'amendement d'ADR 0003, rédigé précisément — parce que la version large serait fausse

`docs/adr/0003:240-242` pose **deux conditions d'admission d'une fonction dans l'algèbre
d'expressions** :

> 1. son résultat est une fonction pure de ses arguments explicites — **aucune convention à
>    choisir, aucune table de règles embarquée** ;
> 2. elle ne lit **rien** de l'environnement — ni horloge, ni fuseau, ni locale, ni ICU.

et `:783-784`, à propos de `toLocaleUpperCase` :

> La variante locale (`toLocaleUpperCase`) est **interdite** : elle dépend d'ICU et casse E6 pour
> de bon.

**Ce qui reste vrai sans amendement, et il faut le dire d'abord :** la première citation gouverne
**l'algèbre d'expressions**, et ce lot n'y ajoute **rien** — le kind `format` est refusé, sur un
motif mesuré (zéro `concat(` enfouissant une valeur à formater dans le seul consommateur réel).
Aucune fonction d'expression ne lit ICU après ce lot, et [mesuré]
`git grep -c "case 'round':" -- packages/core/src/expression` reste à **2**.

**Ce qui devient faux, et qu'il faut donc amender :** la seconde citation est une **position de
doctrine sur la dépendance à ICU**, et `presentation/format.ts` en dépend. L'amendement ne dit pas
« `core` peut lire son environnement » — il ne le peut toujours pas, et c'est tout l'objet des
deux prédicats de `locale.ts`. Il dit **ce qui reste garanti**, en trois phrases opposables :

> **Amendement C6.** Une fonction de `presentation/` peut appeler `Intl` **si et seulement si** la
> locale lui est **déclarée par le modèle**, **structurellement valide au sens d'ECMA-402**
> (`wellFormedLocale`, au parse) et **honorée telle quelle** par ce moteur (`honouredLocale`, au
> rendu), et si `timeZone`, `calendar` et `numberingSystem` sont **épinglés en
> littéral en ligne**. La garantie de déterminisme devient : *deux rendus du même document par le
> **même build** produisent la **même chaîne** ; deux builds portant deux versions d'ICU peuvent
> produire deux **caractères d'espace** différents.* Le second point est la contrainte que E6
> hérite, et il est **mesuré** : `1 234,50 €` en `fr-FR` porte U+202F entre les chiffres et U+00A0
> avant le symbole, et le U+202F est arrivé avec **CLDR 42 / ICU 72** — la CI tourne sur
> `node: [24, 26]` (`.github/workflows/ci.yml:59`).

**Propriétaire : le propriétaire du produit, avant la livraison de C6.** Un lot ne s'amende pas
lui-même une ADR acceptée ; l'incrément **porte** l'amendement, il ne le **décide** pas.

**Pourquoi cet incrément est en dernier et publiable seul.** Aucune porte ne lit un commentaire ni
un fichier de `docs/` — c'est ce qui le rend **coupable en dernier recours**, et c'est aussi
pourquoi il ne doit **pas** l'être : les neuf attentes envers le moteur sont la seule trace écrite
de ce que E4 devra honorer, et un lot qui les laisse dans des docstrings les perd.

**Commit.** `docs(core): consigner le contrat d'écriture, amender l'ADR 0003 sur ICU (lot C6, INC-5)`

---

### Ce que le découpage vérifie contre les deux règles dures

| Règle | Vérification |
| :--- | :--- |
| **L'estampille est unique** | `CURRENT_SCHEMA_VERSION` n'est écrit qu'à INC-2, et `TEMPLATE_MIGRATIONS` ne gagne qu'une entrée. Sondes 12a/12b de [§6.5]. |
| **L'estampille est tardive** | Elle est **au même commit** que l'unique forme persistée du lot, donc après **toutes** les formes persistées — il n'y en a qu'une. INC-3, INC-4 et INC-5 n'en persistent aucune. |
| **Aucun commit ne persiste sans estampille** | INC-0 et INC-1 ne déclarent aucun champ de `Template` ; `TemplateSchema` étant un `z.object`, une clé `presentations` écrite à la main y serait **dépouillée**. Il n'existe donc aucun build intermédiaire capable d'écrire un document que le précédent perdrait. |
| **`toHaveLength(117)` ne rougit qu'une fois** | [mesuré] INC-0/1/2 → **117** ; INC-3 → **126**, correction dans le même commit. |
| **Aucun incrément ne dilue la couverture** | Chaque incrément livre ses tests. À `A = 90`, **une seule** ligne de production non couverte fait rougir la porte 4 [§4.0(c)]. |
| **Aucun `biome-ignore`** | Zéro dans tout le lot, tests compris [mesuré, Biome 2.5.8] — et c'est obligatoire, puisque [mesuré] **aucune des cinq orthographes de `biome-ignore` ne supprime un diagnostic de plugin**. Toute forme refusée par le plugin est **réécrite**, jamais annotée. |

> ⚠️ **Le fichier de tests est écrit en quatre fois, et l'ordre d'écriture est prescrit** :
> INC-0 y met les deux annotations, le `describe` de la locale, celui des refus `N01…N22` et l'`it`
> du plafond de fraction ; INC-1 y ajoute les trois `describe` de rendu ; INC-2, celui de la forme
> stockée et de l'estampille ; INC-3, celui de la surface publique. **Un `describe` posé trop tôt
> rougit** : celui de la surface publique attend `126`, celui de l'estampille attend `7`.

---


---

## 5. Le plan de test du lot C6

Dépôt **non touché** : `git status --porcelain` rend 0 ligne, HEAD `320bea6`, avant et après
[vérifié]. Tout ce qui suit est mesuré dans
`…/scratchpad/c6/sandbox-FINAL/s2/`, sur la copie de `packages/core/src` que le contrat
définitif a produite (`…/sandbox-FINAL/core/src/`). Node 24.11.1, ICU 77.1, CLDR/Unicode 16.0,
zod `4` via `zod/v4` (paquet `zod@3.25.76`), Biome 2.5.8, fuseau de la machine `Europe/Paris`
(décalage `-120`) — ce dernier point n'est pas décoratif, il tue une mutation (§5.4, M13).

---

### 5.0 L'étau, nommé avant les règles

Quatre contraintes se contredisent partiellement, et une doctrine d'assertion qui n'en nomme
qu'une produit des tests qui rougissent en CI ou qui ne prouvent rien.

| Contrainte | Source | Ce qu'elle interdit |
| :--- | :--- | :--- |
| Couverture ≥ **90 %**, agrégat de glob sans `perFile` | AGENTS.md §5 ; `vitest.config.ts` | de laisser du code neuf non exercé |
| **Pas de test tautologique** — « un test qui n'assure aucun contrat est pire que pas de test » | AGENTS.md §5 | d'exercer une ligne sans asserter un contrat |
| **Une sonde ICU ne se committe pas** — « consignées ici et jamais committées en test » | `docs/adr/0004:68-69` | de figer en CI une mesure statistique sur ICU |
| **Deux jeux CLDR** — `node: [24, 26]` | `.github/workflows/ci.yml:59` | de figer une chaîne que CLDR produit |

La quatrième est la plus mordante et la moins visible. [mesuré] `Intl.NumberFormat('fr-FR',
{ style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
.format(1234.5)` rend `"1 234,50 €"` dont les points de code sont

```
0031 202F 0032 0033 0034 002C 0035 0030 00A0 20AC
     ^^^^ espace fine insécable (U+202F)          ^^^^ espace insécable (U+00A0)
```

deux espaces **différents** dans une seule chaîne de dix caractères, et le U+202F a été introduit
par **CLDR 42 / ICU 72**. Une assertion `toBe('1 234,50 €')` écrite au clavier porte presque
certainement `0020` et rougit **sur les deux** versions de Node ; écrite par copier-coller depuis
une sortie, elle passe sur l'une et rougit sur l'autre. Le piège n'épargne pas les locales
« ASCII » : [mesuré] `fr-CH` rend `"1 234.50 CHF"` avec le **point** comme séparateur décimal et
U+202F comme séparateur de milliers — la ponctuation est une donnée de CLDR, pas une propriété du
contrat.

D'où la doctrine ci-dessous, et sa réponse d'emblée à la question bloquante de l'avocat du diable.

> **La réponse, en une phrase :** est légitime toute assertion dont **aucun caractère ne vient de
> CLDR** — les chiffres d'une valeur, un texte dont Openview est l'auteur, un `code` ou un `path`
> de zod, une comparaison entre deux sorties du **même** build. Est illégitime toute assertion qui
> nomme un caractère qu'ICU a choisi, **y compris quand il paraît ASCII**.

---

### 5.1 La doctrine d'assertion du lot — sept règles

#### R1 — Aucune chaîne formatée par ICU n'est figée, nulle part

**Contre-exemple** (l'assertion fautive) :

```ts
expect(formatMoney(1234.5, FR)).toBe('1 234,50 €');
```

**Pourquoi c'est faux** : [mesuré] la chaîne réelle porte U+202F puis U+00A0 (§5.0). Sur `node: 24`
(ICU 77) elle les porte ; rien ne garantit qu'un ICU antérieur ou postérieur les porte à
l'identique, et la CI exécute **deux** ICU.

**Forme correcte** : comparer à **une autre sortie du même build**, ou n'asserter que ce que la
valeur contient.

```ts
expect(formatMoney(-0, FR)).toBe(formatMoney(0, FR));      // deux sorties, même build
expect(digitsOf(formatMoney(1234.5678, FR) ?? '')).toBe('123457');
```

[mesuré] les 39 blocs `it` du fichier de tests ne figent **aucune** chaîne formatée.

---

#### R2 — La valeur s'asserte ; la ponctuation, jamais — et l'aller-retour `Number()` a deux préconditions qui s'écrivent

**Contre-exemple A** :

```ts
expect(printed).toContain(',');           // le séparateur décimal appartient à CLDR
expect(printed).toContain('1 234');       // le séparateur de milliers aussi
```

**Contre-exemple B**, plus insidieux parce qu'il *paraît* neutre :

```ts
expect(Number(formatDecimal(1234.5, EN))).toBe(1234.5);   // -> NaN
expect(Number(formatDecimal(123.5, FR))).toBe(123.5);     // -> NaN
```

**Mesuré**, les quatre combinaisons :

| écriture | valeur | imprimé | `Number(imprimé)` |
| :--- | ---: | :--- | :--- |
| `en-US` | `123.5` | `"123.50"` | **123.5** ✅ |
| `en-US` | `1234.5` | `"1,234.50"` | `NaN` ❌ (groupement) |
| `fr-FR` | `123.5` | `"123,50"` | `NaN` ❌ (virgule décimale) |
| `fr-FR` | `1234.5` | `"1 234,50"` | `NaN` ❌ (les deux) |

L'aller-retour n'est donc valide **que** sous deux préconditions conjointes : une écriture dont le
séparateur décimal est le point, **et** une valeur sous le seuil de groupement. Les deux
appartiennent à CLDR ; les nommer dans le corps du test ne suffit pas, elles doivent être **dans
le nom du test**, sans quoi le prochain contributeur remplacera `123.5` par un montant réaliste et
verra rouge sans comprendre.

**Forme correcte** — deux outils, et seulement deux :

```ts
/** Every digit of a printed value, separators and symbols removed. */
const digitsOf = (printed: string): string => printed.replace(/[^0-9]/gu, '');

it('round-trips through Number() when the writing has no grouping to do', () => {
  const printed = formatDecimal(123.5, EN);
  expect(Number(printed)).toBe(123.5);
  expect(digitsOf(printed ?? '')).toBe('12350');
});
```

`digitsOf` est l'outil général : il survit à n'importe quel CLDR parce qu'il **retire tout ce que
CLDR a mis**. L'aller-retour `Number()` est l'outil de précision — il prouve que le nombre
imprimé *est* le nombre — et il ne s'emploie que sur `en-US` sous mille.

---

#### R3 — Une sortie ne se compare à rien ; elle se compare à une autre sortie du même build

**Contre-exemple** :

```ts
expect(formatMoney(1234.5, FR)).not.toBe('1 234,50 $');   // fige un négatif, aussi fragile
```

**Forme correcte** — la propriété du lot est *une valeur, deux écritures, deux chaînes portant les
mêmes chiffres* :

```ts
expect(formatMoney(1234.5, FR)).not.toBe(formatMoney(1234.5, EN));
expect(digitsOf(formatMoney(1234.5, FR) ?? '')).toBe(digitsOf(formatMoney(1234.5, EN) ?? ''));
```

**⚠️ Et cette forme-là, sur `formatMoney`, ne prouve pas ce qu'elle a l'air de prouver.** [mesuré]
la mutation M26 — remplacer `Intl.NumberFormat(writing.locale, …)` par
`Intl.NumberFormat(undefined, …)`, c'est-à-dire **lire la locale de la machine** — **survit** à
cette paire : `FR` et `EN` déclarent deux **devises** différentes, donc les deux chaînes diffèrent
même quand la locale est ignorée. La forme qui mord isole la locale en retirant la devise :

```ts
expect(formatDecimal(1234.5, FR)).not.toBe(formatDecimal(1234.5, EN));
```

[mesuré] celle-ci tue M26 **sur n'importe quel hôte**, parce que deux locales qui impriment une
valeur *identiquement* ne peuvent le faire que si aucune des deux n'a été employée.

---

#### R4 — Une propriété d'ICU s'interroge avec un tag EXPLICITE, et jamais contre la valeur de l'hôte

C'est la règle qui a tué le bac à sable de la conception A à la porte 1.

**Contre-exemple A** :

```ts
expect(new Intl.NumberFormat().resolvedOptions().locale).toBe('fr-FR');
```

Deux fautes en une ligne. L'arité zéro est **refusée par le plugin** `no-environment-read`
[mesuré : *« `new Intl.*` called with no argument falls back to the host locale… »*], et
**aucune des cinq orthographes de `biome-ignore` ne supprime un diagnostic de plugin en Biome
2.5.8** [mesuré, contrôle négatif du contrat définitif]. Une forme refusée par le plugin se
**réécrit**, elle ne s'annote pas. Et le `toBe('fr-FR')` fige la machine de CI.

**Contre-exemple B**, le remède tentant et mauvais : s'appuyer sciemment sur l'angle mort
`Intl.NumberFormat(undefined, opts)`, que le plugin ne voit pas [mesuré : la mutation L5 passe le
lint sans un diagnostic]. Écrire un test qui *repose* sur un angle mort du linter, dans un lot dont
l'objet est de fermer les angles morts du linter, est une contradiction.

**Forme correcte** — le tag est explicite, la propriété est démontrée, la machine n'est jamais
nommée :

```ts
expect(new Intl.NumberFormat('zz').resolvedOptions().locale).not.toBe('zz');
```

[vérifié] le fichier de tests contenant cette ligne passe `biome check` avec **zéro** diagnostic.
La propriété affirmée — *un tag qu'ICU ne connaît pas retombe sur autre chose* — est le trou
entier que `honouredLocale` existe pour boucher (⚠️ `declarableLocale` **n'existe plus**, **R-04**),
et elle est vraie sur n'importe quel hôte.

> **Aveu attaché à cette règle** (à reprendre dans la revue) : `'zz'` interroge une **propriété
> d'ICU**, pas une garantie de spécification. Si un ICU futur reconnaissait `zz`, ce test
> rougirait — ce qui est le bon comportement, car il faudrait alors relire D-06, mais c'est un
> test qui interroge le moteur et le relecteur doit le savoir.

---

#### R5 — Le calendrier et le système de chiffres s'assertent par l'ABSENCE, et le style de date est couplé à l'assertion

**Contre-exemple** :

```ts
expect(formatDate('2026-08-19', writing({ locale: 'th-TH' }))).toBe('19/8/26');
```

**Forme correcte** — l'année grégorienne est **présente**, les années des autres calendriers sont
**absentes** :

```ts
for (const locale of ['th-TH', 'fa-IR', 'ja-JP']) {
  const printed = formatDate('2026-08-19', writing({ locale })) ?? '';
  expect(printed).toContain('2026');
  expect(printed).not.toContain('2569');   // année bouddhique
  expect(printed).not.toContain('1405');   // année persane
}
```

**Le couplage qu'il faut écrire** : `toContain('2026')` n'est vrai que si le `dateStyle` de
l'écriture imprime l'année sur quatre chiffres. [mesuré] `th-TH` + `short` rend `"19/8/26"` et
`fr-FR` + `short` rend `"19/08/2026"` — la largeur de l'année est **une décision de CLDR par
locale**. Le test emploie donc le `dateStyle: 'long'` de la fixture `FR`, et ce n'est pas un
détail : [mesuré] la mutation M29 (`dateStyle: writing.dateStyle` → `dateStyle: 'short'`) est
**tuée par ce test précis**, sur `th-TH`, et par aucun autre. Un relecteur qui « simplifierait » la
fixture en `short` désarmerait la mutation sans toucher une assertion.

Même forme pour les chiffres, et elle atteint **les montants** :

```ts
expect(digitsOf(formatMoney(1234.5, writing({ locale: 'ar-EG' })) ?? '')).toBe('123450');
```

[mesuré] `ar-EG` sans épinglage rend `١٬٢٣٤٫٥` ; `digitsOf` ne garde que `[0-9]`, donc un système
oriental rend la chaîne **vide** et l'assertion rougit.

---

#### R6 — Ce qui se fige est ce dont Openview est l'auteur — et rien d'autre

Il y a bien un cas où figer une chaîne est légitime, et il se définit exactement : **la chaîne ne
contient aucun caractère produit par CLDR**.

| Se fige ✅ | Ne se fige jamais ❌ |
| :--- | :--- |
| un message d'erreur **écrit dans ce dépôt** (`toContain('minFractionDigits is above maxFractionDigits')`) | un message natif de zod (`'Invalid key in record'`) |
| un `code` de zod (`toBe('invalid_format')`) | une chaîne formatée par `Intl`, même d'apparence ASCII |
| un `path` de zod (`toBe('maxFractionDigits')`) | un séparateur, un symbole monétaire, un nom de mois |
| des clés d'objet (`Object.keys(parsed)` → `['ok']`) | la locale résolue de l'hôte |
| une constante du contrat (`MAX_FRACTION_DIGITS` → `15`, `DATE_STYLES`) | |
| la surface publique (`toHaveLength(126)`) et la liste `[from, to]` des migrations | |
| des **chiffres** extraits par `digitsOf` | |

**Contre-exemple sur le message** :

```ts
expect(issue?.message).toBe('Invalid key in record');
```

C'est le message **de zod**, pas celui du dépôt ; il change à une montée mineure, et le lot entier
existe en partie pour le remplacer — [mesuré] `z.record(z.string().min(1), …)` rend `code:
'invalid_key'`, `path: []` et ce message, c'est-à-dire le refus non typé sur le chemin vide que
`refuseUnnamedWriting` a été écrit pour éviter.

**Forme correcte** : `toContain` sur un fragment **du dépôt**, `toBe` sur le code et le chemin.

```ts
expect(issue?.code).toBe('custom');
expect(issue?.path).toBe('maxFractionDigits');
expect(issue?.message).toContain('minFractionDigits is above maxFractionDigits');
```

`toContain` plutôt que `toBe` sur le message : un message de ce dépôt fait deux à trois lignes et
sa reformulation est un geste de revue légitime ; ce qui ne doit pas bouger, c'est le **fait**
qu'il nomme.

---

#### R7 — Une sonde ne se committe pas ; son INVARIANT, oui

`docs/adr/0004:68-69` : les mesures ICU sont « consignées ici et **jamais committées en test** ».

**Contre-exemple** :

```ts
it('mesure la divergence entre roundDecimal et Intl sur 200 000 tirages', () => {
  let divergences = 0;
  for (let i = 0; i < 200_000; i += 1) { /* … */ }
  expect(divergences).toBe(0);
});
```

Trois fautes : 200 000 formatages à chaque exécution de CI ; un chiffre statistique dont la valeur
dépend de CLDR ; et un test qui **mesure** au lieu d'**assurer**, c'est-à-dire la définition même
du test tautologique inversé — il assure une propriété du moteur, pas un contrat du lot.

**Forme correcte** — la mesure vit dans le rapport et dans l'ADR ; le test committé pose la
**conséquence** sur une valeur nommée :

```ts
it('never prints the IEEE-754 tail of a value nobody rounded', () => {
  const noisy = 0.02 + 63.24;                       // 63.260000000000005, mesuré
  expect(noisy).not.toBe(63.26);
  expect(digitsOf(formatMoney(noisy, FR) ?? '')).toBe('6326');
  expect(0.1 + 0.2).not.toBe(0.3);                  // la forme universelle
  expect(digitsOf(formatMoney(0.1 + 0.2, FR) ?? '')).toBe('030');
});
```

La première paire est la valeur qu'ADR 0004:646 avait mesurée ; la seconde est l'exemple
canonique, gardé parce qu'il est vrai sur toute implémentation IEEE-754 là où la première dépend
des chiffres d'un moteur. **Deux assertions, zéro tirage, un contrat.**

Corollaire pratique : la mesure « `roundDecimal` en `halfExpand` puis formater ≡ formater seul sur
100,0000 % de 200 000 tirages ; en `halfEven`, divergence 4,9275 % » ne devient **pas** un test.
Elle devient l'attente moteur **E4-2** (arrondir puis formater), avec propriétaire et date.

---

### 5.2 Le tableau des refus — N01…N22, rejoués par `safeParse`

[mesuré] par exécution réelle, `…/sandbox-FINAL/run/out/s2-refusals.mjs`, contre les schémas
compilés du lot. Je les ai **rejouées plutôt que recopiées**, et la colonne « issues » vaut **1**
partout (0 pour N20, qui est une acceptation).

⛔ **Mais l'affirmation « les 22 lignes concordent avec le contrat définitif, sans exception » était
FAUSSE, et c'est R-03.** Elles concordent avec le contrat **mesuré**, qui est celui d'avant
l'amendement de `D-06` : **vingt** d'entre elles survivent, **deux** sont périmées, et le message
de **cinq** a changé. Le détail est dans l'encadré ci-dessous, et le tableau porte les deux lignes
mortes barrées plutôt que supprimées — un relevé exécuté ne se réécrit pas, il se date.

`P` = `PresentationSchema`, `T` = `PresentationTableSchema`.

> ⛔ **CE TABLEAU A ÉTÉ MESURÉ CONTRE LE CONTRAT D'AVANT L'AMENDEMENT DE `D-06` (R-03).** Il est
> conservé — un relevé exécuté ne se réécrit pas — mais **deux de ses lignes sont périmées et le
> message de cinq d'entre elles a changé.** Ce que le [§3.3] livre :
>
> | Ligne | Ce que le tableau dit | Ce que le contrat définitif fait |
> | :--- | :--- | :--- |
> | **N01** `locale: 'zz'` | refusé **au parse** | ✅ **ACCEPTÉ au parse** — bien formé, sans `-u-`. Refusé **au rendu** par `honouredLocale`, en `undefined` sans issue |
> | **N02** `locale: 'fr-XX'` | refusé **au parse** | ✅ **ACCEPTÉ au parse**, refusé **au rendu**, idem |
> | **N03 / N04 / N05** | refusés au parse | ✅ **inchangés** — `-u-` canonique pour N03, `RangeError` d'ECMA-402 pour N04 et N05 |
> | **le message**, sur les cinq | « *…honours exactly as written…* » | ⛔ **retiré**, et le [§3.10] l'épingle par un `not.toContain('honours exactly as written')`. Le message porte désormais « *structurally valid … under ECMA-402* » et renvoie la question de l'honorat au rendu |
>
> **Deux refus de RENDU sont donc à ajouter au plan de test**, et ils ne sont pas dans le tableau
> ci-dessous parce qu'ils ne passent pas par `safeParse` : `resolvePresentation(t, 'x')` rend
> `{ ok: false, refusal: 'unhonoured-locale' }` pour `locale: 'zz'` (repli hôte) **et** pour
> `locale: 'en-Latn-US'` (honoré non — la politique de **R-16**). Ils sont portés par **P16**
> [§5.3], et le `refusal` **exact** y est asserté : depuis **A-7**, un refus qui se trompe de
> cause est un test rouge, là où l'ancien `undefined` les confondait tous.

| Id | Sch. | Entrée fautive | `code` | `path` | Message (extrait porteur) | Porté par |
| :-- | :-: | :--- | :--- | :--- | :--- | :--- |
| ~~N01~~ | ~~P~~ | ~~`locale: 'zz'`~~ | ⛔ **périmé** | — | **passe au parse** ; refus au **rendu** (R-03) | à réécrire |
| ~~N02~~ | ~~P~~ | ~~`locale: 'fr-XX'`~~ | ⛔ **périmé** | — | **passe au parse** ; refus au **rendu** (R-03) | à réécrire |
| N03 | P | `locale: 'fr-FR-u-nu-thai'` | `custom` | `["locale"]` | *…no "-u-" extension…* ⚠️ message réécrit | `it`:145 |
| N04 | P | `locale: 'i-klingon'` | `custom` | `["locale"]` | *(idem)* | `it`:159 |
| N05 | P | `locale: ''` | `custom` | `["locale"]` | *(idem)* | `it`:159 |
| N06 | P | `locale` absent | `invalid_type` | `["locale"]` | `Invalid input: expected string, received undefined` | `it`:209 |
| N07 | P | `currency: 'eur'` | `invalid_format` | `["currency"]` | *…ISO 4217 alphabetic code in upper case…* | `it`:168, `it`:198 |
| N08 | P | `currency: 'ZZZZ'` | `invalid_format` | `["currency"]` | *(idem)* | ⛔ **aucun** → `it`:557 |
| N09 | P | `currency: '12A'` | `invalid_format` | `["currency"]` | *(idem)* | ⛔ **aucun** → `it`:557 |
| N10 | P | `currency` absent | `invalid_type` | `["currency"]` | `Invalid input: expected string, received undefined` | `it`:209 |
| N11 | P | `minFractionDigits: -1` | `too_small` | `["minFractionDigits"]` | *A number of fraction digits cannot be negative (minimum 0)* | `it`:168 (compte seul) → `it`:542 |
| N12 | P | `maxFractionDigits: 16` | `too_big` | `["maxFractionDigits"]` | *…at most 15 fraction digits, the finest rounding a model can declare…* | ⛔ **aucun** (le test emploie `99`) → `it`:542 |
| N13 | P | `minFractionDigits: 2.5` | `invalid_type` | `["minFractionDigits"]` | *…is a whole number… never 2.5* | `it`:168 |
| N14 | P | `min: 3, max: 2` | `custom` | `["maxFractionDigits"]` | *minFractionDigits is above maxFractionDigits…* | `it`:168, `it`:180 |
| N15 | P | `maxFractionDigits` absent | `invalid_type` | `["maxFractionDigits"]` | *(idem N13)* | `it`:209 |
| N16 | P | `dateStyle: 'iso'` | `invalid_value` | `["dateStyle"]` | *A date style is one of "short", "medium", "long", "full"* | `it`:232 |
| N17 | P | `dateStyle` absent | `invalid_value` | `["dateStyle"]` | *(idem)* | `it`:209 |
| N18 | P | `'fr-FR'` (pas un objet) | `invalid_type` | `[]` | `Invalid input: expected object, received string` | ⛔ **aucun** → `it`:578 |
| N19 | T | table `{ '': FR }` | `custom` | `[""]` | *A writing needs a name, and the empty string is not one…* | `it`:232 |
| N20 | T | table portant `__proto__` | — | — | **ACCEPTÉE**, `Object.keys` → `["ok"]` | ⛔ **partiel** → `it`:590 |
| N21 | T | table `{ montant: 3 }` | `invalid_type` | `["montant"]` | `Invalid input: expected object, received number` | ⛔ **aucun** → `it`:578 |
| N22 | T | `{ '': { …currency: 'eur' } }` | `invalid_format` | `["","currency"]` | *(idem N07)* — **la coupure** : le nom vide n'ajoute **pas** de seconde issue | `it`:232 |

**Trois observations, dont deux sont des corrections apportées à l'état du fichier de tests.**

1. **Six refus mesurés n'ont aujourd'hui aucun `it` qui les porte** : N08, N09, N12 (à la borne),
   N18, N21, et N20 à moitié — le test parse une table **saine** et vérifie l'héritage
   d'`Object.prototype`, mais **jamais** une entrée `__proto__` réellement présente. Le tableau
   les marque ⛔ et §5.4 le démontre par mutation : `^[A-Z]{3}$` desserré en `^[A-Z]{3,4}$`
   **survit**, et un plafond de fraction desserré de 15 à 50 **survit** aussi, parce que le seul
   cas écrit est `99`. Les quatre `it` de la colonne de droite (`:542`, `:557`, `:578`, `:590`,
   numérotés dans le fichier complété) referment les six.
2. **N16 et N17 rendent `invalid_value`, pas `invalid_type`.** Les codes ne sont **pas uniformes**
   entre champs absents : `z.enum` compare à une liste de membres. Le test écrit la table telle
   quelle, code par code, plutôt que d'affirmer « `invalid_type` partout » — ce qui aurait été faux
   sur le seul champ dont un Designer produira le plus souvent l'absence.
3. **N19 exige un prédicat écrit à la main.** [mesuré] `z.record(z.string().min(1), …)` rend
   `code: 'invalid_key'`, `path: []` et le message natif `"Invalid key in record"` — le refus non
   typé, sur le chemin vide, qu'aucun éditeur ne peut marquer. `refuseUnnamedWriting` met **la clé
   fautive dans le chemin**.

---

### 5.3 Les contrôles positifs — quatorze, énumérés

Un catalogue de refus ne prouve pas qu'un schéma accepte ce qu'il doit accepter ; et sur ce lot
précis, le risque est concret — un prédicat de locale trop strict transformerait Openview en
détenteur d'un référentiel par accident plutôt que par décision.

| # | Ce qui est accepté | Assertion | Ce que le refus signifierait |
| :-- | :--- | :--- | :--- |
| P01 | **6 tags** : `fr-FR`, `en-US`, `de-DE`, `br-FR`, `es-419`, `zh-Hans-CN` | `safeParse(...).success === true` | les **4 derniers** sont exactement ceux qu'un tuple clos écrit à la main oublie [mesuré] |
| P02 | `'FR-fr'` ressort canonicalisé en `'fr-FR'` | `resolvePresentation(...)?.locale === 'fr-FR'` | le résolveur rendrait un tag qu'`Intl` recanonicaliserait |
| P03 | `currency: 'ZZZ'` | `success === true` | Openview tiendrait un registre ISO 4217 |
| P04 | table `{ montant: FR }` | `success === true` | un nom d'écriture ordinaire serait refusé |
| P05 | `minFractionDigits: 0`, `maxFractionDigits: 15` | `success === true` | **la borne acceptée** ; un schéma qui refuse 15 est aussi faux qu'un schéma qui accepte 16 |
| P06 | dates `0001-01-01`, `9999-12-31`, `2000-02-29` | `formatDate(...) !== undefined` | l'intervalle divergerait de celui de l'algèbre |
| P07 | `0042-01-01` imprime, et **≠** `1942-01-01` | `not.toBe` | `Date.UTC` aurait été employé (projection 0–99 → 1900–1999) |
| P08 | les **4** `DATE_STYLES` produisent une sortie | boucle `toBeDefined` | un style déclaré serait inexploitable |
| P09 | un v6 **sans** table → v7, `presentations === undefined` | `toBeUndefined` + identité JSON | la migration inventerait une écriture |
| P10 | un v6 **avec** table → v7, table intacte | `toStrictEqual({ 'montant-fr': FR })` | le garde de version lirait le contenu et non l'estampille |
| P11 | table **vide** acceptée, table **absente** acceptée | `toStrictEqual({})` / `toBeUndefined` | deux énoncés distincts seraient confondus |
| P12 | `MAX_FRACTION_DIGITS === MAX_ROUND_DECIMALS === 15`, `MIN === 0`, `DATE_STYLES` | `toBe` / `toStrictEqual` | le plafond serait réénoncé au lieu d'être **importé** |
| P13 | les **9** valeurs exportées sont présentes, total **126** | `toContain` ×9 + `toHaveLength(126)` | une valeur manquerait, ou une dixième aurait fui |
| P14 | ⚠️ **réécrit (R-04)** — `wellFormedLocale` **et** `honouredLocale` absents du barrel | `not.toContain('wellFormedLocale')` + `not.toContain('honouredLocale')` | l'anti-sur-ingénierie serait violée en silence. Le nom `declarableLocale` **n'existe plus** ([§3.2]) : l'assertion d'origine passerait donc pour une **raison qui n'est pas la sienne**, ce qui est la définition d'un test tautologique (`AGENTS.md §5`) |
| P15 | 🆕 `locale: 'zz'` et `'fr-XX'` **PARSENT** | `safeParse(...).success === true` | la scission de `D-06` serait défaite en silence — c'est exactement la mutation **M28** |
| P16 | 🆕 `resolvePresentation` refuse `'zz'`, `'fr-XX'` et `'en-Latn-US'` **en nommant la cause** | `toStrictEqual({ ok: false, refusal: 'unhonoured-locale' })` ×3 | la porte de rendu ne tiendrait plus la moitié que le parse a lâchée ; `'en-Latn-US'` est le cas qui **nomme la politique** (R-16) ; et le `refusal` **exact** est ce qui interdit d'échanger deux refus en silence (A-7) |
| P17 | 🆕 une table dont une écriture porte `locale: null`, bâtie par `JSON.parse` | `not.toThrow()` **et** `toStrictEqual({ ok: false, refusal: 'invalid-writing' })` | le `TypeError` de **R-15** reviendrait ; et le `refusal` **doit** être `'invalid-writing'` et non `'unhonoured-locale'` — c'est le document qui est fautif, portablement, pas ce moteur |
| P18 | 🆕 les **trois** refus sont atteignables et **distincts** : nom inconnu, entrée invalide, locale non honorée | trois `toStrictEqual`, plus `expect(new Set(refusals).size).toBe(3)` | avant A-7 les quatre sorties étaient un même `undefined` : **aucun** test ne pouvait voir qu'une mutation les avait échangées |
| P19 | 🆕 le succès porte `ok: true` **et** l'écriture canonicalisée | `toStrictEqual({ ok: true, writing: { …, locale: 'fr-FR' } })` sur une entrée `'FR-fr'` | la canonicalisation (P02) et la forme du résultat se vérifieraient séparément, et rien n'assurerait que `ok: true` accompagne bien une écriture |

**Le rapport refus / acceptations était 22 / 14 ; il devient 20 / 19** — deux refus de parse
tombent au rendu (N01, N02, cf. **R-03**), **cinq** contrôles positifs sont ajoutés (P15 … P19,
dont trois nés d'**A-7**) et P14 est réécrit. **Il reste délibérément déséquilibré** : les refus sont la surface d'attaque d'un
contrat stocké, les acceptations sont la garantie qu'on n'a pas sur-fermé. P01, P03 et P05 sont les
trois qui portent le plus : ce sont eux qui interdisent qu'une révision future « resserre » la
locale ou la devise en liste close sans casser un test. **P15 les rejoint, et il est plus fragile
qu'eux** : il est le seul garde de la scission de `D-06`, et sans lui un rédacteur qui « range » le
contrat en remontant l'honorat au parse ne casse rien — c'est exactement la mutation **M28**.

---

### 5.4 Le câblage, porte par porte — la matrice de mutation

C5 a inventé le geste : **une matrice non exécutée ne prouve rien.** Celle-ci compte **31
mutations distinctes**, chacune appliquée à une copie fraîche de `core/src`, recompilée
intégralement, et suivie de l'exécution du fichier de tests du lot. Harnais :
`…/sandbox-FINAL/s2/matrix.mjs`, `matrix2.mjs`, `matrix3.mjs`, `killers.mjs`, `killers2.mjs` ;
journal brut : `…/s2/matrix.log`.

Elle porte sur **les quatre portes, pas seulement la quatrième** — et c'est ce qui la rend
concluante là où une matrice « tests seuls » aurait rendu un faux négatif (M13).

#### 5.4.1 Ce qui meurt, et par quel test

[mesuré] 28 mutations sur 31 rougissent le fichier de tests. `exit` = code de sortie du runner
(= nombre de blocs `it` en échec).

| Id | Ce qu'on retire | exit | Test(s) qui rougissent |
| :-- | :--- | :-: | :--- |
| M01 | le refus de l'extension `-u-` (`locale.ts`) | 1 | `it`:145 *refuses a "-u-" extension by name* |
| M05 | la copie et la canonicalisation (`return declared`) | 2 | `it`:265 *canonicalises the tag on the way out* ; `it`:293 *hands back a copy* |
| M06 | `calendar: 'gregory'` | 1 | `it`:388 *prints the Gregorian year…* |
| M07 | `numberingSystem: 'latn'` sur la **date** | 2 | `it`:388 ; `it`:401 *prints latin digits…* |
| M08 | `numberingSystem: 'latn'` sur **l'argent** | 1 | `it`:401 |
| M09b | `minimumFractionDigits` (les **deux** portes) | 2 | `it`:304 *round-trips through Number()* ; `it`:335 *pads to the minimum…* |
| M10 | `maximumFractionDigits` | 1 | `it`:315 *makes the CLDR currency-to-minor-units table unreachable* |
| M11 | le repli du zéro négatif | 1 | `it`:370 *folds the negative zero* |
| M12b | la garde `Number.isFinite` (les **deux** portes) | 1 | `it`:361 *refuses the three non-finite doubles* |
| M15 | la coupure de `refuseUnnamedWriting` | 1 | `it`:232 *…and an empty writing name* |
| M16 | la casse haute de la devise (regex élargie aux minuscules) | 3 | `it`:168 ; `it`:198 ; `it`:232 |
| M17 | le `.check(refuseInvertedBounds)` en entier | 2 | `it`:168 *reports ONE issue per fault* ; `it`:180 *…on a FIELD and not on the object* |
| M18 | le `.check(refuseUnnamedWriting)` en entier | 1 | `it`:232 |
| M19 | le lien `MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS` (→ 100) | 2 | `it`:113 *derives its fraction ceiling…* ; `it`:168 |
| M20 | l'estampille (`CURRENT_SCHEMA_VERSION` reste 6) | 4 | les quatre `it` de *the stored shape, its stamp and its migration* |
| M21 | l'estampille **dans** la migration 6→7 | 2 | `it`:451 ; `it`:475 |
| M22 | le champ `presentations` sur `Template` | 2 | `it`:475 ; `it`:500 |
| M23 | **un** export du barrel (`formatDate`) | 1 | `it`:86 *publishes nine values and three types* |
| M24 | la validation de la date (`dayNumberOf(v) ?? 0`) | 1 | `it`:418 *accepts exactly the dates the algebra accepts* |
| M25 | le `.refine` de locale sur le schéma | 5 | `it`:133, `it`:145, `it`:159, `it`:168, `it`:190 |
| M26 | l'emploi de la locale (locale remplacée par `undefined`) | 1 → 2 | `it`:304 **(dépend de l'hôte)** ; `it`:565 après complément |
| M29 | l'emploi du `dateStyle` déclaré (forcé à `short`) | 1 | `it`:388 — *via* `toContain('2026')` sur `th-TH` |
| M30 | le refus du nom vide (condition rendue toujours fausse) | 1 | `it`:232 |
| M31 | la validation des **valeurs** de la table (`z.unknown()`) | 2 | `it`:232 ; `it`:578 |

Trois enseignements de cette moitié-là :

- **M25 est la mutation la plus meurtrière (5 blocs).** Le `.refine` de locale est le point de
  passage unique du parse vers `Intl` ; le retirer ouvre le trou entier. C'est la mesure qui
  justifie que `declarableLocale` soit **une** fonction et non deux règles recopiées.
- **M26 n'était tuée que par accident.** [mesuré] elle ne rougissait que l'aller-retour
  `Number()`, et **uniquement parce que la machine de test est en `fr-FR`** : sur un hôte `en-US`,
  `formatDecimal(123.5, EN)` sous locale ignorée rendrait toujours `"123.50"` et la mutation
  **survivrait**. C'est un test **dépendant de l'environnement** dans un lot dont l'objet est de
  ne pas dépendre de l'environnement. L'assertion `it`:565 (règle R3) le corrige.
- **M29 est tuée par un couplage fragile** — `toContain('2026')` ne mord que parce que la fixture
  déclare `dateStyle: 'long'`. [mesuré] `th-TH` + `short` rend `19/8/26`. À écrire dans le
  commentaire du test, sans quoi une « simplification » future le désarme silencieusement.

#### 5.4.2 Les sept survivants, et ce qu'ils disent

[mesuré] sept mutations **ne rougissent rien** dans le fichier de tests tel qu'il est écrit
aujourd'hui. C'est la partie utile de la matrice.

| Id | Ce qu'on retire | Pourquoi ça survit | Verdict |
| :-- | :--- | :--- | :--- |
| **M02** | la moitié `DateTimeFormat` du contrôle d'égalité | redondance **délibérée** : [mesuré] sur 3 944 tags, les deux formateurs n'ont **jamais** divergé | **irréductible** |
| **M03** | la moitié `NumberFormat` | idem, symétrique | **irréductible** |
| **M04** | `Object.hasOwn` → lecture indexée | le cas `constructor` atteint le bon résultat **par accident** : la valeur héritée est une **fonction**, son `.locale` vaut `undefined`, et `declarableLocale` refuse déjà | **refermé** par `it`:521 |
| **M13** | l'épinglage `timeZone: 'UTC'` | l'hôte est `Europe/Paris` (**+2 h en août**) : minuit UTC reste le même jour civil, aucune assertion ne bouge | **refermé par la PORTE 1** |
| **M14** | la coupure de `refuseInvertedBounds` | les six cas de `issueCount` emploient tous une faute **abortive** ou non inversante | **refermé** par `it`:532 |
| **M27** | la longueur exacte de la devise (3 → 3 ou 4) | aucun test n'écrit `ZZZZ` | **refermé** par `it`:557 |
| **M28** | le plafond de fraction 15 → 50 | le seul cas écrit est `99`, refusé dans les deux mondes | **refermé** par `it`:542 |

**M13 est le résultat le plus instructif de toute la matrice, et il déplace la question.**
[mesuré] la porte 4 est **muette**, et la porte 1 tue :

```
biome check .../format.ts   (timeZone retiré)
  × `new Intl.DateTimeFormat` without an explicit `timeZone` formats in the HOST time zone,
    even when the locale is explicit (roadmap E6). Pass both: …
  Found 1 error.
```

Et le contrôle négatif complémentaire, tout aussi utile : [mesuré] le même retrait appliqué à
`calendar: 'gregory'` (sonde L3), à `numberingSystem: 'latn'` (L2), ou le remplacement de la
locale par `undefined` (L5), passe `biome check` **sans un diagnostic**. Les angles morts
qu'AGENTS.md annonce sont confirmés à la mesure, et la répartition des rôles est **exactement
inverse** de ce qu'on suppose :

| Épinglage | Porte 1 (Biome) | Porte 4 (tests) |
| :--- | :-: | :-: |
| `timeZone: 'UTC'` | ✅ **seul garde** | ❌ muette (dépend du fuseau de l'hôte) |
| `calendar: 'gregory'` | ❌ muette | ✅ `it`:388 |
| `numberingSystem: 'latn'` | ❌ muette | ✅ `it`:388, `it`:401 |
| la locale réellement employée | ❌ muette | ✅ `it`:565 (après complément) |

> **Conséquence à écrire dans le plan, pas seulement ici :** l'épinglage du fuseau est le seul des
> quatre dont la garantie repose **entièrement** sur une règle de plugin `.grit` — le fichier
> qu'AGENTS.md §7 interdit de modifier sans mandat, voisin d'une règle *nursery* hors
> versionnement sémantique. Si le plugin est un jour assoupli, **plus rien** ne tient `timeZone`.
> C'est un point de vigilance de revue, et il ne peut pas être refermé par un test : un test qui
> prouverait le fuseau devrait lire le fuseau.

**M02 et M03 ne peuvent pas être refermés, et c'est une propriété, pas un manque.** La double
interrogation (`NumberFormat` **et** `DateTimeFormat`) est une redondance dont le contrat assume
qu'elle ne sert **aujourd'hui** à rien : [mesuré] 213 tags acceptés par les deux, 3 731 refusés par
les deux, **zéro désaccord**, identiquement sur ICU 76.1 et 77.1. Un test qui la tuerait devrait
exhiber un tag sur lequel les deux formateurs divergent — c'est-à-dire une donnée CLDR qui
n'existe pas sur l'ICU courant et qui, si elle apparaissait, ferait rougir le test au lieu de le
faire passer. **Le plan dit donc que ces deux mutations survivent, et pourquoi il est correct
qu'elles survivent**, plutôt que d'inventer une assertion qui figerait une propriété d'ICU (R7).

#### 5.4.3 Les sept assertions qui referment les survivants refermables

Ajoutées au fichier de tests du lot : **7 blocs `it`, 15 `expect`**. Le fichier passe de 32 à
**39** blocs et de 91 à **106** `expect`. [mesuré] les trois portes rejouables tiennent :

| Porte | Commande | Résultat |
| :--- | :--- | :--- |
| 2 (`type-check`, production) | `tsc -p core/tsconfig.json --noEmit` | **exit 0** |
| 2 (`type-check`, tests compris) | `tsc -p core/tsconfig.verif.json --noEmit` | **exit 0** |
| 1 (`lint`) | `biome check packages/core/src` (réplique identique du dépôt) | **Checked 10 files. No fixes applied.** — 0 diagnostic, 0 `biome-ignore` |
| 4 (tests) | exécution du fichier | **39 passed, 0 failed** |

| Nouveau `it` | Mutation refermée | Refus / contrôles couverts | Assertion décisive |
| :--- | :-- | :--- | :--- |
| `:521` *reads only the OWN entries of a table* | **M04** | — | `resolvePresentation(Object.create({ 'montant-fr': FR }), 'montant-fr')` → `{ ok: false, refusal: 'unknown-writing' }` *(mesuré `→ undefined` avant A-7)* |
| `:532` *tells an author once when one bound is BOTH out of range and inverted* | **M14** | N11 renforcé | `issueCount(writing({ minFractionDigits: 99 }))` → **1** ; sans la coupure : **2** |
| `:542` *pins both ends of the declarable fraction range* | **M28** | N11, N12, **P05** | `max: 15` accepté **et** `max: 16` → `too_big` |
| `:557` *refuses a currency of four letters, and one carrying a digit* | **M27** | **N08, N09** | `ZZZZ`, `ZZ`, `12A`, `ZZ1` → `invalid_format` |
| `:565` *writes one value two ways with NO currency* | **M26** (rendue indépendante de l'hôte) | — | `formatDecimal(v, FR) !== formatDecimal(v, EN)` |
| `:578` *refuses a candidate that is not an object, and an entry that is not one* | **M31** | **N18, N21** | `path === ''` sur le candidat ; `['montant']` sur l'entrée |
| `:590` *drops a `__proto__` key and pollutes nothing* | — (constat mesuré, non assuré jusqu'ici) | **N20** | `Object.keys` → `['ok']` **et** `Reflect.get(Object.prototype, 'pwned')` → `undefined` |

**Vérification croisée, mutation par mutation** [mesuré, avec le fichier complété] :

```
M00-baseline                    exit=0  passed=39  failed=0
M02-drop-DateTimeFormat-half    exit=0  passed=39  failed=0   <- survivant assumé
M03-drop-NumberFormat-half      exit=0  passed=39  failed=0   <- survivant assumé
M04-hasOwn-to-index-read        exit=1  passed=38  failed=1   <- it:521
M13-drop-timeZone-pin           exit=0  passed=39  failed=0   <- tué à la PORTE 1
M14-drop-inverted-bounds-cutoff exit=1  passed=38  failed=1   <- it:532
M26-locale-ignored-undefined    exit=2  passed=37  failed=2   <- it:304 + it:565
M27-currency-4-letters          exit=1  passed=38  failed=1   <- it:557
M28-ceiling-loosened-to-50      exit=1  passed=38  failed=1   <- it:542
M31-record-value-unchecked      exit=2  passed=37  failed=2   <- it:232 + it:578
```

**Bilan : 31 mutations, 28 tuées à la porte 4, 1 tuée à la porte 1, 2 irréductibles et documentées
comme telles.**

#### 5.4.4 Deux points de revue attachés à ces sept assertions

1. **`Object.create` rend `any`.** `const inherited: PresentationTable = Object.create({ … })`
   affecte un `any` produit par la bibliothèque standard à une constante typée. AGENTS.md §1.1
   interdit d'**écrire** `any` ; ici il est *reçu* et immédiatement contraint, aucun cast n'est
   écrit, et [mesuré] Biome ne dit rien. Un relecteur qui préfère une autre construction a un
   argument recevable — mais aucune variante examinée (`Object.setPrototypeOf`, une classe) ne fait
   mieux sur ce point, et un littéral d'objet ne peut **pas** produire une entrée *héritée*, qui
   est précisément le fait à assurer.
2. **`it`:590 emploie `JSON.parse` et non un littéral.** C'est obligatoire : un littéral
   `{ __proto__: … }` **fixe le prototype** au lieu de créer une clé propre, donc le test ne
   testerait rien. Le commentaire du test le dit ; sans lui, la première « simplification » le vide.

#### 5.4.5 La couverture, après complément

[mesuré] `NODE_V8_COVERAGE` sur l'exécution des 39 blocs, plages non couvertes par fichier :

```
presentation/presentation.js   ranges: 0
presentation/types.js          ranges: 0
presentation/schemas.js        ranges: 0
presentation/resolve.js        ranges: 0
presentation/format.js         ranges: 0
presentation/locale.js         ranges: 1   lignes 80, 81, 82
template/template.js           ranges: 0
index.js                       ranges: 0
```

**Une seule plage non couverte dans tout le lot**, inchangée par les sept ajouts : le
`if (!(error instanceof RangeError)) { throw error; }` de `declarableLocale` — **aujourd'hui
`wellFormedLocale`**, la fonction qui en a hérité à la scission de D-06. Il ne peut pas être
couvert honnêtement — la signature prend un `string`, et sur un `string`
`Intl.getCanonicalLocales` ne lève que `RangeError` ; le couvrir exigerait un cast (AGENTS.md
§1.1) et le supprimer avalerait une erreur (AGENTS.md §1.3). **Il reste, et il est nommé plutôt
que maquillé.** Les sept assertions ajoutées n'introduisent **aucune ligne de source**, donc elles
ne peuvent que faire monter l'agrégat de `'packages/core/src/**'`.
---

### 5.5 La migration — les contrats de l'estampille, et la part de C9

#### 5.5.1 Les huit contrats que l'estampille 6 → 7 doit tenir

| # | Contrat | Assertion | Statut |
| :-- | :--- | :--- | :--- |
| G1 | La liste des marches gagne **exactement** `[6, 7]`, et rien d'autre | `TEMPLATE_MIGRATIONS.map(s => [s.from, s.to])` → six paires littérales | `it`:438 |
| G2 | La chaîne est parcourue **une marche à la fois**, pas par un convertisseur direct | c'est la même assertion : seule la **forme du registre** peut le dire | `it`:438 |
| G3 | Un v6 **sans** table ressort estampillé 7, `presentations === undefined`, et **rien d'autre ne bouge** | identité `JSON.stringify` avec l'estampille remise à 6 | `it`:451 |
| G4 | Un v6 **portant déjà** une table ressort estampillé 7, **table intacte** — le garde lit l'estampille, pas le contenu | `toStrictEqual({ 'montant-fr': FR })` + `resolvePresentation(...)?.currency === 'EUR'` | `it`:475 |
| G5 | Table **vide** et table **absente** sont deux énoncés distincts, tous deux acceptés | `toStrictEqual({})` / `toBeUndefined()` | `it`:500 |
| G6 | Un document estampillé **8** est refusé avec le message lisible | `TemplateMigrationError` | `migrate.test.ts` (existant, via `CURRENT_SCHEMA_VERSION + 1`) |
| G7 | La forme migrée reste **bornée** : delta `+0` valeur, `+0` profondeur | par construction (le *spread* n'ajoute pas de clé) + seconde passe du garde dans `parseTemplate` | `migrate.test.ts` (existant) |
| G8 | **C9** — un document **pré-C1** traverse les six marches et ressort estampillé 7 | voir §5.5.3 | `migrate.test.ts:114` (existant) |

[mesuré] G6 rend exactement :

```
TemplateMigrationError: Template uses schema version 8 but this build understands at most 7.
It was written by a newer release of Openview; upgrade before opening it.
```

**C'est tout le mécanisme du lot en une phrase**, et il ne dépend d'aucune forme neuve : sans
l'estampille, un build v6 ouvrant un document v7 l'**accepte sans erreur** et **dépouille toute la
table** — classe *perte silencieuse*, la plus dangereuse (AGENTS.md §1.2), après quoi un `onSave`
persiste la perte et chaque montant retombe à la mise en chaîne nue.

> ⚠️ **Une assertion du dépôt paraît être un filet et n'en est pas un.**
> `expect(TEMPLATE_MIGRATIONS).toHaveLength(CURRENT_SCHEMA_VERSION - 1)` reste **verte** au
> passage 6 → 7 [mesuré : `6 = 6`], parce que **les deux côtés bougent ensemble**. Elle attrape
> l'oubli d'une entrée **ou** l'oubli d'une estampille, jamais l'oubli des **deux à la fois** —
> qui est exactement la façon dont on se trompe. Le seul filet mécanique sur la marche neuve est la
> **liste littérale** de G1. À dire dans la revue, parce que la lecture inverse est naturelle.

#### 5.5.2 Combien de tests existants rougissent — mesuré, sur la suite complète

Exécution réelle des **21 fichiers de tests** de `packages/core`, contre l'arbre HEAD puis contre
l'arbre du lot. Le harnais emploie un *shim* `vitest` (§5.7, aveu 1), qui produit un **plancher de
bruit** de **4 échecs** identiques dans les deux exécutions ; les chiffres ci-dessous sont donc des
**deltas**, pas des absolus.

| Exécution | Blocs verts | Blocs rouges | Dont bruit du shim | **Rougeurs réelles** |
| :--- | ---: | ---: | ---: | ---: |
| HEAD, sans le lot | 627 | 4 | 4 | **0** |
| Le lot en place, tests existants **non corrigés** | 655 | 8 | 4 | **4** |

**Quatre assertions, dans deux fichiers** — et c'est la confirmation exacte de la correction du
dossier : le poste « douze tests de `migrate.test.ts` » était **surévalué d'un facteur quatre**.

| Fichier:ligne | Assertion | Avant | Après | Correction |
| :--- | :--- | :--- | :--- | :--- |
| `template/migrate.test.ts:163` | la liste littérale `[from, to]` | 5 paires | **6** | ajouter `[6, 7]` |
| `template/migrate.test.ts:191` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** | `toBe(7)` |
| `template/migrate.test.ts:210` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** | `toBe(7)` |
| `style/__tests__/style.test.ts:134` | `expect(values).toHaveLength(117)` | 117 | **126** | `toHaveLength(126)` |

Tout le reste du dépôt passe par `CURRENT_SCHEMA_VERSION` et reste **vert** [vérifié :
`ast/__tests__/fixtures.ts:206`, `page/__tests__/page.test.ts:212,226,236`,
`style/__tests__/style.test.ts:480,559`, `ast/__tests__/table.test.ts:370`,
`expression/evaluator/__tests__/limits-scope.test.ts:442`, plus
`apps/playground/src/App.tsx:292,1341` hors `core`].

**Et la mesure symétrique, qui est le vrai filet.** [mesuré] si l'on estampille `7` **sans
enregistrer** l'entrée `6 → 7`, ce ne sont plus 4 blocs mais **14** qui rougissent, tous sur
`No migration registered from schema version 6` — dont *brings a template written before C1 up to
the current stamp*, *walks a v1 document up to the current stamp*, *fills in a page on a v4
document*, et *ACCEPTS an under-stamped document*. C'est la transposition exacte de la mesure que
`migrate.test.ts` consigne pour C5 (« bumping to 6 without registering this entry reddens TWELVE
tests »), et elle vaut d'être refaite : **l'oubli de l'entrée est bruyant ; l'oubli de
l'estampille, lui, est silencieux.** C'est pourquoi l'estampille est la décision **irréversible**
du lot (D-14) et la seule à prendre maintenant.

#### 5.5.3 La part de C9 — « la pérennité, à chaque lot, jamais reportée »

C9 exige qu'un document écrit **avant C1** traverse toute la chaîne à chaque ajout. Le fichier
`migrate.test.ts:114` porte déjà ce test, et il est écrit contre `CURRENT_SCHEMA_VERSION`, donc il
suit le lot sans retouche. [mesuré] contre l'arbre du lot, sur le document `beforeC1` du dépôt
(v1, `loop` + `text` + `literal` + `binding`, **sans `page`**) :

| Fait mesuré | Valeur |
| :--- | :--- |
| estampille finale | **7** (= `CURRENT_SCHEMA_VERSION`) |
| `parsed.presentations` | **`undefined`** |
| `parsed.page.sheet` | `{ width: 210, height: 297 }` — la feuille A4 **inventée par la marche 4 → 5**, intacte |
| un v6 portant une table déclarant `locale: 'zz'` | **refusé** par `parseTemplate` (`ZodError`) — la validation s'applique **après** la migration |

Trois conséquences à écrire :

1. **La marche 6 → 7 n'invente rien, et c'est ce qui rend C9 gratuit ici.** Elle n'a pas de
   *compatibility writing* à écrire, contrairement à la feuille A4 de la marche 4 → 5 — parce
   qu'une écriture de compatibilité devrait nommer **une langue et une monnaie**, et
   `README.md:127` dit qu'Openview ne détient pas ce référentiel. **Il n'existe pas de devise qui
   existe partout.** Un document pré-C1 déclare donc « aucune écriture », ce qu'il déclarait déjà.
2. **Le test C9 propre au lot est `it`:451, pas un test neuf de `migrate.test.ts`.** Il assure la
   propriété la plus forte disponible — *l'estampille est la seule différence*, par identité
   `JSON.stringify` — sur le document dont la table est **absente**, c'est-à-dire le cas de tous
   les documents existants.
3. **`it`:475 est son symétrique et il est indispensable** : il assure que le garde de version lit
   **l'estampille** et non le contenu, donc qu'un document estampillé 6 mais portant déjà une table
   (fait à la main, ou écrit par un build intermédiaire non estampillé) **parse** et ressort
   estampillé 7 avec sa table. Sans lui, la moindre nervosité future sur « et si le contenu ne
   correspond pas à la version ? » se réglerait par un refus, et casserait les documents des
   développeurs du lot eux-mêmes.

---

### 5.6 Ce qui reste hors des tests, et pourquoi

Cette section est celle que tous les plans du dépôt portent, et elle est ici plus longue que
d'habitude parce que le lot dépend d'un composant que le dépôt ne compile pas : ICU.

| Hors tests | Pourquoi | Qui le porte |
| :--- | :--- | :--- |
| **Le rendu d'une facture bilingue** | `core` **ne rend rien** (blocage B2), et `engine.md:78-79` donne la coupe : « *le contrat sait **DÉCRIRE** un modèle bilingue (core C6) ; le moteur doit **L'HONORER*** ». Aucun mini-moteur n'a été écrit hors dépôt pour faire semblant. Ce qui est démontré est strictement : **une valeur, deux écritures déclarées, deux chaînes différentes portant les mêmes chiffres, depuis un seul `Template`**. | lot **E4** |
| **Le choix des SITES à formater** | Le contrat ne distingue pas `commande.numero` (`20260014`) d'un total, et **ne le doit pas** : ce serait un nom de champ réservé, que la règle de périmètre refuse. Une écriture appliquée à tous les nombres imprimerait `20 260 014`, qui désigne une autre commande. **Aucun test de `core` ne peut couvrir ce qui n'est pas dans `core`.** | attente **E4-1**, arbitrage produit |
| **« Arrondir PUIS formater »** | [mesuré] formater seul contredit un `halfEven` déclaré sur **4,9275 %** d'une famille monétaire de 200 000 tirages ; en `halfExpand`, **0,0000 %**. C'est une **sonde**, et `docs/adr/0004:68-69` interdit de la committer (règle R7). L'invariant devient une attente moteur datée. | attente **E4-2** |
| **La comparaison entre DEUX versions d'ICU** | La CI exécute `node: [24, 26]`, donc deux jeux CLDR — mais **aucun test ne peut comparer les deux**, un processus n'en porte qu'un. La seule défense est de n'écrire aucune assertion sensible à CLDR (règles R1, R2, R6), ce que la matrice vérifie *négativement* : aucune mutation n'a eu besoin d'une chaîne figée pour être tuée. | doctrine, **QA** |
| **L'espace insécable dans le PDF** | U+202F et U+00A0 dans une même chaîne : un moteur qui normalise les espaces, ou un test d'or qui fige la chaîne rendue, casse sur l'une des deux versions de Node. Invérifiable tant que le pipeline n'existe pas. | attente **E4-6** ; **E2/E5** pour la mise en page |
| **Viewer et moteur sur le même ICU** | Un navigateur et Node ne portent pas nécessairement la même version de CLDR : la promesse « aperçu identique au PDF » (J4) devient une contrainte de **version**, pas seulement de mise en page. | attente **E4-9**, lots viewer |
| **La conformité d'une facture** | Blocage B3 : « corrects » n'est pas défini, et le tableau d'arbitrage de `core.md` attribue la conformité à **l'intégrateur**. Une facture américaine ne diffère pas d'une française que par les mots (bloc d'adresse, *sales tax* vs TVA, mentions légales). Aucun test ne peut asserter « correct ». | **revue humaine**, intégrateur |
| **`numberingSystem: 'latn'` épinglé en dur** | Rend une facture `ar-EG` en chiffres latins. C'est **défendable** et **ce n'est pas neutre** ; c'est une décision produit (D-10), pas une propriété testable. | **propriétaire du produit** |
| **L'amendement d'ADR 0003** | `:241-242` (« ni horloge, ni fuseau, ni locale, **ni ICU** ») et `:783-784` (« casse E6 pour de bon ») sont une décision **publiée dans une ADR acceptée** que ce contrat contredit. Un test ne répare pas une ADR. | **propriétaire du produit**, avant livraison |
| **La sonde jetable de `noJsRestrictedProperties`** | Règle *nursery*, hors versionnement sémantique : une montée de Biome peut la renommer **en silence**. La sonde de l'ADR 0003 doit être rejouée **à chaque montée**, hors CI. Mon contrôle négatif prouve qu'elle mord sur **2.5.8 aujourd'hui**, rien de plus. | **revue de dépendances** |
| **M02 et M03** | La redondance des deux formateurs est **irréductible par construction** (§5.4.2). La refermer exigerait de figer une propriété d'ICU, ce que R7 interdit. | assumé, documenté |
| **L'ergonomie du Designer** | Panneau d'édition d'une table d'écritures, sélecteur d'écriture dans l'aperçu, avertissement quand un modèle déclare une table que rien ne consomme. Un modèle qui écrit montants, quantités et prix unitaires en deux langues déclare **six** entrées : c'est verbeux, et le lot livre le mécanisme, pas l'ergonomie. | lots **D1 / D5 / D9** |
| **Les matchers réels de `vitest`** | Les tests ont tourné contre un *shim*. Une différence de sémantique entre mon `toStrictEqual` et celui de vitest est **possible et non vérifiée** (§5.7). | à rejouer à l'implémentation |

---

### 5.7 Aveux de méthode, et index du bac à sable

**Ce que je n'ai pas fait, et qu'il ne faut pas me croire avoir fait :**

1. **Aucune des quatre portes n'a été lancée DANS LE DÉPÔT** — le cadre l'interdit, elles y
   écrivent. `git status --porcelain` rend 0 ligne, HEAD `320bea6`, avant et après [vérifié]. La
   porte `pnpm run build` (émission `dist` + `.d.ts`) n'est **pas** rejouée ; je compile avec
   `--noEmit`, et le *runner* avec `noCheck`.
2. **Le *shim* `vitest`.** Le contrat définitif en livrait un de 20 lignes ; je l'ai étendu (deep
   equal insensible à l'ordre des clés, `toThrow(RegExp)`, `expect.any`, `it.each`,
   `describe.each`, une douzaine de matchers) pour exécuter la **suite complète** du paquet. Il
   reste **4 échecs de bruit** à HEAD que je n'ai pas éliminés (`ExpressionSchema > refuses a path
   longer than 256 characters`, et trois cas `it.each` de `RoundExpressionSchema`) : mes chiffres de
   §5.5.2 sont donc des **deltas contre ce plancher**, et non des absolus. Le delta, lui, est net
   et reproductible.
3. **La couverture est mesurée en LIGNES du JavaScript émis** via `NODE_V8_COVERAGE`, pas par
   `@vitest/coverage-v8` sur le TypeScript source. Les `statements` et `branches` que la CI
   calculera **ne seront pas identiques** ; la conclusion (une seule plage non couverte, dans
   `locale.ts`) est robuste à cet écart, le pourcentage exact non.
4. **Je n'ai pas mesuré le taux agrégé réel de `packages/core/src` à HEAD**, pour la même raison :
   il faudrait `pnpm run test:coverage`.
5. **Les sept assertions ajoutées ne sont pas dans le dépôt.** Elles vivent dans
   `…/s2/patched.test.ts`, compilent (`tsc` exit 0 sur les deux configurations), passent Biome
   (0 diagnostic, 0 `biome-ignore`) et exécutent vert (39/39). Elles sont **à reprendre telles
   quelles** dans le fichier de tests du lot ; le formatage Biome leur a déjà été appliqué
   (`biome check --write`), donc elles s'insèrent sans retouche.
6. **La matrice ne couvre pas `migrate.ts` en profondeur.** Les 12 plages non couvertes que le
   relevé montre sur `template/migrate.js` sont couvertes par `migrate.test.ts`, que le relevé
   n'exécutait pas ; je n'ai pas rejoué la couverture croisée des deux fichiers.
7. **Le fuseau de la machine est `Europe/Paris`.** Toute conclusion « aucun test ne bouge » sur une
   date en **août** est donc conditionnée à un décalage positif. Sur une CI en `UTC` — ce qui est
   le cas usuel des *runners* GitHub — M13 resterait tout aussi survivante à la porte 4, mais pour
   une raison différente (décalage nul). Sur un *runner* en fuseau négatif, `it`:418 et `it`:428
   pourraient rougir **si l'épinglage disparaissait**, ce qui ne change pas la conclusion : la
   garantie appartient à la porte 1.

**Index du bac à sable de cette section** — `…/scratchpad/c6/sandbox-FINAL/s2/` :

| Chemin | Contenu |
| :--- | :--- |
| `matrix.mjs` / `matrix.log` | les 25 premières mutations, appliquées, compilées, exécutées |
| `matrix2.mjs` | les 7 suivantes, dont les deux réparations `M09b` / `M12b` |
| `matrix3.mjs` | les 10 mutations rejouées **avec** le fichier de tests complété |
| `killers.mjs` / `killers2.mjs` | les assertions candidates, éprouvées mutant par mutant avant d'être écrites |
| `patched.test.ts` | le fichier de tests du lot **+ les 7 blocs `it`**, formaté par Biome, 600 lignes |
| `addendum.ts` | les 7 blocs seuls, avec leurs commentaires de motif |
| `tccore/` | `tsc -p tsconfig.json` et `-p tsconfig.verif.json` sur l'arbre complété |
| `biome-mut/` | la réplique de `biome.jsonc` + `tools/biome/*.grit`, pour le contrôle négatif et les sondes L1/L2/L3/L5 |
| `cov.cjs` / `cov/` | les plages V8 non couvertes, fichier par fichier |
| `../run/out/s2-refusals.mjs` | le rejeu par `safeParse` des 22 refus N01…N22 |
| `../run/out/s2-gaps.mjs` | les six refus sans porteur, la clé héritée, le `__proto__` réel |
| `../run/out/s2-cutoff.mjs`, `s2-cutoff2.mjs` | pourquoi la coupure ne se démontre que sur une faute **continuable** |
| `../run/out/s2-doctrine.mjs` | les points de code des quatre écritures, les quatre aller-retours `Number()`, les quatre `dateStyle` |
| `../run/out/s2-c9.mjs` | le document pré-C1 à travers les six marches, et le refus d'un v8 |

---

## 6. Le critère de recette, et comment on le démontre

### 6.0 La limite de structure — en tête, parce qu'elle décide de la lecture du critère

> ⛔ **Deux factures qui ne diffèrent que par les mots et par les formats ont la MÊME
> STRUCTURE. Ce lot ne change pas cette limite d'un iota — il ne l'élargit pas et ne la rétrécit
> pas — et un critère de recette lu sans elle promet ce que le contrat ne porte pas.**

La limite est **exactement** celle que C1 et C3 ont posée, et elle n'est pas uniforme : il faut la
dire dans les deux sens, sinon le plan est faux d'un côté ou de l'autre.

**Ce qui EST exprimable, et que la formulation courante du dossier sous-estime.** `ConditionNode`
est un `BlockNode` (`packages/core/src/ast/types.ts:212-216`, et `type BlockNode = TextNode |
ImageNode | ContainerNode | LoopNode | ConditionNode | TableNode` à `:600`) [vérifié]. **Un bloc
entier peut donc être conditionnel** : un bloc d'adresse au format américain à côté d'un bloc au
format français, une mention légale qui n'existe que dans une juridiction, un paragraphe de
conditions de règlement propre à une langue — tout cela **s'écrit**, depuis C1, avec
`if`/`condition` sur `path('rendu.langue')`. **Écrire que « une mention légale sans équivalent
n'est pas exprimable » serait faux**, et faux d'une façon vérifiable en trois lignes.

**Ce qui n'est PAS exprimable, et c'est là que la limite mord :**

| Fait | Pourquoi | Citation |
| :--- | :--- | :--- |
| une **colonne** de tableau conditionnelle | `TableColumn` **n'est pas** un `DocumentNode` — il ne porte pas de contenu, ne vit dans aucune portée, et `findNodeById` ne l'atteint pas ; `columns` est un tableau plat de `TableColumn` | `ast/types.ts:352-360`, `:558` |
| une **ligne** de tableau conditionnelle | `type TableBodyNode = TableRowNode \| TableRowGroupNode` — **`ConditionNode` en est absent** ; `header` et `footer` sont des `readonly TableRowNode[]` | `ast/types.ts:506`, `:564`, `:568` |

Conséquence concrète, sur l'exemple même que le blocage B3 avance : **« Sales tax » contre
« TVA » comme *libellé* de colonne s'écrit** (le libellé est un `TextNode` dans une cellule
d'en-tête, donc un `if` de C1 suffit) ; **une colonne de taxe d'État en plus, ou une ligne de
totaux qui n'existe que dans une juridiction, ne s'écrit pas.** Un bloc d'adresse américain, lui,
s'écrit — comme bloc conditionnel, pas comme variante de la même structure.

**Et ce lot n'y touche pas.** C6 n'ajoute ni kind d'expression, ni nœud, ni champ de nœud : il
ajoute une **table stockée sur `Template`** et **quatre fonctions**. La limite ci-dessus est donc
un **héritage à énoncer**, pas une dette de C6 — et la nommer en tête est ce qui empêche le
critère de recette de se lire comme une promesse de facture conforme.

---

### 6.1 L'énoncé, et pourquoi `core` ne peut pas le tenir seul (B2)

#### Les deux textes, qui sont le même

`docs/roadmap/core.md:261-262` :

> **Prêt quand** un unique modèle de facture produit deux documents corrects dans deux langues et
> deux devises, sans duplication du modèle.

`docs/roadmap/engine.md:82-83` :

> **Prêt quand** le même modèle, appelé deux fois, produit une facture français/euros et une
> facture anglais/dollars, toutes deux correctes.

**C'est la même phrase, écrite deux fois, sur deux briques qui n'ont pas le même métier.** Et
`core` **ne rend rien** : [vérifié] `packages/engine/src/index.ts` fait **6 lignes**, et rien dans
`packages/core` ne produit de document. La coupe juste est écrite deux lignes plus haut dans le
même fichier, `docs/roadmap/engine.md:79-80` :

> **Pourquoi.** Le contrat sait **décrire** un modèle bilingue (core C6) ; le moteur doit
> **l'honorer** : montants, dates, séparateurs, symbole monétaire, libellés fixes.

**« Décrire » contre « honorer ».** Le « prêt quand » de `core.md` demande le second verbe à la
brique qui ne sait que le premier.

#### Lecture mot par mot de l'énoncé de `core.md`

| Fragment | Ce qu'il exige | `core` seul peut-il ? |
| :--- | :--- | :--- |
| *un unique modèle de facture* | **un seul objet `Template` stocké** | **oui** — et c'est la moitié qui compte |
| *produit deux documents* | un rendu, donc des pixels ou un HTML | ⛔ **non** — `core` ne rend rien |
| *corrects* | non défini ; sens fort attribué à l'intégrateur | ⛔ **non** — voir [§6.2] |
| *dans deux langues* | **déjà livré par C1**, et pas par ce lot | **oui**, hérité |
| *et deux devises* | une écriture déclarée par écriture | **oui** — c'est ce lot |
| *sans duplication du modèle* | un seul `Template`, un seul jeu de données | **oui**, testable |

> ⚠️ **La moitié « langues » est déjà livrée, et le plan doit le dire en tête plutôt qu'en
> annexe.** `core.md:257-259` nomme cinq objets : « les montants, les dates, les séparateurs de
> milliers, la position du symbole monétaire, et **les libellés fixes du modèle** ». **Le cinquième
> est livré par C1** : un unique `Template` stocké rend `Facture` ou `Invoice` depuis
> `if(eq(path('rendu.langue'), 'fr'), 'Facture', 'Invoice')` — mesuré deux fois dans le dossier,
> dont une fois contre un `dist` reconstruit à HEAD. **C6 n'ajoute AUCUN mécanisme de libellé** :
> ni catalogue de messages, ni table de traductions, ni clé réservée — un catalogue devrait
> réserver des noms de clés, ce que la règle de périmètre interdit, et le `if` fait en plus une
> chose qu'une table ne fait pas : il **réordonne** (`Facture n° 14 — ACME` contre
> `ACME — Invoice no. 14`). Ce lot porte les **quatre autres**, qui sont tous **l'écriture d'une
> valeur**.

#### Les deux critères, côte à côte — c'est le mandat demandé

| | **Énoncé de la roadmap** (`core.md:261-262`) | **Énoncé que `core` peut tenir SEUL** (proposé) |
| :--- | :--- | :--- |
| Verbe | *produit deux documents* | *déclare et écrit* |
| Texte | « Prêt quand un unique modèle de facture produit deux documents **corrects** dans deux langues et deux devises, sans duplication du modèle. » | « **Prêt quand** un unique `Template` stocké déclare **deux écritures nommées**, que `parseTemplate` les accepte toutes deux, que `resolvePresentation` les distingue **par un argument**, et que `formatMoney`, `formatDecimal` et `formatDate` rendent, **pour une même valeur**, deux chaînes **différentes portant les mêmes chiffres** — sans qu'une seule ligne de `packages/core` ne lise la machine, et `collectTemplateDataPaths` rendant la **même liste** dans les deux cas. » |
| Juge | « corrects » : personne, mécaniquement [§6.2] | `pnpm run test:coverage` — chaque clause est un `it` [§6.3] |
| Démontrable par `core` seul | ⛔ **non** | ✅ **oui** |

**Le mandat demandé au propriétaire du produit, à porter en INC-5 :** remplacer le « prêt quand »
de `core.md:261-262` par l'énoncé de droite, et **laisser `engine.md:82-83` inchangé** — c'est
l'énoncé de gauche, et il est **exactement à sa place** sur la brique qui rend. Les deux textes
cessent alors d'être le même, et la coupe qu'`engine.md:79-80` écrit déjà en prose devient une
coupe entre deux critères de recette.

#### Ce qui reste à E4, exactement

Neuf obligations, consignées dans l'ADR 0008 avec leur propriétaire (INC-5). **La première est la
seule qui empêche `core` de tenir le critère fort, et elle est mécanique, pas un oubli :**

| # | Ce qui reste à E4 | Pourquoi `core` ne peut pas |
| :-- | :--- | :--- |
| **E4-1** | **Choisir les SITES** — quelle valeur s'écrit, et avec laquelle des trois fonctions | Le formatage est une **fonction**, donc rien dans le document stocké ne distingue `commande.numero` (`20260014`) d'un total. Une écriture appliquée à tous les nombres imprimerait `20 260 014`, **qui désigne une autre commande** [vérifié : `App.tsx:583`, `numero: 20_260_014`]. Reconnaître un total supposerait un **nom de champ réservé**, que la règle de périmètre refuse. |
| E4-2 | **Arrondir PUIS formater** | [mesuré] formater seul contredit un `halfEven` déclaré sur **4,9275 %** d'une famille monétaire de 200 000 tirages ; avec `halfExpand`, **0,0000 %** |
| E4-3 | Résoudre **chaque écriture employée** au plus une fois par rendu — **jamais une fois par valeur**, et **jamais une seule écriture pour tout le rendu** | `resolvePresentation` canonicalise et construit deux formateurs de contrôle : appelé par valeur sur 620 nœuds, ce coût est payé 620 fois pour rien. ⚠️ **Reformulé (R-07)** : la version antérieure disait « l'écriture, une fois par rendu », ce qui se lisait comme une **exclusivité** et contredisait la cardinalité du [§2.0] — montants, quantités et prix unitaires sont **trois** écritures **dans le même rendu** |
| E4-4 | D'où vient la **clé d'écriture** | C'est un argument. `RenderRequest` n'a pas de troisième champ (`ports/render.ts:27-28`) et n'en aura pas |
| E4-5 | Ne **pas** ajouter de table de secours monétaire | [mesuré] une devise inconnue bien formée s'imprime elle-même (`1 234,50 ZZZ`), et aucune unité mineure n'est héritée puisque les deux bornes sont déclarées |
| E4-6 | Ne **pas** normaliser les espaces, ne **pas** figer une chaîne dans un test d'or | [mesuré] U+202F et U+00A0 dans la même chaîne `fr-FR`, U+202F arrivé avec CLDR 42 / ICU 72, CI sur `node: [24, 26]` |
| E4-7 | Ne **ni** repasser **ni** surcharger `calendar` et `numberingSystem` | [mesuré] l'option gagne contre l'étiquette `-u-`, mais une seconde source ferait diverger deux moteurs |
| E4-8 | Trancher « blanc ou échec de rendu » | Question 2 d'ADR 0001, **ouverte**, et c'est `DataBindingStep` qui la possède |
| E4-9 | Le viewer et le moteur sur **le même ICU** | Sinon la promesse d'aperçu identique au PDF (J4) devient une contrainte de **version**, pas seulement de mise en page |

> **Le remède au trou E4-1 est nommé et daté, pas laissé ouvert.** Le jour où E4 le prouve devant
> une vraie facture, c'est un **champ optionnel sur un segment** : classe *perte silencieuse*,
> donc **une estampille et une migration d'estampille**, la modification la moins chère que ce
> dépôt connaisse. Ce n'est **pas** un argument pour rouvrir le kind `format` — un kind élargit une
> union stockée, et une union élargie **ne se rétrécit plus** une fois qu'un client a enregistré un
> document. Refuser le kind est **gratuit** ; différer le champ de segment coûte une estampille au
> lot qui en aura besoin.
>
> ⛔ **Cette dernière phrase est la démonstration d'A-5, et le dossier ne l'avait pas lue comme
> telle (R-17).** Si différer coûte une estampille, alors **livrer n'en coûte aucune** : `D-14`
> dépense déjà `6 → 7` dans ce lot, pour la **même classe** de changement — la *perte silencieuse*
> d'un champ optionnel qu'un build antérieur dépouille.
>
> ✅ **A-5 a tranché le 2026-08-20 : DIFFÉRÉ, coût acté.** Le coût marginal du champ n'était pas
> l'estampille — celle-là était gratuite — mais **deux champs d'AST, deux paires
> `*_KEYS_IN_STEP`, les fixtures, et le premier invariant croisé du lot**, donc une campagne de
> mesure de plus sur un lot déjà **XL**. Le lot E4 paiera `7 → 8`, **et ce coût est désormais
> inscrit, pas découvert.** La phrase ci-dessus reste dans le plan parce qu'elle est l'argument
> qu'il faut relire le jour où E4 rouvrira la question — **pas la décision.**

---

### 6.2 Qui juge « corrects » — la réponse est : personne, et le dépôt le dit déjà

**Mécaniquement, aucun juge n'existe, et il n'en existera pas.** Le mot n'est défini nulle part, et
son sens fort est **explicitement attribué à quelqu'un d'autre** — `docs/roadmap/core.md:36-38`
puis la ligne d'arbitrage `:49` :

> **Openview calcule ce qu'on lui demande. Il ne décide d'aucune règle fiscale ou légale, et ne
> garantit aucune conformité.**

> | La **conformité** du document produit — facture, relevé, contrat ou tout autre | **L'intégrateur.** Énoncé sans détour dans le README et la documentation |

Il faut donc **scinder le mot**, et nommer un propriétaire pour chaque moitié :

| Sens de « corrects » | Juge | Vérifiable comment |
| :--- | :--- | :--- |
| **conforme** — bloc d'adresse, mentions obligatoires, *sales tax* contre TVA, régime d'exonération | ⛔ **l'intégrateur**, jamais Openview (`core.md:49`) | **jamais**, par décision de périmètre |
| **écrit dans l'écriture déclarée** — la bonne locale, la bonne devise, le bon nombre de décimales, le bon calendrier | **les `it` de [§6.3]** | `pnpm run test:coverage` |
| **lisible et plausible pour un lecteur** — deux factures côte à côte qui se lisent bien | **le propriétaire du produit**, revue humaine sur la capture de [§6.4] | revue, comme C5 |

> ⚠️ **Le critère de la roadmap est satisfait À LA LETTRE par une facture française écrite en mots
> anglais**, et c'est la raison pour laquelle il ne peut pas servir de charge de justification. La
> charge repose sur `core.md:257-259` — « les montants, les dates, les séparateurs de milliers, la
> position du symbole monétaire, et les libellés fixes » — dont **quatre postes sur cinq** sont
> l'objet de ce lot et dont le cinquième est livré. C'est cette énumération qui commande le
> périmètre ; le « prêt quand » commande la **démonstration**, ce qui n'est pas la même fonction.
> C5 a énoncé cette distinction pour lui-même ; elle vaut mot pour mot ici.

---

### 6.3 Ce que `core` démontre seul, et les `it` qui le portent

**La fixture : un `Template` unique portant une table de DEUX écritures**, et un seul jeu de
données. Ce que les deux écritures ne partagent pas, ce sont uniquement `locale`, `currency`, les
deux bornes de fraction et `dateStyle`. [mesuré] une table de deux écritures ajoute **+10 valeurs**
et **+0 niveau de profondeur** au compteur d'`assertBoundedShape` ; sur le modèle réel de la
vitrine (620 nœuds, profondeur 18), **+1,6 %** de valeurs contre des limites par défaut de 100 000
nœuds et 64 niveaux.

**Les `it` qui démontrent le critère**, chacun assurant une chose que les autres n'assurent pas :

1. **`parseTemplate` accepte le modèle et rend `schemaVersion: 7`.** Sans lui, le reste ne prouve
   rien : le critère dit *décrit*, donc le contrat doit l'accepter.
2. **Les deux écritures sont distinguées par un ARGUMENT.** `resolvePresentation(table, 'a')` et
   `resolvePresentation(table, 'b')` rendent deux `{ ok: true, writing }` **différents** ;
   `Object.hasOwn` protège la lecture, et **onze noms hérités d'`Object.prototype`** rendent
   `{ ok: false, refusal: 'unknown-writing' }` [mesuré — l'assertion portait sur `undefined` avant
   A-7, et elle est **plus forte** maintenant : un nom hérité doit être refusé **pour la bonne
   raison**, pas seulement refusé].
3. **Une même valeur, deux chaînes différentes, LES MÊMES CHIFFRES.**
   `formatMoney(v, A) !== formatMoney(v, B)` **et** `digitsOf(formatMoney(v, A)) ===
   digitsOf(formatMoney(v, B))`. C'est la traduction testable de « deux écritures d'une même
   valeur », et c'est **la seule forme qui survive aux deux jeux CLDR de la CI**.
4. **La table CLDR devise → unités mineures est INATTEIGNABLE**, comptée en chiffres : `JPY`,
   `TND` et une devise inconnue rendent **le même nombre de chiffres** qu'`EUR` sous les mêmes
   bornes déclarées. C'est la démonstration que la décision 16 d'ADR 0004 est tenue.
5. **Le calendrier et le système de chiffres sont épinglés.** `toContain('2026')` **et**
   `not.toContain('2569')` (bouddhique) / `not.toContain('1405')` (persan) ; comptage de chiffres
   latins sur `ar-EG`. Aucune de ces assertions ne fige une chaîne.
6. **Le trou de locale existe, et il est démontré sans figer la locale de l'hôte** :
   `Intl.NumberFormat('zz').resolvedOptions().locale !== 'zz'`. **Le tag est explicite, donc le
   plugin GritQL ne mord pas** — c'est la correction que la direction demandait, et elle est
   vérifiée sous Biome 2.5.8. Un `new Intl.NumberFormat()` d'arité zéro aurait été **refusé**, et
   [mesuré] **aucun `biome-ignore` ne l'aurait rattrapé**.
7. **Les données sont identiques.** `collectTemplateDataPaths` rend la **même liste, dans le même
   ordre**, quelle que soit l'écriture choisie — parce qu'une écriture ne porte aucune
   `Expression` et n'est traversée par aucun parcours. C'est la traduction testable de « sans
   duplication du modèle ».
8. **Les 22 refus `N01 … N22`**, une issue par faute, chemin et message intégral — y compris
   **N22**, la coupure : une faute *continuable* dans une entrée **au nom vide** rend **une** issue
   et non deux.

> **Le style d'assertion est imposé par B1, et il est tenu : aucune chaîne formatée n'est figée
> nulle part.** [mesuré] `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0**
> avant le symbole ; le U+202F est arrivé avec **CLDR 42 / ICU 72** ; la CI tourne sur
> `node: [24, 26]` (`.github/workflows/ci.yml:59`). Un test d'or sur une chaîne formatée
> **peut passer sur l'une des deux versions et rougir sur l'autre**. La sonde 11 de [§6.5] fait de
> cette règle un critère mécanique.

**Ce que ces `it` NE démontrent PAS, et qu'aucun `it` de `core` ne peut démontrer :** qu'une
facture sort. Aucune facture bilingue n'est rendue par ce lot, et **aucun mini-moteur n'est écrit
hors dépôt pour faire semblant**. Ce qui est démontré est strictement : *une valeur, deux écritures
déclarées, deux chaînes différentes portant les mêmes chiffres, depuis un seul objet `Template`*.

---

### 6.4 La démonstration visible — la vitrine, et ce qu'elle ne peut pas montrer

#### La nouveauté du lot, et c'est un argument fort

> ⛔ **C6 livre des FONCTIONS. Pour la première fois du projet, un critère visuel est visible
> SANS moteur.** C1 à C5 ne pouvaient montrer qu'une **description** — un arbre, des chemins de
> données, des refus — et devaient laisser le rendu à une fonction React écrite dans la vitrine.
> `formatMoney`, `formatDecimal` et `formatDate` sont, elles, **du contrat**, et ce qu'elles
> rendent est **une vraie chaîne** que le lecteur lit à l'écran. La vitrine cesse d'illustrer une
> promesse : elle **exécute** le contrat.

**Et l'écart que ce lot supprime est écrit noir sur blanc dans le dépôt** [vérifié] :

```
apps/playground/src/App.tsx:1477
const fr = (value: number): string => String(value).replace('.', ',');
```

Une locale française **codée à la main**, avec son commentaire — « *L'écriture française d'un
nombre calculé, pour que la prose et le tableau concordent* ». Elle est appelée trois fois
(`:2130`, `:2133`, `:2140`). **Elle disparaît en INC-4**, remplacée par `formatDecimal` sur une
écriture déclarée par le modèle. C'est la mesure la plus courte de ce que le lot apporte : une
fonction de trois lignes qui prétendait connaître le français est remplacée par une déclaration
que l'auteur du modèle possède.

#### Ce que la page doit montrer, et rien de moins

> ⛔ **CETTE LISTE ÉTAIT CONTRADICTOIRE, ET LA CONTRADICTION ÉTAIT INSTRUCTIVE (R-08).** Elle
> exigeait à la fois « **le même `renderData`** », « un sélecteur qui ne change que le **nom**
> d'écriture » et « **les libellés qui basculent par `if`** ». Les trois ne peuvent pas être vraies
> ensemble : le `if` de C1 lit `path('rendu.langue')`, c'est-à-dire **une donnée**. Changer la
> seule clé d'écriture ne le fait pas basculer, et la vitrine aurait montré des **libellés figés en
> français** au-dessus de montants passés en dollars. **C'est exactement le défaut produit que la
> démonstration devait faire voir — elle l'aurait produit sans le nommer**, ce qui est la pire des
> deux façons.

**La vitrine porte donc DEUX boutons, pas un, et c'est le sujet de la démonstration**, pas un
détail d'implémentation (arbitrage **A-6**) :

| Bouton | Ce qu'il change | Ce qui bascule |
| :--- | :--- | :--- |
| **① Langue des mots** | `renderData.rendu.langue` : `'fr'` ⇄ `'en'` | `Facture` ⇄ `Invoice`, `sur` ⇄ `of` — par le `if` de **C1** |
| **② Écriture des valeurs** | le **nom** passé à `resolvePresentation` : `'fr-eur'` ⇄ `'en-usd'` | `1 234,50 €` ⇄ `$1,234.50`, `19 février 2026` ⇄ `February 19, 2026` — par **ce lot** |

- **Un seul `Template`**, portant une **table de deux écritures** — et l'objet stocké affiché tel
  quel, pour que le lecteur voie que la table **est dans le document** et non dans le code React.
- **Le même `Template` et la même fonction de rendu** pour les quatre combinaisons. Ce qui ne
  change **jamais**, et qu'il faut afficher pour qu'on le constate : le modèle, le code de rendu,
  le navigateur.
- **Les deux listes `collectTemplateDataPaths`, affichées et égales.** C'est la partie du critère
  qu'un lecteur ne peut pas vérifier à l'œil, donc c'est celle qu'il faut écrire à l'écran.
- ⛔ **Les quatre combinaisons atteignables, et les deux « croisées » affichées comme telles.**
  ①fr + ②en-usd donne **des libellés français avec des montants en dollars**. Ce n'est ni un bug
  de la vitrine ni un bug du contrat : c'est la **conséquence de deux canaux indépendants**
  ([D-02] pour l'un, C1 pour l'autre), et **aucune porte d'Openview ne la voit** — le parse
  accepte les deux déclarations séparément, le rendu réussit les deux. La vitrine doit **montrer
  la combinaison croisée** avec la phrase qui va avec : *« ces deux commutateurs sont
  indépendants par conception ; les tenir cohérents appartient à l'intégrateur — attente
  `E4-11` »*. Une vitrine qui ne proposerait que les deux diagonales laisserait croire à un
  couplage qui n'existe pas.
- ⛔ **Le câblage site par site, ASSUMÉ À L'ÉCRAN.** `runsDeSegments` (`App.tsx:827`) rend
  aujourd'hui `String(value)` à la ligne **856** pour **toute** valeur liée, sans rien qui
  distingue `commande.numero` d'un total. La vitrine doit donc décider à la main, valeur par
  valeur — et **le dire**, avec la phrase que E4-1 rendra caduque : *« ce câblage est fait ici, à
  la main ; le contrat ne sait pas quels sites s'écrivent, et c'est le lot E4 qui le tranchera »*.
  Une vitrine qui le tairait ferait croire E4-1 résolu, ce qui est exactement le défaut que le §0
  du contrat refuse.

#### Ce qu'elle ne peut pas montrer, et ce n'est pas un manque du lot

| Non montrable | Pourquoi |
| :--- | :--- |
| **Aucun PDF** | [vérifié] `packages/engine/src/index.ts` fait **6 lignes**. Le critère de `core` dit *décrit*, pas *rendu* |
| **Aucune preuve que le MOTEUR fera pareil** | Les neuf attentes E4-1 … E4-9 ne sont vérifiables qu'au lot E4. Une vitrine qui les honore ne prouve rien sur un moteur qui ne les honorerait pas |
| **Aucune garantie de version d'ICU** | L'ICU du navigateur n'est pas celui de Node. C'est **E4-9**, et la promesse d'aperçu identique au PDF (J4) en dépend |
| **Aucun choix automatique des sites** | E4-1. C'est la limite structurante du lot, et la vitrine la met en scène plutôt que de la masquer |
| **Aucune facture « correcte »** | Au sens fort, la conformité appartient à l'intégrateur [§6.2] ; au sens structurel, deux factures ne diffèrent que par les mots et les formats [§6.0] |
| **Aucun système de chiffres non latin** | `numberingSystem: 'latn'` est épinglé en dur (D-09/D-10). Une facture en `ar-EG` sort en chiffres latins — c'est défendable, ce n'est pas neutre, et c'est la question que D-10 recommande de rouvrir sur mandat produit |

#### Qui juge, et par quelle porte la vitrine passe

**Personne mécaniquement** : la démonstration est une **revue humaine**, faite par le propriétaire
du produit sur la capture des deux écritures côte à côte — même dispositif que C5.

⚠️ **Mais elle n'est pas hors de toute porte, contrairement à ce que C5 a écrit pour lui-même.**
[vérifié] `vitest.config.ts` déclare `projects: ['packages/*']` et
`coverage.include: ['packages/*/src/**/*.{ts,tsx}']`, donc **seule la porte 4** est aveugle sur
`apps/` ; `apps/playground/package.json` porte ses propres scripts `build` et `type-check`, et
`biome.jsonc:14` inclut `**`. **Trois portes sur quatre relisent `App.tsx`.** Ce qui manque à la
vitrine est un `it`, pas une porte — et c'est pourquoi la revue humaine est le seul juge du
*contenu*, pas de la *correction*.

---

### 6.5 Définition de fini — critères vérifiables mécaniquement, un par ligne

Chaque sonde vient avec sa **contre-épreuve de non-inertie** : une variante qui, elle, **doit**
rendre quelque chose. Une commande qui rend toujours zéro ne prouve rien.

> ⛔ **HUIT des sondes que j'avais d'abord écrites étaient INEXÉCUTABLES, et je les ai mesurées
> avant de les publier plutôt qu'après.** Le défaut est toujours le même — celui que C5 a
> découvert sur six des siennes : **la sonde cherche un MOT là où le critère porte sur une
> DÉCLARATION, et le mot apparaît dans les docstrings du lot, qui expliquent précisément pourquoi
> la déclaration n'existe pas.** Le tableau ci-dessous porte les formes **corrigées** ; les huit
> formes naïves et leur nombre de faux positifs mesurés sont sous le tableau, parce qu'une sonde
> corrigée sans son motif se refera casser au lot suivant.

| # | Sonde | Attendu | Contre-épreuve de non-inertie |
| :-- | :--- | :--- | :--- |
| 1 | `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` | **exit 0** | — (c'est la CI) |
| 2 | `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- AGENTS.md tsconfig.base.json biome.jsonc tools/biome/` | **exit 0** — aucune contrainte desserrée (AGENTS.md §7) | la même commande sur `packages/core/src/index.ts` **doit** rendre exit 1 |
| 3 | `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- packages/core/src/errors.ts` | **exit 0** — les trois catalogues d'erreur **inchangés** (D-11) | la même sur `packages/core/src/template/migrate.ts` **doit** rendre exit 1 |
| 4 | `git grep -cE "(function\|const) +(scaleOf\|declaredScaleOf)" -- packages` | **0** — la fonction **n'est pas écrite** ; X-1 est dissous, pas contourné (D-05) | `git grep -c "^export function resolvePresentation" -- packages/core/src/presentation/resolve.ts` **doit** rendre **1** |
| 5 | `git grep -c "case 'round':" -- packages/core/src/expression` | **2** — le lot n'écrit **aucun nouveau `switch`** | `git grep -c "case 'concat':" -- packages/core/src/expression` **doit** rendre **2** [mesuré à HEAD] |
| 6 | `git grep -cE "^(export )?const PRESENTATION_(LOCALES\|CURRENCIES)" -- packages` | **0** — aucune liste close (D-06, D-08) | `git grep -cE "^export const DATE_STYLES" -- packages/core/src/presentation/types.ts` **doit** rendre **1** |
| 7 | ⚠️ **RÉÉCRITE (R-04)** — `git grep -cE "(wellFormedLocale\|honouredLocale)" -- packages/core/src/index.ts` | **0** — les **deux** prédicats hors du barrel (D-12). *L'ancienne sonde interrogeait `declarableLocale`, **un nom qui n'existe plus nulle part** : elle rendait `0` par vacuité, donc elle ne prouvait rien — exactement la sonde inerte que le [§6.5] existe pour éliminer* | `git grep -c "resolvePresentation" -- packages/core/src/index.ts` **doit** rendre **1** [mesuré] |
| 8 | `git grep -nE "^[^*/]*(new )?Intl\." -- packages/core/src` | **6 lignes, dans 2 fichiers** : `presentation/format.ts` ×3, `presentation/locale.ts` ×3 — les **seules** portes vers ICU [mesuré] | la **même sans** le préfixe `^[^*/]*` rend **10 lignes dans 5 fichiers** : la différence **est** les docstrings |
| 9 | `git grep -cE "^[^*/]*timeZone: 'UTC'" -- packages/core/src/presentation` puis `calendar: 'gregory'` puis `numberingSystem: 'latn'` | **2**, **1**, **3** [mesuré] — **trois** options épinglées, pas une (D-09) | `git grep -c "dateStyle" -- packages/core/src/presentation/format.ts` **doit** rendre au moins **1** |
| 10 | `git grep -cE "^[^*/]*(new Date\(\|Date\.UTC\()" -- packages/core/src/presentation` | **0** — **pas un seul objet `Date` construit** (D-21) | `git grep -c "dayNumberOf" -- packages/core/src/presentation/format.ts` **doit** rendre au moins **1** |
| 11 | `git grep -cE "(toBe\|toContain)\('[^']*[0-9][^0-9']" -- packages/core/src/presentation/__tests__` | **0** — **aucune chaîne formatée figée** : aucune attente ne mêle un chiffre à un séparateur (B1, `node: [24, 26]`) | la même expression sur la ligne `expect(x).toBe('1 234,50 EUR');` rend **1** [mesuré] |
| 12a | `git grep -c "CURRENT_SCHEMA_VERSION = 7" -- packages/core/src/template/template.ts` | **1** | `git grep -c "CURRENT_SCHEMA_VERSION = 6" -- packages` **doit** rendre **0** |
| 12b | `git grep -c "from: 6" -- packages/core/src/template/migrate.ts` et `git grep -c "schemaVersion: 7" -- packages/core/src/template/migrate.ts` | **1** et **1** — une entrée, estampille seule (D-14) | `git grep -c "from: 5" -- packages/core/src/template/migrate.ts` **doit** rendre **1** (la chaîne n'est pas fusionnée) |
| 13 | `git grep -cE ": *z\.ZodType" -- packages/core/src/presentation` | **0** — annoter détruirait la porte de type (D-18) | la même sur `packages/core/src/ast` **doit** rendre **2** [mesuré à HEAD] (l'AST récursif, lui, en a besoin) |
| 14 | `git grep -cE "^[^*/]*biome-ignore" -- packages/core/src/presentation` | **0** — et c'est **obligatoire**, non vertueux : [mesuré] aucune orthographe de `biome-ignore` ne supprime un diagnostic de plugin | `git grep -c "biome-ignore" -- packages apps` **doit** rendre **4** [mesuré à HEAD] |
| 15 | `git grep -c "_IN_STEP" -- packages/core/src/presentation/__tests__/presentation.test.ts` | **2** — la porte de type d'INC-0 | retirer une paire **doit** faire passer la matrice de mutation de **6/6 exit 1** à **4/6** [mesuré, §4.0(a)] |
| 16 | `node -e "import('./packages/core/dist/index.js').then(m => console.log(Object.keys(m).length))"` | **126** [mesuré par émission ESM réelle] | la même sur un `dist` de `main` **doit** rendre **117** [mesuré] |
| 17 | `git grep -cF "presentations: PresentationTableSchema.optional()" -- packages/core/src/template/template.ts` | **1** — le champ est **optionnel, sans défaut** (D-13) | `git grep -cF "root: ContainerNodeSchema" -- packages/core/src/template/template.ts` **doit** rendre **1** (un champ requis, pour que la sonde distingue les deux formes) |
| 18 | `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- docs/adr/0003-formules-agregations-et-dates-civiles.md` | ⚠️ **exit 1** — **polarité inversée** : l'amendement B1 **doit** exister (INC-5) | la même sur `docs/adr/0001-expression-language.md` **doit** rendre exit 0 |
| 19 | `git grep -c "README.md:127" -- packages docs` | **0** — la citation fausse est corrigée avant le commit | `git grep -c "README.md:17" -- packages/core/src/presentation` **doit** rendre au moins **1** |

#### Les huit corrections, avec le motif de chacune — mesurées sur le bac à sable

| Sonde | Forme naïve | Ce qu'elle rend réellement | Correction |
| :-- | :--- | :-: | :--- |
| 4 | `git grep -nE "\b(scaleOf\|declaredScaleOf)\b" -- packages/core/src` | **2 lignes** — `presentation.ts:81` et le test `:108`, **deux docstrings qui disent que la fonction n'existe pas** | chercher une **déclaration** (`function` / `const`) |
| 5 | `git grep -c "case 'round':" -- packages/core/src` | **3** au lieu de 2 — `presentation/format.ts:108` **cite littéralement le critère** dans sa docstring | restreindre le pathspec à `packages/core/src/expression`, où vivent les deux vrais `switch` [mesuré : `evaluator/evaluate.ts:96`, `paths.ts:89`] |
| 6 | `git grep -nE "PRESENTATION_(LOCALES\|CURRENCIES)" -- packages` | **1 ligne** — un commentaire de test qui explique le refus du tuple | chercher une **déclaration de constante** en début de ligne |
| 8 | `git grep -ln "Intl\." -- packages/core/src` | **5 fichiers** au lieu de 2 — `expression/types.ts`, `presentation/resolve.ts` et un test **nomment** `Intl` dans leurs docstrings sans jamais le construire | exiger que la ligne **ne soit pas** un commentaire (`^[^*/]*`) |
| 10 | `git grep -nE "new Date\(\|Date\.UTC" -- packages/core/src/presentation` | **3 lignes** — les docstrings qui expliquent pourquoi `Date.UTC` est refusé (il projette les années 0–99 sur 1900–1999) | même préfixe `^[^*/]*`, et exiger la parenthèse ouvrante |
| 13 | `git grep -n "z.ZodType" -- packages/core/src/presentation` | **1 ligne** — la docstring de `schemas.ts:92`, intitulée « *No `z.ZodType<Presentation>` annotation* » | chercher la forme **annotation** (`: z.ZodType`) |
| 14 | `git grep -n "biome-ignore" -- packages/core/src/presentation` | **2 lignes** — les docstrings qui rapportent la mesure « aucun `biome-ignore` ne rattrape un plugin » | même préfixe `^[^*/]*` |
| 3 | `git grep -n "ERROR_CODES" -- packages/core/src/presentation` | **2 lignes** — les docstrings qui disent que `custom` n'est entrée d'aucun des trois catalogues | remplacer le `grep` par un **`git diff --exit-code` sur `errors.ts`**, qui mesure le fait plutôt que le mot |

> ⚠️ **La sonde 5 mérite un avertissement séparé, parce qu'elle est un piège actif dans le contrat
> livré.** `presentation/format.ts:108` écrit, dans sa docstring, la phrase « *It also keeps the
> criterion `git grep -n "case 'round':" | wc -l` at TWO* ». Un relecteur qui exécute le critère
> **sans pathspec** obtient **3** et croit le lot cassé — alors que le troisième résultat **est la
> ligne qui affirme qu'il n'y en a que deux**. Deux remèdes existent : réécrire la docstring pour
> qu'elle ne contienne pas la chaîne, ou restreindre le pathspec. **Ce plan prend le second** —
> c'est le précédent exact de la sonde 7 de C5, resserrée sur les documents « qui font foi » — et
> **l'écrit ici** pour que le prochain lecteur ne perde pas une heure dessus.

#### Ce que la définition de fini ne peut PAS cocher

- **« deux documents corrects »** au sens fort : aucun juge n'existe, par décision de périmètre
  [§6.2].
- **« deux factures qui se lisent bien »** : revue humaine du propriétaire du produit sur la
  capture de [§6.4].
- **Les neuf attentes envers le moteur** : vérifiables **au lot E4**, pas avant — et E4-9 pas
  avant J4.
- **Le taux agrégé réel de `packages/core/src` à HEAD** : il exige `pnpm run test:coverage`, que
  le cadre de planification interdit. Le pire cas est publié et il est vert [§4.0(c)].
- **La survie du plugin GritQL à la prochaine montée de Biome** : `noJsRestrictedProperties` est
  une règle *nursery*, hors versionnement sémantique, et peut être renommée **en silence**. La
  sonde jetable de l'ADR 0003 doit être rejouée à chaque montée ; le contrôle négatif d'INC-0
  prouve que la règle **et** le plugin mordent sur **Biome 2.5.8 aujourd'hui**, et rien de plus.

---

## 7. Les dettes, les refus, les corrections et les mandats

Cette section porte quatre registres, et ils se lisent dans cet ordre : ce que le lot **devait**
aux lots qui l'ont précédé (7.1), ce qu'il **refuse** de livrer et qui en hérite (7.2), ce qu'il
**corrige** dans le dépôt au passage (7.3), et ce qu'il **demande** parce qu'il n'avait pas le
droit de le trancher seul (7.4).

Le geste central est celui que le dépôt a inventé au lot C5 : **une promesse déclinée sans
héritier nommé est une faute.** Les vingt promesses faites à C6 sont donc reprises une par une,
avec leur source, leur sort, et — pour les cinq déclinées — le lot qui en hérite.

## 7.1 Le registre des dettes — les vingt promesses faites à C6

**Règle de tenue du registre, et elle est stricte.** Une promesse **déclinée sans héritier
nommé est une faute** : le dépôt a inventé la colonne « propriétaire » pour ça
(`docs/adr/0007-l-apparence.md:1470-1500`, les dix-huit refus de C5 « par familles, avec le lot
qui possède chaque refus »). Les vingt lignes ci-dessous ont donc toutes une quatrième colonne
remplie — y compris les « honorée », où elle nomme *ce qui rend la promesse vérifiable*.

**Trois statuts, et un seul sens :**

- **honorée** — le contrat livre le mécanisme que la promesse annonçait, et on peut le montrer.
- **déclinée** — le contrat ne le livre pas, et un héritier est **nommé**, avec le lot ou la
  personne qui décide.
- **sans objet** — la promesse n'appelle aucun geste de C6 : soit elle a été **retirée** par un
  texte postérieur, soit elle est **déjà tenue** par un lot livré, soit c'est une *autorisation*
  et non une dette.

### Le tableau

| # | La promesse | Source `chemin:ligne` | Statut | Héritier / ce qui la rend vérifiable |
| :-- | :--- | :--- | :--- | :--- |
| **A-1** | « **C6 possède l'affichage** » ; la couture est `DataBindingStep` | `docs/adr/0003-formules-agregations-et-dates-civiles.md:278-281` ; répété `:872-876` | **honorée pour la moitié `core`, déclinée pour la couture** | La moitié « ce qui se déclare » est la table `presentations` + les trois formateurs. La moitié « ce qui s'applique » est `DataBindingStep`, qui vit dans `@openview/engine` — **héritier : lot E4** (attente E4-1). Coupe déjà écrite : `docs/roadmap/engine.md:78-79`, « *le contrat sait **décrire** … le moteur doit **l'honorer*** » [vérifié] |
| **A-2** | `text()` ne formate pas : « *no thousands separator, no currency symbol, no locale* » ; le formatage est C6 | `packages/core/src/expression/types.ts:407-410` ; français `docs/adr/0003-…:102-105` | **honorée** | `formatMoney` / `formatDecimal` / `formatDate` sont les trois portes. `text()` n'est **pas modifié** : il continue de rendre la forme canonique, et le contrat ne le contredit nulle part |
| **A-3** | Le **zéro de remplissage** (`1.50`) « ne peut pas changer une valeur, et il appartient à C6 » | `docs/adr/0004-les-arrondis-declares-par-le-modele.md:660-661` ; `packages/core/src/expression/types.ts:264-266` | **honorée, sans champ dédié** | `minFractionDigits` **est** le remplissage. Traitement long en **7.1.a** |
| **A-4** | **Qui déclare l'échelle d'affichage** — trois options, sans recommandation | `docs/adr/0004-…:795-808` | **honorée — tranchée en option 1** | Le **modèle** déclare les deux bornes (D-04). Et la mesure du dossier casse la présentation même de la question : les options 1 et 3 **ne sont pas exclusives**, des bornes explicites **écrasent la table CLDR** — `JPY` par défaut rend `"1 235 JPY"`, `min = max = 2` rend `"1 234,57 JPY"` [mesuré] |
| **A-5** | **Ne jamais ré-arrondir en silence** un montant que le modèle a déjà arrondi | `docs/adr/0004-…:809-812` ; repris `docs/plans/c3-tableau-de-lignes.md:1597` | **honorée en énoncé, déclinée en garantie** | Le contrat ne peut pas **vérifier** que `maxFractionDigits` vaut les décimales du `round` qui alimente la valeur : il ne voit pas l'expression au moment de formater. **Héritier : lot E4** (attente E4-2, « arrondir puis formater, jamais l'inverse » — formater seul contredit un `halfEven` déclaré sur **4,9275 %** d'une famille monétaire de 200 000 tirages, **0,0000 %** avec `halfExpand`) |
| **A-6** | La **précision par devise** relèvera « *d'un mécanisme de C6 — une déclaration au niveau du modèle associant un couple locale/devise à une échelle* » | `docs/adr/0004-…:300-306` (encadré 🔑) | **honorée à la lettre** | `Presentation` **est** ce couple : `{ locale, currency, minFractionDigits, maxFractionDigits, dateStyle }`, déclaré au niveau du modèle. La tension qu'`r2` signalait entre cet encadré (prescriptif, option 1) et la question ouverte `:795-808` (trois options sans recommandation) est **tranchée en faveur de l'encadré**, et le plan le dit au lieu de choisir en silence |
| **A-7** | Le **format d'affichage du numéro de page** — « *language, digits, "sur" against "of"* » | `packages/core/src/ast/types.ts:92-95` ; `docs/plans/c4-la-page.md:219` ; cadeau architectural `docs/adr/0006-la-page.md:569-572` | **honorée pour la langue, déclinée pour les chiffres** | Traitement long en **7.1.b** |
| **A-8** | Le **libellé du report de page** est C6 | `docs/adr/0006-la-page.md:617-620` | **sans objet** | Le libellé d'un report est un `TextNode` comme un autre : il est **déjà** bilingue par le `if` de C1, sans que C6 n'ajoute rien (voir 7.1.b). Ce qui manque, c'est le **marqueur** (`field`), et il n'est pas de C6 — **héritier : lot E3**, nommé sur place par l'ADR 0006 (« *le lot E3, qui trouvera le mécanisme déjà là, en un `field` de plus* ») |
| **A-9** | **Chiffres romains, numérotation par section** ; « la forme des chiffres est C6 » | `docs/adr/0006-la-page.md:955-957` ; repris `docs/plans/c4-la-page.md:1700` | **déclinée** | Deux objets distincts, deux héritiers. **La forme des chiffres** : `numberingSystem` est épinglé à `'latn'` en dur (D-09), et sa déclarabilité est **la question que D-10 recommande de rouvrir sur mandat** — **héritier : le propriétaire du produit** (mandat M-4, §7.4). **La numérotation par section** : les sections n'existent pas dans le contrat, donc l'objet n'a pas de porteur — **héritier : le lot qui introduirait les sections**, aucun n'est planifié ; **arbitrage du propriétaire du produit** |
| **A-10** | **Une seule position de contenu à traduire** — `TextNode.content`, et rien d'autre | `packages/core/src/ast/types.ts:346-350` ; `docs/adr/0005-le-tableau-de-lignes.md:200-202` ; `docs/plans/c3-…:816-819`, `:5019-5020` ; `docs/adr/0006-la-page.md:1062-1063` | **honorée, et c'est la promesse la plus chère du legs** | Le lot ajoute **zéro position de contenu** : `presentations` est une table d'**écritures** (locale, devise, bornes, style de date), jamais du texte. **Aucun catalogue de messages, aucune table de traductions, aucune clé de libellé.** Le dépôt a payé trois fois pour cette invariante ; elle est intacte |
| **A-11** | « **tout C6** — séparateur de milliers, position du symbole monétaire, **motif de date** ; le **formatage conditionnel** ; une couleur dérivée du type » | `docs/adr/0007-l-apparence.md:125` (condition 1) ; version longue `docs/plans/c5-…:485` | **honorée × 2, déclinée × 3** | **Séparateur** et **position du symbole** : honorés, ce sont des propriétés de la locale qu'`Intl` résout (D-09). **Motif de date** : décliné *en tant que motif* — un motif est un parseur, refusé deux fois (`docs/adr/0006-la-page.md:953-954`, `docs/adr/0007-…:1493`) — et remplacé par une **énumération fermée** de quatre styles ECMA-402 (D-01, champ `dateStyle`). **Formatage conditionnel** : traitement long en **7.1.c**. **Couleur dérivée du type** : déclinée, **héritier : lot C5**, dont la décision 12 la refuse déjà partout |
| **A-12** | C6 « hérite d'un contrat qui **n'a pas préempté son périmètre** » | `docs/adr/0007-l-apparence.md:1610-1612` | **sans objet** (constat, pas dette) | Vérifié par symétrie : le lot C6 ne préempte pas non plus C5. Il n'écrit **aucun champ d'apparence** — ni couleur, ni police, ni graisse, ni filet. La condition 1 du critère de C5 reste la ligne de partage, et elle n'est franchie dans aucun sens |
| **A-13** | Aucun **type de colonne**, aucun format sur la table ; « *No number format, no currency, no display scale, no column type (lot C6)* » | `packages/core/src/ast/types.ts:545-546` ; `docs/plans/c3-…:1597`, `:531-532` | **honorée par abstention — et le piège de C3 est évité** | Le lot n'ajoute **rien** sur `TableColumn` ni sur `TableNode`. ⚠️ Surtout : C3 avait écrit que si C6 tranchait A-4 « *en faveur d'une **table de devises*** », son arbitrage n° 1 se rouvrirait et son contrat serait « ***à rejouer, pas à amender*** » (`docs/plans/c3-…:1635`, `:5127`). **La décision D-08 — la devise validée par la FORME `^[A-Z]{3}$`, jamais contre un registre — signifie qu'aucune table de devises n'entre.** Le coût le plus lourd que le plan C6 pouvait déclencher **n'est pas déclenché** [déduit, de D-08 confrontée à `docs/plans/c3-…:1635`] |
| **A-14** | La conversion **ISO → `31/03/2026`** appartient à C6 | `packages/core/src/expression/civil-date.ts:22-25` ; `docs/adr/0001-expression-language.md:162-163` ; répété à l'écran `apps/playground/src/App.tsx:637`, `:2199` | **honorée** | `formatDate(value, writing)` + le champ `dateStyle`. C'est l'**écart assumé** de la conception finale par rapport à la direction (« une entrée : locale, devise, deux bornes ») : un **cinquième champ**, justifié parce que `docs/roadmap/core.md:256-259` met « les dates » dans le lot et que `civil-date.ts:24-26` désigne C6 nommément. Sans lui, la moitié « dates » du critère n'est **pas décrite du tout** |
| **A-15** | Le **lien hypertexte** — « une cible sortante (E8) **et** un contenu à traduire (C6) » ; classé **sans propriétaire** | `docs/adr/0007-l-apparence.md:1491` | **déclinée** | Le lot **ne le réclame pas**, et le motif est structurel : le prendre supposerait d'introduire un porteur de contenu (segment ou nœud) qui n'existe pas, c'est-à-dire exactement la **seconde position de contenu** qu'A-10 interdit. **Héritiers nommés : lot E8** pour la cible sortante, **le propriétaire du produit** pour l'arbitrage du lot qui introduira le porteur. *Signal de réouverture :* le jour où un lot ajoute un porteur d'URL, sa moitié « contenu » est déjà couverte par le `if` de C1 |
| **A-16** | La **direction d'écriture (RTL)** — promesse **RETIRÉE** | `docs/adr/0005-le-tableau-de-lignes.md:273-282` ; mesure `docs/plans/c3-…:1143-1145` | **sans objet — et ne pas la reprendre est le geste conforme** | Le lot ne la reprend pas. L'ADR 0005 a explicitement retiré l'énoncé qui « *prêtait à C6 une compétence qu'aucun texte ne lui donne* ». La reprendre rejouerait l'erreur corrigée. **Héritier tel qu'écrit** : « *un lot non écrit … une déclaration de modèle rattachée à C6, une entrée du `RenderRequest`, ou rien et un défaut de moteur* » (`docs/plans/c3-…:5236`) |
| **A-17** | Les **trois options** transmises à C6 par le plan C2, INC-5 | `docs/plans/c2-arrondis-declares-par-le-modele.md:74`, `:1905` | **honorée** (même geste qu'A-4) | Les trois options sont **reprises et départagées par une mesure**, pas par un goût : l'option 3 (ICU seule) est écartée parce que la table CLDR **est un arrondi** (B4 du dossier : `1234.5678` → `1235` en JPY, `1234,568` en TND), donc soumise à la décision 16 du `README` ; l'option 2 (catalogue de l'intégrateur) est écartée parce qu'elle exige un canal neuf que `ports/render.ts:23-29` refuse par écrit |
| **A-18** | `declaredScaleOf` — refusé dans C2, « **C6 l'écrira s'il en a besoin** » | `docs/adr/0004-…:677-679` | **déclinée — et c'est une autorisation, pas une dette** | **D-05 : aucun `scaleOf`, aucun `declaredScaleOf`.** Le maximum est **déclaré**, jamais dérivé de la forme binaire d'une valeur. Personne en aval n'attendait cette fonction : décliner une *autorisation* ne crée aucun orphelin, donc **aucun héritier n'est requis** — et le registre le dit plutôt que de laisser croire à un oubli. **Bénéfice mesurable :** le seuil de retrait de l'amendement d'`AGENTS.md:265-275` (l'apparition d'un **troisième** parcours de l'algèbre d'expressions) **n'est pas franchi** — `git grep -c "case 'round':" -- packages` rend **2** (`expression/evaluator/evaluate.ts:96`, `expression/paths.ts:89`) et le lot n'en ajoute aucun [mesuré] |
| **A-19** | `MIN_ROUND_DECIMALS` / `MAX_ROUND_DECIMALS` sont déjà exportées | `docs/adr/0004-…:682-685` | **honorée** | **D-17 : `MAX_FRACTION_DIGITS` est IMPORTÉ de `MAX_ROUND_DECIMALS`**, jamais réénoncé. La borne vit à un seul endroit — `packages/core/src/expression/types.ts:149`, `export const MAX_ROUND_DECIMALS = 15` [vérifié] — et les deux mondes (échelle de calcul, échelle d'écriture) partagent `[0, 15]` |
| **A-20** | « **Comment une valeur non textuelle devient du texte** » — la seconde moitié de la question 2 de l'ADR 0001 | `docs/adr/0001-expression-language.md:186-190`, `:191-195` ; confirmé encore ouvert `docs/adr/0003-…:878-880` | **honorée pour la moitié C6, déclinée pour l'autre** | La **mise en chaîne** est livrée (trois fonctions). La **politique de l'absence** — « un `{{ invoice.total }}` absent doit-il imprimer un blanc ou faire échouer le rendu ? » — n'est **pas tranchée**, et le contrat la rend lisible plutôt que de la trancher en passant : `undefined` de `resolvePresentation` = **faute d'auteur** ; `undefined` d'un formateur = **valeur absente**. Une absence, une cause, à chaque porte. **Héritiers : lots E3 et E4** (`DataBindingStep`), attente E4-8 |

### Ce que le tableau donne, en trois chiffres

- **11 honorées** (A-2, A-3, A-4, A-6, A-10, A-13, A-14, A-17, A-19 + les moitiés `core` d'A-1 et
  d'A-20), **5 déclinées avec héritier nommé** (A-5, A-9, A-11 en partie, A-15, A-18),
  **4 sans objet** (A-8, A-12, A-16, et A-7 pour sa moitié « langue » qui était déjà livrée).
  [déduit, par comptage du tableau ci-dessus]
- **Zéro promesse déclinée sans héritier.** A-18 est le seul cas où la case « héritier » dit
  « aucun requis », et il est argumenté : c'était une autorisation.
- **Zéro position de contenu ajoutée** — l'invariante A-10, pour laquelle trois lots ont conçu
  leur contrat, est tenue.

### ⚠️ Le trou que le registre ne referme pas, et qu'il ne faut pas laisser en annexe

Aucune des vingt promesses ne disait **quels sites d'un document s'écrivent**. Le contrat ne le
dit pas non plus, et c'est **mécanique** : le formatage est une **fonction**, donc rien dans le
document stocké ne distingue un numéro de commande d'un total. La vitrine lie
`commande.numero` (`20260014`) **brut** ; une écriture appliquée à tous les nombres imprimerait
`20 260 014`, qui désigne une autre commande. Et Openview ne peut pas reconnaître un total sans
**réserver un nom de champ**, ce que la règle de périmètre d'`AGENTS.md:18-32` refuse.

**C'est l'attente E4-1, et c'est la limite honnête du lot** : C6 livre de quoi **écrire une
valeur**, jamais **la liste des valeurs à écrire**. Le remède, le jour où E4 le prouvera devant
une vraie facture, est un **champ optionnel sur un segment** — classe *perte silencieuse*, donc
**une estampille et une migration d'estampille**, la modification la moins chère de ce dépôt.
Ce n'est **pas** un argument pour rouvrir le kind `format` : le refuser reste gratuit
(zéro `concat(` enfouissant une valeur à formater dans le seul consommateur réel [mesuré,
dossier `d0`]), et un kind, lui, aurait été **irréversible**.

---

## 7.1.a — Le zéro de remplissage (`1.50`), et pourquoi il n'a pas coûté un champ

**La promesse, recopiée.** [cité] `docs/adr/0004-les-arrondis-declares-par-le-modele.md:660-661` :

> *« Le zéro de remplissage (`1.50`) est du **remplissage**, il ne peut pas changer une valeur,
> et il appartient à C6. »*

Et la mesure qui l'accompagnait, [cité] `packages/core/src/expression/types.ts:264-266` :
« *`round(1.5, 2, m)` is `1.5` and prints `1.5`, not `1.50`. The trailing zero is padding,
padding cannot change a value, and it belongs to lot C6* ».

**Statut : honorée, et sans un seul champ dédié.** `minFractionDigits` **est** le remplissage.
Il n'existe ni `padZeros: boolean`, ni `pad`, ni `trailingZeros` : la borne basse d'une écriture
dit déjà, exactement, combien de décimales sont écrites au minimum.

[mesuré] — `node -e`, Node v24.11.1, ICU 77.1 :

```
Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2,
                             numberingSystem: 'latn' }).format(1.5)
  → "1,50"
Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR',
                             minimumFractionDigits: 2, maximumFractionDigits: 2,
                             numberingSystem: 'latn' }).format(1.5)
  → "1,50 €"
```

**Pourquoi ce point mérite d'être écrit long plutôt que coché.** Trois choses en découlent, et
deux d'entre elles sont des refus que le plan doit pouvoir opposer.

1. **La promesse d'ADR 0004 est tenue *à la lettre* : le remplissage ne change pas la valeur.**
   C'est vrai **parce que** `min = max` : la borne haute vaut la borne basse, donc `Intl`
   n'arrondit rien qu'il n'écrive. Le jour où un auteur déclare `min = 2, max = 4`, la borne
   haute **peut** arrondir — et c'est l'attente **E4-2**, pas une propriété du remplissage.
   **Le registre ne doit pas confondre les deux :** A-3 est tenue, A-5 est déléguée.
2. **Le remplissage ne se déclare pas deux fois, mais l'échelle, si.** L'objection que C2 posait
   à l'option 1 (« *elle se déclare deux fois, et rien n'oblige les deux à s'accorder* »,
   `docs/adr/0004-…:795-808`) est **réelle et non résolue par ce lot** : l'échelle de calcul vit
   dans l'arbre (`round(x, 2, m)`), l'échelle d'écriture vit dans la table. Ce contrat ne les
   fait **pas** s'accorder — il ne le peut pas, il ne voit pas l'expression au moment de
   formater. **Il nomme l'accord comme une obligation du moteur (E4-2)** au lieu de prétendre le
   garantir. C'est le geste honnête, et il faut l'écrire : sinon un relecteur croira l'option 1
   plus forte qu'elle ne l'est.
3. **Aucun champ « remplissage » ne sera ajouté plus tard sans doublon.** Si un lot futur voulait
   `padZeros`, il écrirait une **seconde orthographe d'un même fait** — précisément ce que la
   condition 2 du critère de C5 refuse pour `textTransform` (`docs/adr/0007-l-apparence.md:126`,
   « *deux orthographes d'un même fait* »). Le refus est donc **déjà argumenté ailleurs**, et le
   plan C6 peut s'y adosser plutôt que de le réinventer.

**Propriétaire du résidu :** lot **E4** (attente E4-2). *Signal de réouverture :* un modèle qui
déclare `min ≠ max` et dont le rendu contredit un `halfEven` déclaré — le cas est chiffré à
**4,9275 %** d'une famille monétaire de 200 000 tirages [mesuré, `s1-contrat-final.md`].

---

## 7.1.b — Le `pageField`, et le « cadeau » de l'ADR 0006 : honoré, mais pas dans la moitié qu'on croit

**C'est la promesse qui a coûté une décision entière à un autre lot**, et elle mérite d'être
vérifiée mécanisme en main plutôt que cochée.

**Ce qui est promis.** [cité] `packages/core/src/ast/types.ts:92-95`, docstring de
`TextPageFieldSegment` :

> *« What this contract does NOT carry, and who does: the VALUE (the paginator, lots E2 and E3),
> the display **FORMAT** of that value -- **language, digits, "sur" against "of"** (lot C6), the
> POSITION on the sheet … »*

**Et le cadeau.** [cité] `docs/adr/0006-la-page.md:569-572` — c'est l'argument qui a **choisi le
mécanisme B** contre A et G :

> *« **B offre C6 gratuitement**, et c'est l'argument qui achève A et G : « Page », « / »,
> « sur », « of » sont des `literal` du **même** `TextNode`, donc C6 se branche sur
> `TextNode.content` et sur rien d'autre. »*

Corollaire écarté sur place : le mécanisme **G**, un champ `numbering: { pattern }`, refusé
notamment parce qu'il est « *non — **doublon de C6*** » (`docs/adr/0006-la-page.md:556`).

### Vérification, morceau par morceau

`TextSegment` est une union de **trois** kinds [vérifié, `packages/core/src/ast/types.ts:109`] :
`TextLiteralSegment` (`:33`), `TextBindingSegment`, `TextPageFieldSegment` (`:98`). Le second
porte une `Expression` ; le troisième n'en porte **aucune**. C'est cette asymétrie qui décide.

| Moitié de la promesse | Verdict | Comment, exactement |
| :--- | :--- | :--- |
| **La langue** — « *"sur" against "of"* » | **HONORÉE, et gratuitement, comme l'ADR 0006 l'avait prévu** | Les mots autour du numéro ne sont **pas** dans le `pageField` : ce sont des segments **voisins** du même `TextNode`. Un segment `binding` portant `if(eq(path('rendu.langue'), 'fr'), 'sur', 'of')` les rend dans les deux langues **depuis un seul objet `Template`** — c'est le mécanisme de **C1, déjà livré**, mesuré deux fois dans le dossier dont une contre un `dist` reconstruit à HEAD. **C6 n'ajoute rien ici, et c'est exactement ce que « gratuitement » voulait dire.** ✅ Le choix du mécanisme B est **validé a posteriori** |
| **Le format du nombre** — séparateur, forme de l'entier | **mécanisme livré, SITE non déclarable** | `formatDecimal(n, writing)` écrit `12` ou `1 234` selon l'écriture. Mais **rien dans le document stocké ne dit que ce `pageField`-ci doit être écrit** : c'est le trou E4-1 dans sa forme la plus visible. **Héritier : lot E4** — et le câblage y est **trivial**, parce qu'un `pageField` est la *seule* valeur du document dont le moteur sait, par construction, qu'elle est un nombre de page : ce sont E2/E3 qui la produisent, elle n'arrive pas du jeu de données |
| **Les chiffres** — « *digits* » | **DÉCLINÉE** | `numberingSystem` est épinglé à `'latn'` **en dur** (D-09), donc une facture en `ar-EG` sort en chiffres latins. Mesuré, l'épinglage est nécessaire : sans lui, `ar-EG` rend `١٬٢٣٤٫٥٠` — et cela touche **`NumberFormat`**, donc **les montants**, pas seulement les numéros de page. **Héritier : le propriétaire du produit** — D-10 recommande `numberingSystem` comme candidat à un champ optionnel futur, et c'est le **mandat M-4** (§7.4). *Signal de réouverture :* une facture arabe ou persane commandée par un intégrateur |
| **Chiffres romains, numéro de départ, remise à zéro, numérotation par section** | **DÉCLINÉE** | `docs/adr/0006-la-page.md:955-957` les range ensemble : « *les sections n'existent pas dans le contrat, et la forme des chiffres est C6* ». Les chiffres romains suivraient le sort de `numberingSystem` (M-4) ; les sections n'ont **aucun lot porteur** — **arbitrage du propriétaire du produit** |

### Ce qu'il faut retenir, et écrire dans le plan

> **Le cadeau de l'ADR 0006 est réel, et il porte sur la moitié « langue » — pas sur la moitié
> « chiffres ».** B a rendu la traduction des mots **gratuite** en les laissant être des segments
> ordinaires ; il n'a jamais rendu gratuite l'écriture du **nombre**, qui suppose de savoir
> **quel** site formater. Le plan C6 doit donc créditer l'ADR 0006 pour ce qu'elle a réellement
> donné, et ne pas s'en réclamer pour ce qu'elle n'a pas donné.

**Et une conséquence de méthode, qui vaut pour tout le lot :** puisque « sur »/« of » se traduit
par un `if`, **aucun catalogue de libellés n'est nécessaire nulle part** — ni pour la page, ni
pour l'en-tête de tableau (A-10), ni pour le report (A-8). C'est le même argument, trois fois, et
il tient parce que le `if` fait une chose qu'une table de traductions ne fait pas : il
**réordonne** (`Facture n° 14 — ACME` contre `ACME — Invoice no. 14`).

---

## 7.1.c — Le formatage conditionnel (« en rouge si échu ») : contradiction ou non ? — **tranché : NON**

**Les deux textes, recopiés, parce que la question ne se tranche pas de mémoire.**

[cité] `docs/adr/0007-l-apparence.md:125`, condition 1 du critère d'appartenance à C5, colonne
« ce qu'elle écarte **seule** » :

> *« **tout C6** — séparateur de milliers, position du symbole monétaire, motif de date ; le
> **formatage conditionnel** (« en rouge si échu ») ; une couleur dérivée du **type** de la
> valeur. **C'est la seule condition qui partage C5 de C6** »*

[cité] `docs/adr/0007-l-apparence.md:206`, décision 12 de C5 :

> *« Aucune cascade, aucun défaut de document, aucun `z.default()`, **aucune expression de
> style** »*

Et son motif, [cité] `docs/adr/0007-l-apparence.md:1040` : « *Pourquoi aucune expression de
style — et c'est **une condition de validité**, pas une remarque.* » ; puis `:1061` : « *(d) **Une
expression de style** : condition 1, plus les quatre trous* ».

### La lecture qui fait croire à une contradiction

Elle est naturelle : la condition 1 **range** le formatage conditionnel « en C6 », et la
décision 12 **refuse** l'expression de style. Or « en rouge si échu » **est** une expression de
style. C6 hériterait donc d'une promesse que le lot qui la lègue déclare impossible.

### Pourquoi ce n'en est pas une — **la condition 1 n'attribue pas, elle écarte**

Le tableau de `docs/adr/0007-l-apparence.md:120-127` s'intitule [cité] « *Ce que chaque condition
écarte **SEULE** — sinon elle est décorative* ». Sa colonne n'est pas « qui possède », c'est
« **ce que cette condition suffit à sortir de C5** ». Le formatage conditionnel y figure comme
**exemple de ce que la condition 1 tue** — parce qu'il **lit le contenu** — au même titre que
« une couleur dérivée du type de la valeur », qui n'est attribuée à personne.

**Trois vérifications qui ferment le point :**

1. **La ligne ne dit pas « C6 possède ».** Elle dit « tout C6 » comme un **raccourci de famille**
   pour « ce qui dépend du contenu », et elle énumère dans la même virgule des objets dont l'un
   est **explicitement refusé pour tout le produit** — un style dérivé d'une clé de données,
   `docs/adr/0007-l-apparence.md:1478` : « *refusé pour **tout le produit*** ». Une liste dont un
   membre est refusé partout n'est pas une liste d'attributions [déduit].
2. **La décision 12 est une condition de validité, pas une préférence** (`:1040`). Une décision
   de validité ne se contourne pas par un autre lot : si C6 livrait `if(échu, rouge, noir)`, il
   **rouvrirait la décision 12 de C5**, exactement comme une table de devises aurait rouvert
   l'arbitrage n° 1 de C3 (ligne A-13 du registre). Le coût est le même : **rejouer, pas
   amender.**
3. **Le dépôt fournit le garde-fou de méthode, et il vise ce cas précis.** [cité]
   `docs/adr/0007-l-apparence.md:239-241` interdit de réutiliser le critère de l'ADR 0004 D10
   comme test général, parce que « *pris pour un test général, il range la police, **la
   couleur** et le filet en C6* ». **Le formatage conditionnel est précisément la couleur.**
   S'en réclamer serait commettre l'erreur que le signalement K nomme.

### ⛔ Décision, à porter dans le §7 du plan

> **Le formatage conditionnel n'est PAS une dette de C6, et C6 le décline explicitement.**
> Il n'y a **pas** de contradiction entre `docs/adr/0007-l-apparence.md:125` et la décision 12 de
> C5 : la condition 1 **écarte** de C5, elle n'**attribue** pas à C6. Le lot C6 ne livre donc
> aucune expression de style, aucune couleur, aucun `if` dont la sortie serait un attribut
> d'apparence — et son contrat n'a **aucun champ** dont la valeur soit un attribut visuel
> [vérifié : `Presentation` porte `locale`, `currency`, `minFractionDigits`, `maxFractionDigits`,
> `dateStyle`, et rien d'autre].

**Héritier, nommé :** **lot C5** en est propriétaire *par refus* — la décision 12 est « une
condition de validité », et seul C5 peut la lever. Toute réouverture passe donc par **une
nouvelle ADR de C5** et par **le propriétaire du produit**, jamais par C6.

*Signal de réouverture :* une demande d'intégrateur pour laquelle le contournement documenté ne
suffit pas. **Le contournement existe et il est entier** : deux `TextNode` frères sous un
`ConditionNode`, chacun portant son propre `Typography` — le contenu conditionne la **branche**,
jamais l'attribut. Ce chemin ne demande **aucun champ nouveau** et il est disponible depuis
C1 + C5 [déduit, de l'existence de `ConditionNode` (`packages/core/src/ast/types.ts:212`) et d'un `Typography` porté
par `TextNode`].

---

## 7.2 Ce que ce lot n'est pas — par familles, avec le lot propriétaire de chaque refus

**Forme.** Celle que C5 a établie et que l'ADR 0007 porte à `:1470-1500` : *le refus · le motif ·
la source · le propriétaire · le signal de réouverture*. Un refus sans propriétaire est une
faute ; un refus sans signal est un mur.

**Distinction tenue partout, parce que C2 l'a établie** (`docs/adr/0004-…:815-817`) : un refus
**par périmètre** ne se rouvre que par un arbitrage produit ; un refus **par difficulté** se
rouvre par une mesure. Chaque ligne dit laquelle des deux elle est.

---

### F0 — Ce que le lot ne PROMET pas : la conformité, et donc la moitié forte de « corrects »

> C'est la famille à écrire **en premier**, parce qu'elle désamorce la lecture la plus flatteuse
> du critère de recette.

Le critère dit [cité] `docs/roadmap/core.md:261-262` : « *un unique modèle de facture produit
deux documents **corrects** dans deux langues et deux devises, sans duplication du modèle* ».
**« Corrects » n'est défini nulle part**, et son sens fort — *conforme* — est **attribué à
quelqu'un d'autre par le même document** : [cité] `docs/roadmap/core.md:49`, dans le tableau
d'arbitrage intitulé « *la capacité est à nous, la responsabilité est à l'intégrateur* » (`:34`) :

> *« | La **conformité** du document produit — facture, relevé, contrat ou tout autre |
> **L'intégrateur.** Énoncé sans détour dans le README et la documentation |* »

| Le refus | Motif | Source | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **La conformité** du document produit — mentions obligatoires, bloc d'adresse, *sales tax* contre TVA | Périmètre. Une facture américaine ne diffère pas d'une française que par les **mots** ; le critère est satisfait *à la lettre* par une facture française **en mots anglais**, et le lot ne prétend pas davantage | `docs/roadmap/core.md:34`, `:49` ; `README.md:132` | **L'intégrateur** | aucun — c'est un **non permanent** |
| Toute **règle fiscale ou légale** : taux, régime, barème, arrondi « légal » | Périmètre, décision 16 | `docs/roadmap/README.md:132` | **L'intégrateur** | aucun |
| Un **jugement sur la justesse** d'une écriture déclarée (« deux décimales, est-ce le bon nombre pour cette devise ? ») | Périmètre : ce serait détenir un référentiel. Le contrat valide la **forme** (`^[A-Z]{3}$`, bornes dans `[0, 15]`, `min ≤ max`), jamais le **sens** | D-08 ; `docs/roadmap/README.md:125` (« *aucun référentiel … détenu* ») | **L'auteur du modèle**, puis l'intégrateur | mesure : un intégrateur qui démontre qu'une écriture mal déclarée passe en production sans être vue — la réponse serait un **avertissement de Designer**, jamais un refus de schéma |

---

### F1 — Ce qui appartient à la DONNÉE et à l'INTÉGRATEUR

| Le refus | Motif | Source | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **La conversion de devise** — « *afficher « $ » n'est pas convertir des euros en dollars* » | Périmètre, **écrit dans la roadmap de C6 elle-même** : « *un taux de change est une donnée, et son choix appartient à l'intégrateur — même règle que la TVA* » | `docs/roadmap/core.md:266-268` ; doublé `:343-345` et `docs/roadmap/README.md:59` (décision 16) et `:132` | **L'intégrateur** (le taux est une donnée) | aucun — **non permanent** |
| **La table ISO 4217** devise → unité mineure | Périmètre, et **c'est un arrondi** : mesuré, la table CLDR fait passer `1234.5678` à `1235` en JPY et `1234,568` en TND. Elle n'est donc pas refusée par la liste close de `README.md:132` (qui n'a **pas** à être amendée) mais par la **décision 16** du même fichier — « les arrondis sont déclarés par le modèle ». **Conséquence directe : les deux bornes de fraction sont TOUJOURS explicites**, ce qui rend la table ICU **inatteignable** | D-04, D-08 ; `docs/adr/0004-…:653-659` (« *Le classement appartient à C6, qui l'instruira* ») | **C6 l'instruit ici, et le classe** ; l'échelle réelle appartient à **l'auteur du modèle** | arbitrage produit : le jour où un intégrateur exige la table CLDR par défaut plutôt qu'une déclaration. ⚠️ Coût : rouvrirait l'**arbitrage n° 1 de C3**, dont le contrat serait « *à rejouer, pas à amender* » (`docs/plans/c3-…:5127`) |
| Toute **liste close** de locales ou de devises détenue par Openview | Périmètre : ce serait détenir un référentiel. Mesuré : le prédicat **structurel** refuse les 6 tags dangereux **et accepte 22 tags légitimes qu'un tuple clos refusait** (`de-DE`, `br-FR`, `es-419`, `zh-Hans-CN`…), identiquement sous ICU 76.1 et 77.1 | D-06, D-08 ; `docs/roadmap/README.md:125` | **Personne — l'objet n'existe pas** | aucun ; toute réouverture serait une **régression de périmètre** |
| Un **catalogue de messages**, une **table de traductions** référencée par clé | Périmètre **et** coût. Périmètre : un catalogue **réserve des noms de clés** (`AGENTS.md:18-32`). Coût : ce serait une seconde position de contenu (A-10, payée trois fois), plus un refus de référence pendante à écrire, narrer et tester — le coût que la décision 15 de C5 a déjà chiffré contre la table de styles nommés | `docs/adr/0007-l-apparence.md:1626-1629` ; A-10 | **Personne — remplacé par un mécanisme livré** : le `if` de **C1** | aucun. Le `if` fait **plus** qu'une table : il **réordonne** (`Facture n° 14 — ACME` contre `ACME — Invoice no. 14`) |
| La **traduction automatique**, ou toute connaissance de ce que les mots veulent dire | Périmètre : Openview ne détient aucun contenu et n'appelle aucun service. « *Il reçoit un jeu de données, il ne va rien chercher.* » | `docs/roadmap/README.md:125` ; `AGENTS.md:18-32` | **L'auteur du modèle** (il écrit les deux branches du `if`) | aucun — **non permanent** |
| Une **clé réservée** dans le jeu de données ou dans la portée (`data.locale`, `{ devise }` injecté) | Périmètre, et c'est « *irréversible au sens fort* ». Deux défauts mesurables déjà écrits : la donnée de l'intégrateur est **masquée** selon l'ordre du spread, et `collectDataPaths` **réclamerait à l'appelant une clé qu'il n'a jamais fournie** | `docs/adr/0006-la-page.md:958-962`, `:574-581` ; `AGENTS.md:31-32` | **Personne** | aucun |
| Un **format dérivé d'une clé de données** (« tout champ nommé `montant` en euros ») | Périmètre : obligerait l'intégrateur à nommer un champ comme Openview l'a décidé. Le symétrique en apparence est « *refusé pour **tout le produit*** » | `docs/adr/0007-l-apparence.md:1478` ; `AGENTS.md:31-32` | **Personne** | aucun |

---

### F2 — Ce qui appartient au MOTEUR (`@openview/engine`)

> La coupe est déjà écrite, et il faut la citer plutôt que la reformuler — [cité]
> `docs/roadmap/engine.md:78-79` : « *Le contrat sait **décrire** un modèle bilingue (core C6) ;
> le moteur doit **l'honorer**.* » **`core` ne rend rien.**

| Le refus | Motif | Source / attente | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **Le rendu** — produire une facture, la paginer, l'exporter | Périmètre de paquet. `core` porte des contrats, pas un pipeline | `AGENTS.md` §2 ; `docs/roadmap/engine.md:78-79` | **lots E1…E6** | aucun |
| **Choisir les SITES** : quelle valeur d'un document s'écrit avec quelle fonction | Mécanique, pas un oubli. Le contrat ne distingue pas un numéro de commande d'un total, **et ne le doit pas** — ce serait un nom de champ réservé | **attente E4-1** | **lot E4**, avec arbitrage du **propriétaire du produit** s'il faut ouvrir un champ optionnel de segment | E4 devant une vraie facture. Remède chiffré : **un champ optionnel de segment**, classe *perte silencieuse* → **une estampille**. ⚠️ Le kind `format` reste refusé : **irréversible**, et zéro instance mesurée |
| **Arrondir puis formater** — l'ordre des deux opérations | Le contrat ne voit pas l'expression au moment de formater. Mesuré : formater seul contredit un `halfEven` déclaré sur **4,9275 %** d'une famille monétaire de 200 000 tirages ; **0,0000 %** avec `halfExpand`. ⛔ **Et c'est une précondition INVÉRIFIABLE (R-18) :** rien ne garantit qu'un site contienne une expression `round`, ni que ses décimales égalent `maxFractionDigits`, ni que son mode ait déjà été appliqué. Un `path('montant')` **nu** est arrondi par ICU en `halfExpand` **sans que personne l'ait déclaré** — et ADR 0004 décision 16 donne l'arrondi au **modèle**. Le lot livre donc une obligation que ni une porte, ni un test, ni même une revue de modèle ne peut contrôler | **attente E4-2** | **lot E4** | vérifiable à E4, sur une facture déclarant `halfEven`. ⚠️ **Le remède structurel est A-5** : un site qui **nomme** son écriture peut voir sa précondition écrite comme un invariant (« *ce site déclare `montant-fr`, dont `maxFractionDigits` vaut 2 ; l'expression qui l'alimente arrondit-elle à 2 ?* »). Sans le lien déclaratif, il n'y a **rien à vérifier** |
| **La politique de la valeur absente** — blanc ou échec de rendu | C'est la **question 2 de l'ADR 0001**, ouverte depuis le premier lot, et elle est du moteur (`DataBindingStep`). C6 tranche la **moitié** qui lui revient (la mise en chaîne) et **nomme** les deux causes d'`undefined` au lieu de les confondre | `docs/adr/0001-expression-language.md:186-195` ; `docs/adr/0003-…:878-880` ; **attente E4-8** | **lots E3 et E4** | l'existence de `DataBindingStep` |
| **Résoudre chaque écriture au plus une fois par rendu** | Performance, et c'est une **attente**, pas une garantie du contrat : `resolvePresentation` canonicalise et construit deux formateurs de contrôle, donc l'appeler **par valeur** paie ce coût 620 fois pour rien. ⚠️ **Reformulé (R-07)** : « *l'écriture, une fois par rendu* » se lisait « *une seule écriture par rendu* », ce que la cardinalité du [§2.0] contredit — montants, quantités et prix unitaires sont **trois** écritures **dans le même rendu** | **attente E4-3** | **lot E4** | mesure de rendu |
| 🆕 **Tenir cohérents les deux commutateurs** — les mots par un `if` de données, les valeurs par un nom d'écriture | Deux canaux **indépendants par conception** ([D-02] pour l'un, C1 pour l'autre). Aucune porte d'Openview ne voit `rendu.langue = 'fr'` avec l'écriture `en-usd` : le parse accepte les deux séparément, le rendu réussit les deux. Les coudre ferait d'Openview l'arbitre de « ces deux déclarations se contredisent », c'est-à-dire d'une **règle métier** — et interdirait `en-FR`, le document que [A-1] défend | **attente E4-11** ; **A-6** | **lot E4** + **intégrateur** ; avertissement au **Designer** (D1/D5) | une facture livrée à libellés français et montants en dollars |
| **D'où vient la clé d'écriture** | C'est un **argument**. `RenderRequest` n'a pas de troisième champ et n'en aura pas ; le moteur la reçoit de son propre appelant | `packages/core/src/ports/render.ts:23-29` ; **attente E4-4** | **lot E4** et **l'intégrateur** | aucun — la docstring dit « *on purpose* » |
| Une **table de secours** pour une devise inconnue | Mesuré : « `1 234,50 ZZZ` ». Il n'existe aucun repli d'environnement monétaire, et **aucune unité mineure n'est héritée** puisque les deux bornes sont déclarées | **attente E4-5** | **lot E4** | aucun |
| **Normaliser les espaces**, ou figer une chaîne formatée dans un test | Mesuré : `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0** avant le symbole, et U+202F est arrivé avec **CLDR 42 / ICU 72**. La CI tourne sur `node: [24, 26]` (`.github/workflows/ci.yml:59`), donc **deux jeux CLDR** | **attente E4-6** | **lot E4** (rendu), **E2/E5** (mise en page), **la QA** (tests d'or) | montée de Node en CI |
| **Garantir que l'aperçu égale le PDF** | Un navigateur et Node ne portent pas nécessairement la même version de CLDR : la promesse J4 devient une contrainte de **version d'ICU**, pas seulement de mise en page | **attente E4-9** | **les lots `viewer` et E5** | la première divergence observée |

---

### F3 — L'ENVIRONNEMENT : ce que le lot refuse de lire, y compris pour lui-même

| Le refus | Motif | Source | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **L'horloge, le fuseau, la locale système** | Périmètre, **non permanent**, et c'est « *ce qui rend possible le déterminisme du lot E6* » | `docs/roadmap/README.md:127` ; `AGENTS.md:24-30` ; `docs/roadmap/core.md:103` | **lot E6** en est le bénéficiaire ; **personne** ne peut le lever | aucun |
| **Un fuseau horaire déclarable** | Le contrat n'en choisit pas : il **refuse d'en avoir un**. `timeZone: 'UTC'` est épinglé en littéral en ligne, exactement comme `AGENTS.md:76-79` l'autorise | D-09 ; `AGENTS.md:76-79` | **Personne** | aucun ; une date du contrat est `YYYY-MM-DD`, « *no time and no zone* » (`packages/core/src/expression/civil-date.ts:20-22`) |
| **Un calendrier déclarable** | `calendar: 'gregory'` est épinglé **en dur**. Mesuré : `fa-IR` rend **1405**, `th-TH` + `dateStyle: 'short'` rend `19/8/69`, `ja-JP-u-ca-japanese` rend 令和8 — et l'**option gagne contre l'étiquette `-u-ca-`**. Une date du contrat est **grégorienne proleptique** par définition (`civil-date.ts`) : la rendre dans un autre calendrier changerait la **valeur**, pas l'écriture | D-09, D-10 ; `docs/adr/0003-…:245` | **Personne** — refus par périmètre, pas par difficulté | aucun. C'est le seul des trois épinglages que D-10 **ne** propose **pas** de rouvrir |
| **Un système de chiffres déclarable**, aujourd'hui | `numberingSystem: 'latn'` est épinglé. Ce refus-ci est **par difficulté et par prudence**, pas par périmètre : il touche `NumberFormat`, donc **les montants** (`ar-EG` → `١٬٢٣٤٫٥٠`) | D-09, **D-10** | **Le propriétaire du produit** | ⚠️ **explicitement nommé** : une facture en arabe ou en persan. Remède : un **champ optionnel** sur l'écriture, classe *perte silencieuse* → **une estampille**. C'est le **mandat M-4** (§7.4) |
| **Toute lecture d'`Intl` sans locale explicite** | Outillé, et le lot n'y déroge pas : zéro diagnostic Biome sur dix fichiers, **tests compris**, **zéro `biome-ignore`** [mesuré, Biome 2.5.8, réplique identique de `biome.jsonc` + `tools/biome/*.grit`, diff vide] | `AGENTS.md:49`, `:76-79` ; D-06 | **Personne** | aucun |

---

### F4 — Ce qui appartient à d'AUTRES LOTS du contrat

| Le refus | Motif | Source | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **Le formatage conditionnel** (« en rouge si échu »), et toute couleur dérivée du contenu | Ce n'est **pas** une dette de C6 : la condition 1 **écarte** de C5, elle n'**attribue** pas. Et la décision 12 de C5 est « *une condition de validité, pas une remarque* » | `docs/adr/0007-l-apparence.md:206`, `:1040`, `:1061` ; démonstration en **7.1.c** | **lot C5** (par refus) — réouverture par **une nouvelle ADR de C5** et le propriétaire du produit | une demande pour laquelle le contournement ne suffit pas. **Contournement entier et disponible** : deux `TextNode` frères sous un `ConditionNode`, chacun avec son `Typography` |
| **Tout champ d'apparence** — police, couleur, filet, espacement, alignement | Périmètre de C5, symétrique exact d'A-12 : C5 n'a pas préempté C6, C6 ne préempte pas C5 | `docs/adr/0007-l-apparence.md:1610-1612` | **lot C5** (livré) | aucun |
| **Un type de colonne** (« monétaire », « nombre », « date »), tout format sur `TableColumn` ou `TableNode` | Périmètre, déjà refusé par C3 en **nommant C6**. Et le lot **évite le piège** : aucune table de devises n'entre (D-08), donc l'arbitrage n° 1 de C3 **ne se rouvre pas** | `packages/core/src/ast/types.ts:545-546` ; `docs/plans/c3-…:531-532`, `:1597` | **lot C3** (livré) ; réouverture = **arbitrage produit**, coût « *rejouer, pas amender* » | une table de devises imposée par le produit |
| **Le marqueur de report de page** (le `field`) | Sa **valeur** est un montant, donc une échelle et un arrondi ; son **libellé** est déjà bilingue par le `if` de C1. C6 n'a donc rien à livrer | `docs/adr/0006-la-page.md:617-620` | **lot E3**, nommé sur place | E3, « *qui trouvera le mécanisme déjà là, en un `field` de plus* » |
| **Numéro de départ, remise à zéro, numérotation par section, chiffres romains** | « *les sections n'existent pas dans le contrat* » ; les chiffres romains suivent le sort de `numberingSystem` | `docs/adr/0006-la-page.md:955-957` | **Aucun lot planifié** → **arbitrage du propriétaire du produit** ; chiffres romains → **M-4** | un modèle livré avec une page de garde non numérotée (signal déjà écrit par C4, `docs/plans/c4-la-page.md:1701`) |
| **La direction d'écriture (RTL)** | **Promesse retirée** par l'ADR 0005, qui a corrigé un texte « *prêtant à C6 une compétence qu'aucun texte ne lui donne* ». La reprendre rejouerait l'erreur corrigée | `docs/adr/0005-le-tableau-de-lignes.md:273-282` ; mesure `docs/plans/c3-…:1143-1145` | tel qu'écrit : « *un lot non écrit … ou rien et un défaut de moteur* » (`docs/plans/c3-…:5236`) → **le propriétaire du produit** | une facture en hébreu ou en arabe commandée |
| **Le lien hypertexte** | Le prendre supposerait un porteur de contenu qui n'existe pas — c'est-à-dire la **seconde position de contenu** qu'A-10 interdit | `docs/adr/0007-l-apparence.md:1491` (classé « sans propriétaire ») | **lot E8** pour la cible sortante ; **le propriétaire du produit** pour le lot qui introduira le porteur | l'ajout d'un porteur d'URL — sa moitié « contenu » sera alors **déjà couverte** par le `if` de C1 |
| **Toute politique de coupe** (`keepTogether`) et le dimensionnement `auto` | Périmètre de C7 et de C5 condition 3 | `docs/adr/0007-l-apparence.md:127` | **lot C7** | aucun |

---

### F5 — Les refus de MÉTHODE : ce que le lot aurait pu écrire, et n'écrit pas

> Cette famille n'est pas décorative : chacune de ces lignes est une **forme que le dossier a
> réellement rédigée** dans une conception concurrente, et qui a été écartée sur mesure.

| Le refus | Motif | Source / décision | Propriétaire | Signal de réouverture |
| :--- | :--- | :--- | :--- | :--- |
| **Un kind d'expression `format`** | **La seule décision irréversible que ce lot pouvait prendre** : un kind élargit une union stockée, et une union élargie ne se rétrécit plus une fois qu'un client a enregistré. Refusé sur une **mesure**, pas sur un goût : `grep -c "concat(" apps/playground/src/App.tsx` → **0**, aucun `concat` n'enfouit une valeur à formater dans le seul consommateur réel. **Refuser est donc gratuit** | D-11 ; `d0-avocat-du-diable.md` | **lot E4** (via E4-1), et **jamais** par ce chemin | aucun — le remède retenu est le champ de segment, **une estampille**, pas un kind |
| **Un champ de format sur un segment**, aujourd'hui | Reporté, pas refusé : classe *perte silencieuse*, donc **une estampille** le jour où E4 le prouve devant une vraie facture. Le livrer maintenant serait décider sans le consommateur | attente E4-1 | **lot E4** + **arbitrage produit** | E4 |
| **Un troisième champ sur `RenderRequest`** (locale, devise, écriture) | Contredirait une docstring **publiée** qui écrit « *There is no third field **on purpose*** » — et sa moitié affirmative attribue déjà la déclaration au modèle | `packages/core/src/ports/render.ts:23-29` ; D-01, D-02 | **Personne** | aucun |
| **Un `EvaluationOptions.presentation`** | Serait le « troisième entrant d'évaluation » que `packages/core/src/ast/types.ts:67-71` déclare **publiquement** que `core` ne prend pas : « *`core` gains no third evaluation input, no page-aware operand and no reserved key in the caller's data* » | `packages/core/src/ast/types.ts:67-71` | **Personne** | aucun |
| **Un Port d'i18n** (`TranslationPort`, `LocaleProvider`, `FormatterRegistry`) | La règle anti-sur-ingénierie le **nomme** : « *Un port pour le logging, les polices ou **l'i18n** ne se justifie pas.* » Aucun second adaptateur n'existe ni n'est planifié à trois mois. C5 a déjà posé le précédent en refusant un port de polices avec cette même phrase | `AGENTS.md:306-318` (`:316`) ; précédent `docs/plans/c5-l-apparence.md:1154` | **Personne** | un second adaptateur **réel** |
| **Un motif de date parsé** (`'dd/MM/yyyy'`) | « *c'est un parseur, avec son échappement et **sa surface d'injection*** » — refusé **deux fois**, dans deux lots, contre le même besoin. Remplacé par une **énumération fermée** de quatre styles ECMA-402, cohérente avec le choix de C2 (« deux modes au vocabulaire ECMA-402 ») | `docs/adr/0006-la-page.md:953-954` ; `docs/adr/0007-l-apparence.md:1493` ; `docs/adr/0003-…:867` | **Personne** — refus **pour tout le produit** | aucun ; un besoin de motif se traite par un cinquième style nommé, non par un parseur |
| **`scaleOf` / `declaredScaleOf`** | **X-1 est dissous, pas contourné** : le maximum est **déclaré**, jamais dérivé de la forme binaire d'une valeur — sans quoi `63.260000000000005` sortirait avec 17 décimales, sur la valeur même que l'ADR 0004 avait mesurée comme **sauvée** par ICU. Bénéfice : le seuil d'`AGENTS.md:265-275` (un **troisième** parcours de l'algèbre) n'est **pas franchi** — `git grep -c "case 'round':" -- packages` rend **2** [mesuré] | D-05 ; `docs/adr/0004-…:677-679` ; `AGENTS.md:265-275` | **Personne** | l'apparition d'un troisième parcours par **une autre cause** ; ce jour-là, le Visitor d'expressions devient obligatoire |
| **Un code d'erreur nouveau** | C4 et C5 ont tenu la ligne, C6 la tient. `SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` et `LIMIT_ERROR_CODES` sont **inchangés** ; les deux prédicats d'objet produisent `code: 'custom'`, qui n'est entrée d'aucun catalogue | D-11 | **lot C8** (qui hérite des messages) | aucun |
| **Un `.check` sur `TemplateSchema`** | L'argument de coût de la décision 15 de C5 — « *un `superRefine` sur `TemplateSchema` — **le premier de ce fichier*** » — **reste vrai**, et le lot ne le consomme pas : ses deux prédicats vivent sur `PresentationSchema` et `PresentationTableSchema`. [vérifié] `packages/core/src/template/template.ts` ne contient **aucun** `.check` ni `.refine` à HEAD | `docs/adr/0007-l-apparence.md:1626-1629`, `:1767` | **lot C5** (le coût qu'il a chiffré reste disponible pour lui) | aucun |
| **Un `biome-ignore`** | ⛔ **Mesuré : aucune des cinq orthographes ne supprime un diagnostic de PLUGIN en Biome 2.5.8.** L'échappatoire qu'`AGENTS.md:103` semble offrir **n'existe pas** pour les `.grit`. Toute forme refusée est **réécrite**, jamais annotée — y compris dans les tests | `AGENTS.md:68-75` ; `v2-outillage.md` | **Personne** | aucun ; une montée de Biome ne rouvrirait que la **sonde jetable** de l'ADR 0003 |
| **`toFixed`** pour mettre un nombre en chaîne | Mesuré : diverge de `Intl` **et** de `roundDecimal` sur **1,2064 %** de 1 000 000 de tirages (il arrondit le binaire exact ; les deux autres arrondissent la forme décimale courte via `toExponential`). `Intl` ≡ `roundDecimal` : **0,0000 %** de divergence | `m1-mesures.md` | **Personne** | aucun |
| **Un `roundingMode` passé à ICU** | Le mode de départage est déjà **déclaré par le modèle** au nœud `round` (C2). Le repasser à `Intl` créerait une **seconde source** pour le même fait | D-20 | **lot C2** (livré) | aucun |
| **Un objet `Date` construit** | Le constructeur `Date` est banni à **toute arité** dans `core`. `formatDate` convertit par `dayNumberOf(value) * 86 400 000` et passe le **nombre** à `Intl.DateTimeFormat.prototype.format` | D-21 ; `AGENTS.md:49` | **Personne** | aucun |
| **Une porte bornée propre** au dossier `presentation/` | Une écriture n'est jamais un fragment autonome : elle vit sur un `Template`, et `parseTemplate` la valide déjà. Ajouter une sixième porte bornée serait exactement le coût que la décision 15 de C5 a refusé de payer | `docs/adr/0007-l-apparence.md:1626-1629` | **Personne** | un consommateur qui manipulerait une écriture **hors** d'un `Template` |
| **Exporter `wellFormedLocale` ou `honouredLocale`** du barrel (⚠️ **deux** prédicats depuis la scission de D-06 ; `declarableLocale` **n'existe plus**, R-04) | Aucun consommateur hors paquet ne les nomme, et **toute porte qui atteint `Intl` passe déjà par l'un des deux** (le schéma au parse, le résolveur au rendu). Précédents : `prefixPath`, `aliasSchema` | D-12 | **Personne** | un consommateur externe réel — ⚠️ ou l'adoption d'**A-7**, qui déplacerait la question |

---

## 7.3 Les corrections du dépôt que ce lot porte

**Précédent.** C5 en a porté **huit** (`docs/adr/0007-l-apparence.md:1394-1420`, décision 17),
C4 avait posé le précédent d'exécution avec le commit `366c28a`. Un lot en porte
traditionnellement quelques-unes. **Chaque ligne ci-dessous a été revérifiée dans le dépôt à HEAD
`320bea6`** — y compris celles que le dossier annonçait, dont **une s'est révélée fausse**.

**Doctrine qui gouverne le geste**, et qui décide *avant* le contenu :

- [cité] `docs/adr/0005-le-tableau-de-lignes.md:806` : « *Une ADR est un **journal**, et un lot ne
  réécrit pas les documents d'un autre.* »
- [cité] `docs/adr/0007-l-apparence.md:1741` (signalement B) : « *Un lot ne réécrit pas le
  document d'un autre. C5 **recompte toutes ses propres citations**.* » — **c'est le minimum
  obligatoire.**
- L'exception, C5 D17 : on réécrit le document d'un autre **quand on est le lot mal nommé**.
  ⚠️ **C6 est, plus littéralement encore que C5 ne l'était, le lot dont les citations sont
  fausses** : les cinq citations `core.md:229` désignent **sa** ligne de dépendance, et l'ADR 0007
  les a écrites **en le nommant**.

---

### R-1 — ⛔ Les dix-neuf citations `core.md:NNN` qui désignent C6 sont **TOUTES** périmées

C'est la plus étendue, et **deux ADR qui font foi** en sont porteuses.

**[mesuré]** — `git grep -n "core\.md:186\|core\.md:196\|core\.md:198\|core\.md:229" -- docs` ;
puis lecture de chaque cible dans `docs/roadmap/core.md`.

**Où C6 vit réellement à HEAD** [mesuré, `grep -n "^### C[0-9]\|^\*\*Poids :\*\*" docs/roadmap/core.md`] :

| Ce qui est désigné | Ligne réelle |
| :--- | :--- |
| `### C6. Langue, devise et formats` | **`core.md:254`** |
| Le « Pourquoi » — les **cinq objets** du périmètre | **`core.md:256-259`** |
| Le « Prêt quand » — le critère de recette | **`core.md:261-262`** |
| `**Poids :** L — **Dépend de :** C2, C5` | **`core.md:264`** |
| L'interdit de conversion | **`core.md:266-268`** |
| La section C6 entière | **`core.md:254-268`** |

**Les dix-neuf occurrences, et la substitution exacte :**

| Avant (figé) | Après (HEAD `320bea6`) | Occurrences | Fichier |
| :--- | :--- | :--- | :--- |
| `core.md:186-196` (« le périmètre de C6 ») | **`core.md:256-259`** | 8 | `docs/adr/0005-…:282`, `:810` ; `docs/plans/c3-…:105`, `:1143`, `:3833`, `:3897`, `:5015`, `:5223` |
| `core.md:186-200` (la section C6) | **`core.md:254-268`** | 3 | `docs/plans/c3-…:332` et sa table des matières `:261` ; `docs/plans/c4-…:254` |
| `core.md:196` (« C6 — Dépend de : C2, C5 ») | **`core.md:264`** | 1 | `docs/plans/c3-…:385` |
| `core.md:198-212` (« le format du n° de page est C6 ») | **`core.md:256-259`** | 2 | `docs/plans/c4-…:219`, `:1701` |
| `core.md:229` (« Poids : L — Dépend de : C2, C5 ») | **`core.md:264`** | 5 | **`docs/adr/0007-l-apparence.md:11`, `:1401`** ; `docs/plans/c5-…:315`, `:1929`, `:4931` |

**Ce que désignent aujourd'hui les lignes figées** [mesuré] : `core.md:186` ouvre la note
« ✅ **Livré** » de **C4** ; `core.md:196` et `:198` sont **au milieu de cette note** ;
`core.md:229` est **au milieu de la note « ✅ Livré » de C5**. Aucune ne dit plus rien de C6.

⚠️ **Et le chiffre du signalement B de C5 est lui-même périmé** : il annonçait « *décalées de
**31 lignes*** » (`docs/adr/0007-l-apparence.md:1741`) ; le décalage réel est de **+70 lignes**
depuis `:186` (→ `:256`) et de **+35 lignes** depuis `:229` (→ `:264`) [mesuré]. La livraison de
C5 a **aggravé** le décalage au moment même où elle le signalait.

#### ➡️ Ce que le lot C6 fait, et ce qu'il ne fait pas

| Geste | Portée | Mandat ? |
| :--- | :--- | :--- |
| **1. Recompter toutes ses propres citations** — le plan C6 et son ADR ne citent que `core.md:254`, `:256-259`, `:261-262`, `:264`, `:266-268` | obligatoire | **aucun** — c'est le geste de C5, signalement B |
| **2. Corriger les QUATRE occurrences des deux ADR qui font foi** : `docs/adr/0005-…:282`, `:810` ; `docs/adr/0007-l-apparence.md:11`, `:1401` | recommandé | ⚠️ **mandat de doctrine — voir M-6.** Ce n'est pas AGENTS.md §7 (les `docs/adr/*` n'y figurent pas) mais la règle « *une ADR est un journal* ». L'argument D17 s'applique **mot pour mot** : C6 est le lot mal cité. **Sûreté vérifiée :** corriger le pointeur de `docs/adr/0005-…:810` **ne retire pas** la chaîne `core C5` de la ligne, donc la sonde 7 de l'ADR 0007 reste verte [vérifié] |
| **3. NE PAS corriger les quinze occurrences des trois plans** (`c3`, `c4`, `c5`) | refus | aucun — les trois plans se déclarent **périssables** dans leur propre en-tête — « *une fois le lot livré, il ne fait plus foi, et c'est l'ADR qui reste* » [vérifié]. Les corriger serait réécrire le journal d'un autre sans en tirer de bénéfice |
| **4. NE PAS toucher `docs/roadmap/core.md`** | refus | aucun — le fichier est juste ; ce sont les **citations** qui sont fausses |

**Option écartée, mais qui doit être nommée** (elle traite la cause) : remplacer les numéros de
ligne par des **ancres de titre** — `core.md#c6-langue-devise-et-formats`. **Aucun texte du dépôt
ne le propose**, et — ⛔ **seconde correction du dossier** — le précédent que `r2-doctrine-adr.md`
lui prêtait **n'existe pas** : [mesuré] `grep -n "](#" docs/roadmap/core.md` et
`grep -rn "](#c[0-9]" docs/roadmap/` rendent **zéro ligne** ; il n'y a **aucune ancre de titre
dans toute la roadmap**. L'option reste défendable, mais elle serait une **première**, elle
toucherait des documents qui font foi, et elle **dépasse le périmètre d'un lot** : arbitrage ⛔
**(M-6)**.

---

### R-2 — La **sonde 7 du plan C5** rend cinq lignes au lieu de zéro ; celle de l'ADR est juste

**Avant** [cité] `docs/plans/c5-l-apparence.md:6056` :

```
| 7 | `git grep -n "core C5" -- docs/roadmap docs/adr` | **zéro ligne** |
    `git grep -n "C6" -- docs/roadmap/engine.md` **doit** rendre au moins une ligne |
```

**[mesuré]**, à HEAD `320bea6`, cette commande rend **CINQ lignes**, pas zéro :

```
docs/adr/0005-le-tableau-de-lignes.md:810
docs/adr/0007-l-apparence.md:1400
docs/adr/0007-l-apparence.md:1418
docs/adr/0007-l-apparence.md:1680
docs/adr/0007-l-apparence.md:1699
```

**Après** — la forme juste existe déjà, et c'est **l'ADR 0007 qui la porte** [cité]
`docs/adr/0007-l-apparence.md:1680` :

```
| 7 | `git grep -n "core C5" -- docs/roadmap` | **zéro** — l'**attribution** vit dans la
    roadmap | la même sur `docs/adr` **doit** rendre une ligne : l'ADR 0005 **signale** la
    faute, elle ne la commet pas, et un lot ne réécrit pas le journal d'un autre |
```

**[mesuré]** : `git grep -n "core C5" -- docs/roadmap` rend **zéro ligne, exit 1**. La sonde de
l'ADR est **verte**.

#### ➡️ Geste de C6 : **relever, ne pas corriger, et surtout ne pas recopier**

Le plan C5 est **périssable par son propre en-tête** — [cité] `docs/plans/c5-l-apparence.md:6` :
« *une fois le lot livré, il ne fait plus foi, et c'est l'**ADR 0007** qui reste* ». Le corriger n'apporterait rien et réécrirait le document d'un autre. **Ce qui compte,
c'est la conséquence de méthode pour C6 :**

> **Le plan C6 puise ses gabarits de sonde dans `docs/adr/0007-l-apparence.md:1670-1690`, jamais
> dans `docs/plans/c5-l-apparence.md:6047-6070`.** Une sonde recopiée d'un plan périmé naît
> rouge.

**Mandat : aucun.** C'est un relevé, pas une édition.

---

### R-3 — L'ADR 0005 présente comme « non corrigée » une contradiction qui l'est

**Avant** [cité] `docs/adr/0005-le-tableau-de-lignes.md:804` :

> *« ## Trois contradictions constatées dans le dépôt, **nommées et non corrigées** »*

dont la première ligne est « *Le modèle bilingue attribué à « core C5 » | `docs/roadmap/engine.md:79`* ».

**[mesuré]** — elle **est** corrigée : `docs/roadmap/engine.md:78-79` écrit aujourd'hui « *Le
contrat sait décrire un modèle bilingue (**core C6**) ; le moteur doit l'honorer* », et
`git grep -n "core C5" -- docs/roadmap` rend zéro ligne. Le titre de section est donc **faux d'un
tiers**.

**Après — recommandation : NE PAS ÉDITER, MENTIONNER.**

- « *Une ADR est un journal* » (`docs/adr/0005-…:806`), et la **contre-épreuve** de la sonde 7 de
  l'ADR 0007 **exige que ce signalement reste** en place.
- Mais **C6 ne doit pas le re-relever comme ouvert**, et doit dire pourquoi il ne le corrige pas.
- *Distinction utile, et elle est fine :* la sonde de l'ADR 0007 protège **la présence de la
  chaîne**, pas la **justesse du titre de section**.

**Mandat : aucun** (aucune édition n'est proposée).

---

### R-4 — ⛔ **CORRECTION DU DOSSIER, PAS DU DÉPÔT** : le relevé « `superRefine` a disparu » est **FAUX**

Le dossier (`r2-doctrine-adr.md`, relevé E-5) affirme : « *`git grep -n "superRefine" -- packages`
rend **zéro ligne** : il n'existe plus aucun `superRefine` dans le code du dépôt* ».

**[mesuré]** à HEAD `320bea6` — `git grep -n "superRefine" -- packages` rend **DIX lignes dans SIX
fichiers**, dont **trois sites d'appel réels** :

```
packages/core/src/ast/schemas.ts:359    .check(z.superRefine(checkTableWiring));
packages/core/src/page/schemas.ts:162   .check(z.superRefine(checkBandsCannotOverlap));
packages/core/src/page/schemas.ts:229     z.superRefine((page, ctx) => {
```

**Ce que le commit `bca73f6` a réellement retiré, c'est la MÉTHODE dépréciée `.superRefine(fn)`,
pas l'auxiliaire `z.superRefine(fn)`.** L'idiome adopté par le dépôt est
**`.check(z.superRefine(fn))`**, et il est vivant.

**Trois conséquences, et elles vont dans le sens inverse de ce que le dossier annonçait :**

1. **L'argument de coût de la décision 15 de C5 reste littéralement vrai.** [vérifié]
   `packages/core/src/template/template.ts` ne contient **aucun** `.check` ni `.refine` : un
   contrôle croisé sur `TemplateSchema` serait toujours « **le premier de ce fichier** »
   (`docs/adr/0007-l-apparence.md:1626-1629`, `:1767`). **Le plan C6 ne doit donc PAS écrire que
   cet argument a bougé.**
2. **Et le lot C6 ne le consomme pas** : ses deux prédicats vivent sur `PresentationSchema` et
   `PresentationTableSchema`, jamais sur `TemplateSchema` [vérifié dans le bac à sable,
   `presentation/schemas.ts:130` et `:183`]. Le coût chiffré par C5 **reste disponible pour C5**.
3. **Ce qui a bougé, c'est l'orthographe, et elle est déjà dans le dépôt.** Le plan C6 emploie
   `.check(...)` avec une charge utile, comme `ast/schemas.ts` et `page/schemas.ts`.

**Correction à porter : dans le plan C6, pas dans le dépôt.** Aucun fichier du dépôt n'est
fautif ici ; c'est un relevé du dossier qui l'était. **Mandat : aucun.**

---

### R-5 — Le poids « L » de C6 est probablement sous-estimé

**Avant** [vérifié] `docs/roadmap/core.md:264` : « **Poids :** L — **Dépend de :** C2, C5 ».

**Le faisceau** [déduit] : C3 coté **M** est sorti **L** ; C4 coté **M** est sorti **L**
(`docs/adr/0006-la-page.md:1088`) ; C5 coté **L** a produit 6 892 lignes de plan, 23 fichiers,
dix-huit décisions. C6 est coté **L** et hérite de **vingt promesses**, de **deux questions
ouvertes structurantes**, de la **contrainte d'outillage la plus serrée du dépôt**, et d'une
**estampille de schéma**.

**Après — recommandation : ANNONCER, NE PAS CORRIGER.** Précédent exact
(`docs/adr/0006-la-page.md:1088`) : « *Au propriétaire du produit de corriger la roadmap ou
d'assumer l'écart par écrit — **la roadmap n'est PAS corrigée ici**, ce serait rouvrir
l'ordonnancement de la vague 1 en passant.* » Et le geste de forme (`docs/adr/0005-…:814`) :
« *une réestimation de poids, **dite plutôt que laissée trouver*** ».

➡️ **Le §1 du plan C6 annonce XL et le dit ; `docs/roadmap/core.md:264` n'est pas touché.**
**Mandat : M-5** (au propriétaire du produit de corriger ou d'assumer par écrit).

---

### R-6 — Ce qui a été vérifié et n'appelle **aucune** correction

| Vérification | Résultat |
| :--- | :--- |
| `docs/roadmap/engine.md:79` dit bien « core **C6** » | ✅ [mesuré] — **la correction annoncée par C5 D17 n° 8 est effective. C6 ne la rejoue pas** |
| `git grep -n "core C5" -- docs/roadmap` | ✅ **zéro ligne, exit 1** [mesuré] |
| `docs/roadmap/core.md:264` dit bien « **Dépend de :** C2, C5 » | ✅ [mesuré] |
| Le périmètre de C6 énumère bien **cinq** objets | ✅ [mesuré] `core.md:256-259` — montants, dates, séparateurs de milliers, position du symbole monétaire, libellés fixes |
| `docs/roadmap/README.md:132` — la liste close | ✅ intacte, et **le lot ne demande pas de l'amender** (voir M-1) |
| `.github/pull_request_template.md:11-13` — les trois cases « Périmètre » | ✅ en place ; C2 a **explicitement refusé** d'en ajouter une quatrième pour C6 (`docs/plans/c2-…:2451`), et C6 ne la demande pas davantage |
| `packages/designer/DESIGN.md:158` — « ni format de nombre ni devise (C6) » | ✅ cohérent avec ce contrat |

**Et un relevé hors périmètre, signalé sans être pris** [mesuré] : `core.md:184` est cité **dix-sept
fois**, et il est **juste** quand il désigne C4 (« *Poids : M — Dépend de : rien* ») mais **faux**
quand il désigne « *C5 — Dépend de : C3* », qui vit aujourd'hui à **`core.md:217`**. Ce n'est ni le
périmètre ni la dépendance de C6 : **C6 le nomme et ne le corrige pas** — « un lot ne réécrit pas
le document d'un autre ».

---

## 7.4 Les mandats à demander — matière du §8 du plan

**Pourquoi ils sont listés ensemble.** Un mandat épars se perd. `AGENTS.md:371-390` (§7) nomme
les fichiers qu'on ne touche pas sans mandat explicite ; le dépôt a par ailleurs une seconde
catégorie, **non outillée** : les documents qui *font foi* (roadmap, ADR acceptées), qu'un lot ne
réécrit pas sans arbitrage. Les sept lignes ci-dessous relèvent de l'une ou de l'autre, et chacune
donne **le fichier**, **la phrase exacte** et **le motif**.

**Deux d'entre elles sont bloquantes** — M-2 et M-3 — au sens où le lot ne peut pas être déclaré
« fini » sans qu'elles soient tranchées. Les cinq autres sont des demandes.

| # | Fichier visé | Protégé par | Bloquant ? | Ce qui est demandé |
| :-- | :--- | :--- | :---: | :--- |
| **M-1** | `biome.jsonc:273` | **AGENTS.md §7** | non | préciser le message, sans en changer le sens |
| **M-2** | `docs/roadmap/core.md:261-262` | fait foi | **OUI** | trancher le critère de recette, que `core` ne peut pas démontrer seul |
| **M-3** | `docs/adr/0003-…:242` et `:783-784` | ADR acceptée | **OUI** | amender l'énoncé de déterminisme : ce contrat dépend d'ICU |
| **M-4** | *(aucun — décision produit)* | — | non | `numberingSystem` doit-il être déclarable ? |
| **M-5** | `docs/roadmap/core.md:264` | fait foi | non | corriger le poids **L → XL**, ou assumer l'écart par écrit |
| **M-6** | `docs/adr/0005-…:282`, `:810` ; `docs/adr/0007-…:11`, `:1401` | ADR acceptées | non | autoriser la correction de quatre citations qui désignent C6 |
| **M-7** | `docs/roadmap/engine.md:102-105` (E6) | fait foi | non | dire ce que « au caractère près » signifie face à deux versions d'ICU |

---

### M-1 — Le message de `biome.jsonc:273` — **recommandé, NON bloquant**, et la contradiction de D10 **ne se déclenche pas**

**La contradiction nommée par C2** [cité] `docs/adr/0004-les-arrondis-declares-par-le-modele.md:663-675` :

> *« Le dépôt a **déjà écrit** comment C6 formate, et il l'a écrit dans un fichier protégé par
> AGENTS.md §7 : `biome.jsonc`, entrée `toLocaleString` … **Une ADR de lot ne peut pas amender
> `biome.jsonc` par une phrase écrite ailleurs.** La contradiction est donc **nommée ici et
> laissée ouverte** : son amendement demande un **mandat explicite** (AGENTS.md §7) qui n'est pas
> dans le périmètre de C2. »*

Et [cité] `docs/adr/0004-…:814` : « ***L'amendement du message de `biome.jsonc`** (décision 10)
demande un mandat explicite et **reste à demander**.* »

#### ➡️ Instruction : le mandat **n'est pas déclenché**, et il faut dire pourquoi

Le mandat n'était requis que dans **un** cas : si C6 **classait la table décimale résolue par ICU
parmi les règles métier**, ce qui aurait contredit frontalement la phrase et aurait obligé à
amender **deux** fichiers (`biome.jsonc:273` **et** la liste close de `docs/roadmap/README.md:132`).

**Ce lot ne fait pas cela**, et la nuance est décisive :

1. **Il ne classe rien dans la liste close, et ne demande pas de l'amender.** La table CLDR
   devise → décimales est un **arrondi** (mesuré : `1234.5678` → `1235` en JPY, `1234,568` en
   TND), donc soumise à la **décision 16** du même fichier — « *les arrondis sont déclarés par le
   modèle* ». **C'est une lecture d'une règle existante, pas un ajout.** Et C6 avait mandat pour
   cette lecture : [cité] `docs/adr/0004-…:659`, « ***Le classement appartient à C6, qui
   l'instruira.*** »
2. **Il emprunte exactement le chemin que le message déclare autorisé** : `Intl.NumberFormat` et
   `Intl.DateTimeFormat` avec une **locale explicite** et un `timeZone` **littéral en ligne**. Le
   message nomme **un chemin, pas une signature** : passer `minimumFractionDigits` ne le
   contredit pas [déduit, et confirmé par la mesure — **zéro diagnostic Biome** sur les dix
   fichiers du lot, tests compris, **zéro `biome-ignore`**].
3. **Le critère de recette ne devient donc pas « inatteignable par le moyen normal »** — c'était
   le coût mesuré par D10 en cas de classement en interdit.

#### Ce qui reste, et qui vaut la peine d'être demandé

Le message est **incomplet à HEAD**, et l'incomplétude est celle qui a coûté le plus cher au
dossier. **Avant** [cité, `biome.jsonc:273`, extrait] :

> *« Nothing is lost, because C6 formats through `Intl.NumberFormat(locale)` and
> `Intl.DateTimeFormat(locale, { timeZone })`, both of which stay allowed and say what they
> read. »*

**Après (proposé) :**

> *« Nothing is lost, because C6 formats through `Intl.NumberFormat(locale, { numberingSystem })`
> and `Intl.DateTimeFormat(locale, { timeZone, calendar, numberingSystem })`, both of which stay
> allowed and say what they read. **Three options must be pinned, not one:** a locale alone still
> lets CLDR pick a calendar (`fa-IR` -> 1405, `th-TH` -> 2569) and a numbering system (`ar-EG` ->
> `١٬٢٣٤٫٥٠`, **on amounts as well as dates**), and an explicit option wins against a `-u-ca-`
> extension in the tag. »*

**Motif :** le message actuel laisse croire qu'une **locale** suffit à rendre un formatage
prévisible. Mesuré, elle ne suffit pas : **trois** options doivent être épinglées, et l'une des
deux manquantes touche les **montants**. C'est exactement le genre de trou qu'`AGENTS.md:36-56`
existe pour ne pas laisser passer.

**Coût du refus du mandat : nul pour le lot.** C6 épingle les trois options quoi qu'il arrive
(D-09) ; seul le message resterait trompeur pour le prochain contributeur.

---

### M-2 — ⛔ **BLOQUANT** — Le critère de recette de `docs/roadmap/core.md:261-262`

**Avant** [cité] `docs/roadmap/core.md:261-262` :

> *« **Prêt quand** un unique modèle de facture produit deux documents corrects dans deux langues
> et deux devises, sans duplication du modèle. »*

**Le problème, en une phrase : `core` ne rend rien.** [mesuré] la **même phrase**, au mot près,
est le critère du lot **E4** — `docs/roadmap/engine.md:82-83` : « *Prêt quand le même modèle,
appelé deux fois, produit une facture français/euros et une facture anglais/dollars, toutes deux
correctes.* » Deux lots ne peuvent pas avoir le même critère quand l'un n'a pas de sortie.

**Et la bonne coupe existe déjà dans le même dossier** [cité] `docs/roadmap/engine.md:78-79` :

> *« Le contrat sait **décrire** un modèle bilingue (core C6) ; le moteur doit **l'honorer** :
> montants, dates, séparateurs, symbole monétaire, libellés fixes. »*

**Après (proposé) :**

> *« **Prêt quand** un unique modèle de facture **déclare** deux écritures — deux langues, deux
> devises, leurs échelles et leur style de date — et que chacune de ses valeurs peut être écrite
> dans l'une ou l'autre depuis **un seul objet `Template`**, sans duplication du modèle. La
> production des **deux documents** est le critère du lot **E4** (`engine.md:82-83`). »*

**Trois motifs, et le troisième est le plus dur :**

1. **`core` ne rend rien** — c'est un fait d'architecture (`AGENTS.md` §2), pas une lacune.
2. **Le mot « corrects » n'est pas défini**, et son sens fort — *conforme* — est attribué à
   **l'intégrateur** par le tableau d'arbitrage du même fichier (`docs/roadmap/core.md:34`,
   `:49`). Une facture américaine ne diffère pas d'une française que par les mots : bloc
   d'adresse, *sales tax* contre TVA, mentions légales. **Le critère est satisfait à la lettre par
   une facture française en mots anglais**, et aucun contrat de `core` ne peut faire mieux.
3. ⛔ **Et même la moitié « écriture » n'est pas entièrement démontrable par `core` seul** :
   le formatage étant une **fonction**, rien dans le document stocké ne dit **quelles valeurs**
   s'écrivent ainsi (attente E4-1). Le critère proposé ci-dessus dit « *chacune de ses valeurs
   **peut** être écrite* », et ce « peut » est **exact** — il ne promet pas la liste.

⚠️ **À ne pas faire, et c'est nommé pour que personne ne le refasse** : démontrer le critère avec
un moteur écrit pour l'occasion, hors dépôt. Les trois conceptions concurrentes du dossier l'ont
fait ; ce lot ne le fait pas, et il le dit.

**Décideur : le propriétaire du produit.** **Sans arbitrage, le lot ne peut pas être déclaré
fini** — il livrerait un contrat conforme face à un critère qu'aucun contrat ne peut satisfaire.

---

### M-3 — ⛔ **BLOQUANT** — L'énoncé de déterminisme de l'ADR 0003, et celui d'E6

C'est **B1**, le blocage qui a survécu à toutes les attaques du dossier — **mais il ne vise pas le
fichier que le dossier croyait (R-10)**.

> ⛔ **Rectification de citation, et elle déplace la charge.** [vérifié,
> `docs/adr/0003-…:238-242`] la phrase ci-dessous est la **condition 2 du critère d'admissibilité
> d'une OPÉRATION DE DATE dans l'algèbre** — son sujet grammatical est « *une opération de date* »,
> pas « la brique ». `:783-784` a pour sujet `toLocaleUpperCase`, une opération de l'algèbre elle
> aussi. **C6 n'ajoute aucune opération à l'algèbre.** Il ne contredit donc ni l'une ni l'autre, et
> `AGENTS.md` autorise nommément `Intl.NumberFormat('fr-FR')` et `Intl.DateTimeFormat('fr-FR',
> { timeZone: 'UTC' })` littéral « *parce que C6 et E4 en ont besoin* ».
>
> **Ce que M-3 demande n'est donc pas une dérogation, c'est une clarification** — et elle vaut
> quand même d'être demandée : une condition écrite en tête d'une décision se relit comme une règle
> générale, et ce dossier en est la preuve, puisqu'il l'a lue ainsi lui-même. **La demande passe de
> « amendez, sinon C6 est illégal » à « clarifiez, sinon C6 sera relu comme illégal ».**
>
> ⛔ **Et la charge bloquante se déplace intégralement sur `engine.md:100-105` (E6)**, dont
> l'énoncé, lui, est bien au niveau de la **brique** et promet quelque chose qu'ICU ne tient pas :
> le même document « au caractère près » entre deux machines. **C'est M-7, qui cesse d'être un
> mandat mineur (R-11).**
>
> ⚠️ **Un précédent à ne pas perdre, et il est dans l'ADR 0003 elle-même.** La réserve `textCase`
> (`:775-786`) traite **exactement la même classe de problème** — une sortie indexée sur la version
> d'Unicode du moteur — et son remède est l'**inverse** de la doctrine R1/R6 de ce lot : elle
> **fige des vecteurs de test** (`ß`, `ﬀ`, `İ`) « *pour que le jour où une montée de Node change un
> résultat, ce soit le test qui le dise, pas une facture* ». Ce lot, lui, refuse toute chaîne
> figée. **Les deux positions sont défendables et elles ne peuvent pas coexister sans être
> arbitrées** : figer **détecte** la dérive et casse la CI à deux versions de Node ; ne pas figer
> **survit** aux deux versions et ne détecte rien. L'amendement doit dire **laquelle des deux vaut
> pour le formatage**, faute de quoi le dépôt porte deux doctrines contraires sur une même classe.

**Avant, deux phrases, dans une ADR acceptée** [cité] `docs/adr/0003-formules-agregations-et-dates-civiles.md:242` :

> *« 2. elle ne lit **rien** de l'environnement — ni horloge, ni fuseau, ni locale, **ni ICU**. »*

et [cité] `docs/adr/0003-…:783-784` :

> *« La variante locale (`toLocaleUpperCase`) est **interdite** : elle dépend d'ICU et **casse E6
> pour de bon**. »*

**Le fait, mesuré, et il n'est pas discutable :** `Intl.NumberFormat('fr-FR', { style:
'currency', currency: 'EUR' }).format(1234.5)` rend **deux espaces différents** — **U+202F**
(espace fine insécable) entre les chiffres et **U+00A0** avant le symbole — et le U+202F a été
**introduit par CLDR 42 / ICU 72**. La CI tourne sur `node: [24, 26]`
(`.github/workflows/ci.yml:59` [vérifié]), donc **deux jeux CLDR** : un test qui figerait une
chaîne formatée **peut passer sur l'une des deux versions et rougir sur l'autre**.

**Ce contrat dépend d'ICU.** De la façon la plus contrainte qu'on ait su écrire — trois options
épinglées, locale validée structurellement, aucune lecture de machine — mais il en dépend.

**Après (proposé) — un amendement qui dit ce qui reste vrai, et ce qui ne l'est plus :**

> *« **Amendé par le lot C6 (`core`).** Le critère « ne lit rien de l'environnement » vaut pour
> **l'algèbre d'expressions**, dont le résultat reste une fonction pure de ses arguments. Le
> **formatage** (lot C6) dépend d'ICU par construction : c'est le seul moyen d'écrire un montant
> ou une date dans une langue, et `biome.jsonc` le déclare autorisé et attendu. Ce qui reste
> garanti : **deux rendus du même document par le MÊME build produisent la même chaîne.** Ce qui
> ne l'est plus : deux builds portant des versions d'ICU différentes peuvent produire deux
> chaînes différentes — mesuré, U+202F contre U+00A0 en `fr-FR`, changement CLDR 42 / ICU 72.
> **Conséquence pour la QA : aucun test d'or ne fige une chaîne formatée**, et la contrainte de
> déterminisme d'E6 devient une contrainte de **version d'ICU**, pas seulement d'entrée. »*

**Et le même geste sur E6**, dont l'énoncé promet plus qu'ICU ne peut tenir — **avant** [cité]
`docs/roadmap/engine.md:102-105` : « *Deux exécutions du même modèle sur deux machines doivent
donner le même document, **au caractère près*** ». **Après (proposé)** : préciser « *au caractère
près, **à version d'ICU égale*** », et nommer l'appariement `viewer` / moteur (attente E4-9).

**Motif :** une ADR acceptée qui dit le contraire de ce que le code fait est pire qu'un silence.
Et le dépôt a une doctrine explicite contre l'auto-dérogation — `docs/adr/0007-l-apparence.md:1741`,
signalement A : « *Ne pas s'auto-délivrer une **dérogation** à AGENTS.md* ». **C6 ne se la
délivre pas : il la demande.**

**Décideur : le propriétaire du produit, AVANT la livraison de C6.**

---

### M-4 — `numberingSystem` doit-il être déclarable par le modèle ?

**Aucun fichier protégé** — c'est une **décision produit**, et elle est ouverte par la
recommandation **D-10** du contrat.

**L'état livré :** `numberingSystem: 'latn'` est épinglé **en dur**, au même titre que
`timeZone: 'UTC'` et `calendar: 'gregory'`. Conséquence assumée : **une facture en `ar-EG` sort en
chiffres latins**, alors que `Intl` seul rendrait `١٬٢٣٤٫٥٠` — sur les **montants** comme sur les
dates [mesuré].

**Ce qui est demandé :** trancher si une écriture peut porter un cinquième… un **sixième** champ,
`numberingSystem?: string`, validé par la même mécanique structurelle que la locale.

**Motif, et les deux moitiés se valent :**
- **Pour l'épinglage :** « corrects » n'est pas défini (B3) et la conformité appartient à
  l'intégrateur (`docs/roadmap/core.md:49`) ; des chiffres latins sont lisibles partout ; et
  c'est le choix qui rend le rendu le plus prévisible.
- **Contre :** une facture arabe en chiffres latins n'est **pas neutre**, et le lot ne prétend pas
  le contraire.

**Coût de la réouverture, chiffré : UNE ESTAMPILLE.** C'est un champ **optionnel ajouté**, donc
la classe *perte silencieuse* — `schemaVersion` passe de 7 à 8 avec une migration qui n'estampille
que. **La modification la moins chère que ce dépôt connaisse**, et c'est pourquoi le lot
recommande d'épingler **aujourd'hui** plutôt que d'ouvrir sans consommateur.

⚠️ **`calendar` n'est PAS dans cette demande, et c'est délibéré.** Une date du contrat est
`YYYY-MM-DD` **grégorienne proleptique** (`packages/core/src/expression/civil-date.ts:20-22`) :
la rendre dans un autre calendrier changerait la **valeur**, pas l'écriture. `calendar: 'gregory'`
n'est jamais déclarable.

**Décideur : le propriétaire du produit.** *Signal de réouverture nommé :* une facture arabe ou
persane commandée par un intégrateur.

---

### M-5 — Le poids de C6 : **L → XL**, ou l'écart assumé par écrit

**Avant** [vérifié] `docs/roadmap/core.md:264` : « **Poids :** L — **Dépend de :** C2, C5 ».

**Le faisceau** : C3 coté M est sorti L ; C4 coté M est sorti L (`docs/adr/0006-la-page.md:1088`) ;
C5 coté L a produit 6 892 lignes de plan, 23 fichiers, dix-huit décisions. C6 est coté L et hérite
de **vingt promesses**, de **deux questions ouvertes structurantes**, de la contrainte d'outillage
**la plus serrée du dépôt**, et d'une **estampille de schéma**.

**Le geste, et il a deux précédents :** annoncer **XL** au §1 du plan — « *une réestimation de
poids, **dite plutôt que laissée trouver*** » (`docs/adr/0005-…:814`) — et **ne pas corriger la
roadmap** : « *Au propriétaire du produit de corriger la roadmap ou d'assumer l'écart par écrit —
la roadmap n'est **PAS** corrigée ici, ce serait rouvrir l'ordonnancement de la vague 1 en
passant* » (`docs/adr/0006-la-page.md:1088`).

**Décideur : le propriétaire du produit.** Non bloquant.

---

### M-6 — Corriger quatre citations de C6 dans **deux ADR qui font foi**

**Ce qui est demandé :** substituer `core.md:186-196` → `core.md:256-259` et
`core.md:229` → `core.md:264` dans **quatre lignes** : `docs/adr/0005-le-tableau-de-lignes.md:282`
et `:810`, `docs/adr/0007-l-apparence.md:11` et `:1401`.

**Motif, et il est déjà écrit dans le dépôt :** la décision 17 de C5 pose que l'on réécrit le
document d'un autre **quand on est le lot mal nommé**. ⚠️ **C6 est, plus littéralement encore, le
lot dont les citations sont fausses** : les cinq occurrences `core.md:229` désignent **sa** ligne
de dépendance, et l'ADR 0007 les a écrites **en le nommant**.

**Sûretés vérifiées :**
- corriger le pointeur de `docs/adr/0005-…:810` **ne retire pas** la chaîne `core C5` de la ligne
  → **la sonde 7 de l'ADR 0007 reste verte** [vérifié] ;
- **aucun jugement n'est modifié**, seulement des pointeurs ;
- les **quinze** occurrences des trois plans ne sont **pas** touchées (ils sont périssables).

**Option plus ambitieuse, à arbitrer** : remplacer les numéros de ligne par des **ancres de
titre**. Elle traite la cause, mais [mesuré] **aucune ancre de titre n'existe dans
`docs/roadmap/`** — ce serait une **première**, sur des documents qui font foi, et cela dépasse
le périmètre d'un lot.

**Décideur : le propriétaire du produit.** Non bloquant — si le mandat est refusé, C6 se contente
du **minimum obligatoire** : recompter ses propres citations.

---

### M-7 — L'énoncé d'E6 face à deux versions d'ICU

Repris de M-3, mais listé à part parce qu'il vise un **autre fichier** et un **autre lot** :
`docs/roadmap/engine.md:102-105` promet « *le même document, au caractère près* » entre deux
machines. Avec ICU dans la chaîne, la promesse devient **conditionnelle à la version de CLDR** —
et elle touche aussi la promesse d'aperçu identique au PDF (J4), puisqu'un navigateur et Node ne
portent pas nécessairement le même ICU (attente E4-9).

**Décideur : le propriétaire du produit**, avec les lots **E5** et **`viewer`**.

> ⛔ **RECLASSÉ BLOQUANT POUR C6 (R-11).** La rédaction précédente disait « non bloquant pour C6,
> bloquant pour E6 ». **C'est intenable, et pour une raison de simple séquence :** c'est **C6** qui
> introduit la dépendance à CLDR, et l'amendement demandé en **M-3 / A-3** — « *ce qui reste
> garanti : deux rendus du même document par le MÊME build* » — **rend `engine.md:100-105` faux au
> moment même où il est écrit**. Livrer C6 sans toucher E6, c'est publier deux textes du dépôt qui
> se contredisent, l'un dans une ADR amendée par ce lot, l'autre dans la roadmap. Et le remède
> qu'`AGENTS.md §1.2` prescrit pour une incompatibilité — l'estampille — **ne s'applique pas** :
> ce n'est pas un document qui bouge, c'est une promesse.
>
> **M-3 et M-7 forment donc UN seul mandat en deux fichiers**, et ils se tranchent ensemble, à
> `INC-5`. Le décider séparément est ce qui a produit l'incohérence.
>
> **Ce que le propriétaire du produit doit trancher, en une question :** la garantie d'E6 devient-
> elle **conditionnelle à la version d'ICU** (le moins cher, et ce que M-3 propose), ou Openview
> **épingle-t-il** une version d'ICU pour tous les rendus (coûteux, et cela fait d'Openview le
> détenteur d'un référentiel linguistique, ce que `README.md:17` refuse), ou la typographie est-
> elle **produite côté serveur et transmise au viewer** (déplace le problème sans le fermer, et
> rouvre J4) ? **Ces trois branches n'ont pas le même coût et une seule est gratuite.**

---

## 7.5 Ce que cette section tient pour acquis

| Acquis | Statut |
| :--- | :--- |
| Le dépôt n'a pas été modifié **par cette section** : aucune écriture, HEAD `320bea6` inchangé | [mesuré], avant et après. ⚠️ `git status --porcelain` rend **deux lignes** à la fin (`.claude/launch.json`, `apps/playground/vite.config.ts`) — **travail concurrent, pas C6** : voir l'avertissement d'en-tête |
| Les vingt promesses sont celles recensées par `r2-doctrine-adr.md` famille A ; leurs **sources** ont été rouvertes une par une dans le dépôt | [vérifié] |
| Le contrat évalué est celui de `s1-contrat-final.md` et de `sandbox-FINAL/` | [vérifié] par lecture du bac à sable |
| Les mesures ICU citées (JPY, TND, `ar-EG`, `fa-IR`, `th-TH`, U+202F) ont été rejouées pour les plus structurantes sous **Node v24.11.1 / ICU 77.1** | [mesuré] ; les tirages massifs (200 000 / 1 000 000) sont repris de `m1-mesures.md` et `s1-contrat-final.md`, **non rejoués ici** |
| Aucune des quatre portes n'a été lancée **dans le dépôt** — le cadre l'interdit | [assumé] |
| Deux relevés du dossier se sont révélés **faux** et sont corrigés ici : la disparition de `superRefine` (R-4) et l'existence d'ancres de titre dans la roadmap (R-1) | [mesuré] |

---

## 8. Les arbitrages, et les mandats

Un plan de ce dépôt ne se termine pas sur un contrat : il se termine sur la liste de ce qu'il
**n'avait pas le droit de trancher seul**. Deux catégories, et elles n'ont pas le même régime.

- Les **arbitrages** portent sur le contrat lui-même. Une réponse contraire **réécrit** une partie
  du plan — elle ne l'amende pas. Ils sont numérotés `A-n`.
- Les **mandats** portent sur des fichiers que le lot ne touche pas sans autorisation : ceux
  qu'`AGENTS.md` §7 nomme, et ceux qui **font foi** (roadmap, ADR acceptées). Ils sont numérotés
  `M-n`.

**Quatre des sept arbitrages sont tranchés ; trois restent ouverts, et tous les trois portent sur
des TEXTES.**

| Échéance | Statut au 2026-08-20 |
| :--- | :--- |
| **Avant INC-0** — `A-7` | ✅ **tranché** : résultat discriminé, formateur-objet refusé, `E4-10` recopiée dans l'ADR 0008 |
| **Avant INC-2** — `A-5` | ✅ **tranché** : différé à E4, estampille `7 → 8` **actée** |
| **Sans échéance dure** — `A-4`, `A-6` | ✅ **tranchés** : `numberingSystem` épinglé ; deux commutateurs séparés et **dits** (`E4-11`) |
| ⛔ **Avant INC-5** — `A-1`, `A-2`, `A-3` + `M-2`, `M-3`, `M-7` | **ouverts.** Ils empêchent de **déclarer le lot fini**, jamais d'écrire une ligne : `INC-5` est l'incrément qui porte l'ADR et les amendements, et **une ADR ne s'écrit pas contre une question ouverte** |

`M-1`, `M-5` et `M-6` sont des demandes, et leur refus a un coût **chiffré** pour chacune.

> ⛔ **La leçon de méthode que la revue a imposée, et elle vaut au-delà de ce lot.** Ce plan a rangé
> pendant tout son parcours les arbitrages « produit » du côté des **textes**, parce que les quatre
> premiers y étaient. `A-5` et `A-7` n'y étaient pas : l'un décidait d'une **forme stockée**,
> l'autre d'une **signature publique**, donc tous deux bloquaient un **commit** et non une ADR.
> **Un arbitrage se date par ce qu'il réécrit, jamais par qui le tranche.**

### Le tableau de décision

| # | Question, en une phrase | ⛔ | Recommandation | Ce que l'autre branche réécrit |
| :-- | :--- | :-: | :--- | :--- |
| **A-1** | Une locale que la machine qui **ouvre** le document ne connaît pas rend-elle le document **inouvrable**, ou **ouvrable avec une écriture non résolue** ? | **OUI** | **B — refus au rendu** | `D-06` passe de *réversible* à **irréversible de fait**, `M-3` s'élargit, `E4-9` devient une contrainte d'appariement, et Openview doit **publier une version d'ICU minimale** — donc détenir un référentiel, ce que `D-06` et `D-08` refusent |
| **A-2** | Le critère de recette de `core.md:261-262` est **mot pour mot** celui d'E4, et `core` ne rend rien : qui le porte ? | **OUI** | **Découper** : `core` **déclare**, E4 **produit** | Si le critère reste tel quel, le lot ne peut **pas** être déclaré fini — aucun contrat de `core` ne le satisfait |
| **A-3** | Ce contrat dépend d'ICU, alors qu'une ADR acceptée écrit que la brique « ne lit rien de l'environnement, **ni ICU** ». Amende-t-on l'ADR, ou renonce-t-on à ICU ? | **OUI** | **Amender**, en disant ce qui reste vrai | Renoncer à ICU impose une **table de typographie déclarée** (séparateurs, position du symbole, noms de mois) : déterminisme intégral, mais Openview détient un référentiel linguistique — le §3 est à réécrire entièrement |
| **A-4** | `numberingSystem` doit-il être **déclarable** par le modèle, ou épinglé en dur ? | — | **Épinglé** aujourd'hui | Un sixième champ, et **une estampille** (`7 → 8`) — la modification la moins chère du dépôt |
| **A-5** | 🆕 Le **lien site → profil d'écriture** (`format?: string` sur `TextBindingSegment` **et** `TextPageFieldSegment`) se livre-t-il dans C6, ou se diffère-t-il à E4 ? | ✅ **TRANCHÉ** — dans la fenêtre (avant INC-2) | **DIFFÉRÉ à E4**, estampille `7 → 8` **actée** | Ce que le report **préserve** : C6 entièrement hors de `ast/**`, aucun invariant croisé, aucune fixture reprise. Ce qu'il **coûte**, écrit sans adoucissement : E4 câble les sites à la main jusque-là, et c'est le seul défaut du lot qui puisse imprimer une valeur fausse (`20 260 014` pour un numéro de commande) |
| **A-6** | 🆕 Les **mots** (un `if` lisant une donnée) et l'**écriture** (un nom d'écriture passé en argument) sont deux commutateurs **indépendants**. Les coud-on ? | ✅ **TRANCHÉ** | **Non cousus — DITS** : attente `E4-11`, et la combinaison croisée à l'écran | Les coudre ajoute une forme stockée, rouvre `E4-4` que [D-02] ferme, fait d'Openview l'arbitre d'une contradiction — une règle métier — **et interdit `en-FR`**, un document correct. Ne rien dire laissait produire une facture à **libellés français et montants en dollars** sans qu'aucune porte la voie ; c'est ce silence qui est levé |
| **A-7** | 🆕 `resolvePresentation` rend-il une `Presentation` **structurelle**, ou un **formateur résolu** (les trois fonctions closes sur une écriture validée) et un **résultat discriminé** en cas de refus ? | ✅ **TRANCHÉ** — dans la fenêtre (avant INC-0) | **Résultat discriminé OUI ; formateur-objet NON** | Le refus porte désormais sa **cause** (`'unknown-writing'`, `'invalid-writing'`, `'unhonoured-locale'`), ce que R-09 exigeait. `E4-10` **reste documentaire** — le formateur-objet l'aurait fermée par signature, mais il invalidait une campagne qui a réellement tourné (33 tests / 2 ICU, 29 mutations, le compte d'exports). ⛔ Contrepartie : l'ADR 0008 **recopie** le tableau des cinq familles |
| **M-1** | Le message de `biome.jsonc:273` ne nomme **qu'une** option épinglée alors qu'il en faut **trois**. | — | Préciser | Rien pour le lot : il épingle les trois quoi qu'il arrive. Seul le message reste trompeur |
| **M-5** | Le poids annoncé « L » est-il tenable ? | — | Annoncer **XL** au §1, **sans** corriger la roadmap | Rouvrir l'ordonnancement de la vague 1 |
| **M-6** | Quatre citations de C6 dans **deux ADR qui font foi** sont périmées. | — | Corriger les quatre | Le lot se contente de recompter ses propres citations |
| **M-7** | E6 promet « le même document, **au caractère près** » entre deux machines. | **OUI** | « à **version d'ICU égale** », **dans le même geste que M-3** | ⛔ **Reclassé (R-11)** : c'est C6 qui introduit la dépendance à CLDR, et l'amendement de M-3 rend `engine.md:100-105` faux au moment où il est écrit. Livrer l'un sans l'autre publie deux textes du dépôt qui se contredisent |

> ✅ **Ce que signifie « bloquant » ici, après les décisions du 2026-08-20.** La formule d'origine
> — « les incréments `INC-0` à `INC-4` peuvent être exécutés sans qu'aucun ⛔ soit tranché » —
> **est de nouveau vraie**, mais elle ne l'était pas entre-temps, et le détour valait la peine :
>
> - `A-1`, `A-2`, `A-3` et les mandats `M-2`, `M-3`, `M-7` portent sur des **textes**. Ils
>   empêchent de **déclarer le lot fini** — `INC-5` écrit l'ADR, et une ADR ne s'écrit pas contre
>   une question ouverte — mais ils n'empêchent pas d'écrire une ligne de code. **Toujours
>   ouverts.**
> - `A-7` portait sur une **signature publique** : le trancher après `INC-1` aurait réécrit trois
>   fonctions exportées et un résolveur. **Tranché avant `INC-0`**, et le [§3] en porte le
>   résultat.
> - `A-5` portait sur une **forme stockée** qui aurait monté sur l'estampille `6 → 7` de `INC-2`.
>   **Tranché avant `INC-2`** : différé, coût `7 → 8` acté à la charge d'E4.
>
> **La question de méthode que ça a posée, et qu'il faut garder :** ce plan avait rangé les
> arbitrages « produit » du côté des textes, parce que les quatre premiers y étaient. Les deux
> nouveaux n'y étaient pas. **Un arbitrage se date par ce qu'il réécrit, jamais par qui le
> tranche** — et c'est cette règle, plus que les deux réponses, qui est le gain de la revue.

---

### A-1 — ⛔ La validité d'une locale se juge-t-elle à l'ouverture ou au rendu ?

**C'est l'arbitrage le plus tardif du dossier, et le seul qu'aucune des trois conceptions n'avait
vu.** Il est né de la réattaque du contrat final, c'est-à-dire de la seule relecture qui portait
sur la forme définitive plutôt que sur celle qui l'a précédée.

#### Le fait, mesuré sur deux moteurs réels

La validation d'une locale que le contrat retenait — *le tag est canonicalisable, il ne porte pas
d'extension `-u-`, et les deux formateurs le résolvent vers lui-même* — a une propriété qui n'avait
pas été cherchée : **sa troisième condition interroge ICU**, donc la machine.

[mesuré] Balayage de **31 772 tags**, sur deux binaires réellement présents sur le poste :
`node v24.11.1` (ICU **77.1**) et `ms-playwright-go/1.50.1/node.exe` v22.13.1 (ICU **76.1**).

| Mesure | ICU 77.1 | ICU 76.1 |
| :--- | ---: | ---: |
| Tags acceptés par le prédicat | **527** | **525** |
| Divergents | `en-FR`, `cls` | |

Bout en bout sur le JavaScript émis du lot, **la même table** rend
`PresentationTableSchema.safeParse().success === true` sur ICU 77.1 et **`false`** sur ICU 76.1,
avec l'issue `{ code: 'custom', path: ['en', 'locale'] }`.

#### Pourquoi c'est grave, et pourquoi ce n'est pas « une écriture perdue »

**C'est le document entier qui ne s'ouvre pas.** `parseTemplate` refuse, et le message accuse
l'auteur du modèle sans nommer ni ICU ni version. C'est la classe **« refus illisible »**
d'`AGENTS.md` §1.2 — à ceci près que le remède que le dépôt prescrit pour cette classe,
**l'incrément de `schemaVersion`, n'existe pas ici** : les deux machines portent le même build
d'Openview. Aucun numéro de version ne les distingue.

Et le tag divergent n'est pas exotique. **`en-FR` est le tag naturel de la moitié anglaise d'une
facture française** — un client anglophone d'une société française —, c'est-à-dire **le cas d'usage
même** que `core.md:261-262` décrit. Le contrat aurait donc échoué exactement là où il prétend
réussir.

> **Ce que le dossier avait, et ce qui lui a manqué.** Les deux binaires étaient identifiés
> (`s2:505`, `s4:320`) et deux rapports avaient mesuré sur les deux. Mais tous mesuraient un **jeu
> de tags choisi à la main** et *l'accord des deux formateurs entre eux*, jamais **l'ensemble des
> tags acceptés**. La question « les deux formateurs sont-ils d'accord ? » a une réponse stable ;
> la question « acceptent-ils la même chose sur deux ICU ? » n'en a pas. **Ce sont deux questions
> différentes, et seule la seconde décidait.**

#### Les deux branches

**Branche A — refus à l'ouverture (le contrat tel qu'écrit avant correction).**
Le modèle est refusé au *parse* si sa locale n'est pas honorée par la machine.
*Pour :* une seule porte, et un modèle stocké dont toutes les valeurs sont utilisables.
*Contre :* la validité d'un document **dépend de la machine qui l'ouvre**. Un modèle écrit sur le
poste d'un développeur peut être inouvrable en production. Et le remède impose de **publier une
version d'ICU minimale supportée**, c'est-à-dire de détenir un référentiel — précisément ce que
`D-06` et `D-08` refusent, et ce que `README.md:17` interdit.

**Branche B — refus au rendu. ✅ Recommandée.**
Le *parse* ne vérifie que la **syntaxe** : le tag est bien formé et ne porte pas d'extension `-u-`.
L'**honorat** — la partie qui interroge ICU — descend dans `resolvePresentation`, au rendu.
*Pour :* un document reste **ouvrable partout**, et ce qui dépend de la machine est jugé au moment
où la machine agit. Le refus reste **circonscrit** à l'écriture concernée : le reste du document
s'ouvre et se rend. Zéro code d'erreur nouveau. `E4-8` inchangé.
✅ *Correction R-09, puis son remède (A-7, tranché le 2026-08-20).* Une rédaction antérieure
écrivait que le refus reste « **typé et localisé** ». C'était **faux au moment où c'était écrit** :
`resolvePresentation` rendait `undefined`, donc **ni type, ni cause, ni chemin** ne survivaient, et
un appelant ne pouvait pas distinguer trois fautes qui ont trois remèdes. **A-7 a refermé cette
moitié :** le refus porte désormais `refusal: 'unknown-writing' | 'invalid-writing' |
'unhonoured-locale'`, donc il **est** typé et il **nomme** sa cause. Ce qui reste hors du refus, et
qu'il faut continuer à dire : **aucun chemin** (`path`) — le résolveur ne rend pas les `issues` de
`safeParse`, et un Designer qui veut la ligne fautive parse la table avec
`PresentationTableSchema`. Le mot juste pour la branche B est donc : le refus est **typé, nommé et
circonscrit** à l'écriture concernée, **sans chemin**.
*Contre :* un modèle peut être enregistré avec une écriture qu'aucune machine n'honorera, et
l'auteur ne l'apprendra qu'au premier rendu. **C'est un vrai coût, et c'est celui qu'on
recommande de payer** — il est réparable, l'autre ne l'est pas.

> **Le principe que la branche B applique, et qu'il vaut la peine d'énoncer :** *une propriété de
> l'environnement ne se juge pas au moment où l'on écrit un fichier, mais au moment où l'on s'en
> sert.* Le dépôt l'applique déjà ailleurs sans l'avoir nommé — les limites d'évaluation
> (`EvaluationLimits`) sont des propriétés de la machine, et elles sont vérifiées **à l'exécution**,
> jamais au *save time*.

**Décideur : le propriétaire du produit.**

---

### A-2 — ⛔ Le critère de recette appartient à E4

> Le développement complet est au [§7.4, M-2]. Résumé ici parce que c'est un arbitrage et non
> seulement un mandat : la réponse **change ce que le lot doit démontrer**.

`docs/roadmap/core.md:261-262` et `docs/roadmap/engine.md:82-83` sont **la même phrase**, et
`core` ne rend rien. La coupe juste est déjà écrite dans le dépôt, `engine.md:78-79` :

> *« Le contrat sait **décrire** un modèle bilingue (core C6) ; le moteur doit **l'honorer**. »*

**Formulation proposée pour `core.md:261-262` :**

> *« **Prêt quand** un unique modèle de facture **déclare** deux écritures — deux langues, deux
> devises, leurs échelles et leur style de date — et que chacune de ses valeurs **peut** être
> écrite dans l'une ou l'autre depuis **un seul objet `Template`**, sans duplication du modèle.
> La production des **deux documents** est le critère du lot **E4**. »*

Le « peut » est exact et non pas prudent : le contrat livre de quoi **écrire une valeur**, jamais
la **liste des valeurs à écrire** — c'est l'attente `E4-1`, et c'est la faiblesse structurelle du
lot, écrite en tête de ce plan.

⚠️ **Une ligne à ajouter au mandat, que la réattaque a relevée :** le texte de remplacement retire
« corrects » de `core.md` mais laisse `engine.md:82-83` (« *toutes deux **correctes*** »)
**inchangé** [vérifié]. Le mot indéfini **change de propriétaire sans changer de nature** — il
faudra le traiter au lot E4, ou le traiter ici pour les deux fichiers.

**Décideur : le propriétaire du produit. Sans arbitrage, le lot ne peut pas être déclaré fini.**

---

### A-3 — ⛔ Ce contrat dépend d'ICU — et la cible de l'arbitrage a été RECTIFIÉE

> Développement complet au [§7.4, M-3]. ⛔ **Cet arbitrage visait le mauvais fichier (R-10) ;
> l'énoncé ci-dessous est le corrigé.**

**Ce que le dossier croyait.** Deux phrases publiées, dans une ADR acceptée —
`docs/adr/0003-…:242` (« *elle ne lit **rien** de l'environnement — ni horloge, ni fuseau, ni
locale, **ni ICU*** ») et `:783-784` (« *elle dépend d'ICU et **casse E6 pour de bon*** ») —
diraient le contraire de ce que ce lot fait.

**Ce que la vérification montre.** [vérifié, `0003:238-242`] la première phrase est la
**condition 2 du critère d'admissibilité d'une opération de date dans l'algèbre** : son sujet est
« *une opération de date* ». La seconde a pour sujet `toLocaleUpperCase`, une opération de
l'algèbre elle aussi. **C6 n'ajoute aucune opération à l'algèbre**, et `AGENTS.md` autorise
nommément `Intl.NumberFormat('fr-FR')` et `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`
littéral « *parce que C6 et E4 en ont besoin* ». **L'ADR 0003 n'interdit donc pas ce contrat.**

**Ce qui reste, et c'est réel :**

1. **Une clarification à demander** — la condition 2 se relit comme une règle de brique, et ce
   dossier en est la preuve puisqu'il l'a lue ainsi. Elle est **utile**, elle n'est **pas** une
   dérogation.
2. ⛔ **Un conflit véritable, et il est ailleurs : E6.** `docs/roadmap/engine.md:100-105` promet
   « *le même document, **au caractère près*** » entre deux machines, au niveau de la **brique**.
   [mesuré] deux builds d'ICU produisent des **chaînes** différentes (U+202F / U+00A0, CLDR 42),
   des **ensembles de locales honorées** différents (531 / 529), et des **canonicalisations**
   différentes. **C'est M-7, désormais bloquant (R-11), et il se tranche AVEC M-3.**
3. **Une doctrine de test à arbitrer, découverte dans l'ADR 0003 elle-même.** Sa réserve
   `textCase` (`:775-786`) traite la même classe de problème — une sortie indexée sur la version
   d'Unicode — et la résout **en figeant des vecteurs de test**, l'exact inverse de la règle R1/R6
   de ce lot. **Figer détecte la dérive et casse la CI à deux versions de Node ; ne pas figer
   survit aux deux et ne détecte rien.** L'amendement doit dire laquelle vaut pour le formatage.

**Le lot ne se délivre pas de dérogation : il en demande une** — et il demande désormais **la
bonne**, sur `engine.md` plutôt que sur l'ADR 0003 seule. C'est la doctrine explicite du dépôt
(`docs/adr/0007-…:1741`, signalement A).

**Deux élargissements du mandat, imposés par les mesures les plus tardives :**

1. **L'amendement ne peut pas ne parler que des chaînes.** La rédaction initiale disait « deux
   builds d'ICU peuvent produire deux chaînes différentes ». `A-1` montre que la dépendance porte
   aussi sur la **validité d'une entrée** — donc sur ce qu'un document peut contenir, pas seulement
   sur ce qu'il imprime.
2. **La QA hérite d'une règle**, et elle doit être dans l'amendement : **aucun test d'or ne fige
   une chaîne formatée.** [mesuré] `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et
   **U+00A0** avant le symbole, et le U+202F a été introduit par **CLDR 42 / ICU 72**. La CI tourne
   sur `node: [24, 26]` ([ci.yml:59](.github/workflows/ci.yml:59), vérifié) — donc deux jeux CLDR.

**Ce qui reste vrai, et c'est ce que l'amendement doit dire :** *deux rendus du même document par
le **même build** produisent la même chaîne.* Ce qui ne l'est plus : deux builds portant des
versions d'ICU différentes peuvent diverger.

**Décideur : le propriétaire du produit, AVANT la livraison de C6.**

---

### A-4 — `numberingSystem` déclarable, ou épinglé ?

> Développement complet au [§7.4, M-4].

**Livré épinglé en dur** (`numberingSystem: 'latn'`), au même titre que `timeZone: 'UTC'` et
`calendar: 'gregory'`. Conséquence assumée, et il faut la dire crûment : **une facture en `ar-EG`
sort en chiffres latins**, alors qu'`Intl` seul rendrait `١٬٢٣٤٫٥٠` — sur les **montants** comme
sur les dates [mesuré].

| | Pour l'épinglage | Contre |
| :--- | :--- | :--- |
| **Argument** | « corrects » n'est pas défini et la conformité appartient à l'intégrateur (`core.md:49`) ; le rendu est prévisible | une facture arabe en chiffres latins n'est **pas neutre**, et le lot ne prétend pas le contraire |

**Coût de la réouverture, chiffré : une estampille.** Champ optionnel ajouté → classe *perte
silencieuse* → `schemaVersion` 7 → 8, migration qui n'estampille que. C'est la modification la
moins chère que ce dépôt connaisse, et c'est **l'argument pour épingler aujourd'hui** plutôt que
d'ouvrir un champ sans consommateur (règle anti-sur-ingénierie, `AGENTS.md` §3).

⚠️ **`calendar` n'est PAS dans cette demande, et c'est délibéré.** Une date du contrat est
`YYYY-MM-DD` **grégorienne proleptique** ([civil-date.ts:20-22](packages/core/src/expression/civil-date.ts:20)) :
la rendre dans un autre calendrier changerait la **valeur**, pas l'écriture — et l'encadré du lot
dans la roadmap dit que **ce lot ne fait pas de conversion**. `calendar: 'gregory'` n'est jamais
déclarable.

*Signal de réouverture, nommé :* un intégrateur qui commande une facture arabe ou persane.

---

### A-5 — ✅ TRANCHÉ (2026-08-20) — DIFFÉRÉ à E4, et le coût est ACTÉ

> Né de la revue externe (**R-17**). Échéance tenue : tranché **avant `INC-2`**.
>
> **Décision.** Le champ `format?: string` **n'est pas livré par C6**. Le lien site → écriture reste
> l'attente **`E4-1`**, et **le lot E4 paiera une estampille `7 → 8`** avec sa migration
> d'estampille. **Ce coût est connu, chiffré et accepté** ; il n'est plus présenté comme le coût du
> remède, mais comme le coût du **report** — c'est la correction que R-17 imposait, et elle ne
> change pas la réponse, elle change ce qu'on en dit.
>
> **Ce que le report préserve, et c'est le motif décisif :** C6 reste **entièrement hors de
> `ast/**`**. `visitor.ts` ne bouge pas, aucune paire `*_KEYS_IN_STEP` ne rougit, aucune fixture
> d'AST n'est reprise, et le lot n'ouvre **aucun invariant croisé**. Ouvrir `format?` exigeait au
> contraire deux champs de segment, deux paires de clés, les fixtures, **et le premier invariant
> croisé du lot** (« ce segment nomme une écriture que le modèle ne déclare pas ») — donc sa propre
> campagne de mesure, sur un lot déjà coté **XL** et déjà en dépassement de poids ([M-5]).
>
> **Ce que le report coûte, écrit sans adoucissement :** entre C6 et E4, aucun document ne peut
> désigner ses sites. E4 devra les câbler **à la main**, et [mesuré] la vitrine lie
> `commande.numero` = `20260014` — qu'une écriture appliquée sans discernement imprimerait
> `20 260 014`, *une autre commande*. **C'est le seul défaut du lot qui puisse imprimer une valeur
> fausse**, et il est différé en connaissance de cause.
>
> ⛔ **Ce qui reste refusé même le jour du remède :** le kind d'expression `format`. Un kind élargit
> une **union stockée**, et une union élargie ne se rétrécit plus. Le remède est le **champ**, et
> lui seul.

#### L'analyse qui a mené là

#### Le fait, et il n'est pas nouveau — c'est son chiffrage qui l'est

Le contrat livre un **verbe** et jamais la **liste des sites** : c'est le [§2.0], écrit en tête du
plan, avec son propriétaire (`E4-1`) et son remède. **Ce que le dossier chiffrait mal**, c'est le
coût des deux branches.

| | **Livrer le champ dans C6** | **Le différer à E4** |
| :--- | :--- | :--- |
| Estampille | ⛔ **AUCUNE** — `D-14` dépense déjà `6 → 7`, et un champ optionnel de segment est **la même classe** (*perte silencieuse*) | **une** (`7 → 8`), plus sa migration |
| Forme stockée | `format?: string` sur `TextBindingSegment` **et** sur `TextPageFieldSegment` | idem, plus tard |
| Surface de refus | une clé de plus dans `TEXT_*_KEYS_IN_STEP`, un refus « *ce segment nomme une écriture que le modèle ne déclare pas* » — **le premier invariant croisé du lot** | idem, plus tard |
| Ce que `core` peut alors démontrer | ⛔ **le critère de recette fort**, ou presque : un modèle **désigne** ses sites | rien de plus qu'aujourd'hui |
| Risque en attendant | — | ⛔ E4 doit **deviner** ; [mesuré] la vitrine lie `commande.numero` = `20260014`, qu'une écriture appliquée sans discernement imprimerait **`20 260 014`** — *une autre commande* |

**L'argument que le dossier avait sous la main et n'a pas lu** est au [§6.1], mot pour mot :
« *Refuser le kind est **gratuit** ; **différer le champ de segment coûte une estampille au lot qui
en aura besoin*** ». Si différer coûte une estampille, alors **livrer maintenant n'en coûte
aucune** — puisque celle de ce lot est déjà engagée.

#### Ce que le champ n'est PAS, et c'est ce qui le distingue du kind refusé

**Ce n'est pas le kind `format`.** Un kind **élargit une union stockée**, et une union élargie ne
se rétrécit plus : c'est la seule décision **irréversible** que ce lot pouvait prendre, et elle
reste refusée. Un **champ optionnel** est de la classe la plus douce du dépôt : un build antérieur
le **dépouille** sans erreur, et l'estampille est ce qui rend cette perte visible. Les deux
n'étaient pas comparables et le dossier les rangeait sous le même remède.

**Ce n'est pas non plus un nom de champ réservé.** Le champ porte **le nom d'une écriture que
l'auteur du modèle a déclarée** — l'espace de noms reste le sien ([D-03]). Openview ne reconnaît
toujours ni un total ni un numéro de commande : **c'est l'auteur qui le dit**, ce qui est
exactement le contraire de la règle de périmètre que le refus invoquait.

#### La branche contraire, avec son argument le plus fort

**Contre :** `AGENTS.md §3` refuse d'introduire une abstraction « au cas où », et **aucun
consommateur n'existe** — `engine` fait six lignes, aucun moteur ne lira ce champ avant E4. Un
champ stocké qui n'est lu par personne pendant deux lots est un champ dont la sémantique dérivera
avant son premier usage. **C'est un vrai argument, et c'est le seul.**

**Pour, en une phrase :** le champ n'est pas une abstraction, c'est **une déclaration**, et son
consommateur n'est pas hypothétique — il est **nommé, daté et bloqué** (`E4-1`).

~~**Recommandation : le livrer**, dans un `INC-2` élargi.~~ **Tranché en sens inverse le
2026-08-20 : différé, coût acté.** L'argument de l'estampille gratuite est **exact et il n'a pas
suffi** — il établit que la **fenêtre** de décision était réelle (avant INC-2), pas que la réponse
devait être « livrer ». Une estampille gratuite ne rend pas gratuits deux champs d'AST, deux paires
de clés, les fixtures et un invariant croisé. **Ce que le dossier devait à son lecteur, et qu'il
lui doit maintenant, c'est la distinction entre les deux.**

---

### A-6 — ✅ TRANCHÉ (2026-08-20) — les deux commutateurs restent SÉPARÉS, et le plan le DIT

> Né de la revue externe. Sans échéance dure — ni forme stockée, ni signature.
>
> **Décision.** Aucun couplage. La langue des **mots** reste un `if` d'expression lisant une
> donnée (C1) ; l'**écriture des valeurs** reste le nom passé au résolveur ([D-02]). Ce que le lot
> ajoute est **documentaire et visible** : l'attente **`E4-11`** dans la façade [§3.6], et la
> **combinaison croisée montrée à l'écran** dans la vitrine [§6.4].
>
> **Le motif décisif, et ce n'est pas le coût :** coudre les deux canaux **interdirait un document
> correct**. Une facture rédigée en anglais et chiffrée en euros pour un client britannique d'une
> société française est exactement le cas d'usage de `en-FR`, le tag que [A-1] passe tout son
> développement à défendre. Un verrou qui refuse un document légitime est pire que l'absence de
> verrou ; ce qui manque est un **avertissement**, et il appartient au Designer.

Un document bilingue bascule par **deux canaux qui ne se connaissent pas** : les **mots** par un
`if(eq(path('rendu.langue'), 'fr'), …)` qui lit une **donnée** (livré par C1), l'**écriture des
valeurs** par le **nom** passé à `resolvePresentation` (livré par ce lot, [D-02]).

**Rien ne les lie, et rien ne les vérifie.** Un appelant qui demande `'en-usd'` en laissant
`rendu.langue = 'fr'` obtient **des libellés français et des montants en dollars** : le parse
accepte (les deux déclarations sont valides séparément), le rendu réussit (les deux mécanismes
fonctionnent), et aucun test ne peut l'attraper — l'invariant à écrire serait une table de
correspondance langue ↔ écriture, **détenue par Openview**.

| Branche | Ce qu'elle coûte |
| :--- | :--- |
| **A — les coudre** : le nom d'écriture devient une **expression** déclarée par le modèle | Une **forme stockée** de plus ; `E4-4` (« d'où vient la clé ») que [D-02] avait fermé se rouvre ; et Openview devient l'arbitre de « ces deux déclarations se contredisent », c'est-à-dire d'une **règle métier**, qu'`AGENTS.md` lui interdit |
| **B — les laisser séparés, et le DIRE. ✅ Recommandée** | Rien dans le contrat. Trois lignes dans la façade ([§3.6]) comme attente **`E4-11`**, et **la combinaison croisée montrée à l'écran** au [§6.4] plutôt que masquée |

**Pourquoi B, et ce n'est pas de la paresse.** Le couplage est **légitime dans un sens et faux
dans l'autre** : un intégrateur peut vouloir une facture rédigée en anglais mais chiffrée en euros
pour un client britannique d'une société française — c'est le cas d'usage même de `en-FR`, le tag
que [A-1] passe son temps à défendre. **Coudre les deux canaux interdirait ce document-là**, qui
est correct. Ce qui manque n'est pas un verrou, c'est un **avertissement**, et il appartient au
Designer (lots D1/D5), au même titre que `D-06b`.

**Décideur : le propriétaire du produit**, et un refus ne coûte rien au contrat.

---

### A-7 — ✅ TRANCHÉ (2026-08-20) — RÉSULTAT DISCRIMINÉ, et le formateur-objet est REFUSÉ

> Né de la revue externe (**R-14**, **R-09**, **R-15**). Échéance tenue : tranché **avant `INC-0`**.
>
> **Décision, en trois lignes.**
> 1. `resolvePresentation` rend un **`PresentationResolution`** discriminé :
>    `{ ok: true, writing }` ou `{ ok: false, refusal }`, avec
>    `refusal: 'unknown-writing' | 'invalid-writing' | 'unhonoured-locale'` [§3.1], [§3.4].
> 2. `Presentation` **reste la forme stockée structurelle**, et `formatMoney` / `formatDecimal` /
>    `formatDate` **restent trois fonctions libres** prenant l'écriture en second argument.
> 3. Le **formateur-objet** (`w.money(v)`) est **refusé**.
>
> **Ce que la décision achète.** Le défaut qui avait un **consommateur nommé** est refermé : le
> Designer (`D-06b`) reçoit `'unhonoured-locale'` au lieu d'un `undefined` muet, et peut avertir
> sans deviner. Et un bénéfice non cherché, qui est peut-être le plus solide : les **quatre sorties
> du résolveur étaient indistinguables**, donc une mutation qui en échangeait deux était
> **invisible à tout test** — la matrice gagne trois cibles tuables (P16, P17, P18).
>
> **Ce que la décision refuse d'acheter, et le prix est réel.** `E4-10` **reste une obligation
> documentaire** : une écriture bâtie à la main traverse toujours les trois formateurs, et
> [mesuré] **cinq familles** de fautes en sortent. Le formateur-objet l'aurait fermée **par
> signature** — c'est techniquement le meilleur contrat, et il aurait en prime construit deux
> objets `Intl` **par rendu** au lieu de deux **par valeur** (~600 sur une facture de 620 nœuds).
> Il est refusé parce qu'il **invalidait une campagne qui a réellement tourné** : 33 tests sur deux
> builds d'ICU, 29 à 31 mutations, le compte d'exports, la couverture. Un lot qui repasse de
> « mesuré » à « écrit » n'est pas plus sûr, il est seulement plus élégant.
>
> ⛔ **La contrepartie est OBLIGATOIRE, pas facultative :** l'**ADR 0008 recopie verbatim le tableau
> des cinq familles** ([§3.5]), pour que `E4-10` soit **citable** et non seulement documentée. Sans
> cette clause, la décision n'est pas tenue — c'est ce qui la distingue d'un simple statu quo.
>
> *Signal de réouverture, nommé :* un consommateur d'`@openview/core` **hors** de l'équipe qui
> écrit E4. L'obligation tient parce que le seul appelant réel est le lot voisin ; elle ne tient
> plus le jour où un intégrateur appelle `formatMoney` directement.

#### L'analyse qui a mené là

#### Le fait, mesuré, et il est plus large que le dossier ne l'annonçait

`Presentation` est un type **structurel**. Trois de ses cinq champs ne sont protégés que par une
annotation (`currency` est un `string`, les deux bornes des `number`), et une écriture bâtie à la
main traverse les trois formateurs. [mesuré] **cinq familles**, dont une découverte par la revue :

```
currency: 'AB'                 -> RangeError: Invalid currency code : AB
min: 5, max: 2                 -> RangeError: maximumFractionDigits value is out of range.
min: -1                        -> RangeError: minimumFractionDigits value is out of range.
locale: 'i-klingon' | ''       -> RangeError: Incorrect locale information provided
locale: null                   -> TypeError: Cannot convert undefined or null to object   <- R-15
locale: 'zz'                   -> AUCUNE ERREUR : la locale de l'HÔTE, en silence
```

Le remède du dossier est **documentaire** : `E4-10`, « *le moteur ne construit jamais une
`Presentation` à la main* ». Et le [§3.4] justifiait ce choix en écrivant qu'« *aucune porte n'est
possible dans `core`* ». **C'est faux (R-14), et c'est la seule affirmation du dossier qui ferme
une piste au lieu de la coter.**

#### Les deux formes, côte à côte

| | **Aujourd'hui — la forme structurelle** | **La forme proposée — le formateur résolu** |
| :--- | :--- | :--- |
| Signature | `resolvePresentation(t, k): Presentation \| undefined` puis `formatMoney(v, writing)` | `resolveWriting(t, k): WritingResult` puis `result.writing.money(v)` |
| Écriture bâtie à la main | **atteignable** — cinq familles de fautes | ⛔ **inatteignable** : rien d'autre ne construit l'objet |
| Cause du refus | `undefined` — **ni type, ni cause, ni chemin** (R-09) | un résultat **discriminé** : `{ ok: false, reason: 'unknown-writing' \| 'unhonoured-locale' \| 'invalid-writing', writing }` |
| Objets `Intl` construits | **un par valeur** — le [§3.5] le dit et l'assume | **deux par rendu**, fermés dans le formateur. C'est *moins* d'état, pas plus : la durée de vie est celle de la résolution, pas celle du module |
| `E4-10` | une phrase de docstring | **une signature** |
| `D-06b` (le Designer avertit) | il ne reçoit qu'`undefined` | il reçoit **la cause**, donc peut distinguer « tag inconnu » de « écrivez-le sous sa forme courte » (**R-16**) |

#### Ce que ça coûte, et il faut le dire aussi net

1. **Deux types publiés au lieu d'un.** `Presentation` reste la **forme stockée** — elle est sur
   `Template`, elle est parsée par Zod, elle ne peut pas devenir opaque. Le formateur est un
   **second** type, non stocké. Le lot publie donc une paire, et un lecteur doit comprendre
   laquelle des deux il tient.
2. **Trois fonctions libres deviennent des méthodes.** `formatMoney(value, writing)` se teste
   seule, se lit seule, se cite seule dans une docstring. Le [§3.5] défend explicitement « *deux
   fonctions totales et non une avec un paramètre `style`* » ; la façade ne contredit pas cet
   argument-là, mais elle réduit la lisibilité que le dossier revendique.
3. **Le compte d'exports change**, donc `style.test.ts:134` rougit **différemment** de ce qu'annonce
   `INC-3` — le chiffre `126` est à remesurer.
4. **`AGENTS.md §3` (anti-sur-ingénierie) doit être regardé en face.** Ce n'est **pas** un Port :
   il n'y a ni interface à double implémentation, ni adaptateur. C'est un **type de retour**, et la
   règle ne le vise pas. Mais un relecteur pressé y verra une abstraction, et la PR doit le dire.

~~**Recommandation : le formateur résolu**~~ — **tranché à mi-chemin le 2026-08-20 : le résultat
discriminé OUI, le formateur-objet NON.** Le raisonnement qui a fait pencher : sur les deux
garanties du lot qui reposent sur la bonne volonté d'un autre lot, **`E4-8` et `E4-10`**, une seule
avait un consommateur qui souffrait aujourd'hui — `E4-8`, par l'avertissement Designer de `D-06b`
qui ne recevait aucune cause. `E4-10`, elle, n'a d'appelant que **l'équipe qui écrit E4**, et une
obligation citée dans une ADR suffit à contraindre une équipe. **On a donc payé pour la garantie qui
avait un consommateur, et pas pour celle qui n'en a pas encore.**

**Et le refus a été rendu tenable au lieu d'être seulement énoncé** : l'`ADR 0008` recopie le
tableau des cinq familles, ce qui était précisément la condition écrite ci-dessus.

---

### Les mandats non bloquants

`M-1`, `M-5`, `M-6` et `M-7` sont développés au [§7.4], chacun avec le fichier visé, la phrase
exacte **avant** et **après**, le motif, et **le coût de leur refus**. Ils sont résumés dans le
tableau de décision ci-dessus.

Un seul mérite d'être répété ici, parce qu'il est **contre-intuitif** : la contradiction que
l'ADR 0004 D10 avait nommée et laissée ouverte — « *le dépôt a déjà écrit comment C6 formate, dans
un fichier protégé par AGENTS.md §7* » — **ne se déclenche pas**. Elle n'était armée que si C6
classait la table décimale d'ICU parmi les règles métier, ce qui aurait obligé à amender **deux**
fichiers. Le lot ne fait pas cela : il lit une règle **existante** (la décision 16 de
`docs/roadmap/README.md` — les arrondis sont déclarés par le modèle), et il avait mandat pour cette
lecture (`docs/adr/0004-…:659`, « *le classement appartient à C6, qui l'instruira* »).

**Ce qui reste de `M-1` est donc une demande de précision, pas une dérogation** — et son refus ne
coûte rien au lot.
