/**
 * multiple-choice.js — Question à choix (unique ou multiple), style Moodle.
 *
 * Réponse (response) : tableau d'ids de choix sélectionnés.
 */

import { escapeHtml } from '../../../shared/utils.js';
import { choiceFeedback } from '../feedback-model.js';

let _seq = 0;
const cid = () => `c-${Date.now().toString(36)}-${++_seq}`;

export const type = 'multiple-choice';
export const label = 'Choix multiple';

export function createDefault() {
  return {
    type, prompt: '<p>Énoncé de la question…</p>', weight: 1, multiple: false,
    choices: [
      { id: cid(), text: 'Réponse correcte', correct: true },
      { id: cid(), text: 'Distracteur', correct: false },
    ],
    feedbackByChoice: {}, thoughtSpeaker: null,
  };
}

/** Correction pure. response = [choiceId,…]. */
export function grade(question, response) {
  const selected = new Set(response || []);
  const correct = question.choices.filter((c) => c.correct).map((c) => c.id);
  const correctSet = new Set(correct);
  const messages = [];

  for (const id of selected) {
    const fb = choiceFeedback(question, id);
    if (fb) messages.push(fb);
  }

  if (!correct.length) return { score: 0, correctness: 'incorrect', messages };

  let score;
  if (!question.multiple) {
    score = selected.size === 1 && correctSet.has([...selected][0]) ? 1 : 0;
  } else {
    let good = 0, bad = 0;
    for (const id of selected) (correctSet.has(id) ? good++ : bad++);
    score = Math.max(0, Math.min(1, (good - bad) / correct.length));
  }
  const correctness = score >= 1 ? 'correct' : score <= 0 ? 'incorrect' : 'partial';
  return { score, correctness, messages };
}

/** Runtime interactif. Renvoie { getResponse }. */
export function renderRuntime(question, host) {
  const inputType = question.multiple ? 'checkbox' : 'radio';
  const name = 'q-' + question.id;
  host.innerHTML = `<div class="dc-q-prompt mb-2">${question.prompt}</div>
    <div class="dc-q-choices d-flex flex-column gap-2">
      ${question.choices.map((c) => `
        <label class="form-check dc-q-choice border rounded p-2 d-flex gap-2 align-items-start">
          <input class="form-check-input mt-0" type="${inputType}" name="${name}" value="${c.id}">
          <span>${escapeHtml(c.text)}</span>
        </label>`).join('')}
    </div>`;
  return {
    getResponse() {
      return [...host.querySelectorAll('input:checked')].map((i) => i.value);
    },
  };
}

/** Éditeur d'authoring. mutate(fn) applique fn(question) et re-rend. */
export function renderEditor(question, host, mutate) {
  host.innerHTML = `
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox" id="mc-multi-${question.id}" ${question.multiple ? 'checked' : ''}>
      <label class="form-check-label small" for="mc-multi-${question.id}">Plusieurs bonnes réponses possibles</label>
    </div>
    <div data-role="choices" class="d-flex flex-column gap-2"></div>
    <button class="btn btn-sm btn-outline-secondary mt-2" data-role="add">+ Ajouter un choix</button>`;

  host.querySelector(`#mc-multi-${question.id}`).addEventListener('change', (e) =>
    mutate((q) => { q.multiple = e.target.checked; }));

  const choicesEl = host.querySelector('[data-role="choices"]');
  question.choices.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'border rounded p-2';
    row.innerHTML = `
      <div class="d-flex gap-2 align-items-center mb-1">
        <input class="form-check-input mt-0" type="${question.multiple ? 'checkbox' : 'radio'}" name="correct-${question.id}" ${c.correct ? 'checked' : ''} data-role="correct">
        <input class="form-control form-control-sm" value="${escapeHtml(c.text)}" data-role="text" placeholder="Texte du choix">
        <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>
      </div>
      <input class="form-control form-control-sm" value="${escapeHtml((question.feedbackByChoice || {})[c.id] || '')}" data-role="fb" placeholder="Rétroaction spécifique à ce choix (optionnel)">`;
    row.querySelector('[data-role="text"]').addEventListener('change', (e) =>
      mutate((q) => { q.choices.find((x) => x.id === c.id).text = e.target.value; }, false));
    row.querySelector('[data-role="correct"]').addEventListener('change', (e) =>
      mutate((q) => {
        if (!q.multiple) q.choices.forEach((x) => { x.correct = false; });
        q.choices.find((x) => x.id === c.id).correct = e.target.checked;
      }, false));
    row.querySelector('[data-role="fb"]').addEventListener('change', (e) =>
      mutate((q) => { (q.feedbackByChoice = q.feedbackByChoice || {})[c.id] = e.target.value; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((q) => {
        q.choices = q.choices.filter((x) => x.id !== c.id);
        if (q.feedbackByChoice) delete q.feedbackByChoice[c.id];
      }));
    choicesEl.appendChild(row);
  });

  host.querySelector('[data-role="add"]').addEventListener('click', () =>
    mutate((q) => { q.choices.push({ id: cid(), text: 'Nouveau choix', correct: false }); }));
}
