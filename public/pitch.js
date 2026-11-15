// Pitch de 30 secondes, calé sur la voix. Le minutage vient de pitch/chrono.json (une entrée par phrase).
// Tout l'affichage est une fonction du temps : rendu(t) dessine l'instant t, en secondes.
// Cela permet de rejouer, et d'exporter la vidéo image par image (?capture=1 désactive la lecture automatique).
const FONDU = 0.35, AVANCE = 0.2;
const cadre = document.getElementById('scene');
const barre = document.getElementById('barre');
const sousTitre = document.getElementById('sous-titre');
const borne = x => Math.max(0, Math.min(1, x));
const doux = x => 1 - (1 - x) ** 3;

let DUREE = 30, plans = [], segments = [];

function preparer(chrono) {
  DUREE = chrono.duree;
  segments = chrono.segments;
  const sections = [...document.querySelectorAll('.plan')];
  plans = sections.map((el, k) => {
    const seg = segments.find(s => s.id === el.dataset.seg);
    const suivant = segments.find(s => s.id === sections[k + 1]?.dataset.seg);
    return {
      el,
      debut: k === 0 ? 0 : seg.debut - AVANCE,
      fin: suivant ? suivant.debut - AVANCE : DUREE,
      elements: [...el.querySelectorAll('[data-a]')].map(e => ({ e, a: Number(e.dataset.a) })),
      zooms: [...el.querySelectorAll('[data-zoom]')].map(f => ({ img: f.querySelector('img'), max: Number(f.dataset.zoom) })),
      defile: [...el.querySelectorAll('[data-defile] img')]
    };
  });
}

function rendu(t) {
  t = Math.max(0, Math.min(DUREE, t));
  plans.forEach((p, k) => {
    const entree = k === 0 ? 1 : borne((t - p.debut) / FONDU);
    const sortie = k === plans.length - 1 ? 1 : borne((p.fin + FONDU - t) / FONDU);
    const visible = t >= p.debut && t <= p.fin + FONDU;
    p.el.style.opacity = visible ? Math.min(entree, sortie) : 0;
    p.el.style.visibility = visible ? 'visible' : 'hidden';
    p.el.style.zIndex = visible ? k + 1 : 0;
    if (!visible) return;
    const local = t - p.debut;
    const avance = borne(local / (p.fin - p.debut));
    for (const { e, a } of p.elements) {
      const x = doux(borne((local - a) / 0.45));
      e.style.opacity = x;
      e.style.transform = `translateY(${(1 - x) * 20}px)`;
    }
    // Zoom lent vers la zone intéressante de la capture.
    for (const { img, max } of p.zooms) img.style.transform = `scale(${1 + (max - 1) * doux(borne((avance - 0.12) / 0.6))})`;
    // Fait défiler une capture plus haute que son cadre.
    for (const img of p.defile) {
      const depassement = Math.max(0, img.offsetHeight - img.parentElement.clientHeight);
      img.style.transform = `translateY(${-depassement * 0.62 * doux(borne((avance - 0.4) / 0.5))}px)`;
    }
  });
  const dit = segments.find(s => t >= s.debut - 0.05 && t <= s.debut + s.duree + 0.15);
  // Sous-titres en anglais (champ « en ») pour le jury international ; la voix reste en français.
  const ligne = dit ? dit.en ?? dit.texte : '';
  if (dit && sousTitre.textContent !== ligne) sousTitre.textContent = ligne;
  sousTitre.style.opacity = dit ? 1 : 0;
  sousTitre.style.zIndex = 20;
  barre.style.width = `${(t / DUREE) * 100}%`;
}
window.rendu = rendu;

function ajuster() {
  const k = Math.min(innerWidth / 1280, innerHeight / 720);
  cadre.style.transform = `translate(-50%, -50%) scale(${k})`;
}
addEventListener('resize', ajuster);
ajuster();

let lecture = 0, pistes = [];
function jouer(avecSon) {
  const moi = ++lecture;
  pistes.forEach(a => a.pause());
  pistes = [];
  const depart = performance.now();
  if (avecSon) {
    for (const s of segments) {
      const a = new Audio(s.fichier);
      pistes.push(a);
      setTimeout(() => { if (moi === lecture) a.play().catch(() => {}); }, s.debut * 1000);
    }
  }
  const image = () => {
    if (moi !== lecture) return;
    const t = (performance.now() - depart) / 1000;
    rendu(t);
    if (t < DUREE) requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
}
document.getElementById('rejouer').addEventListener('click', () => jouer(false));
document.getElementById('avec-son').addEventListener('click', () => jouer(true));

fetch('pitch/chrono.json').then(r => r.json()).then(chrono => {
  preparer(chrono);
  window.dureePitch = DUREE;
  if (new URLSearchParams(location.search).has('capture')) {
    document.body.classList.add('capture');
    rendu(0);
  } else {
    jouer(false); // sans le son : les navigateurs bloquent le son tant que l'on n'a pas cliqué
  }
  window.pret = true;
});
