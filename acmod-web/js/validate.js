// Règles de validation, à deux niveaux :
//  - error   : bloque l'enregistrement ;
//  - warning : signalé, n'empêche pas d'enregistrer.

export const NUMBER_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;
export const DEVIATION_WARN = 0.5; // 50 % d'écart par rapport à l'original
export const FRONT_REAR_RATIO_WARN = 3;

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(6)));
}

export function parseNumber(value) {
  const s = String(value).trim();
  return NUMBER_RE.test(s) ? Number(s) : NaN;
}

/**
 * Vérifie une valeur seule.
 * @param {import('./params.js').ParamDef} def
 * @param {string} value
 * @param {string|undefined} original valeur d'origine (avant toute modification)
 * @returns {Array<{level:'error'|'warning', message:string}>}
 */
export function checkValue(def, value, original) {
  const issues = [];
  const s = String(value ?? '').trim();
  if (def.readonly) return [{ level: 'error', message: 'Paramètre en lecture seule.' }];

  if (def.kind === 'text') {
    if (!s) issues.push({ level: 'error', message: 'Ne doit pas être vide.' });
    if (/[;\r\n]|\/\//.test(s)) issues.push({ level: 'error', message: 'Les caractères « ; », « // » et les retours à la ligne sont interdits.' });
    return issues;
  }

  if (!s) return [{ level: 'error', message: 'Valeur obligatoire.' }];
  if (/^[-+]?\d*,\d+$/.test(s)) return [{ level: 'error', message: 'Utilisez un point comme séparateur décimal (ex. 0.25).' }];
  if (!NUMBER_RE.test(s)) return [{ level: 'error', message: 'Nombre attendu (chiffres, point décimal, signe).' }];
  const n = Number(s);

  if (def.hardMin !== undefined) {
    if (def.exclusiveMin ? n <= def.hardMin : n < def.hardMin) {
      issues.push({ level: 'error', message: `Doit être ${def.exclusiveMin ? 'strictement supérieur' : 'supérieur ou égal'} à ${def.hardMin}.` });
    }
  }
  if (def.hardMax !== undefined && n > def.hardMax) {
    issues.push({ level: 'error', message: `Doit être inférieur ou égal à ${def.hardMax}.` });
  }
  if (!issues.length) {
    if ((def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) {
      issues.push({ level: 'warning', message: `Hors de la plage habituelle (${def.min ?? '−∞'} à ${def.max ?? '+∞'}${def.unit ? ' ' + def.unit : ''}).` });
    }
    const o = parseNumber(original);
    if (Number.isFinite(o) && o !== 0) {
      const dev = Math.abs(n - o) / Math.abs(o);
      if (dev > DEVIATION_WARN) {
        issues.push({ level: 'warning', message: `Écart de ${Math.round(dev * 100)} % par rapport à l'original (${fmt(o)}).` });
      }
    }
  }
  return issues;
}

/**
 * Règles croisées. `get(file, section, key)` renvoie la valeur courante (ou undefined).
 * Chaque problème liste les champs concernés (`involves`), pour n'afficher que
 * ceux qui touchent une modification.
 * @param {(file:string, section:string, key:string)=>string|undefined} get
 * @param {{ compounds?: Array<{front:string|null, rear:string|null}>, setupSections?: string[] }} ctx
 */
export function crossRules(get, ctx = {}) {
  const issues = [];
  const num = (f, s, k) => parseNumber(get(f, s, k));
  const T = 'tyres.ini';
  const S = 'suspensions.ini';

  for (const c of ctx.compounds || []) {
    for (const sec of [c.front, c.rear].filter(Boolean)) {
      const r = num(T, sec, 'RADIUS');
      const rim = num(T, sec, 'RIM_RADIUS');
      if (Number.isFinite(r) && Number.isFinite(rim) && rim >= r) {
        issues.push({ level: 'error', file: T, section: sec, key: 'RIM_RADIUS', message: `Le rayon de jante (${rim}) doit être inférieur au rayon du pneu (${r}).`, involves: [[T, sec, 'RADIUS'], [T, sec, 'RIM_RADIUS']] });
      }
      const ps = num(T, sec, 'PRESSURE_STATIC');
      const pi = num(T, sec, 'PRESSURE_IDEAL');
      if (Number.isFinite(ps) && Number.isFinite(pi) && ps > pi) {
        issues.push({ level: 'warning', file: T, section: sec, key: 'PRESSURE_STATIC', message: `Pression à froid (${ps}) supérieure à la pression idéale (${pi}) : le pneu s'en éloignera en chauffant.`, involves: [[T, sec, 'PRESSURE_STATIC'], [T, sec, 'PRESSURE_IDEAL']] });
      }
    }
    if (c.front && c.rear) {
      for (const key of ['WIDTH', 'RADIUS', 'DX_REF', 'DY_REF', 'PRESSURE_IDEAL', 'RATE', 'FLEX']) {
        issues.push(...ratioRule(T, c.front, c.rear, key, num));
      }
    }
  }

  if (ctx.suspension !== false) {
    for (const sec of ['FRONT', 'REAR']) {
      for (const [fast, slow, label] of [['DAMP_FAST_BUMP', 'DAMP_BUMP', 'compression'], ['DAMP_FAST_REBOUND', 'DAMP_REBOUND', 'détente']]) {
        const f = num(S, sec, fast);
        const sl = num(S, sec, slow);
        if (Number.isFinite(f) && Number.isFinite(sl) && f > sl) {
          issues.push({ level: 'warning', file: S, section: sec, key: fast, message: `[${sec}] ${label} rapide (${f}) plus ferme que la ${label} lente (${sl}) : inhabituel.`, involves: [[S, sec, fast], [S, sec, slow]] });
        }
      }
    }
    for (const key of ['SPRING_RATE', 'DAMP_BUMP', 'DAMP_REBOUND', 'BUMP_STOP_RATE']) {
      issues.push(...ratioRule(S, 'FRONT', 'REAR', key, num));
    }
  }

  const U = 'setup.ini';
  for (const sec of ctx.setupSections || []) {
    const min = num(U, sec, 'MIN');
    const max = num(U, sec, 'MAX');
    const step = num(U, sec, 'STEP');
    const involves = [[U, sec, 'MIN'], [U, sec, 'MAX'], [U, sec, 'STEP']];
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      issues.push({ level: 'error', file: U, section: sec, key: 'MIN', message: `[${sec}] MIN (${min}) supérieur à MAX (${max}).`, involves });
    } else if ([min, max, step].every(Number.isFinite) && step > 0) {
      const clicks = (max - min) / step;
      if (Math.abs(clicks - Math.round(clicks)) > 1e-6) {
        issues.push({ level: 'warning', file: U, section: sec, key: 'STEP', message: `[${sec}] l'écart MAX − MIN (${fmt(max - min)}) n'est pas un multiple du pas (${step}).`, involves });
      }
    }
  }
  return issues;
}

function ratioRule(file, a, b, key, num) {
  const x = num(file, a, key);
  const y = num(file, b, key);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return [];
  const ratio = Math.max(x, y) / Math.min(x, y);
  if (ratio <= FRONT_REAR_RATIO_WARN) return [];
  return [{
    level: 'warning', file, section: a, key,
    message: `${key} : avant (${x}) et arrière (${y}) très différents (×${ratio.toFixed(1)}).`,
    involves: [[file, a, key], [file, b, key]],
  }];
}
