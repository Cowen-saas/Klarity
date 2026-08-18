# Klarity — Document de référence sécurité
### Garde-fous à respecter pendant le développement (usage OpenCode)

---

## Comment utiliser ce document

Ce document liste les exigences de sécurité non négociables pour Klarity, organisées par domaine. Il complète le TODO fonctionnel existant — il ne le remplace pas. Chaque section peut être copiée telle quelle dans un prompt OpenCode au moment d'implémenter la fonctionnalité concernée, pour que les garde-fous soient posés dès la première version du code, pas ajoutés après coup.

Priorité de lecture si le temps manque : sections 1, 2, 4 et 5 sont critiques dès le MVP. Les sections 3, 6, 7, 8 peuvent suivre en semaine 2-3 mais doivent être planifiées, pas oubliées.

---

## 1. Protection des données de mineurs

**Pourquoi c'est prioritaire** : Klarity traite des données scolaires d'enfants et d'adolescents (3ème à Terminale). C'est la catégorie de donnée la plus sensible du projet et celle qui engage le plus la responsabilité légale.

### Exigences

- [ ] Collecte minimale : nom, classe, filière uniquement à l'inscription élève — aucune donnée superflue (pas d'adresse, pas de photo de profil obligatoire, pas de date de naissance précise si évitable).
- [ ] Le dashboard parent n'affiche **aucune donnée** tant que le lien parent↔enfant n'est pas vérifié (code + OTP validés).
- [ ] Chiffrement au repos (at-rest encryption) sur les tables contenant : notes, lacunes, corrections, historique de quiz — pas seulement les mots de passe/tokens.
- [ ] Chiffrement en transit : TLS obligatoire sur tous les échanges, y compris entre services internes si séparés plus tard.
- [ ] Politique de rétention des données : définir dès maintenant combien de temps une copie corrigée / une session de chat reste stockée après suppression du compte.
- [ ] Conformité Loi n°2000/011/2024/017 (Cameroun) — même référence que pour CREAFLOW, appliquée ici avec un niveau d'exigence plus élevé car public mineur.
- [ ] Droit de suppression : un parent doit pouvoir demander la suppression complète des données de son enfant, avec un process technique réel (pas juste un flag `deleted=true` qui laisse tout accessible en base).

---

## 2. Authentification — le point structurellement le plus faible

**Contexte** : le flux `code ELE-XXX-XXX + téléphone → OTP` est une authentification à faible entropie sur le premier facteur. C'est le point que tenterait un attaquant en premier.

### Exigences

- [ ] Génération du code élève avec une source d'aléa cryptographiquement sûre (`crypto.randomBytes`, jamais `Math.random()`), avec une entropie suffisante pour rendre le brute-force impraticable même en cas d'échec du rate limiting.
- [ ] Rate limiting strict sur la tentative de connexion parent : ex. 5 essais / 15 min par IP **et** par numéro de téléphone (les deux, pas l'un ou l'autre).
- [ ] Le code seul ne doit **jamais** suffire à accéder au dashboard — l'OTP SMS est la vraie barrière d'authentification.
- [ ] OTP : expiration courte (5-10 min), usage unique, invalidé après un nombre d'essais échoués défini.
- [ ] Logging + alerte sur : tentatives répétées de codes invalides, tentatives OTP échouées en rafale — pattern d'attaque évident à détecter tôt.
- [ ] JWT (NextAuth/Auth.js v5) : access token à durée de vie courte, refresh token avec rotation, jamais de session stockée en mémoire locale du process (cohérent avec le principe stateless déjà prévu pour la scalabilité).
- [ ] 2FA obligatoire pour le compte admin, vu l'accès aux données financières et à l'ensemble de la base élèves.

---

## 3. Upload de copies et pipeline vision IA

### Exigences

