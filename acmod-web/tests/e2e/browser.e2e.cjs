// Test de bout en bout dans Chromium (optionnel : nécessite Playwright).
//   npm run e2e
// Le dossier « data » est simulé avec l'Origin Private File System, qui expose
// la même API (FileSystemDirectoryHandle) que le dossier choisi par l'utilisateur.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '../..');
const FIX = path.join(ROOT, 'fixtures');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

const readCar = (car) => Object.fromEntries(fs.readdirSync(path.join(FIX, car)).map((f) => [f, [...fs.readFileSync(path.join(FIX, car, f))]]));

async function directMode(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => globalThis.__acmod);
  const files = readCar('multi_compounds');
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    const data = await root.getDirectoryHandle('data', { create: true });
    for (const [n, b] of Object.entries(files)) {
      const w = await (await data.getFileHandle(n, { create: true })).createWritable();
      await w.write(new Uint8Array(b)); await w.close();
    }
    const { HandleDir } = await import('./js/fs-access.js');
    globalThis.__h = data;
    await globalThis.__acmod.openDir(new HandleDir(data), {});
  }, files);
  await page.waitForSelector('#editor:not([hidden])');

  const pi = '#panel-tyres input[data-section="FRONT_1"][data-key="PRESSURE_IDEAL"]';
  await page.click(pi);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  assert.equal(await page.inputValue(pi), '38.5');
  assert.match(await page.getAttribute(pi, 'class'), /edited/);
  assert.equal(await page.isVisible('#dirty'), true);

  const rim = '#panel-tyres input[data-section="REAR"][data-key="RIM_RADIUS"]';
  await page.fill(rim, '0.5');
  await page.click('#btn-save');
  await page.waitForTimeout(200);
  assert.match(await page.textContent('#toast'), /erreur/);
  await page.fill(rim, '0.2286');

  await page.click('[data-tab=suspension]');
  await page.fill('#panel-suspension input[data-section="ARB"][data-key="FRONT"]', '27000');
  await page.click('[data-tab=setup]');
  await page.fill('#panel-setup input[data-section="CAMBER_LF"][data-key="MIN"]', '-45');
  assert.equal(await page.textContent('[data-clicks="CAMBER_LF"]'), '46');

  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => /Enregistré/.test(document.querySelector('#toast').textContent));
  const saved = await page.evaluate(async () => {
    const t = await (await (await globalThis.__h.getFileHandle('tyres.ini')).getFile()).arrayBuffer();
    return new TextDecoder('windows-1252').decode(t);
  });
  assert.match(saved, /PRESSURE_IDEAL=38\.5   ;Ideal pressure for grip\r\n/);

  await page.click('#btn-restore');
  await page.waitForFunction(() => /Original restauré/.test(document.querySelector('#toast').textContent));
  const same = await page.evaluate(async (files) => {
    const out = {};
    for (const [n, b] of Object.entries(files)) {
      const t = new Uint8Array(await (await (await globalThis.__h.getFileHandle(n)).getFile()).arrayBuffer());
      out[n] = t.length === b.length && t.every((x, i) => x === b[i]);
    }
    return out;
  }, files);
  assert.deepEqual(same, { 'setup.ini': true, 'suspensions.ini': true, 'tyres.ini': true });
  assert.deepEqual(errors, []);
  await page.close();
  console.log('ok - mode direct : ouvrir → modifier → enregistrer → restaurer');
}

async function fallbackMode(browser, base) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { delete window.showDirectoryPicker; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/index.html`);
  assert.equal(await page.isDisabled('#btn-open'), true);
  const dir = path.join(FIX, 'kunos_simple');
  await page.setInputFiles('#in-files', fs.readdirSync(dir).map((n) => path.join(dir, n)));
  await page.waitForSelector('#editor:not([hidden])');
  await page.fill('#panel-tyres input[data-section="FRONT"][data-key="DY_REF"]', '1.3');
  const dl = page.waitForEvent('download');
  await page.click('#btn-save');
  const d = await dl;
  assert.equal(d.suggestedFilename(), 'tyres.ini');
  assert.match(fs.readFileSync(await d.path(), 'utf8'), /\[FRONT\][\s\S]*DY_REF=1\.3\r\n/);
  assert.deepEqual(errors, []);
  await ctx.close();
  console.log('ok - mode de repli : import → modifier → télécharger');
}

(async () => {
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    await directMode(browser, base);
    await fallbackMode(browser, base);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
