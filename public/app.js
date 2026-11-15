// RotaSat Cameroun — interface. Tout texte issu des données est inséré via textContent (pas d'innerHTML).

const PRIORITES = [
  { id: 'eau', nom: 'Économiser l\'eau', defaut: 3 },
  { id: 'sol', nom: 'Fertilité / azote', defaut: 3 },
  { id: 'erosion', nom: 'Limiter l\'érosion', defaut: 2 },
  { id: 'marche', nom: 'Débouchés marché', defaut: 3 },
  { id: 'revenu', nom: 'Revenu', defaut: 3 }
];
const CRITERES = { eau: 'Eau', sol: 'Sol / azote', erosion: 'Érosion', marche: 'Marché', revenu: 'Revenu', chaleur: 'Risque chaleur' };
const COULEURS_SC = { normal: '#1f5f3a', sec: '#b8741a', chaud: '#b03a2e' };

const $ = s => document.querySelector(s);
const etat = { lat: null, lon: null, zone: null, field: null, graphes: [] };

/** Crée un élément : el('div', {class:'x'}, 'texte', enfant…) */
function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) n.append(e instanceof Node ? e : String(e));
  return n;
}
function icone(id, cls = 'ico') {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(ns, 'use'); u.setAttribute('href', `#${id}`); s.append(u);
  return s;
}
const fmt = (v, n = 0) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: n, minimumFractionDigits: n }));

function afficherEtat(texte, { chargement = false, erreur = false } = {}) {
  const e = $('#etat');
  e.hidden = false;
  e.className = 'etat' + (erreur ? ' erreur' : '');
  e.replaceChildren(icone(erreur ? 'i-alerte' : 'i-satellite', 'ico ico-xl'), el('p', { class: chargement ? 'chargement' : '' }, texte));
}

async function api(url, options) {
  const r = await fetch(url, options);
  if (r.headers.get('X-RotaSat-Cache')) $('#hors-ligne').hidden = false;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}

