// Modèle des pneus (tyres.ini).
import { TYRE_PARAMS, THERMAL_PARAMS } from './params.js';

const COMPOUND_RE = /^(FRONT|REAR)(?:_(\d+))?$/;

/**
 * Détecte les composés : [FRONT]/[REAR] = index 0, [FRONT_1]/[REAR_1] = index 1…
 * @param {import('./ini.js').IniFile} ini
 */
export function detectCompounds(ini) {
  const byIndex = new Map();
  for (const s of ini.sections()) {
    const m = COMPOUND_RE.exec(s);
    if (!m) continue;
    const index = m[2] ? Number(m[2]) : 0;
    if (!byIndex.has(index)) byIndex.set(index, { index });
    byIndex.get(index)[m[1] === 'FRONT' ? 'front' : 'rear'] = s;
  }
  const sfx = (i) => (i === 0 ? '' : `_${i}`);
  return [...byIndex.values()]
    .sort((a, b) => a.index - b.index)
    .map((c) => {
      const thermalFront = `THERMAL_FRONT${sfx(c.index)}`;
      const thermalRear = `THERMAL_REAR${sfx(c.index)}`;
      const name = (c.front && ini.get(c.front, 'NAME')) || (c.rear && ini.get(c.rear, 'NAME')) || `Composé ${c.index}`;
      return {
        index: c.index,
        name,
        shortName: (c.front && ini.get(c.front, 'SHORT_NAME')) || '',
        front: c.front || null,
        rear: c.rear || null,
        thermalFront: ini.hasSection(thermalFront) ? thermalFront : null,
        thermalRear: ini.hasSection(thermalRear) ? thermalRear : null,
      };
    });
}

function readSection(ini, section, defs) {
  if (!section) return null;
  const values = {};
  for (const d of defs) {
    const v = ini.get(section, d.key);
    if (v !== undefined) values[d.key] = v;
  }
  return { section, values };
}

/**
 * @param {import('./ini.js').IniFile} ini tyres.ini parsé
 */
export function loadTyres(ini) {
  const defaultIndex = Number(ini.get('COMPOUND_DEFAULT', 'INDEX') ?? 0);
  return {
    version: ini.get('HEADER', 'VERSION') ?? null,
    defaultIndex: Number.isFinite(defaultIndex) ? defaultIndex : 0,
    compounds: detectCompounds(ini).map((c) => ({
      ...c,
      frontData: readSection(ini, c.front, TYRE_PARAMS),
      rearData: readSection(ini, c.rear, TYRE_PARAMS),
      thermalFrontData: readSection(ini, c.thermalFront, THERMAL_PARAMS),
      thermalRearData: readSection(ini, c.thermalRear, THERMAL_PARAMS),
    })),
  };
}

const EDITABLE = new Set([...TYRE_PARAMS, ...THERMAL_PARAMS].filter((p) => !p.readonly).map((p) => p.key));

/**
 * Applique des modifications. Seules les clés connues et existantes sont
 * modifiées (on ne crée pas de clé que la voiture n'avait pas).
 * @param {import('./ini.js').IniFile} ini
 * @param {Array<{section:string,key:string,value:string}>} changes
 */
export function applyTyres(ini, changes) {
  for (const { section, key, value } of changes) {
    if (!EDITABLE.has(key.toUpperCase())) throw new Error(`Clé non modifiable : ${key}`);
    if (!ini.has(section, key)) throw new Error(`Clé absente de tyres.ini : [${section}] ${key}`);
    ini.set(section, key, value);
  }
  return ini;
}
