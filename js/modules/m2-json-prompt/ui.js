/**
 * ui.js — Interface du Module 2 (JSON enrichi + double prompt).
 *
 * Formulaire de métadonnées FP, puis trois sorties copiables : Prompt Phase 1
 * (création pédagogique), Prompt Phase 2 (prescription technique) et le JSON
 * enrichi (copie/téléchargement).
 */

import { store } from '../../core/state-store.js';
import { escapeHtml } from '../../shared/utils.js';
import {
  FP_FIELDS, PROGRAMMES_SUGGERES, getField, setField, isFpComplete,
} from './metadata-fp.js';
import { contentStats } from './content-digest.js';

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli : sélection via textarea temporaire.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = 'Copié ✓';
    btn.classList.add('btn-success');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('btn-success'); }, 1500);
  }
}

export function mountUi(container, api) {
  const stats = contentStats(store.getProject());

  container.innerHTML = `
    <div class="m2-wrap">
      <h1 class="h4 mb-1">JSON enrichi + double prompt</h1>
      <p class="text-muted">Renseigne le contexte de formation professionnelle, puis copie les
        deux prompts à coller dans le LLM de ton choix (Claude, Gemini, ChatGPT, Copilot).</p>

      <div class="alert alert-light border d-flex gap-3 small">
        <span><strong>${stats.slides}</strong> diapositives</span>
        <span><strong>${stats.blocks}</strong> blocs</span>
        <span><strong>${stats.tables}</strong> tableaux</span>
        <span><strong>${stats.medias}</strong> médias</span>
        <span class="ms-auto" data-role="fp-badge"></span>
      </div>

      <div class="card mb-3">
        <div class="card-header fw-semibold">Métadonnées — Formation professionnelle</div>
        <div class="card-body" data-role="fp-form"></div>
      </div>

      <ul class="nav nav-tabs" role="tablist">
        <li class="nav-item"><button class="nav-link active" data-tab="p1">Prompt Phase 1 — Pédagogie</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="p2">Prompt Phase 2 — Technique</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="json">JSON enrichi</button></li>
      </ul>
      <div class="border border-top-0 rounded-bottom p-3">
        <div data-pane="p1">
          <p class="small text-muted">Génère le HTML/Bootstrap pédagogique, sans code SCORM. Dépend des métadonnées FP ci-dessus.</p>
          <div class="d-flex gap-2 mb-2">
            <button class="btn btn-sm btn-primary" data-role="copy-p1">Copier le prompt</button>
            <button class="btn btn-sm btn-outline-secondary" data-role="refresh-p1">Régénérer</button>
          </div>
          <textarea class="form-control font-monospace small" rows="16" readonly data-role="ta-p1"></textarea>
        </div>
        <div data-pane="p2" hidden>
          <p class="small text-muted">À coller après la Phase 1 : ajoute le pont SCORM, le resize iframe, le nettoyage et l'analyse Loi 25.</p>
          <div class="d-flex gap-2 mb-2">
            <button class="btn btn-sm btn-primary" data-role="copy-p2">Copier le prompt</button>
            <button class="btn btn-sm btn-outline-secondary" data-role="refresh-p2">Régénérer</button>
          </div>
          <textarea class="form-control font-monospace small" rows="16" readonly data-role="ta-p2"></textarea>
        </div>
        <div data-pane="json" hidden>
          <div class="d-flex gap-2 mb-2">
            <button class="btn btn-sm btn-primary" data-role="copy-json">Copier le JSON</button>
            <button class="btn btn-sm btn-outline-secondary" data-role="dl-json">Télécharger .json</button>
          </div>
          <textarea class="form-control font-monospace small" rows="16" readonly data-role="ta-json"></textarea>
        </div>
      </div>
    </div>
  `;

  /* ---- Formulaire FP ---- */
  const formEl = container.querySelector('[data-role="fp-form"]');
  const meta = store.getProject().metadataFP;
  const row = document.createElement('div');
  row.className = 'row g-3';
  for (const f of FP_FIELDS) {
    const val = getField(meta, f.key);
    const col = document.createElement('div');
    col.className = f.type === 'textarea' ? 'col-12' : 'col-md-6';
    const id = 'fp-' + f.key.replace(/\./g, '-');
    const control = f.type === 'textarea'
      ? `<textarea class="form-control" id="${id}" rows="2" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val || '')}</textarea>`
      : `<input class="form-control" id="${id}" type="${f.type}" placeholder="${escapeHtml(f.placeholder || '')}"
            value="${escapeHtml(val == null ? '' : val)}" ${f.list ? `list="${f.list}"` : ''}>`;
    col.innerHTML = `<label class="form-label small fw-semibold" for="${id}">${f.label}</label>${control}`;
    row.appendChild(col);
    const input = col.querySelector('input,textarea');
    input.addEventListener('input', () => {
      const raw = input.value;
      const value = f.type === 'number' ? (parseInt(raw, 10) || 0) : raw;
      store.update('metadataFP.' + f.key, value, { silent: true });
      updateBadge();
    });
  }
  formEl.appendChild(row);
  const datalist = document.createElement('datalist');
  datalist.id = 'fp-programmes';
  datalist.innerHTML = PROGRAMMES_SUGGERES.map((p) => `<option value="${escapeHtml(p)}">`).join('');
  formEl.appendChild(datalist);

  /* ---- Badge complétude FP ---- */
  const badgeEl = container.querySelector('[data-role="fp-badge"]');
  function updateBadge() {
    const ok = isFpComplete(store.getProject().metadataFP);
    badgeEl.innerHTML = ok
      ? '<span class="badge text-bg-success">Métadonnées FP complètes</span>'
      : '<span class="badge text-bg-warning">Métadonnées FP à compléter</span>';
  }
  updateBadge();

  /* ---- Onglets ---- */
  const tabs = container.querySelectorAll('[data-tab]');
  const panes = {
    p1: container.querySelector('[data-pane="p1"]'),
    p2: container.querySelector('[data-pane="p2"]'),
    json: container.querySelector('[data-pane="json"]'),
  };
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('active', x === t));
    Object.entries(panes).forEach(([k, el]) => { el.hidden = k !== t.dataset.tab; });
    refresh(t.dataset.tab);
  }));

  /* ---- Sorties ---- */
  const taP1 = container.querySelector('[data-role="ta-p1"]');
  const taP2 = container.querySelector('[data-role="ta-p2"]');
  const taJson = container.querySelector('[data-role="ta-json"]');

  function refresh(which) {
    if (which === 'p1') taP1.value = api.getPhase1();
    else if (which === 'p2') taP2.value = api.getPhase2();
    else if (which === 'json') taJson.value = api.exportJson();
  }

  container.querySelector('[data-role="refresh-p1"]').addEventListener('click', () => refresh('p1'));
  container.querySelector('[data-role="refresh-p2"]').addEventListener('click', () => refresh('p2'));
  container.querySelector('[data-role="copy-p1"]').addEventListener('click', (e) => { refresh('p1'); copyText(taP1.value, e.target); });
  container.querySelector('[data-role="copy-p2"]').addEventListener('click', (e) => { refresh('p2'); copyText(taP2.value, e.target); });
  container.querySelector('[data-role="copy-json"]').addEventListener('click', (e) => { refresh('json'); copyText(taJson.value, e.target); });
  container.querySelector('[data-role="dl-json"]').addEventListener('click', () => api.downloadJson());

  // Rendu initial du premier onglet.
  refresh('p1');
}
