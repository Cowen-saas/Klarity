# Klarity — État d'avancement

_Dernière mise à jour : 1 septembre 2026 (rétention & suppression des données §2.9 : jobs worker + clôture manuelle parent — voir §19)_

## 🔴 Bloquant avant mise en production

- **Documents légaux non finalisés** — `docs/legal/Klarity_CGU.docx`,
  `Klarity_Mentions_Legales.docx` et `Klarity_Politique_Confidentialite.docx` sont en **version
  1.0**, contiennent des champs non remplis (raison sociale, forme juridique, siège social,
  RCCM/NIU, représentant légal...) et **n'ont pas été validés par un avocat inscrit au Barreau du
  Cameroun** — chaque document le stipule lui-même en en-tête ("Document à faire valider... avant
  publication"). Les Mentions Légales interdisent explicitement toute collecte de données réelles
  d'Élèves ou ouverture commerciale tant que cette identification n'est pas complète (Article 1).
  **À compléter et faire valider juridiquement avant tout déploiement public.** Le footer de la
  landing page (`src/components/landing/LandingFooter.tsx`) renvoie pour l'instant directement vers
  ces `.docx` tels quels (décision actée avec l'utilisateur le 27 août : lien de téléchargement du
  document source plutôt qu'une page web reformatant un texte encore provisoire).

- **`next build` échoue — erreur `<Html>` au prérendu de `/404`** (découvert le 1er septembre 2026 en
  lançant `next build` proprement pour la première fois). `next dev` fonctionne, mais un déploiement
  production nécessite `next build` — donc **à régler avant la mise en production**. On y revient au
  moment de préparer le vrai déploiement ; pour l'instant l'investigation est volontairement
  arrêtée.

  **Déclencheur exact.** Après `✓ Compiled successfully` et `Checking validity of types` (qui
  passent tous les deux), à la phase « Generating static pages » :
  ```
  Error: <Html> should not be imported outside of pages/_document.
      at x (.next/server/chunks/611.js:6:1351)
  Error occurred prerendering page "/404".
  Export encountered an error on /_error: /404, exiting the build.
  ```
  `x` est le composant `Html` de `next/dist/compiled/next-server/pages.runtime.prod.js`. Le projet
  est 100 % App Router (pas de `src/pages/`), donc Next génère lui-même `pages/_app.js`,
  `pages/_document.js`, `pages/_error.js` (le `_error.js` compilé fait ~80 Ko). À l'export statique,
  Next prérend `/404` et `/500` à travers ce `_error` et le garde-fou `docComponentsRendered.Html`
  du `_document` par défaut lève l'exception. Aucune *import trace* n'est affichée : l'erreur est
  interne à Next, non rattachable à un module du projet.

  **Problème connu de Next.js.** Signature récurrente et documentée (plusieurs tickets GitHub à
  travers Next 13/14/15) pour les projets App-Router-only, à la génération statique de `/404` et
  `/_error`. Les déclencheurs habituels rapportés ailleurs ne s'appliquent pas ici (voir ci-dessous).

  **Préexistant, pas une régression.** `next build` échoue à l'identique au commit `722f4bd` (HEAD
  d'avant la session du 1er septembre, avant les correctifs paiement/abonnement et avant l'avatar).
  Aucun commit de l'historique ne mentionne un `next build` réussi (tous disent « vérifié via
  `curl` »), et le workflow Docker Compose ne lance que `npm run dev`. `next build` n'a donc **jamais
  fonctionné** dans ce repo — le développement s'est fait entièrement contre `next dev`.

  **Pistes déjà écartées (testées le 1er septembre) :**
  - un fichier de `src/` important `next/document` → aucun (seuls les fichiers de règles de
    `@next/eslint-plugin-next` citent la chaîne) ;
  - `src/middleware.ts` → retiré, échec identique ;
  - la config ESLint cassée → `next build --no-lint`, échec identique ;
  - l'absence de `not-found.tsx` / `global-error.tsx` → les deux ajoutés (et conservés), échec
    identique ;
  - la version de Next → `15.5.23` **et** `15.5.25`, échec identique ;
  - `next/font/google` injoignable dans le conteneur → Google Fonts répond 200 depuis le conteneur.

  **Pistes non testées, à explorer plus tard :**
  - `experimental.optimizePackageImports: ['@phosphor-icons/react']` dans `next.config.ts` (le
    barrel d'icônes est le plus gros import client du projet) ;
  - bisection : retirer pages/composants un par un jusqu'à ce que `/404` build ;
  - un `pages/_document.tsx` minimal explicite ;
  - passage à Next 16.x (bump majeur — dernier stable `16.3.4` au 1er septembre 2026).

## 1. Où en est le projet, dans l'ensemble

Le cadrage produit et technique est consolidé (cahier des charges v1.28,
`docs/specs/Klarity_Cahier_des_Charges.pdf`), le schéma de données est finalisé et migré, et le
socle d'infrastructure (Phase 0, §10 du CDC) est en place. Phase 1 est entamée : inscription
élève, connexion élève/parent, connexion admin cloisonnée (`/admin/connexion`, création CLI
uniquement), chargement du programme officiel, chat-tuteur IA mode 1 (généraliste,
`MockAIProvider`) et dashboards élève/parent/admin fonctionnent bout en bout contre de vraies
données, avec une fidélité visuelle pixel aux maquettes desktop (voir §6 à §11). Tout ce qui
dépend du contenu réel des épreuves (banque d'épreuves — source externe Supabase pas encore
accessible, upload/correction, chat mode 2, lacunes réelles, quiz) reste hors scope tant que cette
source de données n'est pas branchée.

Phase 2 (§2.4, §2.6, §5 du CDC — Paiement) est maintenant construite en mode mock (§16) :
parcours complet Choisir formule → Paiement Mobile Money → Vérification → abonnement Premium
actif en base, pour un élève payeur solo et pour un parent payeur, avec idempotence webhook
testée explicitement et IDOR couvert sur toutes les routes par ID.

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

1. 🟡 **Environnement de dev non surveillé en continu** — le stack Docker avait tourné 31h sans
   qu'aucun flux ne soit exercé avant l'audit du 25 août ; rien ne garantit qu'un futur ajout de
   dépendance ne retombe pas dans le piège du volume anonyme `node_modules` (§4 ci-dessus) si on
   l'oublie.
2. 🟡 **Pas d'outils de navigateur Chrome disponibles dans les sessions récentes** — l'extension a
   été installée par l'utilisateur en cours de route mais n'a pas été détectée dans la session en
   cours (la détection se fait au démarrage d'une nouvelle session). Le rendu visuel réel (mise en
   page, interactions au clic) de tous les écrans Phase 1 reste donc à vérifier par l'utilisateur
   ou dans une session future avec les outils actifs — voir "Vérifié end-to-end via curl" plus bas
   pour ce qui a pu être validé sans navigateur.
3. 🟡 **Aucune donnée `DateExamen`** — le compte à rebours "BAC dans N jours" du dashboard parent
   (maquette `11_dashboard_parent.png`) dépend du calendrier d'examens admin, jamais alimenté ;
   volontairement omis du dashboard parent livré en §8 plutôt que d'afficher une fausse échéance.

_(Le blocage `lightningcss`/Tailwind v4 qui figurait ici a été corrigé le 25 août — voir §4. L'IDOR,
différé jusqu'ici faute de route par ID, est traité en §8 dès la première route concernée.)_

## 6. Phase 1 — Inscription élève (25 août 2026, écran + route)

Premier écran/route métier de Phase 1 (§2.1), implémenté sur la base des maquettes
(`docs/maquettes/screenshots/02_inscription_code_eleve.png`, `00_design_system.png`) et vérifié
cohérent avec `CLAUDE.md` / le graphe Graphify avant écriture (flux d'inscription, distinction
Tuteur IA / Correction IA non affectée par ce travail).

- **`GET /inscription`** (`src/app/inscription/page.tsx`) — assistant en 4 étapes
  (`src/components/inscription/InscriptionWizard.tsx`) : nom → classe (+ filière si
  Première/Terminale) → PIN à 4 chiffres (saisie + confirmation, `PinInput.tsx`, cases masquées
  accessibles au clavier) → code élève affiché + copie presse-papier. Boutons "Continuer"
  toujours actifs, validation au clic avec message d'erreur inline (pas de bouton désactivé sans
  explication). Sélection classe/filière en `<input type="radio">` natif (masqué visuellement)
  plutôt qu'en widget ARIA `role="radio"` fait main, pour la navigation clavier native.
- **`POST /api/eleve/inscription`** (`src/app/api/eleve/inscription/route.ts`) — valide
  (`zod`, filière obligatoire ssi classe ≠ 3ème), rate-limite par IP (10/h, même utilitaire
  `checkRateLimit` que l'OTP parent), génère le code élève, hash le PIN (`hashPin`, déjà en place
  depuis la Phase 0), crée l'`Eleve`, renvoie `{ codeEleve }`. Gère explicitement la collision
  `@unique` (`P2002`, improbable vu l'entropie mais pas nulle) en 409 plutôt qu'un 500 opaque.
- **`src/lib/auth/code-eleve.ts`** — génération `ELE-XXX-XXX` via `node:crypto` (`randomInt`),
  jamais `Math.random()` (réf. sécurité §2, non-négociable). Alphabet restreint sans caractères
  ambigus (`0/O`, `1/I/L` exclus) plutôt que chiffres seuls comme dans l'exemple de maquette
  (`ELE-482-719`) — décision prise avec l'utilisateur : les chiffres seuls ne donnent que 10⁶
  combinaisons, insuffisant face à l'exigence "brute-force impraticable" de la réf. sécurité.
- **Design system posé pour la première fois** : tokens `@theme` dans `src/app/globals.css`
  (couleurs Fond/Surface/Texte/Primaire teal/Accent amber/Succès) + polices Sora (titres/UI) et
  IBM Plex Serif (chiffres clés, ex. le code élève affiché) chargées via `next/font/google` dans
  `src/app/layout.tsx` — réutilisables tel quel pour tous les écrans Phase 1+ suivants.
- **Vérifié end-to-end après coup** (le conteneur `app` tournait déjà) : `curl` bout en bout contre
  `klarity-dev-app-1` (port 3000) — inscription 3ème/Terminale, rejet filière incohérente, rejet
  PIN court, ligne réelle en base (`filiere` NULL vs renseignée, `pinHash` bcrypt), puis connexion
  avec le `codeEleve` + PIN fraîchement créés → session NextAuth réelle `role: ELEVE`. Le rendu
  visuel (clic réel dans Chrome) reste à faire — voir §5.

## 7. `/connexion` — construite (élève/parent, un seul écran à onglets — voir §10 et §11 pour l'évolution ultérieure)

`src/app/connexion/page.tsx` + `src/components/connexion/{ConnexionForm,RoleSwitcher,
EleveLoginForm,ParentLoginForm}.tsx` (l'admin, initialement dans le même écran sans maquette
dédiée, en a été retiré en §10 puis l'écran a été restylé en panneau desktop en §11 — cette section
décrit l'état au moment de la construction initiale). OTP parent :
un indicateur "dev uniquement" affiche le code simulé directement à l'écran
(`codeDevMock` dans la réponse de `/api/auth/parent/request-otp`, jamais renvoyé en production)
après qu'un test manuel réel a échoué une première fois — le code avait expiré (TTL 10 min) le
temps d'être relayé par le chat ; plus la peine de relayer quoi que ce soit maintenant.
Testé au clavier/souris réel par l'utilisateur (inscription → connexion → dashboard, élève et
parent) — premier parcours de bout en bout jamais vérifié hors `curl`.

## 8. Phase 1 — ProgrammeOfficiel, Tuteur IA mode 1, dashboards élève/parent (26 août 2026)

Tout ce qui ne dépend pas du contenu réel des épreuves (banque d'épreuves — source externe
Supabase, pas encore accessible) : upload/correction, chat mode 2, lacunes réelles et quiz restent
hors scope tant qu'elle n'existe pas. Plan détaillé validé avant écriture (voir échange de
planification) ; décisions actées : nav dépendante de la banque d'épreuves grisée avec badge
"Bientôt" plutôt qu'omise ou factice ; chat mode 1 texte seul (pas de bloc vidéo, dépend de
Video/YouTube) ; "Échéance à venir" masquée (§5).

- **`prisma/seed.ts`** (+ `package.json` → `"prisma": {"seed": "tsx prisma/seed.ts"}`) — ingestion
  des 9 `docs/programmes/**/programme_*.json` (§4.2.3) : upsert un `Admin` "seed système"
  (`seed@klarity.local`, jamais un vrai login, juste pour satisfaire `ProgrammeOfficiel.
  ajouteParAdminId`), upsert 10 `Matiere` (union best-effort de `classesConcernees`/
  `filiereRequise` — best-effort seulement, voir décision d'architecture ci-dessous), upsert 42
  `ProgrammeOfficiel`. Idempotent — revérifié par un second run (toujours 42 lignes, aucun
  doublon), y compris sur les 4 lignes `filiere = NULL` (3ème) où Postgres traite NULL comme
  distinct dans la contrainte unique — gérées par un upsert manuel dédié plutôt que le upsert
  Prisma standard, qui aurait dupliqué ces lignes à chaque reseed.
- **Décision d'architecture — éligibilité matière ↔ élève via `ProgrammeOfficiel`, pas
  `Matiere.filiereRequise`** : ce dernier est un array plat par matière (ex. SVT ne peut pas
  exprimer "aucune restriction en 3ème, mais série A seulement en 1ère/Tle" avec un seul array).
  Toute logique d'éligibilité (liste des matières du chat, création de conversation) interroge
  `ProgrammeOfficiel` directement (`classe` + `filiere` exacts), jamais les champs `Matiere`.
- **Session élève enrichie** (`src/auth.ts`, `src/types/next-auth.d.ts`) : ajout de `nom` (absent
  jusqu'ici, nécessaire pour "Bonjour, {nom}" sur le dashboard).
- **Chat-tuteur mode 1** (`src/app/eleve/tuteur-ia/`, `src/app/api/eleve/{matieres,chat/
  conversations}/`) : `GET /api/eleve/matieres` (matières éligibles), `POST /api/eleve/chat/
  conversations` (find-or-create `ConversationChat` `epreuveId=NULL`), `POST .../messages`
  (sanitize, appelle `MockAIProvider.chat()` via `getAIProvider()`, log `UsageIA` avec un tarif
  Haiku placeholder — `claude-haiku-4-5`, $1/$5 par MTok, vérifié via le skill `claude-api` au
  moment d'écrire le code, pas depuis la mémoire). **Première route de l'app avec IDOR réel** :
  `.../conversations/[id]/messages` vérifie `conversation.eleveId === session.user.id` avant
  toute lecture/écriture — testé explicitement (un 2e élève qui tente de lire la conversation du
  1er reçoit un 404 générique, pas un 403 qui confirmerait l'existence de la ressource).
- **Dashboard élève** (`src/app/eleve/{layout,page,profil/page}.tsx`,
  `src/components/eleve/EleveShell.tsx`) : sidebar desktop + bottom-nav mobile, Accueil/Tuteur
  IA/Profil actifs, Épreuves/Mes lacunes/Quiz grisés badge "Bientôt". États vides explicites
  ("pas encore de données") plutôt que des 0% trompeurs.
- **Dashboard parent** (`src/app/parent/{layout,page,notifications/page}.tsx`,
  `src/components/parent/{ParentShell,EnfantSelector,NotificationForm}.tsx`,
  `src/app/api/parent/{dernier-enfant,notifications}/route.ts`) : sélecteur multi-enfants branché
  sur `ParentEleveLink` réel, persistance du choix via `Parent.dernierEleveConsulteId` (IDOR
  vérifié : `POST /api/parent/dernier-enfant` avec un `eleveId` non lié → 403, testé), bandeau
  d'inactivité conditionné à un vrai `derniereActiviteLe` ancien (pas de fausse alerte), alertes
  intelligentes/tuiles stats en état vide honnête. Préférences de notification (`§2.2.3`) en upsert
  simple (`NotificationPreference` est un seul jeu de préférences par parent, pas par enfant lié —
  copie adaptée en conséquence : "vos enfants", pas "d'Aïcha").
- **Vérifié end-to-end via `curl`** contre `klarity-dev-app-1` avec deux élèves + un parent réels
  (inscription → connexion → `/eleve`, `/eleve/tuteur-ia`, `/eleve/profil` tous 200 ; conversation
  + message + réponse mock + `UsageIA.coutEstime` calculé correctement en base ; connexion parent
  via OTP réel → `/parent`, `/parent/notifications` tous 200 ; sauvegarde préférence ; test IDOR
  ci-dessus). Aucune erreur dans les logs du conteneur. Rendu visuel (clic réel) toujours pas
  vérifié faute d'outils navigateur (§5).

## 9. Fidélité pixel des 3 dashboards + corrections retour utilisateur (26 août 2026)

Suite au retour "les dashboards doivent ressembler exactement aux maquettes 04/11/13" : décision
actée avec l'utilisateur (fidélité de structure/style exacte, données réelles — jamais de chiffre
inventé ; état vide honnête dans le même emplacement visuel plutôt qu'omis). Dashboard élève et
parent enrichis (graphique, historique, échéance, suggestion d'action recomposés) ; **dashboard
admin construit de zéro** (`src/app/admin/`, `src/components/admin/AdminShell.tsx`) — sidebar 13
items, la plupart grisés "Bientôt" (banque d'épreuves/paiements/corrections hors scope), mais
Monitoring usage IA et Observabilité sécurité sont réellement peuplés dès aujourd'hui (`UsageIA`
et `AuditLogSecurite` existent déjà grâce au chat-tuteur et à l'auth). Gap comblé au passage :
l'IDOR sur `.../conversations/[id]/messages` ne journalisait rien — `AuditLogSecurite(IDOR_BLOCKED)`
ajouté, vérifié en base après un vrai essai croisé entre deux élèves de test.

Trois corrections supplémentaires demandées après un premier passage utilisateur :
- **Icônes** — remplacé tous les SVG dessinés à la main par de vraies icônes
  (`@phosphor-icons/react`, recommandé par le skill `ui-ux-pro-max`), y compris le logo Klarity
  (chapeau de diplôme, `GraduationCap`) dans les 3 sidebars. **Piège RSC rencontré et corrigé** :
  les icônes Phosphor cassent (`createContext is not a function`) si le fichier qui les réexporte
  n'a pas `"use client"` en tête et qu'un Server Component les importe directement (`src/app/eleve/
  page.tsx` → 500 avant le correctif) — `src/components/icons.tsx` est maintenant un client
  boundary explicite. À garder en tête pour toute icône ajoutée plus tard.
- **Espacement sidebar/contenu** — `mx-auto` retiré de tous les `<main>` des pages sous shell
  (élève/parent/admin) : la combinaison `mx-auto` + `max-w-*` centrait le contenu dans l'espace
  restant à droite de la sidebar au lieu de le coller contre elle, créant un vide bien plus large
  que sur les maquettes.
- **Redirection post-inscription** — `InscriptionWizard` ouvre maintenant une session en silence
  (`signIn("eleve", ...)`) dès la création du compte, et l'étape 4 ("Compte créé !") ajoute un
  bouton "Accéder à mon tableau de bord →" — l'élève n'a plus besoin de se reconnecter à la main
  juste après avoir créé son compte.

Vérifié via `tsc` dans le conteneur (le `tsc` local Windows ne voit pas `node_modules`, volume
Docker anonyme — non fiable pour les nouvelles dépendances, toujours vérifier côté conteneur) +
`curl` bout en bout (inscription → auto-login → `/eleve` avec 14 vraies balises `<svg>`, aucune
lettre "K" isolée restante, `<main>` sans `mx-auto`) sur les 3 rôles. Comptes de test nettoyés
après chaque vérification.

## 10. Cloisonnement admin — connexion séparée, création CLI uniquement (26 août 2026)

Audit demandé par l'utilisateur (§4.1 CDC : comptes admin jamais créés via une route exposée) —
confirmé qu'aucune route API de l'app ne crée d'`Admin` (seul `prisma.admin.upsert`/`create` du
projet vivent dans `prisma/seed.ts` et le nouveau script CLI ci-dessous, jamais dans `src/app/api/`).
Deux changements pour cloisonner encore plus strictement l'admin de la surface publique :

- **`/connexion` n'a plus que 2 onglets** (`RoleSwitcher.tsx` : `Role = "ELEVE" | "PARENT"`) —
  fidèle à `03`/`03b`, aucune option admin visible ni cliquable, y compris pour un `?from=/admin`
  (qui ne remonte plus jusqu'ici, voir point suivant).
- **`/admin/connexion`** — écran de connexion admin autonome, jamais lié depuis l'UI. Restructuré
  en route group (`src/app/admin/(protected)/{layout,page}.tsx` vs `src/app/admin/connexion/
  page.tsx` en dehors du groupe) pour qu'il échappe au gate `AdminShell` — sans ça, la page de
  login se serait redirigée vers elle-même en boucle. `src/middleware.ts` route maintenant les
  échecs d'auth `/admin/*` vers `/admin/connexion` (pas `/connexion`), avec une exception explicite
  pour ne pas gate `/admin/connexion` lui-même. `robots: {index:false}` en plus, en profondeur.
- **`prisma/create-admin.ts`** (+ `npm run admin:create`) — script CLI qui crée un `Admin` avec un
  email/mot de passe fournis en argument, hash bcrypt (coût 12, même pattern que `auth.ts`), génère
  un secret TOTP réel et l'affiche une seule fois (secret brut + URI `otpauth://` prête pour un
  générateur de QR code) — jamais réaffiché, jamais stocké en clair ailleurs. Refuse d'écraser un
  compte existant. C'est la **seule** façon de créer un admin dans l'app.

Vérifié bout en bout : `/connexion` ne montre que Élève/Parent ; `/admin` sans session redirige
vers `/admin/connexion?from=%2Fadmin` (jamais `/connexion`) ; `/admin/connexion` répond 200 sans
aucune trace de l'`AdminShell` (pas de sidebar) ; `prisma/create-admin.ts` crée un vrai compte,
refuse un doublon, et ce compte se connecte réellement via `/admin/connexion` → `/admin` ; une
session admin déjà active qui revisite `/admin/connexion` est renvoyée vers `/admin`. Compte de
test supprimé après vérification.

## 11. Incident de sécurité, restylage notifications, fidélité desktop inscription/connexion (26–27 août 2026)

### Incident : compte admin `admin@klarity.com` créé par erreur, révoqué
Un compte `Admin` avait été créé avec des identifiants exposés par inadvertance dans une
conversation externe. Supprimé directement en base via Prisma (requête ponctuelle, pas de script
réutilisable — la seule voie légitime de création reste `prisma/create-admin.ts`, §10). Rappel
acté avec l'utilisateur à cette occasion : Claude Code ne crée jamais de compte admin réel avec des
identifiants fournis dans le chat, y compris à la demande explicite de l'utilisateur — seule la
CLI auto-hébergée (`npm run admin:create`, exécutée par l'utilisateur lui-même) doit produire un
compte admin réel.

### Restylage notifications parent
`src/components/parent/NotificationForm.tsx` : la maquette n'existait qu'en version mobile
(disposition en bloc unique) ; skill `ui-ux-pro-max` utilisé pour redessiner en layout 2 colonnes
desktop (`lg:grid-cols-[3fr_2fr]`) — formulaire canal/fréquence à gauche, panneau "Aperçu" à droite
qui recompose la phrase réelle ("Tu recevras un SMS chaque semaine…") à partir de la sélection en
cours, plutôt que le bloc unique empilé qui laissait tout l'espace horizontal inutilisé sur desktop.

### Fidélité desktop — inscription (4 nouvelles maquettes) et connexion (3 nouvelles maquettes)
Nouvelles maquettes desktop fournies pour `/inscription` et `/connexion` (panneau gauche sombre
`#0e1512` avec logo/titre/sous-titre/puces d'étape + panneau droit blanc avec le formulaire),
remplaçant le style carte mobile utilisé jusque-là pour ces deux écrans. Skill `ui-ux-pro-max`
utilisé pour la restructuration :
- **`src/components/inscription/InscriptionSidePanel.tsx`** (nouveau) — panneau sombre réutilisant
  `KlarityLogo`, avec titre/sous-titre par étape et puces (`step`/`total`). `InscriptionWizard.tsx`
  passe d'une carte `max-w-sm` unique à un conteneur `max-w-4xl` scindé ; étape 2 (classe) passe
  d'une liste verticale à une grille 3 colonnes horizontale sans puce de sélection (la maquette n'en
  montre pas) ; la barre de progression "Étape X sur 4" ne s'affiche plus qu'aux étapes 1-2 (la
  maquette de l'étape 3 n'en montre pas, contenu recentré à la place).
- **`src/components/connexion/ConnexionSidePanel.tsx`** (nouveau) — même patron, mais le contenu du
  panneau dépend maintenant de l'état vivant du formulaire (rôle élève/parent, et pour le parent,
  étape demande vs vérification OTP) : `ParentLoginForm.tsx` expose un callback `onEtapeChange` que
  `ConnexionForm.tsx` écoute pour recalculer titre/sous-titre/puces du panneau en temps réel
  (2 puces pour le parent — 1 active par étape —, 1 seule puce fixe pour l'élève). Icônes passées de
  cercles à des carrés arrondis (`rounded-2xl`) et titres agrandis (`text-3xl font-extrabold`) pour
  coller aux nouvelles maquettes ; le sélecteur de rôle (`RoleSwitcher`) n'apparaît dans aucun des 3
  crops fournis mais reste affiché — c'est le seul mécanisme qui permet de garder élève et parent
  sur un seul écran public, exigence actée en §10.

Vérifié : `tsc --noEmit` dans le conteneur propre sur tous les fichiers touchés (une seule erreur
résiduelle, préexistante et sans rapport, dans `src/auth.ts:241` — `token.email` potentiellement
`undefined`, pas encore corrigée, voir §12) ; `curl` contre `klarity-dev-app-1` confirme `/inscription`
et `/connexion` en 200 avec le nouveau panneau sombre (`#0e1512`) et les textes attendus présents
dans le HTML rendu. Rendu visuel réel (clic dans Chrome) toujours pas vérifié faute d'outils
navigateur (§5).

## 13. Landing page (`/`), skill `run-klarity`, et stabilisation Docker (27–28 août 2026)

### Landing page livrée et vérifiée
Fidèle à `docs/maquettes/screenshots/01_landing_page.png` : hero, widget de démo Tuteur IA
(pastille étoile verte identique à la nav/au chat — jamais l'icône robot), section "Comment ça
marche" en 4 étapes (icône robot réservée exclusivement à l'étape 2 "Corrigé généré par l'IA").
Cette distinction résout l'ambiguïté `[AMBIGUOUS]` que le graphe Graphify avait déjà repérée de
lui-même entre ces deux nœuds, et matérialise l'exigence CDC §2.1.1 (§3 ci-dessus).

- Nouveaux fichiers : `src/app/page.tsx` (réécrit), `src/components/landing/{LandingHeader,Hero,
  TuteurDemoWidget,HowItWorks,LandingFooter}.tsx`, `src/components/icons.tsx` (ajout
  `IconCamera`/`IconRobot` — ce dernier documenté comme réservé exclusivement à la Correction IA,
  jamais une surface de chat).
- Boutons "Créer un compte"/"Commencer gratuitement" → `/inscription`, "Connexion" → `/connexion`,
  aucun lien admin.
- Footer légal : décision actée avec l'utilisateur — lien de téléchargement direct des `.docx`
  sources plutôt qu'une page web reformatant un contenu encore provisoire (voir le bandeau
  bloquant en tête de ce document).
- **Vérifié bout en bout** : 6 routes en 200 (`/`, `/connexion`, `/inscription`, les 3
  `/legal/*.docx`) via `curl` contre le conteneur Docker `app`. Pas de vérification visuelle pixel
  réelle — aucun outil navigateur disponible dans cette session (§5).

### Nav publique — 4 liens qui ne menaient nulle part, corrigés (31 août 2026)
`LandingHeader.tsx` rendait "Fonctionnalités"/"Épreuves"/"Tarifs"/"Parents" en texte statique
volontairement non cliquable (aucune cible n'existait encore à l'époque). Trois des quatre ont
maintenant une cible réelle :
- **Fonctionnalités** → `/#comment-ca-marche`, ancre ajoutée sur la section déjà présente
  (`HowItWorks.tsx`, `id="comment-ca-marche"`).
- **Tarifs** → `/abonnement`, maintenant réel depuis la Phase 2 (§16). Initialement redirigeait tout
  visiteur non connecté vers `/connexion` avant même de voir la grille — corrigé juste après (même
  jour, voir la sous-section "`/abonnement` rendu public..." plus bas) : la grille tarifaire est
  maintenant publique, seule l'étape de paiement effective exige une session.
- **Parents** → `/connexion?from=/parent`, décision actée avec l'utilisateur après lui avoir
  signalé que la maquette landing (crop unique, s'arrête au footer) ne montre aucune section
  dédiée aux parents à ancrer. Réutilise le mécanisme déjà existant `roleDepuisFrom()` de
  `ConnexionForm.tsx` (jusqu'ici seulement atteint via `?from=/parent...` en interne) pour ouvrir
  directement sur l'onglet Parent plutôt que sur l'onglet Élève par défaut.
- **Épreuves** reste volontairement non cliquable (banque d'épreuves toujours absente) — même
  traitement visuel "Bientôt" que la nav interne app (`EleveShell`/`ParentShell`), ajouté ici pour
  la première fois côté landing.
- **Vérifié** via `curl`/inspection du HTML rendu (hrefs corrects, ancre `id` présente, redirect
  `/abonnement` → `/connexion` confirmé pour un visiteur anonyme, onglet Parent bien pré-sélectionné
  sur `/connexion?from=/parent`) — **pas de clic réel en navigateur** : aucun outil browser
  disponible dans cette session (même limitation qu'au §5, malgré la demande explicite de tester
  réellement ; signalé à l'utilisateur plutôt que présenté comme vérifié).

### Skill `run-klarity` créé puis recadré en solution de secours
Pendant le développement de la landing page, `npm install`/le serveur de dev cassaient de façon
répétée et déroutante quand exécutés depuis le chemin UNC `\\wsl.localhost\...` (seul chemin que
Windows expose vers ce repo) : le postinstall de `@prisma/client` (spawné via `cmd.exe`) refuse un
cwd UNC, la résolution des loaders internes de Next.js/webpack casse contre une racine UNC, son
watcher de fichiers (Watchpack) sature les logs d'erreurs `EISDIR`. Contournement trouvé : Node
natif installé directement dans WSL (`~/.local/node`, sans sudo), piloté depuis Windows via
`wsl.exe`, capturé comme skill projet (`.claude/skills/run-klarity/`, `SKILL.md` + `smoke.sh`,
driver vérifié bout en bout : `setup`/`start`/`check`/`stop`).

**Décision actée ensuite avec l'utilisateur : Docker Compose reste la référence pour le
développement quotidien** — cohérent avec la Phase 0 déjà validée et la cible de déploiement du
CDC §3/§10 (worker/Postgres/Redis restent de toute façon en Docker). Le skill est donc recadré
explicitement en solution de secours, à n'utiliser que si Docker lui-même est bloqué sur cette
session Windows/UNC précise — jamais comme remplacement permanent. Bug trouvé au passage :
l'extraction du PID via `ps | awk '{print $2}'` se corrompt en traversant la frontière argv de
`wsl.exe` (imprime la colonne USER au lieu du PID) — corrigé avec `pgrep`, qui n'a pas besoin
d'extraction de champ.

### Deux causes racines distinctes du blocage Docker, résolues
En rebasculant sur Docker après les tests natifs WSL, le conteneur `app` (qui tournait sans
interruption depuis 2 jours) ne répondait plus :
1. **Résidu de fichiers `.next` appartenant à `root`** — créés par cette instance du conteneur
   `app` avant que le volume anonyme sur `.next` (piège déjà documenté en §4) soit pleinement
   effectif pour elle ; sans lien avec les tests natifs WSL de cette session. Nettoyé via un
   conteneur `alpine` jetable (`docker run --rm -v .:/app -w /app alpine rm -rf .next`) puis
   `docker compose up --force-recreate --renew-anon-volumes`.
2. **Image Docker elle-même périmée** — construite avant l'ajout de `@phosphor-icons/react` à
   `package.json` (utilisé par la nouvelle landing page), donc le volume `node_modules`
   fraîchement recréé se réamorçait depuis une image obsolète (`Module not found: Can't resolve
   '@phosphor-icons/react'`). `--force-recreate --renew-anon-volumes` seul ne suffit pas dans ce
   cas — nécessite un vrai `docker compose build` avant.

Retesté après coup : conteneur `app` sain, 6 routes en 200 sur `http://localhost:3000`, aucun
fichier résiduel appartenant à `root` sous le répertoire du projet (hors le point de montage
`.next` lui-même, normal et sans impact).

## 14. Vérification post-incident Docker/Prisma et clarification port 3000 vs 3001 (29–31 août 2026)

### Moteur Docker Desktop devenu injoignable, redémarré
Audit demandé par l'utilisateur (conteneurs + images) : `docker compose ps`, `docker images` et même
`docker version` renvoyaient tous une 500 (`request returned 500 Internal Server Error ... check if
the server supports the requested API version`), alors que les process Docker Desktop
(`Docker Desktop.exe`, `com.docker.backend.exe`, `docker-agent.exe`) tournaient toujours d'après
`tasklist`. Le moteur backend était planté silencieusement, pas juste lent. **Correction appliquée**
(confirmée avec l'utilisateur avant d'agir, action jugée disruptive) : arrêt forcé de tout l'arbre de
processus Docker Desktop (`taskkill /F /T`) puis relance de l'exécutable ; le moteur a répondu à
nouveau après ~30s. Les 5 conteneurs étaient tous passés `Exited (255)` pendant la coupure (attendu),
remontés sains via `docker compose up -d` — `app` `Ready in 4.9s`, `worker` reconnecté à Redis,
`postgres`/`redis` healthy, `/`, `/connexion`, `/inscription` revérifiés en 200. Images (`klarity-dev-
app`, `klarity-dev-worker`, `postgres:16-alpine`, `redis:7-alpine`, `adminer`, `alpine`) toutes
intactes, aucune reconstruction nécessaire — l'incident était uniquement l'engine, pas les images/
volumes. Pas de cause racine identifiée côté Klarity (comportement Docker Desktop lui-même) ; à
garder en tête comme mode de panne possible si `docker compose` recommence à échouer bizarrement.

### `prisma migrate status` re-vérifié
`prisma migrate status` (1 migration, `20260819070754_init`) → **à jour**, aucun drift ; `prisma
validate` → schéma valide. Rien à corriger. Deux avertissements non-bloquants relevés au passage :
`package.json#prisma` (config du seed) est déprécié en faveur d'un futur `prisma.config.ts`, et une
mise à jour majeure Prisma existe (6.19.3 → 8.0.0-rc.12, release candidate — pas de bascule prévue
sans plan de migration dédié).

### Clarification port 3000 (Docker) vs 3001 (fallback natif `run-klarity`)
Signalement utilisateur "l'application ne se lance pas sur le navigateur" en visitant
`localhost:3001` → connexion refusée. Diagnostic : `docker-compose.yml` ne mappe **que** `3000:3000`
pour `app` (aucun service Docker n'écoute sur 3001) ; le port 3001 n'existe que dans le skill de
secours `.claude/skills/run-klarity/` (`SKILL.md`, `smoke.sh`) — c'est le port de repli que Next.js
choisit tout seul quand son driver natif WSL trouve le 3000 déjà occupé, documenté comme tel dans ce
skill. Tant que Docker Compose est la référence quotidienne (décision actée en §13), le port à utiliser
est **`http://localhost:3000`**, jamais 3001 — 3001 ne répond que si le fallback natif a été lancé en
plus. Pas un bug applicatif ; simple rappel à faire quand ce fallback a été utilisé une fois et que
le réflexe 3001 reste.

## 15. Prochaine étape concrète

1. Rendu visuel réel (comparaison pixel avec les maquettes) dans Chrome dès que les outils
   navigateur sont disponibles dans une session — toujours pas le cas jusqu'ici (§5), y compris
   pour les 4 nouveaux écrans de paiement livrés en §16 (vérifiés par `curl`/contenu HTML rendu,
   jamais cliqués dans un vrai navigateur).
2. ~~Corriger l'erreur `tsc` résiduelle dans `src/auth.ts:241`~~ — fait en §16 (assignation
   `session.user.email` rendue conditionnelle) ; `npx tsc --noEmit` dans le conteneur est propre.
3. Compléter et faire valider juridiquement les 3 documents légaux avant tout déploiement public
   (voir le bandeau bloquant en tête de ce document).
4. Quand la banque d'épreuves (source Supabase tierce) devient accessible : upload/correction,
   chat mode 2, lacunes réelles, quiz — tout ce qui était explicitement hors scope de §8.
5. Job BullMQ de rappel de renouvellement (§5.5 du CDC) — cron quotidien J-3 avant
   `dateProchainRenouvellement`, bascule `ACTIF → EXPIRE` après le délai de grâce — explicitement
   hors scope de la tâche Phase 2 traitée en §16 (qui couvrait §2.4/§2.6/§5.1-§5.4, pas §5.5) ;
   à faire quand les canaux SMS/WhatsApp sortants seront branchés.
6. `CamerPaySandboxProvider`/`CamerPayLiveProvider` (§5.3) dès obtention de l'accès CamerPay —
   l'endpoint `/api/paiement/webhook` et l'interface `PaymentProvider` sont déjà prêts à les
   recevoir sans retravail (§16).

## 16. Phase 2 — Paiement Mobile Money en mode mock (31 août 2026)

Construit contre §2.4, §2.6 et §5.1-§5.4 du CDC (§5.5, le job de rappel de renouvellement, est
explicitement hors scope — voir §15 point 5). CamerPay n'étant pas accessible en live, toute la
chaîne tourne en `PAYMENT_MODE=mock`, déjà en place depuis la Phase 0 (`src/lib/payment/`,
inchangé dans son interface `PaymentProvider` à 3 méthodes) — seule la couche applicative
(routes, file d'attente, écrans) est nouvelle.

- **Modèles `Abonnement`/`Paiement`/`WebhookLog`** (§4.5) — déjà présents dans `schema.prisma`
  depuis la migration initiale (`20260819070754_init`) ; `prisma migrate status` confirme aucun
  drift, aucune migration supplémentaire nécessaire.
- **`src/lib/payment/tarification.ts`** — `determinerPeriodeTarifaire(date)` (§2.4.1) : NOEL
  (déc-jan-fév) et PAQUES (avr-mai-juin) à 3000 FCFA, NORMALE à 5000 FCFA, calculée uniquement
  côté serveur. `obtenirTarifPremium()` l'enveloppe pour l'affichage (prix + réduction).
- **Simulation du délai Mobile Money** (§5.2 : "simule REUSSI/ECHEC après un court délai") —
  décision d'architecture : plutôt que d'ajouter une méthode hors-interface à
  `MockPaymentProvider` (ce qui aurait fait fuiter un concept mock-only dans l'interface
  `PaymentProvider` fixée par le CDC à 3 méthodes), le délai est simulé côté application via une
  nouvelle file BullMQ (`src/lib/queue/paiement.ts`, `paiement-mock-webhook`, délai fixe 3s pour
  des tests manuels reproductibles) consommée par un nouveau processor dans
  `src/worker/index.ts` — premier vrai processor BullMQ du projet (jusqu'ici le worker ne faisait
  que maintenir la connexion Redis). Le processor rejoue exactement le même chemin qu'un vrai
  webhook CamerPay (`src/lib/payment/webhook-handler.ts::traiterWebhookPaiement`), donc aucun
  retravail ne sera nécessaire au passage sandbox/live (§5.3) — seul `PaymentProvider` change.
- **Convention de test REUSSI/ECHEC** — un numéro Mobile Money se terminant par `0` simule un
  échec, tout autre numéro réussit (choix arbitraire documenté dans le code et affiché à l'écran
  en dev uniquement via `NODE_ENV !== "production"`, même gating que l'indice OTP mock du §7).
- **Routes API** :
  - `POST /api/paiement/initier` — résout `eleveId`/`payeurRole` selon le rôle appelant (§2.6 :
    élève payeur solo, ou parent payeur pour un enfant lié — IDOR vérifié via
    `ParentEleveLink`), calcule le tarif serveur, crée l'`Abonnement` s'il n'existe pas encore,
    appelle `PaymentProvider.initierPaiement()`, crée le `Paiement` (`idempotencyKey` = sessionId
    du provider, connu dès l'initiation), planifie le webhook mock. Rate-limité par IP et par
    élève (même utilitaire `checkRateLimit` que l'inscription/OTP). Refuse (409) si l'élève a
    déjà un abonnement Premium actif.
  - `GET /api/paiement/[id]` — statut pour le polling de l'écran de vérification.
  - `POST /api/paiement/webhook` — endpoint réel que CamerPay appellera en sandbox/live (§5.3),
    déjà fonctionnel et testé (signature invalide → 401 + `AuditLogSecurite(WEBHOOK_INVALID)`),
    simplement pas encore exercé en pratique tant que CamerPay n'existe qu'en mode mock.
  - **IDOR** (`src/lib/payment/idor.ts`, `chargerPaiementAutorise`) — un `Paiement` n'a pas de
    propriétaire direct ; remonte jusqu'à `Abonnement.eleve` et vérifie l'appartenance (élève
    lui-même, ou parent avec `ParentEleveLink` vérifié), factorisé entre la route de statut et la
    page serveur de vérification pour éviter un flash de chargement.
- **Idempotence** (`src/lib/payment/webhook-handler.ts::traiterWebhookPaiement`) — un
  `Paiement` qui a déjà quitté `EN_ATTENTE` ne déclenche plus jamais d'écriture sur `Abonnement`
  à un replay ; seul un `WebhookLog(traitementStatut: "DEJA_TRAITE")` est ajouté. **Testé
  explicitement** : webhook mock signé rejoué deux fois d'affilée sur le même paiement déjà
  crédité → `DEJA_TRAITE` les deux fois, un seul `WebhookLog(CREDITE)` en base, `Abonnement`
  toujours à `prixApplique = 5000`, jamais recrédité.
- **Écrans** (`src/app/abonnement/`, `src/components/abonnement/`), skill `ui-ux-pro-max`,
  fidèles à `14_choisissez_votre_formule.png` à `17_verification_paiement.png` :
  - `/abonnement` — cartes Gratuit/Premium (prix et badge -X% dynamiques selon la période
    tarifaire), tableau comparatif, sélecteur d'enfant si le parent a plusieurs liens (fallback
    sur `dernierEleveConsulteId`, même convention que le dashboard parent). Hors shell
    élève/parent (comme `/inscription`/`/connexion`) puisqu'accessible depuis les deux espaces
    (§2.6) ; lien "Abonnement" ajouté aux deux sidebars (`EleveShell`/`ParentShell`, icône déjà
    disponible `IconCreditCard`, pas besoin de badge "Bientôt" puisque réel dès maintenant).
  - `/abonnement/paiement` — écrans 15+16 fusionnés en un seul wizard client (choix du moyen,
    unique de toute façon, puis formulaire Mobile Money) plutôt que deux pages séparées, pour
    éviter un clic sans alternative réelle — déviation mineure documentée ici, pas dans le code.
  - `/abonnement/verification/[id]` — polling toutes les 1,5s, les 3 états de l'écran 17
    (vérification/confirmé/échoué), "Réessayer"/"Utiliser un autre numéro" renvoient tous deux
    vers un nouveau essai de paiement plutôt que de tenter de rouvrir le `Paiement` déjà clos par
    l'idempotence (cohérent avec le comportement réel Mobile Money : un échec est une nouvelle
    tentative, pas une réouverture).
  - `PaiementStepper` — nouveau composant (numérotation 1-4 Formule/Paiement/Vérification/
    Confirmation), distinct de `StepProgress` (barre à segments de l'inscription) car la maquette
    de paiement utilise un patron visuel différent.
- **Bug préexistant corrigé au passage** : `src/auth.ts:241` (`session.user.email = token.email`,
  `tsc` en échec depuis §14) — assignation rendue conditionnelle (`if (token.email) ...`), même
  patron que la ligne `token.error` juste en dessous. `npx tsc --noEmit` dans le conteneur est
  maintenant propre sur tout le projet.
- **Vérifié end-to-end via `curl`** contre `klarity-dev-app-1`/`klarity-dev-worker-1` (pas de
  rendu Chrome réel, voir §5/§15 point 1) : 4 élèves de test + 1 parent de test, tous supprimés
  après coup.
  - Élève payeur solo, numéro se terminant par un chiffre ≠ 0 → `EN_ATTENTE` puis (après le délai
    de 3s) `REUSSI`, `Abonnement` passé `PREMIUM`/`ACTIF`/`prixApplique = 5000`.
  - Élève payeur solo, numéro terminant par `0` → `ECHEC`, `Abonnement` resté `GRATUIT`.
  - Parent payeur pour un enfant lié → `Paiement.payeurRole = PARENT`, succès identique ;
    initiation refusée (400) sans `eleveId`, refusée (403 + `AuditLogSecurite(IDOR_BLOCKED)`)
    pour un `eleveId` non lié.
  - Élève tentant de lire le statut du paiement d'un autre élève → 404 générique +
    `AuditLogSecurite(IDOR_BLOCKED)` (jamais un 403 qui confirmerait l'existence de la ressource,
    même patron que le chat §8).
  - Webhook signé avec une signature invalide → 401 + `AuditLogSecurite(WEBHOOK_INVALID)`, aucune
    écriture sur `Paiement`/`Abonnement`.
  - Idempotence (ci-dessus) — un seul crédit malgré 2 replays du même webhook signé.
  - Logs des deux conteneurs (`app`, `worker`) propres sur toute la session de test — 4 jobs
    mock traités (`2× CREDITE`, `1× ECHEC_PAIEMENT`, `1× CREDITE` pour le parcours parent).

### `/abonnement` rendu public, anti-double-paiement, choix élève/parent avant connexion (31 août 2026)

Suite au lien "Tarifs" de la landing (§13) : `/abonnement` exigeait une session, donc un visiteur
anonyme qui cliquait "Tarifs" atterrissait directement sur `/connexion` sans jamais voir la grille
tarifaire — pas ce qu'une page "Tarifs" publique doit faire. Deux demandes utilisateur successives
ont fait évoluer le comportement :

1. **D'abord** : rendre `/abonnement` public et rediriger vers `/connexion` au clic sur "Choisir
   Premium" si non connecté.
2. **Puis, avant que la première version soit testée** : remplacé par un vrai choix élève/parent
   plutôt qu'un redirect générique — rappel du CDC §2.2, un parent n'a pas de compte autonome (il
   se connecte avec le code élève + téléphone de son enfant), donc l'envoyer directement sur l'onglet
   élève de `/connexion` aurait été trompeur pour un parent visiteur.

Comportement final :
- **`src/app/abonnement/layout.tsx`** ne redirige plus les visiteurs non connectés — seul l'en-tête
  change (Connexion/Créer un compte au lieu de "Retour au tableau de bord"). La grille tarifaire
  (`/abonnement`) est publique ; `/abonnement/paiement` et `/abonnement/verification/[id]`
  continuent d'exiger leur propre session (vérifiée dans chaque page, pas dans le layout), pour
  qu'un visiteur anonyme ne puisse jamais déclencher un paiement réel.
- **`/abonnement/eleve-ou-parent`** (nouvelle page publique) — écran d'aiguillage affiché au clic
  sur "Choisir Premium" sans session : carte "Je suis élève" (Se connecter / Créer un compte) et
  carte "Je suis parent" (Se connecter, avec rappel explicite "la connexion se fait avec le code
  élève transmis par ton enfant" + lien "Ton enfant n'a pas encore de compte ?" vers `/inscription`
  pour le cas où le parent doit d'abord faire créer le compte élève). Chaque carte porte vers
  `/connexion?from=/abonnement/paiement&role=ELEVE|PARENT`.
- **Nouveau paramètre `role` sur `/connexion`**, distinct de `from` — `from` reste le mécanisme
  existant de redirection post-connexion (`EleveLoginForm`/`ParentLoginForm`, étendu pour accepter
  aussi un `from` commençant par `/abonnement`, pas seulement `/eleve`/`/parent`) ; `role` sert
  uniquement à présélectionner l'onglet, prioritaire sur l'ancienne heuristique par préfixe
  (`roleDepuisFrom`, conservée pour les appelants existants comme le lien "Parents" de la landing).
  Les deux étaient auparavant confondus dans `from` seul, ce qui ne permettait pas de forcer
  l'onglet Parent vers une destination qui ne commence pas par `/parent`.
- **`ConnexionForm.tsx`** affiche un bandeau contextuel quand `from` vient de l'abonnement, différent
  par rôle : côté élève "Connecte-toi pour continuer ton abonnement" + lien Inscription ; côté
  parent "Connecte-toi avec le code élève transmis par ton enfant" + lien "Crée d'abord son compte
  élève", cohérent avec le rappel déjà présent sur l'écran d'aiguillage.
- **Anti-double-paiement** — `/abonnement` affiche un état bloquant dès qu'un `Abonnement`
  `PREMIUM`/`ACTIF` existe pour l'élève consulté : bandeau "Tu es déjà abonné Premium, actif
  jusqu'au {date}" (formatée `fr-FR`, depuis `Abonnement.dateFin`) à la place du bloc titre normal,
  et le bouton "Choisir Premium" est remplacé par un badge "Premium actif" non cliquable — jamais
  de lien vers `/abonnement/paiement` dans cet état. `/abonnement/paiement` lui-même re-vérifie
  côté serveur (déjà en place depuis la première version, §16) et rebondit vers `/abonnement` si
  quelqu'un tente d'y accéder directement malgré tout (IDOR/replay), donc double protection.
- **Parent avec plusieurs enfants, cas particulier assumé** : la destination post-connexion
  `/abonnement/paiement` ne porte pas de `?eleve=` (impossible à connaître avant la connexion) ;
  `/abonnement/paiement` rebondit alors vers `/abonnement` (maintenant authentifié), où le parent
  reclique "Choisir Premium" — cette fois avec le vrai `eleveId`. Deux clics au lieu d'un pour ce
  cas précis, mais aucun risque de payer pour le mauvais enfant ; jugé acceptable plutôt que de
  complexifier le flux de connexion pour deviner l'enfant à l'avance.
- **Vérifié via `curl`/inspection HTML** (toujours aucun outil navigateur disponible dans cette
  session — voir §5/§15 point 1, signalé à l'utilisateur plutôt que présenté comme un clic réel) :
  grille publique servie à un visiteur anonyme (200, sans redirect) ; "Choisir Premium" anonyme
  pointe vers `/abonnement/eleve-ou-parent` (pas directement `/connexion`) ; les deux cartes portent
  les bons `href` avec `role=ELEVE`/`role=PARENT` ; les deux bandeaux contextuels s'affichent sur
  `/connexion` selon le rôle ; élève fraîchement inscrit → connexion → `/abonnement/paiement` sert
  le vrai formulaire ; parent nouvellement lié → connexion → rebond vers `/abonnement` confirmé (pas
  de `?eleve=`) → nouveau clic → paiement réel jusqu'à `REUSSI` ; état "déjà abonné" confirmé avec
  la date formatée et absence du lien de paiement dans le HTML, y compris un accès direct forcé à
  `/abonnement/paiement?eleve=...` (rebond 307 vers `/abonnement`). Comptes de test supprimés après
  coup.

### Faux positif investigué : "le chooser saute directement au paiement" — pas un bug de code, purge complète des données de test (31 août 2026)

Signalement utilisateur en clic réel : depuis `/abonnement`, "Choisir Premium" enchaînait
directement les étapes de paiement sans jamais montrer le chooser élève/parent ni exiger de
connexion. Investigation des 3 pistes demandées :
1. Le lien "Choisir Premium" est un `<Link>` serveur, son `href` est calculé côté serveur à partir
   de `auth()` — aucune logique client à contourner.
2. `/abonnement/eleve-ou-parent` s'affiche et fonctionne normalement (re-vérifié) ; `/abonnement`
   n'est même pas dans le matcher du middleware (`/admin`, `/parent`, `/eleve` uniquement) — aucun
   raccourci possible à ce niveau.
3. **Cause réelle trouvée en base** : un élève de test "Aicha MVONDO" (`ELE-8U8-CEG`) avait été créé
   le matin même à 08:33 et avait déjà payé avec succès (mock) à 09:46 — donc une session NextAuth
   bien réelle et valide (cookie 30 jours, `REFRESH_TOKEN_TTL_SECONDS`, volontairement long pour ne
   pas resaisir le PIN à chaque visite, §2.7 CDC) était encore active dans le navigateur utilisé pour
   le test. Le serveur a donc correctement traité la requête comme authentifiée et sauté le
   chooser — comportement attendu pour un utilisateur déjà connecté, pas un défaut. Aucun changement
   de code : re-vérifié avec une requête strictement sans cookie (équivalent serveur d'une navigation
   privée) → chooser bien retourné, jamais de lien direct vers le paiement.
- **Purge complète des données de test** demandée par l'utilisateur, effectuée : les 9 `Eleve` et 2
  `Parent` de test (accumulés sur plusieurs sessions, §7 à §16) supprimés avec tout ce qui en
  dépendait (`Abonnement`, `Paiement`, `ConversationChat`/`MessageChat`) — confirmé à 0 partout après
  coup. Les comptes `Admin` (`admin@klarity.com` et `seed@klarity.local`) explicitement épargnés et
  revérifiés intacts. 2 lignes `UsageIA` orphelines ont vu leur `eleveId` passer à `NULL` (comportement
  du schéma lui-même, `ON DELETE SET NULL`, pas une trace de test oubliée — cohérent avec l'intention
  documentée de préserver l'audit de coût même après suppression d'un compte).

### Onglet Élève/Parent verrouillé quand `/connexion` est atteint avec `role` explicite (31 août 2026)

Demande de suivi : sur `/connexion?...&role=PARENT|ELEVE` (depuis le chooser d'abonnement), l'onglet
non choisi doit être grisé et non cliquable, pas seulement pré-sélectionné — l'utilisateur ne doit
pas pouvoir changer de rôle depuis un écran déjà contextualisé par un choix fait à l'étape
précédente. Ne s'applique que si `role` est présent explicitement ; un accès normal à `/connexion`
(ex. lien "Connexion" de la landing, ou `?from=/parent` seul comme le lien "Parents" du §13) garde
les deux onglets cliquables, comportement inchangé.

- **`RoleSwitcher.tsx`** — nouvelle prop `locked` : quand vraie, le bouton de l'onglet inactif reçoit
  `disabled` + `aria-disabled="true"` et perd son `onClick`, distinct visuellement (`cursor-not-allowed`,
  texte très atténué) du simple survol non actif habituel.
- **`ConnexionForm.tsx`** — `roleVerrouille = roleParam === "PARENT" || roleParam === "ELEVE"`,
  passé tel quel à `RoleSwitcher`. Une valeur de `role` invalide ou absente retombe sur l'ancienne
  heuristique `roleDepuisFrom(from)`, non verrouillée.
- **Vérifié via inspection du HTML rendu côté serveur** (le composant est un client component rendu
  dans un `<Suspense>`, donc le premier rendu serveur porte déjà le bon état — pas de flash avant
  hydratation) : `role=PARENT` → bouton "Élève" avec `disabled=""` présent dans le HTML brut, formulaire
  Parent actif ; `role=ELEVE` → bouton "Parent" `disabled=""`, formulaire Élève actif ; `from=/parent`
  seul (sans `role`) → aucun bouton `disabled`, comportement historique intact. Toujours aucun outil
  de clic navigateur disponible dans cette session (§5/§15 point 1) — vérification par inspection du
  HTML servi, pas par clic réel, signalé comme tel plutôt que présenté comme testé en navigateur.

### Signalement "fuite de session entre comptes sur la landing" — investigué, cause racine trouvée et corrigée : aucune fonction de déconnexion n'existait (31 août 2026)

Signalement utilisateur (potentiellement grave, IDOR-like) : après connexion via `/abonnement`,
revenir sur `/` semblerait refléter l'état du compte précédemment connecté. Investigation des 3
pistes demandées, avec preuves :

1. **Cache Next.js ignorant la session ?** Non — `/` (`src/app/page.tsx` et ses 4 sous-composants
   `LandingHeader`/`Hero`/`TuteurDemoWidget`/`LandingFooter`) ne lit `auth()`, `cookies()` ni aucune
   donnée de session nulle part : la page est strictement identique pour tout le monde, connecté ou
   non. Vérifié par comparaison octet-par-octet du HTML rendu (hors query-strings de cache-busting
   du build dev) pour deux comptes de test différents — **aucune trace nominative** (nom, code élève)
   dans le HTML dans les deux cas. Il n'y a tout simplement rien de personnalisé à "fuiter" sur cette
   page dans le code actuel.
2. **Le cookie de session se réémet-il correctement à chaque connexion ?** Oui, y compris dans le cas
   le plus défavorable testé : connexion en tant qu'élève A, puis connexion en tant qu'élève B
   **dans le même cookie jar sans déconnexion préalable** — `/api/auth/session` bascule
   immédiatement et complètement sur B (id, nom, classe, filière), le cookie change de valeur, et
   `/eleve` rend bien "Bonjour, {nom de B}". Aucune fuite serveur détectée, même sans déconnexion.
3. **Cause racine réelle, trouvée** : **`signOut` n'était appelé nulle part dans toute l'app** — aucun
   bouton, aucune route, aucune fonctionnalité de déconnexion n'existait, sous aucun libellé
   (recherché "logout", "signOut", "déconnexion" dans tout `src/`). Le scénario de reproduction
   demandé par l'utilisateur nécessitait une étape "déconnexion" qui n'avait tout simplement aucun
   moyen réel de se produire dans l'app — la seule façon de "changer de compte" était d'effacer les
   cookies manuellement (navigation privée, DevTools) ou de se connecter par-dessus une session
   existante (testé au point 2, sans fuite). C'est très probablement ce qui a produit l'impression
   signalée : un compte de test resté connecté sans qu'aucune action de l'app ne l'ait jamais
   réellement terminé.

**Correction (racine, pas un contournement)** : ajout d'une vraie fonctionnalité de déconnexion,
absente jusqu'ici de tout le produit.
- **`src/components/ui/SignOutButton.tsx`** (nouveau) — `signOut({ redirect: false })` puis
  `router.push("/")` + `router.refresh()` (vide explicitement le cache client du Router App pour
  qu'aucune page visitée pendant la session ne reste affichée comme si elle l'était encore).
- Ajouté en bas des sidebars desktop `EleveShell`/`ParentShell` (`mt-auto`, même style que les liens
  de nav) et sur `/eleve/profil` (seul point d'accès pour la nav mobile, qui n'a pas d'équivalent
  "plus" dans la bottom-nav actuelle).
- `IconSignOut` ajouté à `src/components/icons.tsx` (Phosphor `SignOut`).
- **Vérifié via `curl`** que `/api/auth/signout` (même appel que le bouton) retourne bien
  `Set-Cookie: authjs.session-token=; Max-Age=0`, que `/api/auth/session` devient `null` juste après,
  et que `/eleve` redirige alors vers `/connexion` (vraiment déconnecté, pas une apparence).
- **Reproduction complète du scénario demandé, avec la vraie déconnexion cette fois** : élève A se
  connecte via `/abonnement` → atteint le vrai formulaire de paiement → retour sur `/` → déconnexion
  réelle via `/api/auth/signout` → `/eleve` refusé (307 vers `/connexion`, confirmant une
  déconnexion effective) → élève B se connecte dans le même jar → `/` et `/eleve` ne portent plus
  aucune trace du nom ou du code élève de A. Comptes de test supprimés après coup (sauf un compte
  "Aicha MVONDO" créé très récemment, probablement par l'utilisateur lui-même en cours de test en
  parallèle — laissé intact pour ne pas interrompre une session en cours, à nettoyer par la suite).
  Toujours aucun outil de clic navigateur disponible dans cette session (§5/§15 point 1).

**Suivi (même jour)** : l'utilisateur a maintenu que le bug persistait après la correction ci-dessus
— "connecté sans jamais me déconnecter, retour sur `/abonnement`, clic Choisir Premium → saute
directement au paiement". Reproduit littéralement, avec une preuve plus poussée que le tour
précédent : `/abonnement` répond `Cache-Control: no-store, must-revalidate` (aucune mise en cache à
aucune couche) et le `href` de "Choisir Premium" contient l'`eleveId` réel de **la session
actuellement connectée elle-même**, vérifié octet pour octet contre la base pour deux comptes de
test distincts créés coup sur coup (jamais interverti). Conclusion : le comportement décrit
("saute directement au paiement") se reproduit bel et bien, mais ce n'est pas une fuite — c'est le
comportement voulu pour un utilisateur **déjà authentifié** (le chooser `/abonnement/eleve-ou-parent`
n'a jamais eu vocation à s'appliquer à une session déjà connectée, seulement au visiteur anonyme,
conformément à la spec initiale "si non authentifié"). Confirmé avec l'utilisateur via question
directe : comportement à garder tel quel, pas de changement de code nécessaire. Comptes de test
supprimés après coup.

### Re-vérification légère avant validation finale du paiement (31 août 2026)

Renforcement demandé explicitement au-delà du minimum spécifié par le CDC (§2.6, §5.4) — "même
principe qu'une banque qui redemande un code avant un virement, même si la session est déjà
active". Juste avant que "Payer {montant} FCFA" ne déclenche réellement `POST
/api/paiement/initier`, une étape de re-vérification s'intercale : PIN à 4 chiffres pour un élève
payeur, OTP à 6 chiffres (nouvel envoi SMS) pour un parent payeur. **Ne crée ni ne modifie aucune
session/token NextAuth** — confirme uniquement la présence physique/connaissance des identifiants,
isolé du code d'authentification de `src/auth.ts` pour ne jamais risquer d'y introduire une
régression.

- **`src/lib/auth/confirmation.ts`** (nouveau) — `verifierPinConfirmation`/`verifierOtpConfirmation`,
  réutilisant délibérément les **mêmes compteurs** que la connexion
  (`Eleve.pinTentativesEchouees`/`pinVerrouilleJusqua`, `OtpVerification.tentatives`) : un blocage
  ici verrouille aussi la connexion normale, comportement voulu (§7, le rate limiting protège le
  compte entier, pas une action isolée) et vérifié explicitement (voir plus bas).
- **`src/lib/auth/otp.ts`** — logique d'envoi extraite dans `envoyerOtp(telephone)`, partagée par
  `/api/auth/parent/request-otp` (connexion, déjà existant, inchangé dans son comportement) et le
  nouvel envoi de confirmation — le mécanisme est réutilisé, pas dupliqué.
- **`POST /api/paiement/confirmation-otp`** (nouveau, rôle PARENT uniquement) — déclenche un envoi
  OTP vers `session.user.telephone` **côté serveur**, jamais un téléphone fourni par le client
  (contrairement à l'endpoint pré-connexion, qui n'a pas encore de session à qui faire confiance) —
  rate-limité séparément (`paiement-otp:parent:{id}`/`paiement-otp:ip:{ip}`, propre bucket Redis,
  n'interfère pas avec le rate limiting de l'OTP de connexion).
- **`POST /api/paiement/initier`** — accepte maintenant `pin`/`otp` en plus des champs existants ;
  la vérification a lieu juste après le rate limiting et avant toute écriture (`Abonnement`,
  `Paiement`, appel au `PaymentProvider`) — échec = aucun effet de bord. Retourne 400 (champ
  manquant), 401 (code incorrect, avec le nombre de tentatives restantes dans le message), ou 423
  (verrouillé) — jamais de création de paiement dans ces cas.
- **UI (`PaiementForm.tsx`)** — nouvelle sous-étape "revalidation" entre le formulaire Mobile Money
  et l'appel réel à l'API : `PinInput` réutilisé tel quel (4 chiffres masqués pour l'élève, 6
  chiffres visibles pour le parent, même composant que connexion/inscription) ; côté parent, indice
  dev (`codeDevMock`) et minuteur "Renvoyer le code" repris à l'identique de `ParentLoginForm.tsx`
  pour une cohérence visuelle totale avec le reste du flux (skill `ui-ux-pro-max` : aucun nouvel
  élément visuel disruptif, juste la réutilisation des patrons déjà en place). `masquerTelephone`
  extrait de `ParentLoginForm.tsx` vers `src/lib/format.ts` pour être partagé sans duplication.
- **Vérifié via `curl`**, y compris le cas limite du verrouillage :
  - Élève : sans PIN → 400 ; PIN faux → 401 avec compteur de tentatives restantes décroissant
    (4, 3, 2, 1) ; 5ᵉ échec → 423 verrouillé 15 min, **y compris avec le bon PIN ensuite** ; la
    connexion normale (`/api/auth/callback/eleve`) avec le bon PIN est **elle aussi bloquée** au
    même moment (`CredentialsSignin`, session `null`), confirmant le partage des compteurs voulu ;
    5 lignes `AuditLogSecurite(PIN_FAIL)` créées, une par échec.
  - Parent : sans OTP → 400 ; OTP faux → 401 avec compteur décroissant ; après épuisement (5
    tentatives sur le même code) → 401 "incorrect ou expiré" (même comportement que la connexion
    normale sur un OTP épuisé) ; "Renvoyer le code" (même endpoint que le bouton) → nouveau code →
    paiement validé avec succès (`REUSSI`) ; l'OTP consommé passe `utilise = true` (non
    rejouable) ; 5 lignes `AuditLogSecurite(OTP_FAIL)` créées.
  - Paiement réussi dans les deux cas après re-vérification correcte, traité normalement par le
    worker mock (`CREDITE`), sans aucune erreur dans les logs `app`/`worker`.
  - Chaînes JSX des deux branches (élève/parent) confirmées présentes dans le bundle client
    compilé (`.next/static/chunks/app/abonnement/paiement/page.js`) — la bascule effective entre
    sous-étapes reste un changement d'état React côté navigateur, donc non observable par `curl`
    seul ; toujours aucun outil de clic navigateur disponible dans cette session (§5/§15 point 1).
  - Comptes de test supprimés après coup (sauf le compte "Aicha MVONDO" déjà signalé au tour
    précédent, laissé intact).

### `/abonnement` — la landing publique ne doit plus jamais refléter une session existante (31 août 2026)

Suivi utilisateur après test réel : depuis la landing, "Tarifs" → "Choisir Premium" renvoyait
toujours directement vers la suite du paiement, et "Gratuit" s'affichait comme "Formule actuelle"
— parce que le navigateur avait une session active (compte "NOUMBOU Cowen", créé lors d'un test
précédent) que la page utilisait silencieusement. Décision actée avec l'utilisateur, plus stricte
que le tour précédent (où garder ce comportement avait été confirmé) : **`/abonnement` atteint
depuis la landing ne doit plus jamais tenir compte d'une session existante, quelle qu'elle soit** —
revenir sur la page d'accueil doit remettre à zéro l'expérience, comme un tout nouveau visiteur,
même si le navigateur reste techniquement connecté. Les deux boutons (Gratuit et Premium) doivent
alors renvoyer vers l'écran de choix élève/parent (`/abonnement/eleve-ou-parent`), jamais
directement vers /inscription ou un paiement.

- **Nouveau marqueur explicite `?compte=1`** — seule condition qui active désormais la vue
  personnalisée (badge "Formule actuelle", bandeau "déjà Premium", lien de paiement direct avec
  l'`eleveId` de la session). Sans ce marqueur, `session` n'est même plus lue côté serveur
  (`auth()` n'est appelé que si `compte === "1"`) : impossible d'afficher quoi que ce soit de
  personnalisé par erreur, la page est structurellement générique par défaut.
  - Lien "Tarifs" de la landing (`LandingHeader.tsx`) → `/abonnement` **sans** paramètre, inchangé
    — c'est justement ce chemin qui doit rester générique.
  - Lien "Abonnement" des sidebars authentifiées (`EleveShell.tsx`, `ParentShell.tsx`) → mis à jour
    vers `/abonnement?compte=1`, pour préserver l'expérience personnalisée utile depuis le tableau
    de bord (état réel, paiement direct sans repasser par le chooser) — seul ce point d'entrée
    interne y a droit désormais.
  - `isActive()` des deux sidebars ajusté pour comparer le chemin sans la query string (sinon le
    lien "Abonnement" ne se serait plus jamais marqué actif).
  - Le sélecteur multi-enfants (parent avec plusieurs liens) propage `compte=1` dans ses propres
    liens de navigation interne, pour ne pas retomber en mode générique en changeant d'enfant.
- **`hrefGratuit` en mode générique** change aussi de cible : auparavant `/inscription` direct,
  maintenant `/abonnement/eleve-ou-parent` comme Premium — un visiteur anonyme choisissant
  "Gratuit" passe désormais aussi par le choix élève/parent (connexion ou inscription), cohérent
  avec la demande explicite de l'utilisateur pour les deux boutons.
- **Vérifié via `curl`** avec un compte de test réellement authentifié (session valide) :
  `/abonnement` sans `compte=1` → aucune trace de "Formule actuelle", les deux boutons
  ("Continuer gratuitement" et "Choisir Premium") pointent vers `/abonnement/eleve-ou-parent`,
  aucun lien de paiement direct dans le HTML — **identique à un visiteur anonyme, malgré la
  session active** ; `/abonnement?compte=1` avec la même session → personnalisation présente
  (`Formule actuelle`, lien `/abonnement/paiement?eleve=<id réel>`) ; lien "Tarifs" de la landing
  confirmé sans paramètre ; lien "Abonnement" des sidebars confirmé avec `?compte=1`. Compte de
  test supprimé après coup. Toujours aucun outil de clic navigateur disponible dans cette session
  (§5/§15 point 1).

### Bouton "Retour au tableau de bord" supprimé de l'en-tête `/abonnement` (31 août 2026)

Demande de suivi directe. `src/app/abonnement/layout.tsx` — pour une session connectée, l'en-tête
n'affiche plus rien à droite (juste le logo Klarity) ; les liens "Connexion"/"Créer un compte"
restent affichés pour un visiteur non connecté. Vérifié via `curl` : absent en mode anonyme, absent
aussi pour une session `?compte=1` réellement authentifiée (en-tête droit vide dans les deux cas
connectés). Compte de test supprimé après coup.

### Lien "Parents" de la landing — onglet Élève verrouillé (31 août 2026)

Demande de suivi directe : le lien "Parents" doit lui aussi verrouiller l'onglet non choisi sur
`/connexion`, comme le fait déjà le chooser d'abonnement, mais uniquement pour ce point d'entrée.
`LandingHeader.tsx` — href passé de `/connexion?from=/parent` à
`/connexion?from=/parent&role=PARENT` : réutilise tel quel le mécanisme de verrouillage déjà en
place (§ "Onglet Élève/Parent verrouillé..." plus haut), aucun nouveau code nécessaire. Vérifié :
tous les autres liens/redirections vers `/connexion` du projet passés en revue (`grep` sur tout
`src/`) — aucun ne porte de paramètre `role`, donc aucun n'est affecté par ce changement ; `/connexion`
sans paramètre reste sans verrouillage.

### Re-vérification paiement : recadrée sur l'élève uniquement + verrou croisé parent/élève (31 août 2026)

Révision de la re-vérification légère ajoutée précédemment (§ "Re-vérification légère avant
validation finale du paiement" plus haut) : sur demande explicite, l'OTP de re-vérification côté
parent est **retiré entièrement** — un parent a déjà franchi une vérification forte à la connexion
(OTP SMS, §2.2), lui en redemander une pour payer était redondant. Seul l'élève repasse par son
PIN avant validation, comme avant.

- **`src/lib/auth/confirmation.ts`** — `verifierOtpConfirmation` supprimée, ne reste que
  `verifierPinConfirmation`.
- **`POST /api/paiement/confirmation-otp`** supprimée (route entière retirée, plus aucun appelant).
- **`POST /api/paiement/initier`** — le champ `otp` et toute la branche de vérification parent
  disparaissent du schéma/handler ; seul `payeurRole === "ELEVE"` déclenche encore la vérification
  PIN. Le contrôle "déjà Premium" (§2.6) est **remonté avant** la vérification PIN — inutile de
  faire ressaisir un code pour une tentative de toute façon refusée.
- **`PaiementForm.tsx`** — sous-étape "revalidation" (PIN) conservée uniquement pour
  `payeurRole === "ELEVE"` ; pour un parent, le bouton "Payer" de l'étape formulaire soumet
  directement le paiement, sans écran intermédiaire — état/logique OTP (minuteur de renvoi, indice
  dev, téléphone masqué) entièrement retirés du composant.
- **Verrou anti double paiement croisé (§2.6, nouveau)** — le contrôle "déjà Premium" était déjà
  indexé par `eleveId` (jamais par `payeurRole`) donc bloquait déjà structurellement les deux sens ;
  ce qui manquait était l'affichage. `/abonnement?compte=1` (et donc `/abonnement/paiement`, qui y
  redirige désormais — bug corrigé au passage : il redirigeait vers `/abonnement` **sans**
  `compte=1`, retombant silencieusement sur la vue générique qui ne montre jamais cet état) affiche
  désormais "Payé par un parent."/"Payé par l'élève." en plus de la date d'expiration, déduit du
  dernier `Paiement.statut = REUSSI` de l'abonnement, quel que soit qui consulte la page.
- **Vérifié via `curl`**, les 4 scénarios demandés : élève payeur solo — sans PIN → 400, PIN faux →
  401 avec compteur décroissant, 5 échecs → 423 verrouillé (y compris avec le bon PIN ensuite), PIN
  correct → paiement `REUSSI` ; parent payeur — paiement direct sans aucun champ de re-vérification,
  succès immédiat ; parent paie → élève se connecte → `/abonnement?compte=1` affiche "Payé par un
  parent.", tentative de paiement élève → 409, accès direct à `/abonnement/paiement` → rebond vers
  `/abonnement?compte=1&eleve=...` ; inverse — élève paie son propre abonnement → parent lié se
  connecte → voit "Payé par l'élève.", tentative de paiement parent → 409 également. Comptes de
  test supprimés après coup. Toujours aucun outil de clic navigateur disponible dans cette session
  (§5/§15 point 1).

### Stepper bloqué sur "Vérification" en cours même après confirmation (1 septembre 2026)

Bug mineur signalé par l'utilisateur : sur l'écran de vérification, dès que le paiement passe à
`REUSSI`, l'étape "Vérification" du stepper devrait se cocher comme les précédentes — elle restait
affichée comme "en cours" (non cochée) même après confirmation. Cause : `PaiementStepper` recevait
son `step` calculé **côté serveur, une seule fois**, au premier rendu de la page
(`/abonnement/verification/[id]/page.tsx`) — au moment où le paiement est presque toujours encore
`EN_ATTENTE` (le webhook mock ne résout qu'après ~3s, cf. §16). Le statut réel n'arrive qu'ensuite,
via le polling client de `VerificationPoll.tsx`, mais ce composant ne pilotait que son propre
contenu (spinner/confirmé/échoué) — jamais le stepper, qui restait figé sur son état initial jusqu'à
un rechargement manuel de la page.

- **Correction** : `PaiementStepper` déplacé à l'intérieur de `VerificationPoll.tsx` lui-même,
  avec son `step` dérivé du **même** state `statut` que le contenu principal
  (`statut === "EN_ATTENTE" ? 3 : 4`) — les deux ne peuvent plus jamais être incohérents, par
  construction, puisqu'ils dépendent d'une seule et même valeur mise à jour par le même effet de
  polling. La page serveur ne rend plus le stepper elle-même (retiré de
  `verification/[id]/page.tsx`).
- **Vérifié via `curl`** : rendu d'un paiement déjà résolu (`REUSSI`) — les 3 premières étapes du
  stepper (Formule/Paiement/Vérification) affichent bien la coche (icône `IconCheckCircle`, 3
  occurrences confirmées avant le contenu principal), la 4ᵉ ("Confirmation") reste en état actif
  non coché, cohérent avec le contenu "Paiement confirmé !" affiché juste en dessous. La transition
  live EN_ATTENTE → REUSSI en cours de session (sans rechargement) reste non observable par `curl`
  seul — garantie par construction (state partagé) plutôt que testée en clic réel, toujours aucun
  outil navigateur disponible dans cette session (§5/§15 point 1). Comptes de test supprimés après
  coup.

### Avatar de compte élève (1 septembre 2026)

Demande : chaque élève doit avoir un avatar de profil dès la création de son compte, affiché dans
le cercle à côté de la cloche de notification (dashboard `/eleve`) et à côté du bouton "Se
déconnecter" (sidebar `EleveShell`) — deux élèves ne doivent jamais avoir le même avatar.

- **Décision d'architecture — généré, jamais stocké.** `src/lib/avatar.ts` dérive un motif
  "identicon" (grille 5×5 symétrique + teinte HSL) directement de `Eleve.id` (cuid, déjà unique en
  base) via un hash déterministe (FNV-1a) puis un PRNG (mulberry32) : le même id produit toujours
  le même avatar, sans appel réseau à un service tiers, sans image à héberger et sans migration de
  schéma — l'avatar existe "dès la création du compte" du simple fait que l'id existe dès cet
  instant, aucune étape de génération séparée à orchestrer. Avec ~11,8M de combinaisons visuelles
  distinctes possibles (360 teintes × 2¹⁵ motifs), une collision est possible en théorie à très
  grande échelle (paradoxe des anniversaires) mais non gérée explicitement — jugé largement
  suffisant pour l'échelle réelle de la plateforme plutôt que d'ajouter un registre de collision.
- **`src/components/ui/Avatar.tsx`** — composant purement fonctionnel (pas de `"use client"`,
  utilisable aussi bien dans un Server Component que dans le `EleveShell` client), rendu SVG
  (`viewBox 0 0 5 5`) dans un conteneur `rounded-full overflow-hidden`, `role="img"` +
  `aria-label` avec le nom de l'élève pour l'accessibilité.
- **`src/app/eleve/page.tsx`** — remplace le placeholder vide (`<div ... bg-primary-light />`, déjà
  réservé à cet effet) à côté de la cloche par `<Avatar seed={eleveId} nom={nom} />`.
- **`EleveShell.tsx`** — nouvelles props `eleveId`/`nom` (passées depuis `src/app/eleve/layout.tsx`,
  qui a déjà la session) ; avatar affiché juste à gauche du bouton `SignOutButton` en bas de la
  sidebar desktop, séparé du reste de la nav par une bordure.
- **Vérifié via `curl`** avec deux comptes de test distincts : teintes HSL différentes confirmées
  dans le HTML rendu (`hsl(359 ...)` vs `hsl(37 ...)`) ; exactement 2 avatars par page (cloche +
  sidebar), tous deux dérivés du même `eleveId` pour un même utilisateur (cohérent — c'est le même
  avatar affiché à deux endroits, pas deux avatars différents pour la même personne) ; recherché
  dans tout `src/app/eleve` et `src/components/eleve` — la cloche de notification n'existe qu'à cet
  unique endroit, pas de doublon à traiter ailleurs. Comptes de test supprimés après coup. Toujours
  aucun outil de clic navigateur disponible dans cette session (§5/§15 point 1) — rendu vérifié par
  inspection du HTML/SVG servi, pas par capture d'écran réelle.

#### Révision (1 septembre 2026) — silhouette générique au lieu de l'identicon, un seul emplacement

Demande de l'utilisateur (avec image de référence) : remplacer le motif identicon par un avatar
« silhouette de profil » classique (tête + épaules dans un cercle), **identique pour tout le
monde**, seule la **couleur** étant tirée aléatoirement du compte ; et **retirer l'avatar de la
sidebar** à côté de « Se déconnecter » — il ne reste plus qu'à côté de la cloche de notification
sur `/eleve`.

- **`src/lib/avatar.ts`** — l'identicon (grille 5×5 + `MotifAvatar`) est supprimé. `genererAvatar`
  ne renvoie plus que `{ teinte }` : hash FNV-1a du `Eleve.id` → PRNG mulberry32 → une teinte
  0-359. Saturation et luminosité restent fixes, donc tous les avatars ont le même style, seule la
  couleur varie. Toujours déterministe, jamais stocké, aucune migration. L'espace de collision
  visuelle se réduit à 360 teintes — assumé : deux élèves peuvent avoir la même couleur, l'avatar
  n'est qu'un ornement d'interface, jamais un identifiant.
- **`src/components/ui/Avatar.tsx`** — rendu SVG `viewBox 0 0 100 100` : cercle de fond
  `hsl(t 22% 84%)`, silhouette `hsl(t 24% 52%)` = un cercle « tête » (cy 39, r 19) + un grand
  cercle « épaules » (cy 92, r 30) rognés par un `clipPath` circulaire. Reste un composant pur
  sans `"use client"`, `role="img"` + `aria-label`.
- **`EleveShell.tsx`** — `import { Avatar }`, le `<Avatar>` de la sidebar et les props
  `eleveId`/`nom` sont retirés (`EleveShellProps` n'a plus que `children`). Le `<SignOutButton>`
  occupe désormais toute la largeur du bloc bas de sidebar.
- **`src/app/eleve/layout.tsx`** — `<EleveShell>{children}</EleveShell>` sans props ; la `session`
  reste utilisée pour le garde de rôle.
- **`src/app/eleve/page.tsx`** — inchangé, garde `<Avatar seed={eleveId} nom={nom} size={40} />`
  à côté de la cloche.

### Outillage : `npm run lint` réparé, pages d'erreur ajoutées, `next build` toujours cassé (1 septembre 2026)

En lançant `next build` et `npm run lint` pour la première fois proprement (via Docker), deux
défauts **préexistants au scaffold** sont apparus, sans rapport avec l'avatar.

- **`npm run lint` — corrigé.** `eslint.config.mjs` (généré au scaffold, commit `bc4edfa`) était
  incompatible avec `eslint-config-next@15.5.x` : imports sans extension `.js` (le paquet n'a pas de
  champ `exports`) puis, une fois corrigé, `nextVitals is not iterable` — cette version ne publie que
  des configs au format « eslintrc » hérité, pas de config plate. Réécrit en **FlatCompat**
  (`@eslint/eslintrc`, ajouté en `devDependencies`), exactement comme `create-next-app` le fait pour
  ESLint 9 + `eslint-config-next` 15.5.x. Vérifié dans le conteneur : `exit 0`, **0 erreur**, 4
  warnings préexistants mineurs (`operateur` inutilisé dans `initier/route.ts`, un `eslint-disable`
  obsolète dans `ChatPanel.tsx`, `_methode`/`_payeur` dans `mock-provider.ts`).
- **`src/app/not-found.tsx` + `src/app/global-error.tsx` — ajoutés.** 404 App Router et error
  boundary racine personnalisés, cohérents avec le design system. Utiles indépendamment. **Ne
  débloquent pas** `next build` (testé : échec identique avec et sans).
- **`next build` — non résolu, documenté comme bloquant** (voir la section « 🔴 Bloquant avant mise
  en production » en tête de ce document pour le diagnostic complet : erreur `<Html>` au prérendu de
  `/404`, préexistante — échoue déjà au commit `722f4bd` —, pistes écartées et pistes à explorer).
  Investigation volontairement arrêtée ; on y revient au moment du déploiement.
- `tsc --noEmit` : **0 erreur** (types de routes Next régénérés au préalable).

## 17. Provider SMS (mock) + unification du flux OTP parent (1 septembre 2026)

Le fournisseur SMS réel (Orange SMS Cameroun ou Africa's Talking, §3) n'est pas encore souscrit.
Comme pour `AIProvider` (§6.2) et `PaymentProvider` (§5.1), on pose l'interface + un mock, et on
bascule plus tard par un simple changement de config.

- **`src/lib/sms/`** — nouveau module, même structure que `src/lib/ai/` et `src/lib/payment/` :
  - `provider.ts` — interface `SmsProvider` avec trois méthodes, une par usage SMS sortant du CDC :
    `envoyerOtp(telephone, code, ttlMinutes)` (a, §2.2), `envoyerRappelRenouvellement(telephone,
    donnees)` (b, §5.5), `envoyerResumeProgression(telephone, donnees)` (c, §2.2.3). Méthodes
    distinctes plutôt qu'un `envoyer()` générique : un fournisseur réel route différemment le
    transactionnel (OTP) et la notification de masse (rappels, résumés).
  - `types.ts` — `ResultatEnvoiSms`, `DonneesRappelRenouvellement`, `DonneesResumeProgression`,
    `CategorieSms`, `SmsEnvoiError`. Agnostiques du fournisseur (le payload d'une vraie API SMS
    n'est pas connu).
  - `messages.ts` — composition du texte à gabarit fixe (OTP, rappel de renouvellement), isolée
    pour que mock et futur provider réel produisent un libellé identique. Le résumé de progression
    n'a pas de gabarit ici : son corps est composé par le job appelant.
  - `mock-provider.ts` — `MockSmsProvider` : n'appelle aucune API, logue
    `[SMS MOCK] Envoyé à <numéro> (<catégorie>) : <contenu>` dans les logs du conteneur, retourne
    `{ messageId, statut: "ENVOYE" }` après un délai simulé de 300 ms.
  - `index.ts` — `getSmsProvider()`, sélection via `SMS_MODE = mock | live`. `live` lève une erreur
    explicite tant qu'aucune classe réelle n'existe (même pattern que `AI_MODE`/`PAYMENT_MODE`).
- **`SMS_MODE=mock`** ajouté à `.env.example` (défaut code `?? "mock"`, non déclaré dans
  `docker-compose.yml` — même traitement que `AI_MODE`/`PAYMENT_MODE`).
- **Unification OTP (point 3 de la demande).** `src/lib/auth/otp.ts` `envoyerOtp()` faisait un
  `console.log("[OTP mock] ...")` ad hoc. Il appelle désormais
  `getSmsProvider().envoyerOtp(telephone, code, OTP_TTL_MINUTES)`. Le seul chemin d'envoi d'OTP
  (connexion parent, `/api/auth/parent/request-otp`) passe donc par `SmsProvider`. Le retour
  `codeDevMock` (hors production) est conservé : il alimente le bouton « cliquer pour remplir » du
  `ParentLoginForm`. Commentaires obsolètes nettoyés dans la route (`TODO Phase 2+ : brancher le
  vrai fournisseur SMS`).
- **Pas construit (point 4).** Aucun job BullMQ de rappel de renouvellement (§5.5) ni de résumé de
  progression (§2.2.3) — seules les méthodes `SmsProvider` correspondantes sont posées, prêtes pour
  ces jobs. `src/lib/sms/messages.ts` contient un gabarit de rappel de renouvellement provisoire,
  à figer avec le job quand il sera écrit.
- **Vérifié dans le navigateur** (pas seulement `tsc`) : parcours connexion parent de bout en bout —
  `/connexion` onglet Parent → numéro `+237677889900` + code élève `ELE-TR6-CPF` → « Recevoir le
  code ». Logs du conteneur `app` :
  `[SMS MOCK] Envoyé à +237677889900 (OTP) : Klarity : votre code de connexion est 969647. Il
  expire dans 10 minutes...` — bon numéro, bon code. Code `969647` saisi depuis les logs → `signIn`
  parent réussi → redirection `/parent`, `session.user.role === "PARENT"`,
  `session.user.telephone === "+237677889900"`, `ParentEleveLink` créé (`codeUtilise`
  `ELE-TR6-CPF`), dashboard parent rendu avec l'enfant lié. Compte de test (parent + élève + lien +
  OTP) supprimé de la base après coup. `tsc --noEmit` et `eslint` sur les fichiers touchés : 0
  erreur.

## 18. Back-office admin — dates d'examens, épreuves (+ StorageProvider), corrections signalées (1 septembre 2026)

Construit contre §2.3 du CDC. Le compte admin (`prisma/create-admin.ts`) et `/admin/connexion`
existaient déjà (Phase 1). Le dashboard `/admin` lui-même était déjà construit en §8/§9 (tuiles
stats, CA, répartition abonnements, monitoring usage IA, observabilité sécurité, journal
paiements) — cette tâche ajoute les **trois écrans de gestion** que la sidebar listait en
« Bientôt », et câble les boutons du dashboard qui pointaient dans le vide.

### `StorageProvider` (`src/lib/storage/`) — 4ᵉ abstraction du même patron

Même logique que `AIProvider` (§6.2), `PaymentProvider` (§5.1), `SmsProvider` (§17) : Cloudflare R2
n'ayant pas encore de clés, on pose l'interface + un mock, bascule ultérieure par config.

- `provider.ts` — `StorageProvider` : `uploader(fichier)` → `{ key, taille }` (clé opaque, jamais
  d'URL en base) ; `obtenirUrlSignee(key, expiresInSeconds?)` → URL **temporaire signée** (jamais
  d'accès public permanent, réf. sécurité / CLAUDE.md) ; `supprimer(key)`.
- `types.ts` — `DossierStockage` (`epreuves` | `corriges` | `copies`), `FichierAUploader`,
  `ResultatUpload`, `StorageError`.
- `mock-provider.ts` — `MockStorageProvider` : écrit sous `.storage-mock/<dossier>/<uuid>.<ext>`
  (racine du repo, **gitignoré**, bind-mounté donc persistant en dev). `obtenirUrlSignee` imite une
  URL signée R2 : lien vers `/api/admin/storage` porteur d'un HMAC (`STORAGE_MOCK_SIGNING_SECRET`)
  + échéance, refusé une fois expiré. Chemin disque borné à l'intérieur de `.storage-mock/`
  (garde anti-traversal). Logue `[STORAGE MOCK] Fichier déposé : <key> (<n> octets)`.
- `index.ts` — `getStorageProvider()`, sélection `STORAGE_MODE = mock | r2`. `r2` lève une erreur
  explicite tant que `R2StorageProvider` n'existe pas.
- `.env.example` : `STORAGE_MODE=mock` ajouté à la section R2.
- `src/app/api/admin/storage/route.ts` (GET) — sert un fichier mock depuis une URL signée
  (HMAC + échéance vérifiés). Gate ADMIN en plus : en dev, seuls les écrans admin consomment ces
  URLs. Disparaît quand R2 réel sera branché.

### 1. Dashboard `/admin` — boutons câblés

`src/app/admin/(protected)/page.tsx` : les boutons « + Ajouter une épreuve » et « + Ajouter »
(dates d'examens), jusque-là `disabled`, deviennent des `Link` vers les nouveaux écrans. Les lignes
« Corrections contestées » deviennent des `Link` vers `/admin/corrections-signalees?id=…`. Le reste
du dashboard (données réelles, jamais simulées) est inchangé — vérifié en session admin réelle :
tuiles (2 élèves, 1 parent, CA 10 000 FCFA depuis les paiements mock de test), observabilité qui
remonte les vraies tentatives de connexion échouées, épreuves/usage IA en état vide honnête.

### 2. `/admin/dates-examens` — calendrier d'examens (§2.3, §4.2.1)

- Page serveur + `src/components/admin/DateExamenManager.tsx` (client) : formulaire
  ajout/modification (BEPC/Probatoire/BAC × année scolaire × date précise **ou** période estimée —
  exclusives) + liste du calendrier groupée par année scolaire avec bouton « Modifier » qui
  recharge la ligne dans le formulaire.
- `src/app/api/admin/dates-examens/route.ts` (POST) — upsert sur la clé naturelle
  `(typeExamen, anneeScolaire)` : ajouter et modifier = même appel. `ajouteParAdminId` =
  `session.user.id`. Gate ADMIN.
- **Vérifié navigateur** : ajout BAC 2026-2027 → 19 juin 2027 (précise) et Probatoire 2026-2027 →
  « Courant mai 2027 » (estimée), les deux persistés en base. Le compte à rebours du **dashboard
  parent** (`11_dashboard_parent.png`, seul dashboard à en avoir un — la maquette élève
  `04_dashboard_eleve.png` n'en a pas) passe de « Aucune date d'examen renseignée » à
  **« BAC dans 291 jours »**. Ces deux dates sont conservées (réattribuées à `admin@klarity.com`)
  comme données valides alimentant la fonctionnalité — modifiables/supprimables via l'écran.

### 3. `/admin/epreuves` — ajout à la banque (§2.3, §4.2, §4.3)

- Page serveur + `src/components/admin/EpreuveManager.tsx` (client) : formulaire multipart (classe,
  filière conditionnelle à Première/Terminale, matière filtrée par classe/filière parmi les
  `Matiere.banqueDisponible = true`, titre, année scolaire, fiche PDF, corrigé PDF) + liste des
  épreuves avec liens **Fiche / Corrigé** (URLs signées régénérées à chaque rendu). État vide
  honnête : « la banque sera alimentée quand la source externe Supabase sera accessible ».
- `src/app/api/admin/epreuves/route.ts` (POST) — `multipart/form-data`, validation zod des
  métadonnées + des fichiers (PDF, ≤ 20 Mo), vérification `Matiere.banqueDisponible`, upload des
  deux PDF via `StorageProvider`, création `Epreuve` avec les clés opaques. Gate ADMIN.
- **Vérifié navigateur** : upload d'une épreuve de test (2 PDF) → `Epreuve` créée avec
  `fichePdfKey`/`corrigeReferenceKey`, fichiers réellement écrits dans `.storage-mock/`, log
  `[STORAGE MOCK]`, et `fetch` de l'URL signée renvoie bien le PDF (200, `application/pdf`,
  `%PDF…`). Épreuve de test + fichiers supprimés ensuite — la banque reste vide (aucune vraie
  épreuve à ajouter tant que R2 et la source Supabase ne sont pas branchés, comme demandé).

### 4. `/admin/corrections-signalees` — revue des contestations (§2.3, §2.8)

- Page serveur (liste + détail via `?id=`) + `src/components/admin/CorrectionSignaleeDetail.tsx`
  (client) : liste des `CorrectionDetail.signalee = true` avec badge « N en attente » et statut
  Traité/En attente par ligne ; panneau de détail (élève, épreuve, motif, commentaire élève,
  vignettes copie/corrigé en placeholder, détail correction IA) + formulaire « Forcer une nouvelle
  note » (note /20 + justification). État vide honnête.
- `src/app/api/admin/corrections/[id]/override/route.ts` (PATCH) — renseigne `noteOverride`,
  `justificationOverride`, `overrideParAdminId`, `dateTraitementSignalement`. **N'écrase jamais la
  sortie de l'IA** (`note`, `pointsForts`, `feedbackDetaille` intacts — invariant CLAUDE.md). Gate
  ADMIN + vérifie l'existence de la correction.
- **Vérifié navigateur** : écran d'abord en état vide, puis avec une correction signalée de test —
  liste → ouverture du détail → override note 8.5 → 14 avec justification : en base `note` reste
  `8.5`, `noteOverride = 14`, `overrideParAdminId` = l'admin, signalement marqué traité ; l'UI
  repasse la ligne en « Traité » et le détail en « Déjà traité ». Données de test supprimées.

### 5. IDOR (§2.3 point 5, réf. sécurité §5)

Le middleware (`src/middleware.ts`) ne matche que `/admin/:path*` (pages), **jamais `/api/*`** —
convention du projet : chaque route API fait son propre contrôle. Vérifié :

- Les 3 pages (`/admin/dates-examens`, `/admin/epreuves`, `/admin/corrections-signalees`) : gate
  middleware + second contrôle `session.user.role === "ADMIN"` dans le composant serveur →
  redirect `/admin/connexion`. Testé sans session : **307**.
- Les 4 routes API (`/api/admin/dates-examens`, `/api/admin/epreuves`,
  `/api/admin/corrections/[id]/override`, `/api/admin/storage`) : `auth()` +
  `session.user.role !== "ADMIN"` → **401** en tête de handler, avant toute requête base. Testé
  sans session : **401** sur toutes.
- Aucune de ces routes n'accepte d'identifiant d'élève/parent en entrée ni ne renvoie de donnée
  d'un élève/parent hors du contexte admin : `dates-examens` ne touche que `DateExamen` ;
  `epreuves` ne touche que `Epreuve` + `Matiere` ; `corrections/[id]/override` charge la
  `CorrectionDetail` par son id (ressource de revue admin, pas indexée par un élève appelant) et
  n'expose que la note/justification ; `storage` ne sert que des clés du `MockStorageProvider`,
  signées.

### Sidebar (`AdminShell.tsx`)

`/admin/epreuves`, `/admin/corrections-signalees`, `/admin/dates-examens` : `disabled` retiré. Le
badge de compteur (corrections signalées) s'affiche désormais aussi sur l'item actif. Les autres
items (`Utilisateurs`, `Élèves`, `Parents`, `Exemples corrigés`, `Usage IA`, `Sécurité`,
`Paiements`, `Revenus`, `Paramètres`) restent « Bientôt » — hors scope de cette tâche.

### Non fait (volontaire)

- Écran « Exemples corrigés » (`ExempleCorrection`) : listé dans la maquette mais pas dans la
  demande — reste `disabled`.
- Aucune vraie épreuve ni vraie correction ajoutée : les outils sont prêts, l'alimentation
  attend R2 + la source Supabase tierce.
- `next build` reste cassé (erreur `<Html>` préexistante, cf. section « 🔴 Bloquant ») — non
  aggravé par ces écrans ; `tsc --noEmit` et `npm run lint` : 0 erreur.

## 19. Rétention & suppression des données — cycle de vie du compte élève (§2.9, 1 septembre 2026)

Cycle `ACTIF -> INACTIF_NOTIFIE -> ANONYMISE`, sur le service `worker` (BullMQ, §3.1) — jamais sur
`app`.

### `src/lib/retention/` — logique pure, partagée worker + route

- **`config.ts`** — seuils surchargeables par env (valeurs de départ non figées, §2.9.1) :
  `RETENTION_INACTIVITE_JOURS` (défaut 180), `RETENTION_GRACE_JOURS` (défaut 60),
  `RETENTION_ARCHIVAGE_RECUL_ANS` (défaut 1). Réduire pour tester.
- **`detection-inactivite.ts`** — `detecterInactivite()` : les comptes `ACTIF` dont
  `derniereActiviteLe` (ou `createdAt` à défaut) dépasse le seuil passent `INACTIF_NOTIFIE`,
  `dateNotificationInactivite` est horodaté, on notifie par SMS le(s) parent(s) lié(s) — ou, à
  défaut de lien vérifié, le dernier numéro ayant payé *en tant qu'élève* (l'élève n'a pas de
  téléphone en base), sinon rien — et on journalise `COMPTE_INACTIF_DETECTE`. Idempotent (ne cible
  que `ACTIF`).
- **`anonymisation.ts`** — `anonymiserEleve(eleveId, source)` : **cœur partagé** par le job auto et
  la clôture manuelle. Irréversible, idempotent (no-op si déjà `ANONYMISE`). Hors transaction :
  suppression des objets `StorageProvider` de `TentativeEpreuve.photoUploadKeys`. En transaction :
  suppression de `MessageChat`/`ConversationChat`, `QuizQuestion`/`Quiz`, `Lacune`,
  `CorrectionDetail` (suppression complète, choix prudent §2.9.2), `TentativeEpreuve`,
  `SessionActivite`, `ParentEleveLink` ; puis anonymisation de la **ligne** `Eleve` (`nom` = « Élève
  anonymisé », `pinHash` = « ANONYMISE » — non-bcrypt, verrouille toute connexion), `statutCompte`
  = `ANONYMISE`, `dateAnonymisation` horodaté ; enfin `AuditLogSecurite`
  `COMPTE_ANONYMISE_AUTO` / `COMPTE_ANONYMISE_MANUEL` (avec `parentId` + `parentTelephone` dans
  `details` pour le manuel, §4.6). La ligne `Eleve` **n'est jamais supprimée** — l'intégrité
  référentielle avec `Abonnement`/`Paiement` (conservés, §2.9.4) est préservée.
- **`anonymisation-auto.ts`** — `anonymiserComptesExpires()` : cible `INACTIF_NOTIFIE` dont la
  notification date de plus de `DELAI_GRACE_JOURS`, sans reprise d'activité, appelle
  `anonymiserEleve(_, { type: "AUTO" })`.
- **`archivage-photos.ts`** — `archiverPhotosAncienneAnnee()` : supprime du stockage les
  `photoUploadKeys` des `TentativeEpreuve` rattachées à une `Epreuve` d'année scolaire antérieure à
  « année en cours − recul » (pivot au 1er août), vide la référence en base (idempotent).
  `CorrectionDetail` (note/feedback) **conservé** (§2.9.3).

### `src/lib/queue/retention.ts` + `src/worker/index.ts`

File `retention`, 3 Job Schedulers BullMQ (`upsertJobScheduler`, ré-enregistrés à chaque démarrage
du worker) : `detection-inactivite` (lundi 03:00), `anonymisation-auto` (lundi 04:00, après la
détection), `archivage-photos` (1er août 05:00). `declencherJobRetention(nom)` déclenche un job à
la main (tests). Le worker log confirme au boot : « schedulers rétention enregistrés ».

### `src/auth.ts` — reprise d'activité pendant le délai de grâce

Le provider élève bloquait toute connexion `statutCompte !== "ACTIF"` — un compte
`INACTIF_NOTIFIE` ne pouvait donc **jamais** « reprendre l'activité ». Corrigé : la connexion est
refusée uniquement si `ANONYMISE` ; une connexion réussie d'un compte `INACTIF_NOTIFIE` le repasse
`ACTIF` et efface `dateNotificationInactivite`. `compteToujoursValide` (refresh JWT) aligné :
invalide seulement `ANONYMISE`.

### Clôture manuelle immédiate par le parent (§2.9.1, maquette `12b`)

- **`src/app/parent/parametres/page.tsx`** — page serveur PARENT, sélection de l'enfant via
  `?eleve=` (appartenance du `ParentEleveLink` re-vérifiée, IDOR). Affiche le formulaire de clôture,
  ou un encart « Compte clôturé » si déjà `ANONYMISE`, ou « Aucun enfant lié ».
- **`src/components/parent/ClotureCompteForm.tsx`** — fidèle à la maquette : carte d'avertissement
  rouge + case « Je comprends que cette action est irréversible » + bouton, puis carte
  « CONFIRMATION FINALE » où il faut taper `CLÔTURER`. Note sur la conservation des données de
  facturation.
- **`src/app/api/parent/eleve/[id]/cloture/route.ts`** (POST) — PARENT, IDOR (lien vérifié requis,
  sinon `IDOR_BLOCKED` + 403), double confirmation **revalidée côté serveur** (`comprend === true`
  + `confirmationTexte` == « CLÔTURER » après trim/upper), puis
  `anonymiserEleve(_, { type: "MANUEL", parentId, parentTelephone })`.
- **`ParentShell.tsx`** : « Paramètres » n'est plus `disabled`.

### `SmsProvider` — 4ᵉ méthode

`envoyerAlerteInactivite(telephone, prenomEleve, joursAvantAnonymisation)` ajoutée à l'interface +
mock + gabarit (`messageAlerteInactivite`), catégorie `ALERTE_INACTIVITE`. C'est la seule brique
SMS réellement câblée à un job à ce stade (les 3 autres méthodes attendent toujours leurs jobs).

### Hors périmètre de ces jobs (§2.9.4) — vérifié non touché

`OtpVerification` (expiration courte propre), `Paiement` / `Abonnement` / `WebhookLog` (durée
légale comptable), `AuditLogSecurite` (rétention sécurité distincte). `UsageIA` (compteurs de
tokens / coûts, ops) laissé intact également — hors de la liste de suppression du §2.9.

### Vérifié réellement (pas seulement `tsc`) — jobs déclenchés à la main + curl

- **Détection** : élève test `derniereActiviteLe` à −300 j + parent lié → job `detection-inactivite`
  → `statutCompte` = `INACTIF_NOTIFIE`, `dateNotificationInactivite` posé, log
  `[SMS MOCK] Envoyé à +237655443322 (ALERTE_INACTIVITE) : ...sous 60 jours...`, audit
  `COMPTE_INACTIF_DETECTE` (`{seuilInactiviteJours:180, delaiGraceJours:60, numerosNotifies:1}`).
  Re-run → 0 compte, aucun doublon d'audit.
- **Anonymisation auto** : élève `INACTIF_NOTIFIE` notifié −70 j + conversation + abonnement → job
  `anonymisation-auto` → conversation/messages supprimés, **abonnement conservé**, `nom` = « Élève
  anonymisé », `pinHash` = « ANONYMISE », `statutCompte` = `ANONYMISE`, audit
  `COMPTE_ANONYMISE_AUTO`. Re-appel `anonymiserEleve` → `dejaAnonymise: true`, aucun nouvel audit.
- **Clôture manuelle** : connexion parent réelle via OTP (curl), `GET /parent/parametres` → 200
  avec le formulaire ; `POST .../cloture` d'un élève non lié → **403** + `IDOR_BLOCKED` ; mauvais
  mot / case décochée → **400** ; payload valide → lacune + session + conversation + lien parent
  supprimés (`contenuSupprime` renvoyé), `Eleve` anonymisée mais **ligne conservée**, abonnement
  intact, audit `COMPTE_ANONYMISE_MANUEL` avec `parentId` + `parentTelephone`. Après clôture le
  parent n'a plus d'enfant lié → « Aucun enfant lié ». *(La navigation clic-à-clic dans l'écran
  n'a pas pu être faite — extension navigateur instable pendant la session — mais la double
  confirmation est aussi appliquée côté serveur, testée.)*
- **Archivage annuel** : 2 tentatives (épreuve 2023-2024 avec 2 photos, épreuve 2026-2027 avec 1)
  → job `archivage-photos` → `photoUploadKeys` de la vieille tentative vidé (`[]`), la récente
  intacte, les 2 lignes conservées. Pivot calculé « 2025-2026 ».
- **Reprise d'activité** : connexion (curl) d'un élève `INACTIF_NOTIFIE` → session établie (n'était
  plus possible avant le correctif `auth.ts`), puis en base `statutCompte` = `ACTIF`,
  `dateNotificationInactivite` = NULL.

Données de test purgées après coup. `tsc --noEmit` et `npm run lint` : 0 erreur. `next build`
reste bloqué par le bug `<Html>` préexistant (§ « 🔴 Bloquant »), non aggravé.

