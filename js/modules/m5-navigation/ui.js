/**
 * ui.js — Interface du Module 5 (navigation automatique).
 *
 * Configure la navigation (Précédent/Suivant, indicateur de progression) et en
 * affiche un aperçu live, avec un journal des appels activityProgress(stepId).
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';
import { renderQuestion } from '../m4-questions/index.js';
import { mountNavigation } from './nav-runtime.js';

export function mountUi(container) {
  mediaStore.releaseAll();
  const nav = store.getProject().navigation || {};

  container.innerHTML = `
    <div class="m5-wrap">
      <h1 class="h4 mb-1">Navigation automatique</h1>
      <p class="text-muted">Menu de progression basé sur les titres, boutons Précédent/Suivant et
        indicateur de progression. Un appel <code>activityProgress(stepId)</code> est émis à chaque
        changement de diapositive.</p>

      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-4">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="nav-prevnext" ${nav.showPrevNext !== false ? 'checked' : ''}>
            <label class="form-check-label" for="nav-prevnext">Boutons Précédent / Suivant</label>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="nav-progress" ${nav.showProgressBar !== false ? 'checked' : ''}>
            <label class="form-check-label" for="nav-progress">Indicateur de progression</label>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header py-1 px-2 fw-semibold small d-flex align-items-center">
              Aperçu de la navigation
              <button class="btn btn-sm btn-outline-secondary ms-auto py-0" data-role="reload">Recharger</button>
            </div>
            <div class="card-body dc-preview-frame" data-role="preview"></div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header py-1 px-2 fw-semibold small">Journal — activityProgress</div>
            <div class="card-body p-2"><ol class="small mb-0 ps-3" data-role="log"></ol></div>
          </div>
        </div>
      </div>
    </div>`;

  const previewEl = container.querySelector('[data-role="preview"]');
  const logEl = container.querySelector('[data-role="log"]');

  container.querySelector('#nav-prevnext').addEventListener('change', (e) => {
    store.update('navigation.showPrevNext', e.target.checked, { silent: true });
    reload();
  });
  container.querySelector('#nav-progress').addEventListener('change', (e) => {
    store.update('navigation.showProgressBar', e.target.checked, { silent: true });
    reload();
  });
  container.querySelector('[data-role="reload"]').addEventListener('click', reload);

  function reload() {
    mediaStore.releaseAll();
    logEl.innerHTML = '';
    mountNavigation(previewEl, store.getProject(), {
      resolveMediaUrl: (ref) => mediaStore.getUrl(ref),
      renderQuestion,
      onProgress: (stepId, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<code>activityProgress("${escapeHtml(stepId)}")</code> <span class="text-muted">(diapo ${index + 1})</span>`;
        logEl.appendChild(li);
      },
    });
  }

  reload();
}
