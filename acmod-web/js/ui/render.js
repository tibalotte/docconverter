// Rendu des onglets. Chaque champ éditable est un <input> portant
// data-file / data-section / data-key ; main.js gère les événements.
import { h } from './dom.js';
import { TYRE_PARAMS, THERMAL_PARAMS, SUSPENSION_PARAMS, ARB_PARAMS, BASIC_PARAMS, SETUP_RANGE_PARAMS } from '../params.js';
import { TYRES, SUSP, SETUP } from '../workspace.js';
import { compactDiff } from '../diff.js';

function labelCell(def) {
  return h('td', { class: 'label' },
    h('span', { title: def.desc }, def.label),
    h('span', { class: 'key' }, def.key));
}

/** Champ de saisie pour (fichier, section, clé) ; tiret si la clé n'existe pas. */
export function field(ws, file, section, def, { readonly = false } = {}) {
  if (!section) return h('td', { class: 'missing' }, '—');
  const value = ws.value(file, section, def.key);
  if (value === undefined) return h('td', { class: 'missing', title: 'Absent du fichier' }, '—');
  const ro = readonly || def.readonly;
  const original = ws.originalValue(file, section, def.key);
  return h('td', {},
    h('input', {
      class: 'val',
      type: 'text',
      inputmode: def.kind === 'text' ? 'text' : 'decimal',
      spellcheck: 'false',
      autocomplete: 'off',
      value,
      readonly: ro,
      tabindex: ro ? '-1' : undefined,
      'aria-label': `${def.label} [${section}]`,
      title: `${def.desc}${original !== undefined ? `\nOriginal : ${original}` : ''}${ro ? '\n(lecture seule)' : ''}`,
      dataset: ro ? undefined : { file, section, key: def.key, step: def.step ?? '' },
    }));
}

