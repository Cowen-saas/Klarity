import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Génération du code élève ELE-XXX-XXX (§2.1, réf. sécurité §2) : aléa
 * cryptographique (node:crypto), jamais Math.random(). Alphabet restreint,
 * sans caractères ambigus (0/O, 1/I/L exclus) pour rester lisible quand
 * l'élève le dicte à l'oral à son parent ou le recopie à la main.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SEGMENT_LENGTH = 3;
const MAX_ATTEMPTS = 10;

function genererSegment(): string {
  return Array.from({ length: SEGMENT_LENGTH }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
}

export function genererCodeEleve(): string {
  return `ELE-${genererSegment()}-${genererSegment()}`;
}

/** Retire un code déjà pris (collision improbable vu l'entropie, mais le `@unique` Prisma doit rester la garantie finale). */
export async function genererCodeEleveUnique(): Promise<string> {
  for (let tentative = 0; tentative < MAX_ATTEMPTS; tentative++) {
    const code = genererCodeEleve();
    const existant = await prisma.eleve.findUnique({ where: { codeEleve: code }, select: { id: true } });
    if (!existant) return code;
  }
  throw new Error("Impossible de générer un code élève unique après plusieurs tentatives.");
}
