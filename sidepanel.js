const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/* ---------- Zustand ---------- */
let profile = null;
let queue = [];
let history = [];
let customScenarios = [];
let tabs = [];           // { id, panel, fields: {id: el}, clear: [ids] }
let currentMind = null;  // { mindId, source }

const key = (s) => `${profile.id}:${s}`;
const hp = () => $('hprefix').value.trim() || profile.prefixes.actor;
const wp = () => $('wprefix').value.trim() || profile.prefixes.world;
const clock = () => $('time').value.trim();

function line(prefix, parts, body) {
  const head = [prefix, clock(), ...parts].filter(Boolean).join(' · ');
  return `[${head}]${body ? ' ' + body : ''}`;
}

/* ---------- Speicher ---------- */
const DATA_IDS = ['time', 'hprefix', 'wprefix', 'advance', 'order'];
const DATA_CHECKS = ['append', 'autosend', 'instant'];

async function loadProfileData() {
  const s = await chrome.storage.local.get([key('data'), key('theme'), key('gameState')]);
  const d = s[key('data')] || {};
  $('time').value = d.time || profile.defaultTime || '12:00';
  $('hprefix').value = d.hprefix || profile.prefixes.actor;
  $('wprefix').value = d.wprefix || profile.prefixes.world;
  $('advance').value = d.advance !== undefined ? d.advance : 1;
  $('order').value = d.order || 'eventFirst';
  $('append').checked = d.append !== undefined ? d.append : true;
  $('autosend').checked = !!d.autosend;
  $('instant').checked = !!d.instant;
  $('userText').value = '';
  history = d.history || [];
  queue = d.queue || [];
  customScenarios = d.customScenarios || [];
  const t = { ...THEME_DEFAULT, ...(s[key('theme')] || {}) };
  Object.entries(THEME_IDS).forEach(([k, id]) => { $(id).checked = !!t[k]; });
  renderHud(s[key('gameState')]);
}

function save() {
  if (!profile) return;
  const d = { history, queue, customScenarios };
  DATA_IDS.forEach((id) => { d[id] = $(id).value; });
  DATA_CHECKS.forEach((id) => { d[id] = $(id).checked; });
  chrome.storage.local.set({ [key('data')]: d });
}

/* ---------- Zeit ---------- */
function clockMinutes() {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

function shiftTime(minutes) {
  const total = (clockMinutes() + Math.ceil(minutes) + 1440 * 10) % 1440;
  $('time').value = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  renderPreview();
  save();
}

function minutesUntil(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  let d = hh * 60 + mm - clockMinutes();
  if (d <= 0) d += 1440;
  return d;
}

/* ---------- Warteschlange ---------- */
function stage(text) {
  queue.push(text);
  renderQueue();
  save();
  if ($('instant').checked) send();
}

function renderQueue() {
  const ul = $('queue');
  ul.innerHTML = '';
  $('qcount').textContent = String(queue.length);
  if (!queue.length) ul.appendChild(h('li', 'empty', '(leer – Befehle oben anklicken)'));
  queue.forEach((q, i) => {
    const li = h('li');
    const x = h('button', null, '×');
    x.title = 'Entfernen';
    x.onclick = () => { queue.splice(i, 1); renderQueue(); save(); };
    li.append(h('span', null, q), x);
    ul.appendChild(li);
  });
  renderPreview();
}

function buildMessage() {
  const ev = queue.join('\n');
  const user = $('userText').value.trim();
  if (!ev) return user;
  if (!user) return ev;
  return $('order').value === 'userFirst' ? `${user}\n\n${ev}` : `${ev}\n\n${user}`;
}

function renderPreview() { $('preview').textContent = buildMessage() || '(nichts vorbereitet)'; }

function renderHistory() {
  const ul = $('history');
  ul.innerHTML = '';
  history.forEach((e) => {
    const li = h('li', null, e.text.length > 160 ? e.text.slice(0, 160) + '…' : e.text);
    li.onclick = () => inject(e.text, { send: $('autosend').checked, append: $('append').checked });
    ul.appendChild(li);
  });
}

/* ---------- Venice-Tab ---------- */
const URL_PATTERNS = ['https://venice.ai/*', 'https://*.venice.ai/*'];

async function findVeniceTab() {
  const found = await chrome.tabs.query({ url: URL_PATTERNS });
  if (!found.length) return null;
  return found.find((t) => t.active && t.lastFocusedWindow) || found.find((t) => t.active) ||
    found.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['profiles/registry.js', 'profiles/nightingale.js', 'profiles/ghostline.js', 'content.js'],
    });
  }
}

