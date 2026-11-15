// Service worker RotaSat : l'application et les 3 zones de démo restent utilisables sans réseau.
// - Fichiers de l'app et bibliothèques CDN : mis en cache à l'installation.
// - /api/* : réseau d'abord, cache en secours (réponse marquée X-RotaSat-Cache: 1).
// - POST /api/recommend : l'API Cache ne stocke pas les POST, on range donc la réponse
//   sous une clé GET construite à partir du contenu de la demande.
// - Les fonds de carte (OpenStreetMap, NASA GIBS) ne sont pas mis en cache.
const VERSION = 'rotasat-v1';
const APP = ['/', '/style.css', '/app.js', '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png', '/api/zones'];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];
const PRIORITES_DEFAUT = { eau: 3, sol: 3, erosion: 2, marche: 3, revenu: 3 };

/** Clé stable pour une demande de recommandation (ordre des champs fixé). */
function cleReco(c) {
  const s = c.sol ?? {}, p = c.priorites ?? {};
  const q = new URLSearchParams({
    lat: c.lat, lon: c.lon, texture: s.texture ?? '', ph: s.ph ?? '', mo: s.matiere_organique ?? '',
    p: ['eau', 'sol', 'erosion', 'marche', 'revenu'].map(k => p[k] ?? '').join('-')
  });
  return `/__reco__?${q}`;
}

async function precharger() {
  const cache = await caches.open(VERSION);
  await cache.addAll(APP);
  await Promise.all(CDN.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && cache.put(u, r)).catch(() => {})));
  // Les 3 zones de démo : climat + recommandation avec les réglages par défaut.
  try {
    const { zones } = await (await fetch('/api/zones')).json();
    await Promise.all(zones.map(async z => {
      const f = await fetch(`/api/field?lat=${z.lat}&lon=${z.lon}`);
      if (f.ok) await cache.put(`/api/field?lat=${z.lat}&lon=${z.lon}`, f);
      const corps = { lat: z.lat, lon: z.lon, sol: {}, priorites: PRIORITES_DEFAUT };
      const r = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      if (r.ok) await cache.put(cleReco(corps), r);
    }));
  } catch { /* hors ligne à l'installation : les zones seront mises en cache à la première visite */ }
}

self.addEventListener('install', e => e.waitUntil(precharger().then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

function depuisCache(rep) {
  const h = new Headers(rep.headers);
  h.set('X-RotaSat-Cache', '1');
  return new Response(rep.body, { status: rep.status, statusText: rep.statusText, headers: h });
}

const MESSAGE_HORS_LIGNE = "Hors ligne : cette demande n'est pas encore enregistrée. Essayez une zone de démonstration avec les réglages par défaut.";
const horsLigne = () => new Response(JSON.stringify({ erreur: MESSAGE_HORS_LIGNE }),
  { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function reseauPuisCache(requete, cle, estApi) {
  const cache = await caches.open(VERSION);
  try {
    const rep = await fetch(requete);
    if (rep.ok) cache.put(cle, rep.clone());
    return rep;
  } catch {
    const rep = await cache.match(cle);
    if (rep) return estApi ? depuisCache(rep) : rep;
    return estApi ? horsLigne() : Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (CDN.includes(req.url)) { // bibliothèques versionnées : cache d'abord
    e.respondWith(caches.match(req.url).then(r => r ?? fetch(req)));
    return;
  }
  if (url.origin !== location.origin) return; // tuiles de carte : pas d'interception

  if (req.method === 'POST' && url.pathname === '/api/recommend') {
    e.respondWith(req.clone().json().then(c => reseauPuisCache(req, cleReco(c), true)).catch(() => horsLigne()));
    return;
  }
  if (req.method !== 'GET') return;
  const estApi = url.pathname.startsWith('/api/');
  // Une navigation (avec ou sans ?zone=…) renvoie toujours la page d'accueil en cache.
  e.respondWith(reseauPuisCache(req, req.mode === 'navigate' ? '/' : url.pathname + url.search, estApi));
});
