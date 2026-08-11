# Politique de Sécurité (Security Policy)

La sécurité du projet Openview est une priorité essentielle, d'autant plus que le dépôt est public et destiné à être intégré dans des applications tierces.

---

## 🛡️ Signalement d'une Vulnérabilité

Si vous découvrez une vulnérabilité de sécurité dans Openview, **ne créez pas d'issue publique sur GitHub**. 

Veuillez suivre la procédure suivante pour un signalement responsable :

1. **Privé via GitHub Security Advisories :** Rendez-vous dans l'onglet **Security** du dépôt GitHub et cliquez sur **Report a vulnerability**.
2. **Par Email :** Envoyez un courriel directement aux mainteneurs du projet avec les détails de la faille et une démonstration/POC minimale si possible.

Nous nous engageons à reconnaître la réception de votre signalement sous **48 heures** et à fournir des mises à jour régulières sur la résolution du problème.

---

## 🔒 Bonnes Pratiques de Sécurité pour les Contributeurs

1. **Aucun Secret / Clé dans le Code :**
   - Ne commitez **jamais** de clés API, jetons d'accès, mots de passe, ou clés privées (`.env`, `.pem`, etc.).
   - Utilisez des variables d'environnement locales documentées dans `.env.example`.

2. **Validation des Entrées & Injections :**
   - Le moteur de rendu (`@openview/engine`) et le visualiseur (`@openview/viewer`) exécutent et affichent du contenu dynamique. Assurez-vous que tout contenu HTML ou template injecté est correctement nettoyé/assaini (*sanitized*) pour prévenir les attaques **XSS (Cross-Site Scripting)** et les **injections de code**.

3. **Gestion des Dépendances :**
   - Effectuez régulièrement un audit des dépendances avec `pnpm audit`.
   - Ne validez aucun PR introduisant des dépendances vulnérables ou suspectes.

---

## 📌 Versions Supportées

| Version | Prise en charge |
| :--- | :--- |
| **Main (Dernière version)** | ✅ Oui (Correctifs de sécurité actifs) |
| **Versions antérieures** | ⚠️ Selon la sévérité |
