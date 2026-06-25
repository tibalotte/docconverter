/**
 * media-store.js — Gestion mémoire des blobs médias.
 *
 * Point névralgique pour la contrainte 4–8 Go (cf. docs/ARCHITECTURE.md §4.3).
 * Les blobs volumineux vivent dans IndexedDB et ne sont jamais tous chargés en
 * RAM simultanément. Les ObjectURL sont créés à la demande et révoqués
 * explicitement.
 */

const DB_NAME = 'docconverter';
const STORE = 'media';
const DB_VERSION = 1;

class MediaStore {
  constructor() {
    this._dbPromise = null;
    /** ObjectURL actifs, par id média, pour révocation. @type {Map<string,string>} */
    this._urls = new Map();
  }

  _openDb() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  }

  async _tx(mode) {
    const db = await this._openDb();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  /**
   * Enregistre un blob. Le binaire n'entre jamais dans le JSON projet : on n'y
   * stocke que l'id renvoyé ici.
   * @param {string} id
   * @param {Blob} blob
   */
  async put(id, blob) {
    const store = await this._tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ id, blob });
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  }

  /** @returns {Promise<Blob|null>} */
  async getBlob(id) {
    const store = await this._tx('readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Renvoie (et mémorise) un ObjectURL pour affichage. À révoquer via
   * releaseUrl() ou releaseAll() quand le consommateur est démonté.
   * @returns {Promise<string|null>}
   */
  async getUrl(id) {
    if (this._urls.has(id)) return this._urls.get(id);
    const blob = await this.getBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this._urls.set(id, url);
    return url;
  }

  /** Révoque l'ObjectURL d'un média précis. */
  releaseUrl(id) {
    const url = this._urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this._urls.delete(id);
    }
  }

  /** Révoque tous les ObjectURL actifs (ex. au démontage d'une vue). */
  releaseAll() {
    for (const url of this._urls.values()) URL.revokeObjectURL(url);
    this._urls.clear();
  }

  async delete(id) {
    this.releaseUrl(id);
    const store = await this._tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Vide entièrement le magasin (nouveau projet). */
  async clear() {
    this.releaseAll();
    const store = await this._tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Itère tous les médias (id + blob) — utilisé à l'export/persistance. */
  async entries() {
    const store = await this._tx('readonly');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out.push({ id: cursor.value.id, blob: cursor.value.blob });
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const mediaStore = new MediaStore();
