// Lecture de setup.ini : réglages accessibles au joueur dans le garage.
// Chaque section qui a MIN, MAX et STEP est un réglage à plage.

/** @param {import('./ini.js').IniFile} ini */
export function loadSetup(ini) {
  const items = [];
  for (const s of ini.sections()) {
    const min = ini.get(s, 'MIN');
    const max = ini.get(s, 'MAX');
    const step = ini.get(s, 'STEP');
    if (min === undefined || max === undefined) continue;
    items.push({
      section: s,
      name: ini.get(s, 'NAME') ?? s,
      tab: ini.get(s, 'TAB') ?? '',
      showClicks: ini.get(s, 'SHOW_CLICKS') ?? null,
      values: { MIN: min, MAX: max, ...(step !== undefined ? { STEP: step } : {}) },
    });
  }
  return { items };
}

const EDITABLE = new Set(['MIN', 'MAX', 'STEP']);

/**
 * @param {import('./ini.js').IniFile} ini
 * @param {Array<{section:string,key:string,value:string}>} changes
 */
export function applySetup(ini, changes) {
  for (const { section, key, value } of changes) {
    if (!EDITABLE.has(key.toUpperCase())) throw new Error(`Clé non modifiable : ${key}`);
    if (!ini.has(section, key)) throw new Error(`Clé absente de setup.ini : [${section}] ${key}`);
    ini.set(section, key, value);
  }
  return ini;
}
