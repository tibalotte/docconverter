/**
 * ui.js — Interface du Module 1 (extracteur PPTX).
 *
 * Dropzone + barre de progression slide par slide + récapitulatif et aperçu des
 * slides extraites (titres, notes, blocs, vignettes des images/formes), avec
 * téléchargement du .zip des médias.
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';

export function mountUi(container, api) {
  // Révoque d'éventuels ObjectURL d'un montage précédent.
  mediaStore.releaseAll();

  container.innerHTML = `
    <div class="m1-wrap">
      <h1 class="h4 mb-1">Extracteur PPTX</h1>
      <p class="text-muted">Analyse le fichier <code>.pptx</code> dans le navigateur, slide par slide.
        Extrait textes, tableaux, notes et médias ; les formes sont rastérisées en PNG.
        <span class="text-secondary">Animations, transitions et SmartArt ne sont pas reproduits.</span></p>

      <div class="m1-drop border border-2 border-dashed rounded p-5 text-center bg-light" data-role="drop">
        <p class="mb-2 fw-semibold">Glissez un fichier .pptx ici</p>
        <p class="text-muted small mb-3">ou</p>
        <button class="btn btn-primary" data-role="pick">Choisir un fichier</button>
        <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden data-role="input">
      </div>

      <div class="m1-progress mt-3 d-none" data-role="progress">
        <div class="d-flex justify-content-between small mb-1">
          <span data-role="progress-label">Extraction…</span>
          <span data-role="progress-count"></span>
        </div>
        <div class="progress" role="progressbar" style="height:1.25rem">
          <div class="progress-bar progress-bar-striped progress-bar-animated" data-role="progress-bar" style="width:0%"></div>
        </div>
      </div>

      <div class="m1-results mt-4" data-role="results"></div>
    </div>
  `;

  const dropEl = container.querySelector('[data-role="drop"]');
  const inputEl = container.querySelector('[data-role="input"]');
  const progEl = container.querySelector('[data-role="progress"]');
  const barEl = container.querySelector('[data-role="progress-bar"]');
  const progLabel = container.querySelector('[data-role="progress-label"]');
  const progCount = container.querySelector('[data-role="progress-count"]');
  const resultsEl = container.querySelector('[data-role="results"]');

  container.querySelector('[data-role="pick"]').addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) start(inputEl.files[0]);
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    dropEl.addEventListener(ev, (e) => {
      e.preventDefault();
      dropEl.classList.add('border-primary', 'bg-white');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropEl.addEventListener(ev, (e) => {
      e.preventDefault();
      dropEl.classList.remove('border-primary', 'bg-white');
    })
  );
  dropEl.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) start(f);
  });

  async function start(file) {
    if (!/\.pptx$/i.test(file.name)) {
      alert('Veuillez fournir un fichier .pptx');
      return;
    }
    progEl.classList.remove('d-none');
    resultsEl.innerHTML = '';
    barEl.style.width = '0%';
    progLabel.textContent = 'Lecture du fichier…';
    progCount.textContent = '';

    try {
      await api.extractPptx(file, {
        onProgress: ({ index, total, title }) => {
          const pct = total ? Math.round((index / total) * 100) : 0;
          barEl.style.width = pct + '%';
          progLabel.textContent = `Slide ${index}/${total} — ${title}`;
          progCount.textContent = pct + '%';
        },
      });
      barEl.classList.remove('progress-bar-animated');
      progLabel.textContent = 'Extraction terminée';
      await renderResults();
    } catch (err) {
      console.error(err);
      progEl.classList.add('d-none');
      resultsEl.innerHTML = `<div class="alert alert-danger">Échec de l’extraction : ${escapeHtml(err.message)}</div>`;
    }
  }

  async function renderResults() {
    mediaStore.releaseAll();
    const p = store.getProject();
    if (!p.slides.length) {
      resultsEl.innerHTML = '<p class="text-muted">Aucune slide extraite.</p>';
      return;
    }

    const totalBlocks = p.slides.reduce((n, s) => n + s.blocks.length, 0);
    const header = document.createElement('div');
    header.className = 'd-flex align-items-center gap-3 mb-3';
    header.innerHTML = `
      <div class="alert alert-success mb-0 py-2 flex-grow-1">
        <strong>${p.slides.length}</strong> slide(s), <strong>${totalBlocks}</strong> bloc(s),
        <strong>${p.media.length}</strong> média(s) extraits.
      </div>
      <button class="btn btn-outline-primary" data-role="dl-media" ${p.media.length ? '' : 'disabled'}>
        Télécharger les médias (.zip)
      </button>`;
    resultsEl.appendChild(header);
    header.querySelector('[data-role="dl-media"]').addEventListener('click', () => {
      api.downloadMediaZip().catch((e) => alert(e.message));
    });

    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.id = 'm1-slides';
    resultsEl.appendChild(accordion);

    for (const slide of p.slides) {
      const item = document.createElement('div');
      item.className = 'accordion-item';
      const counts = blockCounts(slide.blocks);
      item.innerHTML = `
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                  data-bs-target="#m1-slide-${slide.index}">
            <span class="badge text-bg-secondary me-2">${slide.index + 1}</span>
            <span class="fw-semibold">${escapeHtml(slide.title)}</span>
            <span class="ms-auto small text-muted">${counts}</span>
          </button>
        </h2>
        <div id="m1-slide-${slide.index}" class="accordion-collapse collapse" data-bs-parent="#m1-slides">
          <div class="accordion-body" data-role="body"></div>
        </div>`;
      accordion.appendChild(item);
      await fillSlideBody(item.querySelector('[data-role="body"]'), slide);
    }
  }

  async function fillSlideBody(bodyEl, slide) {
    // Textes & tableaux.
    for (const b of slide.blocks) {
      if (b.type === 'text') {
        const d = document.createElement('div');
        d.className = 'mb-2 small';
        d.innerHTML = b.content.html;
        bodyEl.appendChild(d);
      } else if (b.type === 'table') {
        bodyEl.appendChild(renderTable(b.content));
      }
    }
    // Vignettes images + formes rastérisées.
    const mediaBlocks = slide.blocks.filter((b) => b.type === 'image' || b.type === 'rasterized');
    if (mediaBlocks.length) {
      const grid = document.createElement('div');
      grid.className = 'd-flex flex-wrap gap-2 mt-2';
      for (const b of mediaBlocks) {
        const url = await mediaStore.getUrl(b.content.mediaRef);
        const fig = document.createElement('figure');
        fig.className = 'm1-thumb border rounded p-1 m-0 text-center';
        fig.innerHTML = `
          <img src="${url || ''}" alt="${escapeHtml(b.content.alt || '')}"
               style="max-width:120px;max-height:90px;object-fit:contain">
          <figcaption class="small text-muted">${b.type === 'rasterized' ? 'forme' : 'image'}</figcaption>`;
        grid.appendChild(fig);
      }
      bodyEl.appendChild(grid);
    }
    // Notes du présentateur.
    if (slide.notes) {
      const n = document.createElement('details');
      n.className = 'mt-2 small';
      n.innerHTML = `<summary class="text-muted">Notes du présentateur</summary>
        <pre class="bg-light p-2 rounded small mb-0" style="white-space:pre-wrap">${escapeHtml(slide.notes)}</pre>`;
      bodyEl.appendChild(n);
    }
  }

  function renderTable(content) {
    const wrap = document.createElement('div');
    wrap.className = 'table-responsive mb-2';
    const rows = content.rows || [];
    const head = content.header && rows.length
      ? `<thead><tr>${rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`
      : '';
    const bodyRows = (content.header ? rows.slice(1) : rows)
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('');
    wrap.innerHTML = `<table class="table table-sm table-bordered small mb-0">${head}<tbody>${bodyRows}</tbody></table>`;
    return wrap;
  }

  function blockCounts(blocks) {
    const c = {};
    for (const b of blocks) c[b.type] = (c[b.type] || 0) + 1;
    const labels = { text: 'texte', table: 'tableau', image: 'image', rasterized: 'forme' };
    return Object.entries(c).map(([k, v]) => `${v} ${labels[k] || k}`).join(' · ') || 'vide';
  }

  // Si un projet est déjà chargé (ouverture .dcproj), affiche-le.
  if (store.getProject().slides.length) renderResults();
}
