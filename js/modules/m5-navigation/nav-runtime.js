/**
 * nav-runtime.js — Navigation à l'exécution (aperçu + base export).
 *
 * Affiche une diapositive à la fois, gère le menu de progression, les boutons
 * Précédent/Suivant et l'indicateur de progression, et appelle
 * window.activityProgress(stepId) à chaque changement de diapositive
 * (cf. docs/pont-scorm.md).
 */

import { renderSlideElement } from '../../shared/slide-renderer.js';
import { buildProgressMenu } from './progress-menu.js';

/**
 * @param {HTMLElement} container
 * @param {object} project
 * @param {{
 *   resolveMediaUrl?: Function, renderQuestion?: Function, onScore?: Function,
 *   onProgress?: (stepId:string, index:number)=>void, startIndex?: number
 * }} opts
 * @returns {Promise<object>} contrôleur { goTo, next, prev, current, destroy }
 */
export async function mountNavigation(container, project, opts = {}) {
  const slides = project.slides || [];
  const nav = project.navigation || { showPrevNext: true, showProgressBar: true };
  const visited = new Set();
  let current = opts.startIndex || 0;

  container.innerHTML = `
    <div class="dc-runtime">
      ${nav.showProgressBar !== false ? `
        <div class="progress mb-3" role="progressbar" aria-label="Progression" style="height:.5rem">
          <div class="progress-bar" data-role="bar" style="width:0%"></div>
        </div>` : ''}
      <div class="row g-3">
        <div class="col-md-3" data-role="menu"></div>
        <div class="col-md-9">
          <div class="dc-stage" data-role="stage"></div>
          ${nav.showPrevNext !== false ? `
            <div class="dc-nav-controls d-flex align-items-center gap-2 mt-3 pt-3 border-top">
              <button class="btn btn-outline-secondary" data-role="prev">← Précédent</button>
              <span class="ms-auto me-auto small text-muted" data-role="counter"></span>
              <button class="btn btn-primary" data-role="next">Suivant →</button>
            </div>` : ''}
        </div>
      </div>
    </div>`;

  const stage = container.querySelector('[data-role="stage"]');
  const menuHost = container.querySelector('[data-role="menu"]');
  const bar = container.querySelector('[data-role="bar"]');
  const counter = container.querySelector('[data-role="counter"]');
  const prevBtn = container.querySelector('[data-role="prev"]');
  const nextBtn = container.querySelector('[data-role="next"]');

  // Rendu de toutes les sections (cachées sauf la courante).
  const sections = [];
  for (const slide of slides) {
    const sec = await renderSlideElement(slide, opts);
    sec.classList.add('dc-slide-page');
    sec.hidden = true;
    stage.appendChild(sec);
    sections.push(sec);
  }

  function renderMenu() {
    const menu = buildProgressMenu(slides, current, visited, (i) => goTo(i));
    menuHost.innerHTML = '';
    menuHost.appendChild(menu);
  }

  function goTo(index) {
    if (index < 0 || index >= slides.length) return;
    sections.forEach((s, i) => { s.hidden = i !== index; });
    current = index;
    visited.add(index);

    if (bar) bar.style.width = Math.round(((index + 1) / slides.length) * 100) + '%';
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;
    renderMenu();

    const stepId = slides[index] && slides[index].stepId;
    if (stepId) {
      if (typeof window !== 'undefined' && window.activityProgress) window.activityProgress(stepId);
      if (opts.onProgress) opts.onProgress(stepId, index);
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

  if (slides.length) goTo(current);
  else stage.innerHTML = '<p class="text-muted">Aucune diapositive.</p>';

  return {
    goTo,
    next: () => goTo(current + 1),
    prev: () => goTo(current - 1),
    current: () => current,
    destroy: () => { container.innerHTML = ''; },
  };
}
