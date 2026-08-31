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
