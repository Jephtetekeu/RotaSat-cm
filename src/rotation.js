// Génération et évaluation de rotations sur 3 saisons.
// Entrées : catalogue indicatif des cultures, résumé climatique NASA POWER, scénarios, sol, priorités.
// Chaque score est accompagné de raisons[] qui citent la donnée qui l'explique.

const NB_SAISONS = 3;
const SEUIL_EXCLUSION = 0.6;   // pluie < 60 % du seuil de la culture → exclue pour ce scénario
const JOURS_PAR_MOIS = 30.4;
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

// Effet indicatif de la texture saisie sur la pluie réellement utile (à valider).
const TEXTURES = {
  sableux: { facteur: 0.85, texte: 'sol sableux : faible rétention, pluie utile réduite (facteur indicatif 0,85)' },
  limoneux: { facteur: 1, texte: 'sol limoneux : rétention moyenne' },
  argileux: { facteur: 1, texte: 'sol argileux : bonne rétention, mais risque d\'engorgement en forte pluie' }
};

const POWER = 'NASA POWER';
const pct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);

/** Découpe la saison des pluies en saisons de culture (1 ou 2 cycles par an). */
export function decouperSaisons(field) {
  const humides = field.mensuel.map((m, i) => (m.pluie_mm > 100 ? i : -1)).filter(i => i >= 0);
  if (!humides.length) return { cycles_par_an: 0, saisons: [] };
  const deuxCycles = humides.length >= 7;
  const moitie = Math.ceil(humides.length / 2);
  const cycles = deuxCycles ? [humides.slice(0, moitie), humides.slice(moitie)] : [humides];
  const saisons = [];
  for (let k = 0; k < NB_SAISONS; k++) {
    const mois = cycles[k % cycles.length];
    const an = Math.floor(k / cycles.length) + 1;
    saisons.push({
      numero: k + 1,
      libelle: deuxCycles ? `Année ${an} — saison ${k % 2 === 0 ? 'A' : 'B'} (${MOIS[mois[0]]}–${MOIS[mois.at(-1)]})`
                          : `Année ${an} — saison des pluies (${MOIS[mois[0]]}–${MOIS[mois.at(-1)]})`,
      mois
    });
  }
  return {
    cycles_par_an: cycles.length,
    explication: deuxCycles
      ? `Saison des pluies de ${humides.length} mois (> 100 mm/mois en moyenne, NASA POWER 2015–2024) : découpée en 2 cycles de culture par an.`
      : `Saison des pluies de ${humides.length} mois (> 100 mm/mois en moyenne, NASA POWER 2015–2024) : 1 cycle de culture par an.`,
    saisons
  };
}

