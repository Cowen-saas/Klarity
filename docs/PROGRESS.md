# Klarity — État d'avancement

_Dernière mise à jour : 5 septembre 2026 — sections vivantes (§1, §3, §5) resynchronisées avec le travail des 4–5 septembre (§28 à §33)_

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

Le cadrage produit et technique est consolidé (cahier des charges **v1.31**,
`docs/specs/Klarity_Cahier_des_Charges.pdf`), le schéma de données est finalisé et migré
(3 migrations), et le socle d'infrastructure (Phase 0, §10 du CDC) est en place. Phase 1 est
entamée : inscription élève, connexion élève/parent, connexion admin cloisonnée
(`/admin/connexion`, création CLI uniquement), chargement du programme officiel, chat-tuteur IA
mode 1 (généraliste, `MockAIProvider`), **banque d'épreuves élève** (§27) et dashboards
élève/parent/admin fonctionnent bout en bout contre de vraies données, avec une fidélité visuelle
pixel aux maquettes desktop (voir §6 à §11). Restent hors scope tant que la clé API Anthropic
n'est pas branchée : upload/correction IA, chat mode 2, lacunes réelles, quiz, pipeline vidéo.

Phase 2 (§2.4, §2.6, §5 du CDC — Paiement) est maintenant construite en mode mock (§16) :
parcours complet Choisir formule → Paiement Mobile Money → Vérification → abonnement Premium
actif en base, pour un élève payeur solo et pour un parent payeur, avec idempotence webhook
testée explicitement et IDOR couvert sur toutes les routes par ID.

Depuis le 1er septembre 2026 (§17 à §19) :
- **`SmsProvider`** (mock) posé sur le même patron que `AIProvider`/`PaymentProvider`, et le flux
  OTP parent unifié dessus (§17).
