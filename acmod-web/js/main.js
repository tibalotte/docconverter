// Point d'entrée : câblage de l'interface.
import { h, clear } from './ui/dom.js';
import { nudge } from './ui/nudge.js';
import { renderTyres, renderSuspension, renderSetup, renderBackups, renderDiff, clickCount } from './ui/render.js';
import { checkDataDir, memoryDirFromFiles, MemoryDir, HandleDir, pickDirectory, supportsDirectoryPicker, isSecureContextOk } from './fs-access.js';
import { saveHandle, loadHandle, ensurePermission } from './handle-store.js';
import { Workspace, ValidationError, defFor, SETUP } from './workspace.js';
import { readZip, writeZip } from './zip.js';

const $ = (sel) => document.querySelector(sel);

const app = {
  /** @type {Workspace|null} */ ws: null,
  handle: null,
  fallback: false,
  tab: 'tyres',
  issues: [],
};

// ---------- Utilitaires d'interface ----------

let toastTimer;
function toast(message, { error = false, ms = 4000 } = {}) {
  const t = $('#toast');
  t.textContent = message;
  t.className = `toast${error ? ' error' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function showWelcomeError(message) {
  const el = $('#welcome-error');
  el.textContent = message || '';
  el.hidden = !message;
}

function download(name, bytes, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportFiles(dir, names, label) {
  const files = [];
  for (const name of names) files.push({ name, bytes: await dir.readFile(name) });
  if (files.length === 1) download(files[0].name, files[0].bytes, 'text/plain');
  else if (files.length > 1) download(`${dir.name || 'data'}_${label}.zip`, writeZip(files), 'application/zip');
}

// ---------- Ouverture ----------

async function openDir(dir, { handle = null, fallback = false } = {}) {
  showWelcomeError('');
  const check = await checkDataDir(dir);
  if (!check.ok) {
    showWelcomeError(check.message);
    return;
  }
  const ws = new Workspace(check.dir);
  await ws.load();
  app.ws = ws;
  app.handle = handle;
  app.fallback = fallback;
  $('#welcome').hidden = true;
  $('#editor').hidden = false;
  $('#folder-name').hidden = false;
  $('#folder-name').textContent = `${check.dir.name}/${fallback ? ' (mode de repli, en mémoire)' : ''}`;
  $('#btn-save').textContent = fallback ? 'Enregistrer et télécharger' : 'Enregistrer';
  const notices = clear($('#notices'));
  for (const w of check.warnings) notices.append(h('p', { class: 'notice' }, w));
  if (fallback) notices.append(h('p', { class: 'notice' }, 'Mode de repli : les fichiers enregistrés sont téléchargés ; recopiez-les dans le dossier data de la voiture (gardez une copie des originaux).'));
  renderAll();
}

async function onOpenClick() {
  try {
    const { dir, handle } = await pickDirectory();
    await saveHandle(handle);
    await openDir(dir, { handle });
  } catch (e) {
    if (e?.name === 'AbortError') return;
    showWelcomeError(`Impossible d'ouvrir le dossier : ${e?.message || e}`);
  }
}

async function setupReopen() {
  if (!supportsDirectoryPicker()) return;
  const handle = await loadHandle();
  if (!handle) return;
  const btn = $('#btn-reopen');
  btn.textContent = `Rouvrir « ${handle.name} »`;
  btn.hidden = false;
  btn.onclick = async () => {
    try {
      if (!(await ensurePermission(handle))) {
        showWelcomeError('Autorisation refusée. Utilisez « Ouvrir le dossier data ».');
        return;
      }
      await openDir(new HandleDir(handle), { handle });
    } catch (e) {
      showWelcomeError(`Impossible de rouvrir le dossier : ${e?.message || e}`);
    }
  };
}

