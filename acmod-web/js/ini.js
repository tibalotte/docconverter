// Parseur INI « fidèle » pour les fichiers d'Assetto Corsa.
//
// Chaque ligne est conservée telle quelle (espaces, tabulations, commentaires,
// fin de ligne CRLF/LF/CR). Relire puis réécrire un fichier sans modification
// redonne exactement le même texte. `set` ne touche qu'à la valeur : le nom de
// la clé, les espaces autour et le commentaire de fin restent intacts.
//
// Règles retenues (comme AC, qui est tolérant) :
//  - commentaires : lignes commençant par `;`, `//` ou `#`, et fin de ligne
//    après `;` ou `//` ;
//  - noms de sections et de clés insensibles à la casse ;
//  - clé dupliquée : la dernière occurrence fait foi (et c'est elle que `set`
//    modifie) ;
//  - section dupliquée : ses clés sont fusionnées.

const EOL_RE = /\r\n|\n|\r/g;

/** Position du début d'un commentaire de fin dans `raw` à partir de `from`, ou -1. */
function findComment(raw, from) {
  const semi = raw.indexOf(';', from);
  const slashes = raw.indexOf('//', from);
  if (semi === -1) return slashes;
  if (slashes === -1) return semi;
  return Math.min(semi, slashes);
}

function parseLine(raw, eol, section) {
  const line = { raw, eol, type: 'other', section, key: null, vs: 0, ve: 0 };
  const trimmed = raw.trim();
  if (!trimmed) { line.type = 'blank'; return line; }
  if (trimmed.startsWith(';') || trimmed.startsWith('//') || trimmed.startsWith('#')) {
    line.type = 'comment';
    return line;
  }
  if (trimmed.startsWith('[')) {
    const open = raw.indexOf('[');
    const close = raw.indexOf(']', open);
    if (close > open) {
      line.type = 'section';
      line.section = raw.slice(open + 1, close).trim().toUpperCase();
      return line;
    }
  }
  const eq = raw.indexOf('=');
  const comment = findComment(raw, 0);
  if (eq > 0 && (comment === -1 || comment > eq)) {
    const key = raw.slice(0, eq).trim();
    if (key) {
      line.type = 'kv';
      line.key = key.toUpperCase();
      const end = comment === -1 ? raw.length : comment;
      let vs = eq + 1;
      let ve = end;
      while (vs < ve && /\s/.test(raw[vs])) vs++;
      while (ve > vs && /\s/.test(raw[ve - 1])) ve--;
      if (vs === ve) { vs = eq + 1; ve = eq + 1; } // valeur vide : insérer juste après le =
      line.vs = vs;
      line.ve = ve;
    }
  }
  return line;
}

export class IniFile {
  constructor(lines) {
    /** @type {Array<{raw:string,eol:string,type:string,section:string|null,key:string|null,vs:number,ve:number}>} */
    this.lines = lines;
  }

  static parse(text) {
    const lines = [];
    let section = null;
    let pos = 0;
    let m;
    EOL_RE.lastIndex = 0;
    const push = (raw, eol) => {
      const line = parseLine(raw, eol, section);
      if (line.type === 'section') section = line.section;
      lines.push(line);
    };
    while ((m = EOL_RE.exec(text))) {
      push(text.slice(pos, m.index), m[0]);
      pos = m.index + m[0].length;
    }
    push(text.slice(pos), '');
    return new IniFile(lines);
  }

  toString() {
    let out = '';
    for (const l of this.lines) out += l.raw + l.eol;
    return out;
  }

  clone() {
    return new IniFile(this.lines.map((l) => ({ ...l })));
  }

  /** Fin de ligne majoritaire du fichier (CRLF par défaut, comme AC). */
  eol() {
    const counts = {};
    for (const l of this.lines) if (l.eol) counts[l.eol] = (counts[l.eol] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : '\r\n';
  }

  /** Index de la ligne qui fait foi pour (section, key), ou -1. */
  #find(section, key) {
    const S = section.toUpperCase();
    const K = key.toUpperCase();
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      if (l.type === 'kv' && l.section === S && l.key === K) return i;
    }
    return -1;
  }

  has(section, key) {
    return this.#find(section, key) !== -1;
  }

  hasSection(section) {
    const S = section.toUpperCase();
    return this.lines.some((l) => l.type === 'section' && l.section === S);
  }

  /** @returns {string|undefined} la valeur brute, sans commentaire ni espaces autour. */
  get(section, key) {
    const i = this.#find(section, key);
    if (i === -1) return undefined;
    const l = this.lines[i];
    return l.raw.slice(l.vs, l.ve);
  }

  /** Numéro de ligne (1-based) de la clé, utile pour les messages. */
  lineOf(section, key) {
    const i = this.#find(section, key);
    return i === -1 ? null : i + 1;
  }

  set(section, key, value) {
    value = String(value);
    if (/[\r\n;]|\/\//.test(value)) {
      throw new Error(`Valeur interdite pour ${section}/${key} : « ${value} »`);
    }
    const i = this.#find(section, key);
    if (i !== -1) {
      const l = this.lines[i];
      l.raw = l.raw.slice(0, l.vs) + value + l.raw.slice(l.ve);
      l.ve = l.vs + value.length;
      return;
    }
    this.#insert(section.toUpperCase(), key.toUpperCase(), value);
  }

  #insert(S, K, value) {
    const eol = this.eol();
    let after = -1;
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      if (l.section === S && (l.type === 'kv' || l.type === 'section')) after = i;
    }
    const newLine = (raw, section) => parseLine(raw, '', section);
    if (after !== -1) {
      const line = newLine(`${K}=${value}`, S);
      const prev = this.lines[after];
      if (prev.eol) line.eol = eol;
      else prev.eol = eol;
      this.lines.splice(after + 1, 0, line);
      return;
    }
    // Section absente : on l'ajoute à la fin.
    const last = this.lines[this.lines.length - 1];
    const endsWithNewline = last && last.raw === '' && last.eol === '';
    const block = [];
    const before = endsWithNewline ? this.lines[this.lines.length - 2] : last;
    if (before && before.type !== 'blank') block.push(newLine('', null));
    block.push(newLine(`[${S}]`, null));
    block[block.length - 1].section = S;
    block.push(newLine(`${K}=${value}`, S));
    if (endsWithNewline) {
      for (const l of block) l.eol = eol;
      this.lines.splice(this.lines.length - 1, 0, ...block);
    } else {
      if (last) last.eol = eol;
      block.forEach((l, idx) => { l.eol = idx < block.length - 1 ? eol : ''; });
      this.lines.push(...block);
    }
  }

  /** Noms de sections (en majuscules), dans l'ordre d'apparition, sans doublon. */
  sections() {
    const seen = new Set();
    for (const l of this.lines) if (l.type === 'section') seen.add(l.section);
    return [...seen];
  }

  /** Clés d'une section (en majuscules), dans l'ordre, sans doublon. */
  keys(section) {
    const S = section.toUpperCase();
    const seen = new Set();
    for (const l of this.lines) if (l.type === 'kv' && l.section === S) seen.add(l.key);
    return [...seen];
  }

  /** Objet { CLÉ: valeur } d'une section (la dernière occurrence fait foi). */
  entries(section) {
    const out = {};
    for (const k of this.keys(section)) out[k] = this.get(section, k);
    return out;
  }
}

export function parseIni(text) {
  return IniFile.parse(text);
}
