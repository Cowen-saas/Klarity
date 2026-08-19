-- CreateEnum
CREATE TYPE "NiveauClasse" AS ENUM ('TROISIEME', 'PREMIERE', 'TERMINALE');

-- CreateEnum
CREATE TYPE "Filiere" AS ENUM ('A', 'C', 'D', 'TI');

-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "StatutCompteEleve" AS ENUM ('ACTIF', 'INACTIF_NOTIFIE', 'ANONYMISE');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "CanalNotificationPreference" AS ENUM ('SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "FrequenceNotification" AS ENUM ('HEBDOMADAIRE', 'MENSUEL', 'CRITIQUE_UNIQUEMENT');

-- CreateEnum
CREATE TYPE "TypeExamen" AS ENUM ('BEPC', 'PROBATOIRE', 'BAC');

-- CreateEnum
CREATE TYPE "TypeExerciceCorrection" AS ENUM ('DISSERTATION_PHILO', 'DISSERTATION_LITTERAIRE', 'CONTRACTION_TEXTE', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "StatutTentative" AS ENUM ('EN_ATTENTE', 'EN_TRAITEMENT', 'TERMINE', 'ERREUR');

-- CreateEnum
CREATE TYPE "MotifSignalement" AS ENUM ('LECTURE_ILLISIBLE', 'BAREME_INCORRECT', 'AUTRE');

-- CreateEnum
CREATE TYPE "OrigineQuiz" AS ENUM ('JOURNALIER', 'CIBLE');

-- CreateEnum
CREATE TYPE "CanalSessionActivite" AS ENUM ('WEB', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "RoleMessageChat" AS ENUM ('ELEVE', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "PlanAbonnement" AS ENUM ('GRATUIT', 'PREMIUM');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ACTIF', 'EXPIRE');

-- CreateEnum
CREATE TYPE "PayeurRole" AS ENUM ('PARENT', 'ELEVE');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'REUSSI', 'ECHEC', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "TypeUsageIA" AS ENUM ('CHAT', 'QUIZ', 'CORRECTION', 'VIDEO_FILTRAGE');

-- CreateEnum
CREATE TYPE "ModeleIA" AS ENUM ('HAIKU', 'SONNET');

-- CreateEnum
CREATE TYPE "TypeEvenementAudit" AS ENUM ('LOGIN_FAIL', 'OTP_FAIL', 'PIN_FAIL', 'IDOR_BLOCKED', 'WEBHOOK_INVALID', 'COMPTE_INACTIF_DETECTE', 'COMPTE_ANONYMISE_AUTO', 'COMPTE_ANONYMISE_MANUEL');

-- CreateTable
CREATE TABLE "eleves" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "codeEleve" TEXT NOT NULL,
    "classe" "NiveauClasse" NOT NULL,
    "filiere" "Filiere",
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "pinHash" TEXT NOT NULL,
    "pinTentativesEchouees" INTEGER NOT NULL DEFAULT 0,
    "pinVerrouilleJusqua" TIMESTAMP(3),
    "statutCompte" "StatutCompteEleve" NOT NULL DEFAULT 'ACTIF',
    "derniereActiviteLe" TIMESTAMP(3),
    "dateNotificationInactivite" TIMESTAMP(3),
    "dateAnonymisation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereConnexion" TIMESTAMP(3),
    "dernierEleveConsulteId" TEXT,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_eleve_links" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "codeUtilise" TEXT NOT NULL,
    "dateLiaison" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_eleve_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "canal" "CanalNotificationPreference" NOT NULL DEFAULT 'SMS',
    "frequence" "FrequenceNotification" NOT NULL DEFAULT 'HEBDOMADAIRE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "codeOtpHash" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "twoFactorSecret" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "classesConcernees" "NiveauClasse"[],
    "filiereRequise" "Filiere"[],
    "banqueDisponible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epreuves" (
    "id" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "classe" "NiveauClasse" NOT NULL,
    "filiere" "Filiere",
    "titre" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "fichePdfKey" TEXT NOT NULL,
    "corrigeReferenceKey" TEXT NOT NULL,
    "ajouteParAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epreuves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "providerVideoId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "notionAssociee" TEXT NOT NULL,
    "classe" "NiveauClasse",
    "filiere" "Filiere",
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "sourceAutomatisee" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lacune_video_cache" (
    "id" TEXT NOT NULL,
    "notionCle" TEXT NOT NULL,
    "videoIdsJson" JSONB NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lacune_video_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dates_examen" (
    "id" TEXT NOT NULL,
    "typeExamen" "TypeExamen" NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "dateExamen" TIMESTAMP(3),
    "datePeriodeEstimee" TEXT,
    "ajouteParAdminId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dates_examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exemples_correction" (
    "id" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "typeExercice" "TypeExerciceCorrection" NOT NULL,
    "enonceModele" TEXT NOT NULL,
    "baremeStructure" JSONB NOT NULL,
    "exempleReponseModele" TEXT NOT NULL,
    "notesMethodologiques" TEXT NOT NULL,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "ajouteParAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exemples_correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programmes_officiels" (
    "id" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "classe" "NiveauClasse" NOT NULL,
    "filiere" "Filiere",
    "contenuStructure" JSONB NOT NULL,
    "fichierSourceKey" TEXT,
    "versionSource" TEXT,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "ajouteParAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programmes_officiels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentatives_epreuve" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "epreuveId" TEXT NOT NULL,
    "numeroTentative" INTEGER NOT NULL,
    "photoUploadKeys" JSONB NOT NULL,
    "statut" "StatutTentative" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateSoumission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTraitement" TIMESTAMP(3),

    CONSTRAINT "tentatives_epreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections_detail" (
    "id" TEXT NOT NULL,
    "epreuveId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "note" DOUBLE PRECISION,
    "pointsForts" JSONB NOT NULL,
    "pointsManques" JSONB NOT NULL,
    "feedbackDetaille" TEXT NOT NULL,
    "modeleIA" TEXT NOT NULL DEFAULT 'claude-sonnet',
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "signalee" BOOLEAN NOT NULL DEFAULT false,
    "motifSignalement" "MotifSignalement",
    "commentaireEleve" TEXT,
    "noteOverride" DOUBLE PRECISION,
    "justificationOverride" TEXT,
    "overrideParAdminId" TEXT,
    "dateSignalement" TIMESTAMP(3),
    "dateTraitementSignalement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lacunes" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "notion" TEXT NOT NULL,
    "niveauMaitrise" INTEGER NOT NULL DEFAULT 0,
    "sourceTentativeId" TEXT,
    "dateDetection" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,
    "resolu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lacunes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "score" DOUBLE PRECISION,
    "origine" "OrigineQuiz" NOT NULL DEFAULT 'JOURNALIER',
    "lacuneCibleId" TEXT,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "lacuneId" TEXT,
    "enonce" TEXT NOT NULL,
    "choixJson" JSONB NOT NULL,
    "bonneReponse" TEXT NOT NULL,
    "reponseEleve" TEXT,
    "correcte" BOOLEAN,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_activite" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "dureeSecondes" INTEGER,
    "canal" "CanalSessionActivite" NOT NULL DEFAULT 'WEB',

    CONSTRAINT "sessions_activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations_chat" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "epreuveId" TEXT,
    "titre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_chat" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "RoleMessageChat" NOT NULL,
    "contenu" TEXT NOT NULL,
    "modeleIA" TEXT NOT NULL DEFAULT 'claude-haiku',
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonnements" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "plan" "PlanAbonnement" NOT NULL DEFAULT 'GRATUIT',
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'ACTIF',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "prixApplique" DECIMAL(10,2),
    "renouvellementAuto" BOOLEAN NOT NULL DEFAULT false,
    "dateProchainRenouvellement" TIMESTAMP(3),
    "rappelEnvoye" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "payeurTelephone" TEXT NOT NULL,
    "payeurRole" "PayeurRole" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "methode" "MethodePaiement" NOT NULL DEFAULT 'MOBILE_MONEY',
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "referenceCamerPay" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CAMERPAY',
    "payloadBrut" JSONB NOT NULL,
    "signatureValide" BOOLEAN NOT NULL,
    "traitementStatut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usages_ia" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT,
    "matiereId" TEXT,
    "typeUsage" "TypeUsageIA" NOT NULL,
    "modele" "ModeleIA" NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "coutEstime" DECIMAL(10,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usages_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_securite" (
    "id" TEXT NOT NULL,
    "typeEvenement" "TypeEvenementAudit" NOT NULL,
    "utilisateurId" TEXT,
    "ip" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_securite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eleves_codeEleve_key" ON "eleves"("codeEleve");

-- CreateIndex
CREATE INDEX "eleves_statutCompte_derniereActiviteLe_idx" ON "eleves"("statutCompte", "derniereActiviteLe");

-- CreateIndex
CREATE UNIQUE INDEX "parents_telephone_key" ON "parents"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "parent_eleve_links_parentId_eleveId_key" ON "parent_eleve_links"("parentId", "eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_parentId_key" ON "notification_preferences"("parentId");

-- CreateIndex
CREATE INDEX "otp_verifications_telephone_idx" ON "otp_verifications"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "matieres_nom_key" ON "matieres"("nom");

-- CreateIndex
CREATE INDEX "epreuves_classe_filiere_matiereId_idx" ON "epreuves"("classe", "filiere", "matiereId");

-- CreateIndex
CREATE INDEX "videos_notionAssociee_idx" ON "videos"("notionAssociee");

-- CreateIndex
CREATE UNIQUE INDEX "lacune_video_cache_notionCle_key" ON "lacune_video_cache"("notionCle");

-- CreateIndex
CREATE UNIQUE INDEX "dates_examen_typeExamen_anneeScolaire_key" ON "dates_examen"("typeExamen", "anneeScolaire");

-- CreateIndex
CREATE INDEX "exemples_correction_matiereId_typeExercice_idx" ON "exemples_correction"("matiereId", "typeExercice");

-- CreateIndex
CREATE UNIQUE INDEX "programmes_officiels_matiereId_classe_filiere_key" ON "programmes_officiels"("matiereId", "classe", "filiere");

-- CreateIndex
CREATE INDEX "tentatives_epreuve_eleveId_idx" ON "tentatives_epreuve"("eleveId");

-- CreateIndex
CREATE INDEX "tentatives_epreuve_statut_idx" ON "tentatives_epreuve"("statut");

-- CreateIndex
CREATE INDEX "corrections_detail_signalee_dateTraitementSignalement_idx" ON "corrections_detail"("signalee", "dateTraitementSignalement");

-- CreateIndex
CREATE UNIQUE INDEX "corrections_detail_epreuveId_eleveId_key" ON "corrections_detail"("epreuveId", "eleveId");

-- CreateIndex
CREATE INDEX "lacunes_eleveId_idx" ON "lacunes"("eleveId");

-- CreateIndex
CREATE INDEX "sessions_activite_eleveId_idx" ON "sessions_activite"("eleveId");

-- CreateIndex
CREATE INDEX "conversations_chat_eleveId_idx" ON "conversations_chat"("eleveId");

-- CreateIndex
CREATE INDEX "messages_chat_conversationId_idx" ON "messages_chat"("conversationId");

-- CreateIndex
CREATE INDEX "abonnements_dateProchainRenouvellement_rappelEnvoye_idx" ON "abonnements"("dateProchainRenouvellement", "rappelEnvoye");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_idempotencyKey_key" ON "paiements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "paiements_statut_idx" ON "paiements"("statut");

-- CreateIndex
CREATE INDEX "usages_ia_eleveId_idx" ON "usages_ia"("eleveId");

-- CreateIndex
CREATE INDEX "audit_log_securite_typeEvenement_createdAt_idx" ON "audit_log_securite"("typeEvenement", "createdAt");

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_dernierEleveConsulteId_fkey" FOREIGN KEY ("dernierEleveConsulteId") REFERENCES "eleves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_eleve_links" ADD CONSTRAINT "parent_eleve_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_eleve_links" ADD CONSTRAINT "parent_eleve_links_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_ajouteParAdminId_fkey" FOREIGN KEY ("ajouteParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates_examen" ADD CONSTRAINT "dates_examen_ajouteParAdminId_fkey" FOREIGN KEY ("ajouteParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exemples_correction" ADD CONSTRAINT "exemples_correction_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exemples_correction" ADD CONSTRAINT "exemples_correction_ajouteParAdminId_fkey" FOREIGN KEY ("ajouteParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes_officiels" ADD CONSTRAINT "programmes_officiels_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes_officiels" ADD CONSTRAINT "programmes_officiels_ajouteParAdminId_fkey" FOREIGN KEY ("ajouteParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_epreuve" ADD CONSTRAINT "tentatives_epreuve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_epreuve" ADD CONSTRAINT "tentatives_epreuve_epreuveId_fkey" FOREIGN KEY ("epreuveId") REFERENCES "epreuves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections_detail" ADD CONSTRAINT "corrections_detail_epreuveId_fkey" FOREIGN KEY ("epreuveId") REFERENCES "epreuves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections_detail" ADD CONSTRAINT "corrections_detail_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections_detail" ADD CONSTRAINT "corrections_detail_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections_detail" ADD CONSTRAINT "corrections_detail_overrideParAdminId_fkey" FOREIGN KEY ("overrideParAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lacunes" ADD CONSTRAINT "lacunes_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lacunes" ADD CONSTRAINT "lacunes_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lacunes" ADD CONSTRAINT "lacunes_sourceTentativeId_fkey" FOREIGN KEY ("sourceTentativeId") REFERENCES "corrections_detail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_lacuneCibleId_fkey" FOREIGN KEY ("lacuneCibleId") REFERENCES "lacunes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_lacuneId_fkey" FOREIGN KEY ("lacuneId") REFERENCES "lacunes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_activite" ADD CONSTRAINT "sessions_activite_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations_chat" ADD CONSTRAINT "conversations_chat_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations_chat" ADD CONSTRAINT "conversations_chat_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations_chat" ADD CONSTRAINT "conversations_chat_epreuveId_fkey" FOREIGN KEY ("epreuveId") REFERENCES "epreuves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_chat" ADD CONSTRAINT "messages_chat_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations_chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "abonnements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usages_ia" ADD CONSTRAINT "usages_ia_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usages_ia" ADD CONSTRAINT "usages_ia_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "matieres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