async function readInputFiles(input) {
  const out = [];
  for (const f of input.files) {
    out.push({ name: f.name, path: f.webkitRelativePath || f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  input.value = '';
  return out;
}

async function onImportFiles(ev) {
  const files = await readInputFiles(ev.target);
  if (files.length) await openDir(memoryDirFromFiles(files), { fallback: true });
}

async function onImportZip(ev) {
  const [file] = await readInputFiles(ev.target);
  if (!file) return;
  try {
    const entries = await readZip(file.bytes);
    const files = [...entries].map(([path, bytes]) => ({ name: path.split('/').pop(), path, bytes }));
    await openDir(memoryDirFromFiles(files), { fallback: true });
  } catch (e) {
    showWelcomeError(`Zip illisible : ${e.message}`);
  }
}

// ---------- Rendu ----------

function renderAll() {
  const ws = app.ws;
  for (const [id, fn] of [['tyres', renderTyres], ['suspension', renderSuspension], ['setup', renderSetup]]) {
    fn(ws, clear($(`#panel-${id}`)));
  }
  renderBackupsTab();
  refresh();
}

async function renderBackupsTab() {
  const panel = clear($('#panel-backups'));
  renderBackups(await app.ws.backups(), panel, onRestoreBackup);
}

function inputs() {
  return document.querySelectorAll('#editor input.val[data-key]');
}

/** Met à jour classes, messages, boutons sans reconstruire les tableaux (garde le focus). */
function refresh() {
  const ws = app.ws;
  app.issues = ws.validate();
  const byField = new Map();
  for (const i of app.issues) {
    const k = `${i.file}|${i.section}|${i.key}`;
    byField.set(k, [...(byField.get(k) || []), i]);
  }
  for (const el of inputs()) {
    const { file, section, key } = el.dataset;
    const list = byField.get(`${file}|${section}|${key}`) || [];
    el.classList.toggle('edited', ws.isEdited(file, section, key));
    el.classList.toggle('modified', !ws.isEdited(file, section, key) && ws.isModifiedFromOriginal(file, section, key));
    el.classList.toggle('error', list.some((i) => i.level === 'error'));
    el.classList.toggle('warning', !list.some((i) => i.level === 'error') && list.some((i) => i.level === 'warning'));
    el.setAttribute('aria-invalid', String(list.some((i) => i.level === 'error')));
  }
  for (const td of document.querySelectorAll('[data-clicks]')) td.textContent = String(clickCount(ws, td.dataset.clicks));

  const box = clear($('#issues'));
  box.hidden = !app.issues.length;
  if (app.issues.length) {
    const errors = app.issues.filter((i) => i.level === 'error').length;
    box.append(h('strong', {}, errors ? `${errors} erreur(s) : l'enregistrement est bloqué` : 'Avertissements (l\'enregistrement reste possible)'));
    box.append(h('ul', {}, app.issues.map((i) => h('li', { class: i.level },
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); focusField(i); } }, `${i.file} [${i.section}] ${i.key}`),
      ` : ${i.message}`))));
  }
  const dirty = ws.hasUnsavedChanges();
  $('#dirty').hidden = !dirty;
  $('#btn-save').disabled = !dirty;
  $('#btn-revert').disabled = !dirty;
  document.title = `${dirty ? '● ' : ''}acmod-web : pneus et suspensions`;
}

function focusField({ file, section, key }) {
  const el = [...inputs()].find((i) => i.dataset.file === file && i.dataset.section === section && i.dataset.key === key);
  if (!el) return;
  const panel = el.closest('.panel');
  selectTab(panel.id.replace('panel-', ''));
  el.closest('details')?.setAttribute('open', '');
  el.focus();
  el.select();
}