function status(msg, ok = true) {
  const e = $('status');
  e.textContent = msg ? (ok ? '✓ ' : '✗ ') + msg : '';
  e.className = 'status ' + (ok ? 'ok' : 'err');
  return null;
}

async function inject(text, { send: doSend, append }) {
  try {
    const tab = await findVeniceTab();
    if (!tab) { status('Kein venice.ai-Tab gefunden.', false); return false; }
    await ensureContentScript(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'inject', text, mode: append ? 'append' : 'replace', send: doSend,
    });
    if (!res?.ok) { status(res?.error || 'Unbekannter Fehler.', false); return false; }
    status(res.sent ? 'Eingefügt und gesendet.' : 'In die Chatbox eingefügt.');
    return true;
  } catch (e) {
    status('Verbindung zum Tab fehlgeschlagen: ' + e.message, false);
    return false;
  }
}

async function send() {
  const text = buildMessage();
  if (!text) { status('Nichts zu senden.', false); return; }
  const ok = await inject(text, { send: $('autosend').checked || $('instant').checked, append: $('append').checked });
  if (!ok) return;
  history.unshift({ text, at: Date.now() });
  history = history.slice(0, 30);
  queue = [];
  $('userText').value = '';
  const adv = profile.clock === false ? 0 : parseInt($('advance').value, 10) || 0;
  if (adv) shiftTime(adv);
  renderQueue();
  renderHistory();
  save();
}

/* ---------- Profil aufbauen ---------- */
/* ---------- Aktionen (deklarativ, siehe PROFILE-FORMAT.md) ---------- */
// Baut aus einer Aktionsbeschreibung die Zeile für die Warteschlange.
// Gibt Text, { text, shift } oder null (Fehler wurde gemeldet) zurück.
function runAction(a, scope) {
  const P = MindProfiles;
  const empty = (path) => P.fill(`{${path}}`, scope).empty;
  for (const r of a.requires || []) if (empty(r.need)) return status(r.msg || 'Eingabe fehlt.', false);
  if (a.requiresAny && a.requiresAny.need.every(empty)) return status(a.requiresAny.msg || 'Eingabe fehlt.', false);
  if ((a.omitKinds || []).includes(scope.kind)) scope.kind = '';
  let minutes = 0;
  if (a.shift && scope.item) {
    if (scope.item.until) { minutes = minutesUntil(scope.item.until); scope.until_minutes = minutes; }
    else minutes = scope.item.m || 0;
  }
  const body = P.segments(a.body, scope);
  // "raw": reiner Text ohne [PRÄFIX · Uhrzeit …]-Klammer, z. B. für Slash-Befehle.
  const text = a.format === 'raw'
    ? [P.parts(a.parts, scope).join(' '), body].filter(Boolean).join(' ')
    : line(a.who === 'world' ? wp() : hp(), P.parts(a.parts, scope), body);
  return a.shift && minutes ? { text, shift: minutes } : text;
}

function setTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  tabs.forEach((t) => { t.panel.hidden = t.id !== id; });
}

function fieldEl(tab, f) {
  const label = h('label');
  label.append(document.createTextNode(f.label || ''));
  let input;
  if (f.kind === 'select') {
    input = h('select');
    (f.options || []).forEach((o) => { const op = h('option', null, o.label); op.value = o.value; input.appendChild(op); });
  } else if (f.kind === 'textarea') {
    input = h('textarea');
    input.rows = f.rows || 3;
  } else {
    input = h('input');
  }
  if (f.placeholder) input.placeholder = f.placeholder;
  label.appendChild(input);
  tab.fields[f.id] = input;
  if (f.clear) tab.clear.push(f.id);
  return label;
}

