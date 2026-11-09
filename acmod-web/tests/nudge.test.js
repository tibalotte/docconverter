import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudge, defaultStep } from '../js/ui/nudge.js';

test('nudge garde les décimales et évite les erreurs d\'arrondi', () => {
  assert.equal(nudge('0.225', 0.001, 1), '0.226');
  assert.equal(nudge('0.1', 0.1, 2), '0.3');
  assert.equal(nudge('0.230', 0.001, -1), '0.229');
  assert.equal(nudge('90000', 500, 1), '90500');
  assert.equal(nudge('-1.5', 0.1, 1), '-1.4');
  assert.equal(nudge('0.1', 0.1, -1), '0.0');
  assert.equal(nudge('-0.1', 0.1, 1), '0.0');
  assert.equal(nudge('26', 0.5, 1), '26.5');
  assert.equal(nudge('abc', 1, 1), null);
});

test('defaultStep', () => {
  assert.equal(defaultStep('0.0035'), 0.0001);
  assert.equal(defaultStep('12'), 1);
});
