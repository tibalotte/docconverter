/**
 * ddimage.js — Glisser-déposer sur image (style Moodle « Drag and drop onto image »).
 *
 * Une image de fond (mediaRef), des zones de dépôt (en %), et des étiquettes
 * portant la zone correcte (ou null = distracteur).
 * Réponse : { zoneId: draggableId }.
 */

import { escapeHtml } from '../../../shared/utils.js';
import { mediaStore } from '../../../core/media-store.js';
import { mountHotspotEditor } from '../hotspot-editor.js';

let _seq = 0;
const did = () => `dz-${Date.now().toString(36)}-${++_seq}`;

export const type = 'ddimage';
export const label = 'Glisser-déposer (image)';

export function createDefault() {
  return {
    type, weight: 1,
    prompt: '<p>Place chaque étiquette sur la bonne zone de l’image.</p>',
    mediaRef: '', zones: [],
    draggables: [{ id: did(), text: 'étiquette 1', zone: null }],
    feedbackByChoice: {}, thoughtSpeaker: null,
  };
}

/** response = { zoneId: draggableId }. */
export function grade(question, response) {
  const resp = response || {};
  const zones = question.zones || [];
  if (!zones.length) return { score: 0, correctness: 'incorrect', messages: [] };
  const byId = new Map(question.draggables.map((d) => [d.id, d]));
  let good = 0;
  for (const z of zones) {
    const d = byId.get(resp[z.id]);
    if (d && d.zone === z.id) good++;
  }
  const score = good / zones.length;
  const correctness = score >= 1 ? 'correct' : score <= 0 ? 'incorrect' : 'partial';
  const messages = score < 1 ? [`${good}/${zones.length} zone(s) correctement remplie(s).`] : [];
  return { score, correctness, messages };
}

export async function renderRuntime(question, host, opts = {}) {
  const resolve = opts.resolveMediaUrl || ((ref) => mediaStore.getUrl(ref));
  const url = question.mediaRef ? await resolve(question.mediaRef) : null;
  host.innerHTML = `<div class="dc-q-prompt mb-2">${question.prompt}</div>
    ${url ? '' : '<div class="alert alert-warning py-2">Image manquante.</div>'}
    <div class="dc-ddimage-stage position-relative d-inline-block border mb-2">
      ${url ? `<img src="${url}" style="display:block;max-width:100%" draggable="false">` : ''}
    </div>
    <div class="dc-ddimage-bank d-flex flex-wrap gap-2 p-2 border rounded bg-light" data-role="bank">
      ${question.draggables.map((d) => `<span class="dc-token badge text-bg-primary" draggable="true" data-id="${d.id}" style="cursor:grab">${escapeHtml(d.text)}</span>`).join('')}
    </div>`;

  const stage = host.querySelector('.dc-ddimage-stage');
  question.zones.forEach((z, i) => {
    const drop = document.createElement('div');
    drop.className = 'dc-dropzone position-absolute border border-secondary';
    drop.dataset.zone = z.id;
    drop.style.cssText = `left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;background:rgba(108,117,125,.12)`;
    drop.innerHTML = `<span class="badge text-bg-secondary position-absolute top-0 start-0">${i + 1}</span>`;
    stage.appendChild(drop);
  });

  const bank = host.querySelector('[data-role="bank"]');
  let dragId = null;
  host.querySelectorAll('.dc-token').forEach((t) => t.addEventListener('dragstart', () => { dragId = t.dataset.id; }));
  [...host.querySelectorAll('.dc-dropzone'), bank].forEach((zone) => {
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const tok = host.querySelector(`.dc-token[data-id="${dragId}"]`);
      if (!tok) return;
      if (zone.classList.contains('dc-dropzone')) {
        const existing = zone.querySelector('.dc-token');
        if (existing) bank.appendChild(existing);
      }
      zone.appendChild(tok);
    });
  });

  return {
    getResponse() {
      const r = {};
      host.querySelectorAll('.dc-dropzone').forEach((z) => {
        const tok = z.querySelector('.dc-token');
        if (tok) r[z.dataset.zone] = tok.dataset.id;
      });
      return r;
    },
  };
}

export function renderEditor(question, host, mutate) {
  host.innerHTML = `
    <div class="row g-2 mb-2">
      <div class="col-md-7">
        <label class="form-label small fw-semibold">Image de fond</label>
        <div data-role="hotspots"></div>
      </div>
      <div class="col-md-5">
        <label class="form-label small fw-semibold">Média (id)</label>
        <select class="form-select form-select-sm mb-2" data-role="media"></select>
        <label class="form-label small fw-semibold">Étiquettes</label>
        <div data-role="drags" class="d-flex flex-column gap-2"></div>
        <button class="btn btn-sm btn-outline-secondary mt-2" data-role="add">+ Étiquette</button>
      </div>
    </div>`;

  // Sélecteur de média (images/formes du projet).
  const mediaSel = host.querySelector('[data-role="media"]');
  import('../../../core/state-store.js').then(({ store }) => {
    const medias = (store.getProject().media || []).filter((m) => m.type === 'image');
    mediaSel.innerHTML = '<option value="">— choisir —</option>' +
      medias.map((m) => `<option value="${m.id}" ${m.id === question.mediaRef ? 'selected' : ''}>${escapeHtml(m.id)}${m.fromShape ? ' (forme)' : ''}</option>`).join('');
  });
  mediaSel.addEventListener('change', (e) =>
    mutate((q) => { q.mediaRef = e.target.value; q.zones = []; }));

  // Éditeur de zones.
  mountHotspotEditor(host.querySelector('[data-role="hotspots"]'), {
    mediaRef: question.mediaRef,
    zones: question.zones,
    onChange: (zones) => mutate((q) => { q.zones = zones; }, false),
  });

  // Étiquettes + zone correcte.
  const dragsEl = host.querySelector('[data-role="drags"]');
  const zoneOptions = (sel) => ['<option value="">distracteur</option>']
    .concat((question.zones || []).map((z, i) => `<option value="${z.id}" ${sel === z.id ? 'selected' : ''}>zone ${i + 1}</option>`)).join('');
  question.draggables.forEach((d) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 align-items-center';
    row.innerHTML = `
      <input class="form-control form-control-sm" value="${escapeHtml(d.text)}" data-role="text" placeholder="Étiquette">
      <select class="form-select form-select-sm" style="max-width:130px" data-role="zone">${zoneOptions(d.zone)}</select>
      <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
    row.querySelector('[data-role="text"]').addEventListener('change', (e) =>
      mutate((q) => { q.draggables.find((x) => x.id === d.id).text = e.target.value; }, false));
    row.querySelector('[data-role="zone"]').addEventListener('change', (e) =>
      mutate((q) => { q.draggables.find((x) => x.id === d.id).zone = e.target.value || null; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((q) => { q.draggables = q.draggables.filter((x) => x.id !== d.id); }));
    dragsEl.appendChild(row);
  });
  host.querySelector('[data-role="add"]').addEventListener('click', () =>
    mutate((q) => { q.draggables.push({ id: did(), text: 'étiquette', zone: null }); }));
}
