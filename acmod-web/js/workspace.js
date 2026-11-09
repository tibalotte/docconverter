// Espace de travail : fichiers chargés, modifications en cours, validation,
// enregistrement avec sauvegarde, restauration. Aucune dépendance au DOM.
import { decodeText, encodeText } from './encoding.js';
import { IniFile } from './ini.js';
import { loadTyres, applyTyres } from './tyres.js';
import { loadSuspension, applySuspension } from './suspension.js';
import { loadSetup, applySetup } from './setup.js';
import { BackupSession, createBackup, listBackups, readBackupFile, restore } from './backup.js';
import { checkValue, crossRules } from './validate.js';
import { lineDiff } from './diff.js';
import { TYRE_PARAMS, THERMAL_PARAMS, SUSPENSION_PARAMS, ARB_PARAMS, SETUP_RANGE_PARAMS, paramIndex } from './params.js';

export const TYRES = 'tyres.ini';
export const SUSP = 'suspensions.ini';
export const SETUP = 'setup.ini';
export const FILES = [TYRES, SUSP, SETUP];

const APPLY = { [TYRES]: applyTyres, [SUSP]: applySuspension, [SETUP]: applySetup };
const TYRE_DEFS = paramIndex(TYRE_PARAMS);
const THERMAL_DEFS = paramIndex(THERMAL_PARAMS);
const SUSP_DEFS = paramIndex(SUSPENSION_PARAMS);
const ARB_DEFS = paramIndex(ARB_PARAMS);
const SETUP_DEFS = paramIndex(SETUP_RANGE_PARAMS);

/** Définition du paramètre pour (fichier, section, clé). */
export function defFor(file, section, key) {
  const S = section.toUpperCase();
  const K = key.toUpperCase();
  if (file === TYRES) return (S.startsWith('THERMAL_') ? THERMAL_DEFS : TYRE_DEFS)[K] || null;
  if (file === SUSP) return S === 'ARB' ? ARB_DEFS[K] || null : (S === 'FRONT' || S === 'REAR') ? SUSP_DEFS[K] || null : null;
  if (file === SETUP) return SETUP_DEFS[K] || null;
  return null;
}

const editKey = (file, section, key) => `${file}\n${section.toUpperCase()}\n${key.toUpperCase()}`;

export class ValidationError extends Error {
  constructor(issues) {
    super(`${issues.length} erreur(s) bloquent l'enregistrement.`);
    this.issues = issues;
  }
}

export class Workspace {
  /** @param {any} dir objet Dir (voir fs-access.js) */
  constructor(dir, { now = () => new Date() } = {}) {
    this.dir = dir;
    this.now = now;
    /** @type {Record<string, {encoding:string,bom:boolean,text:string,ini:IniFile}>} état enregistré */
    this.files = {};
    /** @type {Record<string, IniFile>} état d'origine (avant toute écriture par l'outil) */
    this.baseline = {};
    /** @type {Map<string, {file:string,section:string,key:string,value:string}>} */
    this.edits = new Map();
    this.session = new BackupSession(dir, { now });
  }

  async load() {
    this.files = {};
    for (const name of FILES) {
      const bytes = await this.dir.readFile(name);
      if (!bytes) continue;
      const { text, encoding, bom } = decodeText(bytes);
      this.files[name] = { encoding, bom, text, ini: IniFile.parse(text) };
    }
    // L'original = la plus ancienne sauvegarde qui contient le fichier, sinon le fichier tel que lu.
    this.baseline = {};
    const backups = await listBackups(this.dir);
    for (const name of Object.keys(this.files)) {
      const first = backups.find((b) => b.files.includes(name));
      const bytes = first && (await readBackupFile(this.dir, first.id, name));
      this.baseline[name] = bytes ? IniFile.parse(decodeText(bytes).text) : this.files[name].ini.clone();
    }
    this.edits.clear();
    return this;
  }

  has(file) {
    return Boolean(this.files[file]);
  }

  models() {
    const f = this.files;
    return {
      tyres: f[TYRES] ? loadTyres(f[TYRES].ini) : null,
      suspension: f[SUSP] ? loadSuspension(f[SUSP].ini) : null,
      setup: f[SETUP] ? loadSetup(f[SETUP].ini) : null,
    };
  }

  savedValue(file, section, key) {
    return this.files[file]?.ini.get(section, key);
  }

  originalValue(file, section, key) {
    return this.baseline[file]?.get(section, key);
  }

  value(file, section, key) {
    const e = this.edits.get(editKey(file, section, key));
    return e ? e.value : this.savedValue(file, section, key);
  }

  isEdited(file, section, key) {
    return this.edits.has(editKey(file, section, key));
  }

  /** Différent de l'original (même si déjà enregistré). */
  isModifiedFromOriginal(file, section, key) {
    const o = this.originalValue(file, section, key);
    return o !== undefined && String(this.value(file, section, key)).trim() !== o;
  }

