import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { generateSecret } from "otplib";
import type { Filiere, NiveauClasse, Prisma, TypeExerciceCorrection } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

/**
 * Seed de configuration (données versionnées, pas du contenu élève). Idempotent —
 * rejouable en dev sans dupliquer. Nécessite un Admin pour satisfaire les champs
 * `ajouteParAdminId` obligatoires : un compte "seed système" est créé s'il n'existe
 * pas déjà, jamais destiné à un vrai login.
 *
 * 1. ProgrammeOfficiel (§4.2.3) depuis docs/programmes/ — entièrement piloté par les
 *    données : une ligne par couple (matière, classe, série) présent dans les 9
 *    fichiers JSON, et `Matiere.filiereRequise` / `classesConcernees` sont l'union
 *    des séries/classes où la matière apparaît. Ajout v1.29 (§2.1, §4.2) : SVT est
 *    désormais présente dans les sections `svt` des programmes C, D et TI (1ère +
 *    Terminale) en plus de la série A et de la 3ème — le seed en dérive
 *    `filiereRequise = {A, C, D, TI}` pour SVT. Socle de référence §2.1 : 15 couples.
 *
 * 2. ExempleCorrection (§4.2.2) depuis docs/baremes/JSON/ — un barème structuré par
 *    type d'exercice méthodologique (Français / Philosophie), chargé dans
 *    `baremeStructure` tel quel (contenu JSON complet, non transformé). Les cinq
 *    types sont couverts : DISSERTATION_PHILO, DISSERTATION_LITTERAIRE,
 *    CONTRACTION_TEXTE, DISCUSSION, COMMENTAIRE_COMPOSE (ajouté CDC v1.30).
 *
 * 3. Exemples few-shot depuis docs/baremes/exemples/exemple_*.json (préparés à
 *    partir de copies corrigées réelles) — complètent `enonceModele` /
 *    `exempleReponseModele` / `notesMethodologiques` de la ligne ExempleCorrection
 *    déjà créée en 2, sans toucher `baremeStructure`. Dossier partiel toléré : seuls
 *    les types présents sont complétés (les autres gardent leurs 3 champs vides).
 */

const PROGRAMMES_DIR = path.join(__dirname, "..", "docs", "programmes");
const BAREMES_JSON_DIR = path.join(__dirname, "..", "docs", "baremes", "JSON");
const BAREMES_EXEMPLES_DIR = path.join(__dirname, "..", "docs", "baremes", "exemples");
const SEED_ADMIN_EMAIL = "seed@klarity.local";

const TYPES_EXERCICE_VALIDES: readonly TypeExerciceCorrection[] = [
  "DISSERTATION_PHILO",
  "DISSERTATION_LITTERAIRE",
  "CONTRACTION_TEXTE",
  "DISCUSSION",
  "COMMENTAIRE_COMPOSE",
];

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

interface BaremeFichier {
  typeExercice: string;
  matiere: string;
  baremeStructure: Prisma.InputJsonValue;
  [autre: string]: unknown;
}

/**
 * Charge les barèmes structurés de docs/baremes/JSON/ dans ExempleCorrection.
 * `baremeStructure` reçoit le contenu JSON complet du fichier, tel quel. Pas de
 * contrainte d'unicité DB sur (matiereId, typeExercice) — l'idempotence est gérée
 * à la main (findFirst + update|create), comme pour les ProgrammeOfficiel filiere=NULL.
 */
