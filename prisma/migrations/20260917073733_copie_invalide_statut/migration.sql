-- AlterEnum
ALTER TYPE "StatutTentative" ADD VALUE 'COPIE_INVALIDE';

-- AlterTable
ALTER TABLE "tentatives_epreuve" ADD COLUMN     "messageErreur" TEXT;
