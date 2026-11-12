# CLAUDE.md — RotaSat Cameroun (NASA Space Apps 2026)

> Lis ce fichier en entier avant toute action. **Toutes les décisions sont déjà prises ici : ne pose pas de questions de cadrage, exécute.** Ne pose une question que si une action est irréversible (suppression, push forcé, publication) ou si une clé/un compte manque réellement.

## 1. Contexte
- Hackathon : **NASA Space Apps Challenge 2026**, 14–15 novembre 2026. Soumission avant la clôture de l'événement local (dimanche 15/11, 23:59 heure locale — vérifier sur la page de l'événement).
- Challenge : **« Field Shift: Adapting Farms with NASA Data »** (Intermédiaire/Avancé). Énoncé reconstitué : `docs/challenge.md`.
- Porteur : Lord Jeff (Jephté TEKEU), Douala — dev full-stack, réseau, cybersécurité. Langue de travail : **français**.
- Exigence centrale du jury : un **outil d'aide à la décision** qui combine **observations NASA** + **sol local** + **caractéristiques des cultures** + **priorités de l'agriculteur** pour explorer des **rotations de cultures** qui améliorent le sol et s'adaptent au climat. L'outil **appuie** le jugement de l'agriculteur, il ne le remplace pas.

## 2. Notre angle (différenciation — ne pas changer)
1. **Terrain réel camerounais** : 3 zones de démo dans `data/zones.json` (Hauts-Plateaux de l'Ouest, Nord/Garoua, Extrême-Nord/Maroua).
2. **Explicabilité** : chaque recommandation affiche *quelle donnée NASA l'a motivée* (paramètre, période, valeur).
3. **Stress test** : chaque rotation est évaluée en année normale / sèche / chaude, construites à partir de l'historique NASA POWER (percentiles), pas inventées.
4. **Accès terrain** : PWA hors ligne (cache des zones de démo) + **canal texte** (endpoint `/api/sms` qui renvoie une réponse ≤ 160 caractères, branchable plus tard sur WhatsApp/SMS). Le bot réel est un bonus, pas un prérequis.

## 3. Stack (imposée)
- **Node.js ≥ 18** (fetch natif), **Express**, **ESM** (`"type": "module"`).
- Stockage : fichiers JSON + cache disque `cache/` (pas de base de données sauf besoin réel ; si besoin → SQLite via `better-sqlite3`).
- Front : HTML/CSS/JS vanilla dans `public/`, **Leaflet** (CDN) pour la carte, **Chart.js** (CDN) pour les graphes. Pas de framework, pas de build.
- Données :
  - **NASA POWER** (sans clé) — client prêt dans `src/nasaPower.js`. Communauté `AG`.
  - **NASA GIBS** (tuiles WMTS sans clé) pour la couche satellite sur la carte (MODIS NDVI / True Color).
  - **SoilGrids (ISRIC)** pour le sol, optionnel ; toujours étiqueté « estimation modélisée ». Le sol saisi par l'agriculteur prime.
  - Earthdata Login (SMAP, IMERG direct) : **seulement si** `EARTHDATA_TOKEN` est présent dans `.env`. Sinon, utiliser les paramètres équivalents de POWER (`GWETROOT`, `GWETTOP`, `PRECTOTCORR`).

## 4. Règles non négociables
- **Aucune donnée inventée.** Valeurs NASA = issues de l'API, avec provenance (source, paramètre, dates, coordonnées). Valeur manquante POWER = `-999` → `null`, jamais 0.
- Le catalogue `data/crops.cm.json` contient des valeurs indicatives marquées `"a_valider": true`. Les afficher comme indicatives dans l'UI. Ne pas ajouter de chiffres agronomiques précis sans source.
- Pas de promesse de rendement ni de prévision météo. Afficher le bandeau : « Outil d'aide à la décision — à valider avec un technicien agricole (MINADER/IRAD). »
- UI et textes en **français** (pidgin en bonus pour le canal SMS).
- Commits petits et fréquents, messages en français, format `feat: …`, `fix: …`, `data: …`, `docs: …`. L'historique git sert de preuve du travail pendant le hackathon.
- Pas de secrets dans le dépôt : `.env` est ignoré, `.env.example` documente les variables.

## 5. Ce qui existe déjà (préparé avant le hackathon)
- `src/nasaPower.js` : client NASA POWER (journalier + climatologie), cache disque, nettoyage des `-999`, provenance.
- `scripts/check-power.js` : test de connexion (`npm run check`).
- `data/zones.json`, `data/crops.cm.json` : zones de démo et catalogue de cultures.
- `server.js` : serveur Express minimal avec `/api/health` et `/api/zones`.
- `public/index.html` : page d'accueil vide avec carte Leaflet.

## 6. Ce qu'il faut construire (dans cet ordre — c'est le backlog)
Coche dans `docs/plan-48h.md` au fur et à mesure.

**P0 — indispensable pour soumettre**
1. `GET /api/field?lat=&lon=` → résumé climatique du champ sur 10 ans (2015-01-01 → 2024-12-31) : pluie mensuelle moyenne, T° max moyenne, jours > 35 °C, humidité racinaire (`GWETROOT`) mensuelle, début/fin de saison des pluies estimés (premier/dernier mois > 100 mm en moyenne). Mettre en cache.
2. `src/scenarios.js` : à partir de l'historique annuel, construire 3 scénarios : **normal** (année médiane de pluie), **sec** (percentile 20 de pluie), **chaud** (percentile 80 de T° max). Renvoyer l'année réelle utilisée pour chaque scénario.
3. `src/rotation.js` : génère des rotations sur 3 saisons à partir de `crops.cm.json` + zone + priorités de l'agriculteur. Score par critère (eau, sol/azote, érosion, marché, risque chaleur), pondéré par les priorités. Règles minimales : pas la même famille deux saisons de suite ; au moins une légumineuse sur 3 saisons ; exclure une culture dont le besoin en eau dépasse nettement la pluie du scénario. Chaque score porte une liste `raisons[]` avec la donnée NASA qui l'explique.
4. `POST /api/recommend` body `{lat, lon, sol:{texture, ph?, matiere_organique?}, priorites:{eau, sol, erosion, marche, revenu}}` → top 3 rotations × 3 scénarios + raisons.
5. UI `public/` : (a) clic sur la carte ou choix d'une zone de démo, (b) formulaire sol + curseurs de priorités, (c) graphes pluie/T°/humidité, (d) 3 cartes de rotation avec scores par scénario et raisons « Pourquoi ? ». Responsive mobile.

**P1 — différenciation**
6. Couche GIBS sur la carte (NDVI MODIS) avec sélecteur de date.
7. PWA : `manifest.json` + service worker qui met en cache l'app et les réponses des 3 zones de démo.
8. `POST /api/sms` body `{texte:"MAIS DSCHANG"}` → réponse ≤ 160 caractères (meilleure rotation + 1 alerte).

**P2 — bonus si le temps le permet**
9. Branchement WhatsApp (Twilio sandbox ou WhatsApp Cloud API) sur `/api/sms`, seulement si les identifiants sont dans `.env`.
10. Export PDF/imprimable du plan de rotation.

## 7. Livrables de soumission (dimanche après-midi au plus tard)
- Dépôt GitHub public + README à jour (problème, solution, données NASA utilisées, limites).
- Démo en ligne (Render ou GitHub Pages pour le front + Render pour l'API).
- Vidéo/diaporama de 30 s max (script dans `docs/pitch.md` à rédiger en P0 bis).
- Liste des données NASA utilisées avec liens (section « Données » du README).

## 8. Commandes
```bash
npm install
cp .env.example .env
npm run check     # vérifie l'accès à NASA POWER
npm run dev       # serveur sur http://localhost:3000
```

## 9. Comportement attendu de Claude Code dans ce dépôt
- Au démarrage : lancer `npm install` puis `npm run check`, lire `docs/plan-48h.md`, prendre la **première tâche non cochée**, la réaliser, tester, committer, passer à la suivante.
- Si NASA POWER est injoignable : continuer avec les fichiers en cache de `cache/` ; ne jamais remplacer par des valeurs inventées.
- Après chaque tâche P0 : vérifier dans le navigateur ou par `curl` que l'endpoint répond, puis cocher la tâche.
- Rester dans le périmètre : ne pas ajouter de framework, d'authentification, ni de base de données sans nécessité.
