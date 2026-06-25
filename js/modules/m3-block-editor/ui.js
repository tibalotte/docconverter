/**
 * ui.js — Interface du Module 3 (éditeur visuel + importation HTML).
 *
 * Importe le HTML/Bootstrap du LLM (coller ou fichier), liste les diapositives
 * et édite la diapositive sélectionnée via l'éditeur de blocs structuré.
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';
import { importHtmlToProject } from './html-importer.js';
import { renderSlideEditor } from './block-editor-ui.js';

export function mountUi(container) {
  mediaStore.releaseAll();
  let selectedId = (store.getProject().slides[0] || {}).id || null;

  container.innerHTML = `
    <div class="m3-wrap">
      <h1 class="h4 mb-1">Éditeur de blocs</h1>
      <p class="text-muted">Colle le HTML/Bootstrap produit par le LLM (ou importe un fichier conforme au
        <code>contrat dc-*</code>), puis réorganise les blocs par colonnes.</p>

      <div class="accordion mb-3" id="m3-import-acc">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button ${store.getProject().slides.some(hasBlocks) ? 'collapsed' : ''}" type="button"
                    data-bs-toggle="collapse" data-bs-target="#m3-import">Importer du HTML</button>
          </h2>
          <div id="m3-import" class="accordion-collapse collapse ${store.getProject().slides.some(hasBlocks) ? '' : 'show'}" data-bs-parent="#m3-import-acc">
            <div class="accordion-body">
              <textarea class="form-control font-monospace small mb-2" rows="8" placeholder="Colle ici le HTML retourné par le LLM…" data-role="html"></textarea>
              <div class="d-flex flex-wrap align-items-center gap-3">
                <div>
                  <input type="file" accept=".html,.htm,text/html" hidden data-role="file">
                  <button class="btn btn-sm btn-outline-secondary" data-role="pick-file">Importer un fichier .html</button>
                </div>
                <div class="btn-group btn-group-sm" role="group">
                  <input type="radio" class="btn-check" name="m3-mode" id="m3-merge" value="merge" checked>
                  <label class="btn btn-outline-primary" for="m3-merge">Fusionner (par étape)</label>
                  <input type="radio" class="btn-check" name="m3-mode" id="m3-replace" value="replace">
                  <label class="btn btn-outline-primary" for="m3-replace">Remplacer tout</label>
                </div>
                <button class="btn btn-sm btn-primary ms-auto" data-role="do-import">Importer</button>
              </div>
              <div data-role="report" class="mt-2"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-md-3">
          <div class="list-group" data-role="slide-list"></div>
        </div>
        <div class="col-md-9">
          <div data-role="editor"></div>
        </div>
      </div>
    </div>
  `;

  const htmlTa = container.querySelector('[data-role="html"]');
  const fileInput = container.querySelector('[data-role="file"]');
  const reportEl = container.querySelector('[data-role="report"]');
  const listEl = container.querySelector('[data-role="slide-list"]');
  const editorEl = container.querySelector('[data-role="editor"]');

  container.querySelector('[data-role="pick-file"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) {
      htmlTa.value = await fileInput.files[0].text();
      fileInput.value = '';
    }
  });

  container.querySelector('[data-role="do-import"]').addEventListener('click', () => {
    const html = htmlTa.value.trim();
    if (!html) { reportEl.innerHTML = '<div class="alert alert-warning py-2 mb-0">Aucun HTML à importer.</div>'; return; }
    const mode = container.querySelector('input[name="m3-mode"]:checked').value;
    const r = importHtmlToProject(html, { mode });
    reportEl.innerHTML = renderReport(r);
    if (!r.error) {
      const slides = store.getProject().slides;
      if (!slides.find((s) => s.id === selectedId)) selectedId = (slides[0] || {}).id || null;
      rerenderAll();
    }
  });

  function rerenderAll() {
    mediaStore.releaseAll();
    renderList();
    renderEditor();
  }

  function renderList() {
    const slides = store.getProject().slides;
    listEl.innerHTML = '';
    if (!slides.length) {
      listEl.innerHTML = '<div class="text-muted small p-2">Aucune diapositive. Importe du HTML ou extrais un PPTX (Module 1).</div>';
      return;
    }
    slides.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center'
        + (s.id === selectedId ? ' active' : '');
      btn.innerHTML = `<span class="text-truncate"><span class="badge text-bg-light border me-1">${s.index + 1}</span>${escapeHtml(s.title)}</span>
        <span class="badge rounded-pill ${s.id === selectedId ? 'text-bg-light' : 'text-bg-secondary'}">${s.blocks.length}</span>`;
      btn.addEventListener('click', () => { selectedId = s.id; rerenderAll(); });
      listEl.appendChild(btn);
    });
  }

  function renderEditor() {
    renderSlideEditor(editorEl, selectedId, rerenderAll);
  }

  rerenderAll();
}

function hasBlocks(s) { return s.blocks && s.blocks.length; }

function renderReport(r) {
  if (r.error) return `<div class="alert alert-danger py-2 mb-0">${escapeHtml(r.error)}</div>`;
  const parts = [];
  if (r.replaced) parts.push(`${r.total} diapositive(s) importée(s) (remplacement complet).`);
  else parts.push(`${r.matched} fusionnée(s), ${r.added} ajoutée(s) sur ${r.sections} section(s).`);
  let html = `<div class="alert alert-success py-2 mb-0">${parts.join(' ')}</div>`;
  if (r.missingMedia.length) {
    html += `<div class="alert alert-warning py-2 mt-2 mb-0 small">
      Médias référencés introuvables (${r.missingMedia.length}) : <code>${r.missingMedia.map(escapeHtml).join('</code>, <code>')}</code>.
      Ils proviennent peut-être d'une extraction PPTX différente.</div>`;
  }
  return html;
}
