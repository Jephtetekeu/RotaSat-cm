// Scénarios de stress test construits à partir de l'historique NASA POWER (2015–2024).
// Chaque scénario correspond à une année réellement observée, choisie par percentile :
//   normal = année médiane de pluie, sec = percentile 20 de pluie, chaud = percentile 80 de T° max.
// On ne fabrique aucune année synthétique : le scénario EST l'année réelle retenue.

const DEFINITIONS = [
  { id: 'normal', nom: 'Année normale', critere: 'pluie_mm', percentile: 50, libelle: 'année médiane de pluie' },
  { id: 'sec', nom: 'Année sèche', critere: 'pluie_mm', percentile: 20, libelle: 'percentile 20 de la pluie annuelle' },
  { id: 'chaud', nom: 'Année chaude', critere: 'tmax_moy_c', percentile: 80, libelle: 'percentile 80 de la T° max moyenne' }
];

/** Année au rang du percentile (rang le plus proche, sur les années complètes uniquement). */
export function anneeAuPercentile(annees, critere, p) {
  const valides = annees.filter(a => a[critere] !== null).sort((a, b) => a[critere] - b[critere]);
  if (!valides.length) return null;
  const rang = Math.round((p / 100) * (valides.length - 1));
  return { annee: valides[rang], rang: rang + 1, sur: valides.length };
}

/**
 * @param {object} field résultat de getField()
 * @returns {Array<{id, nom, annee, pluie_mm, tmax_moy_c, jours_sup_35, gwetroot_moy, mensuel, methode}>}
 */
export function construireScenarios(field) {
  return DEFINITIONS.map(def => {
    const choix = anneeAuPercentile(field.annees, def.critere, def.percentile);
    if (!choix) return { id: def.id, nom: def.nom, annee: null, methode: 'données insuffisantes' };
    const a = choix.annee;
    return {
      id: def.id,
      nom: def.nom,
      annee: a.annee,
      pluie_mm: a.pluie_mm,
      tmax_moy_c: a.tmax_moy_c,
      jours_sup_35: a.jours_sup_35,
      gwetroot_moy: a.gwetroot_moy,
      mensuel: a.mensuel,
      methode: `${def.libelle} : ${a.annee} (rang ${choix.rang}/${choix.sur} sur ${field.periode.debut.slice(0, 4)}–${field.periode.fin.slice(0, 4)})`,
      source: { parametre: def.critere === 'pluie_mm' ? 'PRECTOTCORR' : 'T2M_MAX', ...field.provenance }
    };
  });
}
