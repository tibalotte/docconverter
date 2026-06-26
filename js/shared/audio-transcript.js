/**
 * audio-transcript.js — Découpage et minutage d'un texte sur un audio.
 *
 * Porté (et simplifié) des fonctions du pipeline PPTX de l'utilisateur :
 *   - build_subtitle_phrases : segmentation en phrases (+ sous-découpe aux virgules)
 *   - _estimate_phrase_durations : minutage proportionnel à la longueur
 *
 * Objectif « écoute active » : transformer le texte de la théorie (notes du
 * présentateur ou script collé) en phrases minutées, surlignées pendant la
 * lecture. 100 % navigateur : le minutage proportionnel ne requiert ni Whisper
 * ni API. Si des minutages mot-à-mot (Whisper) sont fournis, on les exploite.
 */

// Fin de phrase : . ! ? ou points de suspension.
const SENTENCE_RE = /[^.!?]+(?:\.{3,}|[.!?])+/gu;

/** Segmente un texte en phrases ; sous-découpe celles dépassant maxChars aux virgules. */
export function splitIntoPhrases(text, maxChars = 120) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  let raw = (t.match(SENTENCE_RE) || []).map((s) => s.trim()).filter(Boolean);
  if (!raw.length) raw = [t];

  const phrases = [];
  for (const s of raw) {
    if (s.length <= maxChars) { phrases.push(s); continue; }
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    let cur = '';
    for (const p of parts) {
      const cand = cur ? cur + ', ' + p : p;
      if (cand.length > maxChars && cur) { phrases.push(cur); cur = p; }
      else cur = cand;
    }
    if (cur) phrases.push(cur);
  }
  return phrases;
}

/**
 * Minutage proportionnel à la longueur en caractères (port de
 * _estimate_phrase_durations). Garantit minDurMs par phrase si la durée le permet.
 * @returns {Array<{text:string,start_ms:number,end_ms:number}>}
 */
export function proportionalTimings(phrases, totalMs, minDurMs = 1500) {
  const n = phrases.length;
  if (!n || !totalMs) return phrases.map((text) => ({ text, start_ms: 0, end_ms: 0 }));
  const charCounts = phrases.map((p) => Math.max(1, p.trim().length));
  const totalChars = charCounts.reduce((a, b) => a + b, 0);

  let durations;
  if (totalMs >= n * minDurMs) {
    const bonus = totalMs - n * minDurMs;
    durations = charCounts.map((c) => minDurMs + Math.floor(bonus * c / totalChars));
  } else {
    durations = charCounts.map((c) => Math.floor(totalMs * c / totalChars));
  }
  const diff = totalMs - durations.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const idxLongest = charCounts.indexOf(Math.max(...charCounts));
    durations[idxLongest] += diff;
  }

  const out = [];
  let cur = 0;
  for (let k = 0; k < n; k++) {
    out.push({ text: phrases[k], start_ms: cur, end_ms: cur + durations[k] });
    cur += durations[k];
  }
  return out;
}

/** Raccourci : texte + durée → phrases minutées (proportionnel). */
export function phrasesFromText(text, totalMs, opts = {}) {
  return proportionalTimings(splitIntoPhrases(text, opts.maxChars || 120), totalMs, opts.minDurMs || 1500);
}

/**
 * Minutage à partir de minutages mot-à-mot Whisper.
 * @param {string} text
 * @param {Array<{word:string,start:number,end:number}>} wordTimings  (temps en secondes)
 * @returns {Array<{text,start_ms,end_ms}>|null} null si pas de minutages.
 */
export function phrasesFromWordTimings(text, wordTimings, maxChars = 120) {
  if (!wordTimings || !wordTimings.length) return null;
  const phrases = splitIntoPhrases(text, maxChars);
  if (!phrases.length) return null;
  const total = wordTimings.length;
  const counts = phrases.map((p) => Math.max(1, p.split(/\s+/).filter(Boolean).length));
  const sum = counts.reduce((a, b) => a + b, 0);

  const out = [];
  let wi = 0;
  for (let k = 0; k < phrases.length; k++) {
    const take = Math.max(1, Math.round(counts[k] * total / sum));
    const startW = wordTimings[Math.min(wi, total - 1)];
    const endW = wordTimings[Math.min(wi + take - 1, total - 1)];
    out.push({
      text: phrases[k],
      start_ms: Math.round((startW.start || 0) * 1000),
      end_ms: Math.round((endW.end || 0) * 1000),
    });
    wi += take;
  }
  return out;
}

/** Index de la phrase active pour un temps donné (ms). -1 si aucune. */
export function activePhraseIndex(phrases, ms) {
  for (let i = phrases.length - 1; i >= 0; i--) {
    if (ms >= phrases[i].start_ms) return i;
  }
  return phrases.length ? 0 : -1;
}
