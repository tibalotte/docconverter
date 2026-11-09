// Régénère docs/champs.md à partir de js/params.js : node tools/gen-champs.mjs
import { writeFileSync } from 'node:fs';
import { TYRE_PARAMS, THERMAL_PARAMS, SUSPENSION_PARAMS, ARB_PARAMS, BASIC_PARAMS, SETUP_RANGE_PARAMS, GEOMETRY_KEY_RE } from '../js/params.js';

const range = (p) => (p.min !== undefined || p.max !== undefined ? `${p.min ?? '−∞'} à ${p.max ?? '+∞'}` : '');
const limit = (p) => {
  const parts = [];
  if (p.hardMin !== undefined) parts.push(`${p.exclusiveMin ? '>' : '≥'} ${p.hardMin}`);
  if (p.hardMax !== undefined) parts.push(`≤ ${p.hardMax}`);
  return parts.join(', ');
};
const table = (list) => [
  '| Clé | Nom | Unité | Plage habituelle (avertissement) | Limite (erreur) | Modifiable | Effet |',
  '|---|---|---|---|---|---|---|',
  ...list.map((p) => `| \`${p.key}\` | ${p.label} | ${p.unit ?? ''} | ${range(p)} | ${limit(p)} | ${p.readonly ? 'non' : 'oui'} | ${p.desc} |`),
].join('\n');

const md = `# Champs exposés en V1

> Fichier généré par \`node tools/gen-champs.mjs\` à partir de \`js/params.js\`. Ne pas modifier à la main.

**Attention :** les plages ci-dessous sont des valeurs de départ raisonnables, **pas encore validées sur de vraies
voitures** (phases 0 et 9 du plan). Elles ne servent qu'à afficher des avertissements ; seules les « limites »
bloquent l'enregistrement.

Règles générales :

- une valeur numérique s'écrit avec un point décimal (\`0.25\`), sans notation scientifique ;
- un écart de plus de 50 % par rapport à la valeur d'origine donne un avertissement ;
- seules les clés **déjà présentes** dans le fichier peuvent être modifiées (l'outil n'ajoute pas de clé).

## tyres.ini : sections \`[FRONT]\`, \`[REAR]\`, \`[FRONT_n]\`, \`[REAR_n]\`

Un composé = une paire \`[FRONT_n]\` / \`[REAR_n]\` (sans suffixe pour le composé 0).
\`[COMPOUND_DEFAULT] INDEX\` désigne le composé par défaut.

${table(TYRE_PARAMS)}

## tyres.ini : sections \`[THERMAL_FRONT]\`, \`[THERMAL_REAR]\`, \`[THERMAL_FRONT_n]\`…

${table(THERMAL_PARAMS)}

## suspensions.ini : \`[FRONT]\` et \`[REAR]\`

${table(SUSPENSION_PARAMS)}

Points de géométrie (lecture seule en V1) : clés correspondant à \`${GEOMETRY_KEY_RE.source}\`
(ex. \`WBCAR_TOP_FRONT\`, \`WBTYRE_BOTTOM\`, \`STRUT_CAR\`), au format \`x, y, z\` en mètres.

## suspensions.ini : \`[ARB]\`

${table(ARB_PARAMS)}

## suspensions.ini : \`[BASIC]\`

${table(BASIC_PARAMS)}

## setup.ini

Chaque section qui possède \`MIN\` et \`MAX\` est un réglage proposé au joueur dans le garage.
Valeurs dans les unités du réglage (selon \`SHOW_CLICKS\`).

${table(SETUP_RANGE_PARAMS)}

Règles croisées :

- \`MIN\` > \`MAX\` : erreur ;
- \`(MAX − MIN) / STEP\` non entier : avertissement.

## Règles croisées (pneus et suspensions)

| Règle | Niveau |
|---|---|
| \`RIM_RADIUS\` ≥ \`RADIUS\` | erreur |
| \`PRESSURE_STATIC\` > \`PRESSURE_IDEAL\` | avertissement |
| Avant et arrière d'un même paramètre dans un rapport > 3 (WIDTH, RADIUS, DX_REF, DY_REF, PRESSURE_IDEAL, RATE, FLEX, SPRING_RATE, DAMP_BUMP, DAMP_REBOUND, BUMP_STOP_RATE) | avertissement |
| \`DAMP_FAST_BUMP\` > \`DAMP_BUMP\`, \`DAMP_FAST_REBOUND\` > \`DAMP_REBOUND\` | avertissement |

Une règle croisée n'est signalée que si l'un des champs concernés a été modifié.

## À compléter (phase 9)

Noter ici les surprises constatées en jeu, et corriger les plages dans \`js/params.js\`.
`;
writeFileSync(new URL('../docs/champs.md', import.meta.url), md);
