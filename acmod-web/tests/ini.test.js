import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile } from '../js/ini.js';
import { decodeText, encodeText } from '../js/encoding.js';
import { allFixtureFiles, fixtureBytes } from './helpers.js';

test('fixtures disponibles (au moins 3 voitures × 3 fichiers)', () => {
  assert.ok(allFixtureFiles().length >= 9);
});

for (const [car, file] of allFixtureFiles()) {
  test(`aller-retour identique octet pour octet : ${car}/${file}`, () => {
    const bytes = fixtureBytes(car, file);
    const { text, encoding, bom } = decodeText(bytes);
    const out = encodeText(IniFile.parse(text).toString(), encoding, bom);
    assert.deepEqual(out, bytes);
  });

  test(`modifier une valeur ne change qu'une ligne : ${car}/${file}`, () => {
    const { text } = decodeText(fixtureBytes(car, file));
    const ini = IniFile.parse(text);
    const section = ini.sections().find((s) => ini.keys(s).length);
    const key = ini.keys(section)[0];
    const before = ini.toString().split('\n');
    ini.set(section, key, 'XYZ123');
    const after = ini.toString().split('\n');
    assert.equal(after.length, before.length);
    const diffs = before.map((l, i) => (l === after[i] ? null : i)).filter((i) => i !== null);
    assert.equal(diffs.length, 1);
    assert.equal(ini.get(section, key), 'XYZ123');
  });
}

test('commentaires, espaces et CRLF préservés par set', () => {
  const src = '[FRONT]\r\nRADIUS=0.3125\t\t\t; tyre radius\r\nWIDTH = 0.230   // largeur\r\n';
  const ini = IniFile.parse(src);
  ini.set('front', 'radius', '0.33');
  ini.set('FRONT', 'width', '0.24');
  assert.equal(ini.toString(), '[FRONT]\r\nRADIUS=0.33\t\t\t; tyre radius\r\nWIDTH = 0.24   // largeur\r\n');
});

test('casse insensible, dernière occurrence d\'une clé dupliquée', () => {
  const ini = IniFile.parse('[Front]\nDX_REF=1.20\ndx_ref=1.28 ; doublon\n');
  assert.equal(ini.get('FRONT', 'DX_REF'), '1.28');
  ini.set('front', 'Dx_Ref', '1.30');
  assert.equal(ini.toString(), '[Front]\nDX_REF=1.20\ndx_ref=1.30 ; doublon\n');
  assert.deepEqual(ini.keys('FRONT'), ['DX_REF']);
});

test('sections dupliquées fusionnées ; sections() et keys()', () => {
  const ini = IniFile.parse('[A]\nX=1\n[B]\nY=2\n[A]\nZ=3\n');
  assert.deepEqual(ini.sections(), ['A', 'B']);
  assert.deepEqual(ini.keys('A'), ['X', 'Z']);
  assert.deepEqual(ini.entries('A'), { X: '1', Z: '3' });
});

test('valeur vide, lignes sans =, commentaires # et //', () => {
  const src = '# entête\n// autre\n[S]\nEMPTY=\nEMPTY2=   ; rien\nnot a kv line\n';
  const ini = IniFile.parse(src);
  assert.equal(ini.get('S', 'EMPTY'), '');
  assert.equal(ini.get('S', 'EMPTY2'), '');
  ini.set('S', 'EMPTY2', '5');
  assert.equal(ini.toString(), '# entête\n// autre\n[S]\nEMPTY=\nEMPTY2=5   ; rien\nnot a kv line\n');
});

test('set crée une clé ou une section absente, avec la fin de ligne du fichier', () => {
  const ini = IniFile.parse('[A]\r\nX=1\r\n\r\n[B]\r\nY=2\r\n');
  ini.set('A', 'NEW', '9');
  ini.set('C', 'Z', '3');
  assert.equal(ini.toString(), '[A]\r\nX=1\r\nNEW=9\r\n\r\n[B]\r\nY=2\r\n\r\n[C]\r\nZ=3\r\n');
  const noFinal = IniFile.parse('[A]\nX=1');
  noFinal.set('A', 'Y', '2');
  assert.equal(noFinal.toString(), '[A]\nX=1\nY=2');
});

test('set refuse les valeurs qui casseraient la ligne', () => {
  const ini = IniFile.parse('[A]\nX=1\n');
  assert.throws(() => ini.set('A', 'X', '1 ; hack'));
  assert.throws(() => ini.set('A', 'X', '1\nY=2'));
});

test('clone indépendant', () => {
  const a = IniFile.parse('[A]\nX=1\n');
  const b = a.clone();
  b.set('A', 'X', '2');
  assert.equal(a.get('A', 'X'), '1');
});

test('encodage : UTF-8, BOM, Windows-1252', () => {
  const utf = new TextEncoder().encode('é€');
  assert.deepEqual(decodeText(utf), { text: 'é€', encoding: 'utf-8', bom: false });
  const latin = Uint8Array.from([0x3b, 0xe9, 0x20, 0x80, 0x81]);
  const d = decodeText(latin);
  assert.equal(d.encoding, 'windows-1252');
  assert.equal(d.text, ';é €\u0081');
  assert.deepEqual(encodeText(d.text, d.encoding), latin);
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, 0x41]);
  assert.deepEqual(decodeText(bom), { text: 'A', encoding: 'utf-8', bom: true });
  assert.deepEqual(encodeText('A', 'utf-8', true), bom);
  assert.throws(() => encodeText('日本', 'windows-1252'));
});

test('fixture multi_compounds réellement en Windows-1252', () => {
  assert.equal(decodeText(fixtureBytes('multi_compounds', 'tyres.ini')).encoding, 'windows-1252');
  assert.equal(decodeText(fixtureBytes('mod_messy', 'tyres.ini')).bom, true);
});