const tabVals = (tab) => {
  const v = {};
  Object.entries(tab.fields).forEach(([id, el]) => { v[id] = el.value.trim(); });
  return v;
};

function afterMake(tab, res) {
  if (res == null) return;
  const out = typeof res === 'string' ? { text: res } : res;
  stage(out.text);
  if (out.shift) shiftTime(out.shift);
  tab.clear.forEach((id) => { tab.fields[id].value = ''; });
}

function renderBlock(tab, b) {
  const el = tab.panel;
  if (b.type === 'hint') {
    el.appendChild(h('p', 'hint', b.text));
  } else if (b.type === 'field') {
    el.appendChild(fieldEl(tab, b));
  } else if (b.type === 'row') {
    const row = h('div', 'cols');
    b.fields.forEach((f) => row.appendChild(fieldEl(tab, f)));
    el.appendChild(row);
  } else if (b.type === 'grid') {
    el.appendChild(h('div', 'cap', b.cap));
    const grid = h('div', 'grid');
    b.items.forEach((it) => {
      const btn = h('button', null, typeof it === 'string' ? it : it.label);
      btn.onclick = () => afterMake(tab, runAction(b.action, { item: it, field: tabVals(tab) }));
      grid.appendChild(btn);
    });
    el.appendChild(grid);
  } else if (b.type === 'compose') {
    renderCompose(tab, b);
  } else if (b.type === 'scenarios') {
    renderScenarios(tab);
  }
}

function renderCompose(tab, b) {
  const names = Object.keys(b.kinds);
  const cols = h('div', 'cols');
  const kindLabel = h('label');
  kindLabel.append(document.createTextNode(b.kindLabel || 'Art'));
  const sel = h('select');
  names.forEach((n) => sel.appendChild(h('option', null, n)));
  kindLabel.appendChild(sel);
  const whoLabel = h('label');
  whoLabel.append(document.createTextNode(b.whoLabel || 'Von'));
  const who = h('input');
  whoLabel.appendChild(who);
  cols.append(kindLabel, whoLabel);
  const textLabel = h('label');
  textLabel.append(document.createTextNode(b.textLabel || 'Inhalt'));
  const text = h('textarea');
  text.rows = 3;
  textLabel.appendChild(text);
  const quick = h('div', 'quick');
  const add = h('button', 'stage', '> IN WARTESCHLANGE');

  const refresh = () => {
    const k = b.kinds[sel.value];
    who.placeholder = k.who || '';
    text.placeholder = k.text || '';
    quick.innerHTML = '';
    (k.quick || []).forEach((q) => { const qb = h('button', null, q); qb.onclick = () => { text.value = q; }; quick.appendChild(qb); });
  };
  sel.onchange = refresh;
  add.onclick = () => {
    const res = runAction(b.action, { kind: sel.value, who: who.value.trim(), text: text.value.trim() });
    if (res == null) return;
    afterMake({ fields: {}, clear: [] }, res);
    text.value = '';
  };
  refresh();
  tab.panel.append(cols, textLabel, quick, add);
}

