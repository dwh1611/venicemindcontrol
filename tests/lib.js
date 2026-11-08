// Gemeinsame Hilfen für die Panel-Tests (Headless-Electron, nachgebautes chrome-Objekt).
// Aufruf: electron tests/<name>.test.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Öffnet das Panel mit einem eigenen Profil (mindId TESTMIND1) und gibt Hilfsfunktionen zurück.
async function open(profile, opts = {}) {
  const win = new BrowserWindow({ show: false, width: 440, height: 1600, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: false, sandbox: false } });
  const errs = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2 && !msg.includes('Security Warning')) errs.push(msg); });
  await win.loadURL(require('url').pathToFileURL(path.join(ROOT, 'sidepanel.html')).href + (opts.query ? '?' + opts.query : ''));
  await wait(800);
  const ev = (code) => win.webContents.executeJavaScript(code + (/;\s*$/.test(code) ? '' : ''));
  const results = [];
  const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  if (profile) {
    await ev(`chrome.storage.local.set({lang:'${opts.lang || 'en'}',customProfiles:{[${JSON.stringify(profile.id)}]:${JSON.stringify(profile)}}});0`);
    await ev(`window.__tabs[0].url='https://venice.ai/chat/minds/local/${(profile.mindIds || ['TESTMIND1'])[0]}/x';window.__tabs[0].title='t';0`);
    await wait(3800);
  }
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click();0`);
  const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
  const queue = () => ev(`[...document.querySelectorAll('#queue li:not(.empty) span')].map(s=>s.textContent)`);
  const status = () => ev(`document.getElementById('status').textContent`);
  const tab = (id) => ev(`document.querySelector('[data-tab=${id}]').click();0`);
  const buttons = (sel) => ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter(b=>!b.hidden).map(b=>b.textContent)`);
  const finish = (extraErrs = true) => {
    if (extraErrs) ok('no page errors', errs.length === 0, errs);
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(failed ? `RESULT: ${failed} FAILED` : `RESULT: ALL ${results.length} PASSED`);
    app.exit(failed ? 1 : 0);
  };
  return { win, ev, wait, ok, click, text, queue, status, tab, buttons, finish, errs };
}

// Minimales gültiges Profil, das Tests erweitern.
const base = (over = {}) => ({
  id: 'testprof', name: 'Test', mindIds: ['TESTMIND1'], defaultTime: '10:00',
  prefixes: { actor: 'PLAYER', world: 'WORLD' },
  theme: { fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d', deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255' },
  header: { logo: 'T', meta: [['A', 'b']], prompt: '>' },
  tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['One'], action: { who: 'actor', parts: ['ACT'], body: ['{item}'] } }] }],
  ...over,
});

const run = (fn) => app.whenReady().then(fn).catch((e) => { console.log('TEST CRASHED: ' + (e && e.stack || e)); app.exit(2); });

module.exports = { open, base, run, wait, ROOT };
