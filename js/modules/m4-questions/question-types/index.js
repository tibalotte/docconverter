/**
 * question-types/index.js — Registre des types de questions.
 *
 * Chaque type expose : type, label, createDefault(), grade(q, response) [pur],
 * renderRuntime(q, host) [→ { getResponse }], renderEditor(q, host, mutate).
 */

import * as multipleChoice from './multiple-choice.js';
import * as matching from './matching.js';
import * as ddtext from './ddtext.js';
import * as ddimage from './ddimage.js';

export const TYPES = [multipleChoice, matching, ddtext, ddimage];

const BY_TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t]));

export function getType(type) {
  return BY_TYPE[type] || null;
}

export function typeLabel(type) {
  const t = getType(type);
  return t ? t.label : type;
}

let _qseq = 0;
function questionId() { return `q-${Date.now().toString(36)}-${++_qseq}`; }

/** Crée une question complète d'un type donné. */
export function createQuestion(type) {
  const t = getType(type);
  if (!t) throw new Error('Type de question inconnu : ' + type);
  return { id: questionId(), ...t.createDefault() };
}

/** Corrige une réponse pour n'importe quel type. */
export function gradeQuestion(question, response) {
  const t = getType(question.type);
  if (!t) return { score: 0, correctness: 'incorrect', messages: ['Type inconnu'] };
  return t.grade(question, response);
}
