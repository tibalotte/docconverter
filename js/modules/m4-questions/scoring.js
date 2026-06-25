/**
 * scoring.js — Agrégation des scores et report via le pont SCORM.
 *
 * Les questions de toutes les diapositives sont pondérées (weight) ; le score
 * agrégé est ramené sur project.scoring.maxScore et transmis une seule fois via
 * window.activityComplete(score) (cf. docs/pont-scorm.md).
 */

/** Toutes les questions du projet, dans l'ordre des diapositives. */
export function allQuestions(project) {
  const out = [];
  for (const s of project.slides || []) {
    for (const q of s.questions || []) out.push({ slideId: s.id, question: q });
  }
  return out;
}

/** Somme des poids (dénominateur de l'agrégation). */
export function totalWeight(questions) {
  return questions.reduce((sum, q) => sum + (q.weight || 1), 0);
}

/**
 * Agrège des résultats partiels en score final.
 * @param {Array<{weight:number, score:number}>} graded  score ∈ [0,1]
 * @param {number} maxScore
 * @returns {number} score ∈ [0, maxScore]
 */
export function aggregateScore(graded, maxScore = 100) {
  const w = graded.reduce((s, g) => s + (g.weight || 1), 0);
  if (!w) return 0;
  const acc = graded.reduce((s, g) => s + (g.weight || 1) * Math.max(0, Math.min(1, g.score)), 0);
  return Math.round((acc / w) * maxScore);
}

/**
 * Contrôleur de score pour le runtime : collecte les scores par question et
 * déclenche activityComplete quand toutes ont été répondues.
 */
export function createScoreController(project, { onComplete } = {}) {
  const questions = allQuestions(project).map((x) => x.question);
  const max = (project.scoring && project.scoring.maxScore) || 100;
  const scores = new Map(); // questionId → { weight, score }

  return {
    record(questionId, score) {
      const q = questions.find((x) => x.id === questionId);
      scores.set(questionId, { weight: (q && q.weight) || 1, score });
      const current = aggregateScore([...scores.values()], max);
      if (scores.size >= questions.length && questions.length > 0) {
        if (typeof window !== 'undefined' && window.activityComplete) {
          window.activityComplete(current);
        }
        if (onComplete) onComplete(current);
      }
      return current;
    },
    current() {
      return aggregateScore([...scores.values()], max);
    },
    answered() { return scores.size; },
    total() { return questions.length; },
    maxScore: max,
  };
}
