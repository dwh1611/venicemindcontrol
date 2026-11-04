const $ = (id) => document.getElementById(id);
const t = (k, p) => I18n.t(k, p);
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
let favs = [];           // [{ name, lines: ['[PREFIX · {t} · …]', …] }]
let slots = [];          // [{ name, at, time, queue, history, userText }]
let lastState = null;    // zuletzt gelesene Statuszeile (HUD), Grundlage für "when"
let whenEls = [];        // [{ el, cond }]
let historyFilter = '';
let editing = false;     // Profil-Editor offen: keine automatische Mind-Erkennung
let previewing = false;  // Entwurf wird angezeigt: nichts darf gespeichert werden
const HISTORY_MAX = 100;

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
  const s = await chrome.storage.local.get([key('data'), key('theme'), key('gameState'), key('favs'), key('slots')]);
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
  favs = s[key('favs')] || [];
  slots = s[key('slots')] || [];
  historyFilter = '';
  $('hsearch').value = '';
  const t = { ...THEME_DEFAULT, ...(s[key('theme')] || {}) };
  Object.entries(THEME_IDS).forEach(([k, id]) => { $(id).checked = !!t[k]; });
  renderHud(s[key('gameState')]);
  renderFavs();
  renderSlots();
}

function save() {
  if (!profile || previewing) return;
  const d = { history, queue, customScenarios };
  DATA_IDS.forEach((id) => { d[id] = $(id).value; });
  DATA_CHECKS.forEach((id) => { d[id] = $(id).checked; });
  chrome.storage.local.set({ [key('data')]: d });
}

