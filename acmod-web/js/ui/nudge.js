// Ajustement d'une valeur au clavier (flèches), sans erreur d'arrondi et en
// gardant le nombre de décimales déjà utilisé.

function decimals(s) {
  const m = /\.(\d+)$/.exec(String(s).trim());
  return m ? m[1].length : 0;
}

/**
 * @param {string} value valeur actuelle (texte)
 * @param {number} step pas
 * @param {number} dir +1 ou -1 (ou multiple)
 * @returns {string|null} nouvelle valeur, ou null si `value` n'est pas un nombre
 */
export function nudge(value, step, dir) {
  const s = String(value).trim();
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const d = Math.max(decimals(s), decimals(step));
  const scale = 10 ** d;
  const n = Math.round(Number(s) * scale) + Math.round(step * scale) * dir;
  const out = (n / scale).toFixed(d);
  return out === '-0' || /^-0\.0*$/.test(out) ? out.slice(1) : out;
}

/** Pas par défaut déduit de la valeur : une unité de la dernière décimale. */
export function defaultStep(value) {
  const d = decimals(value);
  return d ? Number(`1e-${d}`) : 1;
}
