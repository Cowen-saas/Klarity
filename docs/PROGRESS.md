# Klarity — État d'avancement

_Dernière mise à jour : 6 septembre 2026 — sections vivantes (§1, §3, §5) resynchronisées avec le travail des 4–6 septembre (§28 à §37) ; graphe Graphify rejoué pour §33–§37_

## 🔴 Bloquant avant mise en production

- ~~Documents légaux non finalisés~~ **RÉSOLU le 13 septembre 2026, §46.** Les 3 documents
  (`docs/legal/Klarity_CGU.docx`, `Klarity_Mentions_Legales.docx`,
  `Klarity_Politique_Confidentialite.docx`) sont passés en **version 1.2**, finalisés et validés —
  confirmé explicitement par l'utilisateur, deux artefacts de brouillon résiduels nettoyés avec son
  accord (§46). Publiés sous forme de pages web dédiées (`/mentions-legales`, `/cgu`,
  `/confidentialite`), le footer pointe vers ces pages (liens réactivés, plus de mention « Bientôt
  disponible », §44/§45 obsolètes sur ce point). Les `.docx` sources restent dans `docs/legal/`
  comme référence/archive uniquement — jamais copiés dans `public/`, donc jamais servis en
  téléchargement direct (cohérent avec la décision de sécurité du §45).

- ~~`next build` échoue — erreur `<Html>` au prérendu de `/404`~~ **RÉSOLU (compris) le 13 septembre
  2026, §45.** Ce n'était pas un bug Next.js : `next build`, lancé en local via `docker compose
  exec`/`run` dans le conteneur `app`, héritait de `NODE_ENV=development` (déclaré dans `.env` pour
  `npm run dev`) — un `NODE_ENV` non-production pendant `next build` fait dérailler l'export statique
  de `/404`/`/_error` vers la logique Pages Router héritée, d'où l'import `<Html>` invalide. Confirmé
  par reproduction contrôlée : le même `next build`, dans le même conteneur, avec les mêmes
  dépendances, réussit intégralement dès que `NODE_ENV=production` est forcé. **Le déploiement Vercel
  réel (`klarity-sand.vercel.app`) n'a jamais été affecté** — Vercel force `NODE_ENV=production`
  pendant son propre build, indépendamment du `.env` du dépôt ; vérifié en récupérant la vraie page
  `/404` en production (contenu réel de `not-found.tsx`, pas une page d'erreur générique). Détail
  complet, y compris pourquoi les pistes explorées le 1er septembre ne pouvaient pas trouver la
  cause : §45. **Pour vérifier `next build` en local à l'avenir**, forcer explicitement
  `NODE_ENV=production npx next build` (ou toute invocation qui ne charge pas le `.env` de dev).

## 1. Où en est le projet, dans l'ensemble

Le cadrage produit et technique est consolidé (cahier des charges **v1.31**,
`docs/specs/Klarity_Cahier_des_Charges.pdf`), le schéma de données est finalisé et migré
(4 migrations), et le socle d'infrastructure (Phase 0, §10 du CDC) est en place. Phase 1 est
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
de `src/` ne lit encore `YOUTUBE_API_KEY` (relevé à l'audit §25). CamerPay (jamais eu d'accès réel)
a été **remplacé par NotchPay** (§39, §40, premier paiement sandbox réel vérifié §41) :
`NotchPayProvider` est réellement codé et testé (`PAYMENT_MODE=notchpay`). Orange SMS Cameroun
(jamais implémenté — sa propre FAQ documentait un problème de livraison vers MTN) a de même été
**remplacé par Africa's Talking** (§42) : `AfricasTalkingProvider` est codé (`SMS_MODE=africastalking`),
la réponse API sandbox est vérifiée réelle (§42), mais `SMS_MODE` reste `mock` par défaut tant que
l'utilisateur n'a pas confirmé vouloir basculer en production. Seule la clé API Anthropic Claude reste
un accès externe en attente — interface + mock déjà en place, bascule en réel par un simple changement
de config (`AI_MODE`), sans réécriture du code appelant.

**Travail des 2–3 septembre 2026 (§21 à §27) :** Phase R2 fermée (§21) ; CDC porté en v1.29 puis
v1.30 — SVT ajoutée à la banque/correction pour les séries C, D, TI (§22), nouveau type d'exercice
`COMMENTAIRE_COMPOSE` (§23) ; les 5 barèmes `ExempleCorrection` enfin chargés en base depuis
`docs/baremes/JSON/`, avec le premier exemple few-shot complet (DISSERTATION_LITTERAIRE) (§24, §26) ;
audit complet contre le code et la base réels + resynchronisation du graphe Graphify (§25) ; item
« Épreuves » débloqué dans la nav élève et sur la landing, avec écran banque d'épreuves filtré par
classe/série et URL signées R2 pour fiche + corrigé (§27).

**Travail des 4–6 septembre 2026 (§28 à §37) :**
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
- **8 écrans admin débloqués** (§33 puis §34) : audit des 3 dashboards (items grisés « Bientôt »)
  puis construction des écrans back-office qui ne dépendaient d'aucun accès externe (banque
  d'épreuves / clé Anthropic / paiement / SMS) — juste jamais construits. §33 : **Utilisateurs,
  Élèves, Parents, Exemples corrigés, Sécurité, Usage IA**. §34 : **Paiements** (journal filtrable +
  webhooks liés par clé d'idempotence) et **Revenus** (MRR, CA, churn), avec un bandeau permanent
  « Données de test » tant que `paiementsSontReels()` est faux (§40) — c'est-à-dire tant que
  NotchPay ne tourne pas avec une clé publique `pk_live_…`. Tous branchés sur les vraies données déjà en
  base, badges « Bientôt » retirés dans `AdminShell`. **Seul reste grisé : Paramètres** (attend une
  décision produit sur le périmètre configurable).
- **« Temps passé » débloqué côté parent** (§35) — le seul item de catégorie 5 qui demandait un
  nouveau composant, pas qu'un écran de lecture. Nouveau `ActivityTracker` client (accumulation
  calée sur une *vraie* interaction, jamais un minuteur aveugle — cf. mémoire §29/§30),
  `POST /api/eleve/activite` (borne par envoi + plafond quotidien 8 h, tous deux re-vérifiés
  serveur), écran `/parent/temps-passe` (agrégation par jour / semaine, IDOR `ParentEleveLink`).
  Côté parent, restent grisés : Progression, Notes, Lacunes (catégorie 2 — dépendent d'une vraie
  correction IA).
- **Format unique du numéro de téléphone** (§36) : composant `PhoneInput` imposant
  `+237 6XX XX XX XX` (préfixe `+237 6` fixe, espaces automatiques) sur les 2 points de saisie
  (connexion parent, paiement Mobile Money), + normalisation serveur en forme canonique
  `+2376XXXXXXXX` (`request-otp`, provider `parent`).
- **`/admin/parametres` — dernier item admin débloqué** (§37) : fenêtres tarifaires
  promotionnelles (§2.4.1) sorties du code (`determinerPeriodeTarifaire`, dates/prix en dur) vers
  une table `PeriodeTarifaire` éditable en base. Nouvelle 4ᵉ migration. `obtenirTarifPremium()`
  devient async et lit la base (repli 5000 FCFA si aucune fenêtre active). Écran admin CRUD +
  activer/désactiver. **Plus aucun item grisé dans `AdminShell`.** Deux vraies fenêtres
  configurées (Noël 2026-2027, Pâques 2027, 3000 FCFA).
- Graphe Graphify resynchronisé pour §29–§32 puis §33–§37 (à la demande de l'utilisateur) —
  dernier passage le 6 septembre : **1448 nœuds / 2294 arêtes / 142 communautés**, santé propre,
  extraction AST-only sur les 35 fichiers code modifiés (`/admin/parametres` & toute la vague
  §33–§37 indexés, nœuds `determinerPeriodeTarifaire`/ancien type purgés) ; `docs/PROGRESS.md`
  laissé en file pour un prochain rebuild complet (`graphify-out/` local, gitignoré).

`next build` ne fonctionne pas (erreur `<Html>` préexistante, cf. bandeau « 🔴 Bloquant » en tête) —
le développement se fait entièrement via `next dev` sous Docker Compose. `npm run lint` a été
réparé le 1er septembre (§ « Outillage »).

Le dépôt est maintenant sur GitHub (`git@github.com:Cowen-saas/Klarity.git`, branche `main`),
avec authentification SSH configurée.

## 2. Étape 0 (Phase 0 — Socle), telle que définie dans le CDC §10

Le CDC découpe l'implémentation en 8 phases (0 à 7), séquencées pour ne jamais être bloquées
par les deux accès externes encore en attente (NotchPay en conditions réelles — le code est prêt,
§40 —, clé API Anthropic Claude) — ces deux dépendances sont développées en mode mock dès la
Phase 1 et basculées en mode réel sans
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
- **Prisma** : `schema.prisma` (27 modèles, 22 enums — `PeriodeTarifaire` ajouté §37 au-delà des
  26 du §4 du CDC) et migré — 4 migrations : `20260819070754_init`,
  `20260902113429_add_commentaire_compose_type_exercice` (§23),
  `20260904074258_add_expression_ecrite_correction_orthographique_type_exercice` (§28),
  `20260906102111_add_periode_tarifaire` (§37).
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
6 septembre pour intégrer §33–§37 — 1448 nœuds / 2294 arêtes / 142 communautés, santé propre
(0 arête orpheline / endpoint manquant / self-loop / collapsed).** Extraction **AST uniquement**
sur les 35 fichiers `.ts`/`.tsx` modifiés : les 8 écrans admin débloqués (§33–§34), `/parent/temps-passe`
+ `ActivityTracker` (§35), `PhoneInput` + helpers `src/lib/format.ts` (§36), **`/admin/parametres`
(`src_app_admin_protected_parametres_page`), `PeriodeTarifaireManager`, les 2 routes
`periodes-tarifaires`, `periodeTarifaireActive()` + `obtenirTarifPremium()` async (§37)** sont
maintenant dans le graphe ; les nœuds obsolètes `determinerPeriodeTarifaire()`, l'ancien type
`PeriodeTarifaire` union et `MOIS_NOEL`/`MOIS_PAQUES`/`PRIX_PROMO_PREMIUM` ont été purgés.
`docs/PROGRESS.md` a changé mais n'a **pas** été ré-extrait sémantiquement ce tour (le sous-agent
dépassait la limite de sortie) — ses 199 nœuds concept `docs_progress_*` sont conservés au snapshot
pré-§33 ; il reste en file pour un prochain `graphify .` complet qui rafraîchira la couche
narrative des §33–§37. Couvre toujours §28–§32 (expiration de session, refresh token, 7
`ExempleCorrection`, écran « Épreuves » élève-seul, `TypeExerciceCorrection` à 7 valeurs).

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
   désynchronisé et chaque version suivante aggrave l'écart. **Idem pour le modèle de données
   §4 :** `PeriodeTarifaire` (ajouté §37, 4ᵉ migration) et `SessionActivite.*` n'y sont pas encore
   reportés — normatifs via `schema.prisma` + le journal.
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
6. ~~`CamerPaySandboxProvider`/`CamerPayLiveProvider` (§5.3) dès obtention de l'accès CamerPay~~ —
   **fait autrement** : CamerPay n'a jamais eu d'accès réel, remplacé par NotchPay (§39). Le vrai
   `NotchPayProvider` est écrit (§39, renommage complet du code en §40) ; l'endpoint
   `/api/paiement/webhook` et l'interface `PaymentProvider` l'ont reçu sans retravail, comme prévu.
   Reste à brancher les vraies clés sandbox de l'utilisateur pour le premier paiement réel.

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

## 34. Déblocage des 2 écrans financiers admin — Paiements + Revenus (6 septembre 2026)

Deuxième vague de l'audit §33 : les 2 écrans « catégorie 5 avec caveat » — ils lisent des données
déjà en base (issues du parcours de paiement mock, §16), mais les montants ne seront des chiffres
réels que sous `PAYMENT_MODE=live`.

### `/admin/paiements`

- Table paginée (20/page) du journal `Paiement`, jointure `abonnement.eleve.codeEleve`.
- **Filtres** (chips `<Link>`, tout côté serveur) : statut (`?statut=`), méthode (`?methode=` —
  une seule valeur `MOBILE_MONEY` aujourd'hui, la carte ayant été retirée §5), période
  (`?periode=7j|30j|tout`). Les filtres se combinent et sont préservés par la pagination.
- **Panneau détail** (`?paiement=<id>`) : champs du paiement + **webhooks CamerPay liés**, retrouvés
  par `WebhookLog.payloadBrut->>'sessionId' == Paiement.idempotencyKey` (pas de FK directe entre les
  deux tables — le `sessionId` du payload est la clé d'idempotence).
- Téléphone payeur masqué (`+237 •••• 73`) ; `referenceCamerPay` / `idempotencyKey` affichés
  (nécessaires à la réconciliation, non sensibles).

### `/admin/revenus`

- Tuiles : **MRR** = somme des `Abonnement.prixApplique` des abonnements `ACTIF` (prix figé au
  paiement, jamais recalculé — §2.4.1) ; **CA encaissé** = somme `montant` des `Paiement` `REUSSI` ;
  CA glissant 30 j ; **taux de churn** = `EXPIRE / (ACTIF + EXPIRE)`.
- `BarChart` (composant partagé, déjà utilisé sur la vue d'ensemble) pour le CA mensuel sur 8 mois ;
  répartition Premium / Gratuit ; compteur de renouvellements sous 30 j.
- Section « Méthode de calcul » explicite en bas de page.

### Bandeau « Données de test »

Nouveau composant `src/components/admin/BandeauModeTest.tsx`, affiché en tête des 2 écrans tant que
`process.env.PAYMENT_MODE !== "live"` : *« Données de test — Montants non réels. CamerPay tourne en
`PAYMENT_MODE=mock` : ces transactions sont générées par le simulateur de webhook… »*. Objectif
explicite : qu'un futur lecteur (Claude ou un collaborateur) ne confonde jamais ces chiffres avec
du vrai chiffre d'affaires.

### Sécurité

Même patron que la vague 1 : gate ADMIN en triple défense (middleware + `layout.tsx` +
`if (session.user.role !== "ADMIN") redirect(...)` en tête de page). Pas de restriction par élève
ici — **l'admin a un accès global légitime aux données financières** (CDC : « Admin manages …
platform financials ») ; l'helper `chargerPaiementAutorise` d'IDOR ne concerne que le self-service
élève/parent et refuse explicitement l'admin. Aucune donnée carte n'existe (Mobile Money
uniquement).

### `AdminShell.tsx`

`disabled: true` retiré sur `Paiements` et `Revenus`. **Seul `Paramètres` reste grisé « Bientôt »**
(périmètre configurable non encore défini). Vue d'ensemble : liens « Voir les revenus → » / « Voir
tous les paiements → » ajoutés sur les sections CA et journal des paiements.

### Vérifié

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur** (3 warnings préexistants).
- Requêtes Prisma rejouées en conteneur : 5 paiements (`REUSSI:3 ECHEC:2`, 15 000 FCFA encaissés),
  webhook `CREDITE` correctement lié au dernier paiement par `sessionId` ; 3 abonnements `PREMIUM`
  `ACTIF` → MRR 15 000, churn 0 %, 3 renouvellements sous 30 j. Assertion qu'aucun `select` ne
  contient `payloadBrut` / hash / secret.
- Routes non authentifiées → **307 vers `/admin/connexion?from=…`** (query de filtres préservée).
- **Click-test navigateur, session ADMIN réelle de l'utilisateur** : bandeau « Données de test »
  visible sur les 2 écrans ; Paiements → 5 lignes, tuiles 5/3/2/15 000, filtre `?statut=ECHEC` →
  « 2 transactions (filtré) », panneau détail (`?paiement=…`) affichant le webhook `CREDITE` lié ;
  Revenus → MRR 15 000, CA 15 000, churn 0 %, `BarChart` Aoû/Sep, Premium 100 % ; sidebar sans
  badge sur Paiements/Revenus, seul Paramètres grisé.

## 35. « Temps passé » côté parent — mesure du temps réel + écran d'agrégation (6 septembre 2026)

Dernier item « catégorie 5 » de l'audit §33, et le seul qui demandait un **nouveau mécanisme**
(mesure du temps), pas juste un écran de lecture. Choix acté avec l'utilisateur : agrégation
**par jour + par semaine uniquement**, pas de volet « par matière » (la table `SessionActivite`
n'a pas de champ matière et le brief fondateur ne lie « par matière » qu'à la
progression/lacunes, pas au temps passé — pas de migration).

### `ActivityTracker` (`src/components/eleve/ActivityTracker.tsx`, monté dans le layout élève)

Mesure le temps réellement passé, **jamais un minuteur aveugle** (cf. mémoire projet §29/§30) :

- Le temps ne s'accumule que si le compteur a vu une *vraie* interaction (`pointerdown`, `keydown`,
  `scroll`, `wheel`, `touchstart`, ou retour de focus volontaire sur l'onglet) dans les 60 dernières
  secondes **et** que `document.visibilityState === "visible"`. Un onglet oublié ouvert cesse de
  compter au bout d'une minute ; un onglet en arrière-plan ne compte pas du tout.
- Accumulation **à pas fixe** (5 s par tick actif, jamais l'écart réel entre deux ticks) — un timer
  en retard (machine sortie de veille, onglet throttlé) ne peut donc pas gonfler le temps.
- Envoi par `navigator.sendBeacon` (résiste à la fermeture d'onglet) au passage en arrière-plan,
  à `pagehide`, au démontage, et un envoi de sécurité toutes les 60 s ; repli `fetch` `keepalive`.

### `POST /api/eleve/activite`

`exigerRole("ELEVE")`, écrit une `SessionActivite` (`canal=WEB`, `dateDebut` reconstruit =
`dateFin − dureeSecondes`) **pour l'élève connecté uniquement** (pas de paramètre d'id → pas
d'IDOR possible), et bump `Eleve.derniereActiviteLe`. Le payload venant du client est **non
fiable** → deux garde-fous serveur : borne de 15 min par envoi (`SEGMENT_MAX_SECONDES`) et
**plafond quotidien de 8 h** par élève (`PLAFOND_QUOTIDIEN_SECONDES`, le dernier segment de la
journée est tronqué pour ne jamais dépasser).

### `/parent/temps-passe`

Server Component, gate PARENT en triple défense. **IDOR** : `?eleve=` re-validé contre les
`ParentEleveLink` du parent à chaque requête (un id non lié retombe sur l'enfant lié, aucune
donnée d'un autre enfant n'est exposée). Tuiles (cette semaine + delta vs semaine précédente,
7 j, 30 j, moyenne/jour actif) + deux `BarChart` (par jour sur 14 j, par semaine sur 8 sem.) +
la note de confidentialité (« jamais l'activité minute par minute »). `ParentShell` : `disabled`
retiré sur « Temps passé » ; tuile « Temps cette semaine » de la vue d'ensemble rendue cliquable
vers cet écran.

### Vérifié bout en bout (navigateur réel)

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur** (3 warnings préexistants).
- Routes non authentifiées → `/parent/temps-passe` **307 vers `/connexion`** ; `POST /api/eleve/activite`
  sans session → **401**.
- **`ActivityTracker` exercé sur `/eleve`** avec un élève de test créé via l'inscription publique.
  Comme la fenêtre Chrome pilotée est `hidden`, `visibilityState` a été forcé `visible` depuis la
  console pour exercer le *vrai* chemin d'accumulation du composant monté (code non modifié) :
  - activité simulée continue ~227 s → **220 s enregistrés** (jamais > temps écoulé — pas d'inflation) ;
  - après arrêt de l'interaction (onglet resté visible), **plus aucune seconde accumulée** pendant
    110 s+ — le compteur s'arrête bien à l'inactivité ;
  - `dateFin − dateDebut` = `dureeSecondes` exactement sur chaque ligne.
- **Garde-fous serveur** (payloads forgés depuis la session élève) : `1500` → stocké **900**
  (borne segment) ; 34 envois de 900 s → total plafonné **exactement à 28 800 s** (dernier segment
  tronqué à 855), puis `{ ok:true, ignore:"plafond quotidien atteint" }` ; `-5` / `3.7` / `99999`
  → **400**.
- **`/parent/temps-passe`** avec un parent de test lié via le vrai flux OTP : agrégations
  conformes à la base (7 j = 4 h 07, 30 j = 6 h 56, 10 jours actifs, moyenne 42 min/jour actif),
  graphiques jour/semaine cohérents, `?eleve=<id non lié>` → retombe sur l'enfant lié.
- Toutes les données de test (élève, parent, `SessionActivite`, `ParentEleveLink`, OTP) supprimées
  après coup — base revenue à 3 élèves / 1 parent / 0 `sessions_activite` / 2 liens.

## 36. Format imposé du numéro de téléphone — `+237 6XX XX XX XX` (6 septembre 2026)

Demande utilisateur : partout où un numéro est saisi, imposer le format
`+237 6XX XX XX XX` — le préfixe `+237 6` **fixe et ineffaçable**, la saisie ne
commençant qu'au chiffre suivant le `6`, et les espaces posés automatiquement au
fil de la frappe (`XX XX XX XX`).

### `src/components/ui/PhoneInput.tsx` (nouveau)

Champ contrôlé unique. Le préfixe `+237 6` est un `<span>` **hors du champ** —
impossible à sélectionner ou effacer ; il est collé au premier chiffre pour
former le groupe `6XX`. L'utilisateur ne tape que les **8 chiffres** suivants,
regroupés `XX XX XX XX` (formatage à lookahead — jamais d'espace en fin).
Collage géré (extraction des chiffres, retrait d'un `237` / `6` de tête).
Valeur remontée : toujours la **forme canonique** `+2376XXXXXXXX` (sans
espaces). `inputMode="numeric"`, `autoComplete="tel-national"`. Pas de texte
« Format : … » sous le champ (retiré à la demande de l'utilisateur — le préfixe
fixe `+237 6` et le placeholder `XX XX XX XX` suffisent) ; les messages
d'erreur de saisie ne répètent plus le gabarit non plus.

### `src/lib/format.ts` — helpers partagés

`chiffresLocauxTelephone`, `formaterChiffresLocaux`, `versTelephoneCanonique`,
`estTelephoneCamerounaisComplet`, `normaliserTelephoneCamerounais` (saisie libre
→ `+2376XXXXXXXX` ou `null`). `masquerTelephone` inchangé.

### Points de saisie migrés

- **`ParentLoginForm.tsx`** (connexion parent) — le champ téléphone devient un
  `PhoneInput` ; validation client sur `estTelephoneCamerounaisComplet`.
- **`PaiementForm.tsx`** (Mobile Money, §2.6) — remplace le `+237` + input
  chiffres par un `PhoneInput` ; l'ancienne regex `^6\d{8}$` cède la place au
  helper partagé.

### Normalisation serveur (cohérence + défense en profondeur)

Un numéro tapé avec ou sans espaces ne doit jamais créer deux comptes / deux
entrées OTP. La forme canonique `+2376XXXXXXXX` est déjà celle produite par
`/api/paiement/initier` et celle des lignes `Parent.telephone` existantes.
Ajout de la normalisation manquante :

- **`/api/auth/parent/request-otp`** — `normaliserTelephoneCamerounais` avant
  rate-limit + `envoyerOtp` (400 si numéro non camerounais).
- **`src/auth.ts`, provider `parent`** — normalisation avant la recherche
  `OtpVerification` et l'upsert `Parent` : `request-otp` et `authorize`
  cherchent désormais exactement la même valeur.

### Vérifié bout en bout (navigateur réel)

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur** (3 warnings préexistants).
- Helpers : table de cas (`77123456`, `677123456`, `+237 6 77 12 34 56`,
  `237677123456`, incomplet, trop long, `abc`) → tous conformes.
- **`PhoneInput` sur `/connexion` (onglet Parent)** : préfixe `+237 6` affiché
  fixe ; frappe `98765432` → `+237 698 76 54 32` (espaces automatiques) ; 9ᵉ
  chiffre ignoré (plafond 8) ; `Backspace` retire un chiffre et regroupe ;
  `Ctrl+A` + `Suppr` efface les chiffres **mais pas le préfixe**. Après retrait
  du hint : plus aucun texte sous le champ, vérifié en navigateur.
- **Connexion parent complète** (numéro tapé au format + code élève + OTP mock)
  → session `PARENT`, `Parent.telephone` = `+237698765432` (13 car., sans
  espaces), `OtpVerification.telephone` idem, `ParentEleveLink` créé.
- **`PhoneInput` sur `/abonnement/paiement`** (parent payeur) : rendu correct
  dans la colonne du formulaire, hint « Mode simulation » conservé ; paiement
  Orange Money `+237 677 11 22 33` → `Paiement.payeurTelephone` = `+237677112233`,
  statut `REUSSI`.
- Données de test (élève, parent, abonnement, paiement, lien, OTP) supprimées —
  base revenue à 3 élèves / 1 parent / 5 paiements / 2 liens.

## 37. `/admin/parametres` — fenêtres tarifaires promo sorties du code (6 septembre 2026)

Dernier item grisé de l'audit des dashboards (§33). Objectif : les dates et prix des promotions
(§2.4.1), auparavant écrits en dur dans `src/lib/payment/tarification.ts`
(`MOIS_NOEL`/`MOIS_PAQUES`, `PRIX_PROMO_PREMIUM = 3000`), doivent être modifiables sans toucher au
code ni redéployer.

### Modèle + migration

Nouveau `PeriodeTarifaire` (`nom`, `dateDebut`, `dateFin`, `prixApplique` Decimal, `actif` bool,
`ajouteParAdminId`, `createdAt`/`updatedAt`, index `[actif, dateDebut, dateFin]`). **4ᵉ migration**
`20260906102111_add_periode_tarifaire`.

### `tarification.ts` réécrit

`determinerPeriodeTarifaire` (basé sur `Date#getMonth()`) → `periodeTarifaireActive(date)` +
`obtenirTarifPremium(date)` **désormais `async`, lisant la base**. Repli sain : aucune fenêtre
`actif = true` couvrant la date ⇒ `PRIX_NORMAL_PREMIUM` (5000). Chevauchement de fenêtres actives ⇒
la **moins chère** l'emporte. Les 3 consommateurs (`/abonnement`, `/abonnement/paiement`,
`/api/paiement/initier`) passés en `await`. Le prix reste figé dans `Abonnement.prixApplique` au
paiement (webhook), jamais recalculé.

