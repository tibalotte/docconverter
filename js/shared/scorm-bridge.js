/**
 * scorm-bridge.js — Pont d'abstraction SCORM (cf. docs/pont-scorm.md).
 *
 * Le contenu n'appelle JAMAIS l'API SCORM directement : il appelle
 * window.activityComplete(score) / window.activityProgress(stepId). Ce pont
 * traduit ces appels selon la cible :
 *   - scorm12      → API.LMSSetValue(cmi.core.*) + LMSCommit / LMSFinish
 *   - html-simple  → no-op (journalisable)
 * Une API peut être injectée (simulateur Moodle) pour rejouer le comportement.
 */

/** Recherche l'objet API SCORM 1.2 en remontant parent/opener. */
export function findAPI(win) {
  let w = win;
  let depth = 0;
  while (w && depth < 12) {
    if (w.API) return w.API;
    if (w.parent && w.parent !== w) { w = w.parent; depth++; continue; }
    break;
  }
  if (win.opener) {
    try { return findAPI(win.opener); } catch { /* cross-origin */ }
  }
  return null;
}

/**
 * Installe le pont sur window.
 * @param {{ target?:'scorm12'|'html-simple', api?:object|null, masteryScore?:number|null,
 *           onEvent?:(label:string, detail:any)=>void }} cfg
 * @returns {{ target:string, hasApi:boolean }}
 */
export function installScormBridge(cfg = {}) {
  const { target = 'scorm12', api = null, masteryScore = null, onEvent } = cfg;
  const log = (label, detail) => { if (onEvent) onEvent(label, detail); };

  if (target !== 'scorm12') {
    window.activityProgress = (stepId) => log('activityProgress (html-simple, no-op)', stepId);
    window.activityComplete = (score) => log('activityComplete (html-simple, no-op)', score);
    return { target: 'html-simple', hasApi: false };
  }

  const API = api || (typeof window !== 'undefined' ? findAPI(window) : null);
  let initialized = false;
  const ensureInit = () => {
    if (API && !initialized) { API.LMSInitialize(''); initialized = true; log('LMSInitialize', ''); }
  };
  ensureInit();

  window.activityProgress = (stepId) => {
    ensureInit();
    if (!API) return log('activityProgress (sans LMS)', stepId);
    API.LMSSetValue('cmi.core.lesson_location', String(stepId));
    API.LMSCommit('');
    log('LMSSetValue cmi.core.lesson_location', String(stepId));
  };

  window.activityComplete = (score) => {
    ensureInit();
    if (!API) return log('activityComplete (sans LMS)', score);
    API.LMSSetValue('cmi.core.score.raw', String(score));
    API.LMSSetValue('cmi.core.score.min', '0');
    API.LMSSetValue('cmi.core.score.max', '100');
    const status = masteryScore != null ? (score >= masteryScore ? 'passed' : 'failed') : 'completed';
    API.LMSSetValue('cmi.core.lesson_status', status);
    API.LMSCommit('');
    log('LMSSetValue cmi.core.score.raw', String(score));
    log('LMSSetValue cmi.core.lesson_status', status);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('unload', () => {
      if (API && initialized) { API.LMSFinish(''); log('LMSFinish', ''); }
    });
  }
  return { target: 'scorm12', hasApi: !!API };
}
