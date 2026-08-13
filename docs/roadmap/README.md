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

Openview aura réussi le jour où **un gestionnaire non développeur produit lui-même
la facture de son entreprise**, et où **un développeur inconnu installe les briques
et obtient ce résultat sans avoir besoin de nous parler**.

Le document de référence est **la facture**, au niveau d'exigence d'un logiciel de
gestion. Tout le reste (rapport, contrat, étiquette) vient après ; rien ne passe
avant.

---

## 2. Les décisions prises

Ces quatorze décisions sont le socle des cinq roadmaps. Les rouvrir, c'est
réordonner le backlog.

| # | Sujet | Décision | Ce que ça protège, ce que ça coûte |
| :-- | :--- | :--- | :--- |
| 1 | Document n°1 | La **facture**, niveau **multi-pages comptable** : totaux reportés de page en page, blocs qui ne se coupent jamais, mentions légales sur la dernière page | Protège la crédibilité : une facture presque juste est inutilisable. Coûte le plus cher des trois niveaux envisagés |
| 2 | Premier succès visible | **Publication open-source des cinq briques d'un bloc**. Rien de public avant | Protège le message produit. Coûte : aucun retour extérieur pendant tout le parcours |
| 3 | Capacité | **Solo, temps partiel** | Impose un seul chantier ouvert à la fois et des lots courts |
| 4 | Ordre | **Brique par brique** : core → engine → viewer → service → designer | Protège la solidité de chaque brique. Coûte : le premier document sort tard |
| 5 | Format de sortie | **PDF uniquement** | Écarte HTML et image du v1. Réduit franchement la charge du moteur |
| 6 | Rôle du viewer | **Aperçu avant génération** | Le document interactif (variables modifiées à la volée) passe en v2, alors que c'est la promesse la plus différenciante |
| 7 | Fidélité de l'aperçu | **Identique au PDF, garanti**, tenu par un **contrôle automatique** | Promesse forte et rassurante. Coûte : aperçu et PDF doivent décider les sauts de page de la même manière, et un contrôle doit le vérifier en continu |
| 8 | Mise en page dans l'éditeur | **Colonnes + grille complète pas à pas** (aide à l'alignement) **+ calques** pour la profondeur | Couvre les factures réelles. Les calques sont le point le plus délicat en multi-pages |
| 9 | Données disponibles | **L'intégrateur déclare le catalogue** (client, lignes, totaux…) | Protège l'utilisateur final : il ne voit que des données existantes, nommées en langage métier. Coûte un travail d'amorçage à l'intégrateur |
| 10 | Stockage des modèles | **L'intégrateur les conserve.** Openview livre un exemple de référence | Tient la promesse *headless*, aucun coût d'exploitation |
| 11 | Langue et devise | **Multi-langue et multi-devise dès le contrat** | Décidé tôt à raison : ajouté après coup, ce sujet touche tout |
| 12 | Service prêt à l'emploi | **Rendu à la demande uniquement.** Ni comptes, ni droits, ni conservation | Reste une petite brique. Ne couvre pas un usage multi-client réel |
| 13 | Premier pas dans l'éditeur | **Bibliothèque de modèles livrés** (facture, rapport, contrat) | Meilleure vitrine et meilleure première expérience. Chaque modèle livré devient une chose à maintenir |
| 14 | Preuve de qualité | **Validation par un utilisateur métier**, plus le contrôle automatique aperçu/PDF | Seule façon de vérifier la conformité réelle. Suppose de trouver cette personne — ce n'est pas encore fait |
| 15 | Capacité de calcul | **Formules type tableur et agrégations**, pleinement dans le périmètre : quatre opérations, somme / compte / moyenne / minimum / maximum sur les lignes, conditions dans les formules, textes, **et calculs de dates** | Rend les modèles autonomes au lieu de réclamer une donnée toute prête pour chaque case. Coûte : c'est le lot le plus lourd du contrat, et il double la surface d'erreur à expliquer à l'utilisateur |
| 16 | Limite de responsabilité | Openview **calcule ce qu'on lui demande** et ne décide d'**aucune règle fiscale ou légale** (taux, exigibilité, exonération, conversion de devise). L'exactitude des montants relève de l'intégrateur et de l'auteur du modèle. Tenu par une **clause explicite**, écrite : section « Calculs, conformité et responsabilité » du [README](../../README.md), à reprendre dans la documentation de chaque brique. En pratique, les **arrondis sont déclarés par le modèle** | Protège le projet sans brider l'outil : la frontière porte sur qui répond des chiffres, pas sur ce que l'outil sait faire. Coûte : une clause seule est une protection déclarative, voir le risque associé en §6 |
| 17 | Auteur des formules | **L'utilisateur non-développeur**, dans une barre de formule assistée (champs proposés, résultat en direct, erreurs guidées) | La décision la plus engageante de la roadmap : elle fait du designer la brique la plus lourde des cinq. C'est aussi ce qui distingue un vrai éditeur d'un afficheur de modèles |

> **Principe qui tranche les cas non prévus :** *Openview fournit la capacité, pas la
> règle.* On ajoute volontiers une opération, une agrégation, une fonction de date. On
> n'ajoute jamais une règle fiscale, un taux, un barème, ni la moindre formulation qui
> laisserait croire qu'Openview garantit une conformité.

---

## 3. Les jalons

Aucun n'est public : la publication est groupée (décision 2). Ils existent pour
**prouver l'avancement à soi-même** et éviter le tunnel.

| Jalon | Ce qu'on peut montrer | Brique |
| :--- | :--- | :--- |
| **J1** | Une facture comptable complète, en deux langues, est **décrite** dans un modèle ; un modèle incohérent est refusé avec un message compréhensible | [core](core.md) |
| **J2** | Un modèle + un jeu de données donnent une **facture d'une page en PDF** | [engine](engine.md) |
| **J3** | La **facture comptable** sort : 3 pages, 60 lignes, totaux reportés, mentions au bon endroit, en français/euros puis anglais/dollars | [engine](engine.md) |
| **J4** | On **voit la facture avant de la produire**, et un contrôle automatique atteste que l'aperçu et le PDF sont identiques | [viewer](viewer.md) |
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

Écrit noir sur blanc pour pouvoir dire non sans rediscuter :

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

1. **La bibliothèque de modèles** passe de trois à un seul (la facture).
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
5. **Jusqu'où vont les calculs de dates ?** « + 30 jours » est trivial. « 45 jours fin de mois », « jours ouvrés », les jours fériés — usages de paiement parfaitement courants — sont un nid à cas particuliers, et chacun est une petite règle de plus à porter. À borner explicitement. *Bloque le lot C1 du [contrat](core.md).*
6. **Quels arrondis dans les modèles livrés ?** Puisque Openview n'impose aucune règle par défaut (décision 16), les modèles livrés doivent en déclarer une — et ce choix sera recopié par tous ceux qui partiront de ces modèles. C'est donc une position par défaut de fait : autant la choisir sciemment. *Bloque le lot D9 de l'[éditeur](designer.md).*
