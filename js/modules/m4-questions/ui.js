/**
 * ui.js — Interface du Module 4 (questions interactives Moodle).
 *
 * Sélection d'une diapositive, ajout/édition/suppression de questions (4 types),
 * champs communs (énoncé, poids, « haut-parleur sur la pensée »), éditeur
 * spécifique au type, aperçu interactif, et synthèse du score agrégé.
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';
import { TYPES, getType, createQuestion, typeLabel } from './question-types/index.js';
import { renderQuestion } from './runtime.js';
import { setThoughtSpeaker } from './feedback-model.js';
import { allQuestions, totalWeight } from './scoring.js';

export function mountUi(container) {
  mediaStore.releaseAll();
  const slides = store.getProject().slides;
  let slideId = (slides[0] || {}).id || null;
  let questionId = null;

  container.innerHTML = `
    <div class="m4-wrap">
      <h1 class="h4 mb-1">Questions interactives Moodle</h1>
      <p class="text-muted">Ajoute des questions entre les diapositives ou intégrées aux pages.
        Rétroaction par choix et « haut-parleur sur la pensée » (pédagogie explicite). Les scores
        sont agrégés et transmis via <code>activityComplete(score)</code>.</p>
      <div data-role="summary" class="alert alert-light border d-flex gap-3 small"></div>
      <div class="row g-3">
        <div class="col-md-3"><div class="list-group" data-role="slides"></div></div>
        <div class="col-md-9"><div data-role="main"></div></div>
      </div>
    </div>`;

  const slidesEl = container.querySelector('[data-role="slides"]');
  const mainEl = container.querySelector('[data-role="main"]');
  const summaryEl = container.querySelector('[data-role="summary"]');

  function findSlide() { return store.getProject().slides.find((s) => s.id === slideId); }
  function findQuestion() {
    const s = findSlide();
    return s && (s.questions || []).find((q) => q.id === questionId);
  }

  /** Mutation sur la question sélectionnée. */
  function mutateQuestion(fn, rerenderAll = true) {
    store.mutate((p) => {
      const s = p.slides.find((x) => x.id === slideId);
      const q = s.questions.find((x) => x.id === questionId);
      fn(q);
    }, 'slides');
    if (rerenderAll) renderMain();
    renderSummary();
  }

  function addQuestion(type) {
    const q = createQuestion(type);
    store.mutate((p) => {
      const s = p.slides.find((x) => x.id === slideId);
      s.questions = s.questions || [];
      s.questions.push(q);
      // Bloc référant la question (intégration dans la page / export).
      s.blocks.push({
        id: 'b-q-' + q.id, type: 'question', column: 1,
        order: s.blocks.length, animation: 'none', content: { questionRef: q.id },
      });
    }, 'slides');
    questionId = q.id;
    renderAll();
  }

  function removeQuestion(qId) {
    store.mutate((p) => {
      const s = p.slides.find((x) => x.id === slideId);
      s.questions = (s.questions || []).filter((q) => q.id !== qId);
      s.blocks = s.blocks.filter((b) => !(b.type === 'question' && b.content.questionRef === qId));
    }, 'slides');
    if (questionId === qId) questionId = null;
    renderAll();
  }

  function renderSlides() {
    const list = store.getProject().slides;
    slidesEl.innerHTML = '';
    list.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center'
        + (s.id === slideId ? ' active' : '');
      btn.innerHTML = `<span class="text-truncate"><span class="badge text-bg-light border me-1">${s.index + 1}</span>${escapeHtml(s.title)}</span>
        <span class="badge rounded-pill ${s.id === slideId ? 'text-bg-light' : 'text-bg-secondary'}">${(s.questions || []).length}</span>`;
      btn.addEventListener('click', () => { slideId = s.id; questionId = null; renderAll(); });
      slidesEl.appendChild(btn);
    });
  }

  function renderMain() {
    const slide = findSlide();
    mainEl.innerHTML = '';
    if (!slide) { mainEl.innerHTML = '<p class="text-muted">Aucune diapositive.</p>'; return; }

    const head = document.createElement('div');
    head.className = 'd-flex align-items-center gap-2 mb-3';
    head.innerHTML = `<h2 class="h6 mb-0 flex-grow-1">${escapeHtml(slide.title)}</h2>
      <div class="dropdown">
        <button class="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown">+ Ajouter une question</button>
        <ul class="dropdown-menu dropdown-menu-end">
          ${TYPES.map((t) => `<li><a class="dropdown-item" href="#" data-type="${t.type}">${t.label}</a></li>`).join('')}
        </ul>
      </div>`;
    head.querySelectorAll('[data-type]').forEach((a) =>
      a.addEventListener('click', (e) => { e.preventDefault(); addQuestion(a.dataset.type); }));
    mainEl.appendChild(head);

    const questions = slide.questions || [];
    const listWrap = document.createElement('div');
    listWrap.className = 'd-flex flex-column gap-1 mb-3';
    if (!questions.length) listWrap.innerHTML = '<p class="text-muted small">Aucune question sur cette diapositive.</p>';
    questions.forEach((q) => {
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center gap-2 border rounded p-2' + (q.id === questionId ? ' border-primary' : '');
      row.innerHTML = `<span class="badge text-bg-info">${typeLabel(q.type)}</span>
        <span class="flex-grow-1 text-truncate small">${escapeHtml(stripHtml(q.prompt))}</span>
        <button class="btn btn-sm btn-outline-secondary" data-role="edit">Éditer</button>
        <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
      row.querySelector('[data-role="edit"]').addEventListener('click', () => { questionId = q.id; renderMain(); });
      row.querySelector('[data-role="del"]').addEventListener('click', () => {
        if (confirm('Supprimer cette question ?')) removeQuestion(q.id);
      });
      listWrap.appendChild(row);
    });
    mainEl.appendChild(listWrap);

    if (findQuestion()) renderEditor(mainEl);
  }

  function renderEditor(parent) {
    const q = findQuestion();
    const t = getType(q.type);
    const wrap = document.createElement('div');
    wrap.className = 'row g-3';
    wrap.innerHTML = `
      <div class="col-lg-6">
        <div class="card">
          <div class="card-header py-1 px-2 fw-semibold small">Édition — ${typeLabel(q.type)}</div>
          <div class="card-body">
            <label class="form-label small fw-semibold">Énoncé (HTML)</label>
            <textarea class="form-control form-control-sm mb-2" rows="2" data-role="prompt">${escapeHtml(q.prompt || '')}</textarea>
            <div class="d-flex align-items-center gap-2 mb-2">
              <label class="small fw-semibold mb-0">Poids</label>
              <input type="number" min="0" step="0.5" class="form-control form-control-sm" style="max-width:90px" data-role="weight" value="${q.weight != null ? q.weight : 1}">
            </div>
            <div data-role="type-editor" class="border-top pt-2"></div>
            <div class="border-top pt-2 mt-2">
              <label class="form-label small fw-semibold">💭 Haut-parleur sur la pensée (optionnel)</label>
              <textarea class="form-control form-control-sm" rows="2" data-role="thought" placeholder="Rends explicite le raisonnement attendu…">${escapeHtml(q.thoughtSpeaker ? q.thoughtSpeaker.html : '')}</textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card">
          <div class="card-header py-1 px-2 fw-semibold small d-flex align-items-center">
            Aperçu interactif
            <button class="btn btn-sm btn-outline-secondary ms-auto py-0" data-role="refresh">Rafraîchir</button>
          </div>
          <div class="card-body" data-role="preview"></div>
        </div>
      </div>`;
    parent.appendChild(wrap);

    wrap.querySelector('[data-role="prompt"]').addEventListener('change', (e) =>
      mutateQuestion((q) => { q.prompt = e.target.value; }, false));
    wrap.querySelector('[data-role="weight"]').addEventListener('change', (e) =>
      mutateQuestion((q) => { q.weight = parseFloat(e.target.value) || 0; }, false));
    wrap.querySelector('[data-role="thought"]').addEventListener('change', (e) =>
      mutateQuestion((q) => setThoughtSpeaker(q, e.target.value), false));

    // Éditeur spécifique au type.
    t.renderEditor(q, wrap.querySelector('[data-role="type-editor"]'), (fn, rerender = true) =>
      mutateQuestion(fn, rerender));

    // Aperçu.
    const previewEl = wrap.querySelector('[data-role="preview"]');
    const doPreview = () => renderQuestion(findQuestion(), previewEl, {
      onScore: (qid, score) => { /* aperçu : pas d'agrégation réelle */ },
    });
    wrap.querySelector('[data-role="refresh"]').addEventListener('click', doPreview);
    doPreview();
  }

  function renderSummary() {
    const project = store.getProject();
    const qs = allQuestions(project).map((x) => x.question);
    const max = (project.scoring && project.scoring.maxScore) || 100;
    summaryEl.innerHTML = `
      <span><strong>${qs.length}</strong> question(s)</span>
      <span>poids total : <strong>${totalWeight(qs)}</strong></span>
      <span>score max : <strong>${max}</strong> → <code>activityComplete</code></span>`;
  }

  function renderAll() {
    mediaStore.releaseAll();
    renderSlides();
    renderMain();
    renderSummary();
  }

  renderAll();
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '(sans énoncé)';
}
