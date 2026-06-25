/**
 * runtime.js — Rendu interactif d'une question (aperçu auteur + base export).
 *
 * Rend le type, ajoute le bouton « Vérifier », corrige à la validation, affiche
 * la rétroaction (par choix + haut-parleur sur la pensée) et notifie le score.
 */

import { getType, gradeQuestion } from './question-types/index.js';
import { renderFeedbackHtml } from './feedback-model.js';

/**
 * @param {object} question
 * @param {HTMLElement} host
 * @param {{ onScore?: (questionId:string, score:number, result:object)=>void }} opts
 */
export async function renderQuestion(question, host, opts = {}) {
  const t = getType(question.type);
  host.innerHTML = '';
  if (!t) { host.innerHTML = '<div class="alert alert-danger">Type inconnu.</div>'; return; }

  const card = document.createElement('div');
  card.className = 'dc-question card';
  card.innerHTML = `
    <div class="card-body">
      <div data-role="body"></div>
      <div class="mt-3 d-flex align-items-center gap-2">
        <button class="btn btn-primary btn-sm" data-role="check">Vérifier</button>
        <button class="btn btn-outline-secondary btn-sm" data-role="retry" hidden>Réessayer</button>
        <span class="ms-auto small text-muted" data-role="badge"></span>
      </div>
      <div data-role="feedback" class="mt-2"></div>
    </div>`;
  host.appendChild(card);

  const bodyEl = card.querySelector('[data-role="body"]');
  const feedbackEl = card.querySelector('[data-role="feedback"]');
  const checkBtn = card.querySelector('[data-role="check"]');
  const retryBtn = card.querySelector('[data-role="retry"]');

  // renderRuntime peut être asynchrone (ddimage charge l'image).
  let control = await t.renderRuntime(question, bodyEl);

  checkBtn.addEventListener('click', () => {
    const response = control.getResponse();
    const result = gradeQuestion(question, response);
    feedbackEl.innerHTML = renderFeedbackHtml(question, result);
    checkBtn.hidden = true;
    retryBtn.hidden = false;
    bodyEl.querySelectorAll('input,select,.dc-token').forEach((el) => {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.disabled = true;
      el.setAttribute('draggable', 'false');
    });
    if (opts.onScore) opts.onScore(question.id, result.score, result);
  });

  retryBtn.addEventListener('click', async () => {
    feedbackEl.innerHTML = '';
    checkBtn.hidden = false;
    retryBtn.hidden = true;
    control = await t.renderRuntime(question, bodyEl);
  });
}
