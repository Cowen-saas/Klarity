# Klarity — État d'avancement

_Dernière mise à jour : 20 août 2026_

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
    (`/admin`, `/parent`, `/eleve`) côté serveur — la vérification d'appartenance à la
    ressource précise (IDOR) reste à faire par route en Phase 1+.

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

## 4. Prochaine étape concrète

**Démarrer la Phase 1 — Cœur pédagogique (mock IA), en commençant par l'inscription élève
(§2.1).**

C'est le point de blocage naturel : l'authentification (Phase 0) est prête côté connexion, mais
il n'existe encore aucun moyen de *créer* un compte `Eleve` — donc aucun des flux de Phase 1
(banque d'épreuves, upload de copie, chat, quiz, dashboard parent) n'est exerçable de bout en
bout tant que l'inscription n'existe pas. Concrètement :

1. Écran + route d'inscription élève : nom, classe (3ème/1ère/Terminale), filière (A/C/D/TI,
   uniquement si 1ère/Terminale) → génération d'un code `ELE-XXX-XXX` cryptographiquement
   aléatoire (jamais `Math.random()`) → définition du PIN à 4 chiffres.
2. Une fois un élève réel créable, enchaîner sur le chargement des 9 `ProgrammeOfficiel`
   (JSON déjà présents dans `docs/programmes/`, pas encore ingérés en base) et la banque
   d'épreuves filtrée par classe/série (table de référence §2.1), pour avoir un premier
   parcours élève testable en local avec `MockAIProvider`.
