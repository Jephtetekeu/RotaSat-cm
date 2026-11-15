# Pitch RotaSat Cameroun — 30 secondes

- **Vidéo** : [pitch.mp4](pitch.mp4) — 29,5 s, 1280 × 720, MP4 (H.264), sans son.
- **Version animée dans le navigateur** : `/pitch.html` sur la démo (bouton « Rejouer »).
- **Challenge** : NASA Space Apps 2026, *Field Shift: Adapting Farms with NASA Data*.

## Le pitch en une phrase

RotaSat aide un agriculteur camerounais à choisir sa rotation de cultures en la testant sur 10 ans de climat mesuré par la NASA, et lui montre la donnée derrière chaque conseil.

## Déroulé de la vidéo

| Temps | À l'écran | Message |
|---|---|---|
| 0 – 4,6 s | « 856 mm en 2022 · 640 mm en 2023 » puis « Quelle culture semer après le maïs ? » | Le problème : à Maroua, la pluie change fortement d'une année à l'autre. |
| 4,6 – 9,2 s | Trois blocs : données NASA, sol de l'agriculteur, ses priorités | La solution : RotaSat croise ces trois éléments et propose 3 rotations expliquées. |
| 9,2 – 14,8 s | Graphes de pluie, température et humidité du sol ; carte NDVI | Étape 1 : le climat réel du champ, avec NASA POWER et NASA GIBS (MODIS). |
| 14,8 – 19,8 s | Les trois années : normale 2022, sèche 2023, chaude 2024 | Étape 2 : un stress test sur des années réelles, jamais inventées. |
| 19,8 – 25 s | Rotation Haricot → Maïs → Arachide et son détail « Pourquoi ? » | Étape 3 : chaque score cite sa source, son paramètre, sa période et sa valeur. |
| 25 – 28 s | Hors ligne et échange SMS « NIEBE MAROUA » | L'accès terrain : utilisable sans réseau et par SMS. |
| 28 – 30 s | Logo et signature | L'outil appuie le jugement de l'agriculteur, il ne le remplace pas. |

Tous les chiffres et toutes les captures viennent de l'application en fonctionnement, sur la zone de Maroua (10,59° N, 14,32° E).

## Texte à dire si le pitch est présenté à l'oral (environ 30 secondes)

> À Maroua, la NASA a mesuré 856 millimètres de pluie en 2022, et 640 en 2023. Alors, quelle culture semer après le maïs ?
>
> RotaSat croise dix ans de données NASA avec le sol de l'agriculteur et ses priorités. Il propose trois rotations, et teste chacune sur trois années réelles : une normale, une sèche, une chaude.
>
> Chaque score montre la donnée qui l'explique. L'outil fonctionne hors ligne et répond par SMS.
>
> RotaSat appuie le jugement de l'agriculteur. Il ne le remplace pas.

## Réponses courtes aux questions probables du jury

- **Quelles données NASA ?** NASA POWER (pluie `PRECTOTCORR`, température maximale `T2M_MAX`, humidité racinaire `GWETROOT`, 2015–2024) et NASA GIBS (NDVI MODIS Terra).
- **Est-ce une prévision ?** Non. L'outil rejoue des années déjà mesurées pour montrer comment une rotation aurait tenu.
- **D'où viennent les caractéristiques des cultures ?** D'un catalogue indicatif et d'ordres de grandeur de la FAO. L'interface le signale, et un technicien agricole doit les confirmer.
- **Pourquoi le Cameroun ?** Trois zones très contrastées, de 2 700 mm de pluie par an à Dschang à 800 mm à Maroua, et aucun outil équivalent repéré parmi les équipes du challenge.
- **Et la suite ?** Relier le canal texte à une passerelle SMS ou WhatsApp, valider le catalogue avec l'IRAD, ajouter l'humidité du sol SMAP.

## Refaire la vidéo

La page `public/pitch.html` dessine chaque instant à partir du temps (`window.rendu(t)`), ce qui permet de l'exporter image par image. Avec `?capture=1`, la lecture automatique est désactivée. Les captures de l'application sont dans `public/pitch/`.
