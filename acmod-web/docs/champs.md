# Champs exposés en V1

> Fichier généré par `node tools/gen-champs.mjs` à partir de `js/params.js`. Ne pas modifier à la main.

**Attention :** les plages ci-dessous sont des valeurs de départ raisonnables, **pas encore validées sur de vraies
voitures** (phases 0 et 9 du plan). Elles ne servent qu'à afficher des avertissements ; seules les « limites »
bloquent l'enregistrement.

Règles générales :

- une valeur numérique s'écrit avec un point décimal (`0.25`), sans notation scientifique ;
- un écart de plus de 50 % par rapport à la valeur d'origine donne un avertissement ;
- seules les clés **déjà présentes** dans le fichier peuvent être modifiées (l'outil n'ajoute pas de clé).

## tyres.ini : sections `[FRONT]`, `[REAR]`, `[FRONT_n]`, `[REAR_n]`

Un composé = une paire `[FRONT_n]` / `[REAR_n]` (sans suffixe pour le composé 0).
`[COMPOUND_DEFAULT] INDEX` désigne le composé par défaut.

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `NAME` | Nom du composé |  |  |  | oui | Nom affiché dans le jeu. |
| `SHORT_NAME` | Nom court |  |  |  | oui | Abréviation affichée (ex. SM, H, M). |
| `WIDTH` | Largeur | m | 0.1 à 0.45 | > 0 | oui | Largeur de la bande de roulement. |
| `RADIUS` | Rayon | m | 0.2 à 0.5 | > 0 | oui | Rayon extérieur du pneu. |
| `RIM_RADIUS` | Rayon de jante | m | 0.15 à 0.45 | > 0 | oui | Rayon de la jante (un pouce de plus que le nominal, par convention Kunos). |
| `ANGULAR_INERTIA` | Inertie angulaire | kg·m² | 0.3 à 5 | > 0 | oui | Inertie de l'ensemble jante + pneu + disque. |
| `DAMP` | Amortissement du pneu | N·s/m | 100 à 2000 | ≥ 0 | oui | Amortissement vertical de la carcasse. |
| `RATE` | Raideur du pneu | N/m | 100000 à 600000 | > 0 | oui | Raideur verticale de la carcasse à la pression de référence. |
| `DX_REF` | Adhérence longitudinale (réf.) |  | 0.8 à 2 | > 0 | oui | Coefficient d'adhérence longitudinale de référence. |
| `DY_REF` | Adhérence latérale (réf.) |  | 0.8 à 2 | > 0 | oui | Coefficient d'adhérence latérale de référence. |
| `FLEX` | Flexibilité du flanc |  | 0 à 0.003 | ≥ 0 | oui | Plus la valeur est grande, plus la dérive ajoutée avec la charge est grande. |
| `CAMBER_GAIN` | Gain de carrossage |  | 0 à 1.5 |  | oui | Multiplicateur de l'angle de dérive dû au carrossage. |
| `FRICTION_LIMIT_ANGLE` | Angle limite d'adhérence | ° | 3 à 15 | > 0 | oui | Angle de dérive au pic d'adhérence. |
| `SPEED_SENSITIVITY` | Sensibilité à la vitesse |  | 0 à 0.01 |  | oui | Perte d'adhérence avec la vitesse de glissement. |
| `RELAXATION_LENGTH` | Longueur de relaxation | m | 0.01 à 0.3 | ≥ 0 | oui | Distance parcourue avant que la force latérale s'établisse. |
| `PRESSURE_STATIC` | Pression à froid | psi | 10 à 50 | > 0 | oui | Pression de départ (à froid). |
| `PRESSURE_IDEAL` | Pression idéale | psi | 10 à 55 | > 0 | oui | Pression à chaud donnant l'adhérence maximale. |
| `PRESSURE_SPRING_GAIN` | Gain de raideur / pression | N/m/psi | 0 à 30000 |  | oui | Raideur ajoutée par psi. |
| `PRESSURE_FLEX_GAIN` | Gain de flex / pression |  | 0 à 2 |  | oui | Variation du flex par psi. |
| `PRESSURE_RR_GAIN` | Gain résistance au roulement / pression |  | 0 à 2 |  | oui | Variation de la résistance au roulement par psi. |
| `PRESSURE_D_GAIN` | Perte d'empreinte / pression |  | 0 à 0.05 |  | oui | Perte d'adhérence quand on s'éloigne de la pression idéale. |
| `ROLLING_RESISTANCE_0` | Résistance au roulement (constante) |  | 0 à 50 | ≥ 0 | oui | Composante constante. |
| `ROLLING_RESISTANCE_1` | Résistance au roulement (vitesse²) |  | 0 à 0.01 | ≥ 0 | oui | Composante proportionnelle au carré de la vitesse. |
| `ROLLING_RESISTANCE_SLIP` | Résistance au roulement (dérive) |  | 0 à 10000 | ≥ 0 | oui | Composante liée à l'angle de dérive. |
| `FALLOFF_LEVEL` | Niveau après le pic |  | 0.5 à 1 | ≥ 0 | oui | Fraction de l'adhérence conservée au-delà du pic. |
| `FALLOFF_SPEED` | Vitesse de chute après le pic |  | 0.5 à 10 | ≥ 0 | oui | Rapidité de la chute d'adhérence après le pic. |
| `BRAKE_DX_MOD` | Modificateur DX au freinage |  | -0.2 à 0.2 |  | oui | Ajuste l'adhérence longitudinale au freinage. |
| `WEAR_CURVE` | Courbe d'usure |  |  |  | non | Fichier .lut (édition prévue en phase 8). |

