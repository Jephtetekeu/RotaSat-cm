// Client NASA POWER (https://power.larc.nasa.gov) — sans clé API.
// Renvoie des séries nettoyées (-999 -> null) avec leur provenance.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = 'https://power.larc.nasa.gov/api/temporal';
const CACHE_DIR = path.resolve('cache');
const FILL = -999;

// Paramètres utiles pour l'agriculture (communauté AG)
export const DEFAULT_PARAMS = [
  'PRECTOTCORR',      // pluie corrigée (mm/jour)
  'T2M',              // température moyenne à 2 m (°C)
  'T2M_MAX',          // température max (°C)
  'T2M_MIN',          // température min (°C)
  'RH2M',             // humidité relative (%)
  'GWETTOP',          // humidité du sol en surface (0–1)
  'GWETROOT',         // humidité de la zone racinaire (0–1)
  'ALLSKY_SFC_SW_DWN' // rayonnement solaire (MJ/m²/jour)
];

function cacheKey(url) {
  return createHash('sha1').update(url).digest('hex') + '.json';
}

async function fetchWithCache(url, { retries = 2 } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheKey(url));
  try {
    return { json: JSON.parse(await readFile(file, 'utf8')), fromCache: true };
  } catch { /* pas en cache */ }

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      await writeFile(file, JSON.stringify(json));
      return { json, fromCache: false };
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function clean(series) {
  const out = {};
  for (const [k, v] of Object.entries(series)) out[k] = v === FILL ? null : v;
  return out;
}

function provenance(url, lat, lon, extra = {}) {
  return {
    source: 'NASA POWER (LaRC), communauté AG',
    url,
    latitude: lat,
    longitude: lon,
    note: 'Données maillées (~0,5°), pas une mesure au champ.',
    recupere_le: new Date().toISOString(),
    ...extra
  };
}

/**
 * Série journalière.
 * @param {number} lat
 * @param {number} lon
 * @param {string} start YYYYMMDD
 * @param {string} end   YYYYMMDD
 * @param {string[]} params
 * @returns {{ parametres: Record<string, Record<string, number|null>>, unites: object, provenance: object }}
 */
export async function getDaily(lat, lon, start, end, params = DEFAULT_PARAMS) {
  const url = `${BASE}/daily/point?parameters=${params.join(',')}` +
    `&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  const { json, fromCache } = await fetchWithCache(url);
  const raw = json?.properties?.parameter ?? {};
  const parametres = {};
  for (const p of params) parametres[p] = clean(raw[p] ?? {});
  return {
    parametres,
    unites: json?.parameters ?? {},
    provenance: provenance(url, lat, lon, { periode: `${start}-${end}`, depuis_cache: fromCache })
  };
}

/**
 * Climatologie mensuelle (moyennes long terme, clés JAN..DEC + ANN).
 */
export async function getClimatology(lat, lon, params = DEFAULT_PARAMS) {
  const url = `${BASE}/climatology/point?parameters=${params.join(',')}` +
    `&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  const { json, fromCache } = await fetchWithCache(url);
  const raw = json?.properties?.parameter ?? {};
  const parametres = {};
  for (const p of params) parametres[p] = clean(raw[p] ?? {});
  return {
    parametres,
    unites: json?.parameters ?? {},
    provenance: provenance(url, lat, lon, { periode: 'climatologie', depuis_cache: fromCache })
  };
}

// Utilitaire : agrège une série journalière {YYYYMMDD: v} par mois "YYYY-MM".
export function parMois(serie, mode = 'somme') {
  const acc = {};
  for (const [d, v] of Object.entries(serie)) {
    if (v === null) continue;
    const k = `${d.slice(0, 4)}-${d.slice(4, 6)}`;
    (acc[k] ??= []).push(v);
  }
  const out = {};
  for (const [k, vals] of Object.entries(acc)) {
    const s = vals.reduce((a, b) => a + b, 0);
    out[k] = mode === 'moyenne' ? s / vals.length : s;
  }
  return out;
}