/* ---------- Szenarien ---------- */
function renderScenarios(tab) {
  const cfg = profile.scenarios;
  const el = tab.panel;
  if (!cfg) { el.appendChild(h('p', 'hint', 'Dieses Mind hat keine Szenarien.')); return; }
  let current = null;
  const inputs = {};
  const all = () => [...cfg.items, ...customScenarios];

  el.appendChild(h('p', 'hint', 'Einen Einsatz festlegen. Ort, Zeit und Wetter stehen dann fest, nichts wird später neu erfunden. Am besten in einem neuen Chat.'));
  el.appendChild(h('div', 'cap', 'EINSÄTZE'));
  const list = h('div', 'grid');
  el.appendChild(list);
  const rowBtns = h('div', 'row');
  const rnd = h('button', null, 'ZUFÄLLIG');
  const empty = h('button', null, 'LEER');
  rowBtns.append(rnd, empty);
  el.appendChild(rowBtns);
  el.appendChild(h('div', 'cap', 'EINSATZ-DETAILS'));

  const form = h('div', 'scform');
  let pair = null;
  cfg.fields.forEach((f) => {
    const label = h('label');
    label.append(document.createTextNode(f.label));
    const input = f.area ? h('textarea') : h('input');
    if (f.area) input.rows = 2;
    input.placeholder = f.ph || '';
    inputs[f.key] = input;
    label.appendChild(input);
    if (f.half) {
      if (!pair) { pair = h('div', 'cols'); form.appendChild(pair); }
      pair.appendChild(label);
      if (pair.children.length === 2) pair = null;
    } else {
      form.appendChild(label);
    }
  });
  el.appendChild(form);

  let mode, level;
  const twistText = h('textarea');
  twistText.rows = 2;
  twistText.placeholder = 'Wird nur gesendet, wenn oben Vorschlag senden gewählt ist.';
  if (cfg.twist) {
    const cols = h('div', 'cols');
    const l1 = h('label'); l1.append(document.createTextNode('Komplikation'));
    mode = h('select');
    [['choose', 'Mind wählt (geheim)'], ['none', 'keine'], ['spoiler', 'Vorschlag senden (Spoiler)']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; mode.appendChild(o); });
    l1.appendChild(mode);
    const l2 = h('label'); l2.append(document.createTextNode('Härte'));
    level = h('select');
    [['light', 'leicht'], ['medium', 'mittel'], ['hard', 'hart']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; level.appendChild(o); });
    level.value = 'medium';
    l2.appendChild(level);
    cols.append(l1, l2);
    const det = h('details');
    det.append(h('summary', null, 'Vorschlag für die Komplikation (Spoiler)'), twistText);
    el.append(cols, det);
  }

  const stageBtn = h('button', 'stage', '> EINSATZ IN WARTESCHLANGE');
  const saveBtn = h('button', null, 'ALS EIGENES SPEICHERN');
  const delBtn = h('button', null, 'LÖSCHEN');
  delBtn.hidden = true;
  const row1 = h('div', 'row'); row1.appendChild(stageBtn);
  const row2 = h('div', 'row'); row2.append(saveBtn, delBtn);
  el.append(row1, row2);

  const read = () => {
    const sc = {};
    cfg.fields.forEach((f) => { sc[f.key] = inputs[f.key].value.trim(); });
    sc.twist = twistText.value.trim();
    return sc;
  };
  const fill = (sc) => {
    current = sc;
    cfg.fields.forEach((f) => { inputs[f.key].value = (sc && sc[f.key]) || ''; });
    twistText.value = (sc && sc.twist) || '';
    delBtn.hidden = !(sc && sc.custom);
  };
  const renderList = () => {
    list.innerHTML = '';
    all().forEach((sc) => {
      const b = h('button', null, (sc.custom ? '★ ' : '') + sc.title);
      b.title = `${sc.city || ''} · ${sc.time || ''}`;
      b.onclick = () => fill(sc);
      list.appendChild(b);
    });
  };

  rnd.onclick = () => {
    const a = all();
    fill(a[Math.floor(Math.random() * a.length)]);
    if (level) level.value = ['light', 'medium', 'hard'][Math.floor(Math.random() * 3)];
  };
  empty.onclick = () => fill(null);
  stageBtn.onclick = () => {
    const sc = read();
    const missing = cfg.fields.filter((f) => f.required && !sc[f.key]);
    if (missing.length) return status(`${missing.map((f) => f.label).join(' und ')} fehlt.`, false);
    if (/^\d{1,2}:\d{2}$/.test(sc.time || '')) $('time').value = sc.time;
    const t = cfg.template;
    const m = mode ? mode.value : 'choose';
    const scope = { ...sc, level: level ? level.value : 'medium' };
    const comp = m === 'none' ? t.complication.none : (m === 'spoiler' && sc.twist ? t.complication.spoiler : t.complication.choose);
    const text = [MindProfiles.segments(t.segments, scope), MindProfiles.segments([comp], scope), t.closing].filter(Boolean).join(' ');
    stage(line(wp(), ['SCENARIO', sc.title], text));
    save();
  };
  saveBtn.onclick = () => {
    const sc = read();
    if (!sc.title) return status('Titel fehlt.', false);
    sc.custom = true;
    sc.id = 'custom-' + sc.title.toLowerCase().replace(/\W+/g, '-');
    customScenarios = customScenarios.filter((c) => c.id !== sc.id);
    customScenarios.push(sc);
    save();
    renderList();
    fill(sc);
    status('Eigenes Szenario gespeichert.');
  };
  delBtn.onclick = () => {
    if (!current || !current.custom) return;
    customScenarios = customScenarios.filter((c) => c.id !== current.id);
    save();
    renderList();
    fill(null);
    status('Szenario gelöscht.');
  };
  renderList();
  fill(cfg.items[0]);
}

