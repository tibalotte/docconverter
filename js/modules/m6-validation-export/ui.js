/**
 * ui.js — Interface du Module 6 (validation + simulateur + export).
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { downloadBlob } from '../../core/persistence.js';
import { escapeHtml } from '../../shared/utils.js';
import { analyzeLoi25 } from '../../shared/loi25.js';
import { validateProject } from './validator.js';
import { buildFixPrompt } from './fix-prompts.js';
import { mountSimulator } from './moodle-simulator.js';
import { buildExportPackage, buildIndexHtml } from './export-builder.js';

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  if (btn) { const o = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(() => (btn.textContent = o), 1500); }
}

const SEV = { error: 'danger', warning: 'warning', info: 'info' };

export function mountUi(container) {
  mediaStore.releaseAll();
  const exportSettings = store.getProject().exportSettings || {};

  container.innerHTML = `
    <div class="m6-wrap">
      <h1 class="h4 mb-1">Validation et export</h1>
      <p class="text-muted">Valide le contenu, teste dans le simulateur Moodle, puis exporte en SCORM 1.2
        ou HTML simple. Analyse de conformité Loi 25 incluse.</p>

      <div class="card mb-3">
        <div class="card-header fw-semibold d-flex align-items-center">Validation automatique
          <button class="btn btn-sm btn-primary ms-auto" data-role="validate">Valider</button></div>
        <div class="card-body" data-role="validation"><p class="text-muted small mb-0">Lance la validation pour détecter les problèmes (SDK résiduel, hauteur fixe, etc.).</p></div>
      </div>

      <div class="card mb-3">
        <div class="card-header fw-semibold d-flex align-items-center">Simulateur Moodle
          <button class="btn btn-sm btn-outline-primary ms-auto" data-role="sim-start">Démarrer</button></div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-lg-8"><div class="dc-preview-frame border rounded p-2" data-role="sim-stage"><p class="text-muted small mb-0">Le simulateur monte le module avec une fausse API SCORM.</p></div></div>
            <div class="col-lg-4">
              <div class="d-flex align-items-center mb-1"><span class="fw-semibold small">Journal SCORM</span>
                <button class="btn btn-sm btn-link ms-auto p-0" data-role="sim-clear">vider</button></div>
              <ol class="small mb-0 ps-3" data-role="sim-log" style="max-height:60vh;overflow:auto"></ol>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header fw-semibold">Export</div>
        <div class="card-body">
          <div class="d-flex flex-wrap gap-4 mb-3">
            <div>
              <div class="small fw-semibold mb-1">Cible</div>
              <div class="btn-group btn-group-sm" role="group">
                <input type="radio" class="btn-check" name="m6-target" id="m6-scorm" value="scorm12" ${exportSettings.target !== 'html-simple' ? 'checked' : ''}>
                <label class="btn btn-outline-primary" for="m6-scorm">SCORM 1.2</label>
                <input type="radio" class="btn-check" name="m6-target" id="m6-html" value="html-simple" ${exportSettings.target === 'html-simple' ? 'checked' : ''}>
                <label class="btn btn-outline-primary" for="m6-html">HTML simple</label>
              </div>
            </div>
            <div class="form-check form-switch align-self-end">
              <input class="form-check-input" type="checkbox" id="m6-resize" ${exportSettings.iframeResize !== false ? 'checked' : ''}>
              <label class="form-check-label" for="m6-resize">Script resize iframe</label>
            </div>
            <div class="form-check form-switch align-self-end">
              <input class="form-check-input" type="checkbox" id="m6-loi25" ${exportSettings.loi25Notice !== false ? 'checked' : ''}>
              <label class="form-check-label" for="m6-loi25">Avis Loi 25</label>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-secondary btn-sm" data-role="loi25">Analyser Loi 25</button>
            <button class="btn btn-primary btn-sm ms-auto" data-role="export">Exporter le paquet (.zip)</button>
          </div>
          <div data-role="loi25-out" class="mt-2"></div>
          <div data-role="export-out" class="mt-2"></div>
        </div>
      </div>
    </div>`;

  /* ---- Validation ---- */
  const validationEl = container.querySelector('[data-role="validation"]');
  container.querySelector('[data-role="validate"]').addEventListener('click', () => {
    const r = validateProject(store.getProject());
    validationEl.innerHTML = renderValidation(r);
    const fixBtn = validationEl.querySelector('[data-role="fix"]');
    if (fixBtn) fixBtn.addEventListener('click', (e) =>
      copyText(buildFixPrompt(r.issues.filter((i) => i.severity !== 'info')), e.target));
  });

  /* ---- Simulateur ---- */
  const stage = container.querySelector('[data-role="sim-stage"]');
  const logEl = container.querySelector('[data-role="sim-log"]');
  container.querySelector('[data-role="sim-clear"]').addEventListener('click', () => { logEl.innerHTML = ''; });
  container.querySelector('[data-role="sim-start"]').addEventListener('click', () => {
    logEl.innerHTML = '';
    stage.innerHTML = '';
    mountSimulator(stage, store.getProject(), {
      onCall: (method, detail) => {
        const li = document.createElement('li');
        li.innerHTML = `<code>${escapeHtml(method)}</code> <span class="text-muted">${escapeHtml(detail)}</span>`;
        logEl.appendChild(li);
        logEl.scrollTop = logEl.scrollHeight;
      },
    });
  });

  /* ---- Réglages d'export ---- */
  container.querySelectorAll('input[name="m6-target"]').forEach((r) =>
    r.addEventListener('change', () => store.update('exportSettings.target', r.value, { silent: true })));
  container.querySelector('#m6-resize').addEventListener('change', (e) =>
    store.update('exportSettings.iframeResize', e.target.checked, { silent: true }));
  container.querySelector('#m6-loi25').addEventListener('change', (e) =>
    store.update('exportSettings.loi25Notice', e.target.checked, { silent: true }));

  /* ---- Loi 25 ---- */
  const loi25Out = container.querySelector('[data-role="loi25-out"]');
  container.querySelector('[data-role="loi25"]').addEventListener('click', () => {
    const html = buildIndexHtml(store.getProject());
    const r = analyzeLoi25(html);
    loi25Out.innerHTML = `<div class="alert alert-${r.compliant ? 'success' : 'danger'} py-2 mb-1">
        ${r.compliant ? 'Conforme à la Loi 25 (aucune ressource externe ni collecte détectée).' : 'Points de non-conformité détectés :'}</div>
      <ul class="small mb-0">${r.findings.map((f) => `<li class="text-${SEV[f.level]}">${escapeHtml(f.message)}</li>`).join('')}</ul>`;
  });

  /* ---- Export ---- */
  const exportOut = container.querySelector('[data-role="export-out"]');
  container.querySelector('[data-role="export"]').addEventListener('click', async (e) => {
    const target = container.querySelector('input[name="m6-target"]:checked').value;
    e.target.disabled = true;
    exportOut.innerHTML = '<div class="text-muted small">Construction du paquet…</div>';
    try {
      const { blob, fileName } = await buildExportPackage(store.getProject(), { target });
      downloadBlob(blob, fileName);
      exportOut.innerHTML = `<div class="alert alert-success py-2 mb-0">Paquet généré : <code>${escapeHtml(fileName)}</code> (${Math.round(blob.size / 1024)} Ko).</div>`;
    } catch (err) {
      exportOut.innerHTML = `<div class="alert alert-danger py-2 mb-0">Échec de l’export : ${escapeHtml(err.message)}</div>`;
    } finally {
      e.target.disabled = false;
    }
  });
}

function renderValidation(r) {
  if (!r.issues.length) return '<div class="alert alert-success py-2 mb-0">Aucun problème détecté.</div>';
  const head = `<div class="d-flex align-items-center mb-2">
      <span class="me-2">${r.errors} erreur(s), ${r.warnings} avertissement(s)</span>
      <span class="badge text-bg-${r.ok ? 'success' : 'danger'}">${r.ok ? 'Exportable' : 'À corriger'}</span>
      <button class="btn btn-sm btn-outline-secondary ms-auto" data-role="fix">Copier le prompt de correction</button>
    </div>`;
  const items = r.issues.map((i) => `<li class="text-${SEV[i.severity]}">
      <strong>${i.severity.toUpperCase()}</strong> ${i.slideTitle ? `<em>[${escapeHtml(i.slideTitle)}]</em> ` : ''}${escapeHtml(i.message)}</li>`).join('');
  return head + `<ul class="small mb-0">${items}</ul>`;
}
