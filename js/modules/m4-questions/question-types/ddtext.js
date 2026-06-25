/**
 * ddtext.js — Glisser-déposer sur texte (style Moodle « Drag and drop into text »).
 *
 * Le texte contient des trous notés [[1]], [[2]]… Les étiquettes (draggables)
 * portent un numéro de trou cible (ou null = distracteur).
 * Réponse : { gapNumber: draggableId }.
 */

import { escapeHtml } from '../../../shared/utils.js';

let _seq = 0;
const did = () => `d-${Date.now().toString(36)}-${++_seq}`;

export const type = 'ddtext';
export const label = 'Glisser-déposer (texte)';

export function createDefault() {
  return {
    type, weight: 1,
    prompt: '<p>Complète le texte en glissant les bonnes étiquettes.</p>',
    text: 'Le fond [[1]] se prépare avec une [[2]].',
    draggables: [
      { id: did(), text: 'blanc', gap: 1 },
      { id: did(), text: 'volaille', gap: 2 },
      { id: did(), text: 'tomate', gap: null },
    ],
    feedbackByChoice: {}, thoughtSpeaker: null,
  };
}

/** Numéros de trous présents dans le texte. */
export function gapNumbers(text) {
  const set = new Set();
  let m;
  const re = /\[\[(\d+)\]\]/g;
  while ((m = re.exec(text || ''))) set.add(parseInt(m[1], 10));
  return [...set].sort((a, b) => a - b);
}

/** response = { gapNumber: draggableId }. */
export function grade(question, response) {
  const resp = response || {};
  const gaps = gapNumbers(question.text);
  if (!gaps.length) return { score: 0, correctness: 'incorrect', messages: [] };
  const byId = new Map(question.draggables.map((d) => [d.id, d]));
  let good = 0;
  for (const g of gaps) {
    const d = byId.get(resp[g]);
    if (d && d.gap === g) good++;
  }
  const score = good / gaps.length;
  const correctness = score >= 1 ? 'correct' : score <= 0 ? 'incorrect' : 'partial';
  const messages = score < 1 ? [`${good}/${gaps.length} trou(s) correctement rempli(s).`] : [];
  return { score, correctness, messages };
}

export function renderRuntime(question, host) {
  const byId = new Map(question.draggables.map((d) => [d.id, d]));
  const textHtml = escapeHtml(question.text).replace(/\[\[(\d+)\]\]/g, (_, n) =>
    `<span class="dc-gap border rounded px-2 mx-1 bg-white" data-gap="${n}" style="display:inline-block;min-width:90px;min-height:1.8em"></span>`);

  host.innerHTML = `<div class="dc-q-prompt mb-2">${question.prompt}</div>
    <p class="dc-ddtext-text">${textHtml}</p>
    <div class="dc-ddtext-bank d-flex flex-wrap gap-2 p-2 border rounded bg-light" data-role="bank">
      ${question.draggables.map((d) => `<span class="dc-token badge text-bg-primary" draggable="true" data-id="${d.id}" style="cursor:grab">${escapeHtml(d.text)}</span>`).join('')}
    </div>`;

  const bank = host.querySelector('[data-role="bank"]');
  let dragId = null;
  host.querySelectorAll('.dc-token').forEach((tok) => {
    tok.addEventListener('dragstart', () => { dragId = tok.dataset.id; });
  });
  const dropTargets = [...host.querySelectorAll('.dc-gap'), bank];
  dropTargets.forEach((zone) => {
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const tok = host.querySelector(`.dc-token[data-id="${dragId}"]`);
      if (!tok) return;
      if (zone.classList.contains('dc-gap') && zone.children.length) {
        bank.appendChild(zone.firstElementChild); // libère le trou occupé
      }
      zone.appendChild(tok);
    });
  });

  return {
    getResponse() {
      const r = {};
      host.querySelectorAll('.dc-gap').forEach((g) => {
        const tok = g.querySelector('.dc-token');
        if (tok) r[parseInt(g.dataset.gap, 10)] = tok.dataset.id;
      });
      return r;
    },
  };
}

export function renderEditor(question, host, mutate) {
  const gaps = gapNumbers(question.text);
  host.innerHTML = `
    <label class="form-label small fw-semibold">Texte à trous (utilise [[1]], [[2]]…)</label>
    <textarea class="form-control form-control-sm mb-1" rows="3" data-role="text">${escapeHtml(question.text)}</textarea>
    <div class="small text-muted mb-2">Trous détectés : ${gaps.length ? gaps.map((g) => '[[' + g + ']]').join(', ') : 'aucun'}</div>
    <label class="form-label small fw-semibold">Étiquettes</label>
    <div data-role="drags" class="d-flex flex-column gap-2"></div>
    <button class="btn btn-sm btn-outline-secondary mt-2" data-role="add">+ Ajouter une étiquette</button>`;

  host.querySelector('[data-role="text"]').addEventListener('change', (e) =>
    mutate((q) => { q.text = e.target.value; }));

  const dragsEl = host.querySelector('[data-role="drags"]');
  const gapOptions = (sel) => ['<option value="">distracteur</option>']
    .concat(gaps.map((g) => `<option value="${g}" ${sel === g ? 'selected' : ''}>trou ${g}</option>`)).join('');
  question.draggables.forEach((d) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 align-items-center';
    row.innerHTML = `
      <input class="form-control form-control-sm" value="${escapeHtml(d.text)}" data-role="text" placeholder="Étiquette">
      <select class="form-select form-select-sm" style="max-width:140px" data-role="gap">${gapOptions(d.gap)}</select>
      <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
    row.querySelector('[data-role="text"]').addEventListener('change', (e) =>
      mutate((q) => { q.draggables.find((x) => x.id === d.id).text = e.target.value; }, false));
    row.querySelector('[data-role="gap"]').addEventListener('change', (e) =>
      mutate((q) => { q.draggables.find((x) => x.id === d.id).gap = e.target.value ? parseInt(e.target.value, 10) : null; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((q) => { q.draggables = q.draggables.filter((x) => x.id !== d.id); }));
    dragsEl.appendChild(row);
  });
  host.querySelector('[data-role="add"]').addEventListener('click', () =>
    mutate((q) => { q.draggables.push({ id: did(), text: 'étiquette', gap: null }); }));
}