function selectTab(tab) {
  app.tab = tab;
  for (const b of document.querySelectorAll('.tabs [role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `panel-${tab}`;
}

// ---------- Saisie ----------

function onInput(ev) {
  const el = ev.target;
  if (!el.matches?.('input.val[data-key]')) return;
  const { file, section, key } = el.dataset;
  app.ws.setValue(file, section, key, el.value);
  refresh();
}

function onKeyDown(ev) {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    if (app.ws?.hasUnsavedChanges()) onSave();
    return;
  }
  const el = ev.target;
  if (!el.matches?.('input.val[data-key]') || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  const { file, section, key } = el.dataset;
  const def = defFor(file, section, key);
  if (!def || def.kind === 'text') return;
  let step = Number(el.dataset.step);
  if (!Number.isFinite(step) || step <= 0) step = file === SETUP ? Number(app.ws.value(SETUP, section, 'STEP')) || 1 : 1;
  if (ev.shiftKey) step *= 10;
  if (ev.altKey) step /= 10;
  const next = nudge(el.value, step, ev.key === 'ArrowUp' ? 1 : -1);
  if (next === null) return;
  ev.preventDefault();
  el.value = next;
  app.ws.setValue(file, section, key, next);
  refresh();
}

// ---------- Actions ----------

async function ensureWritable() {
  if (app.fallback || !app.handle) return true;
  if (await ensurePermission(app.handle)) return true;
  toast('Autorisation d\'écriture refusée par le navigateur.', { error: true });
  return false;
}

async function onSave() {
  const ws = app.ws;
  if (!(await ensureWritable())) return;
  try {
    const res = await ws.save();
    if (app.fallback && res.written.length) await exportFiles(ws.dir, res.written, 'modifie');
    toast(`Enregistré : ${res.written.join(', ')}. Sauvegarde : .acmod_backup/${res.backupId}/`);
  } catch (e) {
    if (e instanceof ValidationError) {
      toast(`${e.issues.length} erreur(s) : corrigez les champs en rouge avant d'enregistrer.`, { error: true });
      focusField(e.issues[0]);
    } else {
      toast(`Échec de l'enregistrement : ${e.message}`, { error: true, ms: 10000 });
    }
  }
  refresh();
  renderBackupsTab();
}

function onRevert() {
  if (!confirm('Annuler toutes les modifications non enregistrées ?')) return;
  app.ws.revert();
  renderAll();
}

async function onRestoreOriginal() {
  const ws = app.ws;
  const backups = await ws.backups();
  if (!backups.length) {
    if (ws.hasUnsavedChanges()) onRevert();
    else toast('Aucune sauvegarde : les fichiers n\'ont jamais été modifiés par l\'outil.');
    return;
  }
  if (!confirm('Remettre les fichiers dans leur état d\'origine (plus ancienne sauvegarde) ?\nL\'état actuel sera sauvegardé avant, et les modifications non enregistrées seront perdues.')) return;
  if (!(await ensureWritable())) return;
  try {
    const res = await ws.restoreOriginal();
    if (app.fallback) await exportFiles(ws.dir, res.restored, 'original');
    toast(`Original restauré : ${res.restored.join(', ')}.`);
  } catch (e) {
    toast(`Échec de la restauration : ${e.message}`, { error: true, ms: 10000 });
  }
  renderAll();
}

async function onRestoreBackup(backup) {
  if (!confirm(`Restaurer la sauvegarde du ${new Date(backup.created).toLocaleString()} (${backup.files.join(', ')}) ?\nL'état actuel sera sauvegardé avant.`)) return;
  if (!(await ensureWritable())) return;
  try {
    const res = await app.ws.restoreBackup(backup.id);
    if (app.fallback) await exportFiles(app.ws.dir, res.restored, 'restaure');
    toast(`Sauvegarde restaurée : ${res.restored.join(', ')}.`);
  } catch (e) {
    toast(`Échec de la restauration : ${e.message}`, { error: true, ms: 10000 });
  }
  renderAll();
}

function onDiff() {
  renderDiff(app.ws, clear($('#diff-body')));
  $('#diff-dialog').showModal();
}

function onClose() {
  if (app.ws?.hasUnsavedChanges() && !confirm('Des modifications ne sont pas enregistrées. Changer de dossier quand même ?')) return;
  app.ws = null;
  $('#editor').hidden = true;
  $('#welcome').hidden = false;
  $('#folder-name').hidden = true;
  $('#dirty').hidden = true;
  setupReopen();
}

// ---------- Initialisation ----------

function init() {
  const compat = $('#compat');
  if (!supportsDirectoryPicker()) {
    compat.textContent = 'Ce navigateur ne permet pas d\'écrire directement dans un dossier (Chrome, Edge ou Opera le permettent). Utilisez le mode de repli ci-dessous.';
    compat.classList.add('bad');
    $('#btn-open').disabled = true;
    $('#fallback').open = true;
  } else if (!isSecureContextOk()) {
    compat.textContent = 'Page non sécurisée : ouvrez-la via https:// ou http://localhost (ex. « python -m http.server »).';
    compat.classList.add('bad');
  } else {
    compat.textContent = 'Navigateur compatible : lecture et écriture directes dans le dossier choisi.';
  }
  $('#btn-open').addEventListener('click', onOpenClick);
  $('#in-folder').addEventListener('change', onImportFiles);
  $('#in-files').addEventListener('change', onImportFiles);
  $('#in-zip').addEventListener('change', onImportZip);
  $('#btn-save').addEventListener('click', onSave);
  $('#btn-revert').addEventListener('click', onRevert);
  $('#btn-restore').addEventListener('click', onRestoreOriginal);
  $('#btn-diff').addEventListener('click', onDiff);
  $('#btn-close').addEventListener('click', onClose);
  for (const b of document.querySelectorAll('.tabs [role=tab]')) b.addEventListener('click', () => selectTab(b.dataset.tab));
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('beforeunload', (e) => {
    if (app.ws?.hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; }
  });
  setupReopen();
}

// Exposé pour les tests de bout en bout (navigateur automatisé).
globalThis.__acmod = { app, openDir, MemoryDir };

init();
