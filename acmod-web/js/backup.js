// Sauvegardes : avant toute écriture, les fichiers concernés sont copiés dans
// `.acmod_backup/<horodatage>/` à l'intérieur du dossier choisi, avec un
// manifest.json. Règle : jamais d'écriture sans sauvegarde préalable vérifiée.

export const BACKUP_DIR = '.acmod_backup';
const MANIFEST = 'manifest.json';

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

export function makeBackupId(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_`
    + `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function readManifest(dir) {
  const bytes = await dir.readFile(MANIFEST);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function writeManifest(dir, manifest) {
  await dir.writeFile(MANIFEST, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
}

/** Copie un fichier dans la sauvegarde et vérifie la copie en la relisant. */
async function copyVerified(src, dst, name) {
  const bytes = await src.readFile(name);
  if (!bytes) return false;
  await dst.writeFile(name, bytes);
  const check = await dst.readFile(name);
  if (!sameBytes(bytes, check)) throw new Error(`La copie de sauvegarde de ${name} ne correspond pas à l'original.`);
  return true;
}

/**
 * Crée une sauvegarde des fichiers `names` (ceux qui existent).
 * @returns {Promise<string>} identifiant de la sauvegarde
 */
export async function createBackup(dir, names, { now = new Date(), reason = 'avant écriture' } = {}) {
  const root = await dir.getDir(BACKUP_DIR, { create: true });
  let id = makeBackupId(now);
  let n = 1;
  while (await root.getDir(id)) id = `${makeBackupId(now)}_${n++}`;
  const target = await root.getDir(id, { create: true });
  const files = [];
  for (const name of names) if (await copyVerified(dir, target, name)) files.push(name);
  await writeManifest(target, { id, created: now.toISOString(), reason, files });
  return id;
}

/** Ajoute à une sauvegarde existante les fichiers qui n'y sont pas encore. */
export async function addToBackup(dir, id, names) {
  const root = await dir.getDir(BACKUP_DIR);
  const target = root && (await root.getDir(id));
  if (!target) throw new Error(`Sauvegarde introuvable : ${id}`);
  const manifest = (await readManifest(target)) || { id, created: new Date().toISOString(), files: [] };
  for (const name of names) {
    if (manifest.files.includes(name)) continue;
    if (await copyVerified(dir, target, name)) manifest.files.push(name);
  }
  await writeManifest(target, manifest);
  return manifest;
}

/** @returns {Promise<Array<{id:string, created:string, reason?:string, files:string[]}>>} du plus ancien au plus récent */
export async function listBackups(dir) {
  const root = await dir.getDir(BACKUP_DIR);
  if (!root) return [];
  const out = [];
  for (const e of await root.list()) {
    if (e.kind !== 'directory') continue;
    const sub = await root.getDir(e.name);
    const manifest = await readManifest(sub);
    if (manifest) out.push({ ...manifest, id: e.name });
  }
  return out.sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.id.localeCompare(b.id)));
}

/** Lit un fichier d'une sauvegarde. */
export async function readBackupFile(dir, id, name) {
  const root = await dir.getDir(BACKUP_DIR);
  const target = root && (await root.getDir(id));
  return target ? target.readFile(name) : null;
}

/**
 * Restaure les fichiers d'une sauvegarde. Par défaut, l'état actuel est
 * lui-même sauvegardé avant (on peut donc annuler une restauration).
 * @returns {Promise<{restored:string[], safetyBackup:string|null}>}
 */
export async function restore(dir, backupId, { names = null, backupCurrent = true, now = new Date() } = {}) {
  const root = await dir.getDir(BACKUP_DIR);
  const source = root && (await root.getDir(backupId));
  if (!source) throw new Error(`Sauvegarde introuvable : ${backupId}`);
  const manifest = await readManifest(source);
  const files = (manifest?.files || []).filter((f) => !names || names.includes(f));
  let safetyBackup = null;
  if (backupCurrent && files.length) {
    safetyBackup = await createBackup(dir, files, { now, reason: `avant restauration de ${backupId}` });
  }
  for (const name of files) {
    const bytes = await source.readFile(name);
    if (!bytes) throw new Error(`Fichier ${name} manquant dans la sauvegarde ${backupId}`);
    await dir.writeFile(name, bytes);
  }
  return { restored: files, safetyBackup };
}

/**
 * Une session d'édition = une sauvegarde. Le premier enregistrement crée la
 * sauvegarde ; les suivants y ajoutent les fichiers pas encore sauvegardés
 * (l'original reste ainsi celui d'avant la toute première écriture).
 */
export class BackupSession {
  constructor(dir, { now = () => new Date() } = {}) {
    this.dir = dir;
    this.now = now;
    this.id = null;
  }

  async ensure(names) {
    if (!this.id) {
      this.id = await createBackup(this.dir, names, { now: this.now() });
    } else {
      await addToBackup(this.dir, this.id, names);
    }
    return this.id;
  }
}