## tyres.ini : sections `[THERMAL_FRONT]`, `[THERMAL_REAR]`, `[THERMAL_FRONT_n]`…

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `SURFACE_TRANSFER` | Transfert surface |  | 0 à 0.1 | ≥ 0 | oui | Vitesse d'échange de chaleur surface ↔ air/piste. |
| `PATCH_TRANSFER` | Transfert empreinte |  | 0 à 0.01 | ≥ 0 | oui | Échange de chaleur au contact de la piste. |
| `CORE_TRANSFER` | Transfert cœur |  | 0 à 0.01 | ≥ 0 | oui | Échange surface ↔ cœur. |
| `INTERNAL_CORE_TRANSFER` | Transfert cœur interne |  | 0 à 0.05 | ≥ 0 | oui | Échange cœur ↔ air interne. |
| `FRICTION_K` | Chauffe par glissement |  | 0 à 0.2 | ≥ 0 | oui | Chaleur produite par le glissement. |
| `ROLLING_K` | Chauffe par roulement |  | 0 à 1 | ≥ 0 | oui | Chaleur produite par la déformation en roulant. |
| `COOL_FACTOR` | Facteur de refroidissement |  | 0 à 5 | ≥ 0 | oui | Refroidissement avec la vitesse. |
| `SURFACE_ROLLING_K` | Chauffe surface en roulant |  | 0 à 5 | ≥ 0 | oui | Part de la chauffe de roulement envoyée en surface. |
| `GRAIN_GAMMA` | Grainage (gamma) |  | 0 à 5 | ≥ 0 | oui | Forme de la courbe de grainage. |
| `GRAIN_GAIN` | Grainage (gain) |  | 0 à 2 | ≥ 0 | oui | Intensité du grainage. |
| `BLISTER_GAMMA` | Cloquage (gamma) |  | 0 à 5 | ≥ 0 | oui | Forme de la courbe de cloquage. |
| `BLISTER_GAIN` | Cloquage (gain) |  | 0 à 2 | ≥ 0 | oui | Intensité du cloquage. |
| `PERFORMANCE_CURVE` | Courbe de performance |  |  |  | non | Fichier .lut température → adhérence (édition prévue en phase 8). |

