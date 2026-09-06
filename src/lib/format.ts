/**
 * Numéro de téléphone camerounais — format unique dans toute l'application.
 *
 * Saisie et affichage : `+237 6XX XX XX XX`. Le préfixe `+237 6` est **fixe**
 * (indicatif Cameroun + premier chiffre des mobiles) : l'utilisateur ne saisit
 * que les **8 chiffres** qui suivent le `6`, groupés `XX XX XX XX`.
 *
 * Forme canonique stockée / transmise : `+2376XXXXXXXX` (préfixe `+2376` + 8
 * chiffres, sans espaces). C'est déjà la forme produite par le parcours de
 * paiement (`/api/paiement/initier`) et celle des lignes `Parent.telephone`
 * existantes — la normaliser partout garantit qu'un même numéro tapé avec ou
 * sans espaces ne crée jamais deux comptes / deux entrées OTP.
 */

/** Préfixe fixe affiché devant la saisie (indicatif + « 6 » des mobiles). */
export const TELEPHONE_PREFIXE_AFFICHE = "+237 6";
/** Préfixe de la forme canonique (sans espace). */
export const TELEPHONE_PREFIXE_CANONIQUE = "+2376";
/** Nombre de chiffres saisis par l'utilisateur (après le « 6 » fixe). */
export const TELEPHONE_CHIFFRES_LOCAUX = 8;

/**
 * Extrait, depuis n'importe quelle saisie (collage inclus), les chiffres
 * locaux — ceux qui suivent `+237 6` — en enlevant un éventuel `237` puis un
 * éventuel `6` de tête. Tronque à 8.
 */
export function chiffresLocauxTelephone(saisie: string): string {
  let d = saisie.replace(/\D/g, "");
  if (d.startsWith("237")) d = d.slice(3);
  if (d.startsWith("6")) d = d.slice(1);
  return d.slice(0, TELEPHONE_CHIFFRES_LOCAUX);
}

/** Groupe les chiffres locaux par 2 : `12345678` → `12 34 56 78`. */
export function formaterChiffresLocaux(chiffres: string): string {
  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Chiffres locaux → forme canonique `+2376XXXXXXXX` (préfixe seul si vide). */
export function versTelephoneCanonique(chiffresLocaux: string): string {
  return TELEPHONE_PREFIXE_CANONIQUE + chiffresLocaux;
}

/** Un numéro canonique complet contient exactement `+2376` + 8 chiffres. */
export function estTelephoneCamerounaisComplet(canonique: string): boolean {
  return new RegExp(`^\\+2376\\d{${TELEPHONE_CHIFFRES_LOCAUX}}$`).test(canonique);
}

/**
 * Normalise une saisie libre vers la forme canonique, ou `null` si elle ne
 * correspond pas à un mobile camerounais (`6` + 8 chiffres). À utiliser côté
 * serveur avant tout stockage / recherche.
 */
export function normaliserTelephoneCamerounais(saisie: string): string | null {
  const locaux = chiffresLocauxTelephone(saisie);
  if (locaux.length !== TELEPHONE_CHIFFRES_LOCAUX) return null;
  return versTelephoneCanonique(locaux);
}

/** Masque un numéro de téléphone pour affichage (ex. OTP, §2.2) : garde l'indicatif, le
 * premier chiffre et les 2 derniers, masque le reste. */
export function masquerTelephone(tel: string): string {
  const chiffres = tel.replace(/\D/g, "");
  const indicatif = chiffres.slice(0, 3);
  const reste = chiffres.slice(3);
  if (reste.length < 4) return tel;
  const premier = reste[0];
  const dernier = reste.slice(-2);
  const nbMasques = Math.max(reste.length - 3, 0);
  const groupes = "•".repeat(nbMasques).match(/.{1,2}/g) ?? [];
  return `+${indicatif} ${premier}${groupes.length ? " " + groupes.join(" ") : ""} ${dernier}`.replace(/\s+/g, " ").trim();
}
