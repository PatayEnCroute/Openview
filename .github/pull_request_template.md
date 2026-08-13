## 🛡️ Vérification de Sécurité & Checklist

Avant de soumettre cette Pull Request, merci de vous assurer que les points suivants sont respectés :

### 🔒 Sécurité
- [ ] Aucun secret, clé API, jeton d'accès ou fichier d'environnement (`.env`) n'est présent dans les modifications.
- [ ] Tout contenu ou template rendu/injecté est assaini pour éviter les failles XSS.
- [ ] Aucune nouvelle dépendance contenant des vulnérabilités connues n'a été ajoutée.

### 🧭 Périmètre
- [ ] Aucun nom de champ réservé, aucune structure de données attendue de l'intégrateur.
- [ ] Aucune lecture d'environnement introduite dans `core`/`engine` (`Date.now()`, `new Date()` sans argument, `Intl.*` sans locale explicite, `Math.random`, `process.env`).
- [ ] Aucune règle métier (taux, barème, arrondi « légal ») n'entre dans le code.

### 🧪 Qualité & Tests
- [ ] Les types TypeScript sont valides sans erreurs.
- [ ] Les tests unitaires/d'intégration passent localement.
- [ ] La documentation a été mise à jour si nécessaire.

### 📝 Description des changements
<!-- Décrivez brièvement les modifications apportées -->
