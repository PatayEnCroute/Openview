# Roadmap Openview — vue d'ensemble

> **Document produit.** Il dit *quoi* livrer, *dans quel ordre* et *pourquoi*.
> Il ne dit pas comment : les choix techniques vivent dans
> [ARCHITECTURE.md](../../ARCHITECTURE.md) et [docs/adr/](../adr/).
>
> Une roadmap par brique : [core](core.md) · [engine](engine.md) ·
> [viewer](viewer.md) · [designer](designer.md) ·
> [service de rendu](service-de-rendu.md).

---

## 1. Le cap

Openview est un **moteur d'édition embarquable** : un concepteur visuel de modèles
et un moteur de rendu, installés dans l'application d'un tiers. Ce n'est ni un
logiciel de gestion, ni un outil de facturation, ni une source de données — c'est
l'application intégratrice qui décide de ce que contient le document.

Openview aura réussi le jour où **une personne non technique produit elle-même,
seule, la facture de son entreprise** — à l'intérieur de l'application qui
l'héberge, et sans jamais sortir de son métier — et où **un développeur inconnu
installe les briques et obtient ce résultat sans avoir besoin de nous parler**. La
facture parce que c'est ce que mesure le jalon J6 ; n'importe quelle édition
ensuite, parce que rien dans les briques ne la connaît.

Le **document de référence** retenu est **la facture** : c'est le niveau d'exigence
à atteindre, pas le périmètre. Elle est choisie parce qu'elle concentre les
contraintes les plus dures — multi-pages comptable, totaux reportés de page en
page, blocs **insécables** non coupés dès qu'ils peuvent tenir sur une page et
repli documenté au-delà, deux langues et deux devises. Ce qui rend une facture
possible rend possibles les rapports, les relevés, les bons de livraison,
les contrats, les courriers et les bordereaux : ces éditions attendent la même
barre, pas un lot de plus. **L'étiquette fait exception**, et pour une raison
étrangère à cette barre : elle réclame une sortie image, écartée du v1 par la
décision 5 (§5). Le reste vient après la facture ; rien ne passe avant elle.

Les jalons du §3, et les critères de recette des cinq roadmaps par brique, parlent
donc de factures, et pour cette raison seule.

---

## 2. Les décisions prises

Ces dix-sept décisions sont le socle des cinq roadmaps. Les rouvrir, c'est
réordonner le backlog.