## suspensions.ini : `[FRONT]` et `[REAR]`

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `TYPE` | Type |  |  |  | non | DWB (double triangulation), STRUT (McPherson), AXLE (essieu rigide)… |
| `SPRING_RATE` | Raideur de ressort (à la roue) | N/m | 5000 à 500000 | ≥ 0 | oui | Raideur ramenée à la roue. |
| `PROGRESSIVE_SPRING_RATE` | Raideur progressive | N/m/m | 0 à 2000000 | ≥ 0 | oui | Augmentation de raideur avec la course. |
| `BUMP_STOP_RATE` | Raideur de butée | N/m | 10000 à 5000000 | ≥ 0 | oui | Raideur des tampons de butée. |
| `BUMPSTOP_UP` | Butée haute | m | 0 à 0.3 | ≥ 0 | oui | Course jusqu'à la butée haute. |
| `BUMPSTOP_DN` | Butée basse | m | 0 à 0.3 | ≥ 0 | oui | Course jusqu'à la butée basse. |
| `PACKER_RANGE` | Course avant packers | m | 0 à 0.3 | ≥ 0 | oui | Course totale avant contact des packers (0 = aucun). |
| `DAMP_BUMP` | Compression lente | N·s/m | 500 à 30000 | ≥ 0 | oui | Amortissement en compression basse vitesse. |
| `DAMP_FAST_BUMP` | Compression rapide | N·s/m | 200 à 30000 | ≥ 0 | oui | Amortissement en compression haute vitesse. |
| `DAMP_FAST_BUMPTHRESHOLD` | Seuil compression rapide | m/s | 0.02 à 1 | ≥ 0 | oui | Vitesse de tige où commence la compression rapide. |
| `DAMP_REBOUND` | Détente lente | N·s/m | 500 à 40000 | ≥ 0 | oui | Amortissement en détente basse vitesse. |
| `DAMP_FAST_REBOUND` | Détente rapide | N·s/m | 200 à 40000 | ≥ 0 | oui | Amortissement en détente haute vitesse. |
| `DAMP_FAST_REBOUNDTHRESHOLD` | Seuil détente rapide | m/s | 0.02 à 1 | ≥ 0 | oui | Vitesse de tige où commence la détente rapide. |
| `STATIC_CAMBER` | Carrossage statique | ° | -6 à 2 |  | oui | Négatif = haut de roue vers l'intérieur. |
| `TOE_OUT` | Parallélisme (ouverture) | m | -0.01 à 0.01 |  | oui | Exprimé en longueur de biellette de direction. |
| `TRACK` | Voie | m | 1 à 2.2 | > 0 | oui | Largeur de voie. |
| `BASEY` | Hauteur du CG / roue | m | -0.5 à 0.5 |  | oui | Distance verticale du centre de gravité au centre de roue. |
| `HUB_MASS` | Masse non suspendue | kg | 5 à 120 | > 0 | oui | Masse du moyeu et de la suspension. |
| `ROD_LENGTH` | Longueur de tige de poussée | m | -0.2 à 0.2 |  | oui | Change la hauteur de caisse. |
| `RIM_OFFSET` | Déport de jante | m | -0.1 à 0.1 |  | oui | Déport latéral de la jante. |

Points de géométrie (lecture seule en V1) : clés correspondant à `^(WBCAR_|WBTYRE_|STRUT_|AXLE_|LEAF_|JOINT|LINK_|SPRING_POINT|DAMPER_POINT)`
(ex. `WBCAR_TOP_FRONT`, `WBTYRE_BOTTOM`, `STRUT_CAR`), au format `x, y, z` en mètres.

## suspensions.ini : `[ARB]`

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `FRONT` | Barre antiroulis avant | N/m | 0 à 300000 | ≥ 0 | oui | Raideur de la barre avant. |
| `REAR` | Barre antiroulis arrière | N/m | 0 à 300000 | ≥ 0 | oui | Raideur de la barre arrière. |

## suspensions.ini : `[BASIC]`

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `WHEELBASE` | Empattement | m |  |  | non | Distance entre essieux. |
| `CG_LOCATION` | Répartition avant |  |  |  | non | Part de la masse sur l'avant (0 à 1). |

## setup.ini

Chaque section qui possède `MIN` et `MAX` est un réglage proposé au joueur dans le garage.
Valeurs dans les unités du réglage (selon `SHOW_CLICKS`).

| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |
|---|---|---|---|---|---|---|
| `MIN` | Min |  |  |  | oui | Valeur minimale du réglage (en unités du réglage). |
| `MAX` | Max |  |  |  | oui | Valeur maximale du réglage. |
| `STEP` | Pas |  |  | > 0 | oui | Pas entre deux crans. |

Règles croisées :

- `MIN` > `MAX` : erreur ;
- `(MAX − MIN) / STEP` non entier : avertissement.

## Règles croisées (pneus et suspensions)

| Règle | Niveau |
|---|---|
| `RIM_RADIUS` ≥ `RADIUS` | erreur |
| `PRESSURE_STATIC` > `PRESSURE_IDEAL` | avertissement |
| Avant et arrière d'un même paramètre dans un rapport > 3 (WIDTH, RADIUS, DX_REF, DY_REF, PRESSURE_IDEAL, RATE, FLEX, SPRING_RATE, DAMP_BUMP, DAMP_REBOUND, BUMP_STOP_RATE) | avertissement |
| `DAMP_FAST_BUMP` > `DAMP_BUMP`, `DAMP_FAST_REBOUND` > `DAMP_REBOUND` | avertissement |

Une règle croisée n'est signalée que si l'un des champs concernés a été modifié.

## À compléter (phase 9)

Noter ici les surprises constatées en jeu, et corriger les plages dans `js/params.js`.