function saveExtra() {
  if (!profile || previewing) return;
  chrome.storage.local.set({ [key('favs')]: favs, [key('slots')]: slots });
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
function stage(text) { stageMany([text]); }

function stageMany(lines) {
  queue.push(...lines);
  renderQueue();
  save();
  if ($('instant').checked) send();
}

function renderQueue() {
  const ul = $('queue');
  ul.innerHTML = '';
  $('qcount').textContent = String(queue.length);
  if (!queue.length) ul.appendChild(h('li', 'empty', t('queue.empty')));
  queue.forEach((q, i) => {
    const li = h('li');
    const x = h('button', null, '×');
    x.title = t('queue.remove');
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

function renderPreview() { $('preview').textContent = buildMessage() || t('preview.empty'); }

const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function trimHistory() {
  let n = 0;
  history = history.filter((e) => e.pin || ++n <= HISTORY_MAX);
}

function renderHistory() {
  const ul = $('history');
  ul.innerHTML = '';
  const q = historyFilter.toLowerCase();
  const shown = history.filter((e) => !q || e.text.toLowerCase().includes(q));
  [...shown.filter((e) => e.pin), ...shown.filter((e) => !e.pin)].forEach((e) => {
    const li = h('li', e.pin ? 'pinned' : null);
    const body = h('span', 'htext', e.text.length > 160 ? e.text.slice(0, 160) + '…' : e.text);
    body.onclick = () => inject(e.text, { send: $('autosend').checked, append: $('append').checked });
    const meta = h('span', 'htime', e.at ? hhmm(e.at) : '');
    const pin = h('button', null, e.pin ? '★' : '☆');
    pin.title = t(e.pin ? 'history.unpin' : 'history.pin');
    pin.onclick = () => { e.pin = !e.pin; trimHistory(); renderHistory(); save(); };
    const fav = h('button', null, 'FAV');
    fav.title = t('history.toFav');
    fav.onclick = () => addFav($('macroName').value.trim() || e.text.split('\n')[0].slice(0, 24), e.text.split('\n').filter((l) => l.trim()));
    li.append(meta, body, pin, fav);
    ul.appendChild(li);
  });
  if (!ul.children.length) ul.appendChild(h('li', 'empty', t(history.length ? 'history.noMatch' : 'history.empty')));
}

/* ---------- Favoriten / Makros ---------- */
// Die Uhrzeit wird beim Speichern durch {t} ersetzt und beim Ausführen durch die aktuelle ersetzt.
const tokenize = (l) => l.replace(/^(\[[^\]·]*· )\d{1,2}:\d{2}/, '$1{t}');
const detokenize = (l) => l.split('{t}').join(clock());

function addFav(name, lines) {
  if (!name) return status(t('favs.nameMissing'), false);
  if (!lines.length) return status(t('favs.empty'), false);
  favs = favs.filter((f) => f.name !== name);
  favs.push({ name, lines: lines.map(tokenize) });
  $('macroName').value = '';
  renderFavs();
  saveExtra();
  status(t('favs.saved', { name }));
}

function renderFavs() {
  const box = $('favs');
  box.innerHTML = '';
  $('favsBox').hidden = !favs.length;
  favs.forEach((f) => {
    const wrap = h('div', 'favitem');
    const b = h('button', null, f.name);
    b.title = f.lines.map(detokenize).join('\n');
    b.onclick = () => stageMany(f.lines.map(detokenize));
    const x = h('button', 'x', '×');
    x.title = t('favs.delete');
    x.onclick = () => { favs = favs.filter((g) => g !== f); renderFavs(); saveExtra(); };
    wrap.append(b, x);
    box.appendChild(wrap);
  });
}

/* ---------- Spielstände ---------- */
function renderSlots() {
  const ul = $('slotList');
  ul.innerHTML = '';
  slots.forEach((s) => {
    const li = h('li');
    const d = new Date(s.at);
    li.appendChild(h('span', null, `${s.name} · ${d.toLocaleDateString()} ${hhmm(s.at)} · ${s.time || '–'} · ${t('slots.counts', { q: s.queue.length, h: s.history.length })}`));
    const load = h('button', null, t('slots.load'));
    load.onclick = () => loadSlot(s);
    const del = h('button', null, '×');
    del.title = t('slots.delete');
    del.onclick = () => { slots = slots.filter((x) => x !== s); renderSlots(); saveExtra(); };
    li.append(load, del);
    ul.appendChild(li);
  });
  if (!slots.length) ul.appendChild(h('li', 'empty', t('slots.none')));
}

const snapshot = (name) => ({ name, at: Date.now(), time: clock(), queue: [...queue], history: history.map((e) => ({ ...e })), userText: $('userText').value });

function saveSlot() {
  const name = $('slotName').value.trim();
  if (!name) return status(t('slots.nameMissing'), false);
  slots = slots.filter((s) => s.name !== name);
  slots.push(snapshot(name));
  $('slotName').value = '';
  renderSlots();
  saveExtra();
  status(t('slots.saved', { name }));
}

function loadSlot(s) {
  // Sicherung des aktuellen Stands, damit ein versehentliches Laden rückgängig zu machen ist.
  const auto = t('slots.auto');
  slots = slots.filter((x) => x.name !== auto);
  slots.push(snapshot(auto));
  if (s.time) $('time').value = s.time;
  queue = [...s.queue];
  history = s.history.map((e) => ({ ...e }));
  $('userText').value = s.userText || '';
  renderQueue();
  renderHistory();
  renderSlots();
  save();
  saveExtra();
  status(t('slots.loaded', { name: s.name }));
}

/* ---------- Relay zwischen zwei Minds ---------- */
const relay = { a: null, b: null }; // { id, title, name, profile }
const lastRelayed = {};             // "ab" | "ba" -> Fingerabdruck der zuletzt weitergegebenen Antwort
const relayRepeat = {};             // zweiter Klick auf dieselbe Antwort erlaubt

async function describeTab(tab) {
  const { mindMap } = await chrome.storage.local.get('mindMap');
  const d = MindProfiles.detect(tab.url, tab.title, mindMap || {});
  return { id: tab.id, title: tab.title || '', profile: d.profile, name: d.profile ? d.profile.name : (tab.title || `tab ${tab.id}`) };
}

function renderRelay() {
  [['a', 'relayA'], ['b', 'relayB']].forEach(([slot, id]) => {
    const r = relay[slot];
    const e = $(id);
    e.textContent = r ? `${r.name}${r.title && r.title !== r.name ? ' · ' + r.title : ''}` : t('relay.none');
    e.classList.toggle('set', !!r);
  });
  const ready = !!(relay.a && relay.b);
  $('relayAB').disabled = !ready;
  $('relayBA').disabled = !ready;
}

async function setRelay(slot) {
  const tab = await findVeniceTab();
  if (!tab) return status(t('status.noTab'), false);
  const other = relay[slot === 'a' ? 'b' : 'a'];
  if (other && other.id === tab.id) return status(t('relay.same'), false);
  relay[slot] = await describeTab(tab);
  renderRelay();
  status('');
}

// Frischer Stand des Tabs oder null, wenn er geschlossen wurde.
async function relayTab(slot) {
  const r = relay[slot];
  if (!r) return null;
  try { return await describeTab(await chrome.tabs.get(r.id)); } catch { relay[slot] = null; renderRelay(); return null; }
}

async function relayClock(dst, src) {
  const ids = [dst, src].filter((x) => x && x.profile).map((x) => x.profile.id);
  const s = await chrome.storage.local.get(ids.flatMap((id) => [`${id}:data`, `${id}:gameState`]));
  for (const id of ids) {
    const d = s[`${id}:data`]; if (d && d.time) return d.time;
    const g = s[`${id}:gameState`]; if (g && g.time) return g.time;
  }
  // Noch keine Zeit bekannt: Startzeit des Ziel-Profils, damit die Zeile im Chat als Event erkannt wird.
  return dst && dst.profile && dst.profile.clock !== false ? dst.profile.defaultTime || '12:00' : '';
}

const relayClean = (s) => String(s).replace(/[·[\]]/g, '').trim();

// [PRÄFIX des Ziels · Uhrzeit · ART · Absender] Text der Antwort
function relayLine(src, dst, reply, time, strip) {
  const cfg = (dst.profile && dst.profile.relay) || {};
  const prefix = dst.profile ? (cfg.who === 'actor' ? dst.profile.prefixes.actor : dst.profile.prefixes.world) : 'RELAY';
  const body = reply.split('\n').filter((l) => !(strip && l.trim().startsWith('⏱'))).join('\n').trim();
  const head = [prefix, time, cfg.kind || 'RELAY', relayClean(src.name)].filter(Boolean).join(' · ');
  return `[${head}] ${body}`;
}

async function relayNow(from, to) {
  const key = from + to;
  const src = await relayTab(from);
  const dst = await relayTab(to);
  if (!src || !dst) return status(t('relay.needBoth'), false);
  let res;
  try {
    await ensureContentScript(src.id);
    res = await chrome.tabs.sendMessage(src.id, { type: 'lastReply' });
  } catch (e) { return status(t('status.connection', { msg: e.message }), false); }
  if (!res || !res.ok || !res.text) return status(t('relay.noReply', { name: src.name }), false);
  // Schutz vor doppeltem Senden: dieselbe Antwort nur nach einem zweiten Klick erneut weitergeben.
  const print = `${res.count}:${res.text.length}:${res.text.slice(-60)}`;
  if (lastRelayed[key] === print && !relayRepeat[key]) { relayRepeat[key] = true; return status(t('relay.again'), false); }
  const text = relayLine(src, dst, res.text, await relayClock(dst, src), $('relayStrip').checked);
  const sendNow = $('relaySend').checked;
  const ok = await inject(text, { send: sendNow, append: $('append').checked }, dst.id);
  if (!ok) return;
  lastRelayed[key] = print;
  relayRepeat[key] = false;
  status(t(sendNow ? 'relay.doneSent' : 'relay.done', { from: src.name, to: dst.name }));
}

/* ---------- Sitzungs-Export ---------- */
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

function sessionData() {
  return {
    format: 'mind-console-session', version: 1,
    exportedAt: new Date().toISOString(),
    profile: { id: profile.id, name: profile.name },
    mindId: (currentMind && currentMind.mindId) || null,
    clock: clock(),
    state: lastState || null,
    history: [...history].reverse().map((e) => ({ at: e.at ? new Date(e.at).toISOString() : null, pinned: !!e.pin, text: e.text })),
    queue: [...queue],
    favorites: favs.map((f) => ({ name: f.name, lines: f.lines })),
  };
}

function sessionMarkdown(s) {
  const out = [`# ${s.profile.name} – session`, '', `- Exported: ${s.exportedAt}`, `- Mind: ${s.mindId || '–'}`, `- Clock: ${s.clock || '–'}`];
  if (s.state) out.push(`- Status: ${$('hud').textContent || JSON.stringify(s.state)}`);
  out.push('', '## History', '');
  if (!s.history.length) out.push('_empty_', '');
  s.history.forEach((e) => { out.push(`${e.pinned ? '★ ' : ''}${e.at || ''}`.trim(), '', '```', e.text, '```', ''); });
  if (s.queue.length) out.push('## Queue', '', '```', ...s.queue, '```', '');
  if (s.favorites.length) { out.push('## Favorites', ''); s.favorites.forEach((f) => out.push(`**${f.name}**`, '', '```', ...f.lines, '```', '')); }
  return out.join('\n');
}

function exportSession(kind) {
  const s = sessionData();
  const base = `${profile.id}-session-${stamp()}`;
  if (kind === 'md') download(`${base}.md`, sessionMarkdown(s), 'text/markdown');
  else download(`${base}.json`, JSON.stringify(s, null, 2));
  status(t('history.exported'));
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
  if (msg && !ok) e.scrollIntoView({ block: 'nearest' }); // Fehler sitzt unter der Queue, sonst übersieht man ihn
  return null;
}

async function inject(text, { send: doSend, append }, tabId) {
  try {
    const tab = tabId != null ? { id: tabId } : await findVeniceTab();
    if (!tab) { status(t('status.noTab'), false); return false; }
    await ensureContentScript(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'inject', text, mode: append ? 'append' : 'replace', send: doSend,
    });
    if (!res?.ok) { status(res?.code === 'no_input' ? t('status.noInput') : res?.error || t('status.unknown'), false); return false; }
    status(res.sent ? t('status.sent') : t('status.inserted'));
    return true;
  } catch (e) {
    status(t('status.connection', { msg: e.message }), false);
    return false;
  }
}

async function send() {
  const text = buildMessage();
  if (!text) { status(t('status.nothing'), false); return; }
  const ok = await inject(text, { send: $('autosend').checked || $('instant').checked, append: $('append').checked });
  if (!ok) return;
  history.unshift({ text, at: Date.now() });
  trimHistory();
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
  for (const r of a.requires || []) if (empty(r.need)) return status(r.msg || t('status.inputMissing'), false);
  if (a.requiresAny && a.requiresAny.need.every(empty)) return status(a.requiresAny.msg || t('status.inputMissing'), false);
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
  renderBadges();
}

/* ---------- Bedingungen ("when") ---------- */
function applyWhen() {
  whenEls.forEach(({ el, cond }) => { el.hidden = !MindProfiles.test(cond, lastState); });
  const active = document.querySelector('.tab.active');
  if (active && active.hidden) {
    const first = [...document.querySelectorAll('.tab')].find((b) => !b.hidden);
    if (first) setTab(first.dataset.tab);
  }
  renderBadges();
}

/* ---------- Tastenkürzel: Alt+1…9 drückt den n-ten sichtbaren Button des offenen Reiters ---------- */
const badgeButtons = () => {
  const panel = document.querySelector('.panel:not([hidden])');
  return panel ? [...panel.querySelectorAll('.grid button')].filter((b) => !b.hidden).slice(0, 9) : [];
};

function renderBadges() {
  document.querySelectorAll('button[data-key]').forEach((b) => b.removeAttribute('data-key'));
  badgeButtons().forEach((b, i) => { b.dataset.key = String(i + 1); });
}

function shortcut(e) {
  if (!profile || !e.altKey || e.ctrlKey || e.metaKey) return;
  const m = /^Digit([1-9])$/.exec(e.code);
  let handled = true;
  if (m) { const b = badgeButtons()[Number(m[1]) - 1]; if (b) b.click(); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const vis = [...document.querySelectorAll('.tab')].filter((b) => !b.hidden);
    const i = vis.findIndex((b) => b.classList.contains('active'));
    if (vis.length) setTab(vis[(i + (e.code === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length].dataset.tab);
  } else if (e.code === 'KeyZ') { queue.pop(); renderQueue(); save(); }
  else if (e.code === 'KeyX') $('clearQueue').click();
  else if (e.code === 'KeyF') $('hsearch').focus();
  else if (e.code === 'KeyT') { $('time').focus(); $('time').select(); }
  else handled = false;
  if (handled) e.preventDefault();
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
  status(''); // alte Fehlermeldung nicht neben einem erfolgreichen Eintrag stehen lassen
  stage(out.text);
  if (out.shift) shiftTime(out.shift);
  tab.clear.forEach((id) => { tab.fields[id].value = ''; });
}

function renderBlock(tab, b) {
  const before = tab.panel.childNodes.length;
  renderBlockInner(tab, b);
  if (b.when) [...tab.panel.childNodes].slice(before).forEach((el) => whenEls.push({ el, cond: b.when }));
}

function renderBlockInner(tab, b) {
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
      if (it && it.when) whenEls.push({ el: btn, cond: it.when });
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
  kindLabel.append(document.createTextNode(b.kindLabel || t('compose.kind')));
  const sel = h('select');
  names.forEach((n) => { const o = h('option', null, b.kinds[n].label || n); o.value = n; sel.appendChild(o); });
  kindLabel.appendChild(sel);
  const whoLabel = h('label');
  whoLabel.append(document.createTextNode(b.whoLabel || t('compose.who')));
  const who = h('input');
  whoLabel.appendChild(who);
  cols.append(kindLabel, whoLabel);
  const textLabel = h('label');
  textLabel.append(document.createTextNode(b.textLabel || t('compose.text')));
  const text = h('textarea');
  text.rows = 3;
  textLabel.appendChild(text);
  const quick = h('div', 'quick');
  const add = h('button', 'stage', t('compose.add'));

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
  if (!cfg) { el.appendChild(h('p', 'hint', t('sc.none'))); return; }
  let current = null;
  const inputs = {};
  const all = () => [...cfg.items, ...customScenarios];

  el.appendChild(h('p', 'hint', t('sc.hint')));
  el.appendChild(h('div', 'cap', t('sc.cap')));
  const list = h('div', 'grid');
  el.appendChild(list);
  const rowBtns = h('div', 'row');
  const rnd = h('button', null, t('sc.random'));
  const empty = h('button', null, t('sc.empty'));
  rowBtns.append(rnd, empty);
  el.appendChild(rowBtns);
  el.appendChild(h('div', 'cap', t('sc.details')));

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
  twistText.placeholder = t('sc.twistPh');
  if (cfg.twist) {
    const cols = h('div', 'cols');
    const l1 = h('label'); l1.append(document.createTextNode(t('sc.complication')));
    mode = h('select');
    [['choose', t('sc.comp.choose')], ['none', t('sc.comp.none')], ['spoiler', t('sc.comp.spoiler')]].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; mode.appendChild(o); });
    l1.appendChild(mode);
    const l2 = h('label'); l2.append(document.createTextNode(t('sc.intensity')));
    level = h('select');
    [['light', t('sc.lvl.light')], ['medium', t('sc.lvl.medium')], ['hard', t('sc.lvl.hard')]].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; level.appendChild(o); });
    level.value = 'medium';
    l2.appendChild(level);
    cols.append(l1, l2);
    const det = h('details');
    det.append(h('summary', null, t('sc.twistSummary')), twistText);
    el.append(cols, det);
  }

  const stageBtn = h('button', 'stage', t('sc.stage'));
  const saveBtn = h('button', null, t('sc.save'));
  const delBtn = h('button', null, t('sc.delete'));
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
    if (missing.length) return status(t('sc.missing', { names: missing.map((f) => f.label).join(t('sc.and')) }), false);
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
    if (!sc.title) return status(t('sc.titleMissing'), false);
    sc.custom = true;
    sc.id = 'custom-' + sc.title.toLowerCase().replace(/\W+/g, '-');
    customScenarios = customScenarios.filter((c) => c.id !== sc.id);
    customScenarios.push(sc);
    save();
    renderList();
    fill(sc);
    status(t('sc.saved'));
  };
  delBtn.onclick = () => {
    if (!current || !current.custom) return;
    customScenarios = customScenarios.filter((c) => c.id !== current.id);
    save();
    renderList();
    fill(null);
    status(t('sc.deleted'));
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
  $('lblActor').textContent = (profile.settingsLabels || {}).actor || t('settings.actor');
  $('lblWorld').textContent = (profile.settingsLabels || {}).world || t('settings.world');
}

function renderTabs() {
  const nav = $('tabs');
  const panels = $('panels');
  nav.innerHTML = '';
  panels.innerHTML = '';
  tabs = [];
  whenEls = [];
  profile.tabs.forEach((def) => {
    const btn = h('button', 'tab', def.label);
    btn.dataset.tab = def.id;
    btn.onclick = () => setTab(def.id);
    if (def.when) whenEls.push({ el: btn, cond: def.when });
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
  if (!profile || previewing) return;
  const t = {};
  Object.entries(THEME_IDS).forEach(([k, id]) => { t[k] = $(id).checked; });
  chrome.storage.local.set({ [key('theme')]: t });
}

function renderHud(st) {
  const hud = $('hud');
  lastState = st || null;
  applyWhen();
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
    nodes.push(h('div', null, reason || t('mind.none')));
    showMindbar(nodes);
    return;
  }
  nodes.push(h('div', null, t('mind.unknown', { id: mindId, title: title ? ' – ' + title : '' })));
  const row = h('div', 'row');
  const sel = h('select');
  MindProfiles.list.forEach((p) => { const o = h('option', null, p.name); o.value = p.id; sel.appendChild(o); });
  const btn = h('button', 'primary', t('mind.assign'));
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
  if (refreshing || editing) return;
  refreshing = true;
  try {
    const tab = await findVeniceTab();
    if (!tab) { showUnknown(null, null, t('status.noTab')); return; }
    const { mindMap } = await chrome.storage.local.get('mindMap');
    const d = MindProfiles.detect(tab.url, tab.title, mindMap);
    if (!d.profile) { showUnknown(d.mindId, tab.title); return; }
    lastUnknown = '';
    if (!profile || profile.id !== d.profile.id) await applyProfile(d.profile);
    currentMind = d;
    const b = h('div');
    b.append(h('b', null, profile.name), document.createTextNode(t('mind.detected', { source: t('mind.src.' + d.source) }) + (d.mindId ? ' (' + d.mindId + ')' : '')));
    showMindbar([b]);
    $('unassign').hidden = d.source !== 'assigned';
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
    else shortcut(e);
  });
  $('hsearch').addEventListener('input', () => { historyFilter = $('hsearch').value.trim(); renderHistory(); });
  $('macroSave').onclick = () => addFav($('macroName').value.trim(), [...queue]);
  $('slotSave').onclick = saveSlot;
  $('relaySetA').onclick = () => setRelay('a');
  $('relaySetB').onclick = () => setRelay('b');
  $('relayAB').onclick = () => relayNow('a', 'b');
  $('relayBA').onclick = () => relayNow('b', 'a');
  renderRelay();
  $('hExportMd').onclick = () => exportSession('md');
  $('hExportJson').onclick = () => exportSession('json');
  $('hClear').onclick = () => { history = history.filter((e) => e.pin); renderHistory(); save(); };
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
  id: 'mymind',
  name: 'My Mind',
  mindIds: ['PUT-THE-MIND-ID-HERE'],
  titleMatch: 'My Mind',
  defaultTime: '12:00',
  prefixes: { actor: 'OPERATOR', world: 'WORLD' },
  settingsLabels: { actor: 'Prefix operator', world: 'Prefix world' },
  theme: {
    fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d',
    deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255',
  },
  header: { logo: 'MY MIND', meta: [['PLACE', 'somewhere · SID {sid}']], prompt: 'op@host:~#' },
  eventKinds: { ACTION: '#ffb000', REPORT: '#ff5252' },
  state: { parts: [{ key: 'loc', icon: '📍' }], numbers: [], meters: [] },
  statusRight: '{loc|—}',
  tabs: [
    { id: 'action', label: { en: 'ACTION', de: 'AKTION' }, blocks: [
      { type: 'field', id: 'target', label: { en: 'Target (optional)', de: 'Ziel (optional)' }, placeholder: { en: 'where / at what', de: 'wohin / worauf' }, clear: true },
      { type: 'grid', cap: { en: 'COMMANDS', de: 'BEFEHLE' }, items: [{ en: 'Observe', de: 'Beobachten' }, { en: 'Advance', de: 'Vorrücken' }],
        action: { who: 'actor', parts: ['ACTION'], body: ['{item}', '– {field.target}'] } },
    ] },
    { id: 'world', label: { en: 'WORLD', de: 'WELT' }, blocks: [
      { type: 'compose', kindLabel: { en: 'Type', de: 'Art' }, whoLabel: { en: 'Source', de: 'Quelle' }, textLabel: { en: 'Content', de: 'Inhalt' },
        kinds: { REPORT: { who: { en: '(optional)', de: '(optional)' }, text: { en: 'What happens?', de: 'Was passiert?' }, quick: [{ en: 'It starts to rain.', de: 'Es regnet.' }] } },
        action: { who: 'world', parts: ['{kind}', '{who}'], body: ['{text}'], requires: [{ need: 'text', msg: { en: 'Content missing.', de: 'Inhalt fehlt.' } }] } },
    ] },
  ],
  convention: 'Lines in square brackets starting with "{hp}" are the user\'s actions. Lines starting with "{wp}" are events in the world. The time is the in-world time. End every answer with: ⏱ HH:MM · 📍 place',
};

const download = (name, text, mime = 'application/json') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
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

const nameOf = (p) => MindProfiles.resolve(p.name, I18n.lang);

async function importProfiles(file) {
  if (!file) return;
  if (file.size > 300000) return pmsg(t('profiles.tooBig'), false);
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return pmsg(t('profiles.badJson', { msg: e.message }), false); }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.profiles) ? data.profiles : [data];
  const { customProfiles } = await chrome.storage.local.get('customProfiles');
  const next = { ...(customProfiles || {}) };
  const done = [];
  for (const p of list) {
    const v = MindProfiles.validate(p);
    const problems = MindProfiles.explain(v.errors, I18n.lang);
    if (v.ok && MindProfiles.builtins.some((b) => b.id === p.id)) problems.push(t('profiles.idTaken', { id: p.id }));
    if (problems.length) return pmsg(t('profiles.notImported', { id: (p && p.id) || '?' }), false, problems);
    done.push(next[p.id] ? t('profiles.replaced', { name: nameOf(p) }) : nameOf(p));
    next[p.id] = p;
  }
  await chrome.storage.local.set({ customProfiles: next });
  pmsg(t('profiles.imported', { names: done.join(', ') }));
}