// ---------- Carte ----------
const map = L.map('map', { scrollWheelZoom: false }).setView([7.4, 12.4], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
let marqueur = null;

function choisirPoint(lat, lon, zone = null) {
  etat.lat = Math.round(lat * 100) / 100;
  etat.lon = Math.round(lon * 100) / 100;
  etat.zone = zone;
  if (marqueur) marqueur.setLatLng([lat, lon]); else marqueur = L.marker([lat, lon]).addTo(map);
  document.querySelectorAll('.zone').forEach(b => b.setAttribute('aria-pressed', String(zone?.id === b.dataset.id)));
  $('#position').textContent = `${zone ? zone.nom + ' — ' : 'Point choisi — '}${fmt(etat.lat, 2)}° N, ${fmt(etat.lon, 2)}° E`;
  $('#go').disabled = false;
  $('#reco').hidden = true;
  chargerClimat();
}

map.on('click', e => choisirPoint(e.latlng.lat, e.latlng.lng));

api('/api/zones').then(({ zones }) => {
  const box = $('#zones');
  for (const z of zones) {
    L.circleMarker([z.lat, z.lon], { radius: 6, color: '#1f5f3a', weight: 2, fillOpacity: .5 })
      .addTo(map).on('click', ev => { L.DomEvent.stopPropagation(ev); choisirPoint(z.lat, z.lon, z); })
      .bindTooltip(z.nom);
    box.append(el('button', { type: 'button', class: 'zone', 'data-id': z.id, 'aria-pressed': 'false', onclick: () => { map.setView([z.lat, z.lon], 7); choisirPoint(z.lat, z.lon, z); } }, z.nom));
  }
  // Lien direct de démo : ?zone=nord-garoua → présélection + recommandation automatique
  const demande = new URLSearchParams(location.search).get('zone');
  const z = zones.find(x => x.id === demande);
  if (z) {
    map.setView([z.lat, z.lon], 7);
    choisirPoint(z.lat, z.lon, z);
    $('#form').requestSubmit();
  }
}).catch(() => afficherEtat('Impossible de charger les zones de démonstration.', { erreur: true }));

// ---------- Priorités ----------
for (const p of PRIORITES) {
  const sortie = el('output', { for: `p-${p.id}` }, p.defaut);
  const curseur = el('input', { type: 'range', id: `p-${p.id}`, name: p.id, min: 0, max: 5, step: 1, value: p.defaut, oninput: e => (sortie.textContent = e.target.value) });
  $('#priorites').append(el('label', { class: 'priorite' }, p.nom, curseur, sortie));
}

// ---------- Climat ----------
async function chargerClimat() {
  const { lat, lon } = etat;
  $('#climat').hidden = true;
  afficherEtat('Récupération de 10 ans de données NASA POWER… (environ 15 s la première fois)', { chargement: true });
  try {
    const f = await api(`/api/field?lat=${lat}&lon=${lon}`);
    if (etat.lat !== lat || etat.lon !== lon) return; // un autre point a été choisi entre-temps
    etat.field = f;
    afficherClimat(f);
    $('#etat').hidden = true;
  } catch (e) {
    afficherEtat(`Données NASA indisponibles : ${e.message}`, { erreur: true });
  }
}

function afficherClimat(f) {
  const s = f.saison_pluies;
  $('#resume').replaceChildren(
    chiffre(`${fmt(f.annuel.pluie_mm)} mm`, 'pluie par an (moyenne)'),
    chiffre(s.debut ? `${s.debut} → ${s.fin}` : 'aucune', `saison des pluies (${s.mois_humides} mois > 100 mm)`),
    chiffre(`${fmt(f.annuel.tmax_moy_c, 1)} °C`, 'T° max moyenne'),
    chiffre(`${fmt(f.annuel.jours_sup_35)} j/an`, 'jours au-dessus de 35 °C'),
    chiffre(fmt(f.annuel.gwetroot_moy, 2), 'humidité racinaire (0–1)')
  );
  $('#source-climat').textContent = `Source : ${f.provenance.source} — paramètres ${f.provenance.parametres.join(', ')} — ${f.periode.debut} → ${f.periode.fin} — point ${f.lat}, ${f.lon}. ${f.provenance.note}`;
  $('#climat').hidden = false;

  etat.graphes.forEach(g => g.destroy());
  const mois = f.mensuel.map(m => m.mois);
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  etat.graphes = [
    new Chart($('#g-pluie'), {
      data: {
        labels: mois,
        datasets: [
          { type: 'bar', label: 'Pluie (mm/mois)', data: f.mensuel.map(m => m.pluie_mm), backgroundColor: f.mensuel.map(m => (m.pluie_mm > 100 ? '#2c6aa8' : '#a9c3de')), yAxisID: 'y', borderRadius: 4 },
          { type: 'line', label: 'T° max (°C)', data: f.mensuel.map(m => m.tmax_c), borderColor: '#b03a2e', backgroundColor: '#b03a2e', yAxisID: 'y1', tension: .3, pointRadius: 2 }
        ]
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { boxWidth: 12 } } },
        scales: { y: { title: { display: true, text: 'mm' }, beginAtZero: true }, y1: { position: 'right', title: { display: true, text: '°C' }, grid: { drawOnChartArea: false } } }
      }
    }),
    new Chart($('#g-sol'), {
      type: 'line',
      data: { labels: mois, datasets: [{ label: 'Humidité zone racinaire (GWETROOT, 0–1)', data: f.mensuel.map(m => m.gwetroot), borderColor: '#6a9a2c', backgroundColor: 'rgba(106,154,44,.15)', fill: true, tension: .3, pointRadius: 2 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { y: { min: 0, max: 1 } } }
    })
  ];
}
const chiffre = (valeur, libelle) => el('div', { class: 'chiffre' }, el('b', {}, valeur), el('span', {}, libelle));

// ---------- Recommandation ----------
$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();
  if (etat.lat === null) return;
  const fd = new FormData(ev.target);
  const corps = {
    lat: etat.lat, lon: etat.lon,
    sol: { texture: fd.get('texture') || undefined, ph: fd.get('ph') || undefined, matiere_organique: fd.get('matiere_organique') || undefined },
    priorites: Object.fromEntries(PRIORITES.map(p => [p.id, Number(fd.get(p.id))]))
  };
  const bouton = $('#go');
  bouton.disabled = true;
  $('#reco').hidden = true;
  afficherEtat('Évaluation des rotations sur 3 années réelles…', { chargement: true });
  try {
    const r = await api('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    afficherReco(r);
    $('#etat').hidden = true;
    $('#reco').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    afficherEtat(`Échec de la recommandation : ${e.message}`, { erreur: true });
  } finally {
    bouton.disabled = false;
  }
});

function afficherReco(r) {
  $('#decoupage').textContent = r.decoupage.explication || r.message || '';
  $('#scenarios').replaceChildren(...r.scenarios.map(s => el('div', { class: `scenario sc-${s.id}` },
    el('b', {}, s.nom), el('span', { class: 'annee' }, s.annee ?? '—'),
    el('small', {}, `${fmt(s.pluie_mm)} mm de pluie · T° max moy. ${fmt(s.tmax_moy_c, 1)} °C · ${fmt(s.jours_sup_35)} j > 35 °C`),
    el('small', {}, s.methode))));
  const memeAnnee = r.scenarios.filter(s => s.annee !== null).map(s => s.annee);
  if (new Set(memeAnnee).size < memeAnnee.length) {
    $('#scenarios').append(el('p', { class: 'aide', style: null }, 'Une même année réelle peut servir à deux scénarios : ici, l\'année la plus sèche est aussi parmi les plus chaudes.'));
  }

  const box = $('#rotations');
  if (!r.rotations.length) {
    box.replaceChildren(el('div', { class: 'etat erreur' }, r.message || 'Aucune rotation ne respecte les règles pour ce champ.'));
  } else {
    box.replaceChildren(...r.rotations.map((rot, i) => carteRotation(rot, i, r.decoupage.saisons)));
  }

  const ex = $('#exclusions');
  ex.replaceChildren();
  if (r.exclusions.length) {
    ex.append(el('b', {}, 'Cultures écartées : '), r.exclusions.map(e => `${e.nom} (${e.raison})`).join(' · '));
  }
  ex.append(el('p', {}, `${r.nb_rotations_evaluees ?? 0} rotations évaluées. Règles : pas la même famille deux saisons de suite, au moins une légumineuse, 3 cultures différentes, exclusion si la pluie est très inférieure au besoin. ${r.avertissement}`));
  $('#reco').hidden = false;
}

