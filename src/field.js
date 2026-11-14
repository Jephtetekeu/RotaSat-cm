// Résumé climatique d'un champ sur 10 ans, calculé à partir des séries journalières NASA POWER.
// Toutes les valeurs viennent de l'API ; une valeur manquante reste null (jamais 0).
import { getDaily } from './nasaPower.js';

export const PERIODE = { debut: '20150101', fin: '20241231' };
export const SEUIL_CHALEUR = 35;      // °C, jour de forte chaleur si T2M_MAX > 35
export const SEUIL_SAISON_PLUIE = 100; // mm/mois en moyenne
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

const memo = new Map();

const moyenne = vals => {
  const v = vals.filter(x => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const arrondi = (x, n = 1) => (x === null ? null : Math.round(x * 10 ** n) / 10 ** n);

/** Regroupe une série {YYYYMMDD: v} en { année: { mois(0-11): [valeurs] } }. */
function grouper(serie) {
  const g = {};
  for (const [d, v] of Object.entries(serie)) {
    const an = d.slice(0, 4);
    const m = Number(d.slice(4, 6)) - 1;
    ((g[an] ??= {})[m] ??= []).push(v);
  }
  return g;
}

/** Somme mensuelle : null si le mois contient une valeur manquante (pas de total partiel trompeur). */
const somme = vals => (vals.some(v => v === null) ? null : vals.reduce((a, b) => a + b, 0));

export function resumer(parametres) {
  const pluie = grouper(parametres.PRECTOTCORR);
  const tmax = grouper(parametres.T2M_MAX);
  const gwet = grouper(parametres.GWETROOT);
  const annees = Object.keys(pluie).sort();

  // Par année et par mois
  const parAnnee = annees.map(an => {
    const pluieMois = [], tmaxMois = [], chaudMois = [], gwetMois = [];
    for (let m = 0; m < 12; m++) {
      pluieMois.push(somme(pluie[an]?.[m] ?? [null]));
      tmaxMois.push(moyenne(tmax[an]?.[m] ?? []));
      const jours = (tmax[an]?.[m] ?? []).filter(v => v !== null);
      chaudMois.push(jours.length ? jours.filter(v => v > SEUIL_CHALEUR).length : null);
      gwetMois.push(moyenne(gwet[an]?.[m] ?? []));
    }
    const pluieAn = pluieMois.some(v => v === null) ? null : pluieMois.reduce((a, b) => a + b, 0);
    return {
      annee: Number(an),
      pluie_mm: arrondi(pluieAn),
      tmax_moy_c: arrondi(moyenne(tmaxMois)),
      jours_sup_35: chaudMois.some(v => v === null) ? null : chaudMois.reduce((a, b) => a + b, 0),
      gwetroot_moy: arrondi(moyenne(gwetMois), 2),
      mensuel: {
        pluie_mm: pluieMois.map(v => arrondi(v)),
        tmax_c: tmaxMois.map(v => arrondi(v)),
        jours_sup_35: chaudMois,
        gwetroot: gwetMois.map(v => arrondi(v, 2))
      }
    };
  });

  // Moyennes mensuelles sur la période
  const mensuel = MOIS.map((nom, m) => ({
    mois: nom,
    pluie_mm: arrondi(moyenne(parAnnee.map(a => a.mensuel.pluie_mm[m]))),
    tmax_c: arrondi(moyenne(parAnnee.map(a => a.mensuel.tmax_c[m]))),
    jours_sup_35: arrondi(moyenne(parAnnee.map(a => a.mensuel.jours_sup_35[m]))),
    gwetroot: arrondi(moyenne(parAnnee.map(a => a.mensuel.gwetroot[m])), 2)
  }));

  const humides = mensuel.map((x, i) => (x.pluie_mm !== null && x.pluie_mm > SEUIL_SAISON_PLUIE ? i : -1)).filter(i => i >= 0);

  return {
    mensuel,
    annuel: {
      pluie_mm: arrondi(moyenne(parAnnee.map(a => a.pluie_mm))),
      tmax_moy_c: arrondi(moyenne(parAnnee.map(a => a.tmax_moy_c))),
      jours_sup_35: arrondi(moyenne(parAnnee.map(a => a.jours_sup_35))),
      gwetroot_moy: arrondi(moyenne(parAnnee.map(a => a.gwetroot_moy)), 2)
    },
    saison_pluies: humides.length
      ? {
          debut: MOIS[humides[0]],
          fin: MOIS[humides[humides.length - 1]],
          mois_humides: humides.length,
          regle: `premier et dernier mois avec plus de ${SEUIL_SAISON_PLUIE} mm de pluie en moyenne`
        }
      : { debut: null, fin: null, mois_humides: 0, regle: `aucun mois au-dessus de ${SEUIL_SAISON_PLUIE} mm en moyenne` },
    annees: parAnnee
  };
}

/** Valide et normalise les coordonnées (arrondies à 0,01° pour mutualiser le cache). */
export function lireCoordonnees(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100 };
}

export async function getField(lat, lon) {
  const cle = `${lat},${lon}`;
  if (memo.has(cle)) return memo.get(cle);
  const promesse = (async () => {
    const r = await getDaily(lat, lon, PERIODE.debut, PERIODE.fin, ['PRECTOTCORR', 'T2M_MAX', 'GWETROOT']);
    return {
      lat, lon,
      periode: { debut: '2015-01-01', fin: '2024-12-31' },
      ...resumer(r.parametres),
      unites: { pluie: 'mm', tmax: '°C', gwetroot: 'fraction 0–1 (humidité de la zone racinaire)' },
      provenance: { ...r.provenance, parametres: ['PRECTOTCORR', 'T2M_MAX', 'GWETROOT'] }
    };
  })();
  memo.set(cle, promesse);
  promesse.catch(() => memo.delete(cle));
  return promesse;
}