  setValue(file, section, key, value) {
    value = String(value);
    const k = editKey(file, section, key);
    if (value === this.savedValue(file, section, key)) this.edits.delete(k);
    else this.edits.set(k, { file, section: section.toUpperCase(), key: key.toUpperCase(), value });
  }

  editsFor(file) {
    return [...this.edits.values()].filter((e) => e.file === file);
  }

  /** Fichier avec les modifications en cours appliquées (copie). */
  editedIni(file) {
    const ini = this.files[file].ini.clone();
    const changes = this.editsFor(file).map((e) => ({ ...e, value: e.value.trim() }));
    if (changes.length) APPLY[file](ini, changes);
    return ini;
  }

  changedFiles() {
    return Object.keys(this.files).filter((f) => this.editsFor(f).length > 0);
  }

  hasUnsavedChanges() {
    return this.edits.size > 0;
  }

  /** @returns {Array<{level:string,file:string,section:string,key:string,message:string}>} */
  validate() {
    const issues = [];
    for (const e of this.edits.values()) {
      const def = defFor(e.file, e.section, e.key);
      if (!def) {
        issues.push({ level: 'error', file: e.file, section: e.section, key: e.key, message: 'Paramètre inconnu ou non modifiable.' });
        continue;
      }
      for (const i of checkValue(def, e.value, this.originalValue(e.file, e.section, e.key))) {
        issues.push({ ...i, file: e.file, section: e.section, key: e.key });
      }
    }
    const m = this.models();
    const cross = crossRules((f, s, k) => (this.has(f) ? this.value(f, s, k) : undefined), {
      compounds: m.tyres?.compounds || [],
      suspension: Boolean(m.suspension),
      setupSections: m.setup?.items.map((i) => i.section) || [],
    });
    for (const i of cross) {
      if (i.involves.some(([f, s, k]) => this.isEdited(f, s, k))) issues.push(i);
    }
    return issues;
  }

  diff(file) {
    return lineDiff(this.files[file].text, this.editedIni(file).toString());
  }

  /** Différences entre l'original et l'état enregistré + modifications en cours. */
  diffFromOriginal(file) {
    return lineDiff(this.baseline[file].toString(), this.editedIni(file).toString());
  }

  revert() {
    this.edits.clear();
  }

  /**
   * Enregistre : validation → sauvegarde → écriture → relecture de contrôle.
   * @returns {Promise<{backupId:string|null, written:string[], warnings:any[]}>}
   */
  async save() {
    const issues = this.validate();
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length) throw new ValidationError(errors);
    const names = this.changedFiles();
    if (!names.length) return { backupId: null, written: [], warnings: issues };

    const outputs = {};
    for (const name of names) {
      const f = this.files[name];
      const text = this.editedIni(name).toString();
      outputs[name] = { text, bytes: encodeText(text, f.encoding, f.bom) };
    }
    const backupId = await this.session.ensure(names);
    for (const name of names) {
      await this.dir.writeFile(name, outputs[name].bytes);
      const check = await this.dir.readFile(name);
      if (!check || decodeText(check).text !== outputs[name].text) {
        throw new Error(`Relecture de ${name} incohérente après écriture. Restaurez la sauvegarde ${backupId}.`);
      }
      this.files[name].text = outputs[name].text;
      this.files[name].ini = IniFile.parse(outputs[name].text);
    }
    for (const name of names) for (const e of this.editsFor(name)) this.edits.delete(editKey(e.file, e.section, e.key));
    return { backupId, written: names, warnings: issues };
  }

  async backups() {
    return listBackups(this.dir);
  }

  /** Restaure une sauvegarde puis recharge. */
  async restoreBackup(id) {
    const res = await restore(this.dir, id, { now: this.now() });
    this.session = new BackupSession(this.dir, { now: this.now });
    await this.load();
    return res;
  }

  /** Remet chaque fichier dans l'état de sa plus ancienne sauvegarde. */
  async restoreOriginal() {
    const backups = await listBackups(this.dir);
    const restored = [];
    let safetyBackup = null;
    const groups = new Map();
    for (const name of Object.keys(this.files)) {
      const first = backups.find((b) => b.files.includes(name));
      if (first) groups.set(first.id, [...(groups.get(first.id) || []), name]);
    }
    if (!groups.size) return { restored, safetyBackup };
    const toSave = [...groups.values()].flat();
    safetyBackup = await createBackup(this.dir, toSave, { now: this.now(), reason: 'avant restauration de l\'original' });
    for (const [id, names] of groups) {
      const r = await restore(this.dir, id, { names, backupCurrent: false });
      restored.push(...r.restored);
    }
    this.session = new BackupSession(this.dir, { now: this.now });
    await this.load();
    return { restored, safetyBackup };
  }
}
