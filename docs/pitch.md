# Pitch RotaSat Cameroun — 30 secondes

- **Vidéo** : [pitch.mp4](../public/pitch.mp4) — 29,1 s, 1280 × 720, MP4 (H.264 + AAC), voix off en français, sous-titres en anglais. Servie à l'adresse `/pitch.mp4` sur la démo.
- **Version animée dans le navigateur** : `/pitch.html` sur la démo (boutons « Lire avec la voix » et « Rejouer sans le son »).
- **Challenge** : NASA Space Apps 2026, *Field Shift: Adapting Farms with NASA Data*.

## Le pitch en une phrase

RotaSat aide un agriculteur camerounais à choisir sa rotation de cultures en la testant sur 10 ans de climat mesuré par la NASA, et lui montre la donnée derrière chaque conseil.

## Déroulé de la vidéo

Chaque plan correspond à une phrase de la voix. Le minutage exact est dans [public/pitch/chrono.json](../public/pitch/chrono.json).

| Début | Ce que dit la voix | À l'écran |
|---|---|---|
| 0,3 s | « À Maroua, la pluie change d'une année à l'autre. Alors, que semer après le maïs ? » | 856 mm en 2022, 640 mm en 2023, puis la question. |
| 5,8 s | « RotaSat lit dix ans de données NASA pour votre champ : pluie, chaleur, humidité du sol. » | L'application : carte de Maroua, graphes du climat, et les trois paramètres NASA POWER. |
| 11,6 s | « Indiquez votre sol et vos priorités. Il propose trois rotations, testées sur une année normale, une sèche, et une chaude. » | Le formulaire, les rotations proposées, puis les trois années réelles du stress test. |
| 19,3 s | « Chaque score montre la donnée NASA qui l'explique. » | Le détail « Pourquoi ? » et une preuve : `NASA POWER · PRECTOTCORR · 2023 jun–sep · 510 mm`. |
| 22,3 s | « Il fonctionne hors ligne, et répond par SMS. » | Mode hors ligne et échange SMS « NIEBE MAROUA ». |
| 25,5 s | « RotaSat appuie l'agriculteur, sans le remplacer. » | Logo et signature. |

Tous les chiffres et toutes les captures viennent de l'application en fonctionnement, sur la zone de Maroua (10,59° N, 14,32° E).

## Voix

La voix est une **voix de synthèse** : Microsoft Vivienne, une voix neuronale française, générée en ligne avec la bibliothèque `edge-tts`. Les six phrases sont dans `public/pitch/voix/`, un fichier par phrase. Pour changer de voix, il suffit de remplacer ces six fichiers et de régénérer le minutage : le montage suit la durée des phrases.

La vidéo affiche en permanence la mention « AI-generated voice · video built with AI assistance », et la même déclaration figure dans ses métadonnées (XMP). À déclarer aussi dans le formulaire de soumission, avec les autres usages d'outils d'IA du projet.

## Réponses courtes aux questions probables du jury

- **Quelles données NASA ?** NASA POWER (pluie `PRECTOTCORR`, température maximale `T2M_MAX`, humidité racinaire `GWETROOT`, 2015–2024) et NASA GIBS (NDVI MODIS Terra).
- **Est-ce une prévision ?** Non. L'outil rejoue des années déjà mesurées pour montrer comment une rotation aurait tenu.
- **D'où viennent les caractéristiques des cultures ?** D'un catalogue indicatif et d'ordres de grandeur de la FAO. L'interface le signale, et un technicien agricole doit les confirmer.
- **Pourquoi le Cameroun ?** Trois zones très contrastées, de 2 700 mm de pluie par an à Dschang à 800 mm à Maroua, et aucun outil équivalent repéré parmi les équipes du challenge.
- **Et la suite ?** Relier le canal texte à une passerelle SMS ou WhatsApp, valider le catalogue avec l'IRAD, ajouter l'humidité du sol SMAP.

## Comment la vidéo est fabriquée

La page `public/pitch.html` dessine chaque instant à partir du temps (`window.rendu(t)`). Avec `?capture=1`, la lecture automatique est désactivée, ce qui permet de l'exporter image par image à 25 images par seconde. Les images et la voix sont ensuite encodées en MP4 par l'encodeur du navigateur, sans temps réel, donc la voix et l'image restent calées. Les captures de l'application sont dans `public/pitch/`.
