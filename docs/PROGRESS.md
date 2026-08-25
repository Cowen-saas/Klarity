# Klarity — État d'avancement

_Dernière mise à jour : 25 août 2026 (soir)_

## 1. Où en est le projet, dans l'ensemble

Klarity est en tout début de développement effectif : le cadrage produit et technique est
consolidé (cahier des charges v1.28, `docs/specs/Klarity_Cahier_des_Charges.pdf`), le schéma
de données est finalisé et migré, et le socle d'infrastructure (Phase 0 de la roadmap, §10 du
CDC) est en place. Aucune fonctionnalité métier (inscription, banque d'épreuves, correction,
dashboard parent, back-office admin) n'est encore implémentée — l'application ne sert
aujourd'hui qu'une page d'accueil de test (`src/app/page.tsx` : `Hello world!`).

Le dépôt est maintenant sur GitHub (`git@github.com:Cowen-saas/Klarity.git`, branche `main`),
avec authentification SSH configurée.

## 2. Étape 0 (Phase 0 — Socle), telle que définie dans le CDC §10

Le CDC découpe l'implémentation en 8 phases (0 à 7), séquencées pour ne jamais être bloquées
par les deux accès externes encore en attente (CamerPay live, clé API Anthropic Claude) — ces
deux dépendances sont développées en mode mock dès la Phase 1 et basculées en mode réel sans
réécriture de code applicatif, à condition de respecter les interfaces `AIProvider` et
`PaymentProvider` dès la Phase 0.

**Phase 0 — Socle**, telle que définie :
- Docker Compose (`app`, `worker`, `postgres`, `redis`)
- `prisma validate` puis `prisma migrate dev` sur le schéma finalisé (§4)
- Auth.js v5 avec flux code élève + PIN (élève) et code élève + téléphone + OTP (parent), §2.7
- Rôles `ADMIN` / `PARENT` / `ELEVE`
- Aucune dépendance externe requise — développable immédiatement

## 3. Ce qui est fait / validé jusqu'à maintenant

### Socle technique (Phase 0 — complète)
- **Next.js 15.5** scaffoldé (App Router, TypeScript, Tailwind v4, ESLint).
- **Docker Compose** : `app`, `worker`, `postgres`, `redis`, `adminer` (outil de dev en plus du
  minimum requis).
- **Prisma** : `schema.prisma` finalisé (26 modèles, 22 enums, conforme au §4 du CDC) et migré
  (`prisma/migrations/20260819070754_init`).
- **Auth.js v5**, sessions JWT stateless avec rotation de refresh token (`src/auth.ts`) :
  - Provider `eleve` — code élève + PIN (verrouillage après échecs répétés, `PIN_MAX_ATTEMPTS`).
  - Provider `parent` — code élève + téléphone + OTP (`/api/auth/parent/request-otp`), qui
    établit le `ParentEleveLink` a posteriori dès la première vérification réussie.
  - Provider `admin` — email + mot de passe + TOTP obligatoire (2FA).
  - `src/middleware.ts` applique le cloisonnement de rôle par préfixe de route
    (`/admin`, `/parent`, `/eleve`) côté serveur, via `src/lib/auth/session.ts` — la
    vérification d'appartenance à la ressource précise (IDOR) reste à faire par route en
    Phase 1+ (voir §5, item ouvert).

### Anticipation Phase 1 (déjà en avance sur la roadmap)
Le CDC recommande explicitement de respecter les interfaces `AIProvider` et `PaymentProvider`
dès la Phase 0 même en mode mock, pour que les Phases 3 et 4 (bascule vers les services réels)
se limitent à un changement de configuration. C'est déjà fait :
- `src/lib/ai/` — interface `AIProvider` + `MockAIProvider` (`.chat()`, `.corrigerCopie()`,
  `.genererQuiz()`, simulation de rate limit, estimation de tokens).
- `src/lib/payment/` — interface `PaymentProvider` + `MockPaymentProvider`
  (`.initierPaiement()`, `.traiterWebhook()`, `.verifierSignatureWebhook()`).

