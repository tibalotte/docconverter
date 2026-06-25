/**
 * app-shell.js — Coquille de l'application d'authoring.
 *
 * Gère l'enregistrement des modules et la navigation entre eux. La coquille ne
 * connaît rien de l'implémentation d'un module : elle utilise son contrat.
 *
 * Contrat d'un module :
 *   {
 *     id: string,
 *     label: string,            // libellé d'onglet
 *     order: number,            // ordre d'affichage
 *     enabled?: () => boolean,  // onglet actif ou grisé (déps amont)
 *     mount(container): void,   // rend le module dans `container`
 *     unmount?(): void          // nettoyage (révocation ObjectURL, etc.)
 *   }
 */

import { bus } from './event-bus.js';
import { saveProject, loadProjectArchive } from './persistence.js';

class AppShell {
  constructor() {
    /** @type {Map<string, object>} */
    this._modules = new Map();
    this._activeId = null;
    this._navEl = null;
    this._contentEl = null;
  }

  register(module) {
    this._modules.set(module.id, module);
    return this;
  }

  _sorted() {
    return [...this._modules.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  start(rootSelector) {
    const root = document.querySelector(rootSelector);
    root.innerHTML = '';
    root.appendChild(this._renderTopbar());

    const layout = document.createElement('div');
    layout.className = 'd-flex flex-grow-1 overflow-hidden';

    this._navEl = document.createElement('nav');
    this._navEl.className = 'app-nav border-end bg-light flex-shrink-0 p-2';
    layout.appendChild(this._navEl);

    this._contentEl = document.createElement('main');
    this._contentEl.className = 'app-content flex-grow-1 overflow-auto p-3';
    layout.appendChild(this._contentEl);

    root.appendChild(layout);

    this._renderNav();
    // Revalide l'état des onglets quand le projet change (déps amont).
    bus.on('project:changed', () => this._renderNav());

    const first = this._sorted()[0];
    if (first) this.activate(first.id);
  }

  _renderTopbar() {
    const bar = document.createElement('header');
    bar.className = 'app-topbar d-flex align-items-center gap-2 px-3 py-2 border-bottom';
    bar.innerHTML = `
      <span class="navbar-brand fw-bold mb-0">DocConverter</span>
      <span class="text-muted small flex-grow-1">Authoring pédagogique FP — Québec</span>
      <button class="btn btn-sm btn-outline-secondary" data-action="open">Ouvrir .dcproj</button>
      <button class="btn btn-sm btn-primary" data-action="save">Enregistrer .dcproj</button>
      <input type="file" accept=".dcproj,application/zip" hidden data-role="open-input">
    `;
    bar.querySelector('[data-action="save"]').addEventListener('click', () => {
      saveProject().catch((e) => alert('Échec de l’enregistrement : ' + e.message));
    });
    const fileInput = bar.querySelector('[data-role="open-input"]');
    bar.querySelector('[data-action="open"]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      try {
        await loadProjectArchive(fileInput.files[0]);
        this._renderNav();
        if (this._activeId) this.activate(this._activeId, true);
      } catch (e) {
        alert('Ouverture impossible : ' + e.message);
      } finally {
        fileInput.value = '';
      }
    });
    return bar;
  }

  _renderNav() {
    if (!this._navEl) return;
    this._navEl.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'nav flex-column nav-pills gap-1';
    for (const mod of this._sorted()) {
      const enabled = mod.enabled ? mod.enabled() : true;
      const btn = document.createElement('button');
      btn.className = 'nav-link text-start' +
        (mod.id === this._activeId ? ' active' : '') +
        (enabled ? '' : ' disabled');
      btn.textContent = mod.label;
      btn.disabled = !enabled;
      btn.addEventListener('click', () => this.activate(mod.id));
      list.appendChild(btn);
    }
    this._navEl.appendChild(list);
  }

  activate(id, force = false) {
    if (!force && id === this._activeId) return;
    const mod = this._modules.get(id);
    if (!mod) return;

    const prev = this._modules.get(this._activeId);
    if (prev && prev.unmount) {
      try { prev.unmount(); } catch (e) { console.error(e); }
    }

    this._activeId = id;
    this._contentEl.innerHTML = '';
    this._renderNav();
    mod.mount(this._contentEl);
  }
}

export const shell = new AppShell();
