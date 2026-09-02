# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

**No application code exists yet.** This repository currently contains only specs, reference docs, a Prisma
schema, and curriculum data — there is no `package.json`, no Next.js app, no tests, and no build/lint/test
commands to run. If you are asked to implement Klarity, you are building it from scratch against the documents
below; don't assume any scaffolding is already in place, and check with the user before picking a package
manager, framework version, or hosting target that isn't already implied by the docs.

`prisma/schema.prisma` is the one artifact that already encodes real architectural decisions (see below) — treat
it as authoritative for data modeling, not as a draft to redesign.

## What Klarity is

An IA-powered exam-prep platform for Cameroonian secondary students (3ème, Première, Terminale), in French
first, English later. Three user roles: **Élève** (student), **Parent**, **Admin**. Core loop: a student
downloads a past exam (PDF), works it on paper, photographs their answer sheet, uploads it, and Claude corrects
it — extracting a score, strengths, and gaps ("lacunes"), which then drive a daily quiz and recommended YouTube
videos. Parents get a read-only dashboard (time-on-platform, per-subject progress, lacunes) gated behind a
verified parent↔child link. Admin manages the exam bank, exam-date calendar, and platform financials.

Read `docs/specs/Klarity_context.txt` for the original founder brief (including three corrections at the bottom
that override the initial brief) and `docs/specs/Klarity_Cahier_des_Charges.pdf` for the full technical spec —
the cahier des charges is the tie-breaker of record whenever another doc conflicts with it.

### Curriculum structure (drives a lot of conditional logic)

Subject availability is **not uniform** — it depends on `classe` and, for Première/Terminale, `filiere`:

