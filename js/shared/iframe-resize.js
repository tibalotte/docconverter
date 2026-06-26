/**
 * iframe-resize.js — Redimensionnement de l'iframe dans Moodle.
 *
 * Mesure la hauteur réelle du contenu et la transmet au parent via plusieurs
 * aliases de message (conventions Moodle/H5P selon les versions) ; recalcule à
 * chaque changement via ResizeObserver. Aucune hauteur fixe (cf. docs/pont-scorm.md §3).
 */

export function installResize() {
  if (typeof window === 'undefined') return;

  function currentHeight() {
    return Math.ceil(document.documentElement.getBoundingClientRect().height);
  }

  function notify() {
    const h = currentHeight();
    const messages = [
      { subject: 'lmsibheight', height: h },          // SCORM iframe historique
      { context: 'h5p', action: 'resize', scrollHeight: h }, // convention H5P
      { type: 'dc-resize', height: h },               // alias propre
    ];
    messages.forEach((m) => { try { parent.postMessage(m, '*'); } catch { /* sandbox */ } });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(notify).observe(document.documentElement);
  }
  window.addEventListener('load', notify);
  window.addEventListener('resize', notify);
  // Premier envoi immédiat (contenu déjà présent).
  notify();
}
