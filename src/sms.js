// Canal texte : « MAIS DSCHANG » → réponse de 160 caractères maximum (1 SMS),
// sans accents pour rester compatible avec tous les téléphones.
// Branchable plus tard sur une passerelle SMS / WhatsApp : la fonction ne dépend pas d'Express.

export const LONGUEUR_MAX = 160;

/** minuscules, sans accents, ponctuation → espaces */
export const normaliser = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const AIDE = 'RotaSat: envoyez CULTURE VILLE, ex: MAIS DSCHANG. Villes: DSCHANG, GAROUA, MAROUA.';

function trouverZone(texte, zones) {
  const mots = ` ${texte} `;
  // 1) la ville entre parenthèses dans le nom, 2) la région (la plus longue d'abord : « extreme nord » avant « nord »)
  const parVille = zones.find(z => mots.includes(` ${normaliser(z.nom.match(/\(([^)]+)\)/)?.[1] ?? z.id)} `));
  if (parVille) return parVille;
  return [...zones].sort((a, b) => b.region.length - a.region.length).find(z => mots.includes(` ${normaliser(z.region)} `)) ?? null;
}

function trouverCulture(texte, cultures) {
  const mots = ` ${texte} `;
  return cultures.find(c => mots.includes(` ${normaliser(c.id)} `) || mots.includes(` ${normaliser(c.nom.split('(')[0])} `)) ?? null;
}

const ville = z => z.nom.match(/\(([^)]+)\)/)?.[1] ?? z.nom;
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {string} texte message reçu
 * @param {{zones: object[], catalogue: object, recommander: (zone: object) => Promise<object>}} deps
 * @returns {Promise<{reponse: string, longueur: number, zone: string|null, culture: string|null}>}
 */
export async function repondreSms(texte, { zones, catalogue, recommander }) {
  const t = normaliser(texte);
  const zone = trouverZone(t, zones);
  if (!zone) return fin(AIDE, null, null);

  const culture = trouverCulture(t, catalogue.cultures);
  const reco = await recommander(zone);
  if (!reco.rotations.length) return fin(`RotaSat ${ville(zone)}: aucune rotation pluviale possible selon les donnees NASA. Voir un technicien MINADER.`, zone, culture);

  // La meilleure rotation qui contient la culture demandée, sinon la meilleure tout court.
  const avecCulture = culture ? reco.rotations.find(r => r.cultures.some(c => c.id === culture.id)) : null;
  const rot = avecCulture ?? reco.rotations[0];
  const sec = rot.scenarios.find(s => s.scenario === 'sec');
  const pire = rot.scenarios.reduce((a, b) => (b.score < a.score ? b : a));

  const sequence = rot.cultures.map(c => c.nom.split(' (')[0]).join('>');
  const tete = `RotaSat ${ville(zone)}: ${sequence} ${rot.score_moyen}/100.`;
  const absente = culture && !avecCulture ? `${culture.nom.split(' (')[0]} non retenu ici.` : null;
  const alerteDonnee = pire.alertes[0] ?? null;
  const alerte = alerteDonnee
    ? `Alerte: ${alerteDonnee}`
    : sec ? `Annee seche ${sec.annee} (${Math.round(sec.saisons[0].pluie_mm)} mm en saison): ${sec.score}/100.` : null;
  const pied = 'A valider avec technicien MINADER.';

  // On retire les éléments optionnels tant que le message dépasse 160 caractères.
  const essais = [
    [tete, absente, alerte, pied],
    [tete, alerte, pied],
    [tete, absente, pied],
    [tete, pied],
    [tete]
  ];
  for (const parts of essais) {
    const msg = sansAccent(parts.filter(Boolean).join(' '));
    if (msg.length <= LONGUEUR_MAX) return fin(msg, zone, culture);
  }
  return fin(sansAccent(tete).slice(0, LONGUEUR_MAX), zone, culture);
}

function fin(reponse, zone, culture) {
  return { reponse, longueur: reponse.length, zone: zone?.id ?? null, culture: culture?.id ?? null };
}
