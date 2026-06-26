/**
 * block-editor-ui.js — Éditeur de blocs STRUCTURÉ d'une diapositive.
 *
 * Pas de WYSIWYG libre : disposition 1/2/3 colonnes, réorganisation, ajout,
 * suppression et modification des blocs, activation/désactivation des
 * animations CSS, et conservation/suppression des formes rastérisées.
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';
import {
  LAYOUTS, ANIMATIONS, BLOCK_TYPES, CALLOUT_VARIANTS,
  layoutCols, blocksByColumn, normalizeOrders, moveWithinColumn, moveToColumn,
  removeBlock, addBlockToSlide, clampColumns,
} from './block-model.js';

const TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map((t) => [t.value, t.label]));

export function renderSlideEditor(host, slideId, rerender) {
  const slide = store.getProject().slides.find((s) => s.id === slideId);
  host.innerHTML = '';
  if (!slide) {
    host.innerHTML = '<p class="text-muted">Sélectionne une diapositive.</p>';
    return;
  }
  const cols = layoutCols(slide.layout);

  // Mutation : applique fn(slide) puis re-rend.
  const mutate = (fn, normalize = true) => {
    store.mutate((p) => {
      const s = p.slides.find((x) => x.id === slideId);
      fn(s);
      if (normalize) normalizeOrders(s.blocks, layoutCols(s.layout));
    }, 'slides');
    rerender();
  };

  /* ---- Barre de la diapositive ---- */
  const bar = document.createElement('div');
  bar.className = 'd-flex align-items-center gap-2 mb-3 flex-wrap';
  bar.innerHTML = `
    <input class="form-control form-control-sm" style="max-width:320px" value="${escapeHtml(slide.title)}" data-role="title">
    <label class="small text-muted mb-0">Disposition :</label>
    <select class="form-select form-select-sm" style="max-width:160px" data-role="layout">
      ${LAYOUTS.map((l) => `<option value="${l.value}" ${l.value === slide.layout ? 'selected' : ''}>${l.label}</option>`).join('')}
    </select>
    <span class="text-muted small ms-auto">${slide.blocks.length} bloc(s)</span>
  `;
  host.appendChild(bar);
  bar.querySelector('[data-role="title"]').addEventListener('change', (e) =>
    mutate((s) => { s.title = e.target.value; }, false));
  bar.querySelector('[data-role="layout"]').addEventListener('change', (e) =>
    mutate((s) => { s.layout = e.target.value; clampColumns(s, layoutCols(s.layout)); }));

  /* ---- Colonnes ---- */
  const grid = document.createElement('div');
  grid.className = 'row g-3';
  const byCol = blocksByColumn(slide.blocks, cols);
  for (let c = 0; c < cols; c++) {
    const colEl = document.createElement('div');
    colEl.className = cols === 1 ? 'col-12' : cols === 2 ? 'col-md-6' : 'col-md-4';
    colEl.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-1">
        <span class="badge text-bg-light border">Colonne ${c + 1}</span>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" data-add="text" data-col="${c + 1}">+ Texte</button>
          <button class="btn btn-outline-secondary" data-add="callout" data-col="${c + 1}">+ Encadré</button>
        </div>
      </div>`;
    const stack = document.createElement('div');
    stack.className = 'd-flex flex-column gap-2 m3-col-stack';
    colEl.appendChild(stack);
    byCol[c].forEach((block) => stack.appendChild(renderBlockCard(block, slide, cols, mutate)));
    grid.appendChild(colEl);
  }
  host.appendChild(grid);

  grid.querySelectorAll('[data-add]').forEach((btn) =>
    btn.addEventListener('click', () =>
      mutate((s) => addBlockToSlide(s, btn.dataset.add, parseInt(btn.dataset.col, 10), layoutCols(s.layout)), false)));
}

function renderBlockCard(block, slide, cols, mutate) {
  const card = document.createElement('div');
  card.className = 'card m3-block';
  card.innerHTML = `
    <div class="card-header py-1 px-2 d-flex align-items-center gap-1">
      <span class="badge text-bg-secondary">${TYPE_LABEL[block.type] || block.type}</span>
      <div class="btn-group btn-group-sm ms-auto">
        <button class="btn btn-outline-secondary" data-act="up" title="Monter">↑</button>
        <button class="btn btn-outline-secondary" data-act="down" title="Descendre">↓</button>
        ${cols > 1 ? `<button class="btn btn-outline-secondary" data-act="left" title="Colonne précédente" ${block.column <= 1 ? 'disabled' : ''}>←</button>
        <button class="btn btn-outline-secondary" data-act="right" title="Colonne suivante" ${block.column >= cols ? 'disabled' : ''}>→</button>` : ''}
        <button class="btn btn-outline-danger" data-act="del" title="Supprimer">✕</button>
      </div>
    </div>
    <div class="card-body py-2 px-2" data-role="body"></div>
    <div class="card-footer py-1 px-2 d-flex align-items-center gap-2">
      <label class="small text-muted mb-0">Animation</label>
      <select class="form-select form-select-sm" data-role="anim" style="max-width:200px">
        ${ANIMATIONS.map((a) => `<option value="${a.value}" ${a.value === block.animation ? 'selected' : ''}>${a.label}</option>`).join('')}
      </select>
    </div>`;

  fillBlockBody(card.querySelector('[data-role="body"]'), block, mutate);

  const act = (name) => card.querySelector(`[data-act="${name}"]`);
  act('up').addEventListener('click', () => mutate((s) => moveWithinColumn(s.blocks, cols, block.id, -1), false));
  act('down').addEventListener('click', () => mutate((s) => moveWithinColumn(s.blocks, cols, block.id, +1), false));
  if (cols > 1) {
    act('left').addEventListener('click', () => mutate((s) => moveToColumn(s.blocks, cols, block.id, block.column - 1)));
    act('right').addEventListener('click', () => mutate((s) => moveToColumn(s.blocks, cols, block.id, block.column + 1)));
  }
  act('del').addEventListener('click', () => {
    if (confirm('Supprimer ce bloc ?')) mutate((s) => removeBlock(s.blocks, block.id));
  });
  card.querySelector('[data-role="anim"]').addEventListener('change', (e) =>
    mutate((s) => { s.blocks.find((b) => b.id === block.id).animation = e.target.value; }, false));

  return card;
}

function fillBlockBody(body, block, mutate) {
  const setContent = (patch, normalize = false) =>
    mutate((s) => Object.assign(s.blocks.find((b) => b.id === block.id).content, patch), normalize);

  if (block.type === 'text') {
    const ta = textarea(block.content.html || '');
    ta.addEventListener('change', () => setContent({ html: ta.value }));
    body.appendChild(ta);
  } else if (block.type === 'callout') {
    const sel = document.createElement('select');
    sel.className = 'form-select form-select-sm mb-2';
    sel.innerHTML = CALLOUT_VARIANTS.map((v) =>
      `<option value="${v.value}" ${v.value === block.content.variant ? 'selected' : ''}>${v.label}</option>`).join('');
    sel.addEventListener('change', () => setContent({ variant: sel.value }));
    const ta = textarea(block.content.html || '');
    ta.addEventListener('change', () => setContent({ html: ta.value }));
    body.appendChild(sel);
    body.appendChild(ta);
  } else if (block.type === 'image' || block.type === 'rasterized') {
    const wrap = document.createElement('div');
    wrap.className = 'd-flex gap-2 align-items-start';
    const img = document.createElement('img');
    img.style.cssText = 'max-width:120px;max-height:90px;object-fit:contain';
    img.className = 'border rounded';
    img.alt = block.content.alt || '';
    mediaStore.getUrl(block.content.mediaRef).then((u) => { if (u) img.src = u; else img.replaceWith(missingMedia(block.content.mediaRef)); });
    const right = document.createElement('div');
    right.className = 'flex-grow-1';
    const altInput = document.createElement('input');
    altInput.className = 'form-control form-control-sm mb-2';
    altInput.placeholder = 'Texte alternatif (alt)';
    altInput.value = block.content.alt || '';
    altInput.addEventListener('change', () => setContent({ alt: altInput.value }));
    right.appendChild(altInput);
    if (block.type === 'rasterized') {
      const keepWrap = document.createElement('div');
      keepWrap.className = 'form-check form-switch small';
      const cb = document.createElement('input');
      cb.className = 'form-check-input';
      cb.type = 'checkbox';
      cb.checked = block.content.keep !== false;
      cb.id = 'keep-' + block.id;
      cb.addEventListener('change', () => setContent({ keep: cb.checked }));
      const lbl = document.createElement('label');
      lbl.className = 'form-check-label';
      lbl.htmlFor = cb.id;
      lbl.textContent = 'Conserver cette forme';
      keepWrap.appendChild(cb); keepWrap.appendChild(lbl);
      right.appendChild(keepWrap);
      if (block.content.keep === false) img.style.opacity = '.35';
    }
    wrap.appendChild(img); wrap.appendChild(right);
    body.appendChild(wrap);
  } else if (block.type === 'table') {
    body.appendChild(renderTablePreview(block.content));
  } else if (block.type === 'audio') {
    fillAudioBody(body, block, setContent, mutate);
  } else if (block.type === 'media') {
    body.innerHTML = `<span class="small text-muted">Média : <code>${escapeHtml(block.content.mediaRef || '—')}</code> (${escapeHtml(block.content.kind || '?')})</span>`;
  } else {
    body.innerHTML = `<span class="small text-muted">Type « ${escapeHtml(block.type)} » — édité dans un module dédié.</span>`;
  }
}

function fillAudioBody(body, block, setContent, mutate) {
  const slide = store.getProject().slides.find((s) => (s.blocks || []).some((b) => b.id === block.id));
  const questions = (slide && slide.questions) || [];
  const c = block.content;

  body.innerHTML = `
    <label class="form-label small fw-semibold mb-1">Transcription (théorie de l’audio)</label>
    <textarea class="form-control form-control-sm mb-1" rows="4" data-role="transcript"
      placeholder="Texte de l’audio (souvent dans les notes du présentateur)…">${escapeHtml(c.transcript || '')}</textarea>
    <div class="small text-muted mb-2">Minutage automatique (proportionnel à la durée). La phrase courante se surligne pendant la lecture.</div>

    <div class="border-top pt-2">
      <div class="d-flex align-items-center mb-1"><span class="small fw-semibold">Chapitres</span>
        <button class="btn btn-sm btn-outline-secondary ms-auto py-0" data-role="add-chapter">+ Chapitre</button></div>
      <div data-role="chapters" class="d-flex flex-column gap-1"></div>
    </div>

    <div class="border-top pt-2 mt-2">
      <div class="d-flex align-items-center mb-1"><span class="small fw-semibold">Points de contrôle (pause + question)</span>
        <button class="btn btn-sm btn-outline-secondary ms-auto py-0" data-role="add-checkpoint" ${questions.length ? '' : 'disabled'}>+ Point</button></div>
      ${questions.length ? '' : '<div class="small text-muted">Ajoute d’abord des questions à cette diapositive (Module 4) pour créer des points de contrôle.</div>'}
      <div data-role="checkpoints" class="d-flex flex-column gap-1"></div>
    </div>`;

  body.querySelector('[data-role="transcript"]').addEventListener('change', (e) =>
    setContent({ transcript: e.target.value, phrases: [], autoTiming: true }));

  // Chapitres.
  const chaptersEl = body.querySelector('[data-role="chapters"]');
  (c.chapters || []).forEach((ch, i) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-1 align-items-center';
    row.innerHTML = `
      <input class="form-control form-control-sm" value="${escapeHtml(ch.title || '')}" data-role="t" placeholder="Titre du chapitre">
      <input class="form-control form-control-sm" type="number" min="0" step="1" style="max-width:90px" value="${Math.round((ch.start_ms || 0) / 1000)}" data-role="s" title="début (s)">
      <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
    row.querySelector('[data-role="t"]').addEventListener('change', (e) =>
      mutate((s) => { findBlock(s, block.id).content.chapters[i].title = e.target.value; }, false));
    row.querySelector('[data-role="s"]').addEventListener('change', (e) =>
      mutate((s) => { findBlock(s, block.id).content.chapters[i].start_ms = (parseInt(e.target.value, 10) || 0) * 1000; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((s) => { const b = findBlock(s, block.id); b.content.chapters.splice(i, 1); }));
    chaptersEl.appendChild(row);
  });
  body.querySelector('[data-role="add-chapter"]').addEventListener('click', () =>
    mutate((s) => { const b = findBlock(s, block.id); (b.content.chapters = b.content.chapters || []).push({ title: 'Nouvelle section', start_ms: 0 }); }));

  // Points de contrôle.
  const cpEl = body.querySelector('[data-role="checkpoints"]');
  const qOptions = (sel) => questions.map((q, i) =>
    `<option value="${q.id}" ${q.id === sel ? 'selected' : ''}>Q${i + 1} — ${escapeHtml(stripText(q.prompt))}</option>`).join('');
  (c.checkpoints || []).forEach((cp, i) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-1 align-items-center';
    row.innerHTML = `
      <input class="form-control form-control-sm" type="number" min="0" step="1" style="max-width:90px" value="${Math.round((cp.at_ms || 0) / 1000)}" data-role="at" title="à (s)">
      <select class="form-select form-select-sm" data-role="q">${qOptions(cp.questionRef)}</select>
      <button class="btn btn-sm btn-outline-danger" data-role="del">✕</button>`;
    row.querySelector('[data-role="at"]').addEventListener('change', (e) =>
      mutate((s) => { findBlock(s, block.id).content.checkpoints[i].at_ms = (parseInt(e.target.value, 10) || 0) * 1000; }, false));
    row.querySelector('[data-role="q"]').addEventListener('change', (e) =>
      mutate((s) => { findBlock(s, block.id).content.checkpoints[i].questionRef = e.target.value; }, false));
    row.querySelector('[data-role="del"]').addEventListener('click', () =>
      mutate((s) => { findBlock(s, block.id).content.checkpoints.splice(i, 1); }));
    cpEl.appendChild(row);
  });
  const addCp = body.querySelector('[data-role="add-checkpoint"]');
  if (addCp) addCp.addEventListener('click', () =>
    mutate((s) => { const b = findBlock(s, block.id); (b.content.checkpoints = b.content.checkpoints || []).push({ at_ms: 0, questionRef: questions[0] && questions[0].id }); }));
}

function findBlock(slide, blockId) { return slide.blocks.find((b) => b.id === blockId); }
function stripText(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'question'; }

function textarea(value) {
  const ta = document.createElement('textarea');
  ta.className = 'form-control form-control-sm font-monospace';
  ta.rows = 4;
  ta.value = value;
  return ta;
}

function missingMedia(ref) {
  const span = document.createElement('span');
  span.className = 'badge text-bg-warning';
  span.textContent = `média manquant : ${ref || '—'}`;
  return span;
}

function renderTablePreview(content) {
  const wrap = document.createElement('div');
  wrap.className = 'table-responsive';
  const rows = content.rows || [];
  const head = content.header && rows.length
    ? `<thead><tr>${rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>` : '';
  const bodyRows = (content.header ? rows.slice(1) : rows)
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  wrap.innerHTML = `<table class="table table-sm table-bordered small mb-0">${head}<tbody>${bodyRows}</tbody></table>`;
  return wrap;
}