### Écran + API

- `/admin/parametres` : tuile « Tarif appliqué aujourd'hui » + `PeriodeTarifaireManager`
  (formulaire ajout/édition nom + dates + prix ; liste avec badges Appliquée / Active / Désactivée ;
  actions Modifier, Activer/Désactiver, Supprimer avec **confirmation inline** — pas de
  `window.confirm` qui bloquerait l'extension navigateur).
- `POST /api/admin/parametres/periodes-tarifaires` + `PATCH`/`DELETE .../[id]`, tous
  `exigerRole("ADMIN")` (triple défense middleware + layout + contrôle en tête). Zod : `nom` 2–120,
  `prix > 0`, `dateFin > dateDebut`. Bornes calées en **UTC** : `dateDebut` à 00:00:00.000Z,
  `dateFin` à 23:59:59.999Z du jour choisi (journées entières incluses, affichage stable).
- `AdminShell` : `disabled` retiré de « Paramètres ». **Plus aucun item admin grisé.**

### Vérifié bout en bout

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur** (3 warnings préexistants).
- Logique rejouée en conteneur : vide → 5000 ; fenêtre active couvrant aujourd'hui (3000) → 3000
  (`enPromo` true) ; date hors fenêtre → 5000 ; fenêtre désactivée → 5000 ; deux fenêtres qui se
  chevauchent → la moins chère (2500).
- Routes non authentifiées → `/admin/parametres` **307 → `/admin/connexion`** ; `POST` API sans
  session → **401**.
- **Click-test navigateur, session ADMIN réelle de l'utilisateur** : création d'une fenêtre de test
  couvrant aujourd'hui (3500) → apparaît « Appliquée », tuile + `/abonnement` public passent à
  3500 (« -30 % », 5000 barré) ; modification du prix (→ 4200) → répercutée partout ; désactivation
  → tuile + `/abonnement` retombent à **5000** ; réactivation avec dates de décembre (hors fenêtre)
  → badge « Active » mais tuile/`/abonnement` restent à **5000** ; suppression (confirmation inline)
  → liste vide.
- Fenêtre de test supprimée ; **deux vraies fenêtres configurées** pour remplacer l'ancien
  comportement en dur : « Promo Noël 2026-2027 » (1 déc 2026 → 28 fév 2027, 3000 FCFA) et
  « Promo Pâques 2027 » (1 avr → 30 juin 2027, 3000 FCFA), toutes deux actives.

## 38. `/admin/epreuves` — Modifier / Supprimer une épreuve (9 septembre 2026)

Jusqu'ici l'écran ne savait qu'ajouter une épreuve à la banque ; impossible de corriger un titre, de
remplacer un fichier erroné ou de retirer une entrée sans passer par la base directement. Ajout des
deux actions manquantes, avec le même souci que partout ailleurs : jamais de fichier R2 orphelin,
jamais de suppression qui casserait l'historique d'un élève.

### API — `PATCH`/`DELETE /api/admin/epreuves/[id]`

- `exigerRole("ADMIN")` (même triple défense que le reste : middleware sur `/admin/*`, contrôle de
  session en tête de page server component, contrôle de rôle dans le handler) + IDOR : l'épreuve
  visée est toujours relue par `id` avant toute écriture, jamais supposée exister.
- **`PATCH`** : `multipart/form-data`, tous les champs de métadonnées optionnels (valeur existante
  conservée si absente) ; `fichePdf`/`corrigeReference` remplaçables **indépendamment l'un de
  l'autre** — remplacer l'un sans l'autre est le cas nominal, pas une exception. Ordre des
  opérations : upload du/des nouveau(x) fichier(s) → `prisma.epreuve.update` → suppression du/des
  ancien(s) objet(s) R2 **seulement après le commit DB réussi**. Ça garantit qu'on ne perd jamais
  l'ancien fichier si l'upload du remplaçant échoue, et qu'on ne laisse jamais la base pointer vers
  une clé déjà effacée du bucket.
- **`DELETE`** : bloque (409, message explicite) si au moins une `TentativeEpreuve`, un
  `CorrectionDetail` ou une `ConversationChat` référence encore l'épreuve — un élève a déjà composé,
  été corrigé, ou discuté dessus, et la supprimer casserait son historique (en plus d'être rejetée
  par la contrainte FK Postgres, `Epreuve.tentatives`/`.correctionsDetail`/`.conversationsChat`
  n'étant pas en `onDelete: Cascade`). **Recommandation retenue faute d'un champ d'archivage dans le
  schéma actuel** : bloquer avec un message clair plutôt qu'ajouter un statut « archivée » — la
  demande ne portait que sur Modifier/Supprimer, une vraie archive (colonne + filtre banque élève)
  reste un ajout séparé si le besoin se présente. Suppression autorisée ⇒ `prisma.epreuve.delete`
  d'abord, puis les 2 objets R2 (fiche + corrigé) via `StorageProvider.supprimer()`.

### `EpreuveManager.tsx` — même formulaire pour ajout et édition

Repris le pattern déjà en place dans `PeriodeTarifaireManager` (§37) plutôt qu'en inventer un
nouveau : bouton « Modifier » par ligne → formulaire du haut pré-rempli (classe, filière, matière,
titre, année) et rebasculé en mode édition (« Mettre à jour », bouton « Annuler ») ; champs fichier
non obligatoires en édition avec « Laisser vide pour conserver le fichier actuel (voir) » et lien
vers le fichier en place. Bouton « Supprimer » par ligne avec **confirmation inline** (« Confirmer ?
Oui / Non »), identique au pattern fenêtres tarifaires — pas de `window.confirm`.

En cours de route, repéré et corrigé un bug de re-render déjà présent dans `PeriodeTarifaireManager`
et reproduit sans le vouloir dans la première version de ce composant : `setMessage({ok, …})` suivi
immédiatement de `reinitialiser()` qui appelait `setMessage(null)` — React batchant les deux, le
message de succès ne s'affichait jamais. Corrigé ici en sortant `setMessage(null)` de
`reinitialiser()` et en l'appelant *avant* de poser le message de succès (`PeriodeTarifaireManager`
lui-même pas touché, hors périmètre de cette tâche).

### Vérifié bout en bout (navigateur, session ADMIN réelle, contre le vrai bucket R2)

- `npx tsc --noEmit` → **0 erreur** ; `npm run lint` → **0 erreur/warning** sur les 3 fichiers
  touchés.
- **Création** d'une épreuve de test (Terminale C, Physique) → `psql` confirme la ligne + script
  Node (`@aws-sdk/client-s3`, `HeadObjectCommand`) confirme les 2 objets **présents** dans le vrai
  bucket R2 (`STORAGE_MODE=r2` en dev, pas le mock disque).
- **Modification** : titre changé (vérifié en base) + fiche PDF remplacée sans toucher au corrigé →
  `corrigeReferenceKey` **inchangée**, `fichePdfKey` **changée**, ancien objet R2
  (`epreuves/781f246d-….pdf`) **absent** du bucket après coup, nouveau objet **présent**. Confirme
  le remplacement sélectif (un seul des deux fichiers) et la purge post-commit.
- **Suppression bloquée** : `TentativeEpreuve` de test insérée pour l'épreuve → clic Supprimer +
  confirmation → message « Impossible de supprimer : au moins un élève a déjà composé... » affiché,
  ligne toujours en base, 2 objets R2 toujours présents (vérifié directement, pas seulement à l'œil).
  Tentative de test retirée → même épreuve supprimable normalement.
- **Suppression** : ligne disparaît de la liste, `SELECT count(*)` → **0**, les 2 objets R2 → **absents**
  du bucket (`HeadObjectCommand` 404 sur les deux clés).
- Toutes les données de test (épreuves, tentative synthétique, script de vérification temporaire)
  nettoyées après coup — la banque réelle importée (~130 épreuves) n'a pas été touchée.

## 39. `NotchPayProvider` — CamerPay remplacé (jamais eu d'accès réel) par un vrai agrégateur (10 septembre 2026)

Demande initiale de l'utilisateur : juste renommer les 4 variables `CAMERPAY_*` de `.env.example` en
`NOTCHPAY_*`, « cohérentes avec le NotchPayProvider déjà implémenté ». Vérification faite avant
d'agir (`grep -ri notchpay` sur tout le repo, hors `node_modules`/`.git`) : **aucun `NotchPayProvider`
n'existait** — seul `MockPaymentProvider` était implémenté, `PAYMENT_MODE=sandbox|live` levait une
erreur explicite référençant CamerPay. Signalé à l'utilisateur plutôt que d'inventer des noms de
variables pour un code qui ne les lirait jamais ; il a choisi d'implémenter le vrai provider
maintenant plutôt que de se limiter à un renommage cosmétique.

### Recherche doc NotchPay (developer.notchpay.co, 10 septembre 2026 — pas de clés sandbox côté agent)

- Pas de distinction sandbox/live côté API : une seule URL (`https://api.notchpay.co`), c'est le
  préfixe de la clé publique (`pk_test_…`/`pk_live_…`) qui distingue les deux.
- Clé **publique** (`Authorization` header) suffit pour initier un paiement et déclencher le canal
  Mobile Money ; clé **secrète** (`X-Grant` header) réservée aux opérations sensibles
  (compte, transferts, gestion webhooks) — jamais lue par notre intégration, donc **pas** ajoutée à
  `.env.example` (l'utilisateur avait explicitement demandé les variables *réellement* utilisées).
- Flux d'initiation en 2 appels : `POST /payments` (montant, devise, téléphone → id de transaction +
  `authorization_url` de repli) puis `POST /payments/{transaction}` avec `channel`
  (`cm.orange`/`cm.mtn`) + téléphone, qui déclenche l'invite USSD côté payeur — jamais de confirmation
  synchrone.
- Webhook : header `x-notch-signature`, HMAC-SHA256 hex du JSON brut, secret = "Hash Key" (distinct
  des clés API, dispo dans Dashboard > Settings > API Keys). Statuts observés :
  `complete`/`failed`/`canceled`/`expired`/`processing`.

### Code

- **`src/lib/payment/notchpay-provider.ts`** (nouveau) : implémente `PaymentProvider` selon la doc
  ci-dessus. `processing`/statut inconnu → `EN_ATTENTE` (jamais un faux `ECHEC` par défaut).
- **`types.ts`** : `Payeur.operateur?: "ORANGE"|"MTN"` ajouté — l'interface n'avait jusqu'ici aucun
  moyen de faire remonter l'opérateur Mobile Money choisi jusqu'au provider, alors que NotchPay en a
  besoin pour choisir le canal. Champ optionnel (rétro-compatible, `MockPaymentProvider` l'ignore).
  `ResultatPaiement.referenceCamerPay` **conservé tel quel** (colonne DB du même nom, changer les deux
  demanderait une migration hors périmètre de cette tâche) — commenté pour que ça ne trompe pas un
  futur lecteur.
- **`index.ts`** : `PAYMENT_MODE = mock | notchpay` (fini `sandbox`/`live`, qui n'a plus de sens pour
  NotchPay). Nouvel export `paiementsSontReels()` : vrai seulement si `notchpay` **et** clé publique
  `pk_live_…` — remplace le test `modePaiement !== "live"` devenu un bug silencieux (cette valeur
  n'existe plus, le bandeau « données de test » se serait affiché indéfiniment) dans
  `/admin/paiements` et `/admin/revenus`.
- **`webhook-handler.ts`** : nouvelle branche `EN_ATTENTE` (événement intermédiaire type
  `processing`) — journalisée (`traitementStatut: "EVENEMENT_INTERMEDIAIRE"`) sans toucher
  `Paiement`/`Abonnement`, pour ne jamais fermer un paiement en cours sur un événement non terminal.
  `WebhookLog.provider` désormais posé explicitement (`MOCK`/`NOTCHPAY`) à chaque écriture au lieu de
  laisser jouer le défaut `"CAMERPAY"` du schéma, faux depuis toujours en pratique.
- **`initier/route.ts`** : `operateur` (déjà validé par le body schema) enfin transmis au provider —
  jusqu'ici capturé puis silencieusement perdu.
- **`webhook/route.ts`** : en-tête lu passé de `x-camerpay-signature` à `x-notch-signature`.
- Passages **CamerPay → NotchPay** dans les commentaires et libellés UI directement concernés
  (`BandeauModeTest`, écran Paiements : « Référence transaction »/« Webhooks liés » plutôt que
  « … CamerPay »). Noms de colonnes DB (`referenceCamerPay`, défaut `"CAMERPAY"` de
  `WebhookLog.provider`) **non renommés** — changement de schéma hors périmètre, signalé à
  l'utilisateur avec `CLAUDE.md`/le cahier des charges qui mentionnent encore CamerPay explicitement.

### Vérifié

- `tsc --noEmit` et `eslint` **dans le conteneur** (le `node_modules` hôte s'est révélé désynchronisé
  du schéma Prisma actuel — `periodeTarifaire` absent du client généré côté hôte, `@aws-sdk/*`
  introuvable — sans rapport avec ce changement ; le conteneur, source de vérité, est propre : 0
  erreur, 2 warnings préexistants inchangés).
- **Non-régression du chemin mock, bout en bout, contre le serveur réel** : inscription élève de test
  → connexion NextAuth (`callback/eleve`) → `POST /api/paiement/initier` (`201`, `operateur` transmis
  sans erreur) → job BullMQ mock → `paiements.statut` **REUSSI**, `abonnements` passé **PREMIUM/ACTIF**,
  nouvelle ligne `webhook_logs.provider = 'MOCK'` (confirmant le fix du défaut `CAMERPAY`). Toutes les
  données de test supprimées ensuite.
- **`NotchPayProvider` non exercé contre un vrai compte sandbox** — pas de clés côté agent. Implémenté
  strictement à partir de la doc publique NotchPay ; l'hypothèse la plus incertaine (id de transaction
  d'initiation == `data.id` du webhook, la doc ne le confirme pas noir sur blanc) est commentée dans le
  code et **doit être validée par l'utilisateur au premier vrai paiement sandbox**, clés en main.

## 40. Suite CamerPay → NotchPay — renommage complet du code, CDC v1.32, docs (10 septembre 2026)

Retour utilisateur après §39 : le renommage devait aller plus loin qu'un simple ajout de provider —
plus aucune trace de « CamerPay » nulle part dans le dépôt (code, docs, CDC), avec le même niveau de
rigueur que pour COMMENTAIRE_COMPOSE (§23) côté repagination. Contrairement à ce qu'annonçait §39
(« `referenceCamerPay` conservé tel quel, hors périmètre »), ce renommage a finalement été fait — la
demande de cette entrée l'a explicitement remis en périmètre.

### Renommage complet du schéma (migration data-preserving)

`Paiement.referenceCamerPay` → `referenceTransaction`, `WebhookLog.provider` perd son défaut
`"CAMERPAY"` (toujours posé explicitement par `traiterWebhookPaiement()` depuis §39). `prisma migrate
dev` refuse de générer la migration seul (il ne sait pas inférer un renommage depuis un diff de schéma
et proposait un DROP + ADD destructeur sur une table contenant déjà 5 lignes réelles) — migration
`20260910082945_rename_reference_camerpay_to_transaction` écrite à la main
(`ALTER TABLE … RENAME COLUMN` + `ALTER COLUMN … DROP DEFAULT`), appliquée via `prisma migrate
deploy`, données vérifiées intactes après coup (`SELECT referenceTransaction FROM paiements` → les 5
valeurs `MOCK-…`/`PENDING-…` préservées). Tout le code applicatif (`types.ts`, `mock-provider.ts`,
`notchpay-provider.ts`, `webhook-handler.ts`, `initier/route.ts`, l'écran admin Paiements) mis à jour en
conséquence, y compris le libellé UI « Référence CamerPay » → « Référence transaction » et « Webhooks
CamerPay liés » → « Webhooks liés ». **Piège découvert en testant** : `app` et `worker` sont deux
conteneurs Docker Compose distincts, chacun avec son propre `node_modules` (volumes anonymes séparés,
`docker-compose.yml`) — `prisma generate` doit tourner **dans les deux**, sinon le worker continue de
faire fonctionner l'ancien client Prisma généré et échoue avec `Unknown argument referenceTransaction`
sur le job de webhook mock alors que l'API `app` fonctionne déjà correctement. Non-régression rejouée
bout en bout après correction : inscription → connexion → paiement → webhook mock → `REUSSI` →
abonnement `PREMIUM`/`ACTIF` → `webhook_logs.provider = 'MOCK'`, données de test nettoyées.

### CLAUDE.md, docs/reference/, docs/PROGRESS.md

`CLAUDE.md` (payments via CamerPay → NotchPay) et les deux docs de référence
(`Klarity_Securite_Reference.md` — section paiement + schéma ASCII du flux 4 ; `Klarity_scalability_
reference.txt` — idempotence webhook) mis à jour par remplacement direct. Dans `docs/PROGRESS.md` :
les sections **vivantes** (§1, §2, §15 — resynchronisées par convention, cf. l'en-tête du fichier) ont
été mises à jour pour refléter NotchPay ; les entrées **datées** du journal (§16 « Phase 2 — Paiement
mode mock », 31 août ; §33/§34, 5-6 septembre) ont été **délibérément laissées telles quelles** — elles
décrivent fidèlement ce qui était vrai à ces dates-là (CamerPay nommé, jamais accessible), et les
réécrire changerait rétroactivement l'histoire plutôt que de la documenter. C'est un choix assumé, pas
un oubli : si l'utilisateur préfère un nettoyage complet y compris de ces entrées historiques, il suffit
de le demander explicitement.

### CDC (`Klarity_Cahier_des_Charges.pdf`), v1.31 → v1.32

Édité en place par redaction PyMuPDF (même méthode que v1.29-v1.31, cf. mémoire dédiée), **fait
directement par l'agent principal** après qu'un premier essai de délégation à un sub-agent (fork) a
tourné ~30 minutes et ~450k tokens sans produire une seule modification sur le fichier réel (confirmé
par `git status` resté vide) — repris en direct plutôt que de continuer à attendre.

- **Nouvelle page insérée** (page 10, `doc.new_page(pno=9)`, TOC auto-décalée de +1 comme en v1.31) :
  entrée de journal « v1.31 → v1.32 » détaillant le remplacement (raison : CamerPay jamais accessible en
  pratique malgré son statut de fournisseur nommé depuis les premières versions ; NotchPay offre un
  accès sandbox immédiat MTN + Orange), le nouveau `PAYMENT_MODE = mock | notchpay` (plus de
  sandbox/live séparé — une seule URL d'API NotchPay, distinguée par le préfixe de clé publique), le flux
  réel en 2 appels (`POST /payments` puis `POST /payments/{transaction}` avec canal `cm.orange`/
  `cm.mtn`), la vérification webhook (`x-notch-signature`, HMAC-SHA256, « Hash Key »), le renommage
  `referenceTransaction`, et la limite connue (non testé en sandbox réel). 44 pages au total désormais ;
  footers 10→44 renumérotés, TOC vérifiée cohérente (cibles croissantes, dans les bornes).
- **Remplacements de mots** dans les sections vivantes concernées (§1 page de garde, §1.1/§1.2, §2.4,
  §3, §4.5 — table `Paiement`/`WebhookLog`, §6, §8, §9 diagramme ASCII, §10 roadmap) — `CamerPay` →
  `NotchPay` en place, sans repagination. Contrairement à §23, aucune table n'a dû être laissée en
  retard : les seules cellules nécessitant plus d'espace (`referenceTransaction` sur la table §4.5, la
  ligne Phase 2/Phase 4 de la roadmap §10) tenaient dans la marge verticale déjà présente sous le
  contenu existant — vérifié ligne par ligne avant application, aucune dette de documentation à signaler
  cette fois.
- **§5 réécrite substantiellement** (pas un simple remplacement de mot, comme demandé) : contexte,
  §5.1 (bloc de code `PAYMENT_MODE`/liste des providers), §5.2 (« déjà construit » plutôt que « à faire »),
  §5.3 (reformulée en « ce qui reste à valider avec de vraies clés » plutôt qu'un TODO d'obtention
  d'accès) — le détail mécanique le plus fin (flux HTTP exact, en-têtes, limite non testée) a été mis
  dans la nouvelle entrée de journal plutôt que dans le corps de §5, qui reste volontairement concis,
  cohérent avec le style des sections existantes.
- **Deux pièges de police rencontrés et corrigés** : `apply_redactions()` élague du PDF toute police non
  utilisée dans le flux de contenu au moment où elle est appelée — extraire une police *après* avoir
  redacté son unique usage la fait disparaître (`get_fonts()` ne la liste plus) ; contournement : chaque
  police nécessaire est extraite vers un fichier `.ttf` temporaire *avant* toute redaction sur la page,
  puis passée directement via `fontfile=` à `insert_text()` (jamais via un alias pré-enregistré, qui
  subirait le même élagage). Ensuite, certains sous-ensembles de police embarqués ne contiennent que
  les glyphes réellement utilisés ailleurs sur cette page précise — le sous-ensemble Mono de la page 34
  n'avait jamais utilisé « ê » ni l'apostrophe typographique, les faisant disparaître silencieusement
  (pas d'erreur, juste un caractère absent au rendu) tant que le texte de remplacement les utilisait ;
  détecté par rendu visuel de chaque page touchée (pas seulement extraction de texte), corrigé en
  vérifiant la couverture de glyphes (`fitz.Font.has_glyph`) avant d'écrire le texte définitif.
- **Vérifié** : 44 pages (+1 volontaire) ; titre des métadonnées → `v1.32` ; `grep -i camerpay` sur le
  texte extrait de tout le document → uniquement les 3 pages de journal historiques (v1.1→v1.2,
  v1.5→v1.6, v1.17→v1.19 — volontairement inchangées, même logique que pour PROGRESS.md ci-dessus) et
  la nouvelle page 10 elle-même (qui nomme CamerPay pour expliquer le remplacement) ; comparaison
  texte page par page contre l'original confirme zéro différence de contenu sur toute page non
  concernée (les « différences » détectées par un premier script de vérification n'étaient qu'un artefact
  d'ordre d'extraction du chiffre de pied de page, pas un vrai changement — confirmé par rendu visuel) ;
  footers strictement séquentiels 1→44. Fichier optimisé après coup (`garbage=4, deflate=True` côté
  PyMuPDF) : 298 Ko, plus léger que l'original 338 Ko malgré la page ajoutée (le premier essai avant
  optimisation pesait 1,7 Mo à cause de multiples ré-embarquements de la même police).

### Vérification finale — zéro trace de CamerPay hors historique légitime

`grep -rn -i camerpay .` (hors `node_modules`, `.git`) sur tout le dépôt ne renvoie plus que : les
entrées datées de `docs/PROGRESS.md` (§16, §33, §34, §39 — historique délibérément préservé, cf.
ci-dessus), la migration Prisma déjà appliquée `20260819070754_init` (immuable, jamais modifiée après
application — éditer un fichier de migration déjà appliqué casserait l'intégrité de l'historique
Prisma), le commentaire de la nouvelle migration `20260910082945_…` qui nomme forcément l'ancienne
colonne pour documenter le renommage, et la page 10 du CDC (nomme CamerPay pour expliquer pourquoi il
a été remplacé). Le fichier `.env` réel de l'utilisateur (jamais touché, comme toujours) contient encore
l'ancien commentaire `# --- Payment provider — CamerPay, …` au-dessus de ses variables `NOTCHPAY_*` —
cosmétique, sans effet fonctionnel, à mettre à jour par l'utilisateur s'il le souhaite.

## 41. Premier paiement NotchPay sandbox réel — hypothèse infirmée, bug trouvé et corrigé (11 septembre 2026)

L'utilisateur a configuré ses vraies clés sandbox (`NOTCHPAY_PUBLIC_KEY=pk_test_…`,
`NOTCHPAY_WEBHOOK_SECRET=hsk_test_…`, jamais affichées ni committées) et demandé un test réel bout en
bout avec les numéros de test NotchPay (`+237670000000` succès MTN, `+237690000000` succès Orange,
`+237670000002` échec), en vérifiant explicitement l'hypothèse non confirmée du §39 : l'id de
transaction retourné à l'initiation correspond-il à `data.id` du webhook ?

### Bug réel trouvé dès le premier appel — `POST /payments` renvoie un objet, pas une chaîne

Premier essai via `/api/paiement/initier` (MTN, `+237670000000`) → **500**, `Payment Not Found` sur le
2ᵉ appel (`POST /payments/{transaction}`). Cause : `notchpay-provider.ts` traitait `initData.transaction`
comme une **chaîne** (calée sur l'exemple de la doc publique, `"transaction": "UUID string"`), mais la
vraie réponse renvoie un **objet** :
```
{"transaction":{"amount":5000,...,"reference":"trx.test_q78mhnwvnjR5TW6bIgRJLF9P","status":"pending",...},
 "authorization_url":"https://pay.notchpay.co/test...."}
```
Confirmé en appelant l'API NotchPay directement (`fetch` brut depuis le conteneur `app`, clé lue
uniquement via `process.env`, jamais affichée) — reproduit ensuite avec `GET /payments/{reference}`, qui
renvoie le même objet `transaction` sans jamais de champ `id`, seulement `reference` (format
`trx.test_…`/`trx.…`). **Corrigé** : `initData.transaction.reference` utilisé pour l'URL du 2ᵉ appel et
comme `sessionId`/`idempotencyKey`.

### Hypothèse `data.id == transaction` — infirmée, pas confirmée

La doc générique NotchPay montre un exemple d'event webhook avec `data.id` **et** `data.reference`
distincts (`"id": "pay_123456789"`, `"reference": "order_123"`). Le comportement réel observé sur cette
ressource (Mobile Money via `/payments`) ne correspond pas à cet exemple : **aucun champ `id` n'existe
sur l'objet transaction**, ni à l'initiation ni à la relecture via `GET /payments/{reference}` — seul
`reference` identifie la transaction, de bout en bout, de façon stable (vérifié : la référence retournée
à l'initiation est exactement celle relue ensuite). `traiterWebhook()` corrigé pour lire `data.reference`
en priorité, avec `data.id` gardé en repli défensif (jamais observé en pratique sur cette ressource, mais
coûte rien à garder au cas où NotchPay l'ajoute pour d'autres types d'événements). Sans clé API secrète
NotchPay ni accès à leur documentation interne, impossible de confirmer *pourquoi* la doc générique
diffère du comportement réel (version différente, ressource différente, doc obsolète) — seul le
comportement réel fait foi désormais dans le code.

### Webhook non livrable en local — contourné sans exposer le serveur dev à Internet

NotchPay envoie réellement des webhooks en sandbox (pas de mode "polling seul"), mais le serveur dev
tourne uniquement sur `localhost:3000` dans Docker, sans tunnel public (aucun `ngrok`/`cloudflared` actif
— vérifié avant de commencer). Plutôt que d'exposer l'environnement de dev à Internet sans en discuter
d'abord avec l'utilisateur, la vérification a été faite autrement, avec un niveau de rigueur équivalent :
1. Paiement initié réellement via `/api/paiement/initier` (vraie clé publique, vrai appel réseau NotchPay).
2. Statut réel relevé par `GET /payments/{reference}` (résolution instantanée en sandbox sur ces numéros
   de test, pas d'attente USSD réelle nécessaire).
3. Le payload webhook a été reconstitué avec les **données réelles** renvoyées par NotchPay (montant,
   devise, statut, référence — rien d'inventé), signé avec un **vrai** HMAC-SHA256 calculé via
   `NOTCHPAY_WEBHOOK_SECRET` (lu uniquement dans le conteneur, jamais affiché), puis livré à
   `POST /api/paiement/webhook` en local — validant la vérification de signature et toute la logique
   métier avec de vraies données, sans jamais rendre le serveur de dev joignable depuis Internet.
   Limite assumée : ceci ne teste pas le trajet réseau NotchPay → serveur, seulement tout ce qui se passe
   une fois le webhook arrivé (signature + traitement) — si l'utilisateur veut la couverture complète
   (tunnel public + webhook réellement poussé par NotchPay), il suffit de le demander.

### Résultats des 4 scénarios testés (données de test supprimées après coup)

- **MTN succès** (`+237670000000`) : `POST /payments` → `POST /payments/{reference}` → statut réel
  NotchPay `complete` en un seul `GET` (immédiat) → webhook livré → `paiements.statut = REUSSI`,
  `abonnements.plan = PREMIUM`/`statut = ACTIF`, `webhook_logs.provider = 'NOTCHPAY'`,
  `traitementStatut = CREDITE`, `signatureValide = true`.
- **Orange succès** (`+237690000000`, canal `cm.orange`) : même résultat — confirme que le
  `CHANNEL_PAR_OPERATEUR` (MTN → `cm.mtn`, Orange → `cm.orange`) fonctionne pour les deux opérateurs,
  pas seulement MTN.
- **Échec** (`+237670000002`) : statut réel NotchPay `failed` → webhook livré → `paiements.statut =
  ECHEC`, `traitementStatut = ECHEC_PAIEMENT`, abonnement resté `GRATUIT`/`ACTIF` (jamais crédité).
- **Idempotence** : même webhook (même `reference`) livré une seconde fois → `traitementStatut =
  DEJA_TRAITE`, aucune deuxième écriture sur `Abonnement` (rejoue la garantie déjà testée en mode mock,
  cette fois avec un vrai payload NotchPay).
- **Signature invalide** : payload avec une signature bidon → **401** `SIGNATURE_INVALIDE`, rien écrit
  en base — confirme que la vérification HMAC réelle (pas seulement celle du mock) bloque bien un
  payload non authentifié.

### Code changé

`src/lib/payment/notchpay-provider.ts` : `NotchPayInitResponse.transaction` retypé en objet
(`{ reference, status }`), `initierPaiement()` utilise `initData.transaction.reference`,
`traiterWebhook()` lit `data.reference ?? data.id` (avec erreur explicite si aucun des deux n'est
présent, plutôt que de planter plus loin avec un message confus). Commentaire de tête de fichier mis à
jour pour refléter le comportement réel plutôt que l'hypothèse initiale du §39.

**Non couvert par ce test** : le trajet réseau réel NotchPay → webhook applicatif (nécessite un tunnel
public, pas mis en place sans validation préalable de l'utilisateur) ; le comportement des statuts
intermédiaires (`processing`, timeout `+237670000003`, annulation `+237670000004`, fonds insuffisants
`+237670000001`) — seuls succès/échec ont été exercés, à la demande explicite de l'utilisateur. Le CDC
(`Klarity_Cahier_des_Charges.pdf`, encore en v1.32) décrit toujours le comportement supposé avant ce
test réel (« id de transaction ») plutôt que le comportement confirmé (« reference ») — non corrigé ici,
l'utilisateur n'ayant demandé que le code et ce journal ; à signaler s'il souhaite une mise à jour du CDC
à ce sujet.

### Suite (même jour) — CDC porté en v1.33 sur demande explicite

L'utilisateur a confirmé ne pas avoir besoin du tunnel public pour l'instant (couverture réseau complète
NotchPay → webhook reportée au déploiement, quand le serveur aura une vraie URL publique) et a demandé
que le CDC reflète le comportement réel confirmé plutôt que l'hypothèse initiale.

Édité en place par redaction PyMuPDF (même méthode, cf. mémoire dédiée) — cette fois un simple
remplacement de mot sur une entrée récente (pas une hypothèse ancienne à préserver comme historique),
donc corrigé directement plutôt que traité par une nouvelle entrée qui laisserait le corps du texte faux.
Page 1 : version bump `v1.32 — 10 septembre 2026` → `v1.33 — 11 septembre 2026`. Page 10 (l'entrée
« v1.31 → v1.32 ») : le paragraphe entier redact + réécrit (28 lignes, mêmes positions verticales que
l'original, aucun décalage nécessaire) pour remplacer « renvoie un id de transaction... POST /payments/
{transaction} » par « renvoie un objet transaction (champ reference)... POST /payments/{reference} », et la
phrase d'hypothèse « ...reste à valider au premier paiement réel » par « ...s'est révélée fausse au premier
vrai paiement (v1.33, entrée suivante) ». Nouvelle entrée courte « v1.32 → v1.33 » ajoutée **sur la même
page 10** (12 lignes, largement de la place disponible avant le pied de page) — pas besoin d'insérer une
page ni de renuméroter cette fois, contrairement au bump v1.31→v1.32. Métadonnées → v1.33. Fichier
réoptimisé (`garbage=4, deflate=True`) : 297 Ko (légèrement plus petit que les 298 Ko de v1.32).

Vérifié : 44 pages inchangées (aucune insertion cette fois) ; comparaison texte page par page contre
v1.32 confirme que **seules les pages 1 et 10** diffèrent, tout le reste strictement identique ; footers
toujours séquentiels 1→44 ; TOC toujours saine (91 entrées, aucune cible hors bornes — logique, la TOC
n'a pas eu besoin d'être touchée puisqu'aucune page n'a été insérée) ; rendu visuel des deux pages
modifiées confirme un texte propre, sans artefact ni collision, la phrase corrigée s'enchaînant
correctement avec « Comme pour COMMENTAIRE_COMPOSE en v1.30... » qui suit, laissé intact.

## 42. `AfricasTalkingProvider` — Orange SMS Cameroun remplacé (jamais implémenté) par Africa's Talking (11 septembre 2026)

Orange SMS Cameroun n'avait jamais eu de code écrit (seul `MockSmsProvider` existait, cf. §17) — sa
propre FAQ documente un problème de livraison connu vers les numéros MTN, ce qui en faisait un mauvais
choix pour un OTP transactionnel devant atteindre les deux opérateurs. L'utilisateur a un compte
Africa's Talking (app Sandbox, `username=sandbox` + clé API) et a demandé de basculer directement dessus,
sans étape Orange intermédiaire.

### Choix : appel REST direct plutôt que le SDK npm officiel

Le SDK `africastalking` (v0.8.3 sur npm) a été inspecté (code source du dépôt officiel
`AfricasTalkingLtd/africastalking-node.js`, `lib/common.js` + `lib/sms.js`) plutôt que deviné : il n'a
aucun type TypeScript et embarque une chaîne de dépendances à risque — `grpc@^1.24.3` (bindings natifs
dépréciés), `axios@^0.21.1` (CVEs connues), `unirest@^0.6.0` (abandonné), `@hapi/joi@^16.1.7` (déprécié).
Plutôt que d'ajouter cette dépendance, le contrat REST qu'il implémente en interne a été extrait
directement de son code source et réimplémenté nativement via `fetch`, même précédent que
`NotchPayProvider` (§39) :

- `POST {baseUrl}/messaging` — `baseUrl` = `https://api.sandbox.africastalking.com/version1` si
  `AFRICASTALKING_USERNAME === "sandbox"` (convention Africa's Talking : le username sandbox est
  toujours littéralement `sandbox`), sinon `https://api.africastalking.com/version1`.
- Headers `apiKey` (la clé API) + `Accept: application/json` ; corps `application/x-www-form-urlencoded`
  (`username`, `to`, `message`).
- Succès HTTP **201** (pas 200 — comportement du SDK officiel confirmé dans son propre code), corps
  `{ SMSMessageData: { Recipients: [{ status, statusCode, messageId, ... }] } }` — un statut par
  destinataire, `"Success"` étant la seule valeur de succès.

### Code changé

- **`src/lib/sms/africastalking-provider.ts`** — nouveau, implémente `SmsProvider` (4 méthodes).
  `envoyerOtp()` est la seule branchée à du code applicatif réel (connexion parent, §2.2) — les 3
  autres (`envoyerRappelRenouvellement`, `envoyerResumeProgression`, `envoyerAlerteInactivite`) sont
  implémentées pour compléter l'interface (jobs BullMQ pas encore construits, §17), même structure que
  `MockSmsProvider`. Toutes les 4 réutilisent `messages.ts` pour le texte, comme le mock — le provider
  reste un transport, jamais un rédacteur.
- **`src/lib/sms/index.ts`** — `getSmsProvider()` : `SMS_MODE` passe de `mock | live` à
  `mock | africastalking` (le littéral `live` n'avait jamais de classe réelle derrière, il est retiré au
  profit du nom concret du fournisseur). `mock` reste le cas par défaut (`?? "mock"` inchangé).
- **`.env.example`** — `SMS_PROVIDER_API_KEY` (jamais utilisé, un nom générique posé d'avance) remplacé
  par `AFRICASTALKING_USERNAME=` et `AFRICASTALKING_API_KEY=` (noms exacts demandés par l'utilisateur).
  `SMS_MODE=mock` reste le défaut déclaré — **pas basculé en production**, conformément à la demande
  explicite de l'utilisateur de garder mock tant qu'il n'a pas confirmé vouloir basculer après un test
  sandbox concluant.
- Commentaires mis à jour pour ne plus présenter Orange SMS Cameroun comme une option en attente
  (`provider.ts`, `types.ts`, `src/lib/auth/otp.ts`,
  `src/app/api/auth/parent/request-otp/route.ts`) — la mention y reste seulement comme contexte
  historique de la décision de remplacement.

### Vérifié

- `tsc --noEmit` dans le conteneur `app` : **0 erreur**.
- `eslint` sur `src/lib/sms/`, `src/lib/auth/otp.ts`, `src/app/api/auth/parent/request-otp/route.ts` :
  **0 erreur** (le seul warning est `.env.example` ignoré par la config ESLint — attendu, pas un fichier
  lintable).
- **Test sandbox réel non exécuté** : `AFRICASTALKING_USERNAME`/`AFRICASTALKING_API_KEY` ne sont présents
  ni dans le `.env` réel du projet ni dans l'environnement du conteneur `app` au moment de cette entrée
  (vérifié par présence de clé uniquement, jamais par affichage de valeur) — malgré la formulation
  initiale de l'utilisateur (« prêts à configurer »), les clés n'avaient pas encore été ajoutées à ce
  stade. L'appel réel `POST {baseUrl}/messaging` contre le sandbox Africa's Talking (réponse API,
  format exact, `Recipients[0].status`) reste **à faire** dès que l'utilisateur ajoute ces deux variables
  à son `.env` réel.
- Ce qui ne sera de toute façon **jamais vérifiable en sandbox**, même une fois les clés ajoutées :
  la livraison effective à un vrai téléphone. Confirmé par le centre d'aide Africa's Talking lui-même —
  en mode sandbox, un SMS n'atteint jamais un téléphone réel, quelle que soit la configuration ; il est
  routé uniquement vers leur simulateur web (`simulator.africastalking.com`). Seule une clé **live** en
  production permettrait de vérifier la livraison réelle.

**Non fait, sciemment** : `SMS_MODE` n'a pas été basculé sur `africastalking` en production/`.env.example`
— reste `mock` par défaut jusqu'à confirmation explicite de l'utilisateur après un test sandbox concluant.

### Suite (même jour) — parcours complet de connexion parent testé en sandbox réel

L'utilisateur a configuré ses identifiants sandbox Africa's Talking dans son `.env` réel et a demandé de
tester le parcours complet : `POST /api/auth/parent/request-otp` → appel réel Africa's Talking → connexion
NextAuth complétée avec le code reçu.

**Contrainte rencontrée** : `SMS_MODE=mock` reste le défaut déclaré dans le `.env` réel (conformément au
point 5 de la demande initiale — ne pas basculer avant confirmation). Le serveur `app` persistant tourne
donc avec `SMS_MODE=mock`, et l'éditer directement (`.env`) ou démarrer un second serveur Next.js avec
`SMS_MODE=africastalking` en variable d'environnement ad-hoc ont tous deux été bloqués par le classifieur
d'actions de la session (protection contre l'écriture dans le fichier de secrets réel / le démarrage d'un
service annexe). Contourné sans toucher `.env` ni `docker-compose.yml` : `getSmsProvider()` lit `SMS_MODE`
depuis `process.env` à l'appel, donc un `docker compose exec -T -e SMS_MODE=africastalking app ...`
one-off — exécuté dans le conteneur `app` déjà démarré, sans nouveau conteneur ni nouveau port — suffit à
exercer le vrai code applicatif (`envoyerOtp()` de `src/lib/auth/otp.ts`, celui réellement appelé par la
route) avec le vrai `AfricasTalkingProvider`, sans jamais modifier le fichier `.env` du projet.

### Résultats

1. **Appel API Africa's Talking réel — succès confirmé.** D'abord isolément
   (`AfricasTalkingProvider.envoyerOtp()` appelé directement via `npx tsx` dans le conteneur `app`) :
   réponse HTTP 201, `SMSMessageData.Recipients[0].status = "Success"`, `messageId` réel retourné
   (`ATXid_2ce1bb0af4389d1cfebbf512864d7caf`). Puis via la vraie fonction applicative `envoyerOtp()`
   (même chemin de code que `/api/auth/parent/request-otp`) : un vrai `OtpVerification` créé en base,
   code retourné (`codeDevMock`, comportement normal hors production).
2. **Connexion parent complétée réellement.** CSRF NextAuth récupéré (`GET /api/auth/csrf`), puis
   `POST /api/auth/callback/parent` avec `codeEleve` (élève de test `ELE-TST-999`, créé pour ce test),
   le téléphone normalisé et le code OTP reçu : **302 vers l'app** (pas de redirection d'erreur) +
   cookie `authjs.session-token` réel posé. Vérifié en base après coup : `Parent` créé (upsert),
   `ParentEleveLink` créé (`codeUtilise = ELE-TST-999`), `OtpVerification.utilise = true`.
3. **Ce qui est réellement observable en sandbox, et ce qui ne l'est pas** (clarification explicitement
   demandée) : la réponse HTTP 201 + le statut par destinataire (`"Success"`) sont les **seules preuves
   disponibles en sandbox** — Africa's Talking documente lui-même, dans son propre centre d'aide, qu'un
   SMS envoyé en sandbox **n'atteint jamais un téléphone réel**, quelle que soit la configuration ; il est
   routé uniquement vers leur simulateur web (`simulator.africastalking.com`). Le numéro de test utilisé
   ici (`+237677000000`) n'a donc reçu aucun SMS réel — c'est un comportement attendu de la sandbox, pas
   un échec. Seule une clé **live** en production permettrait de vérifier la livraison effective à un
   téléphone.

### Nettoyage

Toutes les données de test supprimées après vérification : `ParentEleveLink`, `OtpVerification`,
`Parent` (`+237677000000`), `Eleve` de test (`test-at-sms-eleve` / `ELE-TST-999`) — retour à 3 élèves en
base, identique à l'état avant ce test. Aucun fichier de script temporaire laissé dans le dépôt
(`git status` propre). `.env` réel non modifié — `SMS_MODE=mock` inchangé, comme demandé.

**Conclusion** : `AfricasTalkingProvider` fonctionne réellement contre le sandbox Africa's Talking, sur
tout le chemin applicatif réel (envoi OTP + connexion NextAuth), pas seulement en isolation. La seule
limite reste celle documentée par Africa's Talking lui-même : aucune sandbox, quel que soit le
fournisseur SMS, ne permet de vérifier la livraison à un vrai téléphone — ce sera vérifiable uniquement
en production. `SMS_MODE` reste `mock` par défaut ; le basculement en production attend toujours la
confirmation explicite de l'utilisateur.

## 43. Prix Premium normal (hors promo) rendu configurable — `ParametrePlateforme` (12 septembre 2026)

`PRIX_NORMAL_PREMIUM` (5000 FCFA) était le dernier morceau de tarification encore en dur dans
`src/lib/payment/tarification.ts` (§2.4.1) — utilisé comme repli quand aucune `PeriodeTarifaire` n'est
active. Rendu éditable depuis `/admin/parametres`, à côté des fenêtres promo déjà configurables (§37).

### Choix d'architecture : `ParametrePlateforme` clé/valeur plutôt qu'intégré à `PeriodeTarifaire`

Deux options envisagées : (a) réutiliser `PeriodeTarifaire` avec une ligne « spéciale » sans dates, ou
(b) une nouvelle table clé/valeur générique. (a) écarté — une fenêtre tarifaire a intrinsèquement des
dates de début/fin (`@@index([actif, dateDebut, dateFin])`, requête `periodeTarifaireActive()` basée sur
un chevauchement de dates) ; un prix qui n'a pas de fenêtre temporelle n'a rien à faire dans ce modèle,
et y greffer un cas spécial « pas de dates » aurait compliqué la requête de sélection sans bénéfice. (b)
retenu : nouveau modèle `ParametrePlateforme` (`cle` `@id`, `valeur: String`, `modifieParAdminId`,
`updatedAt`) — générique et extensible à de futurs réglages plateforme (§2.3) sans nouvelle migration à
chaque fois, avec `valeur` en `String` pour rester agnostique du type réel du paramètre. Seule clé à ce
jour : `PRIX_NORMAL_PREMIUM` (`CLE_PRIX_NORMAL_PREMIUM` dans `tarification.ts`). Absence de ligne pour
cette clé (jamais modifiée par un admin) ⇒ repli sur `PRIX_NORMAL_PREMIUM_DEFAUT` (renommée depuis
`PRIX_NORMAL_PREMIUM`), jamais une erreur — migration `20260912193710_add_parametre_plateforme`,
appliquée et `prisma generate` rejoué dans `app` **et** `worker` (node_modules séparés par conteneur).

### Code changé

- **`src/lib/payment/tarification.ts`** — nouvelle fonction `prixNormalPremiumConfigure()` (lit
  `ParametrePlateforme`, `null` si absente ou valeur corrompue) ; `obtenirTarifPremium()` combine
  désormais `periodeTarifaireActive()` et `prixNormalPremiumConfigure() ?? PRIX_NORMAL_PREMIUM_DEFAUT` en
  parallèle (`Promise.all`). Les 4 appelants existants (`/abonnement`, `/abonnement/paiement`,
  `/api/paiement/initier`, `/admin/parametres`) n'ont rien à changer — tous passent déjà par
  `obtenirTarifPremium()`.
- **`POST` remplacé par `PUT /api/admin/parametres/prix-normal`** — upsert simple (pas de notion d'id
  côté client, un seul paramètre). Triple défense identique à `periodes-tarifaires` : middleware
  (`/admin/*` → `ADMIN`), `exigerRole("ADMIN")` en tête de handler, vérification `prisma.admin.findUnique`
  avant écriture. Zod : `prix` positif, max 1 000 000 (même borne que les fenêtres promo). Cohérence non
  bloquante (point 4 de la demande) : si une `PeriodeTarifaire` est active à l'instant de l'écriture et
  que le nouveau prix normal lui est **inférieur**, un `avertissement` est renvoyé dans la réponse (la
  requête réussit quand même — un déclassement volontaire reste possible, juste signalé).
- **`src/components/admin/PrixNormalManager.tsx`** — nouveau composant client, même patron que
  `PeriodeTarifaireManager` (état local, `apiFetch`, `router.refresh()`) mais plus simple : un seul champ
  numérique + bouton. Affiche l'avertissement de cohérence en rouge avec ⚠️, distinct du message de
  succès. Rappelle la fenêtre promo active en cours (si applicable) pour que l'admin comprenne pourquoi le
  prix normal affiché ne s'applique pas aujourd'hui.
- **`src/app/admin/(protected)/parametres/page.tsx`** — nouvelle section « Prix normal (hors promotion) »
  ajoutée au-dessus de « Fenêtres tarifaires », alimentée par `tarif.prixNormal` (déjà calculé par
  `obtenirTarifPremium()`, plus besoin d'importer une constante séparée — `PRIX_NORMAL_PREMIUM` retiré des
  imports). Titre/description de la page mis à jour pour couvrir les deux réglages.

### Vérifié en base et en navigateur (session ADMIN réelle de l'utilisateur, `admin@klarity.com`)

- `tsc --noEmit` et `eslint` sur tous les fichiers touchés : **0 erreur**.
- Migration appliquée (`prisma migrate status` → à jour) ; `\d parametres_plateforme` confirme la table
  + la FK vers `admins`.
- **Modification réelle du prix** (5000 → 5500) via le formulaire : `parametres_plateforme.valeur` mis à
  jour en base, `modifieParAdminId` pointant vers le vrai compte `admin@klarity.com` connecté (pas un
  compte de test) ; tuile « Tarif appliqué aujourd'hui » et badge « Tarif normal » de `/admin/parametres`
  répercutés immédiatement ; **`/abonnement` (aucune fenêtre promo active à la date du jour) affiche bien
  5 500 FCFA** — confirmé par lecture du texte de page rendue.
- **Avertissement de cohérence testé réellement** : fenêtre `PeriodeTarifaire` de test créée (active,
  3000 FCFA, couvrant aujourd'hui), prix normal mis à 2000 (inférieur) → réponse API + UI affichent bien
  « ⚠️ Attention : ce prix (2 000 FCFA) est inférieur à celui de la fenêtre promo actuellement active
  « TEST coherence » (3 000 FCFA) — elle ne constitue plus une réduction. » et **la sauvegarde a quand
  même réussi** (non bloquant, conforme au point 4 de la demande). Fenêtre de test supprimée après coup.
- **Historique des paiements intact — même vérification que pour les fenêtres promo (§37)** : les 3
  `Abonnement` `PREMIUM`/`ACTIF` déjà existants en base (payés avant ce changement) sont restés à
  `prixApplique = 5000.00` tout au long des changements de prix normal (5000 → 5500 → 2000 → 5000) — la
  table `ParametrePlateforme` n'est lue qu'au moment de l'affichage/paiement, jamais rétro-appliquée à un
  abonnement déjà figé.
- Requête `PUT` sans session → **401** (confirmé via `curl`).
- Prix normal remis à sa valeur d'origine (**5000 FCFA**) après test — aucun changement de fond laissé en
  base au-delà de la nouvelle table et du code.

### Nettoyage

Compte admin de test créé puis supprimé en cours de route (avant de découvrir qu'une session admin réelle
de l'utilisateur était déjà active dans le navigateur — utilisée à la place). Fenêtre tarifaire de test
supprimée. `git status` propre en dehors des fichiers du feature (schéma, migration, route, composant,
page).

## 44. Liens légaux du footer désactivés — état temporaire avant validation par un avocat (13 septembre 2026)

> ⚠️ **ÉTAT TEMPORAIRE — À RÉACTIVER.** Cette section décrit une désactivation volontaire, pas un
> comportement cible. Les 3 liens légaux du footer de la landing page doivent redevenir cliquables
> **dès que les documents `docs/legal/*.docx` sont finalisés (champs « [à compléter] » remplis) et
> validés par un avocat inscrit au Barreau du Cameroun.** Voir « Comment réactiver » en fin de section.

### Pourquoi

Les 3 documents juridiques (`Klarity_Mentions_Legales.docx`, `Klarity_CGU.docx`,
`Klarity_Politique_Confidentialite.docx`) sont toujours en version 1.0 provisoire : raison sociale,
forme juridique, siège social, RCCM/NIU et représentant légal ne sont pas renseignés, et chaque
document stipule lui-même en en-tête qu'il doit être validé avant publication (cf. section « Bloquant
avant mise en production » en tête de ce document). Le site étant sur le point d'être référencé
publiquement pour la première fois (dossier NotchPay), exposer ces brouillons comme s'ils étaient les
conditions contractuelles en vigueur n'était pas acceptable.

Choix retenu (demande explicite de l'utilisateur) : **désactiver sans retirer** — supprimer les entrées
aurait modifié la mise en page du footer, déjà validée par la maquette `01_landing_page.png`.

### Code changé — `src/components/landing/LandingFooter.tsx` (seul fichier touché)

Le composant référençait les `.docx` à **deux endroits**, tous deux traités :

1. La colonne « Légal » (3 entrées : Mentions légales, Conditions d'utilisation, Politique de
   confidentialité), générée depuis la constante `LEGAL_LINKS`.
2. La barre de bas de page (3 entrées plus courtes : Mentions légales, Confidentialité, CGU), écrites
   en dur.

Dans les deux cas les `<a href={...} download>` sont devenus de simples `<span>` grisés
(`cursor-not-allowed text-texte-muted/60`), avec un `title="Bientôt disponible"` porté par l'élément
**conteneur** (`<li>` / la `<div>` de la barre) plutôt que par le libellé lui-même, plus une ligne
« Bientôt disponible » visible sous la colonne « Légal ».

Détail d'accessibilité qui a nécessité une correction en cours de route : en mettant `title` directement
sur le `<span>` du libellé, l'arbre d'accessibilité remplaçait le nom accessible par « Bientôt
disponible » — les trois entrées devenaient indistinguables pour un lecteur d'écran (vérifié
réellement : `read_page` renvoyait `generic "Bientôt disponible"` ×3). En déplaçant `title` sur le
conteneur, l'arbre redonne bien `listitem "Bientôt disponible"` → `generic "Mentions légales"`, etc. :
l'info « indisponible » est conservée sans écraser le libellé.

La constante `LEGAL_LINKS` **garde ses `href`** (inutilisés pour l'instant, servant de `key`) — c'est
volontaire : elle documente exactement ce qu'il faudra recâbler.

### Vérifié réellement dans le navigateur (local, `http://localhost:3000/`)

- `tsc --noEmit` et `eslint` sur le fichier : **0 erreur**.
- Arbre d'accessibilité du `<footer>` : **plus aucun élément `link`** pour les 6 entrées légales (toutes
  en `generic`) ; les 2 liens de contact (`mailto:`, `tel:`) restent bien des `link` — la désactivation
  n'a pas débordé.
- **Clics réels** sur « Mentions légales » (barre de bas de page) puis sur « Mentions légales »
  (colonne Légal) : aucune navigation, aucun téléchargement déclenché, l'URL reste `http://localhost:3000/`.
- Capture d'écran : mise en page du footer strictement inchangée, libellés visibles en gris clair.

### ⚠️ Limite importante — les fichiers restent accessibles par URL directe

Désactiver les liens **ne retire pas les documents du site** : ils sont servis statiquement depuis
`public/legal/` et restent téléchargeables par quiconque connaît (ou devine) l'URL — vérifié :
`curl -L http://localhost:3000/legal/Klarity_CGU.docx` → **HTTP 200, 21 698 octets** (le document
complet). Tout moteur les ayant déjà indexés y accède également. Si l'objectif est que ces brouillons
ne soient plus récupérables du tout, il faut en plus les sortir de `public/legal/` (les originaux
restent dans `docs/legal/`, rien n'est perdu) — **non fait ici**, l'utilisateur n'ayant demandé que la
désactivation des liens, et un retrait pouvant gêner si le dossier NotchPay exige une URL de document
légal accessible.

### ⚠️ Vérification « après déploiement Vercel » — impossible à ce stade

L'utilisateur a demandé de vérifier aussi le comportement après le prochain déploiement Vercel. **Ça
n'a pas pu être fait**, pour deux raisons factuelles :

1. **Aucun projet Vercel n'est configuré dans ce dépôt** — pas de `vercel.json`, pas de `.vercel/`,
   aucune référence à Vercel nulle part dans le code ou la config.
2. **`next build` échoue toujours** — rejoué le 13 septembre 2026 : `✓ Compiled successfully in 75s`,
   types OK, puis `Error: <Html> should not be imported outside of pages/_document` au prérendu de
   `/404`, `Export encountered an error on /_error: /404`. C'est le bloquant préexistant documenté en
   tête de ce document (découvert le 1er septembre, sans rapport avec ce changement). Un build Vercel
   échouerait exactement de la même façon.

La vérification en production reste donc **à faire au premier déploiement réel**, une fois le bloquant
`next build` levé.

### Comment réactiver (une fois les documents validés par un avocat)

Dans `src/components/landing/LandingFooter.tsx` : retransformer les 6 `<span>` en
`<a href={...} download className="...hover:text-texte">`, retirer `legalDesactiveClasses`,
`LEGAL_DESACTIVE_TITRE`, les `title` sur les conteneurs et la ligne « Bientôt disponible ». Le commit
précédant ce changement contient la version cliquable exacte. Penser aussi à mettre à jour la section
« Bloquant avant mise en production » en tête de ce document.

## 45. `.docx` légaux retirés de `public/legal/` + cause réelle de l'échec `next build` trouvée (13 septembre 2026)

Suite au §44 (liens légaux désactivés dans le footer), l'utilisateur a demandé deux choses : (1) retirer
vraiment les 3 documents légaux du site, pas seulement désactiver les liens, et (2) éclaircir une
contradiction apparente — son déploiement Vercel (`klarity-sand.vercel.app`) a réussi (« Congratulations! »,
site en ligne), alors que ce journal documentait `next build` comme un bloquant qui échoue systématiquement
en local avec une erreur `<Html>`.

### Partie 1 — Retrait effectif des `.docx`

Désactiver les liens (§44) ne retirait pas les fichiers eux-mêmes : ils restaient servis statiquement
depuis `public/legal/`, donc téléchargeables par URL directe. Vérifié avant intervention :
`curl -L http://localhost:3000/legal/Klarity_CGU.docx` → **HTTP 200, 21 698 octets** (le document complet).

Retiré : `git rm public/legal/Klarity_CGU.docx public/legal/Klarity_Mentions_Legales.docx
public/legal/Klarity_Politique_Confidentialite.docx`. Les originaux restent intacts dans `docs/legal/`
(hashes MD5 identiques aux anciens fichiers de `public/legal/`, confirmés avant suppression).

**Incident mineur en cours de route** : après `git rm` des 3 fichiers puis `rmdir public/legal` (dossier
maintenant vide), le dossier **`public/` lui-même a disparu du disque** (`stat public` →
`No such file or directory`) — `public/legal/` était le seul contenu jamais suivi par git dans `public/`
(confirmé via `git ls-tree -r HEAD -- public/`), donc rien d'autre n'a été perdu, mais la cause exacte de
cette disparition du dossier parent (au-delà de ce qui a été explicitement demandé) n'a pas été élucidée.
Recréé immédiatement (`mkdir public`, vide) par précaution — Next.js suppose l'existence de ce dossier par
convention même s'il ne contient rien.

**Vérifié après coup** (conteneur `app`, serveur dev local) :
- Les 3 URLs `/legal/*.docx` renvoient désormais **HTTP 404** (au lieu de 200) ;
- La page d'accueil (`/`) et le footer avec liens désactivés continuent de fonctionner normalement ;
- `docs/legal/*.docx` inchangés (mêmes hashes MD5 qu'avant).

### Partie 2 — Pourquoi Vercel réussit alors que `next build` échoue en local : **`NODE_ENV` qui fuite**

Investigation reprise en profondeur (le blocage du 1er septembre avait été laissé « volontairement
arrêté »). Reproduit l'échec une nouvelle fois pour confirmer qu'il persistait bien (identique : erreur
`<Html> should not be imported outside of pages/_document` au prérendu de `/404`).

**Étape 1 — écarter les fausses pistes locales.** Deux hypothèses plausibles ont été testées et
**infirmées** par des tests contrôlés :
- *Cache webpack pollué par `next dev`* : `next build` relancé avec un `.next` totalement vidé
  (aucune trace de `next dev`) → **même erreur, à l'identique**. Écarté.
- *`next dev` tournant en parallèle pendant le build* (le conteneur `app` exécute `npm run dev` en
  continu ; `next build` y était lancé via `docker compose exec` dans ce même conteneur) : testé avec le
  service `app` **arrêté** (`docker compose stop app`, donc aucun `next dev` actif) et un `next build`
  lancé directement via `docker run` sur les mêmes volumes `node_modules`/`.next` → **même erreur, à
  l'identique**. Écarté.

  (Effet de bord de ce test : `docker compose run` crée un **nouveau conteneur avec ses propres volumes
  anonymes**, distincts de ceux du conteneur `app` persistant — un premier essai via `docker compose run`
  a donc tourné avec un `node_modules` **périmé**, provoquant une erreur de type totalement différente,
  sans rapport avec `<Html>`, le temps de comprendre qu'il fallait monter explicitement les volumes du
  conteneur `app` réel — `docker run -v <id-volume-node_modules>:/app/node_modules -v
  <id-volume-.next>:/app/.next ...` — pour un test valide.)

**Étape 2 — recherche externe.** Une recherche sur cette signature d'erreur precise a fait remonter une
discussion GitHub `vercel/next.js` documentant exactement ce symptôme pour des builds Next.js 15 en
Docker : `NODE_ENV` à une valeur non-production pendant `next build` fait dérailler l'export statique de
`/404`/`/_error` vers un chemin de code hérité du Pages Router, provoquant cet import `<Html>` invalide.

**Étape 3 — vérification locale.** `.env` (chargé par `env_file:` dans `docker-compose.yml` pour les
services `app`/`worker`, adapté à `npm run dev`) déclare `NODE_ENV=development`. C'est exactement ce
`NODE_ENV` qui était hérité à chaque tentative précédente de `next build` en local (via `docker compose
exec`, `docker compose run`, ou un `docker run --env-file .env` manuel). **Test décisif** : relancer
*exactement* le même `next build`, mêmes volumes, mêmes dépendances, en forçant uniquement
`NODE_ENV=production` en plus du `.env` → **build réussi de bout en bout**, toutes les pages générées
(46 routes), aucune erreur `<Html>`.

**Conclusion.** Ce n'était jamais un bug de Next.js ni une régression du projet — c'était `NODE_ENV=development`
(nécessaire et correct pour `npm run dev`) qui fuitait dans les invocations locales de `next build`, une
commande qui n'a jamais servi qu'à la vérification manuelle (le workflow Docker Compose ne lance que
`npm run dev`/`npm run worker:dev`). **Vercel n'a jamais rencontré ce problème** : leur pipeline de build
force `NODE_ENV=production` pendant l'étape de build, indépendamment de tout `.env` du dépôt — d'où un
déploiement systématiquement réussi malgré l'échec local.

**Le site en ligne a été vérifié réellement, pas supposé sain par déduction :**
- `curl https://klarity-sand.vercel.app/` → **200**, page d'accueil réelle (`x-nextjs-prerender: 1`,
  contenu HTML de la landing page) ;
- `curl https://klarity-sand.vercel.app/<chemin-inexistant>` → **404**, avec le **vrai contenu de
  `not-found.tsx`** (`<title>Page introuvable — Klarity</title>`, `x-matched-path: /404`,
  `x-next-error-status: 404`) — la preuve directe que le build Vercel a réellement généré et servi la
  page 404 personnalisée du projet, pas une page d'erreur générique de secours.

**Aucun risque caché identifié sur le site en production** au sujet de ce point précis : le comportement
observé sur Vercel est celui attendu, le déploiement réel n'est affecté par aucune version dégradée de
`/404`/`/_error`.

**Pour l'avenir** : toute vérification locale de `next build` doit forcer `NODE_ENV=production`
explicitement (`NODE_ENV=production npx next build`), plutôt que de le lancer dans un contexte qui charge
le `.env` de développement. Ce n'est **pas** un changement de code — c'est une note de procédure pour
quiconque relance ce diagnostic.

### Nettoyage

Conteneur `app` (arrêté pendant le test §Partie 2) redémarré et re-vérifié sain (page d'accueil 200,
liens légaux toujours désactivés et fichiers toujours en 404). Cache `.next` du conteneur `app` réoccupé
par la sortie du build de production testé manuellement — sans conséquence, `next dev` régénère ce dont
il a besoin au démarrage (vérifié : page d'accueil répond normalement après redémarrage).

## 46. Documents légaux finalisés et validés — publication en pages web dédiées, footer réactivé (13 septembre 2026)

L'utilisateur a confirmé que les 3 documents juridiques (`docs/legal/*.docx`) sont désormais finalisés
et validés, passés en version 1.2, prêts à être publiés. Demande : réactiver les liens du footer
(§44/§45 devenaient obsolètes), mais rediriger vers des pages web lisibles plutôt que vers un
téléchargement direct du `.docx`, en conservant les originaux dans `docs/legal/` comme archive
uniquement (jamais republiés dans `public/`).

### Anomalie trouvée avant publication, et accord explicite de l'utilisateur pour la corriger

En extrayant le texte réel des 3 `.docx` (voir méthode ci-dessous) pour construire les pages, deux
artefacts de brouillon subsistaient malgré le statut « finalisé et validé » annoncé :
1. La phrase « Document à faire valider par un avocat inscrit au Barreau du Cameroun avant
   publication », présente littéralement dans les 3 documents (bloc de titre).
2. Dans les Mentions Légales (Article 3.1), un placeholder non résolu : « [Nom de l'hébergeur et
   adresse de son siège social à compléter dès sélection définitive du prestataire d'hébergement de
   production.] ».

Publier ce texte tel quel aurait affiché, sur des pages présentées comme en vigueur, une mention
explicite de non-validation et un placeholder de brouillon — contradictoire et potentiellement
trompeur. Plutôt que de trancher unilatéralement (une modification de substance juridique n'est pas
une décision technique), la question a été posée explicitement à l'utilisateur, qui a choisi de faire
nettoyer ces deux artefacts précis, **sans toucher au reste du contenu juridique** — en particulier les
autres mentions de type « fait l'objet d'un examen juridique préalable à toute publication » (Politique
de Confidentialité, Articles 5.1 et 8) ou « recommandé avant la mise en production » (CGU Article 18,
Confidentialité Article 1) sont des engagements/notes substantiels du rédacteur, pas des artefacts
mécaniques, et ont donc été **laissés intacts**, conformément au périmètre validé par l'utilisateur.

Édité directement dans les `.docx` sources (via `python-docx`, en modifiant les paragraphes/runs
concernés puis en sauvegardant), pas seulement dans le texte extrait pour le web — pour que l'archive
`docs/legal/` elle-même reflète la version réellement finalisée, sans laisser les deux fichiers
diverger. Vérifié après coup : les deux chaînes ("avocat inscrit au Barreau", "[Nom de l") sont bien
absentes des 3 documents, nombre de paragraphes/tableaux cohérent (une ligne de moins par document,
correspondant exactement à la suppression du paragraphe "avocat").

### Méthode d'extraction et de conversion en pages web

Les `.docx` sont des archives ZIP contenant du XML (`word/document.xml`). Plutôt que de retaper
manuellement des milliers de mots (source d'erreurs de transcription sur un contenu juridique), le
contenu a été extrait programmatiquement via `python-docx` (`uv run --with python-docx`), en parcourant
`document.element.body` dans l'ordre réel du document pour capturer titres (styles `Heading1`/`Heading2`),
paragraphes, listes à puces (style `ListParagraph`, regroupées), tableaux multi-colonnes, et un type de
bloc supplémentaire découvert en cours d'extraction : des tableaux à **cellule unique** utilisés dans la
Politique de Confidentialité comme encart d'avertissement (un run en gras servant de titre, suivi du
corps en texte normal) — traités comme un bloc `callout` distinct plutôt que comme un tableau à une
seule ligne, pour un rendu visuel cohérent avec leur intention (encadré orange avec icône ⚠️, pas un
tableau vide de sens à une cellule).

Le résultat est émis en TypeScript typé (`src/content/legal/types.ts` : `LegalBlock` = `h1`/`h2`/`p`/
`list`/`table`/`callout`, `LegalMeta` pour le bloc de titre) — un fichier par document
(`mentions-legales.ts`, `cgu.ts`, `confidentialite.ts`), généré une fois par script puis figé dans le
dépôt (pas de génération à la volée au build : le contenu juridique ne doit pas dépendre d'une étape de
build fragile). `src/components/legal/LegalDocument.tsx` est le seul composant de rendu, partagé par les
3 pages plutôt que dupliqué, cohérent avec le design system Klarity (police Sora par défaut, titre de
page en `font-serif`/IBM Plex Serif comme les autres affichages de mise en avant du site, couleurs
`--color-primary`/`--color-texte-muted`/`--color-accent` déjà établies dans `globals.css`).

### Code changé

- **`src/content/legal/{types,mentions-legales,cgu,confidentialite}.ts`** — nouveau, contenu structuré
  extrait des `.docx` finalisés (37 blocs Mentions Légales, 134 CGU, 71 Confidentialité).
- **`src/components/legal/LegalDocument.tsx`** — nouveau, rendu générique (titre/sous-titre/version,
  h1/h2 d'article, paragraphes, listes à puces, tableaux avec en-tête, encarts d'avertissement).
- **`src/app/mentions-legales/page.tsx`, `src/app/cgu/page.tsx`, `src/app/confidentialite/page.tsx`** —
  nouvelles pages publiques, chacune `LandingHeader` + `LegalDocument` + `LandingFooter` (même
  composition que la landing page, §page.tsx racine) — navigation cohérente avec le reste du site
  depuis ces pages (retour à l'accueil via le logo, accès Connexion/Créer un compte, autres liens
  légaux via le footer).
- **`src/components/landing/LandingFooter.tsx`** — retour aux vrais `<Link>` Next.js (navigation
  interne, pas de `download`) vers `/mentions-legales`, `/cgu`, `/confidentialite`, dans les deux
  emplacements du footer (colonne « Légal » et barre de bas de page). État désactivé (`span` grisés,
  « Bientôt disponible ») entièrement retiré.
- `docs/legal/*.docx` : les deux artefacts nettoyés (voir ci-dessus), aucune autre modification de
  fond.

### CDC (`Klarity_Cahier_des_Charges.pdf`) — vérifié, aucune mise à jour nécessaire

Recherché dans les 44 pages toute mention de « Mentions légales », « CGU », « Confidentialité » ou
« avocat » : le CDC référence bien le contenu de ces documents comme source de règles déjà en vigueur
(ex. « La Politique de Confidentialité (Article 9) définit déjà... », §2.9) mais ne décrit nulle part
leur statut de publication (brouillon/finalisé) ni ne mentionne l'ancien lien de téléchargement direct
— rien dans le CDC n'était rendu faux par ce changement. Pas de nouvelle version du CDC nécessaire pour
ce point.

### Vérifié réellement dans le navigateur (local)

- `tsc --noEmit` et `eslint` sur tous les fichiers touchés : **0 erreur**.
- **Les 3 liens du footer sont bien cliquables** (arbre d'accessibilité : rôle `link`, plus `generic`/
  `span` désactivé) — vérifié sur la page d'accueil et sur les pages légales elles-mêmes (navigation
  croisée entre les 3 pages via leur propre footer, sans repasser par l'accueil).
- **Contenu vérifié complet et correct sur les 3 pages** : texte extrait comparé à la lecture du texte
  de page rendue (`get_page_text`) — Mentions Légales (11 articles + tableau des 6 services tiers),
  CGU (19 articles + tableau des 2 plans tarifaires), Politique de Confidentialité (15 articles + 6
  tableaux + 2 encarts d'avertissement) — aucune trace des deux artefacts nettoyés, mise en page des
  tableaux et encarts confirmée visuellement (capture d'écran).
- **`.docx` toujours inaccessibles publiquement** : les 3 URLs `/legal/*.docx` renvoient **404** (aucun
  changement par rapport à l'état sécurisé du §45) ; les 3 nouvelles pages renvoient **200**.

### Nettoyage

Fichiers intermédiaires d'extraction (`*.json`, scripts Python temporaires) supprimés, rien laissé hors
de `docs/legal/` (originaux corrigés) et `src/content/legal/` (sortie finale figée dans le dépôt).

## 47. Politique de Confidentialité — Article 8 (Transferts internationaux de données) supprimé (13 septembre 2026)

Demande explicite de l'utilisateur : supprimer complètement l'Article 8 (« TRANSFERTS INTERNATIONAUX
DE DONNÉES ») de `docs/legal/Klarity_Politique_Confidentialite.docx` — le titre, ses 2 paragraphes et
son encart d'avertissement (« Obligation légale prioritaire »).

### Choix : suppression sans renumérotation des articles suivants

Retiré dans le `.docx` source (via `python-docx`) l'intégralité du contenu entre le titre « ARTICLE 8 »
et le titre « ARTICLE 9 » (5 éléments : titre, paragraphe, tableau-encart 1x1, paragraphe, saut de
paragraphe final). Les articles suivants (9 à 15) **n'ont pas été renumérotés** — le document passe
directement de l'Article 7 à l'Article 9. Choix délibéré, pas un oubli : la Politique contient 3
références internes croisées vers « l'Article 12 » (Article 1, Article 5.2, Article 13) qui restent
exactes et n'auraient nécessité aucune correction avec ce choix ; renuméroter aurait au contraire exigé
de corriger ces 3 renvois plus les 6 titres suivants, pour un bénéfice cosmétique seulement — et casser
la stabilité de citation d'un article donné est une pratique déconseillée en rédaction juridique (un
article supprimé conserve généralement son numéro « vacant » plutôt que de décaler tous les suivants).
Si l'utilisateur préfère une renumérotation complète, c'est une action distincte à demander
explicitement.

Vérifié qu'aucune autre mention de l'Article 8 de la Confidentialité n'existe ailleurs : la seule autre
occurrence de la chaîne « Article 8 » dans le corpus légal est **« Article 8 des CGU »** (Politique de
Confidentialité, Article 6.3), qui désigne l'Article 8 d'un **document différent** (CGU — Intelligence
Artificielle : Fonctionnement et Limites) et n'a donc aucun rapport avec l'article supprimé ici ; laissé
intact. Le CDC (`Klarity_Cahier_des_Charges.pdf`) ne mentionne nulle part « transferts internationaux »
— aucune mise à jour nécessaire.

### Code changé

- `docs/legal/Klarity_Politique_Confidentialite.docx` : Article 8 retiré (édition directe via
  `python-docx`, même méthode que le nettoyage des artefacts du §46).
- `src/content/legal/confidentialite.ts` régénéré depuis le `.docx` mis à jour : 71 → **67 blocs**
  (perte exacte des 4 blocs de l'ancien Article 8 : `h1`, `p`, `callout`, `p`). `mentions-legales.ts`
  et `cgu.ts` régénérés à l'identique en parallèle (aucun changement, les `.docx` correspondants n'ont
  pas été touchés) — vérifié par comparaison du nombre de blocs (37 et 134, inchangés).

### Vérifié

- `tsc --noEmit` et `eslint` sur `confidentialite.ts` : **0 erreur**.
- Page `/confidentialite` rechargée en local : le texte affiché passe directement de « ARTICLE 7 —
  DESTINATAIRES ET SOUS-TRAITANTS » à « ARTICLE 9 — DURÉE DE CONSERVATION », aucune trace de l'ancien
  Article 8 ni de son encart « Obligation légale prioritaire » — confirmé par lecture complète du texte
  de la page rendue, pas seulement du code source.

## 48. Icône de navigateur (favicon) — d'une image fournie à une reproduction vectorielle exacte du logo (13 septembre 2026)

Chronologiquement entre §45 et §46 (même journée), sur demande de l'utilisateur. Deux itérations
successives, la seconde remplaçant entièrement la première.

### Itération 1 — image fournie par l'utilisateur (commit `9d8a68d`)

L'utilisateur a fourni une image (chapeau de graduation blanc sur fond vert, cohérente avec
`IconGraduationCap` déjà utilisée dans le header/footer) à utiliser comme icône de navigateur. Source
non carrée (1286×1223) recadrée au carré (1223×1223 — le contenu occupait déjà tout le cadre, les coins
blancs visibles n'étant que les angles arrondis de l'icône elle-même, pas une marge), réduite à 256×256
et quantifiée à 64 couleurs sans dithering (4 Ko au lieu de 206 Ko en RGB plein, aucune perte visible
constatée). Placée en `src/app/icon.png` — convention App Router de Next.js, détectée automatiquement
sans toucher au code ni aux métadonnées de `layout.tsx`. Vérifié : balise `<link rel="icon">` générée
automatiquement, asset servi 200 avec le bon contenu.

### Itération 2 — remplacement par une reproduction vectorielle exacte du logo réel (commit `6651546`)

L'utilisateur a ensuite demandé de remplacer cette image (une approximation visuelle générée par IA) par
une reproduction **à l'identique** du vrai logo affiché dans la navbar de la landing page, en utilisant
les éléments réels du code plutôt qu'une image. Construit à partir des valeurs exactes du design system,
pas estimées :
- carré 32×32, coins arrondis à 8px (`rounded-lg`), fond `#0e6b57` — lu directement dans
  `src/app/globals.css` (`--color-primary`), la même valeur que `LandingHeader.tsx`, `KlarityLogo.tsx`,
  `LandingFooter.tsx` et `abonnement/layout.tsx` utilisent tous pour ce badge ;
- glyphe `GraduationCap` de `@phosphor-icons/react`, variante `"fill"` — path SVG copié tel quel depuis
  `node_modules/@phosphor-icons/react/dist/defs/GraduationCap.es.js` (viewBox 256×256 d'origine), mis à
  l'échelle à 20px et centré dans le badge de 32px — exactement la même proportion que le composant React
  (`h-5 w-5` dans un badge `h-8 w-8`).

`src/app/icon.svg` (nouveau) remplace `src/app/icon.png` (supprimé) — même convention Next.js, détectée
automatiquement. SVG plutôt que PNG : fidélité vectorielle exacte (aucune perte de recadrage/compression
contrairement à l'itération 1) et 714 octets au lieu de 4 Ko.

### Vérifié

- Itération 1 : `tsc --noEmit` sans erreur ; `<link rel="icon" type="image/png" sizes="256x256">` généré,
  asset servi 200, comparé pixel à pixel à la source recadrée.
- Itération 2 : `<link rel="icon" type="image/svg+xml">` généré automatiquement (l'ancien lien PNG
  disparaît) ; asset SVG servi 200 avec le contenu exact ; **capture d'écran de l'icône rendue comparée
  directement à une capture zoomée du badge réel de la navbar sur `/`** — identiques (même vert, mêmes
  coins arrondis, même glyphe, mêmes proportions).

## 49. Découvrabilité : sitemap, robots.txt et llms.txt (13 septembre 2026)

Demande explicite de l'utilisateur : ajouter un sitemap pour aider Google à indexer les pages
publiques, un `llms.txt` décrivant Klarity pour les agents IA/LLMs, et vérifier la cohérence d'un
`robots.txt`. Aucun des trois n'existait auparavant.

### Sitemap et robots.txt — génération native Next.js, pas de fichiers statiques

`src/app/sitemap.ts` (`MetadataRoute.Sitemap`) et `src/app/robots.ts` (`MetadataRoute.Robots`) plutôt
que des fichiers `public/sitemap.xml` / `public/robots.txt` manuels — demande explicite de
l'utilisateur pour le sitemap (rester à jour automatiquement si de nouvelles pages publiques sont
ajoutées), étendu au robots.txt par cohérence (les deux partagent la même liste de préfixes
authentifiés à exclure, un seul fichier statique aurait pu diverger du second).

Sitemap limité aux 7 pages publiques listées explicitement par l'utilisateur : `/`, `/inscription`,
`/abonnement`, `/connexion`, `/mentions-legales`, `/cgu`, `/confidentialite`. Volontairement exclues
les sous-routes du tunnel d'abonnement (`/abonnement/eleve-ou-parent`, `/abonnement/paiement`) — ce
sont des étapes d'un parcours, pas des pages de destination pertinentes pour l'indexation — ainsi que,
bien sûr, tout ce sous `/eleve`, `/parent`, `/admin` (gate de rôle appliqué par `middleware.ts`,
`docs/reference/Klarity_Securite_Reference.md`) et `/api`.

`robots.ts` autorise `/` et interdit explicitement `/admin`, `/eleve`, `/parent`, `/api` — les mêmes
préfixes que `middleware.ts` gate côté serveur. Volontairement **pas** de mention spécifique de
`/admin/connexion` (point d'entrée admin non lié depuis l'UI, voir `middleware.ts`) : un `robots.txt`
est un fichier public en clair, y lister ce chemin précis l'aurait rendu découvrable — `Disallow:
/admin` suffit à couvrir tout le sous-arbre sans révéler l'existence de cette route particulière.

`src/lib/site-url.ts` (nouveau) centralise l'URL absolue du site, partagée par les deux fichiers pour
éviter toute divergence : `NEXT_PUBLIC_SITE_URL` (override optionnel) sinon
`VERCEL_PROJECT_PRODUCTION_URL` (injecté automatiquement par Vercel, stable contrairement à
`VERCEL_URL` qui varie par déploiement de preview — donc aucune variable à configurer manuellement en
production) sinon un repli en dur sur `https://klarity-sand.vercel.app` (le domaine de production
réel, identifié dans les entrées précédentes de ce journal sur l'incident de build Vercel).

### llms.txt — fichier statique

`public/llms.txt` (donc servi tel quel en `/llms.txt`, pas de génération) : nom, description courte,
public cible (élèves camerounais 3ème/Première/Terminale, filières A/C/D/TI), fonctionnalités
principales (tuteur IA, banque d'épreuves, correction automatique, quiz personnalisés,
recommandations vidéo, suivi parental), lien vers la landing page. Contenu factuel et concis — le
standard `llms.txt` (llmstxt.org) est encore expérimental et non universellement adopté par les
crawlers IA, pas d'investissement disproportionné.

### Code changé

- `src/lib/site-url.ts` — nouveau.
- `src/app/sitemap.ts` — nouveau.
- `src/app/robots.ts` — nouveau.
- `public/llms.txt` — nouveau.

### Vérifié réellement en local (conteneur `app` Docker Compose, `docker compose exec app ...`)

- `npx tsc --noEmit` et `npx eslint` sur les 3 fichiers TypeScript : **0 erreur**.
- `curl -s -o /dev/null -w '%{http_code} %{content_type}' http://localhost:3000/sitemap.xml` →
  **200, `application/xml`**, contenu vérifié : exactement les 7 URLs attendues, chacune préfixée par
  `https://klarity-sand.vercel.app` (résolu via le repli en dur de `site-url.ts`, confirmé qu'aucune
  variable `VERCEL_PROJECT_PRODUCTION_URL` n'est présente dans ce conteneur de dev local — comportement
  attendu).
- `curl .../robots.txt` → **200, `text/plain`**, contenu vérifié : `Allow: /`, les 4 `Disallow`
  attendus (`/admin`, `/eleve`, `/parent`, `/api`), ligne `Sitemap:` pointant vers la même URL absolue
  que ci-dessus.
- `curl .../llms.txt` → **200, `text/plain; charset=UTF-8`**, contenu affiché intégralement et
  comparé au fichier source — identique.

### Nettoyage

Aucun fichier intermédiaire laissé hors des 4 fichiers de code listés ci-dessus.

## 50. Remplacement d'Africa's Talking par SmsPro comme fournisseur SMS (14 septembre 2026)

Demande explicite de l'utilisateur : SmsPro couvre les 3 opérateurs camerounais (MTN, Orange, Camtel),
propose un paiement local en Mobile Money, et évite le souci de livraison MTN identifié pour d'autres
fournisseurs (cf. §Partie précédente sur Africa's Talking). Contrairement au remplacement CamerPay →
NotchPay (§précédent, code déjà écrit contre du vide), Africa's Talking était réellement implémenté et
vérifié en sandbox — ce remplacement retire du code fonctionnel, pas un stub.

### Documentation API — trouvée publique, pas seulement dans le compte utilisateur

L'utilisateur a orienté vers « section API & Docs » de son compte `v2.smspro.cm`. Plutôt que deviner un
contrat REST sans source fiable (risque explicitement évité ici, contrairement à AfricasTalkingProvider
qui avait le code source du SDK officiel comme référence), le Hub Développeur du compte (`/developer`,
onglet Documentation) a été consulté en navigateur (session déjà authentifiée de l'utilisateur) : il
pointe vers `https://v2.smspro.cm/docs/api`, explicitement décrite dans l'UI comme « une page publique,
partageable avec qui intègre l'API pour vous » — confirmé réellement public en y accédant **sans**
cookie de session (`GET /api/v1/balance` sans session ni clé API a répondu `401 {"error":"Unauthorized",
"message":"Token invalide ou révoqué"}`, pas une redirection de login web — l'API et la session web sont
deux systèmes d'auth distincts, cohérent avec la doc).

Contrat extrait de cette page (pas deviné) :
- Base URL `https://v2.smspro.cm`, endpoint d'envoi `POST /api/v1/messages`, corps JSON
  `{ to, message, from }` (`from` = Sender ID déjà déclaré sur le compte).
- Auth : header `Authorization: Bearer <clé>` (méthode recommandée ; alternative `?api_key=` réservée
  aux connecteurs tiers sans en-tête personnalisable — non utilisée ici).
- Succès : HTTP 201, sans attente de livraison (statut réel suivi via `GET /api/v1/messages/:id` ou
  webhook — hors scope actuel, aucun job ne consomme ces événements).
- Erreurs : JSON `{ error, message }`, codes 400/401/402/404/422/429 documentés.
- Note de doc explicite : un Sender ID « OTP » doit être déclaré comme tel (distinct d'un Sender ID
  « Marketing ») pour un acheminement correct par les opérateurs — d'où `SMSPRO_SENDER_ID_OTP`,
  optionnel, replié sur `SMSPRO_SENDER_ID` si l'utilisateur n'a pas (encore) enregistré de second
  Sender ID dédié.

**Lacune identifiée dans la doc elle-même** : aucun exemple de corps de réponse en cas de succès
(seulement le code HTTP 201) — donc le nom exact du champ identifiant de message est inconnu.
`SmsProProvider.extraireMessageId` essaie plusieurs noms plausibles (`id`, `messageId`, `message_id`,
`uuid`) et retombe sur une chaîne vide sinon, sans jamais faire échouer l'envoi pour ça — ce champ n'est
que de la métadonnée de suivi, jamais utilisé pour décider `ENVOYE`/`ECHEC` (déterminé uniquement par
le code HTTP, comme pour Africa's Talking). Signalé explicitement à l'utilisateur comme un point que
seul un envoi réel peut confirmer à 100%.

### Constat opérationnel signalé à l'utilisateur (hors code)

Au moment de consulter le Hub Développeur, le tableau de bord du compte affiche : « Votre demande de
Sender ID "Klarity" n'est pas encore signée — elle ne peut pas être transmise aux opérateurs tant que ce
n'est pas fait. » Tant que ce Sender ID n'est ni signé ni transmis, tout envoi réel échouera
vraisemblablement (`404`, « Sender ID introuvable ou rejeté », selon la doc). Ce n'est pas un défaut du
code — c'est une étape administrative côté compte SmsPro, à finaliser par l'utilisateur avant tout test
d'envoi réel.

### Code changé

- `src/lib/sms/smspro-provider.ts` — nouveau, remplace `africastalking-provider.ts` (supprimé).
- `src/lib/sms/index.ts` : `SMS_MODE = mock | smspro` (au lieu de `africastalking`), sélectionne
  `SmsProProvider`.
- `src/lib/sms/provider.ts`, `src/lib/sms/types.ts`, `src/lib/auth/otp.ts`,
  `src/app/api/auth/parent/request-otp/route.ts` : commentaires mis à jour (mentions Africa's Talking
  remplacées, historique conservé en une phrase renvoyant à cette entrée).
- `.env.example` : `AFRICASTALKING_USERNAME`/`AFRICASTALKING_API_KEY` retirées ; ajout de
  `SMSPRO_API_KEY`, `SMSPRO_SENDER_ID`, `SMSPRO_SENDER_ID_OTP` (noms exacts communiqués à l'utilisateur
  pour configurer son `.env` réel). `SMS_MODE` reste `mock` par défaut — **pas** basculé en `smspro`,
  conformément à la demande explicite de l'utilisateur (attend sa confirmation après un test concluant).

### CDC (`Klarity_Cahier_des_Charges.pdf`) et docs de référence — vérifiés, aucune mise à jour nécessaire

Recherché « talking », « orange sms », « smspro », « fournisseur sms » dans les 44 pages du CDC et dans
`docs/reference/*.txt` : aucune des deux n'a jamais nommé de fournisseur SMS précis (le CDC ne parle que
d'« un fournisseur SMS » en général, §5.5.2) — rien n'est rendu faux par ce remplacement, comme pour le
remplacement Orange SMS Cameroun → Africa's Talking déjà fait sans bump CDC.

### Vérifié réellement, sans dépenser de crédit SMS réel

- `npx tsc --noEmit` et `npx eslint` sur tous les fichiers touchés : **0 erreur**.
- **Garde-fou de configuration** : `SmsProProvider` instancié sans `SMSPRO_API_KEY` dans l'environnement
  → lève immédiatement `Configuration SmsPro incomplète : SMSPRO_API_KEY manquante`, sans requête réseau.
- **Format de requête et gestion d'erreur, contre la vraie API SmsPro** : `SmsProProvider` instancié
  avec une fausse clé (`smspro_fake_test_key_12345`) et un faux Sender ID, `envoyerOtp()` appelé pour de
  vrai contre `https://v2.smspro.cm/api/v1/messages` — rejeté par l'API réelle en `401` (auth vérifiée
  avant tout envoi, donc **zéro crédit consommé**), erreur capturée exactement comme prévu :
  `SmsEnvoiError: Échec d'envoi SmsPro (OTP, HTTP 401) : Token invalide ou révoqué` — confirme que le
  corps JSON (`{to, message, from}`), l'en-tête `Authorization: Bearer`, l'URL d'endpoint, et le parsing
  du corps d'erreur `{error, message}` sont tous corrects contre le vrai serveur.

### Ce qui nécessiterait un envoi réel pour être confirmé à 100% (signalé à l'utilisateur)

1. Le nom exact du champ identifiant de message dans la réponse `201` de succès (non documenté,
   `extraireMessageId` gère plusieurs noms plausibles en repli).
2. La livraison effective à un vrai téléphone (le `201` documenté confirme seulement l'acceptation pour
   envoi, pas la livraison) — d'autant plus incertaine tant que le Sender ID « Klarity » n'est pas signé
   côté compte SmsPro (voir constat opérationnel ci-dessus).
3. Le comportement réel de `SMSPRO_SENDER_ID_OTP` vs `SMSPRO_SENDER_ID` une fois un second Sender ID
   « OTP » effectivement déclaré (l'utilisateur n'en a aujourd'hui qu'un seul, générique).

### Nettoyage

Script de vérification ad hoc (`scratch-test-smspro.ts`, à la racine, jamais suivi par git) supprimé
après usage.

## 51. Audit de la base de données Vercel — vide, mal câblée, déploiement jugé temporaire (14 septembre 2026)

Demande de l'utilisateur : vérifier si la base de données du déploiement Vercel (`klarity-sand.vercel.app`)
a la même structure que la base locale (migrations appliquées) et si elle contient des données, sans
rien modifier — juste un état des lieux en langage simple.

### Constat, vérifié réellement (lecture seule, rien modifié)

Consulté le tableau de bord Vercel du projet (`cowen-saas/klarity`) en navigateur (session déjà
authentifiée de l'utilisateur) :

- **`DATABASE_URL`** (la variable que l'app lit réellement — `prisma/schema.prisma:13`,
  `url = env("DATABASE_URL")`) contient une valeur factice jamais remplacée :
  `postgres://user:pass@db.example.com:5432/app` — une adresse qui n'existe nulle part. Aucune requête
  de l'app vers cette adresse ne peut donc jamais aboutir.
- Une vraie base **existe** pourtant bien : l'intégration Vercel Marketplace « Prisma » est installée sur
  le projet et a provisionné une base Prisma Postgres réelle (`prisma-postgres-green-mirror`, plan
  gratuit, statut *Available*). Sa vraie chaîne de connexion a été injectée automatiquement par cette
  intégration — mais comme une variable `DATABASE_URL` existait déjà (la factice ci-dessus), Vercel l'a
  nommée avec un préfixe pour éviter l'écrasement : `KLARITY_DATABASE_URL` /
  `KLARITY_PRISMA_DATABASE_URL` / `KLARITY_POSTGRES_URL` (marquées « Needs Attention » dans le tableau de
  bord, ce qui correspond exactement à ce non-branchement). L'app ne lit jamais ces trois noms-là.
- Confirmé via la console SQL intégrée de Vercel/Prisma (lecture seule, aucune écriture) sur cette vraie
  base : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` → **0
  résultat**. La base est saine et joignable, mais strictement vide — aucune des 6 migrations locales
  n'y a jamais été appliquée, puisque rien ne pointe dessus.

### Décision de l'utilisateur : ne rien corriger maintenant

Ce déploiement Vercel est explicitement temporaire — son seul rôle actuel est de fournir une adresse web
publique à montrer à NotchPay (validation de compte marchand), pas de servir de vraie production. Un
véritable déploiement, avec une base de données correctement câblée dès le départ, sera fait plus tard,
une fois NotchPay validé et le projet prêt pour un vrai lancement.

**Point à traiter plus tard**, avant tout vrai lancement — deux étapes, sans avoir besoin de copier les
données de test locales :
1. Remplacer le contenu de `DATABASE_URL` sur Vercel par la vraie chaîne de connexion actuellement sous
   `KLARITY_DATABASE_URL`.
2. Lancer une fois `prisma migrate deploy` contre cette base pour lui donner la bonne structure de
   tables (vide, mais avec la bonne forme — pas un import de données).

Aucun fichier du dépôt modifié dans cette entrée — audit en lecture seule uniquement.

## 52. Chantier IA réelle — plan en 7 passes, et champ `Epreuve.typeExercice` (14 septembre 2026)

L'utilisateur a configuré sa vraie clé `ANTHROPIC_API_KEY` et demandé de débloquer tout ce qui dépendait
de l'IA réelle : `ClaudeAIProvider`, pipeline de correction complet, lacunes, quiz quotidien, chat mode 2,
écrans parent (progression/notes/lacunes/export PDF), vérification `UsageIA` réelle, audit IDOR. Vu
l'ampleur, découpage proposé et validé par l'utilisateur en 7 passes indépendantes, chacune testée et
commitée séparément :

1. `ClaudeAIProvider` (Haiku chat/quiz, Sonnet vision correction) + bascule `AI_MODE=live`.
2. Pipeline de correction complet (upload multi-pages, résultat, job worker async, `CorrectionDetail`/
   `Lacune`, règle une seule correction par tentative).
3. Écran « Mes lacunes » élève.
4. Quiz quotidien + job BullMQ.
5. Chat mode 2 (contextualisé à une épreuve).
6. Écrans parent (Progression avec vraies données, Notes, Lacunes — ces deux derniers sans maquette
   dédiée) + export PDF du rapport mensuel.
7. Audit final IDOR + vérification `UsageIA` de bout en bout.

### Décision de conception validée par l'utilisateur : `Epreuve.typeExercice` (champ dédié, pas de déduction IA)

Proposition initiale (laisser Sonnet déduire le type d'exercice depuis l'énoncé, en injectant tous les
`ExempleCorrection` de la matière comme few-shot) **rejetée par l'utilisateur** : le type d'exercice
détermine le barème appliqué donc la note de l'élève — une déduction IA pourrait se tromper
silencieusement. Décision retenue : champ dédié `Epreuve.typeExercice`, saisi explicitement par l'admin
à l'ajout de l'épreuve, jamais déduit.

- **`prisma/schema.prisma`** : `Epreuve.typeExercice TypeExerciceCorrection?` (nullable — NULL pour les
  matières scientifiques, où le pipeline utilisera uniquement `corrigeReferenceKey`). Migration
  `20260914181109_add_type_exercice_epreuve` (simple `ALTER TABLE ... ADD COLUMN`, aucune donnée
  existante à migrer — la banque d'épreuves est vide à ce stade).
- **`src/lib/epreuves/type-exercice.ts`** (nouveau) : `typesExerciceValides(matiereNom, classe)` —
  source unique de vérité pour le sous-ensemble valide, partagée entre le formulaire client
  (`EpreuveManager.tsx`) et les deux routes serveur (aucune duplication de la règle). Philosophie →
  `DISSERTATION_PHILO` uniquement ; Français → `EXPRESSION_ECRITE`/`CORRECTION_ORTHOGRAPHIQUE` en 3ème,
  les 4 types méthodologiques partagés en 1ère/Terminale ; toute autre matière → `null` (non applicable).
- **`src/app/api/admin/epreuves/route.ts` et `[id]/route.ts`** : `typeExercice` ajouté au schéma Zod,
  requis et restreint au sous-ensemble valide pour Français/Philosophie, **toujours forcé à `null`**
  pour les autres matières — jamais de confiance dans la valeur envoyée par le client, la matière/classe
  effective côté serveur fait foi. Sur `PATCH`, la matière est désormais toujours relue (pas seulement
  si `matiereId` change) car la classe seule peut invalider la sélection (ex. Français 3ème → 1ère).
- **`EpreuveManager.tsx`** : champ `<select>` conditionnel, affiché uniquement pour Français/Philosophie,
  options filtrées par classe, réinitialisé automatiquement si la sélection matière/classe le rend
  invalide, requis pour activer le bouton de soumission.
- **`admin/(protected)/epreuves/page.tsx`** : `typeExercice` ajouté à la sélection Prisma transmise au
  composant.

### Vérifié réellement (pas seulement `tsc`)

- `tsc --noEmit` et `eslint` sur les 5 fichiers touchés : **0 erreur**.
- Migration appliquée en base locale (`prisma migrate dev`), colonne `epreuves.typeExercice` confirmée.
- **Test HTTP de bout en bout contre le vrai serveur** (admin de test jetable créé + connecté via le
  vrai flux NextAuth `callback/admin` avec TOTP généré par `otplib`, comme `verifyTotp` le vérifie ;
  admin et épreuves de test supprimés à la fin via les vraies routes `DELETE`) :
  - Français sans `typeExercice` → **400**, message listant les 4 valeurs attendues.
  - Français avec un `typeExercice` invalide pour la classe (`EXPRESSION_ECRITE` sur une Terminale,
    valide seulement en 3ème) → **400**.
  - Français avec un `typeExercice` valide (`COMMENTAIRE_COMPOSE`) → **201**, valeur relue en base
    conforme.
  - Mathématiques avec un `typeExercice` fourni quand même → **201**, mais valeur relue en base = `null`
    (forcée serveur, confirmé qu'aucune valeur cliente n'est jamais faite confiance pour une matière
    scientifique).

### Nettoyage

Script de test ad hoc (`scratch-test-type-exercice.ts`, racine, jamais suivi par git) supprimé après
usage ; les 2 comptes admin jetables créés pendant les essais (dont un resté après un premier essai en
échec sur un mauvais nom de cookie CSRF) supprimés de la base.

## 53. Passe 1 — `ClaudeAIProvider` réel, `AI_MODE=live` (14-15 septembre 2026)

Première des 7 passes du chantier IA réelle (§52). Implémente les 3 méthodes de `ClaudeAIProvider`
(`@anthropic-ai/sdk`, nouvelle dépendance) et bascule `AI_MODE=live` une fois les trois vérifiées
réellement, comme demandé.

### `src/lib/ai/claude-provider.ts` (nouveau)

- **Modèles** : `MODELE_HAIKU = "claude-haiku-4-5-20251001"`, `MODELE_SONNET = "claude-sonnet-5"`
  (constantes exportées, réutilisées par la route de chat existante à la place de l'ancien littéral
  codé en dur `"claude-haiku-4-5"`).
- **`chat()`** → Haiku, texte libre. Le programme officiel (`contexteMatiere`) est injecté dans le
  system prompt ; en mode 2 (`contexteEpreuve` fourni), l'énoncé/corrigé sont ajoutés comme contexte
  de lecture seule avec une consigne explicite : ne jamais attribuer de note ni reproduire une
  correction (cf. règle CLAUDE.md sur la séparation stricte chat/correction).
- **`genererQuiz()`** → Haiku, sortie structurée forcée via **tool use** (`soumettre_quiz`, schéma
  JSON avec 4 choix par question) plutôt qu'un parsing de texte libre — beaucoup plus fiable.
- **`corrigerCopie()`** → Sonnet + vision. `imageKeys` sont lus directement depuis `StorageProvider`
  (nouvelle méthode `lire()`, voir plus bas), encodés en blocs `image` base64 dans l'ordre des pages.
  `bareme: BaremeCorrection` (nouveau type, remplace `unknown`) distingue explicitement deux sources :
  `exemple_correction` (barème JSON injecté en texte, Français/Philosophie) et `corrige_reference`
  (le PDF `Epreuve.corrigeReferenceKey`, lu et joint comme bloc `document` — matières scientifiques).
  Sortie structurée forcée via tool use (`soumettre_correction`). **Garde-fou anti-injection explicite
  dans le system prompt** (règle CLAUDE.md, §prompt injection) : le contenu photographié est
  systématiquement traité comme une réponse à évaluer, jamais comme une instruction — consigne
  explicite d'ignorer toute tentative de manipulation qui y apparaîtrait.
- Retry avec backoff sur 429 : géré nativement par le SDK officiel (`maxRetries`, défaut 2) — pas de
  code applicatif à écrire, seule l'erreur finale est traduite en `AIRateLimitError` (contrat déjà
  attendu par les appelants, cf. `MockAIProvider`).

### `StorageProvider.lire()` (nouvelle méthode d'interface)

Lecture directe des octets (jamais exposée au client, contrairement à `obtenirUrlSignee`) — nécessaire
pour transmettre les images/PDF à la vision Claude sans repasser par une URL signée HTTP interne.
Implémentée dans `MockStorageProvider` (lecture disque + déduction du type MIME depuis l'extension) et
`R2StorageProvider` (`GetObjectCommand`, `ContentType` renvoyé par S3).

### `AIProvider.corrigerCopie()` — signature resserrée

`bareme: unknown` → `bareme: BaremeCorrection` (nouveau type dans `src/lib/ai/types.ts`) : oblige tout
appelant futur (Passe 2) à choisir explicitement entre les deux sources plutôt que de passer une valeur
non typée. `MockAIProvider` mis à jour en conséquence (signature seulement, comportement inchangé).

### `src/lib/ai/index.ts`

`AI_MODE=live` instancie désormais `ClaudeAIProvider` au lieu de lever une erreur "pas encore
implémenté".

### Constat en cours de route : R2 et NotchPay déjà configurés en local

En testant `corrigerCopie()`, l'upload de test a été journalisé `[STORAGE R2]` et non `[STORAGE MOCK]` —
`STORAGE_MODE=r2` avec des identifiants R2 réels est maintenant configuré dans le `.env` local (alors
que les entrées précédentes de ce journal indiquaient les clés R2 « pas encore obtenues »). Confirmé
fonctionnel par un aller-retour upload/lecture/suppression réel pendant le test. Simple constat, aucune
action requise ici — pertinent pour la Passe 2 (les copies photographiées iront réellement sur R2).

### Vérifié réellement (pas seulement `tsc`), coût réel affiché

- `tsc --noEmit` et `eslint` sur tous les fichiers touchés : **0 erreur**.
- **`chat()` réel (appel direct à la classe, hors route)** : question sur les dérivées, réponse Haiku
  cohérente et pédagogique, 161 tokens in / 96 out, coût réel ≈ **$0.000641**.
- **`genererQuiz()` réel** : 2 lacunes de test → 2 questions à choix multiples bien formées (4 choix
  chacune, bonne réponse cohérente, `lacuneId` correctement reporté) — coût marginal (non mesuré
  individuellement, l'interface `AIProvider.genererQuiz` ne renvoie pas de tokens).
- **`corrigerCopie()` — vérification format de requête + authentification, sans dépenser de tokens de
  vision** (le vrai test avec une vraie copie est réservé à la Passe 2, décision actée avec
  l'utilisateur) : image de test uploadée sur le vrai stockage R2, appel réel avec une clé API invalide
  → rejeté par l'API Anthropic réelle en `AuthenticationError` (`401`, "API key is invalid"), confirmant
  que la construction de la requête (lecture storage, encodage base64, structure des blocs image, appel
  réseau) est correcte jusqu'à l'authentification — fichier de test nettoyé du bucket après coup.
- **Bascule `AI_MODE=live` et test de bout en bout via la vraie route de chat** (après avoir découvert
  qu'un simple `docker compose restart` ne relit PAS le `.env` modifié — seul `--force-recreate`
  applique la nouvelle valeur, contrairement à `restart` qui réutilise l'environnement figé à la
  création du conteneur ; corrigé en recréant `app`/`worker`) : élève de test créé par la vraie route
  d'inscription publique, connecté via le vrai flux NextAuth `callback/eleve`, conversation + message
  créés via les vraies routes API. Réponse Haiku réelle reçue (plus la réponse `[MOCK]` de
  l'itération précédente) — Claude a correctement identifié que le théorème de Pythagore n'est pas au
  programme officiel de Terminale transmis en contexte, signe que l'injection du programme fonctionne.
  **Ligne `UsageIA` réelle confirmée en base** : `{typeUsage: "CHAT", modele: "HAIKU", tokensInput: 1674,
  tokensOutput: 253, coutEstime: "0.002939"}` — tokens et coût réels, pas simulés.

**Coût réel total consommé pendant les tests de cette passe : environ $0.0036** (chat direct + chat via
la vraie route ; `genererQuiz` et le test d'authentification de `corrigerCopie` n'ont rien facturé côté
vision).

### Nettoyage

Élève de test, conversation, messages et ligne `UsageIA` supprimés après chaque test (via les vraies
routes API quand possible). Fichier de test uploadé sur R2 supprimé. Scripts de test ad hoc
(`scratch-test-*.ts`, racine, jamais suivis par git) supprimés après usage.

### Suite

Passe 2 (pipeline de correction complet) peut commencer : écran upload, job worker asynchrone,
`CorrectionDetail`/`Lacune`, test réel avec une vraie copie (premier vrai appel Sonnet vision facturé).

## 54. Passe 2 — Pipeline de correction complet, testé avec un vrai appel Sonnet vision (15 septembre 2026)

Deuxième passe du chantier IA réelle (§52/§53). Construit de bout en bout ce qui n'existait pas encore
dans le code : upload de copie, traitement asynchrone (worker), écran de résultat, signalement.

### Écran d'upload + analyse (maquette 07)

`src/components/eleve/UploadCopie.tsx` — les deux panneaux de la maquette (formulaire / analyse en
cours) sont deux **états successifs** d'un même composant, pas deux panneaux affichés ensemble (la
maquette les montre côte à côte à des fins de documentation uniquement). Deux entrées de fichier
séparées (`capture="environment"` pour l'appareil photo direct, sans pour l'import galerie) plutôt
qu'une seule, pour reproduire fidèlement les deux affordances distinctes du maquette ("Photographier
ma copie" / "ou importer depuis la galerie") sans dépendre du comportement variable des navigateurs
mobiles face à l'attribut `capture` seul. Sondage du statut toutes les 2s (même pattern que
`VerificationPoll.tsx`, écran 17) ; la checklist à 3 lignes ("Lecture des pages" / "Reconnaissance des
réponses" / "Comparaison au corrigé...") est purement cosmétique — le backend n'expose qu'un statut
global, pas de sous-étapes réelles, précisé en commentaire dans le code pour que ça ne soit pas pris
pour une télémétrie fine qui n'existe pas.

### Écran de résultat détaillé (maquette 08) — écart de fidélité signalé explicitement

**La maquette montre un découpage question-par-question** ("Question 4", "Ta réponse : f'(x)=3x+2",
"Réponse correcte : f'(x)=3x²+2", buckets Réussies/Partielles/Incorrectes) qui **n'existe pas dans le
modèle de données réel** : `CorrectionDetail` stocke `pointsForts: string[]` et
`pointsManques: {notion, detail}[]` — une correction à barème global/rédigée, pas un tableau de
questions à réponse unique numérotées. Ce découpage colle bien à un exercice de maths à sous-questions
mais pas à une dissertation ou un commentaire composé (aucune "réponse correcte" pour un essai).
Plutôt que d'ajouter un modèle de données par sous-question (effort disproportionné, et le schéma
Prisma est traité comme source de vérité, pas un brouillon à redessiner, cf. CLAUDE.md), l'écran a été
**adapté** : 2 buckets au lieu de 3 (Points forts / Points à travailler, comptés depuis
`pointsForts.length` / `pointsManques.length`), et chaque point manqué est affiché comme
notion + explication (pas de paire "ta réponse / réponse correcte" littérale, cette donnée n'existe
pas). Le reste (badge de note circulaire, "Recommencer l'épreuve", modale "Signaler cette correction")
reproduit la maquette fidèlement, y compris les 3 motifs exacts de `MotifSignalement`.

### Route d'upload — le déclenchement du traitement n'est **pas** gaté sur `numeroTentative === 1`

Décision technique prise pendant la construction, documentée ici pour transparence : le schéma dit
"seule la tentative n°1 déclenche un appel Sonnet réel", mais gater littéralement sur ce numéro aurait
un effet pervers — si la 1ère tentative échoue techniquement (429, erreur réseau), aucune
`CorrectionDetail` n'est créée, et l'élève ne pourrait alors **plus jamais** être noté sur cette épreuve
(les tentatives suivantes, numérotées 2+, ne déclencheraient jamais de traitement). Le déclenchement est
donc basé sur l'**absence** de `CorrectionDetail` existante et d'une tentative déjà en attente/en
traitement, pas sur le numéro brut — la contrainte `@@unique([epreuveId, eleveId])` sur
`CorrectionDetail` reste le garde-fou définitif contre toute double correction, donc l'intention réelle
de la règle (ne jamais payer deux fois pour re-corriger une même copie) est entièrement respectée.
`numeroTentative` reste incrémenté normalement pour la traçabilité (nombre de tentatives d'entraînement).

### Code changé

- `src/lib/queue/correction.ts`, `src/lib/correction/traiter-tentative.ts` (nouveaux) — file BullMQ +
  logique de traitement (résolution du barème via `Epreuve.typeExercice` ou `corrigeReferenceKey`,
  appel `corrigerCopie()`, création `CorrectionDetail`/`Lacune` en transaction, `UsageIA` réelle).
- `src/worker/index.ts` — worker `correction` câblé, aux côtés de `retention`/`paiement-mock-webhook`.
- `src/app/api/eleve/epreuves/[id]/tentatives/route.ts`, `.../tentatives/latest/route.ts`,
  `src/app/api/eleve/corrections/[id]/signaler/route.ts` (nouveaux) — IDOR vérifié sur chacune (épreuve
  filtrée par classe/filière de l'élève, correction filtrée par `eleveId`, `AuditLogSecurite` sur
  tentative bloquée comme le reste de l'app).
- `src/app/eleve/epreuves/[id]/correction/page.tsx` (nouveau) — décide serveur : résultat existant,
  analyse en cours, ou formulaire vierge ; `?nouvelleTentative=1` force le formulaire (bouton
  "Recommencer l'épreuve") même si une correction existe déjà.
- `src/components/eleve/UploadCopie.tsx`, `ResultatCorrection.tsx` (nouveaux).
- `src/components/eleve/BanqueEpreuves.tsx` — bouton "Envoie ta copie" ajouté par épreuve (icône
  `IconRobot`, réservée à cet usage précis depuis son introduction, jamais utilisée jusqu'ici).
- `src/components/icons.tsx` — ajout `IconClose` (modale de signalement).

### Vérifié réellement — pipeline complet, vrai appel Sonnet vision, vraie copie de test

Copie de test synthétique construite pour ce test (pas une vraie copie manuscrite — impossible à
produire dans cet environnement — mais une vraie image PNG traitée par le vrai pipeline de bout en
bout) : 3 exercices de maths avec 2 réponses correctes et 1 fausse (hypoténuse d'un triangle 3-4-5
donnée à tort comme 4 au lieu de 5), plus un vrai PDF de corrigé de référence généré pour l'occasion.

- Admin de test réel (connexion NextAuth + TOTP) → épreuve créée via la vraie route
  `POST /api/admin/epreuves`. Élève de test réel (inscription + connexion réelles) → copie uploadée via
  la vraie route `POST /api/eleve/epreuves/[id]/tentatives`.
- **Incident découvert et corrigé en cours de route** : le job n'était jamais traité — le conteneur
  `worker` a son propre volume `node_modules`, distinct de celui d'`app` ; `@anthropic-ai/sdk` installé
  en Passe 1 seulement dans `app` n'existait pas côté `worker`, qui crashait silencieusement en boucle
  (`Cannot find module '@anthropic-ai/sdk'`, visible dans `docker compose logs worker`). Corrigé par un
  `npm install` direct dans le conteneur `worker` + redémarrage — la tentative de test, restée en file
  d'attente Redis pendant l'incident, a été traitée automatiquement dès le worker sain, sans perte.
- **Résultat réel obtenu** : note **13/20**, `pointsForts` citant précisément les 2 bons exercices,
  `pointsManques` avec le détail exact de l'erreur sur le 3ème (calcul du théorème de Pythagore
  correctement expliqué : "c² = 3² + 4² = 9 + 16 = 25, donc c = 5 cm" contre la réponse fautive
  "c = 4 cm" de la copie) — la grille de notation attendue est correctement respectée, pas juste un
  texte plausible.
- **1 `Lacune` créée** ("Exercice 2 - Théorème de Pythagore", `niveauMaitrise=0`).
- **`UsageIA` réelle** : `{typeUsage: CORRECTION, modele: SONNET, tokensInput: 3823, tokensOutput: 698,
  coutEstime: 0.021939}` — **coût réel du test : $0.021939**, dans la fourchette annoncée à l'utilisateur
  avant le test ($0,01–$0,05).
- **Écran de résultat réel vérifié** : `GET /eleve/epreuves/[id]/correction` avec une vraie session élève
  → HTTP 200, contenu réel confirmé ("Points forts", "Points à travailler", note "13" présents dans le
  HTML rendu).
- `tsc --noEmit` (0 erreur) et `eslint` sur tout `src/` (0 erreur — 2 warnings pré-existants, sans
  rapport avec cette passe, dans `src/lib/payment/mock-provider.ts`).

### Nettoyage

Toutes les données de test réelles (admin, élève, épreuve, `TentativeEpreuve`, `CorrectionDetail`,
`Lacune`, `UsageIA`) supprimées après vérification, ainsi que les 2 fichiers PDF/photo réellement
uploadés sur R2 (`storage.supprimer`). Scripts et fichiers de test ad hoc (racine, jamais suivis par
git) supprimés.

### Suite

Passe 3 (écran "Mes lacunes", maquette 09) — le nav élève a déjà un point d'entrée prévu et désactivé
(`/eleve/lacunes`, `EleveShell.tsx`) prêt à activer, maintenant que de vraies `Lacune` peuvent exister.

## 55. Passe 3 — Écran "Mes lacunes" (15 septembre 2026)

Troisième passe du chantier IA réelle (§52-§54). Nav élève déjà prévue et désactivée
(`/eleve/lacunes`, `EleveShell.tsx`) — réactivée maintenant que de vraies `Lacune` peuvent exister
(Passe 2). Fidèle à la maquette 09 (grille "Mes lacunes par matière", barres colorées par seuil,
panneau de détail pour la lacune sélectionnée).

### Deux écarts par rapport à la maquette, hors scope de cette passe

- **Recommandation vidéo** (§2.5) : la maquette montre une carte "Vidéo : ...". Le pipeline vidéo
  (YouTube Data API, `Video`/`LacuneVideoCache`) n'a jamais été construit et n'était pas dans la liste
  des 10 points de ce chantier — carte omise plutôt que simulée avec une fausse vidéo.
- **Quiz ciblé** ("Commencer le quiz associé") : dépend de `genererQuiz()` branché sur une vraie UI, pas
  encore construit (Passe 4, prochaine). Bouton affiché mais désactivé ("bientôt disponible"), pas un
  lien mort.

### Texte explicatif par lacune — réutilisé, pas régénéré

La maquette montre un texte explicatif par lacune ("Tu confonds souvent..."). `Lacune` elle-même ne
stocke aucun texte de ce genre — seul `notion` + `niveauMaitrise`. Plutôt qu'un nouvel appel IA pour
produire ce texte, il est lu depuis `CorrectionDetail.pointsManques[].detail` de la correction qui a
créé/mis à jour la lacune (via `Lacune.sourceTentativeId`, qui — malgré son nom — pointe vers un id
`CorrectionDetail`, cf. schema.prisma), en retrouvant l'entrée dont `notion` correspond. Zéro coût IA
supplémentaire pour cet écran.

### Code changé

- `src/app/eleve/lacunes/page.tsx` (nouveau) — requête `Lacune` filtrée `resolu: false`, triée par
  `niveauMaitrise` croissant (pire lacune en premier, comme la sélection par défaut de la maquette).
- `src/components/eleve/MesLacunes.tsx` (nouveau) — grille par matière, seuils de couleur (≥70 vert,
  40-69 ambre, <40 rouge — déduits des valeurs visibles sur la maquette), panneau de détail cliquable.
- `src/components/eleve/EleveShell.tsx` — nav "Mes lacunes" activée (`disabled: true` retiré).

### Vérifié réellement

- `tsc --noEmit` et `eslint` : 0 erreur.
- Élève de test réel, 4 vraies `Lacune` insérées (2 Mathématiques, 1 Physique, 1 marquée `resolu: true`)
  → page réelle chargée avec une vraie session (`GET /eleve/lacunes` → 200) : les 2 matières apparaissent,
  la lacune la plus faible (Probabilités, 31%) est bien présente et sélectionnée par défaut, la lacune
  `resolu: true` n'apparaît **pas** (filtrage confirmé), la lacune à bonne maîtrise (Mécanique, 74%)
  apparaît bien dans sa carte. Nettoyage effectué après vérification.

### Suite

Passe 4 — Quiz quotidien (maquette 10) + job BullMQ. Débloquera le bouton "Commencer le quiz associé"
laissé désactivé dans cette passe.

## 56. Passe 4 — Quiz journalier + quiz ciblé, job BullMQ (15 septembre 2026)

Quatrième passe du chantier IA réelle (§52-§55). Fidèle à la maquette 10 (une question à la fois,
progression, feedback immédiat, écran de résultat avec carrés colorés). Deux origines couvertes
(`Quiz.origine`, v1.11) : **journalier** (automatique, cron quotidien + génération à la demande) et
**ciblé** (déclenché depuis "Mes lacunes" sur une notion précise — débloque le bouton laissé désactivé
en Passe 3).

### `QuestionGeneree.explication` — nouveau champ, migration nécessaire

La maquette affiche une explication pédagogique après chaque réponse ("✓ Bonne réponse ! Il y a 4 rois
sur 32 cartes..."). Ni l'interface `AIProvider` ni `QuizQuestion` ne portaient ce champ — ajouté aux
deux : `QuestionGeneree.explication?` (types.ts, généré par Claude via l'outil `soumettre_quiz`,
désormais requis dans son schéma), `QuizQuestion.explication String? @db.Text` (migration
`20260915124754_add_explication_quiz_question`). `QuizGenere` gagne aussi `tokensInput`/`tokensOutput`
(comme `Correction`/`ReponseIA`) pour une vraie traçabilité `UsageIA` sur ce type d'usage aussi.

### Sélection de la matière ciblée par le quiz journalier

`genererQuiz()` est scopé à une seule matière (§6.1) ; un élève peut avoir des lacunes actives dans
plusieurs matières. Le job journalier choisit la matière avec le plus de lacunes actives (égalité
tranchée par le niveau de maîtrise moyen le plus bas) plutôt que de générer un quiz par matière chaque
jour — un seul quiz "du jour", conforme au singulier de la maquette et du nom de la fonctionnalité.

### `Lacune.niveauMaitrise` — recalcul déterministe confirmé, seuil de résolution assumé

Recalculé à chaque réponse comme un ratio réponses correctes/total **sur toutes les questions jamais
répondues pour cette lacune** (pas seulement le quiz en cours) — aucun appel IA, conforme à la règle
CLAUDE.md/v1.12. `Lacune.resolu` passe à `true` dès que ce ratio atteint 70% — seuil choisi pour rester
cohérent avec le seuil "bonne maîtrise" déjà utilisé dans l'écran "Mes lacunes" (Passe 3), **pas une
valeur du CDC** : à ajuster si l'utilisateur a un seuil différent en tête.

**Confirmé par l'utilisateur après coup** : « 70% est un bon seuil de départ, cohérent avec le CDC
(§2.2.2 : valeurs de départ non figées, à ajuster après usage réel). » Le §2.2.2 du CDC (alertes
intelligentes côté parent) fixe déjà ce principe de seuils de départ révisables une fois des données
réelles disponibles — le seuil de résolution des lacunes suit donc la même logique explicitement
validée, plutôt qu'une simple hypothèse technique laissée en suspens.

### Sécurité des réponses de quiz

`bonneReponse` et `explication` ne sont jamais envoyées au client pour une question pas encore
répondue (aussi bien dans la route API que dans le composant serveur de la page) — sinon l'élève
pourrait les lire dans le HTML/JSON avant de répondre. Révélées uniquement une fois `reponseEleve`
non nul.

### Code changé

- `prisma/schema.prisma` + migration — `QuizQuestion.explication`.
- `src/lib/ai/types.ts`, `claude-provider.ts`, `mock-provider.ts` — `explication` + tokens sur
  `QuizGenere`.
- `src/lib/queue/quiz.ts`, `src/lib/quiz/generer-quiz.ts` (nouveaux) — files BullMQ (cron quotidien
  05:00 tous élèves + file à la demande par élève, journalier ou ciblé) et logique de génération.
- `src/worker/index.ts` — 2 workers quiz câblés + scheduler cron enregistré.
- `src/app/api/eleve/quiz/aujourdhui/route.ts`, `cible/route.ts`, `[id]/route.ts`,
  `[id]/repondre/route.ts` (nouveaux) — IDOR vérifié partout (lacune/quiz filtrés par `eleveId`).
- `src/app/eleve/quiz/page.tsx` (hub, redirige si un quiz du jour existe déjà),
  `src/app/eleve/quiz/[id]/page.tsx` (écran générique de prise de quiz).
- `src/components/eleve/QuizAujourdhui.tsx`, `QuizPlayer.tsx` (nouveaux).
- `src/components/eleve/EleveShell.tsx` — nav "Quiz" activée.
- `src/components/eleve/MesLacunes.tsx` — bouton "Commencer le quiz associé" branché pour de vrai
  (enqueue + sondage + redirection), remplace le placeholder désactivé de la Passe 3.

### Incident (même cause qu'en Passe 2, corrigé plus vite cette fois)

Le job journalier a d'abord échoué (`Unknown argument 'explication'`) : le conteneur `worker` a son
propre `node_modules`, donc son propre `@prisma/client` généré — pas régénéré automatiquement quand
`prisma migrate dev` tourne côté `app`. Corrigé par `npx prisma generate` dans le conteneur `worker` +
redémarrage. **À surveiller pour toutes les passes futures qui touchent au schéma** : régénérer le
client Prisma des deux côtés (`app` et `worker`), pas seulement celui qui a lancé la migration.

### Vérifié réellement — vrais appels Haiku, vraies réponses, scoring déterministe confirmé

Élève de test réel, 3 vraies lacunes créées, quiz journalier généré à la demande (2 vraies questions
Haiku, une par lacune, énoncés/choix/explications cohérents et corrects mathématiquement) :

- Réponse **correcte** à la question 1 (Thalès) → `niveauMaitrise` recalculé à **100**, `resolu` passé
  à **true** — confirmé déterministe (1/1 réponse correcte).
- Réponse **incorrecte** à la question 2 (suites arithmétiques) → `niveauMaitrise` à **0**, `resolu`
  resté `false`.
- `Quiz.statut` passé à `TERMINE`, `score=1` dès que toutes les questions ont une réponse.
- `UsageIA` réelle : `{modele: HAIKU, tokensInput: 1235, tokensOutput: 533, coutEstime: 0.0039}`.
- Écran réel `/eleve/quiz/[id]` vérifié : HTTP 200.
- **Quiz ciblé** testé séparément sur une 3ème lacune : généré avec `origine=CIBLE` et
  `lacuneCibleId` corrects.
- `tsc --noEmit` (0 erreur) et `eslint` sur tout `src/` (0 erreur, 2 warnings pré-existants sans
  rapport).
- Note qualité (pas un bug) : l'explication générée pour la question de Thalès s'auto-corrige en
  cours de texte ("AD = 6cm... en relisant l'énoncé... AD = 9cm") — Haiku a hésité dans son propre
  raisonnement affiché, sans conséquence sur le mécanisme (bonne réponse, scoring, `niveauMaitrise`
  tous corrects) ; à surveiller si ça se reproduit souvent, mais hors scope d'un ajustement de prompt
  dans cette passe.

### Nettoyage

Toutes les données de test réelles (élève, lacunes, quiz, questions, `UsageIA`) supprimées après
vérification. Scripts ad hoc supprimés.

### Incident infrastructure (sans rapport avec le code) pendant cette passe

Docker Desktop a renvoyé une 500 sur tout listing de conteneurs (`docker ps`, `docker compose ps`)
pendant une bonne partie de la vérification — bloqué jusqu'à ce que l'utilisateur redémarre Docker
Desktop lui-même. Après redémarrage, aucun conteneur ne tournait (`docker compose up -d` relancé) —
comportement normal, pas une régression.

### Suite

Passe 5 — Chat mode 2 (contextualisé à une épreuve).