/** Conditions d'une saison de culture dans l'année d'un scénario. */
function conditions(scenario, saison) {
  const m = scenario.mensuel;
  const vals = (arr) => saison.mois.map(i => arr[i]);
  const somme = arr => (arr.some(v => v === null) ? null : arr.reduce((a, b) => a + b, 0));
  const moy = arr => { const v = arr.filter(x => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const periode = `${scenario.annee} ${MOIS[saison.mois[0]]}–${MOIS[saison.mois.at(-1)]}`;
  return {
    periode,
    pluie_mm: somme(vals(m.pluie_mm)),
    pluie_mois: vals(m.pluie_mm),
    pluie_max_mois_mm: Math.max(...vals(m.pluie_mm).filter(v => v !== null)),
    jours_sup_35: somme(vals(m.jours_sup_35)),
    gwetroot: moy(vals(m.gwetroot)),
    jours: Math.round(saison.mois.length * JOURS_PAR_MOIS)
  };
}

const raison = (texte, donnee) => ({ texte, donnee });
const donneePower = (parametre, periode, valeur, unite, lat, lon) =>
  ({ source: POWER, parametre, periode, valeur: valeur === null ? null : Math.round(valeur * 100) / 100, unite, lat, lon });
const donneeCatalogue = culture => ({ source: 'catalogue indicatif data/crops.cm.json', culture: culture.id, a_valider: true });

/** Évalue une culture dans une saison donnée d'un scénario. */
function evaluerCulture(culture, c, ctx) {
  const seuil = ctx.seuils[culture.besoin_eau];
  const pluieUtile = c.pluie_mm === null ? null : c.pluie_mm * ctx.texture.facteur;
  const ratio = pluieUtile === null ? null : pluieUtile / seuil;
  const exclue = ratio !== null && ratio < SEUIL_EXCLUSION;
  // Eau évaluée mois par mois : le besoin saisonnier est réparti sur les mois de la saison,
  // pour qu'un démarrage tardif ou un trou de pluie compte. La tolérance à la sécheresse compense une partie du déficit.
  const besoinMois = seuil / c.pluie_mois.length;
  const bonus = (culture.tolerance_secheresse - 1) * 0.15;
  const parMois = c.pluie_mois.map(v => (v === null ? null : Math.min(1, (v * ctx.texture.facteur) / besoinMois + bonus)));
  const valides = parMois.filter(v => v !== null);
  const eau = valides.length ? valides.reduce((a, b) => a + b, 0) / valides.length : 0.5;
  const moisSecs = c.pluie_mois.map((v, i) => ({ v, i })).filter(({ v }) => v !== null && v * ctx.texture.facteur < besoinMois * 0.5);
  const fracChaud = c.jours_sup_35 === null ? 0 : c.jours_sup_35 / c.jours;
  const chaleur = 1 - fracChaud * ({ 1: 1, 2: 0.5, 3: 0 }[culture.tolerance_chaleur]);
  return { seuil, pluieUtile, ratio, exclue, eau, chaleur, fracChaud, besoinMois, moisSecs };
}

function moyenne(a) { return a.reduce((x, y) => x + y, 0) / a.length; }

/** Score d'une rotation (3 cultures) pour un scénario. */
function scorerScenario(rotation, scenario, ctx) {
  const { lat, lon } = ctx;
  const parSaison = rotation.map((culture, k) => {
    const c = conditions(scenario, ctx.saisons[k]);
    return { culture, saison: ctx.saisons[k], c, e: evaluerCulture(culture, c, ctx) };
  });

  const raisons = { eau: [], sol: [], erosion: [], marche: [], revenu: [], chaleur: [] };
  const alertes = [];

  for (const { culture, saison, c, e } of parSaison) {
    const pluie = donneePower('PRECTOTCORR', c.periode, c.pluie_mm, 'mm', lat, lon);
    const utile = ctx.texture.facteur !== 1 ? ` (${Math.round(e.pluieUtile)} mm utiles sur sol ${ctx.sol.texture})` : '';
    if (e.exclue) {
      alertes.push(`${culture.nom} (saison ${saison.numero}) : pluie ${Math.round(e.pluieUtile)} mm, bien sous le seuil indicatif de ${e.seuil} mm.`);
      raisons.eau.push(raison(`${culture.nom} exclue en saison ${saison.numero} : ${Math.round(c.pluie_mm)} mm de pluie${utile}, moins de ${Math.round(SEUIL_EXCLUSION * 100)} % du seuil indicatif (${e.seuil} mm).`, pluie));
    } else if (e.ratio !== null && e.ratio < 1) {
      raisons.eau.push(raison(`${culture.nom} en saison ${saison.numero} : ${Math.round(c.pluie_mm)} mm de pluie${utile}, sous le seuil indicatif (${e.seuil} mm) — tolérance à la sécheresse ${culture.tolerance_secheresse}/3.`, pluie));
    } else {
      raisons.eau.push(raison(`${culture.nom} en saison ${saison.numero} : ${Math.round(c.pluie_mm)} mm de pluie${utile}, au-dessus du seuil indicatif (${e.seuil} mm).`, pluie));
    }
    for (const { v, i } of e.moisSecs) {
      const per = `${scenario.annee} ${MOIS[saison.mois[i]]}`;
      raisons.eau.push(raison(`${MOIS[saison.mois[i]]} ${scenario.annee} : seulement ${Math.round(v)} mm, moins de la moitié du besoin mensuel de ${culture.nom} (~${Math.round(e.besoinMois)} mm) — risque de stress hydrique.`,
        donneePower('PRECTOTCORR', per, v, 'mm', lat, lon)));
      if (scenario.id !== 'normal') alertes.push(`${culture.nom} : ${MOIS[saison.mois[i]]} sec en ${scenario.nom.toLowerCase()} (${Math.round(v)} mm).`);
    }
    if (c.gwetroot !== null && c.gwetroot < 0.4) {
      raisons.eau.push(raison(`Humidité racinaire faible en saison ${saison.numero} (${c.gwetroot.toFixed(2)}).`, donneePower('GWETROOT', c.periode, c.gwetroot, 'fraction 0–1', lat, lon)));
    }
    if (c.jours_sup_35 > 0) {
      const t = culture.tolerance_chaleur;
      raisons.chaleur.push(raison(`${c.jours_sup_35} jours au-dessus de 35 °C pendant la saison ${saison.numero} ; ${culture.nom} tolérance chaleur ${t}/3${t === 1 ? ' : risque élevé' : t === 2 ? ' : risque modéré' : ''}.`,
        donneePower('T2M_MAX', c.periode, c.jours_sup_35, 'jours > 35 °C', lat, lon)));
    }
    if (c.pluie_max_mois_mm > 300 && culture.couverture_erosion <= 1) {
      raisons.erosion.push(raison(`Mois le plus pluvieux de la saison ${saison.numero} : ${Math.round(c.pluie_max_mois_mm)} mm, et ${culture.nom} couvre peu le sol : risque d'érosion.`,
        donneePower('PRECTOTCORR', c.periode, c.pluie_max_mois_mm, 'mm/mois (max)', lat, lon)));
    }
  }

  // Sol / azote : effet cumulé sur les 3 saisons (catalogue indicatif).
  const effetSol = rotation.reduce((s, c) => s + c.effet_sol, 0);
  const legs = rotation.filter(c => c.legumineuse);
  raisons.sol.push(raison(`${legs.length} légumineuse(s) (${legs.map(c => c.nom).join(', ')}) : apport d'azote ; effet cumulé sur le sol ${effetSol > 0 ? '+' : ''}${effetSol}.`, donneeCatalogue(legs[0])));
  if (ctx.sol.ph !== undefined && ctx.sol.ph < 5.5 && legs.length) {
    raisons.sol.push(raison(`pH saisi ${ctx.sol.ph} : sol acide, la fixation d'azote des légumineuses peut être réduite (à vérifier avec un technicien).`, { source: 'saisie agriculteur', ph: ctx.sol.ph }));
  }
  if (ctx.sol.matiere_organique === 'faible') {
    raisons.sol.push(raison('Matière organique saisie faible : les engrais verts et légumineuses sont à privilégier.', { source: 'saisie agriculteur' }));
  }
  if (ctx.texture.facteur !== 1 || ctx.sol.texture) raisons.eau.push(raison(ctx.texture.texte, { source: 'saisie agriculteur', texture: ctx.sol.texture, a_valider: true }));

  const couverture = moyenne(rotation.map(c => c.couverture_erosion));
  raisons.erosion.push(raison(`Couverture du sol moyenne ${couverture.toFixed(1)}/3 sur les 3 saisons.`, donneeCatalogue(rotation[0])));
  const marche = moyenne(rotation.map(c => c.valeur_marche));
  raisons.marche.push(raison(`Valeur marchande moyenne ${marche.toFixed(1)}/3 (${rotation.map(c => `${c.nom} ${c.valeur_marche}`).join(', ')}).`, donneeCatalogue(rotation[0])));
  const revenu = moyenne(parSaison.map(({ culture, e }) => ((culture.valeur_marche - 1) / 2) * (e.exclue ? 0 : e.eau)));
  raisons.revenu.push(raison('Revenu attendu = valeur marchande × sécurité en eau de chaque saison (estimation relative, pas un rendement).', donneeCatalogue(rotation[0])));

  const scores = {
    eau: pct(moyenne(parSaison.map(({ e }) => (e.exclue ? 0 : e.eau)))),
    sol: pct((effetSol + 3) / 12),
    erosion: pct((couverture - 1) / 2),
    marche: pct((marche - 1) / 2),
    revenu: pct(revenu),
    chaleur: pct(moyenne(parSaison.map(({ e }) => e.chaleur)))
  };

  const p = ctx.poids;
  const total = Object.keys(scores).reduce((s, k) => s + scores[k] * p[k], 0) / Object.values(p).reduce((a, b) => a + b, 0);
  const viable = !parSaison.some(({ e }) => e.exclue);

  return {
    scenario: scenario.id,
    nom: scenario.nom,
    annee: scenario.annee,
    methode: scenario.methode,
    score: Math.round(viable ? total : total * 0.5),
    viable,
    scores,
    raisons,
    alertes,
    saisons: parSaison.map(({ culture, saison, c }) => ({ saison: saison.numero, culture: culture.id, periode: c.periode, pluie_mm: c.pluie_mm, jours_sup_35: c.jours_sup_35, gwetroot: c.gwetroot }))
  };
}

/** Normalise les priorités (0–5). Le risque chaleur reçoit le poids moyen des priorités. */
export function normaliserPriorites(pr = {}) {
  const cles = ['eau', 'sol', 'erosion', 'marche', 'revenu'];
  const poids = {};
  for (const k of cles) {
    const v = Number(pr[k]);
    poids[k] = Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 3;
  }
  if (cles.every(k => poids[k] === 0)) cles.forEach(k => (poids[k] = 1));
  poids.chaleur = moyenne(cles.map(k => poids[k]));
  return poids;
}

/**
 * @returns {{ saisons, exclusions, rotations: Array }}
 */
export function recommander({ field, scenarios, catalogue, zone, sol = {}, priorites = {}, top = 3 }) {
  const decoupage = decouperSaisons(field);
  if (decoupage.saisons.length === 0) {
    return { decoupage, exclusions: [], rotations: [], message: 'Aucun mois à plus de 100 mm de pluie en moyenne : pas de saison pluviale exploitable sans irrigation.' };
  }

  // Cultures candidates
  const dureeMax = Math.max(...decoupage.saisons.map(s => s.mois.length)) * JOURS_PAR_MOIS;
  const exclusions = [];
  const candidates = catalogue.cultures.filter(c => {
    if (c.cycle_jours[0] > dureeMax * 1.2) {
      exclusions.push({ culture: c.id, nom: c.nom, raison: `cycle de ${c.cycle_jours[0]} jours minimum, plus long qu'une saison de culture ici (~${Math.round(dureeMax)} jours) : culture pluri-saison non traitée dans une rotation à 3 saisons.` });
      return false;
    }
    if (c.zones_preferees && !(zone && c.zones_preferees.includes(zone.id))) {
      exclusions.push({ culture: c.id, nom: c.nom, raison: `culture indiquée pour ${c.zones_preferees.join(', ')} uniquement dans le catalogue.` });
      return false;
    }
    return true;
  });

  const ctx = {
    lat: field.lat, lon: field.lon,
    saisons: decoupage.saisons,
    seuils: catalogue.seuils_eau_saison_mm,
    texture: TEXTURES[sol.texture] ?? { facteur: 1, texte: 'texture du sol non précisée' },
    sol,
    poids: normaliserPriorites(priorites)
  };

  // Énumération des rotations valides
  const rotations = [];
  for (const a of candidates) for (const b of candidates) for (const c of candidates) {
    const r = [a, b, c];
    if (a.famille === b.famille || b.famille === c.famille) continue;   // pas la même famille deux saisons de suite
    if (a.id === c.id) continue;                                         // 3 cultures différentes (diversification)
    if (!r.some(x => x.legumineuse)) continue;                          // au moins une légumineuse
    const parScenario = scenarios.filter(s => s.annee !== null).map(s => scorerScenario(r, s, ctx));
    const normal = parScenario.find(s => s.scenario === 'normal');
    if (normal && !normal.viable) continue;                              // non viable même en année normale
    const moyenneScore = moyenne(parScenario.map(s => s.score));
    rotations.push({ cultures: r.map(x => ({ id: x.id, nom: x.nom, famille: x.famille, legumineuse: x.legumineuse, a_valider: x.a_valider })), score_moyen: Math.round(moyenneScore), score_min: Math.min(...parScenario.map(s => s.score)), scenarios: parScenario });
  }

  // Tri (score moyen, puis robustesse) et sélection diversifiée
  rotations.sort((x, y) => y.score_moyen - x.score_moyen || y.score_min - x.score_min);
  const choisies = [];
  for (const r of rotations) {
    const ids = r.cultures.map(c => c.id);
    // Écarte une rotation qui partage 2 cultures ou plus avec une rotation déjà retenue (même dans un autre ordre).
    const tropProche = choisies.some(s => s.cultures.filter(c => ids.includes(c.id)).length >= 2);
    if (!tropProche) choisies.push(r);
    if (choisies.length === top) break;
  }

  return { decoupage, exclusions, poids: ctx.poids, nb_rotations_evaluees: rotations.length, rotations: choisies };
}
