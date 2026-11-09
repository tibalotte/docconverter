// Description des paramètres exposés en V1 (voir docs/champs.md).
// min/max = plage *plausible* (avertissement en dehors), hardMin/hardMax =
// limites physiques (erreur en dehors). `readonly` = affiché, non modifiable.

/** @typedef {{key:string,label:string,unit?:string,min?:number,max?:number,hardMin?:number,hardMax?:number,step?:number,desc:string,kind?:'number'|'text'|'vector',readonly?:boolean,exclusiveMin?:boolean}} ParamDef */

/** @type {ParamDef[]} */
export const TYRE_PARAMS = [
  { key: 'NAME', label: 'Nom du composé', kind: 'text', desc: 'Nom affiché dans le jeu.' },
  { key: 'SHORT_NAME', label: 'Nom court', kind: 'text', desc: 'Abréviation affichée (ex. SM, H, M).' },
  { key: 'WIDTH', label: 'Largeur', unit: 'm', min: 0.1, max: 0.45, hardMin: 0, exclusiveMin: true, step: 0.001, desc: 'Largeur de la bande de roulement.' },
  { key: 'RADIUS', label: 'Rayon', unit: 'm', min: 0.2, max: 0.5, hardMin: 0, exclusiveMin: true, step: 0.0005, desc: 'Rayon extérieur du pneu.' },
  { key: 'RIM_RADIUS', label: 'Rayon de jante', unit: 'm', min: 0.15, max: 0.45, hardMin: 0, exclusiveMin: true, step: 0.0005, desc: 'Rayon de la jante (un pouce de plus que le nominal, par convention Kunos).' },
  { key: 'ANGULAR_INERTIA', label: 'Inertie angulaire', unit: 'kg·m²', min: 0.3, max: 5, hardMin: 0, exclusiveMin: true, step: 0.01, desc: 'Inertie de l\'ensemble jante + pneu + disque.' },
  { key: 'DAMP', label: 'Amortissement du pneu', unit: 'N·s/m', min: 100, max: 2000, hardMin: 0, step: 10, desc: 'Amortissement vertical de la carcasse.' },
  { key: 'RATE', label: 'Raideur du pneu', unit: 'N/m', min: 100000, max: 600000, hardMin: 0, exclusiveMin: true, step: 1000, desc: 'Raideur verticale de la carcasse à la pression de référence.' },
  { key: 'DX_REF', label: 'Adhérence longitudinale (réf.)', min: 0.8, max: 2.0, hardMin: 0, exclusiveMin: true, step: 0.01, desc: 'Coefficient d\'adhérence longitudinale de référence.' },
  { key: 'DY_REF', label: 'Adhérence latérale (réf.)', min: 0.8, max: 2.0, hardMin: 0, exclusiveMin: true, step: 0.01, desc: 'Coefficient d\'adhérence latérale de référence.' },
  { key: 'FLEX', label: 'Flexibilité du flanc', min: 0, max: 0.003, hardMin: 0, step: 0.00001, desc: 'Plus la valeur est grande, plus la dérive ajoutée avec la charge est grande.' },
  { key: 'CAMBER_GAIN', label: 'Gain de carrossage', min: 0, max: 1.5, step: 0.001, desc: 'Multiplicateur de l\'angle de dérive dû au carrossage.' },
  { key: 'FRICTION_LIMIT_ANGLE', label: 'Angle limite d\'adhérence', unit: '°', min: 3, max: 15, hardMin: 0, exclusiveMin: true, step: 0.01, desc: 'Angle de dérive au pic d\'adhérence.' },
  { key: 'SPEED_SENSITIVITY', label: 'Sensibilité à la vitesse', min: 0, max: 0.01, step: 0.00001, desc: 'Perte d\'adhérence avec la vitesse de glissement.' },
  { key: 'RELAXATION_LENGTH', label: 'Longueur de relaxation', unit: 'm', min: 0.01, max: 0.3, hardMin: 0, step: 0.001, desc: 'Distance parcourue avant que la force latérale s\'établisse.' },
  { key: 'PRESSURE_STATIC', label: 'Pression à froid', unit: 'psi', min: 10, max: 50, hardMin: 0, exclusiveMin: true, step: 0.5, desc: 'Pression de départ (à froid).' },
  { key: 'PRESSURE_IDEAL', label: 'Pression idéale', unit: 'psi', min: 10, max: 55, hardMin: 0, exclusiveMin: true, step: 0.5, desc: 'Pression à chaud donnant l\'adhérence maximale.' },
  { key: 'PRESSURE_SPRING_GAIN', label: 'Gain de raideur / pression', unit: 'N/m/psi', min: 0, max: 30000, step: 10, desc: 'Raideur ajoutée par psi.' },
  { key: 'PRESSURE_FLEX_GAIN', label: 'Gain de flex / pression', min: 0, max: 2, step: 0.01, desc: 'Variation du flex par psi.' },
  { key: 'PRESSURE_RR_GAIN', label: 'Gain résistance au roulement / pression', min: 0, max: 2, step: 0.01, desc: 'Variation de la résistance au roulement par psi.' },
  { key: 'PRESSURE_D_GAIN', label: 'Perte d\'empreinte / pression', min: 0, max: 0.05, step: 0.0001, desc: 'Perte d\'adhérence quand on s\'éloigne de la pression idéale.' },
  { key: 'ROLLING_RESISTANCE_0', label: 'Résistance au roulement (constante)', min: 0, max: 50, hardMin: 0, step: 0.1, desc: 'Composante constante.' },
  { key: 'ROLLING_RESISTANCE_1', label: 'Résistance au roulement (vitesse²)', min: 0, max: 0.01, hardMin: 0, step: 0.00001, desc: 'Composante proportionnelle au carré de la vitesse.' },
  { key: 'ROLLING_RESISTANCE_SLIP', label: 'Résistance au roulement (dérive)', min: 0, max: 10000, hardMin: 0, step: 10, desc: 'Composante liée à l\'angle de dérive.' },
  { key: 'FALLOFF_LEVEL', label: 'Niveau après le pic', min: 0.5, max: 1, hardMin: 0, step: 0.01, desc: 'Fraction de l\'adhérence conservée au-delà du pic.' },
  { key: 'FALLOFF_SPEED', label: 'Vitesse de chute après le pic', min: 0.5, max: 10, hardMin: 0, step: 0.1, desc: 'Rapidité de la chute d\'adhérence après le pic.' },
  { key: 'BRAKE_DX_MOD', label: 'Modificateur DX au freinage', min: -0.2, max: 0.2, step: 0.001, desc: 'Ajuste l\'adhérence longitudinale au freinage.' },
  { key: 'WEAR_CURVE', label: 'Courbe d\'usure', kind: 'text', readonly: true, desc: 'Fichier .lut (édition prévue en phase 8).' },
];