function renderProfileManager() {
  const ul = $('plist');
  ul.innerHTML = '';
  MindProfiles.list.forEach((p) => {
    const li = h('li');
    const isCustom = MindProfiles.custom.some((c) => c.id === p.id);
    li.appendChild(h('span', null, `${p.name} · ${(p.mindIds || []).join(', ') || t('profiles.onlyTitle')}${isCustom ? ' · ' + t('profiles.custom') : ''}`));
    const ex = h('button', null, '↓');
    ex.title = t('profiles.export');
    ex.onclick = () => download(`${p.id}.profile.json`, JSON.stringify(MindProfiles.raw(p.id) || p, null, 2));
    li.appendChild(ex);
    const ed = h('button', null, isCustom ? t('profiles.edit') : t('profiles.copy'));
    ed.title = t(isCustom ? 'profiles.editTitle' : 'profiles.copyTitle');
    ed.onclick = () => (isCustom ? openEditor(MindProfiles.raw(p.id), { id: p.id }) : openEditor(copyOf(MindProfiles.raw(p.id)), { copy: true }));
    li.appendChild(ed);
    if (isCustom) {
      const del = h('button', null, '×');
      del.title = t('profiles.delete');
      del.onclick = async () => {
        const { customProfiles } = await chrome.storage.local.get('customProfiles');
        const next = { ...(customProfiles || {}) };
        delete next[p.id];
        await chrome.storage.local.set({ customProfiles: next });
        pmsg(t('profiles.deleted', { name: p.name }));
      };
      li.appendChild(del);
    }
    ul.appendChild(li);
  });
}

