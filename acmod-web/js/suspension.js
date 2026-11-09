// Modèle des suspensions (suspensions.ini).
import { SUSPENSION_PARAMS, ARB_PARAMS, BASIC_PARAMS, GEOMETRY_KEY_RE } from './params.js';

function pick(ini, section, defs) {
  if (!ini.hasSection(section)) return null;
  const values = {};
  for (const d of defs) {
    const v = ini.get(section, d.key);
    if (v !== undefined) values[d.key] = v;
  }
  return { section, values };
}

function geometry(ini, section) {
  if (!ini.hasSection(section)) return {};
  const out = {};
  for (const k of ini.keys(section)) if (GEOMETRY_KEY_RE.test(k)) out[k] = ini.get(section, k);
  return out;
}

/** @param {import('./ini.js').IniFile} ini */
export function loadSuspension(ini) {
  return {
    version: ini.get('HEADER', 'VERSION') ?? null,
    basic: pick(ini, 'BASIC', BASIC_PARAMS),
    arb: pick(ini, 'ARB', ARB_PARAMS),
    front: pick(ini, 'FRONT', SUSPENSION_PARAMS),
    rear: pick(ini, 'REAR', SUSPENSION_PARAMS),
    geometry: { FRONT: geometry(ini, 'FRONT'), REAR: geometry(ini, 'REAR') },
  };
}

const EDITABLE = {
  FRONT: new Set(SUSPENSION_PARAMS.filter((p) => !p.readonly).map((p) => p.key)),
  REAR: new Set(SUSPENSION_PARAMS.filter((p) => !p.readonly).map((p) => p.key)),
  ARB: new Set(ARB_PARAMS.map((p) => p.key)),
};

export function isEditableSuspensionKey(section, key) {
  const S = section.toUpperCase();
  const K = key.toUpperCase();
  return !GEOMETRY_KEY_RE.test(K) && Boolean(EDITABLE[S]?.has(K));
}

/**
 * @param {import('./ini.js').IniFile} ini
 * @param {Array<{section:string,key:string,value:string}>} changes
 */
export function applySuspension(ini, changes) {
  for (const { section, key, value } of changes) {
    if (!isEditableSuspensionKey(section, key)) throw new Error(`Clé non modifiable : [${section}] ${key}`);
    if (!ini.has(section, key)) throw new Error(`Clé absente de suspensions.ini : [${section}] ${key}`);
    ini.set(section, key, value);
  }
  return ini;
}
