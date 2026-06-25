/**
 * utils.js — Utilitaires partagés.
 */

/** Échappe le texte pour insertion HTML sûre (contenu issu du PPTX). */
export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Rend la main au navigateur (UI responsive + opportunité de GC). */
export function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Taille lisible en octets. */
export function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  const units = ['Ko', 'Mo', 'Go'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(1) + ' ' + units[i];
}
