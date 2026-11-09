import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkValue, crossRules, parseNumber } from '../js/validate.js';
import { TYRE_PARAMS, SETUP_RANGE_PARAMS, paramIndex } from '../js/params.js';

const T = paramIndex(TYRE_PARAMS);
const levels = (issues) => issues.map((i) => i.level);

test('nombre attendu, virgule refusée', () => {
  assert.deepEqual(levels(checkValue(T.WIDTH, 'abc')), ['error']);
  assert.match(checkValue(T.WIDTH, '0,25')[0].message, /point/);
  assert.deepEqual(levels(checkValue(T.WIDTH, '')), ['error']);
  assert.deepEqual(levels(checkValue(T.WIDTH, '1e3')), ['error']);
  assert.deepEqual(checkValue(T.WIDTH, '0.25'), []);
  assert.deepEqual(checkValue(T.WIDTH, ' .25 '), []);
});

test('limites physiques = erreur, plage habituelle = avertissement', () => {
  assert.deepEqual(levels(checkValue(T.WIDTH, '0')), ['error']);
  assert.deepEqual(levels(checkValue(T.WIDTH, '-0.2')), ['error']);
  assert.deepEqual(levels(checkValue(T.WIDTH, '0.6')), ['warning']);
  assert.deepEqual(levels(checkValue(T.DAMP, '0')), ['warning']); // ≥ 0 autorisé mais hors plage habituelle
});

test('écart à l\'original', () => {
  assert.deepEqual(checkValue(T.DX_REF, '1.5', '1.26'), []);
  const w = checkValue(T.DAMP, '1000', '500');
  assert.deepEqual(levels(w), ['warning']);
  assert.match(w[0].message, /100 %/);
  assert.deepEqual(checkValue(T.CAMBER_GAIN, '0.2', '0'), []);
});

test('texte et lecture seule', () => {
  assert.deepEqual(levels(checkValue(T.NAME, '')), ['error']);
  assert.deepEqual(levels(checkValue(T.NAME, 'A;B')), ['error']);
  assert.deepEqual(checkValue(T.NAME, 'Soft'), []);
  assert.deepEqual(levels(checkValue(T.WEAR_CURVE, 'x.lut')), ['error']);
});

test('STEP strictement positif', () => {
  const S = paramIndex(SETUP_RANGE_PARAMS);
  assert.deepEqual(levels(checkValue(S.STEP, '0')), ['error']);
  assert.deepEqual(checkValue(S.STEP, '0.5'), []);
  assert.deepEqual(checkValue(S.MIN, '-50'), []);
});

function getter(data) {
  return (f, s, k) => data[`${f}|${s}|${k}`];
}

test('règle croisée : jante < pneu', () => {
  const issues = crossRules(getter({ 'tyres.ini|FRONT|RADIUS': '0.3', 'tyres.ini|FRONT|RIM_RADIUS': '0.31' }), { compounds: [{ front: 'FRONT', rear: null }], suspension: false });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, 'error');
});

test('règle croisée : pression à froid > idéale', () => {
  const issues = crossRules(getter({ 'tyres.ini|REAR|PRESSURE_STATIC': '35', 'tyres.ini|REAR|PRESSURE_IDEAL': '30' }), { compounds: [{ front: null, rear: 'REAR' }], suspension: false });
  assert.deepEqual(levels(issues), ['warning']);
});

test('règle croisée : cohérence avant / arrière', () => {
  const issues = crossRules(getter({ 'suspensions.ini|FRONT|SPRING_RATE': '400000', 'suspensions.ini|REAR|SPRING_RATE': '80000' }), {});
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /×5\.0/);
  assert.deepEqual(issues[0].involves.length, 2);
});

test('règle croisée : amortissement rapide > lent', () => {
  const issues = crossRules(getter({ 'suspensions.ini|FRONT|DAMP_FAST_BUMP': '5000', 'suspensions.ini|FRONT|DAMP_BUMP': '3000' }), {});
  assert.deepEqual(levels(issues), ['warning']);
});

test('règle croisée : setup MIN > MAX et pas non multiple', () => {
  const g = getter({ 'setup.ini|A|MIN': '10', 'setup.ini|A|MAX': '5', 'setup.ini|A|STEP': '1', 'setup.ini|B|MIN': '0', 'setup.ini|B|MAX': '10', 'setup.ini|B|STEP': '3', 'setup.ini|C|MIN': '-0.3', 'setup.ini|C|MAX': '0.3', 'setup.ini|C|STEP': '0.1' });
  const issues = crossRules(g, { setupSections: ['A', 'B', 'C'], suspension: false });
  assert.deepEqual(issues.map((i) => [i.section, i.level]), [['A', 'error'], ['B', 'warning']]);
});

test('parseNumber', () => {
  assert.equal(parseNumber(' 12.5 '), 12.5);
  assert.ok(Number.isNaN(parseNumber('12,5')));
  assert.ok(Number.isNaN(parseNumber(undefined)));
});
