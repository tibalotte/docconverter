import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, ValidationError, TYRES, SUSP, SETUP } from '../js/workspace.js';
import { decodeText } from '../js/encoding.js';
import { carDir, fixtureBytes } from './helpers.js';

const clock = () => { let t = Date.UTC(2026, 0, 1); return () => new Date((t += 1000)); };

async function open(car) {
  const dir = carDir(car);
  return { dir, ws: await new Workspace(dir, { now: clock() }).load() };
}

test('ouvrir → modifier → enregistrer → restaurer l\'original (fichiers identiques)', async () => {
  const { dir, ws } = await open('multi_compounds');
  ws.setValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL', '34');
  ws.setValue(SUSP, 'ARB', 'FRONT', '27000');
  assert.deepEqual(ws.changedFiles(), [TYRES, SUSP]);
  const res = await ws.save();
  assert.deepEqual(res.written, [TYRES, SUSP]);
  assert.ok(res.backupId);
  assert.equal(ws.hasUnsavedChanges(), false);

  const t = decodeText(await dir.readFile(TYRES));
  assert.equal(t.encoding, 'windows-1252', 'encodage d\'origine conservé');
  assert.match(t.text, /PRESSURE_IDEAL=34   ;Ideal pressure for grip\r\n/);
  assert.equal(ws.savedValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL'), '34');
  assert.equal(ws.originalValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL'), '33');

  // Deuxième enregistrement : même sauvegarde, l'original reste celui de départ.
  ws.setValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL', '35');
  const res2 = await ws.save();
  assert.equal(res2.backupId, res.backupId);

  // Rechargement (nouvelle visite) : l'original est relu depuis la sauvegarde.
  const ws2 = await new Workspace(dir, { now: clock() }).load();
  assert.equal(ws2.originalValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL'), '33');
  assert.equal(ws2.isModifiedFromOriginal(TYRES, 'FRONT_1', 'PRESSURE_IDEAL'), true);

  const r = await ws2.restoreOriginal();
  assert.deepEqual(r.restored.sort(), [SUSP, TYRES]);
  assert.deepEqual(await dir.readFile(TYRES), fixtureBytes('multi_compounds', TYRES));
  assert.deepEqual(await dir.readFile(SUSP), fixtureBytes('multi_compounds', SUSP));
  assert.deepEqual(await dir.readFile(SETUP), fixtureBytes('multi_compounds', SETUP));
  assert.equal(ws2.savedValue(TYRES, 'FRONT_1', 'PRESSURE_IDEAL'), '33');
});

test('aucune écriture si erreur de validation', async () => {
  const { dir, ws } = await open('kunos_simple');
  ws.setValue(TYRES, 'FRONT', 'RIM_RADIUS', '0.4'); // > RADIUS
  ws.setValue(SUSP, 'FRONT', 'SPRING_RATE', 'abc');
  await assert.rejects(ws.save(), (e) => e instanceof ValidationError && e.issues.length === 2);
  assert.deepEqual(await dir.readFile(TYRES), fixtureBytes('kunos_simple', TYRES));
  assert.equal(await dir.getDir('.acmod_backup'), null, 'pas de sauvegarde inutile');
});

test('les avertissements n\'empêchent pas l\'enregistrement', async () => {
  const { ws } = await open('kunos_simple');
  ws.setValue(SUSP, 'FRONT', 'DAMP_BUMP', '9000'); // +157 %
  const issues = ws.validate();
  assert.ok(issues.length >= 1 && issues.every((i) => i.level === 'warning'));
  const res = await ws.save();
  assert.deepEqual(res.written, [SUSP]);
});

test('remettre la valeur enregistrée annule la modification', async () => {
  const { ws } = await open('kunos_simple');
  ws.setValue(TYRES, 'FRONT', 'WIDTH', '0.23');
  assert.equal(ws.isEdited(TYRES, 'FRONT', 'WIDTH'), true);
  ws.setValue(TYRES, 'FRONT', 'WIDTH', '0.225');
  assert.equal(ws.hasUnsavedChanges(), false);
});

test('diff : une seule ligne modifiée', async () => {
  const { ws } = await open('mod_messy');
  ws.setValue(TYRES, 'FRONT', 'WIDTH', '0.24');
  const d = ws.diff(TYRES).filter((l) => l.type !== 'same');
  assert.deepEqual(d.map((l) => [l.type, l.text]), [
    ['del', 'Width = 0.230   // largeur modifiée'],
    ['add', 'Width = 0.24   // largeur modifiée'],
  ]);
});

test('revert annule tout', async () => {
  const { ws } = await open('kunos_simple');
  ws.setValue(SETUP, 'CAMBER_LF', 'MIN', '-50');
  ws.revert();
  assert.equal(ws.hasUnsavedChanges(), false);
  assert.equal(ws.value(SETUP, 'CAMBER_LF', 'MIN'), '-40');
});

test('règle croisée signalée seulement si un champ concerné est modifié', async () => {
  const { ws } = await open('kunos_simple');
  assert.deepEqual(ws.validate(), []);
  ws.setValue(SETUP, 'CAMBER_LF', 'STEP', '1.5'); // 40 / 1.5 non entier, écart 50 % toléré
  assert.deepEqual(ws.validate().map((i) => [i.level, i.section]), [['warning', 'CAMBER_LF']]);
});

test('restaurer une sauvegarde donnée', async () => {
  const { dir, ws } = await open('kunos_simple');
  ws.setValue(TYRES, 'REAR', 'DY_REF', '1.3');
  const { backupId } = await ws.save();
  await ws.restoreBackup(backupId);
  assert.deepEqual(await dir.readFile(TYRES), fixtureBytes('kunos_simple', TYRES));
  assert.equal((await ws.backups()).length, 2);
});