function carteRotation(rot, i, saisons) {
  const seq = el('div', { class: 'sequence' });
  rot.cultures.forEach((c, k) => {
    if (k) seq.append(el('span', { class: 'fleche', 'aria-hidden': 'true' }, '→'));
    seq.append(el('div', { class: 'culture' + (c.legumineuse ? ' legume' : '') },
      el('small', {}, saisons[k]?.libelle ?? `Saison ${k + 1}`),
      el('b', {}, c.nom),
      c.legumineuse ? el('small', {}, 'légumineuse — fixe l\'azote') : null));
  });

  const barres = el('div', { class: 'barres' }, rot.scenarios.map(s => el('div', { class: 'barre' },
    el('span', {}, `${s.nom.replace('Année ', '')} (${s.annee})`),
    el('span', { class: 'piste' }, el('i', { style: `width:${s.score}%;background:${COULEURS_SC[s.scenario]}` })),
    el('b', {}, s.score))));

  const alertes = [...new Set(rot.scenarios.flatMap(s => s.alertes))].slice(0, 4)
    .map(a => el('div', { class: 'alerte' }, icone('i-alerte'), el('span', {}, a)));

  // « Pourquoi ? » : un onglet par scénario
  const corps = el('div');
  const onglets = el('div', { class: 'onglets', role: 'tablist' });
  const montrer = s => {
    onglets.querySelectorAll('.onglet').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sc === s.scenario)));
    corps.replaceChildren(...Object.entries(CRITERES).map(([k, nom]) => el('div', { class: 'critere' },
      el('h4', {}, el('span', {}, nom), el('span', {}, `${s.scores[k]}/100`)),
      el('ul', {}, (s.raisons[k] || []).map(ra => el('li', {}, ra.texte, ' ', preuve(ra.donnee)))))));
  };
  rot.scenarios.forEach(s => onglets.append(el('button', { type: 'button', role: 'tab', class: 'onglet', 'data-sc': s.scenario, onclick: () => montrer(s) }, `${s.nom} ${s.annee}`)));
  montrer(rot.scenarios[0]);

  return el('article', { class: 'rotation' },
    el('div', { class: 'rotation-tete' },
      el('span', { class: 'rang' }, `Option ${i + 1}`),
      el('span', { class: 'score-global' }, rot.score_moyen, el('small', {}, ' /100 en moyenne · pire cas ', rot.score_min))),
    seq, barres, alertes,
    el('details', {}, el('summary', {}, 'Pourquoi ? Les données derrière ce score'), onglets, corps));
}

function preuve(d) {
  if (!d) return null;
  if (d.source === 'NASA POWER') {
    return el('span', { class: 'preuve', title: `Point ${d.lat}, ${d.lon}` }, `NASA POWER · ${d.parametre} · ${d.periode} · ${fmt(d.valeur, d.unite.startsWith('fraction') ? 2 : 0)} ${d.unite}`);
  }
  return el('span', { class: 'preuve indicatif' }, d.a_valider ? `${d.source} · à valider` : d.source);
}

// ---------- Couche satellite NASA GIBS (NDVI MODIS Terra, composite 8 jours) ----------
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png';
let coucheNdvi = null;
const iso = d => d.toISOString().slice(0, 10);
{
  const champDate = $('#ndvi-date');
  const aujourdhui = new Date();
  // Par défaut : il y a 3 semaines, le temps que le composite 8 jours soit publié.
  champDate.max = iso(aujourdhui);
  champDate.value = iso(new Date(aujourdhui.getTime() - 21 * 864e5));

  const majCouche = () => {
    if (coucheNdvi) { map.removeLayer(coucheNdvi); coucheNdvi = null; }
    const actif = $('#ndvi-actif').checked;
    $('#ndvi-options').hidden = !actif;
    // La date vient d'un champ <input type="date"> : on vérifie quand même le format avant de l'injecter dans l'URL.
    if (!actif || !/^\d{4}-\d{2}-\d{2}$/.test(champDate.value)) return;
    coucheNdvi = L.tileLayer(GIBS, {
      time: champDate.value, maxNativeZoom: 9, maxZoom: 18, opacity: .75,
      attribution: 'NDVI : NASA GIBS / MODIS Terra'
    }).addTo(map);
  };
  $('#ndvi-actif').addEventListener('change', majCouche);
  champDate.addEventListener('change', majCouche);
  // Lien de démo : ?ndvi=1 active la couche à l'ouverture
  if (new URLSearchParams(location.search).has('ndvi')) { $('#ndvi-actif').checked = true; majCouche(); }
}

// ---------- Hors ligne (PWA) ----------
const majReseau = () => { $('#hors-ligne').hidden = navigator.onLine; };
addEventListener('online', majReseau);
addEventListener('offline', majReseau);
majReseau();
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('Service worker non installé :', e)));
}