/* ---------- Header, Tabs, Theme ---------- */
function applyTheme(t) {
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg); r.setProperty('--bg2', t.bg2); r.setProperty('--fg', t.fg);
  r.setProperty('--dim', t.dim); r.setProperty('--mut', t.mut); r.setProperty('--line', t.line);
  r.setProperty('--warn', t.warn); r.setProperty('--err', t.err); r.setProperty('--ink', t.ink);
  r.setProperty('--deep', t.deep); r.setProperty('--glow', t.glow);
  r.setProperty('--hold', t.dim);
}

let telemetryTimer;
function renderHeader() {
  const hd = profile.header;
  $('logo').textContent = hd.logo;
  const meta = $('meta');
  meta.innerHTML = '';
  const sid = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const latEls = [];
  hd.meta.forEach(([k, text]) => {
    const row = h('div');
    row.appendChild(h('span', 'k', k));
    text.split('{sid}').join(sid).split(/(●|\{lat\})/).forEach((part) => {
      if (part === '●') row.appendChild(h('span', 'ok', '●'));
      else if (part === '{lat}') { const s = h('span', null, '42'); latEls.push(s); row.appendChild(s); }
      else if (part) row.appendChild(document.createTextNode(part));
    });
    meta.appendChild(row);
  });
  clearInterval(telemetryTimer);
  if (latEls.length) telemetryTimer = setInterval(() => { latEls.forEach((s) => { s.textContent = String(24 + Math.floor(Math.random() * 60)); }); }, 2500);
  $('promptLine').textContent = hd.prompt;
  $('lblActor').textContent = profile.settingsLabels.actor;
  $('lblWorld').textContent = profile.settingsLabels.world;
}

function renderTabs() {
  const nav = $('tabs');
  const panels = $('panels');
  nav.innerHTML = '';
  panels.innerHTML = '';
  tabs = [];
  profile.tabs.forEach((def) => {
    const btn = h('button', 'tab', def.label);
    btn.dataset.tab = def.id;
    btn.onclick = () => setTab(def.id);
    nav.appendChild(btn);
    const panel = h('section', 'panel');
    panel.dataset.panel = def.id;
    const tab = { id: def.id, panel, fields: {}, clear: [] };
    tabs.push(tab);
    panels.appendChild(panel);
    def.blocks.forEach((b) => renderBlock(tab, b));
  });
  setTab(profile.tabs[0].id);
}

/* ---------- Chat-Darstellung & Spielzustand ---------- */
const THEME_DEFAULT = { theme: true, scan: true, screens: true, events: true, sync: true };
const THEME_IDS = { theme: 'thTheme', scan: 'thScan', screens: 'thScreens', events: 'thEvents', sync: 'thSync' };

function saveTheme() {
  if (!profile) return;
  const t = {};
  Object.entries(THEME_IDS).forEach(([k, id]) => { t[k] = $(id).checked; });
  chrome.storage.local.set({ [key('theme')]: t });
}

