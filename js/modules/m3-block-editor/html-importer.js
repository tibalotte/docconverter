/**
 * html-importer.js — Importation du HTML retourné par le LLM (contrat dc-*).
 *
 * Parse les <section class="dc-slide"> en blocs structurés (cf.
 * docs/contrat-html-llm.md), nettoie le HTML (retrait des <script> et
 * attributs dangereux) et fusionne avec les slides existantes par data-dc-step.
 * Les médias sont reliés par data-dc-media (le binaire reste dans IndexedDB).
 */

import { store } from '../../core/state-store.js';
import { newBlockId, layoutCols, normalizeOrders } from './block-model.js';

const domParser = new DOMParser();

/** Nettoie un fragment HTML : retire script/style/iframe et attributs à risque. */
function sanitizeFragment(html) {
  const doc = domParser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && val.startsWith('javascript:')) el.removeAttribute(attr.name);
    }
  });
  return root.innerHTML.trim();
}

function calloutVariant(el) {
  const cls = (el.querySelector('.alert') || el).className || '';
  if (/alert-warning|alert-danger/.test(cls)) return 'warning';
  if (/alert-success/.test(cls)) return 'tip';
  return 'info';
}

function parseTable(tableEl) {
  const rows = [];
  let header = false;
  const thead = tableEl.querySelector('thead');
  if (thead) {
    header = true;
    for (const tr of thead.querySelectorAll('tr')) {
      rows.push([...tr.children].map((c) => c.textContent.trim()));
    }
  }
  const bodyRows = tableEl.querySelectorAll('tbody tr').length
    ? tableEl.querySelectorAll('tbody tr')
    : tableEl.querySelectorAll('tr');
  for (const tr of bodyRows) {
    if (thead && tr.closest('thead')) continue;
    rows.push([...tr.children].map((c) => c.textContent.trim()));
  }
  return { rows, header };
}

/** Détermine le type d'un bloc à partir de data-dc-type ou de son contenu. */
function inferType(blockEl) {
  const explicit = blockEl.getAttribute('data-dc-type');
  if (explicit) return explicit;
  if (blockEl.querySelector('table')) return 'table';
  if (blockEl.querySelector('audio,video')) return 'media';
  if (blockEl.querySelector('img')) return 'image';
  if (blockEl.querySelector('.alert')) return 'callout';
  return 'text';
}

/** Construit un bloc à partir d'un élément .dc-block. */
function parseBlock(blockEl, column) {
  const type = inferType(blockEl);
  const animation = blockEl.getAttribute('data-dc-anim') || 'none';
  const block = { id: newBlockId(), type, column, order: 0, animation, content: {} };

  if (type === 'image' || type === 'rasterized') {
    const img = blockEl.querySelector('img');
    const mediaRef = blockEl.getAttribute('data-dc-media')
      || (img && img.getAttribute('data-dc-media')) || '';
    block.content = { mediaRef, alt: (img && img.getAttribute('alt')) || '', keep: true };
  } else if (type === 'media') {
    const m = blockEl.querySelector('audio,video');
    block.content = {
      mediaRef: blockEl.getAttribute('data-dc-media') || (m && m.getAttribute('data-dc-media')) || '',
      kind: m && m.tagName.toLowerCase() === 'video' ? 'video' : 'audio',
      controls: true,
    };
  } else if (type === 'table') {
    const tbl = blockEl.querySelector('table');
    block.content = tbl ? parseTable(tbl) : { rows: [], header: false };
  } else if (type === 'callout') {
    const alert = blockEl.querySelector('.alert') || blockEl;
    block.content = { variant: calloutVariant(blockEl), html: sanitizeFragment(alert.innerHTML) };
  } else {
    block.content = { html: sanitizeFragment(blockEl.innerHTML) };
  }
  return block;
}