function sideBySide(ws, file, defs, left, right, { headers = ['Avant', 'Arrière'], readonly = false } = {}) {
  const rows = defs
    .filter((d) => (left && ws.value(file, left, d.key) !== undefined) || (right && ws.value(file, right, d.key) !== undefined))
    .map((d) => h('tr', {},
      labelCell(d),
      field(ws, file, left, d, { readonly }),
      field(ws, file, right, d, { readonly }),
      h('td', { class: 'unit' }, d.unit || '')));
  if (!rows.length) return h('p', { class: 'missing' }, 'Aucun paramètre reconnu.');
  return h('table', { class: 'params' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Paramètre'), h('th', {}, headers[0]), h('th', {}, headers[1]), h('th', {}, 'Unité'))),
    h('tbody', {}, rows));
}

export function renderTyres(ws, panel) {
  const m = ws.models().tyres;
  if (!m) return panel.append(h('p', {}, 'tyres.ini absent.'));
  panel.append(h('p', { class: 'missing' },
    `${m.compounds.length} composé(s) détecté(s). Les courbes .lut (usure, température) sont affichées pour information.`));
  for (const c of m.compounds) {
    panel.append(h('section', { class: 'card' },
      h('h3', {}, `Composé ${c.index} : ${c.name}`, c.shortName ? ` (${c.shortName})` : '',
        c.index === m.defaultIndex ? h('span', { class: 'tag' }, 'par défaut') : null,
        h('span', { class: 'key' }, `[${c.front ?? '—'}] [${c.rear ?? '—'}]`)),
      sideBySide(ws, TYRES, TYRE_PARAMS, c.front, c.rear),
      (c.thermalFront || c.thermalRear)
        ? h('details', { class: 'sub' },
          h('summary', {}, `Modèle thermique [${c.thermalFront ?? '—'}] [${c.thermalRear ?? '—'}]`),
          sideBySide(ws, TYRES, THERMAL_PARAMS, c.thermalFront, c.thermalRear))
        : null));
  }
}

export function renderSuspension(ws, panel) {
  const m = ws.models().suspension;
  if (!m) return panel.append(h('p', {}, 'suspensions.ini absent.'));
  if (m.basic) {
    panel.append(h('section', { class: 'card' }, h('h3', {}, 'Châssis (lecture seule)'),
      h('table', { class: 'params' }, h('tbody', {}, BASIC_PARAMS.filter((d) => m.basic.values[d.key] !== undefined)
        .map((d) => h('tr', {}, labelCell(d), field(ws, SUSP, 'BASIC', d, { readonly: true }), h('td', { class: 'unit' }, d.unit || '')))))));
  }
  if (m.arb) {
    panel.append(h('section', { class: 'card' }, h('h3', {}, 'Barres antiroulis [ARB]'),
      h('table', { class: 'params' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Paramètre'), h('th', {}, 'Valeur'), h('th', {}, 'Unité'))),
        h('tbody', {}, ARB_PARAMS.filter((d) => m.arb.values[d.key] !== undefined)
          .map((d) => h('tr', {}, labelCell(d), field(ws, SUSP, 'ARB', d), h('td', { class: 'unit' }, d.unit || '')))))));
  }
  panel.append(h('section', { class: 'card' }, h('h3', {}, 'Suspensions [FRONT] / [REAR]'),
    sideBySide(ws, SUSP, SUSPENSION_PARAMS, m.front && 'FRONT', m.rear && 'REAR')));

  const keys = [...new Set([...Object.keys(m.geometry.FRONT), ...Object.keys(m.geometry.REAR)])];
  if (keys.length) {
    panel.append(h('details', { class: 'card sub' },
      h('summary', {}, `Géométrie : ${keys.length} point(s), avancé, lecture seule en V1`),
      h('table', { class: 'params' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Point'), h('th', {}, 'Avant (x, y, z)'), h('th', {}, 'Arrière (x, y, z)'))),
        h('tbody', {}, keys.map((k) => h('tr', {},
          h('td', { class: 'mono' }, k),
          h('td', { class: 'mono' }, m.geometry.FRONT[k] ?? '—'),
          h('td', { class: 'mono' }, m.geometry.REAR[k] ?? '—')))))));
  }
}

export function clickCount(ws, section) {
  const n = (k) => Number(ws.value(SETUP, section, k));
  const c = (n('MAX') - n('MIN')) / n('STEP');
  return Number.isFinite(c) && c >= 0 ? Math.round(c * 1000) / 1000 + 1 : '—';
}

export function renderSetup(ws, panel) {
  const m = ws.models().setup;
  if (!m || !m.items.length) return panel.append(h('p', {}, 'setup.ini absent ou sans réglage à plage.'));
  panel.append(h('p', { class: 'missing' },
    'Plages proposées au joueur dans l\'écran de réglages. Les valeurs sont dans les unités du réglage (souvent en « crans » ou en dixièmes de degré, selon SHOW_CLICKS).'));
  const byTab = new Map();
  for (const it of m.items) byTab.set(it.tab || '—', [...(byTab.get(it.tab || '—') || []), it]);
  const [MIN, MAX, STEP] = SETUP_RANGE_PARAMS;
  for (const [tab, items] of byTab) {
    panel.append(h('section', { class: 'card' }, h('h3', {}, `Onglet ${tab}`),
      h('table', { class: 'params' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Réglage'), h('th', {}, 'Min'), h('th', {}, 'Max'), h('th', {}, 'Pas'), h('th', {}, 'Crans'))),
        h('tbody', {}, items.map((it) => h('tr', {},
          h('td', { class: 'label' }, it.name, h('span', { class: 'key' }, `[${it.section}]`)),
          field(ws, SETUP, it.section, MIN),
          field(ws, SETUP, it.section, MAX),
          field(ws, SETUP, it.section, STEP),
          h('td', { class: 'num', dataset: { clicks: it.section } }, String(clickCount(ws, it.section)))))))));
  }
}

export function renderBackups(backups, panel, onRestore) {
  if (!backups.length) {
    panel.append(h('p', {}, 'Aucune sauvegarde pour l\'instant. Une sauvegarde est créée automatiquement avant le premier enregistrement, dans le sous-dossier .acmod_backup/.'));
    return;
  }
  panel.append(h('p', { class: 'missing' }, 'La plus ancienne sauvegarde contient les fichiers d\'origine. Restaurer sauvegarde d\'abord l\'état actuel.'));
  panel.append(h('table', { class: 'params' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Motif'), h('th', {}, 'Fichiers'), h('th', {}, ''))),
    h('tbody', {}, backups.slice().reverse().map((b, i) => h('tr', {},
      h('td', { class: 'mono' }, new Date(b.created).toLocaleString(), i === backups.length - 1 ? h('span', { class: 'tag' }, 'original') : null),
      h('td', {}, b.reason || ''),
      h('td', { class: 'mono' }, b.files.join(', ')),
      h('td', {}, h('button', { type: 'button', class: 'small', onclick: () => onRestore(b) }, 'Restaurer')))))));
}

function diffBlock(diff) {
  const lines = compactDiff(diff, 2);
  return h('pre', { class: 'diff' }, lines.map((l) => h('span', { class: l.type },
    h('span', { class: 'ln' }, l.type === 'add' ? `+${l.b}` : l.type === 'del' ? `−${l.a}` : l.a ?? ''),
    l.text)));
}

export function renderDiff(ws, body) {
  const files = Object.keys(ws.files);
  const pending = files.filter((f) => ws.editsFor(f).length);
  body.append(h('h3', {}, 'Modifications non enregistrées'));
  if (!pending.length) body.append(h('p', { class: 'missing' }, 'Aucune.'));
  for (const f of pending) {
    try {
      body.append(h('h4', { class: 'mono' }, f), diffBlock(ws.diff(f)));
    } catch (e) {
      body.append(h('p', { class: 'error-box' }, `${f} : ${e.message}`));
    }
  }
  body.append(h('h3', {}, 'Depuis l\'original (enregistré + en cours)'));
  let any = false;
  for (const f of files) {
    let d;
    try { d = ws.diffFromOriginal(f); } catch { continue; }
    if (!d.some((l) => l.type !== 'same')) continue;
    any = true;
    body.append(h('h4', { class: 'mono' }, f), diffBlock(d));
  }
  if (!any) body.append(h('p', { class: 'missing' }, 'Aucune différence avec l\'original.'));
}
