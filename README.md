# RotaSat Cameroun 🌱🛰

Outil d'aide à la décision qui aide les agriculteurs camerounais à choisir des **rotations de cultures résilientes au climat**, à partir des **données d'observation de la Terre de la NASA**, du sol local et de leurs propres priorités.

Projet pour le **NASA Space Apps Challenge 2026** — challenge *Field Shift: Adapting Farms with NASA Data*.

## Démarrage
```bash
npm install
cp .env.example .env
npm run check   # test NASA POWER
npm run dev     # http://localhost:3000
```

## Données
- NASA POWER (pluie, températures, humidité du sol, rayonnement) — https://power.larc.nasa.gov
- NASA GIBS (imagerie MODIS) — https://nasa-gibs.github.io/gibs-api-docs/
- SoilGrids, ISRIC (estimation du sol, optionnelle) — https://soilgrids.org

## Limites
Outil d'aide à la décision, pas une prévision. Les données NASA POWER sont maillées (~0,5°) et ne remplacent pas une mesure au champ. Les caractéristiques des cultures sont indicatives et doivent être validées avec un technicien agricole.

## Licence
MIT