| Niveau | Filière | Matières banque d'épreuves |
|---|---|---|
| 3ème | (aucune) | Français, Maths, **PCT** (Physique-Chimie-Technologie combinée — pas de Physique/Chimie séparées en 3ème), SVT |
| Première/Terminale | A | Maths, SVT, Français, **Philosophie** (réservée à la série A) |
| Première/Terminale | C, D | Maths, Physique, Français, Chimie, **SVT** (ajoutée v1.29 — Français conservé, obligatoire à l'examen national) |
| Première/Terminale | TI | Maths, Physique, Français, Chimie, Système d'information, Programmation, Réseau, **SVT** (ajoutée v1.29) |

Anglais and Histoire-Géo are covered by the general chat tutor on every track but are **never** part of the exam
bank / correction pipeline. `Matiere.banqueDisponible` is the flag that distinguishes "chat-only" subjects from
"has an exam bank." `docs/programmes/**/programme_*.json` holds the official curriculum (Matière → Module →
Thème → Contenus) for each classe/filière pair and is loaded verbatim into `ProgrammeOfficiel.contenuStructure`
— it doubles as (1) system context for AI calls and (2) the taxonomy source for `Lacune.notion` /
`CorrectionDetail.pointsManques[].notion` / `Video.notionAssociee`, so those three fields must stay on the same
vocabulary. `docs/baremes/*.txt` holds official grading rubrics for French/Philo essay exercise types
(dissertation philo, dissertation littéraire, contraction de texte, discussion) — these back `ExempleCorrection`
few-shot prompts, which are **not** filière-specific (the methodology barème is the same across series; only the
exam content varies).

### Tuteur IA (chat) vs. Correction IA (upload pipeline) — three code paths, no implicit bridge between them

These get conflated because both are "the AI talking to a student," but per the cahier des charges (§2.1, §4.4,
§6.2 — the tie-breaker doc, v1.27) there are **three distinct paths behind two features**, each routed through a
different `AIProvider` method and a different model. Route by **which method is called and which entry point the
request came from**, never by inspecting message/image content, and never let one silently fall back into
another:

| | Chat général (mode 1) | Chat contextualisé (mode 2) | Correction IA |
|---|---|---|---|
| `AIProvider` method | `chat(messages, contexteMatiere)` | `chat(messages, contexteMatiere, contexteEpreuve)` | `corrigerCopie(imageKeys, epreuveRef, bareme, exemplesFewShot?)` |
| Modèle | `ModeleIA.Haiku` | `ModeleIA.Haiku` | `ModeleIA.Sonnet` + vision |
| Déclencheur | Élève ouvre une conversation par matière, sans épreuve précise | Élève consulte une épreuve ou une correction déjà produite — l'énoncé + le corrigé sont injectés comme `contexteEpreuve` | Upload d'une copie photographiée, uniquement pour `numeroTentative == 1` |
| Matières | Tout le programme de la classe/filière, y compris hors banque (`banqueDisponible = false`) — c'est la *seule* surface pour Anglais/Histoire-Géo | Uniquement les matières avec `banqueDisponible = true` | Uniquement les matières avec `banqueDisponible = true` |
| `ConversationChat` shape | `epreuveId = NULL`, `matiereId` obligatoire | `epreuveId` renseigné, `matiereId` obligatoire | n/a — pas un `ConversationChat` |
| Sortie | Texte conversationnel libre + vidéo(s) recommandée(s) par notion | Texte conversationnel libre (peut référencer le corrigé) + vidéo(s) recommandée(s) — **ne produit jamais de note** | `note` chiffrée + `CorrectionDetail` structuré, RAG-grounded contre `docs/baremes/*.txt` / `ExempleCorrection` |
| Writes to data model | Rien dans `TentativeEpreuve` / `CorrectionDetail` / `Lacune` | Rien dans `TentativeEpreuve` / `CorrectionDetail` / `Lacune` — even though it may read/discuss an existing correction | `TentativeEpreuve`, `CorrectionDetail`, and (via the daily quiz) `Lacune` |

`epreuveId` on `ConversationChat` is the *only* field distinguishing chat mode 1 from mode 2 — `matiereId` is
required in both. Mode 2 being available on a correction screen does **not** mean chat can trigger or redo a
correction; it only means an already-produced `CorrectionDetail` can be handed to `chat()` as read-only context.

Non-negotiables when implementing any of the three:
- The chat endpoint (`chat()`, either mode) must never accept an image upload and forward it into
  `corrigerCopie()`, and must never itself produce a `note` or write a `CorrectionDetail` row.
- `corrigerCopie()` must never fall back to a conversational chat reply if vision extraction fails or is
  ambiguous — surface an explicit error/retry state instead of improvising an answer.
- The three must not share a request handler, a queue, or a system prompt. Route by which endpoint/UI surface
  the request came in on (and, for chat, whether `contexteEpreuve` was supplied), not by classifying the payload.
- In the UI, the affordance that starts a correction (upload button / "Envoie ta copie") must be visually and
  structurally distinct from either chat mode's entry point — not nested inside the same widget or reachable as
  a chat action ("send me a photo and I'll grade it" is exactly the kind of implicit bridge this rules out).
- **Known gap as of the current maquettes** (`docs/maquettes/screenshots/`): mode 2 (chat contextualisé à une
  épreuve) has no visual entry point anywhere in the mockup set — the correction-result screen
  (`08_resultat_correction_detaillee.png`) only exposes "Recommencer l'épreuve" and "Signaler cette correction,"
  and the standalone Tuteur IA screen (`05_chat_tuteur_ia.png`) only shows mode 1. Don't assume mode 2 is
  unreachable in the UI just because no current maquette shows it — it's a spec requirement (§2.1) that the
  mockups haven't caught up to yet; check with the user/design before deciding how it surfaces.

### Auth model — deliberately two-tier, low-entropy-first-factor

- Student signs up with name + classe + filière only, receives a crypto-random `ELE-XXX-XXX` code (never
  `Math.random()`) plus a PIN they set themselves.
- Parent "logs in" using `codeEleve + telephone`, then must clear an SMS OTP — the code alone must **never**
  grant dashboard access; OTP is the real barrier. See `docs/reference/Klarity_Securite_Reference.md` §2 for the
  full non-negotiable list (rate limiting by IP *and* phone, short single-use OTP, mandatory 2FA for Admin,
  short-lived JWT with refresh rotation, stateless sessions).
- Parent dashboard renders nothing until `ParentEleveLink` exists (verified link row), regardless of auth state.

### Data/domain invariants worth knowing before touching the schema

- Only attempt #1 of an exam (`TentativeEpreuve.numeroTentative == 1`) triggers a real Claude vision call;
  re-attempts are free practice and never overwrite the stored `CorrectionDetail` (one row per
  `(epreuveId, eleveId)` — first correction is final, `unique` constraint enforces it). Admins can override the
  score/justification (`noteOverride`) without mutating the AI's original output.
- `Lacune.niveauMaitrise` is a deterministic ratio calculation (quiz correct/total) — never an LLM call.
- Payments: Mobile Money only via CamerPay (card payments were deliberately removed — a card form rendered PAN
  fields inside Klarity's own UI instead of an isolated PSP frame, which was flagged as a PCI-DSS compliance
  risk; keep it that way). Every webhook write is gated by HMAC signature verification and
  `Paiement.idempotencyKey` uniqueness; `WebhookLog` is an append-only audit trail that also records rejected
  webhooks. Pricing: 5000 FCFA/mois standard, 3000 FCFA/mois during Dec–Feb and Apr–Jun promo windows;
  `Abonnement.prixApplique` is frozen at payment time and never recalculated retroactively.
- Video recommendations are cached (`LacuneVideoCache`, keyed by `notionCle`) specifically to avoid re-spending
  YouTube API + LLM calls on the same gap across students.
- `ModeleIA` distinguishes Haiku (chat, cheap/fast) from Sonnet (correction, vision quality matters) —
  `UsageIA` tracks token counts and estimated cost per call so per-user AI spend can be monitored against the
  flat subscription price (see cost-control note below).

## Architecture already decided (apply these when writing code, don't re-litigate)

From `docs/reference/Klarity_scalability_reference.txt` and `Klarity_Securite_Reference.md`:

- **Stack**: Next.js monolith (not microservices), Prisma + PostgreSQL, NextAuth/Auth.js v5 for stateless JWT
  sessions, Cloudflare R2 for exam PDFs/corrections/uploaded photos (signed, expiring URLs only — never a public
  bucket), Redis-backed caching (video/lacune cache, matières list), BullMQ for background jobs, Claude API for
  all AI calls. Deployment target is something simple (Vercel/Railway/VPS+Docker) — no Kubernetes.
- **Sync request handlers must never call the vision/correction model inline.** Upload responds immediately;
  a background worker (BullMQ/Redis queue) does the Claude call and the client polls/subscribes for the result.
  Same pattern applies to quiz generation, video filtering/search, and SMS/WhatsApp sends.
- **AI calls go through one unified provider function**, not ad-hoc SDK calls scattered around — abstracted
  enough that switching or load-balancing providers is a config change. Retry with backoff on 429; a dedicated
  rate-limited queue for AI calls so you can't blow through provider quota.
- **IDOR is the expected failure mode to guard against explicitly.** Every API route touching a specific
  student's data (`/api/eleve/[id]`, `/api/lacunes/[id]`, `/api/corrections/[id]`, …) must verify the resource
  actually belongs to the authenticated caller — role-based auth alone is not sufficient, and this check
  happens server/middleware-side, never only in the UI. A parent may only ever query their linked child's data,
  re-checked per request, not cached from login.
- **Cost control on AI usage is a product requirement, not an afterthought**: even Premium ("illimité" in
  marketing copy) needs a real technical ceiling, and per-user AI cost should be monitored so subscription
  revenue doesn't get outpaced by API spend on outlier users.
- Index every foreign key and frequently filtered field up front (the schema already does this — preserve the
  pattern in migrations), paginate every list endpoint, and don't reach for read replicas/sharding until
  metrics actually demand it.
- Prompt injection surface: text extracted from a photographed answer sheet is untrusted content and must stay
  structurally separated from the system prompt in every Claude call — an answer sheet must never be able to
  steer model behavior via embedded instructions.
- WhatsApp is notification-only at launch (reminders, progress summaries) — the full WhatsApp *interface*
  (chat/upload/quiz over WhatsApp) is an explicitly deferred phase, not part of MVP scope. Don't build toward it
  prematurely; `CanalSessionActivite.WHATSAPP` exists in the enum for forward-compat only.

## Localization

Content is being built French-first (`Langue.FR`); English (`Langue.EN`) is planned as a second phase — the
`langue` field already exists throughout the schema (`Eleve`, `Video`, `ExempleCorrection`,
`ProgrammeOfficiel`, ...) so localized rows can coexist, but don't assume English curriculum data is populated
until that phase is greenlit.