function renderHud(st) {
  const hud = $('hud');
  $('statusRight').textContent = profile.statusRight ? MindProfiles.fill(profile.statusRight, st || {}).text : '';
  if (!st || !st.time) { hud.hidden = true; return; }
  const spec = profile.state || {};
  const parts = [`⏱ ${st.time}`];
  (spec.parts || []).forEach((p) => { if (st[p.key]) parts.push(`${p.icon} ${st[p.key]}`); });
  (spec.numbers || []).forEach((n) => { if (st[n.key] != null) parts.push(`${n.icon || ''} ${st[n.key]}${n.unit || ''}`.trim()); });
  let text = parts.join(' · ');
  (spec.meters || []).forEach((m) => {
    if (st[m.key] == null) return;
    const max = st[m.key + 'Max'] || m.max || 4;
    text += ` · ${m.label} ${'▮'.repeat(st[m.key])}${'▯'.repeat(Math.max(0, max - st[m.key]))} ${st[m.key]}/${max}`;
  });
  hud.textContent = text;
  hud.hidden = false;
}

function applyState(st) {
  renderHud(st);
  if (!$('thSync').checked || !st) return;
  if (st.time) $('time').value = st.time;
  renderPreview();
  save();
}

/* ---------- Mind-Erkennung ---------- */
function showMindbar(html) {
  const bar = $('mindbar');
  bar.innerHTML = '';
  html.forEach((n) => bar.appendChild(n));
}

async function applyProfile(p) {
  profile = p;
  applyTheme(p.theme);
  renderHeader();
  renderTabs();
  await loadProfileData();
  renderQueue();
  renderHistory();
  const clockOn = p.clock !== false;
  document.querySelector('.statusbar').hidden = !clockOn;
  document.querySelector('.timebtns').hidden = !clockOn;
  $('advance').closest('label').hidden = !clockOn;
  $('convention').hidden = !p.convention;
  $('convention').nextElementSibling.hidden = !p.convention;
  $('app').hidden = false;
}

let lastUnknown = '';
function showUnknown(mindId, title, reason) {
  const k = `${mindId}|${title}|${reason}`;
  if (k === lastUnknown && $('app').hidden) return; // Auswahl nicht zurücksetzen
  lastUnknown = k;
  $('app').hidden = true;
  profile = null;
  const nodes = [];
  if (!mindId) {
    nodes.push(h('div', null, reason || 'Kein Mind erkannt. Öffne einen Mind-Chat auf venice.ai.'));
    showMindbar(nodes);
    return;
  }
  nodes.push(h('div', null, `Unbekanntes Mind ${mindId}${title ? ' – ' + title : ''}. Welches Profil gehört dazu?`));
  const row = h('div', 'row');
  const sel = h('select');
  MindProfiles.list.forEach((p) => { const o = h('option', null, p.name); o.value = p.id; sel.appendChild(o); });
  const btn = h('button', 'primary', 'ZUORDNEN');
  btn.onclick = async () => {
    const { mindMap } = await chrome.storage.local.get('mindMap');
    await chrome.storage.local.set({ mindMap: { ...(mindMap || {}), [mindId]: sel.value } });
    refreshMind();
  };
  row.append(sel, btn);
  nodes.push(row);
  showMindbar(nodes);
}

let refreshing = false;
async function refreshMind() {
  if (refreshing) return;
  refreshing = true;
  try {
    const tab = await findVeniceTab();
    if (!tab) { showUnknown(null, null, 'Kein venice.ai-Tab gefunden.'); return; }
    const { mindMap } = await chrome.storage.local.get('mindMap');
    const d = MindProfiles.detect(tab.url, tab.title, mindMap);
    if (!d.profile) { showUnknown(d.mindId, tab.title); return; }
    lastUnknown = '';
    if (!profile || profile.id !== d.profile.id) await applyProfile(d.profile);
    currentMind = d;
    const b = h('div');
    b.append(h('b', null, profile.name), document.createTextNode(` · erkannt über ${d.source}${d.mindId ? ' (' + d.mindId + ')' : ''}`));
    showMindbar([b]);
    $('unassign').hidden = d.source !== 'zugeordnet';
  } finally {
    refreshing = false;
  }
}

