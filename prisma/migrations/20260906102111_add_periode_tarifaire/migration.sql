-- CreateTable
CREATE TABLE "periodes_tarifaires" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "prixApplique" DECIMAL(10,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ajouteParAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodes_tarifaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "periodes_tarifaires_actif_dateDebut_dateFin_idx" ON "periodes_tarifaires"("actif", "dateDebut", "dateFin");

-- AddForeignKey
ALTER TABLE "periodes_tarifaires" ADD CONSTRAINT "periodes_tarifaires_ajouteParAdminId_fkey" FOREIGN KEY ("ajouteParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