/** @type {ParamDef[]} */
export const THERMAL_PARAMS = [
  { key: 'SURFACE_TRANSFER', label: 'Transfert surface', min: 0, max: 0.1, hardMin: 0, step: 0.0001, desc: 'Vitesse d\'échange de chaleur surface ↔ air/piste.' },
  { key: 'PATCH_TRANSFER', label: 'Transfert empreinte', min: 0, max: 0.01, hardMin: 0, step: 0.00001, desc: 'Échange de chaleur au contact de la piste.' },
  { key: 'CORE_TRANSFER', label: 'Transfert cœur', min: 0, max: 0.01, hardMin: 0, step: 0.00001, desc: 'Échange surface ↔ cœur.' },
  { key: 'INTERNAL_CORE_TRANSFER', label: 'Transfert cœur interne', min: 0, max: 0.05, hardMin: 0, step: 0.0001, desc: 'Échange cœur ↔ air interne.' },
  { key: 'FRICTION_K', label: 'Chauffe par glissement', min: 0, max: 0.2, hardMin: 0, step: 0.0001, desc: 'Chaleur produite par le glissement.' },
  { key: 'ROLLING_K', label: 'Chauffe par roulement', min: 0, max: 1, hardMin: 0, step: 0.001, desc: 'Chaleur produite par la déformation en roulant.' },
  { key: 'COOL_FACTOR', label: 'Facteur de refroidissement', min: 0, max: 5, hardMin: 0, step: 0.01, desc: 'Refroidissement avec la vitesse.' },
  { key: 'SURFACE_ROLLING_K', label: 'Chauffe surface en roulant', min: 0, max: 5, hardMin: 0, step: 0.01, desc: 'Part de la chauffe de roulement envoyée en surface.' },
  { key: 'GRAIN_GAMMA', label: 'Grainage (gamma)', min: 0, max: 5, hardMin: 0, step: 0.01, desc: 'Forme de la courbe de grainage.' },
  { key: 'GRAIN_GAIN', label: 'Grainage (gain)', min: 0, max: 2, hardMin: 0, step: 0.01, desc: 'Intensité du grainage.' },
  { key: 'BLISTER_GAMMA', label: 'Cloquage (gamma)', min: 0, max: 5, hardMin: 0, step: 0.01, desc: 'Forme de la courbe de cloquage.' },
  { key: 'BLISTER_GAIN', label: 'Cloquage (gain)', min: 0, max: 2, hardMin: 0, step: 0.01, desc: 'Intensité du cloquage.' },
  { key: 'PERFORMANCE_CURVE', label: 'Courbe de performance', kind: 'text', readonly: true, desc: 'Fichier .lut température → adhérence (édition prévue en phase 8).' },
];

