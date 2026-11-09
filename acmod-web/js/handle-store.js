// Mémorise le dernier dossier choisi (FileSystemDirectoryHandle) dans IndexedDB
// pour le rouvrir plus vite à la visite suivante.
const DB = 'acmod-web';
const STORE = 'handles';
const KEY = 'last-data-dir';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function saveHandle(handle) {
  try { await tx('readwrite', (s) => s.put(handle, KEY)); } catch { /* navigation privée, etc. */ }
}

export async function loadHandle() {
  try { return (await tx('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

export async function forgetHandle() {
  try { await tx('readwrite', (s) => s.delete(KEY)); } catch { /* rien */ }
}

/** Vérifie (et redemande si besoin) l'autorisation lecture + écriture. */
export async function ensurePermission(handle, { request = true } = {}) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  if (!request) return false;
  return (await handle.requestPermission?.(opts)) === 'granted';
}