- [ ] Validation du type MIME réel du fichier uploadé (pas seulement l'extension) — un `.jpg` renommé en `.pdf` doit être détecté.
- [ ] Taille max stricte sur l'upload (définir une limite raisonnable, ex. 10 Mo).
- [ ] Re-encodage de l'image côté serveur avant stockage définitif — élimine les payloads malveillants cachés dans les métadonnées EXIF ou dans le fichier lui-même.
- [ ] URLs signées à durée limitée pour tout accès Cloudflare R2 — jamais de bucket public, jamais d'URL permanente non expirable pour une copie d'élève ou une correction.
- [ ] Séparation stricte contexte système / contenu utilisateur dans les appels à l'API Claude — le texte extrait d'une copie manuscrite ne doit jamais pouvoir être interprété comme une instruction système (prompt injection via contenu détourné dans une réponse d'élève).
- [ ] Quota d'upload par élève/jour pour limiter l'abus (cohérent avec le contrôle des coûts IA déjà identifié dans le document scalabilité).

---

## 4. Paiement (CamerPay, Mobile Money, carte)

### Exigences

- [ ] Vérification de signature HMAC sur **chaque** webhook CamerPay — ne jamais traiter un payload webhook non signé ou dont la signature ne correspond pas.
- [ ] Idempotence du traitement webhook (déjà identifiée côté scalabilité) : vérifier qu'un paiement n'a pas déjà été crédité avant de le traiter une deuxième fois.
- [ ] Aucune donnée de carte ne transite ni ne se stocke côté serveur Klarity — tout doit rester dans l'iframe ou le redirect du prestataire de paiement, zéro PAN en base, zéro PAN en logs.
- [ ] Journalisation immuable des transactions (audit trail append-only) — indispensable pour les litiges Mobile Money, fréquents dans la zone CEMAC.
- [ ] Endpoint webhook accessible uniquement en HTTPS, avec vérification de l'IP source si CamerPay fournit une liste d'IPs autorisées.

---

## 5. Autorisation et isolation des données (IDOR)

**Le risque le plus facile à introduire par erreur** : vérifier qu'un utilisateur est authentifié n'est pas suffisant — il faut aussi vérifier qu'il a le droit d'accéder à **cette** ressource précise.

### Exigences

- [ ] Séparation stricte des rôles (ADMIN / PARENT / ELEVE) appliquée au niveau middleware serveur, jamais seulement côté UI.
- [ ] Chaque route API qui retourne des données liées à un élève (`/api/eleve/[id]`, `/api/lacunes/[id]`, `/api/corrections/[id]`) doit vérifier l'appartenance de la ressource à l'utilisateur courant — pas seulement qu'il est connecté.
- [ ] Un parent ne peut requêter que les données de SON enfant (vérification du lien parent↔enfant à chaque requête, pas seulement à la connexion).
- [ ] Un élève ne peut accéder qu'à ses propres épreuves, corrections et quiz — jamais à ceux d'un autre élève, même en devinant un ID.
- [ ] Tests systématiques d'IDOR sur chaque nouvelle route avant mise en production (essayer d'accéder à la ressource d'un autre utilisateur avec un compte légitime).

---

## 6. Validation des entrées et sécurité API

### Exigences

- [ ] Validation stricte de toutes les entrées API avec Zod (cohérent avec la stack Next.js/Prisma déjà choisie) — épreuves, matières, filtres, tout input utilisateur.
- [ ] Rate limiting par utilisateur sur les endpoints IA (correction, chat, quiz) — protège à la fois contre l'abus et contre le dépassement de marge évoqué dans le document scalabilité (point 8, contrôle des coûts).
- [ ] Sanitization des entrées texte libre (questions au chat IA) avant tout traitement ou stockage.
- [ ] Headers de sécurité standards (CSP, X-Frame-Options, X-Content-Type-Options) sur toutes les réponses HTTP.

---

## 7. Observabilité orientée sécurité

Le monitoring déjà prévu (Sentry, uptime) doit être étendu pour couvrir spécifiquement :

- [ ] Tentatives d'accès non autorisé détectées (IDOR bloqué, rôle incorrect sur une route protégée).
- [ ] Anomalies de connexion : nouveau device pour un parent, tentative de connexion depuis une géolocalisation incohérente.
- [ ] Pics d'appels IA suspects par utilisateur (signal à la fois de sécurité et de dérive de coût).
- [ ] Échecs de vérification de signature webhook — signal d'une tentative de fraude au paiement.

---

## 8. Schéma des flux critiques à protéger

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX 1 — Inscription élève → Génération code                   │
│  Élève saisit nom/classe/filière                                 │
│    → Génération code ELE-XXX-XXX (crypto sûr, haute entropie)   │
│    → Code stocké en base, lié à l'élève                          │
│  ⚠ Point critique : entropie du code                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLUX 2 — Connexion parent                                       │
│  Parent saisit code + téléphone                                  │
│    → Rate limit check (IP + téléphone)                           │
│    → Envoi OTP SMS (usage unique, expiration courte)             │
│    → Vérification OTP                                            │
│    → Vérification lien parent↔élève en base                     │
│    → Accès dashboard (données de CET élève uniquement)           │
│  ⚠ Point critique : le code ne doit jamais suffire seul          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLUX 3 — Upload copie → Correction IA                           │
│  Élève upload photo                                               │
│    → Validation MIME réel + taille                                │
│    → Re-encodage image (nettoyage métadonnées)                   │
│    → Stockage R2 avec URL signée à durée limitée                 │
│    → Job async (queue) → appel API Claude                        │
│      → Contexte système et contenu élève strictement séparés    │
│    → Résultat stocké, notifié à l'élève                          │
│  ⚠ Point critique : isolation prompt système / contenu uploadé   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLUX 4 — Paiement                                                │
│  Élève/Parent initie paiement                                     │
│    → Redirect/iframe CamerPay (aucune donnée carte côté Klarity)│
│    → Webhook CamerPay reçu                                        │
│      → Vérification signature HMAC                               │
│      → Vérification idempotence (paiement déjà traité ?)         │
│    → Crédit abonnement                                            │
│    → Log immuable de la transaction                               │
│  ⚠ Point critique : signature webhook + idempotence               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLUX 5 — Accès aux données (tout endpoint)                      │
│  Requête authentifiée (JWT valide)                                │
│    → Middleware : rôle autorisé pour cette route ?                │
│    → Handler : la ressource demandée appartient-elle             │
│       bien à cet utilisateur ? (vérif explicite, pas supposée)   │
│    → Réponse                                                      │
│  ⚠ Point critique : IDOR — l'auth seule ne suffit jamais          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Priorisation recommandée pour le MVP

| Priorité | Sections | Justification |
|---|---|---|
| **Bloquant MVP** | 2 (Auth), 5 (IDOR), 4 (Paiement) | Sans ça, une faille expose directement des données d'enfants ou de l'argent |
| **Bloquant MVP** | 1 (Mineurs) | Base légale et éthique du projet |
| **Semaine 2-3** | 3 (Upload/IA), 6 (Validation API) | Risque réel mais exploitable seulement une fois la plateforme active |
| **En parallèle, dès le début** | 7 (Observabilité) | Coûte peu à poser tôt, coûte cher à ajouter après un incident |

---

*Document généré pour servir de garde-fou pendant le développement avec OpenCode — à copier section par section dans les prompts au moment d'implémenter la fonctionnalité correspondante.*