async function seedExemplesCorrection(adminId: string): Promise<number> {
  const fichiers = readdirSync(BAREMES_JSON_DIR).filter((f) => f.endsWith(".json"));
  let count = 0;

  for (const nomFichier of fichiers) {
    const brut = readFileSync(path.join(BAREMES_JSON_DIR, nomFichier), "utf-8");
    const data = JSON.parse(brut) as BaremeFichier;

    if (!TYPES_EXERCICE_VALIDES.includes(data.typeExercice as TypeExerciceCorrection)) {
      throw new Error(
        `${nomFichier} : typeExercice "${data.typeExercice}" hors enum TypeExerciceCorrection`,
      );
    }
    const typeExercice = data.typeExercice as TypeExerciceCorrection;

    const matiere = await prisma.matiere.findUnique({ where: { nom: data.matiere } });
    if (!matiere) {
      throw new Error(`${nomFichier} : matière "${data.matiere}" introuvable (seed programmes d'abord)`);
    }

    // `baremeStructure` = le fichier JSON complet, sans transformation (tel quel).
    const baremeStructure = data as unknown as Prisma.InputJsonValue;

    const existant = await prisma.exempleCorrection.findFirst({
      where: { matiereId: matiere.id, typeExercice },
    });

    if (existant) {
      await prisma.exempleCorrection.update({
        where: { id: existant.id },
        data: { baremeStructure },
      });
    } else {
      await prisma.exempleCorrection.create({
        data: {
          matiereId: matiere.id,
          typeExercice,
          baremeStructure,
          enonceModele: "",
          exempleReponseModele: "",
          notesMethodologiques: "",
          ajouteParAdminId: adminId,
        },
      });
    }
    count++;
  }

  return count;
}

interface ExempleFewShotFichier {
  typeExercice: string;
  matiere: string;
  enonceModele: unknown;
  exempleReponseModele: unknown;
  notesMethodologiques: unknown;
  [autre: string]: unknown;
}

/** Champ text : chaîne telle quelle, ou JSON indenté et lisible si structuré. */
function versTexte(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

/**
 * Complète les 3 champs few-shot (`enonceModele`, `exempleReponseModele`,
 * `notesMethodologiques`) des lignes `ExempleCorrection` déjà créées par
 * `seedExemplesCorrection()`, depuis `docs/baremes/exemples/exemple_*.json`
 * (préparés à partir de copies corrigées réelles). Ne touche jamais à
 * `baremeStructure`. Idempotent (update pur). Le dossier peut être absent ou
 * partiel : seuls les types présents sont complétés.
 */
async function seedExemplesFewShot(): Promise<number> {
  if (!existsSync(BAREMES_EXEMPLES_DIR)) return 0;
  const fichiers = readdirSync(BAREMES_EXEMPLES_DIR).filter((f) => f.endsWith(".json"));
  let count = 0;

  for (const nomFichier of fichiers) {
    const data = JSON.parse(
      readFileSync(path.join(BAREMES_EXEMPLES_DIR, nomFichier), "utf-8"),
    ) as ExempleFewShotFichier;

    if (!TYPES_EXERCICE_VALIDES.includes(data.typeExercice as TypeExerciceCorrection)) {
      throw new Error(`${nomFichier} : typeExercice "${data.typeExercice}" hors enum`);
    }
    const typeExercice = data.typeExercice as TypeExerciceCorrection;

    const matiere = await prisma.matiere.findUnique({ where: { nom: data.matiere } });
    if (!matiere) throw new Error(`${nomFichier} : matière "${data.matiere}" introuvable`);

    const ligne = await prisma.exempleCorrection.findFirst({
      where: { matiereId: matiere.id, typeExercice },
    });
    if (!ligne) {
      throw new Error(
        `${nomFichier} : aucune ligne ExempleCorrection (${data.matiere} / ${typeExercice}) — ` +
          `le barème correspondant doit être chargé d'abord (docs/baremes/JSON/)`,
      );
    }

    // Uniquement les 3 champs few-shot — baremeStructure laissé intact.
    await prisma.exempleCorrection.update({
      where: { id: ligne.id },
      data: {
        enonceModele: versTexte(data.enonceModele),
        exempleReponseModele: versTexte(data.exempleReponseModele),
        notesMethodologiques: versTexte(data.notesMethodologiques),
      },
    });
    count++;
  }

  return count;
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

  const exemples = await seedExemplesCorrection(admin.id);
  console.log(`[seed] ${exemples} ExempleCorrection (barèmes §4.2.2) upsertés.`);

  const fewShot = await seedExemplesFewShot();
  console.log(`[seed] ${fewShot} ExempleCorrection complété(s) avec un exemple few-shot.`);
}

main()
  .catch((err) => {
    console.error("[seed] échec :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