/** @type {ParamDef[]} */
export const SUSPENSION_PARAMS = [
  { key: 'TYPE', label: 'Type', kind: 'text', readonly: true, desc: 'DWB (double triangulation), STRUT (McPherson), AXLE (essieu rigide)…' },
  { key: 'SPRING_RATE', label: 'Raideur de ressort (à la roue)', unit: 'N/m', min: 5000, max: 500000, hardMin: 0, step: 500, desc: 'Raideur ramenée à la roue.' },
  { key: 'PROGRESSIVE_SPRING_RATE', label: 'Raideur progressive', unit: 'N/m/m', min: 0, max: 2000000, hardMin: 0, step: 1000, desc: 'Augmentation de raideur avec la course.' },
  { key: 'BUMP_STOP_RATE', label: 'Raideur de butée', unit: 'N/m', min: 10000, max: 5000000, hardMin: 0, step: 1000, desc: 'Raideur des tampons de butée.' },
  { key: 'BUMPSTOP_UP', label: 'Butée haute', unit: 'm', min: 0, max: 0.3, hardMin: 0, step: 0.001, desc: 'Course jusqu\'à la butée haute.' },
  { key: 'BUMPSTOP_DN', label: 'Butée basse', unit: 'm', min: 0, max: 0.3, hardMin: 0, step: 0.001, desc: 'Course jusqu\'à la butée basse.' },
  { key: 'PACKER_RANGE', label: 'Course avant packers', unit: 'm', min: 0, max: 0.3, hardMin: 0, step: 0.001, desc: 'Course totale avant contact des packers (0 = aucun).' },
  { key: 'DAMP_BUMP', label: 'Compression lente', unit: 'N·s/m', min: 500, max: 30000, hardMin: 0, step: 50, desc: 'Amortissement en compression basse vitesse.' },
  { key: 'DAMP_FAST_BUMP', label: 'Compression rapide', unit: 'N·s/m', min: 200, max: 30000, hardMin: 0, step: 50, desc: 'Amortissement en compression haute vitesse.' },
  { key: 'DAMP_FAST_BUMPTHRESHOLD', label: 'Seuil compression rapide', unit: 'm/s', min: 0.02, max: 1, hardMin: 0, step: 0.01, desc: 'Vitesse de tige où commence la compression rapide.' },
  { key: 'DAMP_REBOUND', label: 'Détente lente', unit: 'N·s/m', min: 500, max: 40000, hardMin: 0, step: 50, desc: 'Amortissement en détente basse vitesse.' },
  { key: 'DAMP_FAST_REBOUND', label: 'Détente rapide', unit: 'N·s/m', min: 200, max: 40000, hardMin: 0, step: 50, desc: 'Amortissement en détente haute vitesse.' },
  { key: 'DAMP_FAST_REBOUNDTHRESHOLD', label: 'Seuil détente rapide', unit: 'm/s', min: 0.02, max: 1, hardMin: 0, step: 0.01, desc: 'Vitesse de tige où commence la détente rapide.' },
  { key: 'STATIC_CAMBER', label: 'Carrossage statique', unit: '°', min: -6, max: 2, step: 0.1, desc: 'Négatif = haut de roue vers l\'intérieur.' },
  { key: 'TOE_OUT', label: 'Parallélisme (ouverture)', unit: 'm', min: -0.01, max: 0.01, step: 0.0001, desc: 'Exprimé en longueur de biellette de direction.' },
  { key: 'TRACK', label: 'Voie', unit: 'm', min: 1, max: 2.2, hardMin: 0, exclusiveMin: true, step: 0.001, desc: 'Largeur de voie.' },
  { key: 'BASEY', label: 'Hauteur du CG / roue', unit: 'm', min: -0.5, max: 0.5, step: 0.001, desc: 'Distance verticale du centre de gravité au centre de roue.' },
  { key: 'HUB_MASS', label: 'Masse non suspendue', unit: 'kg', min: 5, max: 120, hardMin: 0, exclusiveMin: true, step: 0.5, desc: 'Masse du moyeu et de la suspension.' },
  { key: 'ROD_LENGTH', label: 'Longueur de tige de poussée', unit: 'm', min: -0.2, max: 0.2, step: 0.001, desc: 'Change la hauteur de caisse.' },
  { key: 'RIM_OFFSET', label: 'Déport de jante', unit: 'm', min: -0.1, max: 0.1, step: 0.001, desc: 'Déport latéral de la jante.' },
];

