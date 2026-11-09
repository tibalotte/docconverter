import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile } from '../js/ini.js';
import { decodeText } from '../js/encoding.js';
import { loadTyres, applyTyres, detectCompounds } from '../js/tyres.js';
import { loadSuspension, applySuspension } from '../js/suspension.js';
import { loadSetup, applySetup } from '../js/setup.js';
import { fixtureBytes } from './helpers.js';

const ini = (car, file) => IniFile.parse(decodeText(fixtureBytes(car, file)).text);

test('pneus : un composé (Kunos simple)', () => {
  const m = loadTyres(ini('kunos_simple', 'tyres.ini'));
  assert.equal(m.compounds.length, 1);
  const c = m.compounds[0];
  assert.equal(c.name, 'Semislicks');
  assert.equal(c.front, 'FRONT');
  assert.equal(c.thermalRear, 'THERMAL_REAR');
  assert.equal(c.frontData.values.WIDTH, '0.225');
  assert.equal(c.rearData.values.WIDTH, '0.245');
  assert.equal(c.thermalFrontData.values.PERFORMANCE_CURVE, 'tcurve_semis.lut');
});

test('pneus : plusieurs composés et composé par défaut', () => {
  const m = loadTyres(ini('multi_compounds', 'tyres.ini'));
  assert.equal(m.defaultIndex, 1);
  assert.deepEqual(m.compounds.map((c) => [c.index, c.name, c.front, c.rear, c.thermalFront]), [
    [0, 'Street', 'FRONT', 'REAR', 'THERMAL_FRONT'],
    [1, 'Semislicks', 'FRONT_1', 'REAR_1', 'THERMAL_FRONT_1'],
    [2, 'Slicks Medium', 'FRONT_2', 'REAR_2', 'THERMAL_FRONT_2'],
  ]);
  assert.equal(m.compounds[2].frontData.values.PRESSURE_IDEAL, '26');
});

test('pneus : mod sale (casse, doublon, thermique arrière absent)', () => {
  const m = loadTyres(ini('mod_messy', 'tyres.ini'));
  const c = m.compounds[0];
  assert.equal(c.frontData.values.WIDTH, '0.230');
  assert.equal(c.frontData.values.DX_REF, '1.28');
  assert.equal(c.thermalFront, 'THERMAL_FRONT');
  assert.equal(c.thermalRear, null);
});

test('pneus : applyTyres modifie la bonne ligne et refuse le reste', () => {
  const f = ini('multi_compounds', 'tyres.ini');
  const before = f.toString();
  applyTyres(f, [{ section: 'FRONT_1', key: 'PRESSURE_IDEAL', value: '34' }]);
  assert.equal(f.get('FRONT_1', 'PRESSURE_IDEAL'), '34');
  assert.equal(f.get('FRONT', 'PRESSURE_IDEAL'), '30');
  const changed = before.split('\r\n').filter((l, i) => l !== f.toString().split('\r\n')[i]);
  assert.deepEqual(changed, ['PRESSURE_IDEAL=33   ;Ideal pressure for grip']);
  assert.throws(() => applyTyres(f, [{ section: 'FRONT', key: 'WEAR_CURVE', value: 'x.lut' }]), /non modifiable/);
  assert.throws(() => applyTyres(f, [{ section: 'FRONT', key: 'NDSLIP', value: '1' }]), /non modifiable/);
  assert.throws(() => applyTyres(f, [{ section: 'FRONT_9', key: 'WIDTH', value: '1' }]), /absente/);
});

test('detectCompounds ignore les sections non pneus', () => {
  const f = IniFile.parse('[FRONT]\nNAME=A\n[REAR]\nNAME=A\n[FRONTAL]\nX=1\n[REAR_X]\nX=1\n');
  assert.equal(detectCompounds(f).length, 1);
});

test('suspensions : lecture, géométrie en lecture seule', () => {
  const m = loadSuspension(ini('kunos_simple', 'suspensions.ini'));
  assert.equal(m.arb.values.FRONT, '32000');
  assert.equal(m.front.values.SPRING_RATE, '90000');
  assert.equal(m.rear.values.SPRING_RATE, '80000');
  assert.equal(m.front.values.TYPE, 'DWB');
  assert.equal(m.geometry.FRONT.WBCAR_TOP_FRONT, '0.2, 0.18, -0.03');
  assert.equal(m.basic.values.WHEELBASE, '2.53');
  const f = ini('kunos_simple', 'suspensions.ini');
  assert.throws(() => applySuspension(f, [{ section: 'FRONT', key: 'WBCAR_TOP_FRONT', value: '0,0,0' }]), /non modifiable/);
  assert.throws(() => applySuspension(f, [{ section: 'FRONT', key: 'TYPE', value: 'STRUT' }]), /non modifiable/);
  assert.throws(() => applySuspension(f, [{ section: 'BASIC', key: 'WHEELBASE', value: '3' }]), /non modifiable/);
  applySuspension(f, [{ section: 'ARB', key: 'REAR', value: '15000' }, { section: 'REAR', key: 'DAMP_BUMP', value: '3000' }]);
  assert.equal(f.get('ARB', 'REAR'), '15000');
  assert.match(f.toString(), /REAR=15000\t\t\t; Rear antiroll bar stifness\. in Nm\r\n/);
});

test('suspensions : mod (Spring_Rate en casse mixte, LF)', () => {
  const f = ini('mod_messy', 'suspensions.ini');
  assert.equal(loadSuspension(f).front.values.SPRING_RATE, '95000');
  applySuspension(f, [{ section: 'FRONT', key: 'SPRING_RATE', value: '100000' }]);
  assert.match(f.toString(), /\nSpring_Rate =  100000\t\/\/ ressort/);
});

test('setup.ini : plages et modification', () => {
  const m = loadSetup(ini('kunos_simple', 'setup.ini'));
  const names = m.items.map((i) => i.section);
  assert.ok(names.includes('CAMBER_LF'));
  assert.ok(!names.includes('TYRES'));
  assert.ok(!names.includes('DISPLAY_METHOD'));
  const camber = m.items.find((i) => i.section === 'CAMBER_LF');
  assert.deepEqual(camber.values, { MIN: '-40', MAX: '0', STEP: '1' });
  assert.equal(camber.tab, 'ALIGNMENT');
  const f = ini('mod_messy', 'setup.ini');
  assert.equal(loadSetup(f).items.find((i) => i.section === 'PRESSURE_LF').values.MIN, '15');
  applySetup(f, [{ section: 'PRESSURE_LF', key: 'MIN', value: '18' }]);
  assert.match(f.toString(), /\nmin = 18\n/);
  assert.throws(() => applySetup(f, [{ section: 'PRESSURE_LF', key: 'NAME', value: 'x' }]));
});