/* ---------- Start ---------- */
function initStatic() {
  document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => shiftTime(parseInt(b.dataset.add, 10))));
  $('now').onclick = () => {
    const d = new Date();
    $('time').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    renderQueue();
    save();
  };
  ['time', 'userText', 'order', 'hprefix', 'wprefix', 'advance'].forEach((id) =>
    $(id).addEventListener('input', () => { renderPreview(); save(); }));
  DATA_CHECKS.forEach((id) => $(id).addEventListener('change', save));
  Object.values(THEME_IDS).forEach((id) => $(id).addEventListener('change', saveTheme));
  $('send').onclick = send;
  $('clearQueue').onclick = () => { queue = []; $('userText').value = ''; renderQueue(); save(); status(''); };
  $('convention').onclick = () =>
    inject(MindProfiles.fill(profile.convention, { hp: hp(), wp: wp() }).text, { send: false, append: $('append').checked });
  $('unassign').onclick = async () => {
    if (!currentMind || !currentMind.mindId) return;
    const { mindMap } = await chrome.storage.local.get('mindMap');
    const next = { ...(mindMap || {}) };
    delete next[currentMind.mindId];
    await chrome.storage.local.set({ mindMap: next });
    refreshMind();
  };
  document.addEventListener('keydown', (e) => {
    if (profile && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (profile && ch[key('gameState')] && ch[key('gameState')].newValue) applyState(ch[key('gameState')].newValue);
    if (ch.mindMap) refreshMind();
  });
  const soon = () => setTimeout(refreshMind, 150);
  chrome.tabs.onActivated.addListener(soon);
  chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.title || info.status === 'complete') soon(); });
  window.addEventListener('focus', soon);
}

/* ---------- Profile importieren / exportieren ---------- */
const TEMPLATE = {
  id: 'meinmind',
  name: 'Mein Mind',
  mindIds: ['HIER-DIE-MIND-ID'],
  titleMatch: 'Mein Mind',
  defaultTime: '12:00',
  prefixes: { actor: 'OPERATOR', world: 'WELT' },
  settingsLabels: { actor: 'Präfix Operator', world: 'Präfix Welt' },
  theme: {
    fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d',
    deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255',
  },
  header: { logo: 'MEIN MIND', meta: [['ORT  ', 'irgendwo · SID {sid}']], prompt: 'op@host:~#' },
  eventKinds: { AKTION: '#ffb000', MELDUNG: '#ff5252' },
  state: { parts: [{ key: 'loc', icon: '📍' }], numbers: [], meters: [] },
  statusRight: '{loc|—}',
  tabs: [
    { id: 'aktion', label: 'AKTION', blocks: [
      { type: 'field', id: 'ziel', label: 'Ziel (optional)', placeholder: 'wohin / worauf', clear: true },
      { type: 'grid', cap: 'BEFEHLE', items: ['Beobachten', 'Vorrücken'],
        action: { who: 'actor', parts: ['AKTION'], body: ['{item}', '– {field.ziel}'] } },
    ] },
    { id: 'welt', label: 'WELT', blocks: [
      { type: 'compose', kindLabel: 'Art', whoLabel: 'Quelle', textLabel: 'Inhalt',
        kinds: { MELDUNG: { who: '(optional)', text: 'Was passiert?', quick: ['Es regnet.'] } },
        action: { who: 'world', parts: ['{kind}', '{who}'], body: ['{text}'], requires: [{ need: 'text', msg: 'Inhalt fehlt.' }] } },
    ] },
  ],
  convention: 'Zeilen in eckigen Klammern mit "{hp}" sind Aktionen des Nutzers. Zeilen mit "{wp}" sind Ereignisse der Welt. Die Uhrzeit ist die Spielzeit. Beende jede Antwort mit: ⏱ HH:MM · 📍 Ort',
};

