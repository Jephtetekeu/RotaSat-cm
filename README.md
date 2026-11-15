# RotaSat Cameroun

**Quelle culture planter après le maïs, quand les pluies ne suivent plus le calendrier ?**

RotaSat est un outil d'aide à la décision qui aide les agriculteurs camerounais à explorer des **rotations de cultures** adaptées à leur champ. Il croise 10 ans d'observations de la NASA avec le sol décrit par l'agriculteur et ses propres priorités, puis explique chaque proposition par la donnée qui la motive.

Projet du **NASA Space Apps Challenge 2026**, challenge *Field Shift: Adapting Farms with NASA Data*.

- Code : https://github.com/Jephtetekeu/RotaSat-cm
- Démo en ligne : lien ajouté après le déploiement
- Pitch de 30 secondes : [docs/pitch.md](docs/pitch.md)

> Outil d'aide à la décision — à valider avec un technicien agricole (MINADER/IRAD). RotaSat appuie le jugement de l'agriculteur, il ne le remplace pas.

## Le problème

Au Cameroun, la rotation des cultures se décide surtout par habitude. Or la saison des pluies varie fortement d'une année à l'autre : à Maroua, NASA POWER mesure 856 mm de pluie en 2022 et 640 mm en 2023. Une rotation qui fonctionne en année normale peut échouer en année sèche, et l'agriculteur n'a aucun moyen simple de le vérifier avant de semer.

## La solution

1. **L'agriculteur choisit son champ** sur la carte, ou l'une des 3 zones de démonstration : Hauts-Plateaux de l'Ouest (Dschang), Nord (Garoua), Extrême-Nord (Maroua).
2. **Il décrit son sol** (texture, pH, matière organique) et règle 5 priorités : économiser l'eau, fertilité, érosion, débouchés, revenu.
3. **RotaSat lit 10 ans de climat NASA** pour ce point : pluie, température maximale, jours au-dessus de 35 °C, humidité de la zone racinaire.
4. **Il propose 3 rotations sur 3 saisons**, chacune notée dans 3 années réelles.

### Ce qui distingue RotaSat

| | |
|---|---|
| **Stress test sur des années réelles** | Chaque rotation est évaluée dans une année normale, une année sèche et une année chaude. Ce sont des années réellement observées entre 2015 et 2024, choisies par leur rang (médiane de pluie, percentile 20 de pluie, percentile 80 de température). Aucune année n'est inventée. |
| **Explicabilité** | Le bouton « Pourquoi ? » montre, pour chaque score, la donnée exacte : source, paramètre, période, valeur. Exemple : `NASA POWER · PRECTOTCORR · 2023 jun–sep · 510 mm`. |
| **Accès terrain** | L'application s'installe sur le téléphone et reste utilisable hors ligne pour les zones de démonstration. Un canal texte répond en un SMS de 160 caractères. |
| **Terrain camerounais** | Trois zones agro-écologiques contrastées, de 2 700 mm de pluie par an à Dschang à 800 mm à Maroua. |

### Les règles de rotation

- Jamais la même famille botanique deux saisons de suite.
- Au moins une légumineuse sur les 3 saisons, pour l'azote.
- Trois cultures différentes.
- Une culture est écartée si la pluie de la saison est très inférieure à son besoin en eau.
- Le découpage en saisons vient des données : 8 mois humides à Dschang donnent 2 cycles par an, 4 mois à Garoua et Maroua donnent 1 cycle par an.

Les 6 critères notés sont l'eau, le sol et l'azote, l'érosion, le marché, le revenu et le risque de chaleur. Les priorités de l'agriculteur fixent leur poids.

## Données

| Source | Usage | Lien |
|---|---|---|
| **NASA POWER** (LaRC), communauté AG | Séries journalières 2015–2024 : `PRECTOTCORR` (pluie), `T2M_MAX` (température maximale), `GWETROOT` (humidité de la zone racinaire) | https://power.larc.nasa.gov |
| **NASA GIBS** | Couche satellite sur la carte : NDVI MODIS Terra, composite 8 jours | https://nasa-gibs.github.io/gibs-api-docs/ |
| **FAO**, *Irrigation Water Management, Training Manual n°3* (Brouwer & Heibloem, 1986) | Ordres de grandeur des besoins en eau des cultures | https://www.fao.org/4/s2022e/s2022e00.htm |
| OpenStreetMap | Fond de carte | https://www.openstreetmap.org |

