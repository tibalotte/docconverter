/**
 * feedback-model.js — Rétroactions des questions.
 *
 * Deux niveaux (cf. modèle RÉCIT / pédagogie explicite) :
 *  - rétroaction spécifique PAR CHOIX (feedbackByChoice[choiceId])
 *  - rétroaction « haut-parleur sur la pensée » (thoughtSpeaker) : rend explicite
 *    le raisonnement attendu, affichée après réponse.
 */

import { escapeHtml } from '../../shared/utils.js';

/** Rétroaction par défaut (générique) selon la justesse. */
export const DEFAULT_FEEDBACK = {
  correct: 'Bonne réponse.',
  incorrect: 'Réponse à revoir.',
  partial: 'Réponse partiellement correcte.',
};

/** Récupère la rétroaction spécifique d'un choix, ou null. */
export function choiceFeedback(question, choiceId) {
  const fb = question.feedbackByChoice || {};
  return fb[choiceId] || null;
}

/** Construit le bloc HTML de rétroaction affiché après correction. */
export function renderFeedbackHtml(question, result) {
  const parts = [];
  const cls = result.correctness === 'correct' ? 'alert-success'
    : result.correctness === 'partial' ? 'alert-warning' : 'alert-danger';
  const generic = result.correctness === 'correct' ? DEFAULT_FEEDBACK.correct
    : result.correctness === 'partial' ? DEFAULT_FEEDBACK.partial : DEFAULT_FEEDBACK.incorrect;

  parts.push(`<div class="alert ${cls} dc-q-feedback mb-2" role="status">
    <strong>${generic}</strong> <span class="float-end">${Math.round(result.score * 100)} %</span>`);
  if (result.messages && result.messages.length) {
    parts.push('<ul class="mb-0 mt-1">' +
      result.messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('') + '</ul>');
  }
  parts.push('</div>');

  if (question.thoughtSpeaker && question.thoughtSpeaker.html) {
    parts.push(`<div class="dc-q-thought card border-info mb-2">
      <div class="card-body py-2 px-3">
        <div class="small text-info fw-semibold mb-1">💭 Haut-parleur sur la pensée</div>
        <div>${question.thoughtSpeaker.html}</div>
      </div></div>`);
  }
  return parts.join('');
}

/** Active/désactive la rétroaction « haut-parleur sur la pensée ». */
export function setThoughtSpeaker(question, html) {
  question.thoughtSpeaker = html && html.trim() ? { html } : null;
}
