import 'dotenv/config';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { getField, lireCoordonnees } from './src/field.js';
import { construireScenarios } from './src/scenarios.js';
import { recommander } from './src/rotation.js';

const app = express();
const PROD = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.set('trust proxy', 1); // derrière le proxy de l'hébergeur (Render) pour lire la vraie IP

// En-têtes de sécurité (OWASP A05). Les scripts inline sont interdits ; 'unsafe-inline' n'est
// autorisé que pour les styles, car Leaflet positionne la carte avec des attributs style.
app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://*.tile.openstreetmap.org https://unpkg.com https://gibs.earthdata.nasa.gov",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Limitation simple par IP (OWASP A04) : protège NASA POWER et le serveur des abus.
function limiter({ fenetreMs, max }) {
  const compteurs = new Map();
  setInterval(() => compteurs.clear(), fenetreMs).unref();
  return (req, res, next) => {
    const n = (compteurs.get(req.ip) ?? 0) + 1;
    compteurs.set(req.ip, n);
    if (n > max) {
      console.warn(`[limite] ${req.ip} ${req.method} ${req.path}`);
      return res.status(429).json({ erreur: 'Trop de requêtes, réessayez dans une minute.' });
    }
    next();
  };
}
app.use('/api/', limiter({ fenetreMs: 60_000, max: 30 }));

app.use(express.json({ limit: '10kb' }));
app.use(express.static('public', { maxAge: PROD ? '1h' : 0 }));

const loadJson = async p => JSON.parse(await readFile(p, 'utf8'));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'RotaSat Cameroun' }));

app.get('/api/zones', async (_req, res, next) => {
  try { res.json(await loadJson('data/zones.json')); } catch (e) { next(e); }
});

app.get('/api/crops', async (_req, res, next) => {
  try { res.json(await loadJson('data/crops.cm.json')); } catch (e) { next(e); }
});

app.get('/api/field', async (req, res, next) => {
  const c = lireCoordonnees(req.query.lat, req.query.lon);
  if (!c) return res.status(400).json({ erreur: 'Paramètres lat et lon invalides.' });
  try { res.json(await getField(c.lat, c.lon)); } catch (e) { next(e); }
});

const TEXTURES = ['sableux', 'limoneux', 'argileux'];
const NIVEAUX_MO = ['faible', 'moyenne', 'elevee'];

/** Valide le sol saisi : seules les valeurs connues passent, le reste est ignoré. */
function lireSol(sol = {}) {
  const out = {};
  if (TEXTURES.includes(sol.texture)) out.texture = sol.texture;
  const ph = Number(sol.ph);
  if (sol.ph !== undefined && sol.ph !== '' && Number.isFinite(ph) && ph >= 3 && ph <= 10) out.ph = ph;
  if (NIVEAUX_MO.includes(sol.matiere_organique)) out.matiere_organique = sol.matiere_organique;
  return out;
}

/** Zone de démo la plus proche (à moins de 0,5°), pour les cultures propres à une zone. */
function zoneProche(zones, lat, lon) {
  const d = z => Math.hypot(z.lat - lat, z.lon - lon);
  const z = [...zones].sort((a, b) => d(a) - d(b))[0];
  return z && d(z) <= 0.5 ? z : null;
}

app.post('/api/recommend', async (req, res, next) => {
  const body = req.body ?? {};
  const c = lireCoordonnees(body.lat, body.lon);
  if (!c) return res.status(400).json({ erreur: 'Paramètres lat et lon invalides.' });
  try {
    const [field, catalogue, { zones }] = await Promise.all([
      getField(c.lat, c.lon), loadJson('data/crops.cm.json'), loadJson('data/zones.json')
    ]);
    const scenarios = construireScenarios(field);
    const sol = lireSol(body.sol);
    const zone = zoneProche(zones, c.lat, c.lon);
    const reco = recommander({ field, scenarios, catalogue, zone, sol, priorites: body.priorites });
    res.json({
      lat: c.lat, lon: c.lon,
      zone: zone ? { id: zone.id, nom: zone.nom } : null,
      sol,
      scenarios: scenarios.map(({ mensuel, source, ...s }) => s),
      ...reco,
      avertissement: "Outil d'aide à la décision — à valider avec un technicien agricole (MINADER/IRAD). Les caractéristiques des cultures sont indicatives.",
      provenance: field.provenance
    });
  } catch (e) { next(e); }
});
// TODO (P1) : /api/sms

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'Corps JSON invalide.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erreur: 'Requête trop volumineuse.' });
  // Pas de détail interne en production
  res.status(500).json({ erreur: PROD ? 'Erreur interne.' : err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`RotaSat Cameroun → http://localhost:${port}`));
