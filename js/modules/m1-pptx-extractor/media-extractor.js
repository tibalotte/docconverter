/**
 * media-extractor.js — Extraction et enregistrement des médias.
 *
 * Les blobs (images/audio/vidéo du PPTX + PNG rastérisés) sont rangés dans le
 * media-store (IndexedDB). Le JSON projet ne contient que des descripteurs
 * (id + métadonnées), jamais le binaire. Produit aussi un .zip téléchargeable
 * de tous les médias.
 */

import { mediaStore } from '../../core/media-store.js';

/* global JSZip */

const EXT_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tiff: 'image/tiff',
  emf: 'image/emf', wmf: 'image/wmf',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', wma: 'audio/x-ms-wma',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
};

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function typeFromMime(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'image';
}

/**
 * Collecteur de médias pour une session d'extraction. Attribue des id stables,
 * enregistre les blobs et accumule les descripteurs à écrire dans project.media.
 */
export class MediaCollector {
  constructor() {
    this._counter = 0;
    /** descripteurs (cf. docs/schema-json-enrichi.md §5) */
    this.descriptors = [];
  }

  _nextId() {
    return `media-${++this._counter}`;
  }

  /**
   * Enregistre un blob extrait du PPTX (image/audio/vidéo).
   * @returns {Promise<string|null>} l'id média, ou null si pas de blob.
   */
  async addExtracted(blob, originalName) {
    if (!blob) return null;
    const ext = extOf(originalName);
    const mime = EXT_MIME[ext] || blob.type || 'application/octet-stream';
    const id = this._nextId();
    const fileName = `${id}.${ext || 'bin'}`;
    await mediaStore.put(id, blob);
    this.descriptors.push({
      id, type: typeFromMime(mime), mime, fileName,
      storage: 'indexeddb', fromShape: false, originalName: originalName || '',
    });
    return id;
  }

  /** Enregistre un PNG issu d'une rastérisation de forme/groupe. */
  async addRasterized(blob, label) {
    if (!blob) return null;
    const id = this._nextId();
    const fileName = `${id}.png`;
    await mediaStore.put(id, blob);
    this.descriptors.push({
      id, type: 'image', mime: 'image/png', fileName,
      storage: 'indexeddb', fromShape: true, originalName: label || '',
    });
    return id;
  }
}

/**
 * Construit un .zip téléchargeable de tous les médias du media-store.
 * @returns {Promise<Blob>}
 */
export async function buildMediaZip(descriptors) {
  const zip = new JSZip();
  const byId = new Map(descriptors.map((d) => [d.id, d]));
  const entries = await mediaStore.entries();
  for (const { id, blob } of entries) {
    const d = byId.get(id);
    const name = d ? d.fileName : id;
    zip.file(name, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
