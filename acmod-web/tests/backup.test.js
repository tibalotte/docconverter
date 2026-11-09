import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDir, checkDataDir, memoryDirFromFiles } from '../js/fs-access.js';
import { BACKUP_DIR, BackupSession, createBackup, listBackups, restore, makeBackupId } from '../js/backup.js';
import { carDir, fixtureBytes } from './helpers.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);
const clock = (start = Date.UTC(2026, 0, 1)) => { let t = start; return () => new Date((t += 1000)); };

test('makeBackupId : horodatage triable', () => {
  assert.equal(makeBackupId(new Date(2026, 10, 9, 8, 5, 3, 7)), '2026-11-09_08-05-03-007');
});

test('createBackup copie les fichiers et écrit un manifest', async () => {
  const dir = carDir('kunos_simple');
  const id = await createBackup(dir, ['tyres.ini', 'absent.ini'], { now: new Date(2026, 0, 1) });
  const b = await (await dir.getDir(BACKUP_DIR)).getDir(id);
  assert.deepEqual(await b.readFile('tyres.ini'), fixtureBytes('kunos_simple', 'tyres.ini'));
  const manifest = JSON.parse(dec(await b.readFile('manifest.json')));
  assert.deepEqual(manifest.files, ['tyres.ini']);
  const id2 = await createBackup(dir, ['tyres.ini'], { now: new Date(2026, 0, 1) });
  assert.notEqual(id2, id, 'deux sauvegardes à la même milliseconde ne s\'écrasent pas');
});

test('sauvegarder → modifier → restaurer redonne le fichier à l\'identique', async () => {
  const dir = carDir('multi_compounds');
  const original = await dir.readFile('tyres.ini');
  const now = clock();
  const id = await createBackup(dir, ['tyres.ini', 'suspensions.ini'], { now: now() });
  await dir.writeFile('tyres.ini', enc('cassé'));
  const { restored, safetyBackup } = await restore(dir, id, { now: now() });
  assert.deepEqual(restored, ['tyres.ini', 'suspensions.ini']);
  assert.deepEqual(await dir.readFile('tyres.ini'), original);
  // L'état « cassé » a lui-même été sauvegardé avant la restauration.
  const list = await listBackups(dir);
  assert.deepEqual(list.map((b) => b.id), [id, safetyBackup]);
  const safety = await (await dir.getDir(BACKUP_DIR)).getDir(safetyBackup);
  assert.equal(dec(await safety.readFile('tyres.ini')), 'cassé');
});

test('restore : sauvegarde inconnue', async () => {
  await assert.rejects(restore(carDir('kunos_simple'), 'nope'), /introuvable/);
});

test('BackupSession : une sauvegarde par session, fichiers ajoutés sans écraser l\'original', async () => {
  const dir = carDir('kunos_simple');
  const s = new BackupSession(dir, { now: clock() });
  const id = await s.ensure(['tyres.ini']);
  const original = await dir.readFile('tyres.ini');
  await dir.writeFile('tyres.ini', enc('v2'));
  assert.equal(await s.ensure(['tyres.ini', 'setup.ini']), id);
  const list = await listBackups(dir);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].files, ['tyres.ini', 'setup.ini']);
  const b = await (await dir.getDir(BACKUP_DIR)).getDir(id);
  assert.deepEqual(await b.readFile('tyres.ini'), original);
});

test('checkDataDir : dossier data valide', async () => {
  const r = await checkDataDir(carDir('kunos_simple'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.present, ['tyres.ini', 'suspensions.ini', 'setup.ini']);
});

test('checkDataDir : dossier voiture avec data.acd', async () => {
  const r = await checkDataDir(MemoryDir.fromEntries({ 'data.acd': enc('x'), 'body_shr.kn5': enc('x') }));
  assert.equal(r.ok, false);
  assert.match(r.message, /data\.acd/);
});

test('checkDataDir : dossier voiture avec sous-dossier data → descente auto', async () => {
  const root = MemoryDir.fromEntries({ 'data/tyres.ini': enc('[FRONT]'), 'data/suspensions.ini': enc('[FRONT]'), 'ui/ui_car.json': enc('{}') }, 'ks_car');
  const r = await checkDataDir(root);
  assert.equal(r.ok, true);
  assert.equal(r.dir.name, 'data');
  assert.equal(r.warnings.length, 2); // descente + setup.ini absent
});

test('checkDataDir : dossier quelconque', async () => {
  const r = await checkDataDir(MemoryDir.fromEntries({ 'readme.txt': enc('x') }));
  assert.equal(r.ok, false);
  assert.match(r.message, /tyres\.ini, suspensions\.ini/);
});

test('memoryDirFromFiles : import d\'un dossier (webkitdirectory)', async () => {
  const dir = memoryDirFromFiles([
    { path: 'ks_car/data/tyres.ini', bytes: enc('t') },
    { path: 'ks_car/data/suspensions.ini', bytes: enc('s') },
    { path: 'ks_car/ui/ui_car.json', bytes: enc('u') },
  ]);
  assert.equal(dir.name, 'data');
  assert.deepEqual((await dir.list()).map((e) => e.name).sort(), ['suspensions.ini', 'tyres.ini']);
});