/** @type {ParamDef[]} */
export const ARB_PARAMS = [
  { key: 'FRONT', label: 'Barre antiroulis avant', unit: 'N/m', min: 0, max: 300000, hardMin: 0, step: 500, desc: 'Raideur de la barre avant.' },
  { key: 'REAR', label: 'Barre antiroulis arrière', unit: 'N/m', min: 0, max: 300000, hardMin: 0, step: 500, desc: 'Raideur de la barre arrière.' },
];

/** @type {ParamDef[]} */
export const BASIC_PARAMS = [
  { key: 'WHEELBASE', label: 'Empattement', unit: 'm', readonly: true, desc: 'Distance entre essieux.' },
  { key: 'CG_LOCATION', label: 'Répartition avant', readonly: true, desc: 'Part de la masse sur l\'avant (0 à 1).' },
];

/** Clés de géométrie : lecture seule en V1. */
export const GEOMETRY_KEY_RE = /^(WBCAR_|WBTYRE_|STRUT_|AXLE_|LEAF_|JOINT|LINK_|SPRING_POINT|DAMPER_POINT)/;

export const SETUP_RANGE_PARAMS = [
  { key: 'MIN', label: 'Min', step: 'any', desc: 'Valeur minimale du réglage (en unités du réglage).' },
  { key: 'MAX', label: 'Max', step: 'any', desc: 'Valeur maximale du réglage.' },
  { key: 'STEP', label: 'Pas', step: 'any', hardMin: 0, exclusiveMin: true, desc: 'Pas entre deux crans.' },
];

export function paramIndex(list) {
  return Object.fromEntries(list.map((p) => [p.key, p]));
}
