// Accès au dossier `data` d'une voiture.
//
// Deux implémentations derrière la même interface « Dir » :
//  - HandleDir : API File System Access (Chrome, Edge, Opera) → lecture et
//    écriture en place, après autorisation de l'utilisateur ;
//  - MemoryDir : dossier en mémoire (mode de repli Firefox/Safari, et tests).
//    Les écritures restent en mémoire ; on les exporte ensuite en téléchargement.
//
// Interface Dir :
//   name                       nom du dossier
//   list()                     → [{ name, kind: 'file'|'directory' }]
//   readFile(name)             → Uint8Array | null
//   writeFile(name, bytes)
//   getDir(name, { create })   → Dir | null

export const REQUIRED_FILES = ['tyres.ini', 'suspensions.ini'];
export const OPTIONAL_FILES = ['setup.ini'];

export class MemoryDir {
  constructor(name = 'data') {
    this.name = name;
    /** @type {Map<string, Uint8Array>} */
    this.files = new Map();
    /** @type {Map<string, MemoryDir>} */
    this.dirs = new Map();
    /** Noms des fichiers écrits depuis l'ouverture (pour l'export). */
    this.written = new Set();
  }

  async list() {
    return [
      ...[...this.dirs.keys()].map((name) => ({ name, kind: 'directory' })),
      ...[...this.files.keys()].map((name) => ({ name, kind: 'file' })),
    ];
  }

  async readFile(name) {
    const b = this.files.get(name);
    return b ? b.slice() : null;
  }

  async writeFile(name, bytes) {
    this.files.set(name, Uint8Array.from(bytes));
    this.written.add(name);
  }

  async getDir(name, { create = false } = {}) {
    if (!this.dirs.has(name)) {
      if (!create) return null;
      this.dirs.set(name, new MemoryDir(name));
    }
    return this.dirs.get(name);
  }

  /** Crée l'arborescence à partir de { 'a/b.ini': bytes }. */
  static fromEntries(entries, name = 'data') {
    const root = new MemoryDir(name);
    for (const [path, bytes] of Object.entries(entries)) {
      const parts = path.split('/').filter(Boolean);
      let dir = root;
      for (const p of parts.slice(0, -1)) {
        if (!dir.dirs.has(p)) dir.dirs.set(p, new MemoryDir(p));
        dir = dir.dirs.get(p);
      }
      dir.files.set(parts[parts.length - 1], Uint8Array.from(bytes));
    }
    return root;
  }
}

export class HandleDir {
  /** @param {FileSystemDirectoryHandle} handle */
  constructor(handle) {
    this.handle = handle;
    this.name = handle.name;
  }

  async list() {
    const out = [];
    for await (const [name, h] of this.handle.entries()) out.push({ name, kind: h.kind });
    return out;
  }

  async readFile(name) {
    try {
      const fh = await this.handle.getFileHandle(name);
      const file = await fh.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (e) {
      if (e && e.name === 'NotFoundError') return null;
      throw e;
    }
  }

  async writeFile(name, bytes) {
    const fh = await this.handle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    try {
      await w.write(bytes);
      await w.close();
    } catch (e) {
      await w.abort?.();
      throw e;
    }
  }

  async getDir(name, { create = false } = {}) {
    try {
      return new HandleDir(await this.handle.getDirectoryHandle(name, { create }));
    } catch (e) {
      if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null;
      throw e;
    }
  }
}

export function supportsDirectoryPicker() {
  return typeof globalThis.showDirectoryPicker === 'function';
}

export function isSecureContextOk() {
  return globalThis.isSecureContext !== false;
}

/** Ouvre le sélecteur de dossier (lecture + écriture). */
export async function pickDirectory() {
  const handle = await globalThis.showDirectoryPicker({ id: 'acmod-data', mode: 'readwrite' });
  return { dir: new HandleDir(handle), handle };
}

/**
 * Vérifie qu'on a bien un dossier `data` dépaqueté.
 * Si l'utilisateur a choisi le dossier de la voiture et qu'il contient un
 * sous-dossier `data`, on descend automatiquement dedans.
 * @returns {Promise<{ok:boolean, dir:any, present:string[], missing:string[], warnings:string[], message:string|null}>}
 */
export async function checkDataDir(dir) {
  let entries = await dir.list();
  const names = () => new Set(entries.filter((e) => e.kind === 'file').map((e) => e.name.toLowerCase()));
  let files = names();
  const warnings = [];

  if (!REQUIRED_FILES.some((f) => files.has(f))) {
    const sub = entries.find((e) => e.kind === 'directory' && e.name.toLowerCase() === 'data');
    if (sub) {
      dir = await dir.getDir(sub.name);
      entries = await dir.list();
      files = names();
      warnings.push(`Dossier de la voiture choisi : ouverture de son sous-dossier « ${sub.name} ».`);
    }
  }

  const missing = REQUIRED_FILES.filter((f) => !files.has(f));
  const present = [...REQUIRED_FILES, ...OPTIONAL_FILES].filter((f) => files.has(f));
  if (missing.length) {
    let message;
    if (files.has('data.acd')) {
      message = 'Ce dossier contient un fichier data.acd (données chiffrées) au lieu d\'un dossier data/. '
        + 'Dépaquetez-le d\'abord (Content Manager : clic droit sur la voiture → « Unpack data »), '
        + 'puis choisissez le dossier data/ obtenu.';
    } else {
      message = `Ce dossier ne ressemble pas au dossier data d'une voiture : fichier(s) manquant(s) : ${missing.join(', ')}.`;
    }
    return { ok: false, dir, present, missing, warnings, message };
  }
  for (const f of OPTIONAL_FILES) {
    if (!files.has(f)) warnings.push(`${f} absent : l'onglet « Réglages joueur » sera vide.`);
  }
  if (files.has('data.acd')) {
    warnings.push('Un data.acd est aussi présent à côté : le jeu lit le dossier data/ en priorité seulement si data.acd est absent. Pensez à le renommer.');
  }
  return { ok: true, dir, present, missing, warnings, message: null };
}

/**
 * Mode de repli : construit un MemoryDir à partir de fichiers importés
 * (<input type="file" multiple> ou webkitdirectory).
 * @param {Array<{name:string, path?:string, bytes:Uint8Array}>} files
 */
export function memoryDirFromFiles(files) {
  // Si des chemins sont fournis, on prend le dossier qui contient tyres.ini.
  const withPath = files.map((f) => ({ ...f, path: (f.path || f.name).replace(/\\/g, '/') }));
  const anchor = withPath.find((f) => f.path.toLowerCase().endsWith('tyres.ini'));
  const base = anchor ? anchor.path.slice(0, anchor.path.length - 'tyres.ini'.length) : '';
  const entries = {};
  for (const f of withPath) {
    if (!f.path.startsWith(base)) continue;
    entries[f.path.slice(base.length)] = f.bytes;
  }
  const name = base.split('/').filter(Boolean).pop() || 'data';
  return MemoryDir.fromEntries(entries, name);
}
