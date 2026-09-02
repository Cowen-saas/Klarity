import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { generateSecret } from "otplib";
import type { Filiere, NiveauClasse, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

/**
 * Ingestion des ProgrammeOfficiel (§4.2.3) depuis docs/programmes/. Idempotent
 * (upsert) — rejouable en dev sans dupliquer. Nécessite un Admin pour satisfaire
 * `ProgrammeOfficiel.ajouteParAdminId` (obligatoire) : un compte "seed système" est
 * créé s'il n'existe pas déjà, jamais destiné à un vrai login.
 *
 * Entièrement piloté par les données : une ligne ProgrammeOfficiel est créée pour
 * chaque couple (matière, classe, série) présent dans les 9 fichiers JSON, et
 * `Matiere.filiereRequise` / `classesConcernees` sont l'union des séries/classes où
 * la matière apparaît. Ajout v1.29 (§2.1, §4.2) : SVT est désormais présente dans
 * les sections `svt` des programmes des séries C, D et TI (1ère + Terminale) en plus
 * de la série A et de la 3ème — le seed en dérive donc automatiquement
 * `filiereRequise = {A, C, D, TI}` pour SVT et matérialise les 6 nouveaux couples.
 * Le socle de référence §2.1 passe ainsi de 9 à 15 couples matière/classe/série.
 */

const PROGRAMMES_DIR = path.join(__dirname, "..", "docs", "programmes");
const SEED_ADMIN_EMAIL = "seed@klarity.local";

// Clé JSON (docs/programmes/**/programme_*.json, objet "matieres") -> Matiere.nom (§4.1).
const MATIERE_LABELS: Record<string, string> = {
  mathematiques: "Mathématiques",
  francais: "Français",
  pct: "PCT",
  svt: "SVT",
  philosophie: "Philosophie",
  physique: "Physique",
  chimie: "Chimie",
  programmation: "Programmation",
  reseaux: "Réseau",
  systeme_information: "Système d'information",
};

interface ProgrammeFichier {
  classe: NiveauClasse;
  filiere: Filiere | null;
  matieres: Record<string, Prisma.InputJsonValue>;
}

function parseClasseFiliere(dirName: string): { classe: NiveauClasse; filiere: Filiere | null } {
  if (dirName === "Troisième") return { classe: "TROISIEME", filiere: null };
  const [niveau, filiereLettre] = dirName.split(" ");
  const classe: NiveauClasse = niveau === "Première" ? "PREMIERE" : "TERMINALE";
  return { classe, filiere: filiereLettre as Filiere };
}

function lireProgrammes(): ProgrammeFichier[] {
  const dirs = readdirSync(PROGRAMMES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  return dirs.map((dir) => {
    const { classe, filiere } = parseClasseFiliere(dir.name);
    const fichierJson = readdirSync(path.join(PROGRAMMES_DIR, dir.name)).find((f) => f.endsWith(".json"));
    if (!fichierJson) throw new Error(`Aucun fichier .json trouvé dans docs/programmes/${dir.name}`);
    const data = JSON.parse(readFileSync(path.join(PROGRAMMES_DIR, dir.name, fichierJson), "utf-8"));
    return { classe, filiere, matieres: data.matieres ?? {} };
  });
}

/**
 * Upsert manuel pour les lignes filiere=NULL (3ème uniquement) : Postgres traite NULL
 * comme distinct dans une contrainte unique, donc `ON CONFLICT (matiereId, classe,
 * filiere)` ne matche jamais deux lignes filiere=NULL entre elles — un upsert Prisma
 * classique dupliquerait la ligne à chaque reseed (avertissement déjà noté dans le
 * schéma, §4.7). Les combinaisons Première/Terminale ont toujours une filiere non-null
 * (A/C/D/TI) et passent par le upsert standard sans ce problème.
 */
async function upsertProgrammeOfficiel(params: {
  matiereId: string;
  classe: NiveauClasse;
  filiere: Filiere | null;
  contenuStructure: Prisma.InputJsonValue;
  adminId: string;
}) {
  const { matiereId, classe, filiere, contenuStructure, adminId } = params;

  if (filiere === null) {
    const existant = await prisma.programmeOfficiel.findFirst({ where: { matiereId, classe, filiere: null } });
    if (existant) {
      await prisma.programmeOfficiel.update({ where: { id: existant.id }, data: { contenuStructure } });
    } else {
      await prisma.programmeOfficiel.create({
        data: { matiereId, classe, filiere: null, contenuStructure, ajouteParAdminId: adminId },
      });
    }
    return;
  }

  await prisma.programmeOfficiel.upsert({
    where: { matiereId_classe_filiere: { matiereId, classe, filiere } },
    update: { contenuStructure },
    create: { matiereId, classe, filiere, contenuStructure, ajouteParAdminId: adminId },
  });
}

async function main() {
  const admin = await prisma.admin.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: SEED_ADMIN_EMAIL,
      motDePasseHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      twoFactorSecret: generateSecret(),
      role: "SUPERADMIN",
    },
  });

  const programmes = lireProgrammes();

  const unions = new Map<string, { classes: Set<NiveauClasse>; filieres: Set<Filiere> }>();
  for (const { classe, filiere, matieres } of programmes) {
    for (const cle of Object.keys(matieres)) {
      if (!MATIERE_LABELS[cle]) {
        console.warn(`[seed] Clé matière inconnue ignorée : "${cle}"`);
        continue;
      }
      const union = unions.get(cle) ?? { classes: new Set(), filieres: new Set() };
      union.classes.add(classe);
      if (filiere) union.filieres.add(filiere);
      unions.set(cle, union);
    }
  }

  const matiereIds = new Map<string, string>();
  for (const [cle, { classes, filieres }] of unions) {
    const nom = MATIERE_LABELS[cle];
    const matiere = await prisma.matiere.upsert({
      where: { nom },
      update: {
        classesConcernees: Array.from(classes),
        filiereRequise: Array.from(filieres),
        banqueDisponible: true,
      },
      create: {
        nom,
        classesConcernees: Array.from(classes),
        filiereRequise: Array.from(filieres),
        banqueDisponible: true,
      },
    });
    matiereIds.set(cle, matiere.id);
  }

  let count = 0;
  for (const { classe, filiere, matieres } of programmes) {
    for (const [cle, contenu] of Object.entries(matieres)) {
      const matiereId = matiereIds.get(cle);
      if (!matiereId) continue;
      await upsertProgrammeOfficiel({ matiereId, classe, filiere, contenuStructure: contenu, adminId: admin.id });
      count++;
    }
  }

  console.log(`[seed] ${matiereIds.size} matière(s), ${count} ProgrammeOfficiel upsertés.`);
}

main()
  .catch((err) => {
    console.error("[seed] échec :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