Les valeurs NASA sont servies telles que l'API les renvoie, avec leur provenance. Une valeur manquante (`-999`) reste vide, elle n'est jamais remplacée par zéro. Le catalogue des cultures ([data/crops.cm.json](data/crops.cm.json)) contient des caractéristiques qualitatives indicatives, signalées comme telles dans l'interface.

## Démarrage

Node.js 18 ou plus récent. Aucune clé d'API n'est nécessaire.

```bash
npm install
cp .env.example .env
npm run check   # vérifie l'accès à NASA POWER
npm run dev     # http://localhost:3000
```

Liens directs de démonstration : `/?zone=ouest-dschang`, `/?zone=nord-garoua`, `/?zone=extreme-nord-maroua`, `/?ndvi=1`.

## API

| Route | Rôle |
|---|---|
| `GET /api/field?lat=&lon=` | Résumé climatique du point sur 10 ans |
| `POST /api/recommend` | 3 rotations × 3 scénarios, avec les raisons. Corps : `{lat, lon, sol:{texture, ph, matiere_organique}, priorites:{eau, sol, erosion, marche, revenu}}` |
| `POST /api/sms` | Réponse texte de 160 caractères au plus. Corps : `{"texte":"MAIS DSCHANG"}` |
| `GET /api/zones`, `GET /api/crops` | Zones de démonstration et catalogue des cultures |

Exemple de réponse du canal texte :

```
RotaSat Maroua: Arachide>Mais>Niebe 77/100. Annee seche 2023 (510 mm en saison): 76/100. A valider avec technicien MINADER.
```

## Technique

Node.js et Express côté serveur, HTML, CSS et JavaScript sans framework côté navigateur, Leaflet pour la carte, Chart.js pour les graphes. Pas de base de données : les réponses de la NASA sont mises en cache sur disque.

| Fichier | Rôle |
|---|---|
| [src/nasaPower.js](src/nasaPower.js) | Client NASA POWER, cache, provenance |
| [src/field.js](src/field.js) | Résumé climatique sur 10 ans |
| [src/scenarios.js](src/scenarios.js) | Choix des 3 années réelles |
| [src/rotation.js](src/rotation.js) | Génération, notation et raisons des rotations |
| [src/sms.js](src/sms.js) | Canal texte |
| [public/](public/) | Interface, service worker, manifest |

### Sécurité

- Toutes les entrées sont validées côté serveur ; la taille des requêtes est plafonnée à 10 Ko.
- Le texte issu des données est inséré comme texte, jamais comme HTML.
- En-têtes de sécurité : Content-Security-Policy sans script inline, `nosniff`, interdiction d'encadrer le site, HSTS en production.
- 30 requêtes par minute et par adresse IP sur l'API.
- Les erreurs internes sont masquées en production. Aucun secret dans le dépôt.

## Limites

- **Ce n'est pas une prévision.** RotaSat rejoue le passé mesuré, il n'annonce ni la météo ni un rendement.
- **Données maillées.** NASA POWER a une résolution d'environ 0,5° (une cinquantaine de kilomètres). Ce n'est pas une mesure au champ.
- **Agronomie indicative.** Les caractéristiques des cultures et les seuils d'eau sont des ordres de grandeur à valider avec l'IRAD ou le MINADER. Les scores servent à comparer des rotations entre elles.
- **La chaleur est peu pénalisée** pendant la saison des pluies, et le stress test modifie peu les scores dans les 3 zones : sur 2015–2024, même les années sèches gardent assez de pluie en saison de culture.
- **Hors ligne** : seules les 3 zones de démonstration avec les réglages par défaut sont disponibles, et le fond de carte ne s'affiche pas.
- **Canal texte** : 3 villes reconnues, réponses sans accents, pas encore relié à une passerelle SMS ou WhatsApp.
- Le manioc, dont le cycle dépasse une saison, n'est pas traité dans les rotations à 3 saisons.

## Licence

MIT
