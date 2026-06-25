/**
 * index.js — Module 4 : Questions interactives Moodle.
 *
 * Quatre types reproduisant le comportement/design Moodle : choix multiple,
 * appariement, glisser-déposer sur texte, glisser-déposer sur image (éditeur de
 * zones). Rétroaction par choix + « haut-parleur sur la pensée ». Scores
 * agrégés et transmis via window.activityComplete(score).
 */

import { store } from '../../core/state-store.js';
import { mountUi } from './ui.js';

export { gradeQuestion, createQuestion, getType, TYPES } from './question-types/index.js';
export { aggregateScore, createScoreController, allQuestions } from './scoring.js';
export { renderQuestion } from './runtime.js';

export const module4 = {
  id: 'm4',
  label: '4 · Questions Moodle',
  order: 4,
  enabled: () => store.getProject().slides.length > 0,
  mount(container) { mountUi(container); },
  unmount() { /* ObjectURL révoqués au prochain montage */ },
};
