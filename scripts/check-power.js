// Vérifie l'accès à NASA POWER sur la zone de démo de Dschang (1 mois de données).
import { getDaily } from '../src/nasaPower.js';

const t0 = Date.now();
try {
  const r = await getDaily(5.45, 10.06, '20240701', '20240731', ['PRECTOTCORR', 'T2M_MAX', 'GWETROOT']);
  const pluie = Object.values(r.parametres.PRECTOTCORR).filter(v => v !== null);
  const total = pluie.reduce((a, b) => a + b, 0);
  console.log('✅ NASA POWER joignable', `(${Date.now() - t0} ms, cache: ${r.provenance.depuis_cache})`);
  console.log(`   Dschang, juillet 2024 : ${pluie.length} jours, pluie totale ≈ ${total.toFixed(1)} mm`);
} catch (e) {
  console.error('❌ NASA POWER injoignable :', e.message);
  process.exit(1);
}
