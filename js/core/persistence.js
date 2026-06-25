/**
 * persistence.js — Sauvegarde/chargement du projet.
 *
 * Décision tranchée (docs/ARCHITECTURE.md §10) : format `.dcproj` = un .zip
 * contenant `project.json` + un dossier `media/` avec les blobs. Cela rapatrie
 * les médias avec le projet. Préférences légères en localStorage.
 */

import { store } from './state-store.js';
import { mediaStore } from './media-store.js';

/* global JSZip */

const PREFS_KEY = 'docconverter:prefs';

/**
 * Construit le `.dcproj` (Blob zip) à partir de l'état + des médias IndexedDB.
 * @returns {Promise<Blob>}
 */
export async function buildProjectArchive() {
  const zip = new JSZip();
  const project = store.getProject();
  zip.file('project.json', JSON.stringify(project, null, 2));

  const mediaFolder = zip.folder('media');
  const entries = await mediaStore.entries();
  for (const { id, blob } of entries) {
    // On nomme par id pour un remappage déterministe au chargement.
    mediaFolder.file(id, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Déclenche le téléchargement d'un Blob sous un nom donné. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisse le temps au navigateur de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sauvegarde le projet courant en `.dcproj` téléchargeable. */
export async function saveProject(fileName) {
  const blob = await buildProjectArchive();
  const project = store.getProject();
  const name = fileName || `${(project.title || 'projet').replace(/[^\w\-]+/g, '_')}.dcproj`;
  downloadBlob(blob, name);
}

/**
 * Charge un `.dcproj` (File/Blob) : restaure project.json + réinjecte les
 * médias dans IndexedDB.
 */
export async function loadProjectArchive(file) {
  const zip = await JSZip.loadAsync(file);
  const projFile = zip.file('project.json');
  if (!projFile) throw new Error('Archive invalide : project.json introuvable');
  const project = JSON.parse(await projFile.async('string'));

  await mediaStore.clear();
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const tasks = [];
    mediaFolder.forEach((relPath, entry) => {
      if (entry.dir) return;
      tasks.push(
        entry.async('blob').then((blob) => mediaStore.put(relPath, blob))
      );
    });
    await Promise.all(tasks);
  }
  return store.replaceProject(project);
}

/* ----- Préférences UI (localStorage) ----- */

export function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