### Clarification Tuteur IA vs Correction IA (fait et poussé — commit `f1b7754`)
Le graphe de connaissances (voir ci-dessous) avait fait remonter une ambiguïté : les maquettes
ne distinguaient pas visuellement le chat Tuteur IA de la Correction IA. Investigation dans le
CDC → la réalité fonctionnelle est plus fine que prévu : **trois chemins de code**, pas deux,
tous documentés maintenant dans `CLAUDE.md` (section *"Tuteur IA (chat) vs. Correction IA
(upload pipeline)"*) :
1. **Chat général (mode 1)** — `chat(messages, contexteMatiere)`, Haiku, `epreuveId = NULL`.
2. **Chat contextualisé à une épreuve (mode 2)** — `chat(messages, contexteMatiere,
   contexteEpreuve)`, Haiku, `epreuveId` renseigné, ne produit jamais de note.
3. **Correction IA** — `corrigerCopie(...)`, Sonnet + vision, uniquement `numeroTentative == 1`.

Le CDC est passé en **v1.28** (`docs/specs/Klarity_Cahier_des_Charges.pdf`, régénéré en place,
pagination et TOC vérifiées cohérentes) avec un nouveau §2.1.1 imposant trois exigences UI pour
que cette distinction reste visible dans les futures maquettes : bandeau contextuel pour le
mode 2, bouton "Discuter de cette copie" sur l'écran de résultat de correction, et réutilisation
de l'icône Tuteur IA (jamais l'icône Correction) sur toute surface de chat.

### Graphe de connaissances Graphify
Le corpus complet du projet (code, specs, maquettes, barèmes) est indexé dans un graphe
persistant (`graphify-out/`) : **513 nœuds, 741 arêtes, 39 communautés**, santé du graphe
propre (aucune arête orpheline). Mis à jour de façon incrémentale (`graphify --update`) à
chaque changement de fond — dernière mise à jour après la clarification Tuteur IA/Correction IA
ci-dessus. Sert de garde-fou pour repérer les incohérences entre maquettes, CDC et code au fil
du développement.

## 4. Audit fonctionnel de la Phase 0 (25 août 2026)

Avant de passer en Phase 1, audit point par point de la checklist §10 du CDC — pas une relecture
de code, mais des tests réels : stack Docker démarrée, comptes de test seedés en base avec les
vraies fonctions de hash du code (`bcryptjs`, `otplib`), endpoints tapés en HTTP (`curl`),
résultats vérifiés en base après coup.

| Item checklist §10 | Statut | Preuve |
|---|---|---|
| Docker Compose (app, worker, postgres, redis) | ✅ | 5 conteneurs up ; bug de build trouvé et corrigé (voir ci-dessous) |
| `prisma validate` + `prisma migrate dev` | ✅ testé | `prisma validate` → schéma valide ; `prisma migrate status` → à jour, 1 migration appliquée, 27 tables réelles vérifiées |
| Connexion élève (code + PIN) | ✅ testé bout en bout | Bon PIN → session JWT `role: ELEVE` réelle ; mauvais PIN → rejeté, `pinTentativesEchouees` incrémenté en base, `AuditLogSecurite(PIN_FAIL)` créé |
| Connexion parent (code + téléphone + OTP) | ✅ testé bout en bout | OTP réel généré/loggé, login → session `role: PARENT`, `ParentEleveLink` créé a posteriori en base |
| Connexion admin (email + mot de passe + TOTP) | ✅ testé bout en bout | Code TOTP réel généré via `otplib`, login → session `role: ADMIN` |
| Rôles ADMIN/PARENT/ELEVE — cloisonnement middleware | ✅ **corrigé puis testé bout en bout** | Voir ci-dessous — était cassé (500 sur toute route protégée), maintenant vérifié sur les 3 rôles × 3 zones |

### Bug trouvé et corrigé : middleware de cloisonnement de rôle cassé

`src/middleware.ts` tourne en Edge Runtime et importait `auth` depuis `src/auth.ts`, qui embarque
les 3 providers Credentials — dont `src/lib/auth/otp.ts` (`import { randomInt } from
"node:crypto"`). L'Edge Runtime ne sait pas bundler les modules Node natifs, donc **le middleware
ne compilait même pas** (`UnhandledSchemeError: Reading from "node:crypto"`) : toute requête vers
`/admin`, `/parent` ou `/eleve` renvoyait 500 au lieu du redirect/gate attendu. Le cloisonnement
de rôle n'avait donc jamais réellement protégé quoi que ce soit, malgré un code source correct.

**Correction appliquée** : extraction d'un helper allégé `src/lib/auth/session.ts` qui décode le
JWT de session directement via `getToken()` (`next-auth/jwt`, lui-même compatible Edge) au lieu
d'importer toute la config NextAuth. `middleware.ts` est réécrit en middleware Next.js simple
(plus de wrapper `auth(...)`) qui appelle `getMiddlewareSession(req)`.

**Retest après correction** — sessions fraîches (élève/parent/admin) contre les 3 zones :
- Aucune session → `/admin` : **307 → `/connexion`** ✅
- Session ELEVE → `/admin`, `/parent` (mauvais rôle) : **307 → `/connexion`** ✅
- Session ELEVE → `/eleve`, session PARENT → `/parent`, session ADMIN → `/admin` (bon rôle) :
  **laissé passer par le middleware** (pas de redirect) ✅
- Logs applicatifs confirmés propres après redémarrage du conteneur :
  `✓ Compiled /middleware in 2.7s (177 modules)` — plus aucune trace de `node:crypto`.

