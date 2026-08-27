# Klarity — État d'avancement

_Dernière mise à jour : 27 août 2026_

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

## 12. Prochaine étape concrète

1. Rendu visuel réel (comparaison pixel avec les maquettes) dans Chrome dès que les outils
   navigateur sont disponibles dans une session — toujours pas le cas jusqu'ici (§5).
2. Corriger l'erreur `tsc` résiduelle et préexistante dans `src/auth.ts:241`
   (`session.user.email = token.email` — `token.email` est `string | undefined`, le type de
   session l'attend `string`) ; sans impact fonctionnel observé jusqu'ici mais à nettoyer avant
   d'ajouter d'autres champs de session.
3. Quand la banque d'épreuves (source Supabase tierce) devient accessible : upload/correction,
   chat mode 2, lacunes réelles, quiz — tout ce qui était explicitement hors scope de §8.
