/**
 * matching.js — Question d'appariement (style Moodle « Matching »).
 *
 * Chaque élément de gauche doit être associé au bon élément de droite. Au
 * runtime, les « droites » sont proposées en liste déroulante (mélangées).
 * Réponse : { pairId: rightText }.
 */

import { escapeHtml } from '../../../shared/utils.js';

let _seq = 0;
const pid = () => `p-${Date.now().toString(36)}-${++_seq}`;

export const type = 'matching';
export const label = 'Appariement';

export function createDefault() {
  return {
    type, prompt: '<p>Associe chaque élément.</p>', weight: 1,
    pairs: [
      { id: pid(), left: 'Terme A', right: 'Définition A' },
      { id: pid(), left: 'Terme B', right: 'Définition B' },
    ],
    feedbackByChoice: {}, thoughtSpeaker: null,
  };
}

/** response = { pairId: rightText choisi }. */
export function grade(question, response) {
  const resp = response || {};
  const pairs = question.pairs || [];
  if (!pairs.length) return { score: 0, correctness: 'incorrect', messages: [] };
  let good = 0;
  const messages = [];
  for (const p of pairs) {
    if ((resp[p.id] || '') === p.right) good++;
  }
  const score = good / pairs.length;
  const correctness = score >= 1 ? 'correct' : score <= 0 ? 'incorrect' : 'partial';
  if (score < 1) messages.push(`${good}/${pairs.length} association(s) correcte(s).`);
  return { score, correctness, messages };
}

/** Mélange déterministe (pas de Math.random au niveau module) basé sur l'index. */
function shuffledRights(pairs) {
  const rights = pairs.map((p) => p.right);
  // rotation simple pour ne pas présenter dans l'ordre des gauches
  return rights.map((_, i) => rights[(i + 1) % rights.length]);
}

export function renderRuntime(question, host) {
  const rights = shuffledRights(question.pairs);
  const options = ['<option value="">— choisir —</option>']
    .concat(rights.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`)).join('');
  host.innerHTML = `<div class="dc-q-prompt mb-2">${question.prompt}</div>
    <div class="dc-q-matching d-flex flex-column gap-2">
      ${question.pairs.map((p) => `
        <div class="d-flex gap-2 align-items-center">
          <span class="flex-grow-1 border rounded p-2 bg-light">${escapeHtml(p.left)}</span>
          <span class="text-muted">→</span>
          <select class="form-select" style="max-width:50%" data-pair="${p.id}">${options}</select>
        </div>`).join('')}
    </div>`;
  return {
    getResponse() {
      const r = {};
      host.querySelectorAll('select[data-pair]').forEach((s) => { r[s.dataset.pair] = s.value; });
      return r;
    },
  };
}

export function renderEditor(question, host, mutate) {
  host.innerHTML = `<div data-role="pairs" class="d-flex flex-column gap-2"></div>
    <button class="btn btn-sm btn-outline-secondary mt-2" data-role="add">+ Ajouter une paire</button>`;
  const pairsEl = host.querySelector('[data-role="pairs"]');
  question.pairs.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 align-items-center';
    row.innerHTML = `
      <input class="form-control form-control-sm" value="${escapeHtml(p.left)}" data-role="left" placeholder="Élément de gauche">
      <span class="text-muted">→</span>
      <input class="form-control form-control-sm" value="${escapeHtml(p.right)}" data-role="right" placeholder="Bonne correspondance">
      <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
    row.querySelector('[data-role="left"]').addEventListener('change', (e) =>
      mutate((q) => { q.pairs.find((x) => x.id === p.id).left = e.target.value; }, false));
    row.querySelector('[data-role="right"]').addEventListener('change', (e) =>
      mutate((q) => { q.pairs.find((x) => x.id === p.id).right = e.target.value; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((q) => { q.pairs = q.pairs.filter((x) => x.id !== p.id); }));
    pairsEl.appendChild(row);
  });
  host.querySelector('[data-role="add"]').addEventListener('click', () =>
    mutate((q) => { q.pairs.push({ id: pid(), left: 'Nouvel élément', right: 'Correspondance' }); }));
}