- **Back-office admin complet** (§2.3, §18) : le dashboard `/admin` était déjà là (§8/§9) ;
  ajout des écrans de gestion **dates d'examens** (alimente enfin le compte à rebours du dashboard
  parent), **épreuves** (formulaire d'ajout + `StorageProvider` mock, en attendant Cloudflare R2)
  et **corrections signalées** (liste + détail + override manuel de note). `StorageProvider` est la
  4ᵉ abstraction du même patron.
- **Rétention & anonymisation des comptes élève** (§2.9, §19) : jobs BullMQ sur le `worker`
  (détection d'inactivité + anonymisation automatique hebdomadaires, archivage annuel des photos),
  cycle `ACTIF → INACTIF_NOTIFIE → ANONYMISE`, plus l'écran de clôture manuelle immédiate côté
  parent (`/parent/parametres`, maquette 12b).

**Cloudflare R2 est passé en réel le 1er septembre 2026** (`STORAGE_MODE=r2`, `R2StorageProvider`,
clés fournies par l'utilisateur — voir §20) : upload, URL signée expirante et suppression vérifiés
bout en bout contre le vrai bucket, puis via le vrai formulaire admin (§21) et la banque d'épreuves
élève (§27). La clé **YouTube Data API v3** est branchée et l'API répond, mais le pipeline vidéo
§2.5 lui-même reste à construire (et son étape de filtrage dépend de la clé Anthropic) — aucun code
de `src/` ne lit encore `YOUTUBE_API_KEY` (relevé à l'audit §25). Les trois accès externes encore
en attente — CamerPay live, clé API Anthropic Claude, fournisseur SMS (Orange SMS Cameroun /
Africa's Talking) — ont chacun leur interface + un mock, et basculeront en réel par un simple
changement de config (`PAYMENT_MODE` / `AI_MODE` / `SMS_MODE`), sans réécriture du code appelant.

**Travail des 2–3 septembre 2026 (§21 à §27) :** Phase R2 fermée (§21) ; CDC porté en v1.29 puis
v1.30 — SVT ajoutée à la banque/correction pour les séries C, D, TI (§22), nouveau type d'exercice
`COMMENTAIRE_COMPOSE` (§23) ; les 5 barèmes `ExempleCorrection` enfin chargés en base depuis
`docs/baremes/JSON/`, avec le premier exemple few-shot complet (DISSERTATION_LITTERAIRE) (§24, §26) ;
audit complet contre le code et la base réels + resynchronisation du graphe Graphify (§25) ; item
« Épreuves » débloqué dans la nav élève et sur la landing, avec écran banque d'épreuves filtré par
classe/série et URL signées R2 pour fiche + corrigé (§27).

**Travail des 4–5 septembre 2026 (§28 à §33) :**
- **CDC v1.30 → v1.31** (§28) : deux types d'exercice propres à la **3ème Français** ajoutés à
  l'enum `TypeExerciceCorrection` — `EXPRESSION_ECRITE` (grille pondérée /10, doublée sur 20) et
  `CORRECTION_ORTHOGRAPHIQUE` (comptage de fautes, mécanisme distinct des barèmes pondérés) ;
  migration `20260904074258_…` (3ᵉ migration). L'enum compte 7 valeurs.
- **Les 7 `ExempleCorrection` few-shot complets** (§31) : `enonceModele` / `exempleReponseModele` /
  `notesMethodologiques` remplis pour les 7 types (Dissertation Philo, la dernière pièce, incluse),
  vérifiés octet par octet en base ; `baremeStructure` inchangé. Le dispositif RAG/few-shot §4.2.2
  est donc **au complet** — reste bloqué uniquement sur la clé API Anthropic pour être exercé.
- **Gestion centralisée de l'expiration de session** (§29, les 3 rôles) : `exigerRole()` (401
  structurée `SESSION_EXPIREE`) sur 11 routes API, `apiFetch()` client qui redirige proprement vers
  `/connexion` (ou `/admin/connexion`) avec `?from=…&raison=expiree` + retour automatique à la page
  d'origine, bandeau « Ta session a expiré », veilleur proactif (`SessionExpiryWatcher`).
- **Durée réelle du refresh token** (§30) : bug de session *de facto* infinie corrigé — le
  `refetchInterval` du `SessionProvider` (§29) repoussait silencieusement la fenêtre de 30 jours
  toutes les 5 min tant qu'un onglet restait ouvert. Retiré ; le renouvellement reste calé sur une
  activité réelle (navigation, retour de focus). `REFRESH_TOKEN_TTL_SECONDS = 2 592 000` (30 j)
  inchangé, expiration réelle après 30 j d'inactivité vérifiée.
- **Connexion depuis « Épreuves »** (§32) : la banque d'épreuves étant réservée à l'élève, cet
  écran de connexion retire complètement l'option Parent (pas seulement grisée) et centre l'unique
  option « Élève ».
- **Dette de méthode CDC documentée** (§5 point 4) : la redaction PyMuPDF ne sait pas refaire le
  flux ; le tableau visuel §4.2.2 reste à 4 lignes alors que l'enum en a 7 — solution de fond =
  reconstruire le CDC depuis une source Markdown → WeasyPrint, le jour où ce sera nécessaire.
- **6 écrans admin débloqués** (§33) : audit des 3 dashboards (items grisés « Bientôt ») puis
  construction des 6 écrans back-office qui ne dépendaient d'aucun accès externe (banque
  d'épreuves / clé Anthropic / CamerPay / SMS) — juste jamais construits : **Utilisateurs, Élèves,
  Parents, Exemples corrigés, Sécurité, Usage IA**. Tous branchés sur les vraies données déjà en
  base, badges « Bientôt » retirés dans `AdminShell`. Restent grisés : Paiements, Revenus,
  Paramètres.
- Graphe Graphify resynchronisé pour §29–§32 (à la demande de l'utilisateur) — 1326 nœuds /
  2030 arêtes / 140 communautés, santé propre (91 % EXTRACTED, 0 AMBIGUOUS), 0 fichier en
  attente après merge (`graphify-out/` local, gitignoré).

`next build` ne fonctionne pas (erreur `<Html>` préexistante, cf. bandeau « 🔴 Bloquant » en tête) —
le développement se fait entièrement via `next dev` sous Docker Compose. `npm run lint` a été
réparé le 1er septembre (§ « Outillage »).

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
- **Prisma** : `schema.prisma` finalisé (26 modèles, 22 enums, conforme au §4 du CDC) et migré —
  3 migrations : `20260819070754_init`, `20260902113429_add_commentaire_compose_type_exercice`
  (§23), puis `20260904074258_add_expression_ecrite_correction_orthographique_type_exercice` (§28).
- **Auth.js v5**, sessions JWT stateless avec rotation de refresh token (`src/auth.ts`) :
  - Provider `eleve` — code élève + PIN (verrouillage après échecs répétés, `PIN_MAX_ATTEMPTS`).
  - Provider `parent` — code élève + téléphone + OTP (`/api/auth/parent/request-otp`), qui
    établit le `ParentEleveLink` a posteriori dès la première vérification réussie.
  - Provider `admin` — email + mot de passe + TOTP obligatoire (2FA).
  - `src/middleware.ts` applique le cloisonnement de rôle par préfixe de route
    (`/admin`, `/parent`, `/eleve`) côté serveur, via `src/lib/auth/session.ts` — la
    vérification d'appartenance à la ressource précise (IDOR) reste à faire par route en
    Phase 1+ (voir §5, item ouvert).
  - **Expiration de session** (§29–§30) : détection centralisée `exigerRole()` sur les routes
    API (401 structurée `SESSION_EXPIREE`), redirection propre côté client (`apiFetch`) + retour
    à la page d'origine, veilleur proactif ; refresh token de 30 jours renouvelé sur activité
    réelle uniquement (jamais un onglet inactif).

### Abstractions de services externes — même patron mock → réel (4)
Le CDC recommande explicitement de respecter les interfaces des services externes dès la
Phase 0 même en mode mock, pour que la bascule vers les services réels se limite à un
changement de configuration. Quatre abstractions suivent maintenant ce patron
(`get<X>Provider()` + `<X>_MODE` en env + une erreur explicite tant que la classe réelle
n'existe pas) :
- `src/lib/ai/` — `AIProvider` + `MockAIProvider` (`.chat()`, `.corrigerCopie()`,
  `.genererQuiz()`, simulation de rate limit, estimation de tokens). `AI_MODE=mock|live`.
- `src/lib/payment/` — `PaymentProvider` + `MockPaymentProvider` (`.initierPaiement()`,
  `.traiterWebhook()`, `.verifierSignatureWebhook()`). `PAYMENT_MODE=mock|sandbox|live`.
- `src/lib/sms/` — `SmsProvider` + `MockSmsProvider` (§17) : `envoyerOtp`,
  `envoyerRappelRenouvellement`, `envoyerResumeProgression`, `envoyerAlerteInactivite` (§19).
  Le mock logue `[SMS MOCK] Envoyé à <numéro> (<catégorie>) : <contenu>`. `SMS_MODE=mock|live`.
  Le flux OTP parent (`src/lib/auth/otp.ts`) passe par cette interface.
- `src/lib/storage/` — `StorageProvider` + `MockStorageProvider` (§18) : `uploader()`,
  `obtenirUrlSignee()` (URL signée expirante, jamais d'URL publique en base), `supprimer()`.
  Le mock écrit dans `.storage-mock/` (gitignoré). `STORAGE_MODE=mock|r2`.

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
persistant (`graphify-out/`, local et gitignoré). Sert de garde-fou pour repérer les incohérences
entre maquettes, CDC et code au fil du développement. **État : `graphify --update` rejoué le
5 septembre pour intégrer §29–§32 — 1326 nœuds / 2030 arêtes / 140 communautés, santé propre
(91 % EXTRACTED, 8 % INFERRED, 0 AMBIGUOUS ; aucune arête orpheline / endpoint manquant /
doublon), `detect_incremental` = 0 fichier en attente.** Couvre le mécanisme centralisé
d'expiration de session (§29 : `exigerRole`, `apiFetch`, `AuthenticatedArea`,
`SessionExpiryWatcher`), le correctif durée réelle du refresh token (§30), les 7 `ExempleCorrection`
few-shot chargés (§31) et l'écran de connexion « Épreuves » élève-seul (§32), en plus de §28
(CDC v1.31, `TypeExerciceCorrection` à 7 valeurs).

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
   qu'aucun flux ne soit exercé avant l'audit du 25 août ; le piège du volume anonyme
   `node_modules` (§4 ci-dessus) **s'est reproduit le 2 septembre** après l'ajout du SDK AWS —
   `docker compose up -d` seul faisait crasher le `worker` (§21). Réflexe à garder : après tout
   commit touchant les dépendances, `docker compose up -d --build --renew-anon-volumes`.
2. 🟡 **Outils navigateur Chrome — disponibles depuis le 1er septembre 2026, mais extension
   instable.** Utilisés avec succès le 1er sept pour click-tester le stepper de paiement (§16), le
   back-office (§18) et une partie de la rétention (§19). L'instabilité a **récidivé les 2–3 sept**
   (§25, §27) : captures d'écran toujours refusées sur `localhost:3000`, et la navigation par clic
   ne se déclenche pas de façon fiable sur le serveur `next dev` — les vérifications navigateur se
   font désormais **via l'arbre d'accessibilité (`read_page`)**, qui rend bien tout le contenu
   (cartes, liens signés R2, bannières). Le rendu pixel des écrans Phase 1 (§6 à §11), de l'écran
   de clôture parent et de la banque d'épreuves (§27) n'a toujours pas été comparé visuellement aux
   maquettes.
3. ✅ **`DateExamen` — résolu (§18).** L'écran admin `/admin/dates-examens` existe ; deux dates
   ont été saisies (BAC 2026-2027 au 19 juin 2027, Probatoire 2026-2027 « courant mai 2027 »,
   attribuées à `admin@klarity.com`) et le compte à rebours du dashboard parent affiche désormais
   « BAC dans N jours ».
4. 🟡 **Méthode d'édition du CDC — limite structurelle atteinte, à replanifier un jour (non urgent).**
   Le cahier des charges (`docs/specs/Klarity_Cahier_des_Charges.pdf`) n'a **pas de source
   Markdown/HTML** — chaque bump de version depuis v1.28 se fait par **redaction PyMuPDF directement
   sur le PDF** (§22, §23, §28). Or PyMuPDF **ne sait pas refaire le flux du texte** : dès qu'un ajout
   dépasse le blanc disponible, il faut soit insérer une page dédiée + renuméroter (fait en v1.31
   pour le journal, §28), soit renoncer à l'édition. Conséquence : une **dette de documentation
   visuelle s'accumule** — le tableau des types d'exercice de **§4.2.2 ne montre que 4 lignes**
   (DISSERTATION_PHILO, DISSERTATION_LITTERAIRE, CONTRACTION_TEXTE, DISCUSSION) alors que l'enum
   `TypeExerciceCorrection` en compte **7** : `COMMENTAIRE_COMPOSE` (omis en v1.30, §23),
   `EXPRESSION_ECRITE` et `CORRECTION_ORTHOGRAPHIQUE` (omis en v1.31, §28) n'y figurent pas. Ils
   restent normatifs via l'enum + les entrées de journal + `CLAUDE.md`, mais le tableau est
   désynchronisé et chaque version suivante aggrave l'écart.
   **Solution de fond — Option B (écartée jusqu'ici) : reconstruire le CDC depuis une source
   Markdown (ou HTML/CSS) régénérée via WeasyPrint** (le moteur d'origine du document — cf. métadonnée
   `producer: WeasyPrint 69.0`). Une fois la source en place, toute repagination (tableau §4.2.2
   complet, dette `COMMENTAIRE_COMPOSE` comblée, versions futures) devient un simple `weasyprint`.
   Coût : reconstruire ~43 pages en Markdown, et une rupture unique de la continuité « pages
   inchangées identiques au bit près ». **À faire quand** : soit le tableau §4.2.2 (ou un autre)
   doit impérativement refléter l'état réel, soit le document continue de grandir au point que la
   redaction PyMuPDF n'est plus tenable. WeasyPrint n'est pas installé dans l'environnement actuel
   (dépendances système pango/cairo, pas de `sudo`) — à prévoir aussi.

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

1. Comparaison pixel systématique avec les maquettes dans Chrome. Les outils navigateur sont
   disponibles depuis le 1er septembre (§5 point 2) et ont servi à click-tester le comportement de
   plusieurs écrans (stepper §16, back-office admin §18, rétention §19, connexion + banque
   d'épreuves §27), mais l'extension est instable et les captures d'écran sont bloquées sur
   `localhost` — une passe de fidélité visuelle complète reste à faire, notamment pour les écrans
   Phase 1 (§6-§11), l'écran de clôture parent (12b), les 4 écrans de paiement (§16) et la banque
   d'épreuves (§27, comparer à `06_banque_epreuves.png`).
2. ~~Corriger l'erreur `tsc` résiduelle dans `src/auth.ts:241`~~ — fait en §16 (assignation
   `session.user.email` rendue conditionnelle) ; `npx tsc --noEmit` dans le conteneur est propre.
3. Compléter et faire valider juridiquement les 3 documents légaux avant tout déploiement public
   (voir le bandeau bloquant en tête de ce document).
4. ~~Quand la banque d'épreuves (source Supabase tierce) devient accessible~~ — **partiellement
   fait** : du contenu réel a été ajouté (9 épreuves, directement en base), l'écran élève de
   consultation est en ligne (§27). Reste bloqué sur la **clé API Anthropic** (pas Supabase) :
   upload/correction IA, chat mode 2, lacunes réelles, quiz — tout ce qui était hors scope de §8.
   Le pipeline de correction lui-même (route d'upload → `TentativeEpreuve` → job BullMQ →
   `corrigerCopie()` → `CorrectionDetail` + `Lacune`) n'existe pas encore dans `src/`.
5. Job BullMQ de rappel de renouvellement (§5.5 du CDC) — cron quotidien J-3 avant
   `dateProchainRenouvellement`, bascule `ACTIF → EXPIRE` après le délai de grâce — explicitement
   hors scope de la tâche Phase 2 traitée en §16 (qui couvrait §2.4/§2.6/§5.1-§5.4, pas §5.5).
   **Débloqué** : le canal SMS sortant est en place (`SmsProvider`, §17, avec
   `envoyerRappelRenouvellement` déjà posé) et l'ossature de jobs cron sur le worker existe
   (`src/lib/queue/retention.ts`, §19) — reste à écrire le job lui-même et le gabarit de message.
   Le job de rétention/anonymisation §2.9, lui, est **fait** (§19).
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
  non coché, cohérent avec le contenu "Paiement confirmé !" affiché juste en dessous.
- **Transition live confirmée au navigateur (1 septembre 2026)** — parcours réel piloté dans
  Chrome (inscription → paiement Orange Money → PIN). Sur `/abonnement/verification/[id]`, **même
  URL tout du long, sans rechargement** : à `t = 0` le titre est « Vérification de votre
  paiement… », le spinner tourne, l'étape « Vérification » du stepper n'est **pas** cochée (2
  coches) ; à `t ≈ 4 s` le titre passe à « Paiement confirmé ! », le spinner disparaît et l'étape
  « Vérification » est **cochée** (4 coches). La garantie « par construction » (state partagé) est
  donc bien vérifiée empiriquement. Comptes de test supprimés après coup.

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
- **Vérifié** : `tsc --noEmit` propre (types de routes Next régénérés). Rendu contrôlé sur un
  aperçu HTML statique des 12 teintes + la silhouette de référence, et par lecture du SVG servi —
  la page `/eleve` elle-même n'a pas été ouverte au navigateur ce jour-là (extension instable au
  moment de ce changement).

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

## 20. Cloudflare R2 réel + vérification clé YouTube Data API (1er septembre 2026)

L'utilisateur a renseigné ses vraies clés dans `.env` (jamais partagées dans le chat) et demandé
la bascule effective : `STORAGE_MODE=r2` + les 4 `R2_*`, et `YOUTUBE_API_KEY`.

### `R2StorageProvider` — 4ᵉ abstraction passée en réel

- **`src/lib/storage/r2-provider.ts`** (nouveau) — implémente `StorageProvider` contre l'API
  S3-compatible de R2 (`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, `region: "auto"`).
  `uploader()` = `PutObjectCommand` (clé opaque `dossier/uuid.ext`, `ContentType` posé) ;
  `obtenirUrlSignee()` = presigned GET SigV4 (`@aws-sdk/s3-request-presigner`), défaut 15 min, borné
  à 7 j ; `supprimer()` = `DeleteObjectCommand` (idempotent). Aucune URL publique, jamais de bucket
  public — mêmes garanties que le mock.
- **`src/lib/storage/index.ts`** — `case "r2"` instancie `R2StorageProvider` (l'erreur « pas encore
  implémenté » est retirée). Les appelants (`POST /api/admin/epreuves`, page `/admin/epreuves`, job
  `archivage-photos` du worker, futur pipeline de correction) sont inchangés.
- **Dépendances ajoutées** : `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. Images `app` +
  `worker` reconstruites (`docker compose build`), puis `up -d --force-recreate --renew-anon-volumes`
  (le volume anonyme `node_modules` ne se met pas à jour autrement — piège §4). **Rappel confirmé
  cette session** : `docker compose restart` **ne recharge pas** `.env` — il faut `up -d
  --force-recreate` pour qu'un conteneur voie de nouvelles variables d'environnement.
- **`src/app/api/admin/storage/route.ts`** (serveur d'URL signées du mock) laissé en place : dormant
  sous `STORAGE_MODE=r2` puisque les URLs signées R2 sont absolues et servies directement par R2 ;
  toujours utile si on repasse en `mock`. Disparaîtra quand le mock sera retiré.

### Vérifié bout en bout contre le vrai bucket

Script de fumée jetable exerçant **exactement** les appels de la route/page admin
(`uploader()` ×2 vers `epreuves/` et `corriges/`, `obtenirUrlSignee()`, puis `supprimer()`), lancé
dans le conteneur `app` en `STORAGE_MODE=r2` :

- upload des 2 PDF → objets réellement créés dans le bucket R2 (log `[STORAGE R2] Fichier déposé`),
  **pas** dans `.storage-mock/` ;
- URL signée générée (hôte `<bucket>.<account>.r2.cloudflarestorage.com`, `X-Amz-*`) → `GET` **200**,
  `content-type: application/pdf`, octets identiques à la source ;
- URL signée à 1 s d'expiration, rejouée après 2,5 s → **403** (R2 applique bien l'échéance) ;
- `supprimer()` puis second `supprimer()` sur la même clé → OK, idempotent ;
- `GET` sur une URL signée encore valide après suppression → **404**.

Tous les objets de test supprimés du bucket après coup.

### Test via le formulaire admin — délégué à l'utilisateur

Exercer le vrai formulaire `/admin/epreuves` dans le navigateur exige une session ADMIN, que Claude
Code ne crée jamais lui-même (règle actée §11 : seul `npm run admin:create` lancé par l'utilisateur
produit un compte admin réel). L'utilisateur fait ce click-test de son côté. La couche stockage
(seule partie touchant R2) est déjà couverte par la vérification ci-dessus, avec les mêmes appels
que la route ; le reste du chemin formulaire (multipart + zod + `prisma.epreuve.create` + gate
ADMIN) ne touche pas R2 et était déjà validé au §18 avec le mock.

### YouTube Data API v3 — clé lue, API répond

- Variable utilisée : **`YOUTUBE_API_KEY`** (déjà le nom documenté dans `.env.example`).
- Appel de recherche test (`GET https://www.googleapis.com/youtube/v3/search`, `part=snippet`,
  `type=video`, `q` = notion de maths Terminale, `relevanceLanguage=fr`) depuis le conteneur `app` →
  **HTTP 200**, `youtube#searchListResponse`, 3 vidéos FR pertinentes renvoyées (dont une chaîne
  connue, « Yvan Monka »). La clé est bien lue et acceptée par Google.
- **Aucun module vidéo n'existe encore** dans `src/` — le pipeline §2.5 (lacune → notion → recherche
  YouTube → filtrage Claude Haiku → cache `LacuneVideoCache`) reste à construire. Il dépend en amont
  des lacunes réelles / quiz (donc de la banque d'épreuves Supabase), et son étape de filtrage
  **reste bloquée tant que `ANTHROPIC_API_KEY` n'est pas branchée** (`AI_MODE=live`). La
  vérification ci-dessus confirme seulement que la brique YouTube sera prête le moment venu.

### État Docker en fin de session

Après la reconstruction des images et le `--renew-anon-volumes`, le moteur Docker Desktop est
redevenu injoignable (`request returned 500 Internal Server Error`, `docker ps` sans sortie) — même
mode de panne qu'au §14, sans rapport avec ce travail. Le redémarrage forcé de Docker Desktop
(disruptif, à confirmer avec l'utilisateur — cf. §14) n'a pas été fait dans cette session. **À la
reprise** : `docker compose up -d --force-recreate --renew-anon-volumes app worker`, puis vérifier
que `app` et `worker` démarrent proprement avec le SDK AWS (le `worker` importe `getStorageProvider`
via `src/lib/retention/anonymisation.ts`) et refaire un `npx tsc --noEmit` / `npm run lint` dans le
conteneur (les deux étaient à 0 erreur avant la panne moteur).

## 21. Phase R2 — validée bout en bout via le formulaire admin réel (2 septembre 2026)

Reprise après le redémarrage de Docker Desktop annoncé au §20. Cette session ferme la Phase R2.

### Docker relancé, pièges du §20 confirmés

- `docker compose up -d` seul a fait **crasher le `worker`** : `Cannot find module '@aws-sdk/client-s3'`.
  Le volume anonyme `node_modules` datait d'avant l'ajout des deux paquets AWS au §20 et ne se met
  pas à jour tout seul (`tsx watch` masquait la panne en gardant le conteneur « Up »). Corrigé par
  `docker compose up -d --build --renew-anon-volumes` — `npm ci` récupère les deux paquets, volumes
  `node_modules` / `.next` recréés, volumes nommés `postgres_data` / `redis_data` **préservés**.
  Règle : après tout commit qui touche les dépendances, `--build --renew-anon-volumes` obligatoire,
  jamais un simple `up -d`.
- État final : `app` **200** sur `:3000`, `worker` « connected to Redis » + schedulers rétention
  enregistrés, `postgres` / `redis` healthy, `adminer` **200** sur `:8080`, `prisma migrate status`
  « Database schema is up to date! ». `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur**
  (4 warnings préexistants, sans rapport avec R2).

### Click-test du formulaire `/admin/epreuves` — fait par l'utilisateur, concluant

L'utilisateur (session ADMIN réelle, créée de son côté par `npm run admin:create` — cf. §11) a
ajouté une épreuve de test via le vrai formulaire : upload des 2 PDF, création de la ligne
`Epreuve`, liens **Fiche** et **Corrigé** fonctionnels (URLs signées R2 absolues, `GET` OK), les
deux objets bien visibles dans le bucket R2 sous `epreuves/` et `corriges/`. Le chemin complet
multipart + zod + gate ADMIN + `prisma.epreuve.create` + `R2StorageProvider.uploader()` est donc
validé en conditions réelles, pas seulement la couche stockage isolée du §20.

### Nettoyage des données de test

Script jetable (`scripts/`, supprimé après usage) exécuté dans le conteneur `app` en
`STORAGE_MODE=r2` : `R2StorageProvider.supprimer()` sur les deux clés
(`epreuves/ba5b9881-…​.pdf`, `corriges/c5d5fc0b-…​.pdf`) puis `prisma.epreuve.delete`. Vérifié :
`SELECT count(*) FROM epreuves` → **0** ; `GET` sur une URL signée fraîche pour chaque clé → **404**.
Le bucket R2 et la table `epreuves` sont revenus à vide, comme avant le test.

### Bilan Phase R2

`R2StorageProvider` est en production (`STORAGE_MODE=r2`), exercé avec succès par le seul appelant
actuel (formulaire admin d'ajout d'épreuve). Les autres appelants (`archivage-photos` du worker,
futur pipeline de correction §2.5) partagent la même interface et n'ont pas besoin d'adaptation. La
banque d'épreuves reste vide en attendant la source de contenu (§18 : Supabase tierce) ; rien
d'autre ne bloque côté stockage.

## 22. CDC v1.29 — SVT ajoutée aux séries C, D et TI (2 septembre 2026)

Mise à jour du cahier des charges (§2.1, §4.2) demandée par l'utilisateur : **SVT rejoint la banque
d'épreuves et la correction automatisée pour les séries C, D et TI** (1ère et Terminale), en plus des
matières déjà prévues. **Le Français n'est pas retiré** — c'est un complément, pas un remplacement :
la justification actée est la centralisation sur les matières scientifiques pour C/D/TI tout en
conservant le Français, obligatoire à l'examen national (BEPC / Probatoire / Baccalauréat).

Nouvelle table de référence §2.1 pour ces 3 séries :

| Série | Matières banque + correction |
|---|---|
| C | Maths, Physique, Français, Chimie, **SVT** |
| D | Maths, Physique, Français, Chimie, **SVT** |
| TI | Maths, Physique, Français, Chimie, Système d'Information, Programmation, Réseau, **SVT** |

### Cahier des charges (`docs/specs/Klarity_Cahier_des_Charges.pdf`, régénéré en place)

Bump **v1.28 → v1.29**. Édité avec PyMuPDF (redaction réelle du texte remplacé + réinsertion,
polices `Liberation Sans` extraites du document), aucune page ajoutée donc **aucune renumérotation** :

- Nouvelle entrée de journal des modifications « v1.28 → v1.29 » (page 8) + signet TOC.
- §2.1 table de référence : SVT ajoutée aux lignes séries C / D / TI ; légende passée à « (v1.29) » ;
  paragraphe de comptage réécrit — le socle passe de **9 à 15 couples matière/classe/série**
  (9 historiques + 6 nouveaux couples SVT pour C/D/TI en 1ère et Terminale).
- §4.2.3 : bloc « Précision v1.27 » réécrit en « Précision v1.27 / révision v1.29 » avec le nouveau
  total de 15 et la note que SVT n'ajoute pas de fichier JSON, seulement une section aux fichiers
  C/D/TI existants.
- En-tête page 1 : « v1.29 — 2 septembre 2026 ».
- Vérifié : 42 pages, séquence de pieds de page 1→42 intacte, 38 pages non touchées identiques au
  bit près, plus aucune trace de « 19 août 2026 » ni « soit 9 au total ».

### Données et code

- **`docs/programmes/{Première,Terminale} {C,D,TI}/programme_*.json`** : les 6 fichiers ont reçu une
  vraie section `svt` (4 modules, 14–15 thèmes chacun — programme officiel camerounais réel), déjà
  présente dans l'arbre de travail au moment de la tâche. Confirmé par l'utilisateur : on charge le
  vrai contenu. Fichiers `*:Zone.Identifier` (marque Windows « téléchargé d'Internet ») supprimés et
  ajoutés à `.gitignore`.
- **`prisma/seed.ts`** : aucune logique à changer (seed entièrement piloté par les données). Le seed
  dérive automatiquement `Matiere.filiereRequise` de SVT = **{A, C, D, TI}** (était `{A}`) à partir
  de la présence de la clé `svt` dans les 6 fichiers, et matérialise les 6 nouveaux
  `ProgrammeOfficiel`. Commentaire d'en-tête mis à jour. Reseed exécuté : **48 ProgrammeOfficiel**
  (était 42), dont **9 couples SVT** (était 3 : 3ème + 1ère A + Tle A → + C/D/TI en 1ère et Tle).
- **`prisma/schema.prisma`** : aucun changement — `filiereRequise` est un `Filiere[]` dérivé.
- **`CLAUDE.md`** : table « Curriculum structure » mise à jour (séries C/D et TI gagnent SVT).

### Test réel — élève Terminale D voit SVT au chat-tuteur

Test HTTP bout en bout : `POST /api/eleve/inscription` (Terminale D) → connexion NextAuth
(`callback/eleve`, 302 + cookie de session) → `GET /api/eleve/matieres` (mode 1, branché sur
`ProgrammeOfficiel` par `classe` + `filiere`). Réponse : **Chimie, Français, Mathématiques, Physique,
SVT**. SVT présent ✅, Français toujours présent ✅. Élève de test supprimé après coup.

### Graphe Graphify

`graphify --update` (voir §3) : 129 fichiers ré-indexés, graphe reconstruit à 1075 nœuds / 1702
arêtes / 100 communautés, **santé propre** (aucune arête orpheline / endpoint manquant / doublon).
Le changement v1.29 est cohérent dans le graphe : `SVT (matiere)` → `shares_data_with` →
`ProgrammeOfficiel (15 couples v1.29)`, `SVT` → `conceptually_related_to` →
`Matiere.filiereRequise {A,C,D,TI}` et `corrigerCopie()`, et le nœud « v1.29 change » relie la table
de référence §2.1, `filiereRequise` et `ProgrammeOfficiel`. Graphify a aussi rapproché SVT de Chimie
(`semantically_similar_to`) — les deux couvrent désormais C/D/TI.

### Suites

- Les deux fichiers barème apparus dans l'arbre de travail
  (`docs/baremes/Bareme_commentaire_compose.txt`, `Bareme_philosophie.txt` — typo `philososphie`
  corrigée) ont été versionnés (commit `cf07a7c`) : ce sont les sources brutes des 5 barèmes
  `ExempleCorrection`.
- Le nouveau type d'exercice `COMMENTAIRE_COMPOSE` a été ajouté à l'enum et le CDC porté en v1.30
  (voir §23).

## 23. CDC v1.30 — type d'exercice COMMENTAIRE_COMPOSE (2 septembre 2026)

Le back-office admin et la correction IA supposent 4 types d'exercice méthodologiques
(`TypeExerciceCorrection`), mais un **cinquième barème** — le **commentaire composé** — est en réalité
au programme de Français et sa source brute est versionnée
(`docs/baremes/Bareme_commentaire_compose.txt`). Écart relevé par le graphe Graphify (arête
`AMBIGUOUS` sur « commentaire composé » vs les 4 types du CDC). Corrigé :

- **`prisma/schema.prisma`** : `COMMENTAIRE_COMPOSE` ajouté à l'enum `TypeExerciceCorrection`.
  Migration `20260902113429_add_commentaire_compose_type_exercice` (`ALTER TYPE … ADD VALUE`),
  appliquée ; `prisma validate` OK ; client régénéré.
- **CDC (`Klarity_Cahier_des_Charges.pdf`, régénéré en place, v1.29 → v1.30)** : nouvelle entrée de
  journal + signet TOC ; §4.2.2 — l'enum de `ExempleCorrection` liste désormais les 5 valeurs et le
  texte parle de « 5 barèmes officiels ». Le barème du commentaire composé (Introduction 3 ·
  Développement 12 — 2 axes de lecture, méthode **O.C.I.E.** Observation/Citation/Interprétation/Effet
  · Conclusion 3 · Présentation & langue 2 = 20 pts) est décrit dans l'entrée de journal (la table
  visuelle §4.2.2 reste à 4 lignes pour ne pas provoquer de re-pagination — le contenu normatif est
  l'enum + le changelog). En-tête page 1 : « v1.30 — 2 septembre 2026 ». Vérifié : 42 pages, pieds
  de page 1→42, 39 pages non touchées identiques au bit près.
- **`CLAUDE.md`** : la ligne `docs/baremes/*.txt` liste maintenant les 5 types.
- **Seed `ExempleCorrection`** : fait au §24 (juste après).
- **Graphe Graphify** : resynchronisé après coup, voir §25.

## 24. Seed ExempleCorrection — les 5 barèmes chargés en base (2 septembre 2026)

Jusqu'ici les barèmes n'existaient qu'en sources brutes (`docs/baremes/*.txt`) — **aucune ligne
`ExempleCorrection` en base**. L'utilisateur a fourni les 5 barèmes structurés en JSON
(`docs/baremes/JSON/bareme_*.json`) ; `prisma/seed.ts` est étendu pour les charger.

### `prisma/seed.ts` — `seedExemplesCorrection()`

Lit les 5 fichiers de `docs/baremes/JSON/`, et pour chacun :

- **`matiereId`** résolu par `prisma.matiere.findUnique({ where: { nom } })` sur le champ `matiere` du
  JSON (« Français » ×4, « Philosophie » ×1) — lève une erreur si la matière n'existe pas (donc le
  seed des programmes doit tourner d'abord, ce qui est le cas : même `main()`).
- **`typeExercice`** = le champ `typeExercice` du JSON, validé contre l'enum
  `TypeExerciceCorrection` (les 5 valeurs) — erreur explicite sinon.
- **`baremeStructure`** = le **contenu JSON complet du fichier, tel quel** (aucune transformation) —
  conserve donc aussi `seriesConcernees`, `totalPoints`, `remarquesImportantes`,
  `criteresTransversaux`, `baremeStructureAlternatif`, `contexte`, etc.
- **`enonceModele` / `exempleReponseModele` / `notesMethodologiques`** = `""` : seuls les barèmes
  sont fournis, pas encore les exemples few-shot (énoncés + réponses modèles) — à compléter avec le
  pipeline de correction (§6.2).
- **Idempotence** : pas de contrainte d'unicité DB sur `(matiereId, typeExercice)` (seulement un
  `@@index`), donc `findFirst` + `update | create` à la main — rejouable sans doublon (reseed vérifié).

### Vérifié réellement en base (`psql`)

- **5 lignes `exemples_correction`**, une par `typeExercice`, `count(DISTINCT typeExercice) = 5`.
  `DISSERTATION_PHILO` → Philosophie ; les 4 autres → Français. `ajouteParAdminId` = compte seed,
  `langue` = FR.
- **`baremeStructure` complet et lisible, non tronqué** : `length(baremeStructure::text)` = 3261 /
  1104 / 1185 / 1145 / 2978 octets — **identique aux fichiers source**. `jsonb_pretty()` du barème
  `COMMENTAIRE_COMPOSE` affiche la structure entière (titre, 4 sections, tous les `sousCriteres`,
  `points`, `details`, `remarquesImportantes`) — rien de coupé.
- Extraction JSON de contrôle : `baremeStructure->>'typeExercice'` == colonne `typeExercice` pour les
  5 ; `->>'totalPoints'` = 20/20/10/10/20 ; nombre de sections 4/5/4/4/4 ; clés optionnelles
  préservées (`baremeStructureAlternatif` + `criteresTransversaux` pour PHILO, `remarquesImportantes`
  pour COMMENTAIRE_COMPOSE).

### Nettoyage (suite)

Le champ `noteImportante` de `bareme_commentaire_compose.json` (« Ce type d'exercice n'existe pas
encore dans l'enum… à ajouter avant de charger en base »), rendu obsolète par v1.30, a été retiré du
JSON source ; reseed effectué — vérifié en base : la clé `noteImportante` n'est plus dans
`baremeStructure` (`? 'noteImportante'` → false), le reste du barème est intact (2704 octets, 4
sections).

## 25. Audit complet + resynchronisation Graphify (2 septembre 2026)

À la demande de l'utilisateur, audit de tout le travail des dernières sessions **contre le code et la
base réels** (pas contre ce fichier ni les souvenirs de conversation), motivé par la découverte que
les barèmes `ExempleCorrection` étaient documentés « chargés » sans l'avoir jamais été (corrigé au
§24).

### Vérifié — conforme

- **SVT C/D/TI** : `matieres.filiereRequise` de SVT = `{A,C,D,TI}` en base ; les 9
  `ProgrammeOfficiel` SVT (dont les 6 nouveaux 1ère/Tle × C/D/TI) ont chacun 4 modules / 14–15
  thèmes / ~3 Ko de `contenuStructure` — aucun vide. CDC : page 1 = « v1.30 », journal contient
  `v1.28 → v1.29` **et** `v1.29 → v1.30`, table §2.1 des 3 séries C/D/TI porte « …, SVT », phrase
  « 15 couples matière/classe/série ».
- **Barèmes** : 5 lignes `exemples_correction`, `baremeStructure` = objet jsonb non tronqué (tailles
  = fichiers source), `typeExercice` cohérent. Enum `TypeExerciceCorrection` en base = 5 valeurs
  dont `COMMENTAIRE_COMPOSE` ; migration `20260902113429…` appliquée.
- **R2** : `STORAGE_MODE=r2` dans les conteneurs `app` **et** `worker` ; `getStorageProvider()` →
  `R2StorageProvider` ; 4 appelants passent par cette fabrique, aucun `new MockStorageProvider()`
  hors du switch. **Test live** : upload réel vers le bucket, URL signée `GET 200` + contenu exact,
  `supprimer()` puis `GET 404`.
- **Zone.Identifier** : `.gitignore` ligne `*:Zone.Identifier` ; `git check-ignore` confirme
  l'application effective.
- **`Bareme_philosophie.txt`** : suivi par git sous le bon nom, aucun fichier `philososphie` (typo)
  suivi.

### Incomplet / à noter (signalé à l'audit)

- **YouTube API** : la clé `YOUTUBE_API_KEY` est valide (appel live `GET youtube/v3/search` →
  HTTP 200, vidéos réelles) mais **aucun code de `src/` ne la lit** — seul `.env.example` la
  mentionne. Le pipeline vidéo §2.5 n'existe pas encore.
- **`ExempleCorrection`** : `enonceModele` / `exempleReponseModele` / `notesMethodologiques` sont
  encore vides sur **4 des 5** lignes — seuls les barèmes sont chargés pour celles-là. Le premier
  exemple few-shot complet (DISSERTATION_LITTERAIRE) a été intégré, voir §26.
- **`Français` Terminale — FAUX POSITIF de l'audit, corrigé.** L'audit avait signalé « 4
  `ProgrammeOfficiel` vides » : c'était une **erreur de métrique**. La requête comptait
  `jsonb_array_length(contenuStructure->'modules')`, or la clé `francais` de Terminale n'a **pas**
  de tableau `modules` à plat — son contenu (4390 octets, 5 modules au total) est **imbriqué** sous
  `series_scientifiques_techno.modules` (3 modules : étude de la langue, techniques de rédaction —
  dont « Sujet 2 — Le commentaire composé » —, littérature) et `serie_litteraire_A.modules`
  (2 modules : Langue française, Littérature/dissertation). Le fichier source **et** la ligne en
  base contiennent bien ce contenu ; le seed l'a chargé correctement (`contenuStructure` = le JSON
  verbatim). **Vraie observation** : incohérence de forme dans les données curriculum — 3ème et
  Première Français utilisent `{ modules: [...] }` à plat comme toutes les autres matières, mais
  Terminale Français utilise une structure imbriquée par série. Tout consommateur de
  `ProgrammeOfficiel.contenuStructure` pour Français Terminale doit gérer cette forme imbriquée.

### `contexteMatiere` du chat-tuteur face à la structure imbriquée — vérifié en direct

Question de suivi : le code qui alimente le chat-tuteur mode 1 (§6.2) suppose-t-il la forme
`{ modules: [...] }` à plat ?

**Réponse : non, aucun risque aujourd'hui — le contexte n'est jamais parsé.**

- `src/lib/ai/types.ts` : `export type ContexteMatiere = unknown` — délibérément opaque, aucun
  contrat de forme.
- `src/app/api/eleve/chat/conversations/[id]/messages/route.ts:110` :
  `aiProvider.chat(messages, programme?.contenuStructure ?? null)` — le JSON de `contenuStructure`
  est transmis **verbatim**, sans lecture de sous-clé.
- `src/lib/ai/mock-provider.ts` : `chat(messages, _contexteMatiere, …)` — le paramètre est préfixé
  `_` et **totalement ignoré** par le mock.

**Test HTTP réel** — élève Terminale C, inscription → connexion NextAuth → `GET /api/eleve/matieres`
(Français listé) → `POST /api/eleve/chat/conversations` (matiereId = Français) → `POST …/messages`
(question sur le commentaire composé). Route renvoie **201**, `messageAssistant` produit. Log
temporaire posé sur la ligne 110 pendant le test :

```
[TEMP-CTX-AUDIT] matiereId=… classe=TERMINALE filiere=C ctx=object bytes=4298
  topKeys=["description","series_concernees","serie_litteraire_A","series_scientifiques_techno"]
  hasFlatModules=false head={"description":"Programme officiel complet (Office du Baccalauréat…
```

→ Le contexte passé à `chat()` est bien l'**objet imbriqué complet de 4298 octets** (pas `null`,
pas vide, pas tronqué). Log retiré après le test ; `tsc --noEmit` = 0 erreur ; élève de test
supprimé.

**Piège latent pour le futur `ClaudeAIProvider` (§6.5), à retenir :** quand le provider réel
sérialisera `contexteMatiere` dans le prompt système, il ne devra **pas** présumer
`contenuStructure.modules[]`. Pour Français (toutes séries de Terminale) les modules sont sous
`.series_scientifiques_techno.modules` (3) et `.serie_litteraire_A.modules` (2). Un accès naïf à
`.modules` donnerait un prompt système vide/dégradé pour le Français Terminale sans lever d'erreur.
Deux corrections possibles le moment venu : (a) normaliser la forme des fichiers
`docs/programmes/Terminale */programme_*.json` (aplatir `francais`), ou (b) traiter la forme
imbriquée dans le sérialiseur de contexte. À trancher lors de l'implémentation §6.5.

### Graphe Graphify — resynchronisé

L'audit a confirmé que le graphe était **désynchronisé** : `detect_incremental` = 11 fichiers en
attente, 0 nœud pour `COMMENTAIRE_COMPOSE` / `TypeExerciceCorrection` / `seedExemplesCorrection` /
`v1.30`. Le premier `graphify --update` a buté sur le garde-fou anti-rétrécissement (`build_merge`
remplace **tous** les nœuds d'un fichier ré-extrait ; une ré-extraction incrémentale plus maigre
aurait supprimé ~48 nœuds encore valides). `graph.json` restauré, puis relancé avec 2 sous-agents
d'extraction sémantique (CDC v1.30 + `CLAUDE.md` + `PROGRESS.md` + `Bareme_philosophie.txt`) à qui
on a fourni l'inventaire de nœuds existant comme plancher. Résultat : **1125 nœuds / 1832 arêtes /
112 communautés** (était 1075 / 1702 / 100), santé propre, `detect_incremental` = **0**. Les nœuds
`v1.30`, `COMMENTAIRE_COMPOSE`, `TypeExerciceCorrection enum (5 valeurs)`, `seedExemplesCorrection()`,
`PROGRESS 22/23/24` sont présents et reliés.

> Note : un des sous-agents a créé un nœud « Francais Terminale ProgrammeOfficiel vides (4) » à
> partir du faux positif de l'audit (voir ci-dessus). Ce nœud est **incorrect** ; il sera retiré au
> prochain `graphify --update` (`graphify-out/` est local et gitignoré).

## 26. Premier exemple few-shot chargé — DISSERTATION_LITTERAIRE (2 septembre 2026)

`docs/baremes/exemples/exemple_dissertation_litteraire.json` (préparé dans une session parallèle à
partir de photos de copie corrigée réelle — Lycée du Manengouba, épreuve de Littérature, nov. 2025)
complète la première des 5 lignes `ExempleCorrection`.

### Correspondance vérifiée

Le fichier porte `typeExercice = "DISSERTATION_LITTERAIRE"` + `matiere = "Français"` — mêmes clés que
le barème `docs/baremes/JSON/bareme_dissertation_litteraire.json` déjà chargé. Il cible donc la
ligne `ExempleCorrection (matiereId = Français, typeExercice = DISSERTATION_LITTERAIRE)`.

### `prisma/seed.ts` — `seedExemplesFewShot()`

Nouvelle 3ᵉ passe du seed, appelée après `seedExemplesCorrection()`. Scanne
`docs/baremes/exemples/exemple_*.json` (dossier absent ou partiel toléré) ; pour chaque fichier,
résout matière + `typeExercice`, retrouve la ligne `ExempleCorrection` existante (erreur si le
barème correspondant n'a pas été chargé d'abord), et fait un `update` **des 3 seuls champs**
`enonceModele` / `exempleReponseModele` / `notesMethodologiques` — `baremeStructure` n'est jamais
dans le `data`. Champs text : chaîne telle quelle, sinon `JSON.stringify(v, null, 2)` (lisible,
re-parsable). Idempotent (update pur).

### Vérifié réellement en base (`psql`)

- Ligne `DISSERTATION_LITTERAIRE` : `len(enonceModele)` = **482**, `len(exempleReponseModele)` =
  **2971**, `len(notesMethodologiques)` = **750** (étaient 0). Les 4 autres lignes restent à 0 sur
  ces champs.
- **`baremeStructure` intact** : toujours `jsonb` de type `object`, **1104 octets** (inchangé),
  `->>'typeExercice'` = `DISSERTATION_LITTERAIRE`.
- **Lisible / non tronqué** : `enonceModele` affiche la citation de Claude Roy, la consigne, le TAF,
  la durée ; `exempleReponseModele` commence `{ "introduction": "La littérature entretient…` et se
  termine proprement `…par le biais de l'imaginaire." }` ; `notesMethodologiques` liste le type de
  plan, la problématique, les 6 étapes de méthode et la remarque sur le périmètre du corrigé.
- **Chaque champ re-parse en JSON valide** : `enonceModele::jsonb ? 'citation'` = t,
  `exempleReponseModele::jsonb ? 'introduction'` = t, `notesMethodologiques::jsonb ? 'typeDePlan'`
  = t.
- Le corrigé source portait une annotation `[À VÉRIFIER : … écriture peu lisible sur le manuscrit]`
  pour un passage illisible sur la photo. **Résolu ensuite par l'utilisateur** : le passage est la
  ville fictive « Ebonzel » de *Les Chauves-Souris* de Bernard Nanga. `exemple_dissertation_litteraire.json`
  mis à jour, seed rejoué ; vérifié en base — plus aucune occurrence de « VÉRIFIER » dans
  `exempleReponseModele` (`LIKE '%VÉRIFIER%'` → false), le nouveau texte est présent, `baremeStructure`
  toujours inchangé (1104 octets), champ toujours re-parsable en JSON.

`tsc --noEmit` = 0 erreur ; `lint` = 0 erreur. Le sidecar Windows
`exemple_dissertation_litteraire.json:Zone.Identifier` a été supprimé (déjà couvert par la règle
`.gitignore`). Reste 4 types à fournir (DISSERTATION_PHILO, CONTRACTION_TEXTE, DISCUSSION,
COMMENTAIRE_COMPOSE) — le seed les complètera automatiquement dès que les fichiers seront déposés.

## 27. Banque d'épreuves élève — item "Épreuves" débloqué (3 septembre 2026)

La banque contient maintenant du contenu réel (9 épreuves : 3ᵉ SVT, Tle A/C/D/TI Français, Tle
D/TI Physique). L'item « Épreuves » est activé aux deux points d'entrée demandés.

### 1. Nav élève — `/eleve/epreuves`

- **`src/components/eleve/EleveShell.tsx`** : `disabled: true` retiré de l'item « Épreuves »
  (badge « Bientôt » supprimé) — il devient un vrai lien. « Mes lacunes » et « Quiz » restent
  grisés.
- **`src/app/eleve/epreuves/page.tsx`** (nouveau, server component) : filtre
  `prisma.epreuve.findMany({ where: { classe, filiere } })` — l'élève ne voit **que** sa propre
  classe/série (§2.1, §4.3), filtrage côté serveur, jamais seulement UI. Pour chaque épreuve,
  `getStorageProvider().obtenirUrlSignee()` génère une **URL signée R2 expirante** (SigV4,
  `X-Amz-Expires=900`) pour la fiche **et** le corrigé de référence — régénérées à chaque rendu,
  aucune URL publique stockée (§3, §4.2). Même patron que la page admin des épreuves.
- **`src/components/eleve/BanqueEpreuves.tsx`** (nouveau, client) : fidèle à
  `06_banque_epreuves.png` — titre, recherche par titre, pilules de filtre par matière
  (affichées seulement si ≥ 2 matières), grille de cartes (matière · titre · classe/année ·
  « Télécharger l'épreuve » + « Voir le corrigé de référence »). **État vide honnête** : « Aucune
  épreuve pour l'instant » quand la classe n'a pas de contenu ; « Aucun résultat » quand la
  recherche/le filtre ne rend rien.
- **`src/components/icons.tsx`** : ajout `IconSearch` (`MagnifyingGlass`) et `IconDownload`
  (`DownloadSimple`).

### 2. Nav landing — lien réel vers un accès à la banque

**`src/components/landing/LandingHeader.tsx`** : `{ label: "Épreuves" }` (span « Bientôt », ancre
morte) → `{ label: "Épreuves", href: "/connexion?from=/eleve/epreuves" }`. `/connexion` affiche le
sélecteur élève/parent (`RoleSwitcher`, non verrouillé — vrai chooser), et après connexion élève
`EleveLoginForm` redirige vers `from` puisqu'il commence par `/eleve`. Même logique de chooser que
« Tarifs ».

### 3. Bannière inscription pour visiteur sans compte (retour utilisateur)

Après clic sur « Épreuves », un visiteur sans compte était renvoyé vers `/connexion` sans piste
pour s'inscrire (contrairement au parcours « Tarifs »). **`src/components/connexion/ConnexionForm.tsx`** :
la bannière « besoin d'un compte » (auparavant réservée à `from` commençant par `/abonnement`) est
généralisée à `from` commençant par `/eleve`. Sur l'onglet Élève elle affiche « Connecte-toi pour
accéder à la banque d'épreuves. Pas encore de compte ? [Inscris-toi] » (lien `/inscription`) ;
message générique « … à ton espace élève » pour les autres `/eleve/*`. L'onglet Parent conserve son
message (code élève + SMS). Non-régression `/abonnement` et `/connexion` sans `from` vérifiée.

### Testé réellement

| Cas | Résultat |
|---|---|
| Élève **Terminale D** (a du contenu) | 3 cartes (Evaluation2 - Français, Evaluation2_JEAN_TABI - Physique, epreuve-prepa-physique-2019), pilules « Toutes / Français / Physique », **6 URLs signées R2** distinctes. Vérifié aussi dans le navigateur (arbre a11y). |
| **Filtrage** | Ce Terminale D ne voit **pas** le Français Terminale C, ni la SVT 3ᵉ, ni le Physique TI. |
| Élève **Première C** (aucun contenu) | HTTP **200**, page rendue, **état vide honnête** « Aucune épreuve pour l'instant » mentionnant « 1ʳᵉ · Série C », **pas d'erreur 500**, pas de carte. |
| Élève **Troisième** | 1 carte SVT, mention « 3ᵉ », pas d'état vide. |
| **URL signée R2** (fiche + corrigé d'une épreuve réelle) | `GET` → **HTTP 200**, `content-type: application/pdf` — le PDF se télécharge vraiment. |
| **Visiteur anonyme → `/eleve/epreuves`** | Redirigé par le middleware vers `/connexion?from=/eleve/epreuves`. |
| **Lien landing « Épreuves »** | `href="/connexion?from=/eleve/epreuves"` (plus une ancre `#`) ; `/connexion?from=/eleve/epreuves` affiche le `RoleSwitcher` (onglets Élève/Parent, Parent **non** verrouillé) ; session élève authentifiée → `/eleve/epreuves` → **200**. |
| **Bannière inscription** | `/connexion?from=/eleve/epreuves` affiche « Connecte-toi pour accéder à la banque d'épreuves. » + lien « Inscris-toi » → `/inscription` (confirmé dans le navigateur, arbre a11y). Non-régression : `/connexion?from=/abonnement/paiement` garde « continuer ton abonnement » + lien ; `/connexion` sans `from` n'affiche aucune bannière. |

`tsc --noEmit` = 0 erreur ; `lint` = 0 erreur (4 warnings préexistants). Élèves de test supprimés.

> Limite connue (identique à la page admin) : les URL signées expirent au bout de 15 min. Si l'élève
> laisse la page ouverte longtemps puis clique, le lien est mort et il faut recharger. Un endpoint
> de redirection régénérant l'URL à la demande sera à ajouter si ça devient gênant.

## 28. CDC v1.30 → v1.31 — EXPRESSION_ECRITE + CORRECTION_ORTHOGRAPHIQUE (types 3ème Français) (4 septembre 2026)

Deux barèmes de correction fournis par l'utilisateur pour la **3ème** (Français uniquement), à ajouter
à l'enum, au CDC et en base — même procédure qu'au §24 pour les 5 précédents.

### Schéma + migration

- **`prisma/schema.prisma`** : `EXPRESSION_ECRITE` et `CORRECTION_ORTHOGRAPHIQUE` ajoutés à l'enum
  `TypeExerciceCorrection` (qui passe de 5 à 7 valeurs).
- Migration **`20260904074258_add_expression_ecrite_correction_orthographique_type_exercice`**
  (`ALTER TYPE … ADD VALUE` × 2), créée et appliquée via `prisma migrate dev` dans le conteneur ;
  client régénéré. Vérifié en base : `pg_enum` de `TypeExerciceCorrection` = **7 valeurs**, les 2
  nouvelles en fin d'ordre.

### Fichiers barème (`docs/baremes/JSON/`)

- `bareme_expression_ecrite.json` (grille pondérée par critères /10 : Pertinence 3 · Cohérence 3 ·
  Correction de la langue 3 · Présentation 1 ; `equivalenceSur20` : barème doublé si l'épreuve est
  notée sur 20) et `bareme_correction_orthographique.json` (mécanisme de **comptage de fautes** :
  ~20 fautes, 1 pt/faute, `conditionAttributionParMot` = rayer + réécrire au-dessus, `casParticuliers`
  dont pénalité pour un mot correct rayé à tort — **pas de critères pondérés**).
- Sources brutes `.txt` versionnées aussi (`Bareme_Expression_ecrite.txt`,
  `Bareme_Correction_orthographique.txt`), comme pour les 5 autres (§22).
- **2 retouches mineures aux JSON** (validées avec l'utilisateur, patron §24) : clause obsolète
  « à ajouter à l'enum … avant chargement en base » retirée de `noteImportante` ; `classesConcernees`
  passé de `["3EME"]` à `["TROISIEME"]` (valeur de l'enum `NiveauClasse`).

### Seed

- **`prisma/seed.ts`** : `TYPES_EXERCICE_VALIDES` passe de 5 à 7 entrées ; commentaire d'en-tête
  mis à jour. `seedExemplesCorrection()` (inchangé pour le reste) charge automatiquement les 2 nouveaux
  fichiers, `matiereId` résolu sur « Français ».
- Reseed exécuté : `[seed] 7 ExempleCorrection (barèmes §4.2.2) upsertés.`

### Vérifié réellement en base (`psql`, cf. mémoire « verify against running system »)

| Contrôle | Résultat |
|---|---|
| `pg_enum` `TypeExerciceCorrection` | 7 valeurs, dont `EXPRESSION_ECRITE`, `CORRECTION_ORTHOGRAPHIQUE` |
| `exemples_correction` | **7 lignes**, `count(DISTINCT typeExercice) = 7` |
| Les 2 nouvelles lignes | `matiere` = Français, `langue` = FR, `jsonb_typeof(baremeStructure)` = `object` |
| `length(baremeStructure::text)` | 2123 (EXPRESSION_ECRITE) / 1238 (CORRECTION_ORTHOGRAPHIQUE) octets |
| `enonceModele` / `exempleReponseModele` / `notesMethodologiques` | `""` (0) sur les 2 — pas encore d'exemple few-shot, comme 3 des 5 autres |
| Re-parse JSON | `baremeStructure->>'typeExercice'` == colonne ; `->>'totalPoints'` = 10 / 20 ; `->'classesConcernees'` = `["TROISIEME"]` ; `#>'{baremeStructure}'` = `object` |
| Non-troncature | `jsonb_pretty()` des 2 barèmes affiché entier (4 critères + sous-critères pour EXPRESSION_ECRITE ; `description` + `conditionAttributionParMot` + 3 `casParticuliers` pour CORRECTION_ORTHOGRAPHIQUE) |
| Les 5 lignes existantes | intactes (tailles 3261 / 1104 / 1185 / 1145 / 2704 octets inchangées) |

### CDC — `docs/specs/Klarity_Cahier_des_Charges.pdf`, v1.30 → v1.31 (redaction PyMuPDF, Option A)

Choix acté avec l'utilisateur après avoir signalé que la page 8 du journal est pleine au pixel près :
**Option A** = sous-ensemble sûr, sans repagination de la table visuelle §4.2.2.

- **En-tête page 1** : « v1.30 — 2 septembre 2026 » → « v1.31 — 4 septembre 2026 ».
- **Insertion d'une page dédiée** (nouvelle **page 9**) portant l'entrée de journal « v1.30 → v1.31 »
  (même style que les autres entrées : titre bold + puce, polices `Liberation Sans` extraites du
  document). Toute la logique de notation des 2 types y est décrite en toutes lettres, y compris que
  `CORRECTION_ORTHOGRAPHIQUE` suit un **comptage de fautes fondamentalement distinct** des barèmes
  pondérés par critères, et que les 2 types ne concernent **ni la 1ère ni la Terminale**.
- **§4.2.2** (entité `ExempleCorrection`, désormais page 28) : liste d'enum `typeExercice` étendue à
  `… COMMENTAIRE_COMPOSE/ EXPRESSION_ECRITE/ CORRECTION_ORTHOGRAPHIQUE)` (tient dans la hauteur de
  ligne existante, `createdAt` reste au-dessus de la bordure) ; « (les 5 barèmes » → « (les 7 barèmes ».
- **Renumérotation** des pieds de page 10→43 (chiffre seul redigé) et **TOC** : `new_page` décale
  automatiquement les cibles ≥ page 9 de +1, + nouveau signet « v1.30 → v1.31 » → page 9. Titre des
  métadonnées → v1.31.
- **La table visuelle des types d'exercice §4.2.2 n'est PAS étendue** — même choix qu'en v1.30 pour
  `COMMENTAIRE_COMPOSE` (repagination des pages 27→42 impossible en redaction PyMuPDF). Le normatif est
  l'enum + l'entrée de journal. Cette dette de documentation est explicitée dans l'entrée v1.30 → v1.31
  et dans `CLAUDE.md`.

**Vérification du PDF** (43 pages) — script `_cdc_verify_v131.py` : pieds de page séquentiels 1→43 ;
page 1 corps identique à l'octet sauf la chaîne de version ; **pages 2-8 identiques à l'octet** ;
**pages 10-43 identiques (corps, texte + pixels) aux anciennes 9-42** — la seule différence de rendu
est confinée à la bande de 18 px du pied de page (numéro redigé + ligne « KLARITY … » re-rastérisée) ;
TOC correct ; delta de tokens page 28 = exactement `+7 +COMMENTAIRE_COMPOSE/ +EXPRESSION_ECRITE/
+CORRECTION_ORTHOGRAPHIQUE) −COMMENTAIRE_COMPOSE),`. Rendus visuels des pages 1/8/9/10/28 contrôlés.

> Piège PyMuPDF rencontré : `apply_redactions()` supprime sporadiquement la ligne de pied de page
> centrale partagée (« KLARITY — Cahier des charges technique… ») sur certaines pages lors de la
> renumérotation. Contourné par un garde `ensure_center_footer()` qui la ré-insère verbatim si elle a
> disparu, appliqué à chaque page redigée.

### `CLAUDE.md`

Le paragraphe `docs/baremes/*.txt` réécrit : **7** types d'exercice, les 5 méthodologiques 1ère/Tle
(barème identique par série) + les 2 propres à la 3ème Français (jamais 1ère/Tle) ; `CORRECTION_ORTHOGRAPHIQUE`
signalé comme comptage de fautes, mécanisme délibérément différent des barèmes pondérés ; note que la
table visuelle §4.2.2 reste à 4 lignes.

`tsc --noEmit` = 0 erreur ; `eslint prisma/seed.ts` = 0 erreur.

### Reste à faire (hors scope de cette tâche)

- Exemples few-shot (`docs/baremes/exemples/exemple_*.json`) pour les 2 nouveaux types — le seed
  `seedExemplesFewShot()` les complétera automatiquement dès dépôt des fichiers.
- CDC : si le tableau visuel §4.2.2 doit un jour montrer les 7 types (et combler la dette
  `COMMENTAIRE_COMPOSE`), il faudra reconstruire le CDC depuis une source Markdown/HTML → WeasyPrint
  (Option B écartée cette fois) — la redaction PyMuPDF ne sait pas refaire le flux.

## 29. Gestion centralisée de l'expiration de session — les 3 rôles (4-5 septembre 2026)

Signalement utilisateur : message générique « Non autorisé. » rencontré en ajoutant une épreuve
(`/admin/epreuves`) — chaque route API dupliquait son propre contrôle de session, sans détection
centralisée ni redirection propre. Demande en 4 points, appliquée aux 3 rôles.

### 1. Détection centralisée (serveur) — `src/lib/auth/api-guard.ts::exigerRole()`

Un seul endroit remplace le `if (!session || session.error || session.user.role !== "X") return
401 "Non autorisé."` recopié dans **11 routes API** (`admin/epreuves`, `admin/dates-examens`,
`admin/corrections/[id]/override`, `admin/storage`, `parent/notifications`, `parent/dernier-enfant`,
`parent/eleve/[id]/cloture`, `eleve/matieres`, `eleve/chat/conversations`,
`eleve/chat/conversations/[id]/messages` ×2, `paiement/initier`, `paiement/[id]`). `exigerRole(role)`
distingue désormais deux cas que l'ancien code confondait :
- **Session absente/expirée/invalidée** (`!session` ou `session.error`) → 401 **structurée**
  `{ error, code: "SESSION_EXPIREE", connexion: "/connexion" | "/admin/connexion" }`.
- **Rôle simplement incorrect** (cas anormal, le middleware l'aurait déjà bloqué côté page) → 403
  opaque, inchangé.

### 2 + 3. Redirection automatique + retour à la page d'origine (client)

- **`src/lib/api-client.ts::apiFetch()`** — remplace `fetch()` sur les **13 appels `/api/*`** des
  composants client authentifiés (`EpreuveManager`, `DateExamenManager`,
  `CorrectionSignaleeDetail`, `NotificationForm`, `ClotureCompteForm`, `EnfantSelector`, `ChatPanel`
  ×3, `PaiementForm`, `VerificationPoll`). Sur une 401 `SESSION_EXPIREE`, déclenche
  `redirigerVersConnexion()` : navigation dure vers `connexion` avec `?from=<page courante
  complète>&raison=expiree` — la réponse 401 (avec le message clair du serveur) est quand même
  renvoyée à l'appelant, donc le message correct s'affiche brièvement avant la navigation, jamais
  le générique.
- **`src/middleware.ts`** — gate déjà `?from=` pour les redirections de page (inchangé) ; ajoute
  `?raison=expiree` quand `session.error` (compte invalidé, rotation échouée).
- **`cibleRetour(from, role)`** (`api-client.ts`) — allowlist par rôle (`ELEVE`→`/eleve`+`/abonnement`,
  `PARENT`→`/parent`+`/abonnement`, `ADMIN`→`/admin`), anti open-redirect, utilisée par les 3
  formulaires de connexion (`EleveLoginForm`, `ParentLoginForm`, `AdminLoginForm`) pour revenir
  automatiquement sur `from` après reconnexion — même mécanisme que celui déjà en place pour le
  paiement, généralisé et partagé plutôt que dupliqué par rôle.
- **`ConnexionForm` / `AdminConnexionForm`** — bandeau « Ta session a expiré. Reconnecte-toi pour
  reprendre là où tu en étais. » quand `?raison=expiree` ; supprime dans ce cas la bannière « besoin
  d'un compte » existante (from `/eleve`/`/abonnement`) — redondante et trompeuse pour quelqu'un qui a
  clairement déjà un compte.

### 4. Avertir avant l'expiration effective — `src/components/auth/`

- **`AuthenticatedArea.tsx`** — enveloppe `SessionProvider` (next-auth/react) montée par les 4
  layouts authentifiés (`eleve`, `parent`, `admin/(protected)`, `abonnement`), `session` passée
  depuis le layout serveur (pas de fetch initial supplémentaire). `refetchInterval={300}` (5 min) +
  `refetchOnWindowFocus` : revalide périodiquement tant que l'onglet est ouvert — ce qui, en
  pratique, **maintient la session vivante** pendant qu'un formulaire long est rempli (rotation du
  cookie à chaque refetch réussi), et fait tomber un compte invalidé en moins de 5 min sans action
  de l'utilisateur.
- **`SessionExpiryWatcher.tsx`** — monté à l'intérieur : redirige **proactivement** (avant toute
  soumission) dès qu'un refetch constate `session.error` (compte anonymisé/supprimé, rotation
  échouée) OU que la session a purement disparu après avoir été valide dans le même onglet (cookie
  supprimé/expiré, déconnecté ailleurs) — cf. bug trouvé en testant, ci-dessous. Bandeau discret
  « Ta session expire bientôt » + bouton « Rester connecté » (force un `update()`) quand
  l'échéance réelle du cookie (`session.expires`, roulante) tombe sous 5 min — rare en usage normal,
  couvre l'onglet laissé ouvert très longtemps.

### Bug trouvé en testant, corrigé avant de considérer le point 4 fait

Premier jet du watcher : ne redirigeait que sur `session.error`. Testé en simulant une
déconnexion pendant que l'utilisateur reste inactif sur un écran (aucune soumission) — la session
devient `null`/`unauthenticated` (pas une erreur), et le premier jet ne faisait **rien** dans ce cas,
laissant l'utilisateur sur un écran qui a l'air normal jusqu'à sa prochaine interaction. Corrigé :
le veilleur retient (`dejaAuthentifie`) que la session a été valide au moins une fois dans cet
onglet, et redirige dès qu'elle disparaît ensuite — pas seulement sur une erreur explicite, jamais
au tout premier rendu (un visiteur jamais connecté n'a rien à voir avec une session « expirée »).

### Testé réellement

- **Preuve directe du bug rapporté** — `curl -X POST /api/admin/epreuves` sans session (le cas
  exact signalé) : **401** `{"error":"Ta session a expiré. Reconnecte-toi pour continuer.",
  "code":"SESSION_EXPIREE","connexion":"/admin/connexion"}` au lieu de l'ancien `{"error":"Non
  autorisé."}`. Même vérifié sur `eleve/matieres`, `parent/notifications`, `paiement/initier`.
- **Parcours complet en navigateur** (compte élève de test auto-provisionné via `/inscription` —
  jamais de compte admin créé par Claude Code, règle actée §11/§20 ; le mécanisme testé est
  strictement le même code partagé `exigerRole`/`apiFetch` que la route admin) : connexion réelle →
  `/eleve/tuteur-ia` → question tapée dans le champ du chat (« Peux-tu m'expliquer les dérivées ? »)
  → session tuée côté serveur pendant que le champ reste rempli et l'utilisateur ignorant de rien
  (`POST /api/auth/signout` réel, confirmé par `GET /api/auth/session` → `null`) → clic « Envoyer »
  → **redirection fluide** vers `/connexion?from=%2Feleve%2Ftuteur-ia&raison=expiree`, bandeau « Ta
  session a expiré » affiché (capture d'écran), aucune bannière « besoin d'un compte » redondante →
  reconnexion avec le même compte → **retour automatique sur `/eleve/tuteur-ia`** (pas le dashboard
  générique). Aucun blocage brutal, aucun message générique à aucune étape.
- **Non confirmé en direct** : le sous-cas du point 4 où la redirection proactive se déclenche
  *sans aucune interaction* (purement via le refetch périodique de 5 min, onglet inactif) — la
  logique est corrigée et vérifiée par lecture de code + `tsc`, mais une attente live de 5 min (ou
  la resimulation via un `refetchInterval` temporairement raccourci) a buté sur une instabilité du
  CSRF token dans le harnais de test par `fetch()` brut (pas un bug produit identifié) ; signalé
  plutôt que présenté comme testé.
- Compte élève de test (`ELE-74R-WQV`) et toutes ses lignes dépendantes supprimés après coup —
  vérifié 0 ligne orpheline (`conversations_chat`, `audit_log_securite`).
- `tsc --noEmit` : 0 erreur. `eslint src/` : 0 erreur, 3 warnings préexistants (au lieu de 4 —
  la directive `eslint-disable` obsolète de `ChatPanel.tsx`, déjà relevée en dette au passage,
  retirée puisque le fichier était de toute façon touché).

## 30. Durée réelle du refresh token — bug de session de facto infinie trouvé et corrigé (5 septembre 2026)

Suivi direct de §29 : l'utilisateur a demandé une durée de refresh token longue mais **réelle**
(30 j, renouvelée silencieusement à chaque connexion active) plutôt qu'une session sans expiration
— risquée sur un appareil partagé (§1.2, public mineur). En creusant, le vrai problème n'était pas
la valeur de la durée (déjà correcte) mais un **effet de bord du mécanisme construit en §29**.

### Valeurs actuelles confirmées avant toute modification

`ACCESS_TOKEN_TTL_SECONDS=900` (15 min) et `REFRESH_TOKEN_TTL_SECONDS=2592000` (exactement 30 j),
déjà réglées ainsi dans `.env`/`.env.example` et déjà les valeurs par défaut de `src/auth.ts` —
**aucun changement numérique nécessaire**, la durée demandée était déjà en place.

### Cause réelle trouvée par lecture de code + test direct — pas la durée, le veilleur de §29

`refetchInterval={300}` sur le `SessionProvider` de `AuthenticatedArea` (§29, point 4 —
« maintenir la session vivante ») interroge `GET /api/auth/session` toutes les 5 min tant qu'un
onglet reste ouvert. Or, sous stratégie JWT, `@auth/core` **re-signe le cookie de session avec une
échéance `now + 30 j` à chaque appel de cette route précise**, sans le throttle `updateAge` (24 h)
qui ne s'applique qu'à la stratégie "database" (vérifié dans le code source installé,
`node_modules/@auth/core/lib/actions/session.js`, **et** confirmé par un test curl direct : un
`auth()` isolé — page serveur, route API — ne bouge pas l'échéance du cookie, seul un vrai
`GET /api/auth/session` le fait, précisément de la durée écoulée depuis le dernier appel). Un onglet
Klarity oublié ouvert sur un appareil partagé, même totalement inactif, aurait donc vu sa fenêtre de
30 jours repoussée indéfiniment toutes les 5 min — exactement la session sans expiration que
l'utilisateur voulait éviter. Corrigé : **`refetchInterval` retiré**, ne reste que
`refetchOnWindowFocus` (déjà présent) — le renouvellement silencieux reste garanti par de vraies
preuves d'activité (montage de `SessionProvider` à chaque navigation réelle vers un espace
authentifié, retour de focus sur l'onglet), jamais par un minuteur aveugle indépendant de toute
action réelle. `src/auth.ts` et `AuthenticatedArea.tsx` documentent ce mécanisme en détail pour
qu'il ne soit pas réintroduit par erreur.

### Testé réellement

- **Rolling renewal sur activité réelle** (curl, cookie jar, TTL réel 30 j) : `auth()` seul
  (`GET /api/eleve/matieres`) ne bouge jamais l'échéance du cookie ; `GET /api/auth/session` la
  déplace à chaque appel, précisément de `+N s` où `N` = secondes écoulées depuis le dernier appel
  (`4b` → `5b`, exactement `+5 s` après une pause de 5 s) — le mécanisme "reste connecté tant
  qu'utilisé" fonctionne bel et bien, sans dépendre d'un minuteur.
- **Plus de veille en arrière-plan** (navigateur réel, `read_network_requests`) : connexion élève de
  test → `/eleve` → **20 s d'inactivité totale, aucune interaction** → **une seule** requête
  `/api/auth/session` sur toute la fenêtre (le montage initial de `SessionProvider`), zéro requête
  supplémentaire — confirme la disparition du polling aveugle de §29.
- **Expiration réelle après inactivité complète** (`REFRESH_TOKEN_TTL_SECONDS` abaissé temporairement
  à 12 s pour accélérer le test, conteneur `app` recréé, testé, puis remis à 2 592 000 et recréé de
  nouveau — confirmé restauré) : connexion élève → session valide (`200`) → **15 s d'attente sans
  aucune requête** → `GET /api/eleve/matieres` → **401** `{"code":"SESSION_EXPIREE",
  "connexion":"/connexion"}` (§29) ; `GET /eleve` → **307** vers `/connexion?from=%2Feleve` — une
  session réellement inactive au-delà de sa fenêtre expire pour de vrai, et retombe proprement sur
  le mécanisme de §29 plutôt qu'un blocage brutal.
- `tsc --noEmit` : 0 erreur. `eslint src/` : 0 erreur, 3 warnings préexistants inchangés.
- Comptes élève de test (`ELE-DNF-UXS`, et le reliquat `ELE-74R-WQV` de §29) supprimés après coup,
  vérifié 0 ligne restante.

### Élève — même logique, confirmée

`REFRESH_TOKEN_TTL_SECONDS` est un réglage unique partagé par les 3 providers Credentials
(`session.maxAge` global dans `src/auth.ts`) — la correction ci-dessus s'applique donc identiquement
à l'élève : pas de re-saisie du PIN à chaque session sur un même appareil tant qu'il reste utilisé
au moins une fois dans la fenêtre de 30 j, testé explicitement ci-dessus avec un compte élève.

## 31. Les 7 exemples few-shot ExempleCorrection chargés et vérifiés en base (5 septembre 2026)

Les 7 fichiers `docs/baremes/exemples/exemple_*.json` sont maintenant tous présents (préparés à
partir de copies corrigées réelles), y compris `DISSERTATION_PHILO` qui manquait — c'est la
dernière pièce du dispositif RAG/few-shot §4.2.2. `seedExemplesFewShot()` (3ᵉ passe du seed, §26 —
`update` des 3 seuls champs `enonceModele` / `exempleReponseModele` / `notesMethodologiques`,
`baremeStructure` jamais touché) a été relancé : `7 ExempleCorrection complété(s) avec un exemple
few-shot` (était 1 au §26). Aucune erreur — les 7 `typeExercice` valides, 7 matières résolues
(`Philosophie` ×1, `Français` ×6), 7 lignes `ExempleCorrection` retrouvées (créées par
`seedExemplesCorrection()`, §24/§28). Fichiers `*:Zone.Identifier` supprimés (règle `.gitignore`).

### Récapitulatif complet — vérifié directement en base (`psql`), rien pris pour « complet » sans ça

| `typeExercice` | Matière | `enonceModele` | `exempleReponseModele` | `notesMethodologiques` | `baremeStructure` |
|---|---|---|---|---|---|
| `DISSERTATION_PHILO` | Philosophie | 2792 o (JSON — `sujetType`, `partieA` texte Njoh-Mouelle, `partieB` sujet Montaigne) | **25 594 o** (JSON — `partieA.comprehensionDuTexte` … `partieB`, se termine sur une citation de Nietzsche) | 1249 o (`structureBaremeeOriginale` A + B) | `object`, **3261 o — inchangé** |
| `DISSERTATION_LITTERAIRE` | Français | 482 o (JSON — citation Claude Roy + consigne + TAF) | 2999 o (JSON — `introduction` complète, finit « …par le biais de l'imaginaire. ») | 750 o (`typeDePlan` analytique, `problematique`, 6 étapes) | `object`, **1104 o — inchangé** |
| `CONTRACTION_TEXTE` | Français | 3942 o (JSON — `sujetType`, `texteOriginal` complet à contracter) | 1076 o (JSON — `resume` de 146 mots + `nombreDeMots` + `discussion: null` **volontaire**, voir plus bas) | 1748 o (`themeEtThese`, `structureDuTexteSource`) | `object`, **1185 o — inchangé** |
| `DISCUSSION` | Français | 591 o (JSON — citation Varela i Serra + consigne) | 2902 o (JSON — `introduction` … finit « …pour l'éducation des générations futures. ») | 1268 o (`themeEtThese` + problématique, `typeDePlan`) | `object`, **1145 o — inchangé** |
| `COMMENTAIRE_COMPOSE` | Français | 1428 o (JSON — `texteAEtudier` : dialogue du procès Dualla Manga) | 3728 o (JSON — `introduction` … finit sur « …le théâtre africain contemporain. ») | 777 o (`ideeGenerale`, 2 `axesDeLecture`) | `object`, **2704 o — inchangé** |
| `EXPRESSION_ECRITE` | Français | 1937 o (JSON — `sujetType`, `miseEnSituation` crise économique) | 4066 o (JSON — `consigne1_recit` (Talla) … argumentation, finit « …la tentation de l'argent facile. ») | 3690 o (`structureAttendue` narratif→argumentatif, `remarque`) | `object`, **2123 o — inchangé** |
| `CORRECTION_ORTHOGRAPHIQUE` | Français | 1001 o (JSON — `sujetType`, `texteAvecFautes` : la louve/l'agneau) | 1675 o (JSON — `tableauCorrections[]` : `fauteReperee` → `localisation` → `correction`, tableau bien fermé) | 1249 o (`methode` en étapes numérotées) | `object`, **1238 o — inchangé** |

**Contrôles passés** (`scripts/_audit_exemples.sql`, jetable) :
- Aucun des 21 champs few-shot n'est vide ; requête ciblant les champs vides ou anormalement courts
  (énoncé < 80 o, réponse < 300 o, notes < 80 o) → **0 ligne**.
- Les 3 champs de chaque ligne commencent par `{` et la réponse se termine par `}` → tous stockés en
  JSON *pretty* bien formé, aucune troncature en milieu de structure ; les extraits début+fin le
  confirment sur les 7.
- `baremeStructure` : `jsonb_typeof` = `object` pour les 7, `->>'typeExercice'` == la colonne, et les
  **7 tailles octet pour octet identiques à l'audit §28** (3261 / 1104 / 1185 / 1145 / 2704 / 2123 /
  1238) → le champ n'a pas bougé, comme prévu (`seedExemplesFewShot()` ne l'écrit jamais).

**Seul point signalé, après examen : non problématique.** `CONTRACTION_TEXTE.exempleReponseModele`
contient `"discussion": null`. Le `sujetType` du fichier est « Contraction de texte et discussion »
(sujet de type 1, série A, qui combine les deux), mais la ligne est classée `CONTRACTION_TEXTE` :
l'exemple modélise **volontairement** la seule contraction (résumé de 146 mots, complet), la partie
discussion étant couverte par l'exemple `DISCUSSION` séparé. C'est cohérent avec le CDC §4.2.2 (« le
pipeline résout les deux `ExempleCorrection` correspondants — `CONTRACTION_TEXTE` puis `DISCUSSION` —
et évalue chaque partie séparément »). `null` explicite ≠ champ tronqué.

`tsc --noEmit` : hors périmètre (aucun changement de code — seed déjà en place depuis §26/§28, seuls
6 fichiers JSON de données ajoutés). Reseed idempotent revérifié (même sortie au 2ᵉ passage).

## 32. Connexion depuis "Épreuves" (landing) — option Parent retirée, Élève centrée (5 septembre 2026)

Retour utilisateur : au clic sur "Épreuves" dans la nav de la landing, on arrive sur
`/connexion?from=/eleve/epreuves` où le sélecteur Élève/Parent s'affichait encore (§27). La banque
d'épreuves étant réservée à l'élève — un parent ne peut jamais atteindre `/eleve/*` —, l'option
Parent ne doit pas seulement être grisée : elle doit **disparaître**, et l'unique option "Élève"
être centrée.

- **`ConnexionForm.tsx`** : nouveau `eleveUniquement = from?.startsWith("/eleve")`. Quand vrai : le
  rôle est forcé à `ELEVE`, `RoleSwitcher` **n'est pas rendu** du tout (remplacé par une simple
  pastille "Élève" centrée, style de l'onglet actif), et seul `EleveLoginForm` s'affiche.
  Portée volontairement `/eleve/*` (pas seulement le lien "Épreuves") : couvre aussi une redirection
  du middleware / d'une expiration de session (§29/§30) depuis n'importe quelle page de l'espace
  élève, où un onglet Parent n'aurait pas plus de sens.
- **Inchangé** : `/connexion` nu (sélecteur complet Élève/Parent cliquable), et le verrou
  `?role=PARENT` du lien "Parents" / `?role=ELEVE`/`PARENT` du chooser d'abonnement (§16 — l'onglet
  non choisi reste grisé-visible, comportement demandé explicitement à l'époque). Le `href` du lien
  "Épreuves" (`/connexion?from=/eleve/epreuves`) n'a pas changé ; seule la logique d'affichage l'a
  fait.
- **Vérifié** (HTML rendu + captures navigateur) : `?from=/eleve/epreuves` → aucun `RoleSwitcher`
  (`aria-label="Type de compte"` absent), pastille "Élève" centrée, pas de "Parent" dans le DOM,
  bannière "banque d'épreuves" + lien Inscription présents ; `/connexion` nu → sélecteur complet ;
  `?from=/parent&role=PARENT` → sélecteur avec Parent actif et Élève grisé non cliquable (§16
  intact). `tsc --noEmit` et `eslint` sur les fichiers touchés : 0 erreur.

## 33. Audit des 3 dashboards + déblocage des 6 écrans admin « catégorie 5 » (5 septembre 2026)

### Audit demandé — de quoi dépend réellement chaque item grisé

Passage en revue de tous les items de navigation / sections marqués « Bientôt » ou grisés dans les
3 dashboards (élève, parent, admin), avec pour chacun la dépendance réelle : (1) banque d'épreuves
réelle, (2) clé API Anthropic, (3) CamerPay live, (4) fournisseur SMS réel, ou (5) **aucune des
quatre — juste jamais construit** alors que rien ne l'empêche techniquement.

Constat : **aucun item grisé n'est bloqué de façon unique par les accès externes 1/3/4.** Les
32 `epreuves` sont déjà en base (écran banque d'épreuves actif depuis §27) ; le SMS ne concerne
que l'OTP parent (mock) et l'envoi de notifications (job worker). Tout item grisé tombe donc soit
en **catégorie 2** (a besoin d'une vraie correction IA pour avoir des données — Élève « Mes
lacunes » / « Quiz », Parent « Progression » / « Notes » / « Lacunes », bouton export PDF), soit
en **catégorie 5** (données déjà en base, écran jamais construit).

Items catégorie 5 identifiés : côté **parent**, « Temps passé » (dépend d'un écrivain
`SessionActivite` à construire, non externe) ; côté **admin**, les 6 écrans ci-dessous.

### 6 écrans admin construits

Tous en Server Components sous `src/app/admin/(protected)/` (route group déjà gaté par le
middleware + `layout.tsx` + un `if (session.user.role !== "ADMIN") redirect("/admin/connexion")`
en tête de chaque page — triple défense) :

- **`/admin/utilisateurs`** — synthèse des 3 rôles : tuiles cliquables (élèves / parents / admins),
  état des comptes élève (`statutCompte`), liaison parent↔enfant, table « derniers inscrits » tous
  rôles. Téléphone parent masqué (`+237 •••• 73`).
- **`/admin/eleves`** — table paginée (15/page, `?page=`), colonnes identité + `codeEleve`,
  classe/filière, statut rétention, dernière activité relative, nb parents liés, nb corrections,
  plan d'abonnement. **`select` Prisma restreint** — jamais `pinHash` / `pinVerrouilleJusqua`.
- **`/admin/parents`** — table paginée, téléphone masqué, enfants liés en puces `codeEleve`
  (via `ParentEleveLink`), dernière connexion.
- **`/admin/exemples-corriges`** — bibliothèque des 7 `ExempleCorrection` + panneau détail (`?id=`)
  affichant `baremeStructure` (JSON formaté), `enonceModele`, `exempleReponseModele`,
  `notesMethodologiques` ; **formulaire d'ajout** (`ExempleCorrectionForm`, client) →
  `POST /api/admin/exemples-corriges` (nouveau, `exigerRole("ADMIN")`, zod + validation « objet
  JSON bien formé » pour le barème). Matières limitées à Français / Philosophie.
- **`/admin/securite`** — journal `AuditLogSecurite` complet, paginé (20/page) + **chips de filtre
  par `typeEvenement`** (`?type=`, comptes affichés), tuiles 24h, section webhooks rejetés
  (`WebhookLog` `signatureValide = false`). `utilisateurId` affiché tel quel (déjà un id opaque),
  jamais de secret.
- **`/admin/usage-ia`** — totaux (appels / tokens / coût FCFA), répartition par modèle et par type
  d'usage, coût par élève 30 j (repris de la vue d'ensemble), journal des appels paginé.

Composant partagé **`src/components/admin/Pagination.tsx`** (Server Component, `<Link>` +
helper `lirePage`).

### Nav + vue d'ensemble

- `AdminShell.tsx` : `disabled: true` retiré sur les 6 items. **Restent grisés « Bientôt » :
  Paiements, Revenus, Paramètres** (les deux premiers attendent CamerPay live pour des chiffres
  réels ; Paramètres attend une décision produit sur le périmètre configurable).
- `admin/(protected)/page.tsx` : bouton « + Ajouter une copie » (était `disabled`) → `Link` vers
  `/admin/exemples-corriges` ; liste des exemples rendue cliquable ; ajout de liens « Voir le
  détail → » / « Voir le journal → » vers Usage IA et Sécurité.

### Vérifié bout en bout

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur** (3 warnings préexistants,
  fichiers non touchés).
- Requêtes Prisma exactes des 6 pages rejouées en conteneur contre la base réelle : 3 élèves,
  1 parent, 2 admins, 7 exemples (barème = objet, textes non tronqués), 37 logs sécurité
  (2 pages ; répartition `PIN_FAIL:21 OTP_FAIL:7 LOGIN_FAIL:6 IDOR_BLOCKED:2 WEBHOOK_INVALID:1`),
  2 usages IA (CHAT/HAIKU, 44 tokens). Assertion explicite qu'aucun `select` ne contient `pinHash`.
- Routes non authentifiées → **307 vers `/admin/connexion?from=…`** ; `POST` API sans session →
  **401**.
- **Click-test navigateur avec la session ADMIN réelle de l'utilisateur** (il s'est connecté
  lui-même — règle §11) : les 6 écrans affichent les vraies données ; sidebar sans badge sur les
  6 items ; pagination Sécurité (page 1→2, `?page=2`) OK ; filtre Sécurité `?type=IDOR_BLOCKED` →
  « 2 événements (filtré) » OK ; panneau détail Exemples OK ; **round-trip formulaire d'ajout** :
  création d'une ligne de test (`ajouteParAdminId` = compte de l'utilisateur), compteur passé à
  « 8 exemples », puis **ligne de test supprimée en base** — retour à 7 vérifié.

