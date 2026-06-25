/**
 * state-store.js — Source de vérité unique : le projet (JSON enrichi).
 *
 * Les modules ne se parlent jamais directement : ils lisent/écrivent l'état et
 * émettent des événements (cf. docs/ARCHITECTURE.md §4.1). Mutations ciblées
 * par chemin, abonnement, et snapshots pour undo/redo.
 */

import { bus } from './event-bus.js';
import { createEmptyProject, validateProject, migrateProject } from './project-schema.js';

/** Lit une valeur via un chemin "a.b.c" ou "slides.0.title". */
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Écrit une valeur via un chemin, en créant les niveaux intermédiaires. */
function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

class StateStore {
  constructor() {
    this._project = createEmptyProject();
    /** @type {Map<string, Set<Function>>} abonnements par chemin (préfixe). */
    this._subs = new Map();
    /** Pile d'annulation. @type {string[]} */
    this._undo = [];
    this._redo = [];
    this._maxHistory = 30;
  }

  /** Renvoie l'état courant (à traiter en lecture seule). */
  getProject() {
    return this._project;
  }

  /** Mutation ciblée : écrit à `path` puis notifie. */
  update(path, value, { silent = false } = {}) {
    this._pushUndo();
    setByPath(this._project, path, value);
    if (!silent) this._notify(path);
  }

  /** Variante : applique une fonction de mutation sur le projet entier. */
  mutate(fn, changedPath = '') {
    this._pushUndo();
    fn(this._project);
    this._notify(changedPath);
  }

  /** Remplace tout le projet (import/ouverture), avec migration + validation. */
  replaceProject(json) {
    const migrated = migrateProject(json);
    const { ok, errors } = validateProject(migrated);
    if (!ok) console.warn('[state-store] projet importé avec avertissements :', errors);
    this._undo = [];
    this._redo = [];
    this._project = migrated;
    this._notify('');
    return { ok, errors };
  }

  /** Réinitialise sur un projet vierge. */
  reset() {
    this._undo = [];
    this._redo = [];
    this._project = createEmptyProject();
    this._notify('');
  }

  /**
   * Abonne un callback aux changements sous un chemin (préfixe). Un chemin vide
   * écoute tout. @returns {Function} désabonnement.
   */
  subscribe(pathPrefix, callback) {
    if (!this._subs.has(pathPrefix)) this._subs.set(pathPrefix, new Set());
    this._subs.get(pathPrefix).add(callback);
    return () => this._subs.get(pathPrefix)?.delete(callback);
  }

  _notify(changedPath) {
    for (const [prefix, set] of this._subs) {
      if (prefix === '' || changedPath === '' || changedPath.startsWith(prefix)) {
        for (const cb of [...set]) {
          try {
            cb(this._project, changedPath);
          } catch (err) {
            console.error('[state-store] abonné a levé :', err);
          }
        }
      }
    }
    bus.emit('project:changed', { path: changedPath });
  }

  _pushUndo() {
    this._undo.push(JSON.stringify(this._project));
    if (this._undo.length > this._maxHistory) this._undo.shift();
    this._redo = [];
  }

  undo() {
    if (!this._undo.length) return false;
    this._redo.push(JSON.stringify(this._project));
    this._project = JSON.parse(this._undo.pop());
    this._notify('');
    return true;
  }

  redo() {
    if (!this._redo.length) return false;
    this._undo.push(JSON.stringify(this._project));
    this._project = JSON.parse(this._redo.pop());
    this._notify('');
    return true;
  }
}

export const store = new StateStore();
export { getByPath };