/** Parse une <section class="dc-slide"> en {stepId, title, layout, blocks}. */
function parseSection(section, fallbackIndex) {
  const stepId = section.getAttribute('data-dc-step') || '';
  const layout = section.getAttribute('data-dc-layout') || 'one-column';
  const titleEl = section.querySelector('.dc-slide-title') || section.querySelector('h1,h2,h3');
  const title = titleEl ? titleEl.textContent.trim() : `Diapositive ${fallbackIndex + 1}`;
  const cols = layoutCols(layout);

  const blocks = [];
  const colEls = section.querySelectorAll('.dc-col');
  if (colEls.length) {
    colEls.forEach((colEl, idx) => {
      const colNum = parseInt(colEl.getAttribute('data-dc-col'), 10) || (idx + 1);
      colEl.querySelectorAll(':scope .dc-block').forEach((b) => blocks.push(parseBlock(b, Math.min(colNum, cols))));
    });
  } else {
    // Repli : pas de colonnes balisées → tout en colonne 1.
    section.querySelectorAll('.dc-block').forEach((b) => blocks.push(parseBlock(b, 1)));
  }
  normalizeOrders(blocks, cols);
  return { stepId, title, layout, blocks };
}

/**
 * Parse un document HTML complet ou un fragment → liste de slides parsées.
 * @returns {{ parsed: Array, sections: number }}
 */
export function parseHtml(html) {
  const doc = domParser.parseFromString(html, 'text/html');
  const sections = [...doc.querySelectorAll('section.dc-slide')];
  const parsed = sections.map((s, i) => parseSection(s, i));
  return { parsed, sections: sections.length };
}

/**
 * Importe le HTML dans le projet.
 * @param {string} html
 * @param {{ mode?: 'merge'|'replace' }} opts
 *   - 'merge' (défaut) : fusionne par data-dc-step avec les slides existantes
 *     (préserve notes, rasterizedShapes, médias) ; sections inconnues ajoutées.
 *   - 'replace' : remplace l'ensemble des slides.
 * @returns {{ matched:number, added:number, replaced:boolean, missingMedia:string[], total:number, sections:number }}
 */
export function importHtmlToProject(html, { mode = 'merge' } = {}) {
  const { parsed, sections } = parseHtml(html);
  if (!sections) {
    return { matched: 0, added: 0, replaced: false, missingMedia: [], total: 0, sections: 0,
      error: 'Aucune <section class="dc-slide"> trouvée. Vérifie le contrat HTML.' };
  }

  const project = store.getProject();
  const mediaIds = new Set((project.media || []).map((m) => m.id));
  const missingMedia = new Set();
  const collectMissing = (slide) => {
    for (const b of slide.blocks) {
      const ref = b.content && b.content.mediaRef;
      if (ref && !mediaIds.has(ref)) missingMedia.add(ref);
    }
  };

  let matched = 0, added = 0, replaced = false;

  store.mutate((p) => {
    if (mode === 'replace') {
      replaced = true;
      p.slides = parsed.map((ps, i) => buildSlide(ps, i, null));
      p.slides.forEach(collectMissing);
      return;
    }
    const byStep = new Map(p.slides.map((s) => [s.stepId, s]));
    parsed.forEach((ps, i) => {
      const existing = ps.stepId && byStep.get(ps.stepId);
      if (existing) {
        existing.title = ps.title || existing.title;
        existing.layout = ps.layout;
        existing.blocks = ps.blocks;
        matched++;
        collectMissing(existing);
      } else {
        const slide = buildSlide(ps, p.slides.length, null);
        p.slides.push(slide);
        added++;
        collectMissing(slide);
      }
    });
    p.slides.sort((a, b) => a.index - b.index);
  }, 'slides');

  return {
    matched, added, replaced,
    missingMedia: [...missingMedia],
    total: parsed.length, sections,
  };
}

function buildSlide(parsedSlide, index, _existing) {
  return {
    id: `slide-${index + 1}`,
    index,
    title: parsedSlide.title,
    notes: '',
    layout: parsedSlide.layout,
    blocks: parsedSlide.blocks,
    questions: [],
    rasterizedShapes: [],
    stepId: parsedSlide.stepId || `step-${index + 1}`,
  };
}
