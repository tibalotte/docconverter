import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readZip, writeZip, crc32 } from '../js/zip.js';
import { lineDiff, compactDiff } from '../js/diff.js';

const enc = (s) => new TextEncoder().encode(s);

test('crc32', () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
});

test('zip : écrire puis relire (stored)', async () => {
  const files = [{ name: 'data/tyres.ini', bytes: enc('[FRONT]\r\nWIDTH=0.2\r\n') }, { name: 'data/é.ini', bytes: enc('x') }];
  const z = writeZip(files);
  const back = await readZip(z);
  assert.deepEqual([...back.keys()], ['data/tyres.ini', 'data/é.ini']);
  assert.deepEqual(back.get('data/tyres.ini'), files[0].bytes);
});

test('zip : lecture d\'une entrée deflate', async () => {
  const raw = enc('[FRONT]\nWIDTH=0.2\n'.repeat(50));
  const z = writeZip([{ name: 'a.ini', bytes: raw }]);
  // Transforme l'entrée stored en deflate pour tester l'autre méthode.
  const comp = deflateRawSync(raw);
  const view = new DataView(z.buffer);
  const nameLen = 5;
  const head = z.slice(0, 30 + nameLen);
  const hv = new DataView(head.buffer);
  hv.setUint16(8, 8, true);
  hv.setUint32(18, comp.length, true);
  const central = z.slice(30 + nameLen + raw.length, 30 + nameLen + raw.length + 46 + nameLen);
  const cv = new DataView(central.buffer);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, comp.length, true);
  const end = z.slice(z.length - 22);
  const ev = new DataView(end.buffer);
  ev.setUint32(16, head.length + comp.length, true);
  const out = new Uint8Array([...head, ...comp, ...central, ...end]);
  assert.ok(view);
  const back = await readZip(out);
  assert.deepEqual(back.get('a.ini'), raw);
});

test('zip invalide', async () => {
  await assert.rejects(readZip(enc('pas un zip du tout, vraiment pas')), /invalide/);
});

test('lineDiff et compactDiff', () => {
  const a = 'A\nB\nC\nD\nE\nF\nG';
  const b = 'A\nB\nC\nX\nE\nF\nG\nH';
  const d = lineDiff(a, b);
  assert.deepEqual(d.filter((l) => l.type !== 'same').map((l) => `${l.type}:${l.text}`), ['del:D', 'add:X', 'add:H']);
  const c = compactDiff(lineDiff('1\n2\n3\n4\n5\n6\n7\n8\n9', '1\n2\n3\n4\n5\n6\n7\n8\nX'), 1);
  assert.deepEqual(c.map((l) => l.type), ['skip', 'same', 'del', 'add']);
});
