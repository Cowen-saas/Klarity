-- CreateTable
CREATE TABLE "parametres_plateforme" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "modifieParAdminId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametres_plateforme_pkey" PRIMARY KEY ("cle")
);

-- AddForeignKey
ALTER TABLE "parametres_plateforme" ADD CONSTRAINT "parametres_plateforme_modifieParAdminId_fkey" FOREIGN KEY ("modifieParAdminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
