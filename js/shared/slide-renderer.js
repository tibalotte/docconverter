/**
 * slide-renderer.js — Rendu d'une diapositive en « vue apprenant ».
 *
 * Produit le HTML/Bootstrap d'une slide à partir de ses blocs (contrat dc-*).
 * Partagé par l'aperçu de navigation (Module 5) et l'export (Module 6).
 *
 * Découplage :
 *  - opts.resolveMediaUrl(mediaRef) -> Promise<string|null> : source d'un média
 *    (ObjectURL en aperçu, chemin relatif à l'export).
 *  - opts.renderQuestion(question, host, { onScore }) : délégué au Module 4
 *    (injecté par l'appelant pour ne pas coupler ce module aux questions).
 */

import { escapeHtml } from './utils.js';
import { layoutCols, blocksByColumn } from '../modules/m3-block-editor/block-model.js';

function colClass(cols) {
  return cols === 1 ? 'col-12' : cols === 2 ? 'col-md-6' : 'col-md-4';
}

function animClass(block) {
  return block.animation && block.animation !== 'none' ? ' dc-anim-' + block.animation : '';
}

const CALLOUT_CLASS = { info: 'alert-info', warning: 'alert-warning', tip: 'alert-success' };

async function renderBlock(block, slide, opts) {
  const el = document.createElement('div');
  el.className = 'dc-block' + animClass(block);
  el.setAttribute('data-dc-type', block.type);
  if (block.animation && block.animation !== 'none') el.setAttribute('data-dc-anim', block.animation);

  const c = block.content || {};
  if (block.type === 'text') {
    el.innerHTML = c.html || '';
  } else if (block.type === 'callout') {
    el.innerHTML = `<div class="alert ${CALLOUT_CLASS[c.variant] || 'alert-info'}" role="note">${c.html || ''}</div>`;
  } else if (block.type === 'image' || block.type === 'rasterized') {
    if (block.type === 'rasterized' && c.keep === false) return null; // forme supprimée
    el.setAttribute('data-dc-media', c.mediaRef || '');
    const url = opts.resolveMediaUrl ? await opts.resolveMediaUrl(c.mediaRef) : null;
    el.innerHTML = `<img class="img-fluid" alt="${escapeHtml(c.alt || '')}" data-dc-media="${escapeHtml(c.mediaRef || '')}"${url ? ` src="${url}"` : ''}>`;
  } else if (block.type === 'media') {
    const url = opts.resolveMediaUrl ? await opts.resolveMediaUrl(c.mediaRef) : null;
    const tag = c.kind === 'video' ? 'video' : 'audio';
    el.setAttribute('data-dc-media', c.mediaRef || '');
    el.innerHTML = `<${tag} controls class="w-100" data-dc-media="${escapeHtml(c.mediaRef || '')}"${url ? ` src="${url}"` : ''}></${tag}>`;
  } else if (block.type === 'table') {
    el.innerHTML = renderTableHtml(c);
  } else if (block.type === 'question') {
    const q = (slide.questions || []).find((x) => x.id === c.questionRef);
    const host = document.createElement('div');
    el.appendChild(host);
    if (q && opts.renderQuestion) {
      await opts.renderQuestion(q, host, { onScore: opts.onScore });
    } else if (q) {
      host.innerHTML = `<div class="border rounded p-2 small text-muted">Question : ${escapeHtml(q.type)}</div>`;
    }
  }
  return el;
}

function renderTableHtml(content) {
  const rows = content.rows || [];
  const head = content.header && rows.length
    ? `<thead><tr>${rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>` : '';
  const body = (content.header ? rows.slice(1) : rows)
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-responsive"><table class="table table-bordered">${head}<tbody>${body}</tbody></table></div>`;
}

/**
 * Construit la <section> d'une diapositive.
 * @returns {Promise<HTMLElement>}
 */
export async function renderSlideElement(slide, opts = {}) {
  const cols = layoutCols(slide.layout);
  const section = document.createElement('section');
  section.className = 'dc-slide';
  section.setAttribute('data-dc-step', slide.stepId || '');
  section.setAttribute('data-dc-layout', slide.layout || 'one-column');

  const h = document.createElement('h2');
  h.className = 'dc-slide-title';
  h.textContent = slide.title || '';
  section.appendChild(h);

  const row = document.createElement('div');
  row.className = 'row g-4';
  const byCol = blocksByColumn(slide.blocks || [], cols);
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = colClass(cols) + ' dc-col';
    col.setAttribute('data-dc-col', String(c + 1));
    for (const block of byCol[c]) {
      const el = await renderBlock(block, slide, opts);
      if (el) col.appendChild(el);
    }
    row.appendChild(col);
  }
  section.appendChild(row);
  return section;
}