### Bug trouvé et corrigé : `lightningcss` / Tailwind v4 cassé sur l'image Docker

Trouvé pendant le retest du middleware ci-dessus : une fois le rôle validé, les requêtes "bon
rôle → laissé passer" tombaient quand même en 500 **après** le middleware, au niveau du rendu
de page — y compris sur `/` (page non protégée). Cause : `Cannot find module
'../lightningcss.linux-x64-musl.node'`.

**Diagnostic** : `package-lock.json` n'a jamais eu la variante musl de `lightningcss` (utilisé
par Tailwind v4) résolue — seulement `lightningcss-linux-x64-gnu` (glibc), signe que le lockfile
a été généré sur un hôte glibc. `npm ci` sur l'image `node:22-alpine` (musl) ne peut installer
que ce que le lockfile a résolu pour la plateforme courante ; comme rien n'y correspond pour
musl, le binaire natif manquait purement et simplement — aucune page ne pouvait se rendre.

**Correction appliquée** : bascule du `Dockerfile` de `node:22-alpine` vers
`node:22-bookworm-slim` (Debian, glibc) — fait correspondre l'image à ce que le lockfile a déjà
résolu, sans toucher au lockfile lui-même. Ajout aussi de `apt-get install openssl` (l'image
slim ne l'a pas par défaut ; sans lui, Prisma se rabat silencieusement sur une version d'OpenSSL
devinée au lieu de la détecter réellement — signalé par son propre message d'avertissement).

**Retest** : `GET /` → 200, HTML réel avec le CSS Tailwind compilé et lié
(`/_next/static/css/app/layout.css`, 200, 8782 octets de contenu réel) ; `prisma migrate status`
tourne sans plus aucun avertissement OpenSSL ; conteneur `worker` toujours sain (connexion Redis
confirmée en logs) ; redirect du middleware revérifié sans régression après le changement
d'image de base.

### Rappel : piège du volume anonyme `node_modules`

Trouvé plus tôt dans cet audit (déjà corrigé) : `docker-compose.yml` monte `node_modules` en
volume anonyme, qui **survit à un `docker compose build`** — un rebuild d'image seul ne suffit
pas si le volume anonyme existant est réutilisé. Nécessite `docker compose up
--force-recreate --renew-anon-volumes` pour que de nouvelles dépendances ajoutées à
`package.json` soient effectivement prises en compte dans le conteneur. À garder en tête pour
tout futur ajout de dépendance.

## 5. Ouvert / à surveiller (pas oublié, juste pas encore adressé)

1. 🟡 **IDOR non implémenté** — explicitement différé par le CDC à la Phase 1+, quand les
   premières routes API métier (`/api/eleve/[id]`, `/api/lacunes/[id]`, ...) existeront. Rien à
   tester en Phase 0 (aucune route de ce type n'existe), mais point de vigilance non négociable
   (réf. sécurité §5) à ne pas oublier à l'écriture de ces routes.
2. 🟡 **Environnement de dev non surveillé en continu** — le stack Docker avait tourné 31h sans
   qu'aucun flux ne soit exercé avant l'audit du 25 août ; rien ne garantit qu'un futur ajout de
   dépendance ne retombe pas dans le piège du volume anonyme `node_modules` (§4 ci-dessus) si on
   l'oublie.

_(Le blocage `lightningcss`/Tailwind v4 qui figurait ici a été corrigé le 25 août — voir §4.)_

## 6. Prochaine étape concrète

**Démarrer la Phase 1 — Cœur pédagogique (mock IA), en commençant par l'inscription élève
(§2.1).**

C'est le point de blocage naturel : l'authentification (Phase 0) est prête côté connexion, mais
il n'existe encore aucun moyen de *créer* un compte `Eleve` — donc aucun des flux de Phase 1
(banque d'épreuves, upload de copie, chat, quiz, dashboard parent) n'est exerçable de bout en
bout tant que l'inscription n'existe pas. Le blocage `lightningcss` qui empêchait tout rendu de
page est maintenant corrigé (§4), donc plus rien ne bloque le travail UI ci-dessous. Concrètement :

1. Écran + route d'inscription élève : nom, classe (3ème/1ère/Terminale), filière (A/C/D/TI,
   uniquement si 1ère/Terminale) → génération d'un code `ELE-XXX-XXX` cryptographiquement
   aléatoire (jamais `Math.random()`) → définition du PIN à 4 chiffres.
2. Une fois un élève réel créable, enchaîner sur le chargement des 9 `ProgrammeOfficiel`
   (JSON déjà présents dans `docs/programmes/`, pas encore ingérés en base) et la banque
   d'épreuves filtrée par classe/série (table de référence §2.1), pour avoir un premier
   parcours élève testable en local avec `MockAIProvider`.