function initProfileManager() {
  $('pimport').onclick = () => $('pfile').click();
  $('pfile').onchange = async (e) => { await importProfiles(e.target.files[0]); e.target.value = ''; };
  $('pnew').onclick = () => openEditor(TEMPLATE, { fresh: true });
  $('ptemplate').onclick = () => download(t('profiles.templateFile'), JSON.stringify(TEMPLATE, null, 2));
  const copyPrompt = (file) => async () => {
    try {
      const md = await (await fetch(chrome.runtime.getURL(file))).text();
      const text = md.split('<!-- PROMPT START -->')[1].split('<!-- PROMPT END -->')[0].trim();
      await navigator.clipboard.writeText(text);
      pmsg(t('profiles.promptCopied'));
    } catch (e) { pmsg(t('profiles.copyFailed', { msg: e.message }), false); }
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

/* ---------- Profil-Editor ---------- */
let edOrigId = null;
let edTimer;

function copyOf(raw) {
  const taken = new Set(MindProfiles.list.map((p) => p.id));
  let id = `${raw.id}-copy`;
  for (let i = 2; taken.has(id); i++) id = `${raw.id}-copy${i}`;
  const suffix = (n) => (typeof n === 'string' ? `${n} (copy)` : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, `${v} (copy)`])));
  // Die Kopie erkennt zunächst kein Mind selbst: mindIds leeren, Titel anpassen.
  return { ...JSON.parse(JSON.stringify(raw)), id, name: suffix(raw.name), mindIds: [], titleMatch: '<edit me>' };
}