| # | Sujet | Décision | Ce que ça protège, ce que ça coûte |
| :-- | :--- | :--- | :--- |
| 1 | Document n°1 | La **facture**, niveau **multi-pages comptable** : totaux reportés de page en page, blocs **insécables** non coupés dès qu'ils peuvent tenir sur une page, avec repli documenté au-delà ([ADR 0009](../adr/0009-les-blocs-insecables.md)), mentions légales sur la dernière page | Protège la crédibilité : une facture presque juste est inutilisable. **C'est le niveau d'exigence, pas le périmètre** : la facture concentre les contraintes les plus dures, et une brique qui les tient rend toutes les autres éditions accessibles. Coûte le plus cher des trois niveaux envisagés |
| 2 | Premier succès visible | **Publication open-source des cinq briques d'un bloc**. Rien de public avant | Protège le message produit. Coûte : aucun retour extérieur pendant tout le parcours |
| 3 | Capacité | **Solo, temps partiel** | Impose un seul chantier ouvert à la fois et des lots courts |
| 4 | Ordre | **Brique par brique** : core → engine → viewer → service → designer | Protège la solidité de chaque brique. Coûte : le premier document sort tard |
| 5 | Format de sortie | **PDF uniquement** | Écarte HTML et image du v1. Réduit franchement la charge du moteur |
| 6 | Rôle du viewer | **Aperçu avant génération** | Le document interactif (variables modifiées à la volée) passe en v2, alors que c'est la promesse la plus différenciante |
| 7 | Fidélité de l'aperçu | **Identique au PDF, garanti**, tenu par un **contrôle automatique** | Promesse forte et rassurante. Coûte : aperçu et PDF doivent décider les sauts de page de la même manière, et un contrôle doit le vérifier en continu |
| 8 | Mise en page dans l'éditeur | **Colonnes + grille complète pas à pas** (aide à l'alignement) **+ calques** pour la profondeur | Couvre les mises en page réelles, à commencer par les plus contraintes. Les calques sont le point le plus délicat en multi-pages |
| 9 ✅ | Données disponibles | **L'intégrateur déclare le catalogue, et il en est propriétaire.** Il choisit les données exposées, leurs libellés et leur structure ; Openview n'attend aucun nom, n'en réserve aucun et n'en impose aucun. Un catalogue peut décrire un client et des lignes de commande comme un dossier, un relevé ou un contrat. *Livré le 2026-08-26 par [C10](core.md#c10-le-catalogue-de-données-de-lintégrateur) et l'[ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md) : le catalogue n'entre pas dans le modèle, et la compatibilité se vérifie sans aucun jeu de données* | Protège l'utilisateur final : il ne voit que des données existantes, nommées en langage métier. Coûte un travail d'amorçage à l'intégrateur |
| 10 | Stockage des modèles | **L'intégrateur les conserve.** Openview livre un exemple de référence | Tient la promesse *headless*, aucun coût d'exploitation |
| 11 | Langue et devise | **Multi-langue et multi-devise dès le contrat** | Décidé tôt à raison : ajouté après coup, ce sujet touche tout |
| 12 | Service prêt à l'emploi | **Rendu à la demande uniquement.** Ni comptes, ni droits, ni conservation — **ni du modèle, ni du jeu de données transmis, ni du document produit**. Le service reçoit, rend, oublie | Reste une petite brique. Ne couvre pas un usage multi-client réel |
| 13 | Premier pas dans l'éditeur | **Bibliothèque de modèles livrés** (facture, rapport, contrat) | Meilleure vitrine et meilleure première expérience. Chaque modèle livré devient une chose à maintenir |
| 14 | Preuve de qualité | **Validation par un utilisateur métier**, plus le contrôle automatique aperçu/PDF | Seule façon de vérifier la conformité réelle. Suppose de trouver cette personne — ce n'est pas encore fait |
| 15 | Capacité de calcul | **Formules type tableur et agrégations**, pleinement dans le périmètre : quatre opérations, somme / compte / moyenne / minimum / maximum sur les lignes, conditions dans les formules, textes, **et calculs de dates** | Rend les modèles autonomes au lieu de réclamer une donnée toute prête pour chaque case. Coûte : c'est le lot le plus lourd du contrat, et il double la surface d'erreur à expliquer à l'utilisateur |
| 16 | Limite de responsabilité | Openview **calcule ce qu'on lui demande** et ne décide d'**aucune règle fiscale ou légale** (taux, exigibilité, exonération, conversion de devise). L'exactitude des montants relève de l'intégrateur et de l'auteur du modèle. Tenu par une **clause explicite**, écrite : section « Calculs, conformité et responsabilité » du [README](../../README.md), à reprendre dans la documentation de chaque brique. En pratique, les **arrondis sont déclarés par le modèle** | Protège le projet sans brider l'outil : la frontière porte sur qui répond des chiffres, pas sur ce que l'outil sait faire. Coûte : une clause seule est une protection déclarative, voir le risque associé en §6 |
| 17 | Auteur des formules | **L'utilisateur non-développeur**, dans une barre de formule assistée (champs proposés, résultat en direct, erreurs guidées) | La décision la plus engageante de la roadmap : elle fait du designer la brique la plus lourde des cinq. C'est aussi ce qui distingue un vrai éditeur d'un afficheur de modèles |

> **Principe qui tranche les cas non prévus :** *Openview fournit la capacité, pas la
> règle.* On ajoute volontiers une opération, une agrégation, une fonction de date. On
> n'ajoute jamais une règle fiscale, un taux, un barème, ni la moindre formulation qui
> laisserait croire qu'Openview garantit une conformité.

> **Son symétrique, sur les données :** *Openview fournit la capacité, pas la
> donnée.* L'application intégratrice décide de ce que contient le document : elle
> déclare son catalogue, elle fournit le jeu de données, elle possède les noms des
> champs et leurs libellés. Openview ne réclame aucune donnée nommée, n'en réserve
> aucune et n'attend aucune structure particulière. Un modèle Openview sait dire
> *comment* présenter et calculer ; il ne sait pas, et n'a pas à savoir, *quoi*.

---

## 3. Les jalons

Aucun n'est public : la publication est groupée (décision 2). Ils existent pour
**prouver l'avancement à soi-même** et éviter le tunnel.

> Rappel du §1 : ces sept jalons sont des **critères de recette**. Ils se disent en
> factures parce que la facture est le niveau d'exigence retenu — jamais parce que
> le produit s'arrêterait aux factures.

| Jalon | Ce qu'on peut montrer | Brique |
| :--- | :--- | :--- |
| **J1** ✅ | *Atteint le 2026-08-21.* Une facture comptable complète, en deux langues, est **décrite** dans un modèle ; un modèle incohérent est refusé avec un message compréhensible. Les **dix cas de recette** — cinq refus de contrat, cinq erreurs de formule — sont démontrés par le playground à travers la façade publique de [C8](core.md#c8-un-refus-compréhensible) | [core](core.md) |
| **J2** ✅ | *Atteint le 2026-08-21.* Un modèle + un jeu de données donnent une **facture d'une page en PDF** à la feuille déclarée, et le playground permet réellement de choisir un modèle, choisir un jeu de données et télécharger le résultat. Chromium vit derrière un paquet adaptateur distinct ; un contenu qui ne tient pas est **refusé**, jamais tronqué ([ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md)). Le refus mono-page a depuis laissé place à une pagination explicite, sans rien concéder sur « jamais tronqué » ([ADR 0013](../adr/0013-le-tableau-deborde-proprement.md)) | [engine](engine.md) |
| **J3** | La **facture comptable** sort : 60 lignes paginées, totaux reportés, mentions au bon endroit, en français/euros puis anglais/dollars. La pagination et l'en-tête répété sont livrés ([ADR 0013](../adr/0013-le-tableau-deborde-proprement.md)) ; les **reports de page, les blocs insécables, les veuves et orphelines et les mentions de dernière page le sont aussi** ([ADR 0014](../adr/0014-les-exigences-comptables.md)) — la recette produit quatre feuilles, non trois. Les **deux langues** le sont également ([ADR 0017](../adr/0017-langue-et-devise-au-rendu.md)) : le même modèle sort en français/euros et en anglais/dollars, sur quatre feuilles dans les deux cas. **Reste la seule relecture par un gestionnaire**, qui n'a pas eu lieu | [engine](engine.md) |
| **J4** | On **voit la facture avant de la produire**, et un contrôle automatique atteste que l'aperçu et le PDF sont identiques. Sa **condition moteur est levée** : E5 rend publique la découpe et la source que le PDF imprime, sans produire un octet de PDF ([ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md)). **Rien du jalon n'est atteint pour autant** — aucun viewer n'affiche encore cette source, et aucune comparaison aperçu/PDF n'a eu lieu | [viewer](viewer.md) |
| **J5** | Une application tierce obtient sa facture **sans installer le moteur** | [service](service-de-rendu.md) |
| **J6** | Un **gestionnaire non développeur** part d'un modèle livré, produit la facture de son entreprise **et écrit une formule juste**, seul | [designer](designer.md) |
| **J7** | Publication : cinq briques, une documentation par brique, des exemples, une démo en ligne essayable | transverse |

> **Règle de conduite :** on ne commence pas un jalon avant que le précédent soit
> démontrable. En temps partiel, deux chantiers ouverts en parallèle, c'est deux
> chantiers inachevés.

---

## 4. Chantiers transverses

Ils ne se rattachent à aucune brique, et sont pourtant la condition de J7.

| Chantier | Contenu | Quand |
| :--- | :--- | :--- |
| **Playground** | La vitrine interne : à chaque jalon, il montre l'état réel. C'est lui qui rend les jalons démontrables | À chaque jalon, un peu |
| **Documentation d'intégration** | Un guide de démarrage et une référence par brique. La **clause de responsabilité** (décision 16) est déjà en place dans le [README](../../README.md) ; elle sera reprise dans la documentation de chaque brique | Rédigée au fil de l'eau, figée avant J7 |
| **Exemples d'intégration** | Deux ou trois projets complets à copier, dont **l'exemple de conservation des modèles** (décision 10) | Après J5 |
| **Démo en ligne essayable** | Une page publique : on manipule l'éditeur, on télécharge un PDF. Le meilleur argument d'un projet open-source | Après J6, condition de J7 |

---

## 5. Hors périmètre de la première version

Écrit noir sur blanc pour pouvoir dire non sans rediscuter. Les trois premières
lignes ne sont pas des reports en v2 : ce sont des **non permanents**, qui tiennent
à la nature du produit.

- Openview n'est pas une **source de données** : aucune base interrogée, aucun référentiel client, article ou tarif détenu. Il reçoit un jeu de données, il ne va rien chercher.
- Openview n'est pas un **logiciel de gestion** : aucun cycle de vie de document, aucun statut, aucun envoi, aucun suivi de règlement.
- Openview n'a pas d'**horloge** : ni date du jour, ni fuseau, ni locale système. « Aujourd'hui » est une donnée du jeu fourni. Ce n'est pas une préférence, c'est ce qui rend possible le déterminisme du lot E6 du [moteur](engine.md).
- Sorties **HTML** et **image** (décision 5), et par conséquent les étiquettes et les vignettes d'aperçu.
- **Document interactif** : l'utilisateur qui modifie des variables et voit le document se recalculer (décision 6) — reporté en v2 alors qu'il porte la promesse la plus forte.
- **Comptes, droits, cloisonnement entre clients**, conservation des modèles côté service (décisions 10 et 12).
- **Graphiques**, table des matières, signature électronique, formulaires remplissables.
- **Toute règle fiscale ou légale** : taux de TVA, régimes, barèmes, arrondis « légaux », conversion de devise à un taux officiel. Openview calcule, il ne décide pas (décision 16).
- **Les fonctions définies par l'utilisateur** et les bibliothèques de formules réutilisables entre modèles.
- **La traçabilité des calculs** (« d'où vient ce montant ? ») : écartée du v1, alors que c'est la meilleure défense le jour où un chiffre sera contesté. À rouvrir si cela arrive.
- **Positionnement libre au millimètre** sur la page : la grille et les calques couvrent le besoin retenu (décision 8).
- **Reprise de modèles existants** (Word, HTML, autre outil d'édition) : chaque modèle est recréé.

---

## 6. Risques assumés

| Risque | Pourquoi il est réel | Ce qui l'atténue |
| :--- | :--- | :--- |
| **Le tunnel** | Publication groupée + solo à temps partiel + le niveau d'exigence le plus élevé : des mois sans un seul retour extérieur. C'est le risque n°1 du projet | Les sept jalons ci-dessus, et le playground tenu à jour |
| **Personne pour valider** | La preuve de qualité repose sur un utilisateur métier (décision 14) qui **n'est pas identifié**. Sans lui, J6 n'est pas prononçable | Action ouverte n°1 (§8) |
| **Calques et multi-pages** | Placer un élément « en profondeur » sur un document dont le contenu se déplace de page en page est le point le plus casse-gueule de l'éditeur | Traiter les calques en dernier lot du designer, sur un périmètre volontairement étroit (fonds, filigranes, cachets) |
| **Trois modèles livrés à maintenir** | Chaque évolution du contrat oblige à retoucher facture, rapport et contrat | Premier candidat à la réduction (§7) |
| **Une garantie au pixel** | « Identique » est un mot fort : il engage sur chaque évolution du moteur | Le contrôle automatique aperçu/PDF (décision 7), à ne jamais désactiver |
| **La barre de formule** | Le plus gros morceau isolé de toute la roadmap. Faire écrire une formule à un non-développeur, c'est le problème que les tableurs ont mis trente ans à rendre supportable | Repli prévu d'avance : *mode avancé* — les formules restent, l'assistance disparaît, l'intégrateur les écrit (§7) |
| **Une clause, et rien d'autre** | La limite de responsabilité repose sur une phrase dans la documentation. Deux protections plus solides ont été écartées : interdire les noms de fonctions à consonance fiscale, et figer la frontière dans une décision écrite. Une phrase ne résiste pas à une demande client pressante | Rien pour l'instant. À rouvrir le jour où une fonction à nom fiscal ou une règle de TVA est demandée — c'est le signal, il faut le reconnaître |

---

## 7. Si le temps manque — ordre de sacrifice

Décidé maintenant, à froid. En cas de retard, on coupe **dans cet ordre** :

1. **La bibliothèque de modèles** passe de trois à un seul (la facture). Effet de bord à assumer : ce n'est pas deux modèles qu'on perd, c'est la **démonstration visible** qu'Openview n'est pas un outil de facturation.
2. **Les calques** sortent du v1 ; grille et colonnes suffisent à une facture.
3. **La barre de formule assistée** retombe en *mode avancé* : les formules et les agrégations restent pleinement fonctionnelles, mais c'est l'intégrateur qui les écrit dans les modèles livrés. La **capacité** est conservée, seul le **confort** est reporté.
4. **La démo en ligne** est remplacée par les exemples d'intégration.
5. **Le service de rendu** est reporté : un intégrateur peut appeler le moteur directement.

Quatre choses ne se sacrifient jamais, parce que les rattraper après coup coûte
plus cher que de les tenir :

- Le **multi-langue et multi-devise** dans le contrat de données.
- Le comportement **multi-pages comptable**.
- Le **contrôle automatique** aperçu / PDF.
- Les **arrondis déclarés par le modèle** : ajoutés après coup, ils faussent tous les modèles déjà écrits.

---

## 8. Décisions encore ouvertes

À trancher avant les jalons concernés, pas avant :

1. **Qui valide les factures produites ?** Il faut nommer un gestionnaire ou un comptable, et prévoir deux séances : une à J3 (le PDF est-il conforme ?), une à J6 (l'éditeur est-il utilisable ?). *Bloque J6.*
2. **Quelles langues exactement au premier jour ?** Multi-langue est décidé ; la liste ne l'est pas. Deux langues suffisent à prouver le mécanisme. *Bloque J1.*
3. **Quel intégrateur de référence ?** La documentation et les exemples sont bien meilleurs s'ils sont écrits pour une application précise, même interne. *Bloque J7.*
4. **Quelles mentions légales obligatoires** sur une facture, et pour quels pays ? Cela conditionne le modèle livré. *Bloque le modèle de facture, pas le moteur.*
5. ~~**Jusqu'où vont les calculs de dates ?**~~ ✅ **Tranchée le 2026-08-13** par l'[ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md), qui débloque le lot C1 du [contrat](core.md).

   **Le bornage retenu : « date civile pure ».** Une opération de date entre dans l'algèbre **si et seulement si** (1) son résultat est une fonction pure de ses arguments explicites — aucune convention à choisir, aucune table de règles embarquée — et (2) elle ne lit **rien** de l'environnement. Trois opérations passent ce critère et sont livrées : **`dateAdd(date, jours)`**, **`dateDiff(de, à)`** en jours, et **`endOfMonth(date)`** — dont la composition donne « 45 jours fin de mois », l'usage de paiement qui motivait la question.

   **Exclus par écrit**, chacun avec le critère qui l'élimine : **`addMonths`/`addYears`**, parce que « 31 janvier + 1 mois » est une *convention* (28 ? 29 ? 3 mars ?) et non un calcul — c'est la porte d'entrée du nid à cas particuliers, et `endOfMonth` couvre le besoin réel sans jamais l'ouvrir ; **les jours ouvrés, les fériés et les calendriers nationaux**, parce qu'un calendrier de fériés se périme et change par pays : c'est une **donnée de l'intégrateur**, et si le besoin arrive l'extension prendra les fériés *en argument*, jamais dans une table interne ; **les heures, les fuseaux et `today()`**, qui échouent au critère 2.

   **Ce qui était déjà tranché, et ne se rouvre pas :** l'algèbre d'expressions **n'a pas d'horloge**. Openview ne lit jamais la date du jour ; « aujourd'hui » est une **donnée du jeu fourni**, nommée par l'intégrateur comme il l'entend. Ce n'est pas une convention qu'on impose, c'est la conséquence directe du déterminisme exigé par le lot E6 du [moteur](engine.md) : un moteur qui lit l'heure ne peut pas produire deux fois le même document. Cette moitié est désormais **outillée** et non plus seulement écrite — un `override` Biome et un plugin GritQL refusent la lecture d'environnement dans `core` et `engine`.
6. **Quels arrondis dans les modèles livrés ?** Puisque Openview n'impose aucune règle par défaut (décision 16), les modèles livrés doivent en déclarer une — et ce choix sera recopié par tous ceux qui partiront de ces modèles. C'est donc une position par défaut de fait : autant la choisir sciemment. *Bloque le lot D9 de l'[éditeur](designer.md).*
