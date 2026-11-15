// Pitch de 30 secondes. Tout l'affichage est une fonction du temps : rendu(t) dessine l'instant t (en secondes).
// Cela permet de rejouer, et d'exporter la vidéo image par image (?capture=1 désactive la lecture automatique).
const DUREE = 30;
const FONDU = 0.45;
const cadre = document.getElementById('scene');
const barre = document.getElementById('barre');
const plans = [...document.querySelectorAll('.plan')].map(el => ({
  el,
  debut: Number(el.dataset.debut),
  fin: Number(el.dataset.fin),
  elements: [...el.querySelectorAll('[data-a]')].map(e => ({ e, a: Number(e.dataset.a) })),
  zooms: [...el.querySelectorAll('[data-zoom] img')],
  defile: [...el.querySelectorAll('[data-defile] img')]
}));

const borne = x => Math.max(0, Math.min(1, x));
const doux = x => 1 - (1 - x) ** 3;

function rendu(t) {
  t = Math.max(0, Math.min(DUREE, t));
  for (const p of plans) {
    const entree = p.debut === 0 ? 1 : borne((t - p.debut) / FONDU);
    const sortie = p.fin >= DUREE ? 1 : borne((p.fin - t) / FONDU);
    const visible = t >= p.debut - 0.01 && t <= p.fin + 0.01;
    p.el.style.opacity = visible ? Math.min(entree, sortie) : 0;
    p.el.style.visibility = visible ? 'visible' : 'hidden';
    if (!visible) continue;
    const avance = borne((t - p.debut) / (p.fin - p.debut));
    for (const { e, a } of p.elements) {
      const k = doux(borne((t - a) / 0.5));
      e.style.opacity = k;
      e.style.transform = `translateY(${(1 - k) * 22}px)`;
    }
    for (const img of p.zooms) img.style.transform = `scale(${1 + avance * 0.04})`;
    // Fait défiler une capture plus haute que son cadre, après une courte pause.
    for (const img of p.defile) {
      const depassement = Math.max(0, img.offsetHeight - img.parentElement.clientHeight);
      img.style.transform = `translateY(${-depassement * doux(borne((avance - 0.3) / 0.6))}px)`;
    }
  }
  barre.style.width = `${(t / DUREE) * 100}%`;
}
window.rendu = rendu;

function ajuster() {
  const k = Math.min(innerWidth / 1280, innerHeight / 720);
  cadre.style.transform = `translate(-50%, -50%) scale(${k})`;
}
addEventListener('resize', ajuster);
ajuster();

let depart = null;
function jouer() {
  depart = performance.now();
  const image = () => {
    const t = (performance.now() - depart) / 1000;
    rendu(t);
    if (t < DUREE) requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
}
document.getElementById('rejouer').addEventListener('click', jouer);

if (new URLSearchParams(location.search).has('capture')) {
  document.body.classList.add('capture');
  rendu(0);
} else {
  jouer();
}