const download = (name, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const pmsg = (text, ok = true, lines) => {
  const box = $('pmsg');
  box.className = 'status ' + (ok ? 'ok' : 'err');
  box.textContent = text;
  (lines || []).forEach((l) => box.appendChild(h('div', null, '· ' + l)));
};

async function importProfiles(file) {
  if (!file) return;
  if (file.size > 300000) return pmsg('Datei zu groß (max. 300 KB).', false);
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return pmsg('Keine gültige JSON-Datei: ' + e.message, false); }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.profiles) ? data.profiles : [data];
  const { customProfiles } = await chrome.storage.local.get('customProfiles');
  const next = { ...(customProfiles || {}) };
  const done = [];
  for (const p of list) {
    const v = MindProfiles.validate(p);
    const problems = [...v.errors];
    if (v.ok && MindProfiles.builtins.some((b) => b.id === p.id)) problems.push(`id "${p.id}" ist von einem eingebauten Profil belegt.`);
    if (problems.length) return pmsg(`Profil "${(p && p.id) || '?'}" nicht importiert:`, false, problems);
    done.push(next[p.id] ? `${p.name} (ersetzt)` : p.name);
    next[p.id] = p;
  }
  await chrome.storage.local.set({ customProfiles: next });
  pmsg('Importiert: ' + done.join(', '));
}

function renderProfileManager() {
  const ul = $('plist');
  ul.innerHTML = '';
  MindProfiles.list.forEach((p) => {
    const li = h('li');
    const isCustom = MindProfiles.custom.some((c) => c.id === p.id);
    li.appendChild(h('span', null, `${p.name} · ${(p.mindIds || []).join(', ') || 'nur Titel'}${isCustom ? ' · eigenes' : ''}`));
    const ex = h('button', null, '⭳');
    ex.title = 'Als JSON exportieren';
    ex.onclick = () => download(`${p.id}.profile.json`, JSON.stringify(p, null, 2));
    li.appendChild(ex);
    if (isCustom) {
      const del = h('button', null, '×');
      del.title = 'Profil löschen';
      del.onclick = async () => {
        const { customProfiles } = await chrome.storage.local.get('customProfiles');
        const next = { ...(customProfiles || {}) };
        delete next[p.id];
        await chrome.storage.local.set({ customProfiles: next });
        pmsg(`Profil "${p.name}" gelöscht.`);
      };
      li.appendChild(del);
    }
    ul.appendChild(li);
  });
}

function initProfileManager() {
  $('pimport').onclick = () => $('pfile').click();
  $('pfile').onchange = async (e) => { await importProfiles(e.target.files[0]); e.target.value = ''; };
  $('ptemplate').onclick = () => download('vorlage.profile.json', JSON.stringify(TEMPLATE, null, 2));
  const copyPrompt = (file) => async () => {
    try {
      const md = await (await fetch(chrome.runtime.getURL(file))).text();
      const text = md.split('<!-- PROMPT START -->')[1].split('<!-- PROMPT END -->')[0].trim();
      await navigator.clipboard.writeText(text);
      pmsg('Prompt kopiert. In einen normalen Chat einfügen, unten „MEIN MIND“ bzw. „MY MIND“ ausfüllen, Antwort als .json speichern und importieren.');
    } catch (e) { pmsg('Kopieren nicht möglich: ' + e.message, false); }
  };
  $('pprompt').onclick = copyPrompt('PROMPT-Profile-Generator.de.md');
  $('pprompt_en').onclick = copyPrompt('PROMPT-Profile-Generator.md');
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.customProfiles) return;
    MindProfiles.setCustom(ch.customProfiles.newValue);
    renderProfileManager();
    profile = null; // Profil neu aufbauen, falls es ersetzt oder gelöscht wurde
    refreshMind();
  });
  renderProfileManager();
}

(async () => {
  await new Promise((r) => MindProfiles.init(r));
  initStatic();
  initProfileManager();
  await refreshMind();
  setInterval(refreshMind, 3000); // Fängt Seitenwechsel in der Single-Page-App ab
})();