function lineCol(text, pos) {
  const before = text.slice(0, pos).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

function jumpTo(pos) {
  const ta = $('edText');
  ta.focus();
  ta.setSelectionRange(pos, Math.min(pos + 1, ta.value.length));
  const { line } = lineCol(ta.value, pos);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 16;
  ta.scrollTop = Math.max(0, (line - 3) * lh);
}

function edStatus(msg, ok = true) {
  const e = $('edStatus');
  e.textContent = msg;
  e.className = 'status ' + (ok ? 'ok' : 'err');
}

// Prüft den Text im Editor. Gibt das Profil zurück, wenn es gültig ist, sonst null.
function checkDraft() {
  const ul = $('edErrors');
  ul.innerHTML = '';
  const text = $('edText').value;
  let obj;
  try { obj = JSON.parse(text); } catch (e) {
    let pos = /position (\d+)/.exec(e.message);
    let at = pos ? Number(pos[1]) : null;
    if (at == null) { const lc = /line (\d+) column (\d+)/.exec(e.message); if (lc) { const lines = text.split('\n'); at = lines.slice(0, lc[1] - 1).reduce((n, l) => n + l.length + 1, 0) + Number(lc[2]) - 1; } }
    const where = at != null ? lineCol(text, at) : null;
    edStatus(t('editor.syntax'), false);
    const li = h('li', 'jump', where ? t('editor.at', { line: where.line, col: where.col, msg: e.message }) : e.message);
    if (at != null) li.onclick = () => jumpTo(at);
    ul.appendChild(li);
    return null;
  }
  const v = MindProfiles.validate(obj);
  const problems = MindProfiles.explain(v.errors, I18n.lang);
  if (v.ok && MindProfiles.builtins.some((b) => b.id === obj.id)) problems.push(t('profiles.idTaken', { id: obj.id }));
  if (v.ok && edOrigId !== obj.id && MindProfiles.custom.some((c) => c.id === obj.id)) problems.push(t('editor.idExists', { id: obj.id }));
  if (problems.length) {
    edStatus(t('editor.problems', { n: problems.length }), false);
    problems.forEach((m) => ul.appendChild(h('li', null, m)));
    return null;
  }
  edStatus(t('editor.valid'));
  return obj;
}

function openEditor(raw, opts = {}) {
  editing = true;
  previewing = false;
  edOrigId = opts.id || null;
  $('edTitle').textContent = t(opts.id ? 'editor.titleEdit' : 'editor.titleNew', { id: opts.id || '' });
  $('edText').value = JSON.stringify(raw, null, 2);
  $('app').hidden = true;
  $('editor').hidden = false;
  checkDraft();
  if (opts.copy) edStatus(t('editor.copyNote'), true);
  $('editor').scrollIntoView();
}

function closeEditor() {
  editing = false;
  previewing = false;
  $('editor').hidden = true;
  lastUnknown = '';
  profile = null; // wieder das echte Profil des Tabs aufbauen
  refreshMind();
}

async function previewDraft() {
  const obj = checkDraft();
  if (!obj) return;
  previewing = true;
  await applyProfile(MindProfiles.resolve(obj, I18n.lang));
  edStatus(t('editor.previewing'));
}

async function saveDraft() {
  const obj = checkDraft();
  if (!obj) return;
  const { customProfiles } = await chrome.storage.local.get('customProfiles');
  const next = { ...(customProfiles || {}) };
  if (edOrigId && edOrigId !== obj.id) delete next[edOrigId]; // umbenannt
  next[obj.id] = obj;
  previewing = false;
  await chrome.storage.local.set({ customProfiles: next });
  closeEditor();
  pmsg(t('profiles.imported', { names: nameOf(obj) }));
  $('profileMgr').open = true;
}

function initEditor() {
  $('edText').addEventListener('input', () => { clearTimeout(edTimer); edTimer = setTimeout(checkDraft, 250); });
  $('edPreview').onclick = previewDraft;
  $('edSave').onclick = saveDraft;
  $('edClose').onclick = closeEditor;
}

function setLanguage(l) {
  I18n.setLang(l);
  MindProfiles.setLang(I18n.lang);
  I18n.apply();
  $('lang').value = I18n.lang;
  renderProfileManager();
  status('');
}

function initLang() {
  I18n.LANGS.forEach(([code, name]) => { const o = h('option', null, name); o.value = code; $('lang').appendChild(o); });
  $('lang').onchange = async () => {
    await chrome.storage.local.set({ lang: $('lang').value });
    setLanguage($('lang').value);
    lastUnknown = '';
    profile = null; // Reiter, Beschriftungen und Szenarien in der neuen Sprache aufbauen
    refreshMind();
  };
}

(async () => {
  const { lang } = await chrome.storage.local.get('lang');
  I18n.setLang(lang);
  MindProfiles.setLang(I18n.lang);
  await new Promise((r) => MindProfiles.init(r));
  initLang();
  setLanguage(I18n.lang);
  initStatic();
  initProfileManager();
  initEditor();
  await refreshMind();
  setInterval(refreshMind, 3000); // Fängt Seitenwechsel in der Single-Page-App ab
})();
