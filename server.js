import 'dotenv/config';
import express from 'express';
import { readFile } from 'node:fs/promises';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const loadJson = async p => JSON.parse(await readFile(p, 'utf8'));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'RotaSat Cameroun' }));

app.get('/api/zones', async (_req, res, next) => {
  try { res.json(await loadJson('data/zones.json')); } catch (e) { next(e); }
});

app.get('/api/crops', async (_req, res, next) => {
  try { res.json(await loadJson('data/crops.cm.json')); } catch (e) { next(e); }
});

// TODO (P0) : /api/field, /api/recommend — voir CLAUDE.md §6
// TODO (P1) : /api/sms

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erreur: err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`RotaSat Cameroun → http://localhost:${port}`));
