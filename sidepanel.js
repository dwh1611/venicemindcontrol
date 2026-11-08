const $ = (id) => document.getElementById(id);
const t = (k, p) => I18n.t(k, p);
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/* ---------- Zustand ---------- */
const TAB_MODE = new URLSearchParams(location.search).get('mode') === 'tab';
if (TAB_MODE) document.body.classList.add('fullpage');
let pinnedTab = null;    // Vollbild: festgelegter Venice-Tab (null = automatisch)
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
let vars = {};           // Spielzustand des Panels: { hp: 5, items: ['key'] }
let rollLog = [];        // letzte Würfe [{ at, text }]
let evDone = [];         // IDs ausgelöster Ereignisse
let evStart = '';        // Uhr beim Start der Ereignisse (Bezug für "in")
let dynGrids = [];       // Funktionen, die Buttons aus Listen neu aufbauen
let rng = Math.random;
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
const DATA_IDS = ['time', 'hprefix', 'wprefix', 'advance', 'order', 'seed'];
const DATA_CHECKS = ['append', 'autosend', 'instant', 'sendState'];

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
  $('sendState').checked = d.sendState !== undefined ? d.sendState : true;
  $('seed').value = d.seed || '';
  setSeed($('seed').value);
  vars = initVars(d.vars);
  rollLog = d.rollLog || [];
  evDone = d.evDone || [];
  evStart = d.evStart || clock();
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
  renderVars();
  renderEvents();
  renderRolls();
}

function save() {
  if (!profile || previewing) return;
  const d = { history, queue, customScenarios, vars, rollLog, evDone, evStart };
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

const hhmmOf = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function shiftTime(minutes) {
  const before = clockMinutes();
  const total = (before + Math.ceil(minutes) + 1440 * 10) % 1440;
  $('time').value = hhmmOf(total);
  fireEvents(before, total);
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
  let body;
  if (!ev) body = user;
  else if (!user) body = ev;
  else body = $('order').value === 'userFirst' ? `${user}\n\n${ev}` : `${ev}\n\n${user}`;
  const sl = body ? stateLine() : '';
  return sl ? `${body}\n\n${sl}` : body;
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

const snapshot = (name) => ({ name, at: Date.now(), time: clock(), queue: [...queue], history: history.map((e) => ({ ...e })), userText: $('userText').value, vars: clone(vars), evDone: [...evDone], evStart });

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
  if (s.vars) vars = initVars(s.vars);
  evDone = s.evDone ? [...s.evDone] : evDone;
  evStart = s.evStart || evStart;
  renderVars();
  renderHud(lastState);
  renderEvents();
  renderQueue();
  renderHistory();
  renderSlots();
  save();
  saveExtra();
  status(t('slots.loaded', { name: s.name }));
}

/* ---------- Relay zwischen zwei Minds ---------- */
const relay = { a: null, b: null }; // { id, title, name, profile }
const replyPrint = (res) => `${res.count}:${res.text.length}:${res.text.slice(-60)}`;
// Venice zeigt während des Schreibens Platzhalter ("Loading...", "Thinking..."). Sie sind keine Antwort.
const PLACEHOLDER = /^(loading|thinking|generating|typing|working|lädt|wird geladen|denkt nach|schreibt|generiert)(\s*(\.{2,}|…))?$/i;
const cleanReply = (text) => String(text).split('\n').filter((l) => !PLACEHOLDER.test(l.trim())).join('\n').trim();
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
  if (auto.on) autoStop('auto.stopped.manual'); // anderer Tab: Automatik anhalten
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
  const reply = cleanReply(res.text);
  if (!reply) return status(t('relay.pending', { name: src.name }), false); // Antwort wird noch geschrieben
  // Schutz vor doppeltem Senden: dieselbe Antwort nur nach einem zweiten Klick erneut weitergeben.
  const print = replyPrint({ count: res.count, text: reply });
  if (lastRelayed[key] === print && !relayRepeat[key]) { relayRepeat[key] = true; return status(t('relay.again'), false); }
  const text = relayLine(src, dst, reply, await relayClock(dst, src), $('relayStrip').checked);
  const sendNow = $('relaySend').checked;
  const ok = await inject(text, { send: sendNow, append: $('append').checked }, dst.id);
  if (!ok) return;
  lastRelayed[key] = print;
  relayRepeat[key] = false;
  status(t(sendNow ? 'relay.doneSent' : 'relay.done', { from: src.name, to: dst.name }));
}

/* ---------- Auto-Forward ----------
   Beobachtet die beiden Tabs und gibt jede neue, fertige Antwort selbst weiter (und sendet sie).
   "Fertig" heißt: die Antwort hat sich für auto.wait Sekunden nicht mehr verändert.
   Schutz vor Endlosschleifen: Maximalzahl, Stopp bei geschlossenem Tab, Leerlauf-Timeout, STOP-Leiste. */
const AUTO_TICK_MS = 1000;
const AUTO_IDLE_MS = 180000;
const auto = { on: false, timer: null, busy: false, rounds: 0, max: 5, wait: 4, mode: 'ab', seen: {}, pending: {}, lastActivity: 0 };
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

async function readReply(tab) {
  try { return await chrome.tabs.sendMessage(tab.id, { type: 'lastReply' }); } catch { /* Content-Script fehlt evtl. noch */ }
  try { await ensureContentScript(tab.id); return await chrome.tabs.sendMessage(tab.id, { type: 'lastReply' }); } catch { return null; }
}

function renderAuto() {
  $('autoBar').hidden = !auto.on;
  $('autoBarText').textContent = auto.on ? t('auto.bar', { n: auto.rounds, max: auto.max }) : '';
  $('autoStart').disabled = auto.on;
  ['autoMode', 'autoMax', 'autoWait'].forEach((id) => { $(id).disabled = auto.on; });
}

async function autoStart() {
  const a = await relayTab('a');
  const b = await relayTab('b');
  if (!a || !b) return status(t('relay.needBoth'), false);
  auto.mode = $('autoMode').value;
  auto.max = clamp(parseInt($('autoMax').value, 10) || 5, 1, 50);
  auto.wait = clamp(parseInt($('autoWait').value, 10) || 4, 1, 30);
  auto.rounds = 0; auto.pending = {}; auto.seen = {}; auto.lastActivity = Date.now();
  // Ausgangslage: Was schon in den Chats steht, wird nicht weitergegeben.
  for (const [slot, tab] of [['a', a], ['b', b]]) {
    const r = await readReply(tab);
    const body = r && r.ok ? cleanReply(r.text) : '';
    auto.seen[slot] = body ? replyPrint({ count: r.count, text: body }) : '';
  }
  auto.on = true;
  auto.timer = setInterval(autoTick, AUTO_TICK_MS);
  renderAuto();
  status(t('auto.started'));
}

function autoStop(key, params) {
  clearInterval(auto.timer);
  auto.timer = null;
  auto.on = false;
  renderAuto();
  if (key) status(t(key, params), key === 'auto.stopped.manual' || key === 'auto.stopped.max');
}

async function autoTick() {
  if (!auto.on || auto.busy) return;
  auto.busy = true;
  try {
    const pairs = auto.mode === 'both' ? [['a', 'b'], ['b', 'a']] : auto.mode === 'ab' ? [['a', 'b']] : [['b', 'a']];
    const tabs = { a: await relayTab('a'), b: await relayTab('b') };
    if (!tabs.a || !tabs.b) return autoStop('auto.stopped.tab');
    for (const [from, to] of pairs) {
      const r = await readReply(tabs[from]);
      const body = r && r.ok ? cleanReply(r.text) : '';
      if (!body) { delete auto.pending[from]; continue; } // noch nichts da oder nur Platzhalter
      const print = replyPrint({ count: r.count, text: body });
      if (print === auto.seen[from]) { delete auto.pending[from]; continue; }
      const p = auto.pending[from];
      if (!p || p.print !== print) { auto.pending[from] = { print, since: Date.now() }; continue; } // noch im Fluss
      if (Date.now() - p.since < auto.wait * 1000) continue;
      const text = relayLine(tabs[from], tabs[to], body, await relayClock(tabs[to], tabs[from]), $('relayStrip').checked);
      const ok = await inject(text, { send: true, append: false }, tabs[to].id);
      if (!ok) return autoStop('auto.stopped.error', { msg: $('status').textContent.replace(/^✗ /, '') });
      auto.seen[from] = print;
      delete auto.pending[from];
      lastRelayed[from + to] = print;
      auto.rounds++;
      auto.lastActivity = Date.now();
      renderAuto();
      status(t('auto.forwarded', { from: tabs[from].name, to: tabs[to].name, n: auto.rounds, max: auto.max }));
      if (auto.rounds >= auto.max) return autoStop('auto.stopped.max', { max: auto.max });
      break; // pro Takt höchstens eine Weitergabe
    }
    if (auto.on && Date.now() - auto.lastActivity > AUTO_IDLE_MS) autoStop('auto.stopped.idle');
  } finally {
    auto.busy = false;
  }
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
    variables: clone(vars),
    rolls: rollLog.map((r) => ({ at: new Date(r.at).toISOString(), text: r.text })),
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
  if (TAB_MODE && pinnedTab != null) {
    const p = found.find((x) => x.id === pinnedTab);
    if (p) return p;
    pinnedTab = null; // Tab wurde geschlossen: zurück auf automatisch
  }
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

/* ---------- Vollbild-Modus ---------- */
let targetSig = '';
async function renderTarget() {
  if (!TAB_MODE) return;
  $('targetBar').hidden = false;
  const found = (await chrome.tabs.query({ url: URL_PATTERNS })).sort((a, b) => a.id - b.id);
  if (pinnedTab != null && !found.some((x) => x.id === pinnedTab)) pinnedTab = null;
  const sig = JSON.stringify([I18n.lang, pinnedTab, found.map((x) => [x.id, x.title])]);
  if (sig === targetSig) return;
  targetSig = sig;
  const sel = $('target');
  sel.innerHTML = '';
  const opt = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
  sel.appendChild(opt('', t('full.auto')));
  found.forEach((x) => sel.appendChild(opt(String(x.id), `#${x.id} · ${(x.title || x.url || '').slice(0, 60)}`)));
  sel.value = pinnedTab == null ? '' : String(pinnedTab);
}

/* ---------- Chat-Formatierung (nur Text-Knoten, keine fremden Attribute) ---------- */
const CHAT_TAGS = new Set(['P', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'UL', 'OL', 'LI', 'CODE', 'PRE', 'BR', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
function cleanNode(src, dst) {
  src.childNodes.forEach((n) => {
    if (n.nodeType === 3) dst.appendChild(document.createTextNode(n.textContent));
    else if (n.nodeType === 1) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(n.tagName)) return;
      if (CHAT_TAGS.has(n.tagName)) { const e = document.createElement(n.tagName.toLowerCase()); cleanNode(n, e); dst.appendChild(e); }
      else cleanNode(n, dst); // unbekanntes Element: nur der Inhalt bleibt (z. B. div, span, a)
    }
  });
}
const EVENT_RX = /^\[([^\]·]+?)\s*·\s*(\d{1,2}:\d{2})\s*·\s*([^·\]]+?)(?:\s*·\s*([^\]]+))?\]\s*([\s\S]*)$/;
function eventRow(p) {
  const m = EVENT_RX.exec(p.textContent.trim());
  if (!m) return null;
  const color = profile && profile.eventKinds && profile.eventKinds[m[3].trim()];
  const row = h('div', 'ev');
  const chip = h('span', 'chip', m[3].trim());
  if (color) chip.style.color = color;
  row.append(chip, h('span', 'meta', m[2] + ' · ' + m[1].trim() + (m[4] ? ' · ' + m[4].trim() : '')));
  if (m[5]) row.appendChild(h('span', 'txt', m[5]));
  return row;
}
function chatBody(m) {
  const wrap = document.createElement('div');
  if (m.html) cleanNode(new DOMParser().parseFromString(m.html, 'text/html').body, wrap);
  else m.text.split(/\n\n+/).forEach((para) => wrap.appendChild(h('p', null, para)));
  [...wrap.children].forEach((c) => {
    if (c.tagName !== 'P') return;
    const txt = c.textContent.trim();
    if (m.role === 'mind' && txt.startsWith('⏱')) c.className = 'hud';
    else if (m.role === 'user') { const r = eventRow(c); if (r) c.replaceWith(r); }
  });
  return wrap;
}

let chatSig = '';
let chatBusy = false;
async function renderChat() {
  if (!TAB_MODE || chatBusy) return;
  chatBusy = true;
  try { await drawChat(); } finally { chatBusy = false; }
}
async function drawChat() {
  $('chatPane').hidden = false;
  const list = $('chatList');
  const tab = await findVeniceTab();
  const note = (txt) => { list.innerHTML = ''; list.appendChild(h('div', 'note', txt)); chatSig = ''; };
  if (!tab) return note(t('chat.none'));
  const [sigTab, ...sigRest] = chatSig.split('|');
  const sig = sigTab === String(tab.id) ? sigRest.join('|') : '';
  let res = null;
  try { await ensureContentScript(tab.id); res = await chrome.tabs.sendMessage(tab.id, { type: 'transcript', sig }); } catch { /* Tab lädt noch */ }
  if (!res || !res.ok || res.same) return;
  chatSig = tab.id + '|' + res.sig;
  const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  list.innerHTML = '';
  $('chatInfo').textContent = (res.title || '').slice(0, 60);
  if (res.total > res.messages.length) list.appendChild(h('div', 'note', t('chat.more', { n: res.total - res.messages.length })));
  if (!res.messages.length) list.appendChild(h('div', 'note', t('chat.empty')));
  res.messages.forEach((m) => {
    const box = h('div', 'msg ' + m.role);
    box.appendChild(h('div', 'who', t(m.role === 'mind' ? 'chat.mind' : 'chat.you')));
    const body = h('div', 'body');
    body.appendChild(chatBody(m));
    box.appendChild(body);
    list.appendChild(box);
  });
  if (atEnd) list.scrollTop = list.scrollHeight;
}

const FULL = { layout: 'right', cf: 15 };
function applyFull() {
  const b = document.body;
  b.classList.toggle('lay-right', FULL.layout === 'right');
  b.classList.toggle('lay-bottom', FULL.layout === 'bottom');
  b.style.setProperty('--cf', FULL.cf + 'px');
  try { localStorage.setItem('fullPrefs', JSON.stringify({ ...FULL, termW: b.style.getPropertyValue('--termW'), chatH: b.style.getPropertyValue('--chatH') })); } catch { /* ignore */ }
}
function initSplitter() {
  const sp = $('splitter');
  sp.hidden = false;
  const b = document.body;
  try {
    const p = JSON.parse(localStorage.getItem('fullPrefs') || '{}');
    if (p.layout === 'right' || p.layout === 'bottom') FULL.layout = p.layout;
    if (p.cf >= 11 && p.cf <= 28) FULL.cf = p.cf;
    if (p.termW) b.style.setProperty('--termW', p.termW);
    if (p.chatH) b.style.setProperty('--chatH', p.chatH);
  } catch { /* ignore */ }
  applyFull();
  $('layBtn').onclick = () => { FULL.layout = FULL.layout === 'right' ? 'bottom' : 'right'; applyFull(); };
  $('cfMinus').onclick = () => { FULL.cf = Math.max(11, FULL.cf - 1); applyFull(); };
  $('cfPlus').onclick = () => { FULL.cf = Math.min(28, FULL.cf + 1); applyFull(); };
  sp.onpointerdown = (e) => {
    sp.setPointerCapture(e.pointerId);
    sp.onpointermove = (ev) => {
      if (FULL.layout === 'right') b.style.setProperty('--termW', Math.max(300, Math.min(window.innerWidth - 260, ev.clientX)) + 'px');
      else b.style.setProperty('--chatH', Math.max(120, Math.min(window.innerHeight - 160, window.innerHeight - ev.clientY)) + 'px');
    };
    sp.onpointerup = () => { sp.onpointermove = null; sp.onpointerup = null; applyFull(); };
  };
}

function initComposer() {
  const input = $('chatInput');
  const cs = $('chatStatus');
  const sendChat = async () => {
    const text = input.value.trim();
    if (!text || $('chatSend').disabled) return;
    $('chatSend').disabled = true;
    try {
      const ok = await inject(text, { send: true, append: false });
      cs.className = 'cstat' + (ok ? '' : ' err');
      cs.textContent = ok ? t('chat.sentOk') : $('status').textContent;
      if (ok) { input.value = ''; chatSig = ''; renderChat(); }
    } finally { $('chatSend').disabled = false; input.focus(); }
  };
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Konsolen-Kürzel (Alt+…, Strg+Enter) gelten hier nicht
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); }
  });
}

function initFullpage() {
  $('openTab').onclick = async () => {
    const tab = await findVeniceTab();
    const q = '?mode=tab' + (tab ? '&tab=' + tab.id : '');
    await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html' + q) });
  };
  if (!TAB_MODE) return;
  initSplitter();
  initComposer();
  const want = parseInt(new URLSearchParams(location.search).get('tab'), 10);
  if (!isNaN(want)) pinnedTab = want;
  $('target').onchange = () => {
    pinnedTab = $('target').value ? parseInt($('target').value, 10) : null;
    if (auto.on) autoStop('auto.stopped.manual'); // anderes Ziel: Automatik anhalten
    profile = null; // Profil des neuen Tabs neu erkennen
    refreshMind();
  };
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
  // Würfel und Zufallstabellen (nach den Pflichtfeldern, damit ein Fehler keinen Wurf verbraucht)
  const logs = [];
  if (a.roll) {
    const r = doRoll(a.roll, scope);
    if (!r) return status(t('roll.bad'), false);
    scope.roll = r;
    logs.push(r.label ? `${r.label} · ${r.text}` : r.text);
  }
  if (a.table) {
    const pick = pickTable(a.table, scope);
    if (pick == null) return status(t('table.missing', { name: a.table }), false);
    scope.table = pick.text;
    logs.push(`${pick.name}: ${pick.text}`);
  }
  const body = P.segments(a.body, scope);
  // "raw": reiner Text ohne [PRÄFIX · Uhrzeit …]-Klammer, z. B. für Slash-Befehle.
  const text = a.format === 'raw'
    ? [P.parts(a.parts, scope).join(' '), body].filter(Boolean).join(' ')
    : line(a.who === 'world' ? wp() : hp(), P.parts(a.parts, scope), body);
  if (!applyEffects(a, scope)) return null;
  logs.forEach((l) => rollLog.unshift({ at: Date.now(), text: l }));
  if (logs.length) { rollLog = rollLog.slice(0, 20); renderRolls(); }
  return a.shift && minutes ? { text, shift: minutes } : text;
}

/* ---------- Würfel und Zufallstabellen ---------- */
function setSeed(s) {
  s = String(s || '').trim();
  if (!s) { rng = Math.random; return; }
  let hsh = 2166136261;
  for (const c of s) { hsh ^= c.charCodeAt(0); hsh = Math.imul(hsh, 16777619); }
  let a = hsh >>> 0;
  rng = () => { // mulberry32: gleicher Seed, gleiche Würfe
    a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function doRoll(spec, scope) {
  const P = MindProfiles;
  const f = (v) => (v == null ? '' : P.fill(String(v), scope).text.trim());
  const d = P.parseDice(f(spec.dice) || 'd20');
  if (!d) return null;
  const mod = d.mod + (parseInt(f(spec.mod), 10) || 0);
  const rolls = Array.from({ length: d.n }, () => 1 + Math.floor(rng() * d.sides));
  const total = rolls.reduce((x, y) => x + y, 0) + mod;
  const vsRaw = f(spec.vs);
  const vs = vsRaw === '' || Number.isNaN(parseInt(vsRaw, 10)) ? null : parseInt(vsRaw, 10);
  const outcome = vs == null ? '' : total >= vs ? (spec.success || 'SUCCESS') : (spec.failure || 'FAILURE');
  const dice = `${d.n}d${d.sides}${mod ? (mod > 0 ? '+' : '') + mod : ''}`;
  const text = [vs == null ? String(total) : `${total} vs ${vs}`, outcome].filter(Boolean).join(' · ');
  return { total, vs: vs == null ? '' : vs, outcome, label: f(spec.label), dice, rolls: rolls.join('+'), text };
}

function pickTable(name, scope) {
  const key = MindProfiles.fill(String(name), scope).text.trim();
  const tb = (profile.tables || {})[key];
  if (!tb) return null;
  const ents = (Array.isArray(tb) ? tb : tb.entries).map((e) => (typeof e === 'string' ? { text: e, weight: 1 } : { text: e.text, weight: e.weight || 1 }));
  let r = rng() * ents.reduce((s, e) => s + e.weight, 0);
  for (const e of ents) { r -= e.weight; if (r < 0) return { name: (tb.label || key), text: e.text }; }
  return { name: (tb.label || key), text: ents[ents.length - 1].text };
}

function renderRolls() {
  const ul = $('rollList');
  ul.innerHTML = '';
  $('rollBox').hidden = !rollLog.length;
  rollLog.slice(0, 10).forEach((r) => { const li = h('li'); li.append(h('span', 'htime', hhmm(r.at)), h('span', null, r.text)); ul.appendChild(li); });
}

/* ---------- Spielzustand (Variablen) ---------- */
const clone = (x) => JSON.parse(JSON.stringify(x));

function initVars(saved) {
  const out = {};
  Object.entries(profile.variables || {}).forEach(([k, sp]) => {
    const s = saved && saved[k];
    const list = sp.type === 'list';
    out[k] = list ? (Array.isArray(s) ? s.slice() : clone(sp.value)) : (typeof s === 'number' ? s : sp.value);
  });
  return out;
}

const varLabel = (k) => (profile.variables[k].label || k);
const varShow = (k) => {
  const sp = profile.variables[k];
  const v = vars[k];
  if (sp.type === 'list') return v.length ? v.join(', ') : '—';
  return `${v}${sp.max != null ? '/' + sp.max : ''}`;
};

function stateLine() {
  if (!profile || !profile.variables || !$('sendState').checked) return '';
  const keys = Object.keys(profile.variables);
  if (!keys.length) return '';
  if (profile.stateLine) {
    const scope = {};
    keys.forEach((k) => { scope[k] = Array.isArray(vars[k]) ? vars[k].join(', ') : vars[k]; scope[k + 'Max'] = profile.variables[k].max; });
    return MindProfiles.fill(profile.stateLine, scope).text;
  }
  return line(wp(), ['STATE'], keys.map((k) => (profile.variables[k].type === 'list' ? `${varLabel(k)}: ${varShow(k)}` : `${varLabel(k)} ${varShow(k)}`)).join(' · '));
}

// Wendet set/add/push/remove an. Prüft die Grenzen, bevor etwas geändert wird.
function applyEffects(a, scope) {
  if (!profile.variables || !(a.set || a.add || a.push || a.remove)) return true;
  const spec = profile.variables;
  const next = clone(vars);
  const val = (v) => (typeof v === 'number' ? String(v) : MindProfiles.fill(String(v), scope).text.trim());
  const num = (v) => { const n = parseFloat(val(v).replace(',', '.')); return Number.isNaN(n) ? null : n; };
  const touched = new Set();
  for (const [k, v] of Object.entries(a.set || {})) { const n = num(v); if (n == null) return status(t('var.nan', { label: varLabel(k) }), false); next[k] = n; touched.add(k); }
  for (const [k, v] of Object.entries(a.add || {})) { const n = num(v); if (n == null) return status(t('var.nan', { label: varLabel(k) }), false); next[k] += n; touched.add(k); }
  for (const [k, v] of Object.entries(a.push || {})) { const s = val(v); if (s) next[k].push(s); touched.add(k); }
  for (const [k, v] of Object.entries(a.remove || {})) {
    const s = val(v).toLowerCase();
    const i = next[k].findIndex((x) => x.toLowerCase() === s);
    if (i < 0) return status(t('var.notIn', { item: val(v), label: varLabel(k) }), false);
    next[k].splice(i, 1); touched.add(k);
  }
  for (const k of touched) {
    const sp = spec[k];
    if (sp.type === 'list') continue;
    if (sp.min != null && next[k] < sp.min) return status(t('var.below', { label: varLabel(k), min: sp.min }), false);
    if (sp.max != null && next[k] > sp.max) return status(t('var.above', { label: varLabel(k), max: sp.max }), false);
  }
  vars = next;
  commitVars();
  return true;
}

// Nach jeder Änderung: HUD, Bedingungen, dynamische Buttons, Vorschau, Speicher.
function commitVars() {
  renderVars();
  renderHud(lastState);
  renderPreview();
  save();
}

function renderVars() {
  const box = $('varsList');
  box.innerHTML = '';
  const keys = Object.keys((profile && profile.variables) || {});
  $('varsBox').hidden = !keys.length;
  keys.forEach((k) => {
    const sp = profile.variables[k];
    const label = h('label');
    const input = h('input');
    if (sp.type === 'list') {
      input.value = vars[k].join(', ');
      input.placeholder = t('vars.listPh');
      input.onchange = () => { vars[k] = input.value.split(',').map((s) => s.trim()).filter(Boolean); commitVars(); };
    } else {
      input.type = 'number';
      if (sp.min != null) input.min = sp.min;
      if (sp.max != null) input.max = sp.max;
      input.value = vars[k];
      input.onchange = () => {
        const n = parseFloat(input.value);
        if (Number.isNaN(n) || (sp.min != null && n < sp.min) || (sp.max != null && n > sp.max)) { input.value = vars[k]; return status(t('vars.invalid', { label: varLabel(k) }), false); }
        vars[k] = n; commitVars();
      };
    }
    label.append(h('span', null, varLabel(k)), input);
    box.appendChild(label);
  });
}

/* ---------- Geplante Ereignisse ---------- */
const toMin = (hhmmStr) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmmStr || ''); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; };
const evAbs = (e) => (e.at ? toMin(e.at) : ((toMin(evStart) || 0) + e.in) % 1440);
const evPending = () => (profile.events || []).filter((e) => e.daily || !evDone.includes(e.id));
const evLine = (e) => `[${[wp(), profile.clock === false ? '' : hhmmOf(evAbs(e)), e.kind, e.who].filter(Boolean).join(' · ')}] ${e.text}`;

function queueEvents(list) {
  list.forEach((e) => { if (!e.daily && !evDone.includes(e.id)) evDone.push(e.id); });
  stageMany(list.map(evLine));
  renderEvents();
  save();
}

// Löst Ereignisse aus, deren Zeit zwischen den beiden Uhrzeiten liegt. Sprünge über 18 Stunden gelten als Zurücksetzen.
function fireEvents(from, to) {
  if (!profile || !profile.events || from == null || to == null) return;
  const delta = (to - from + 1440) % 1440;
  if (!delta || delta > 18 * 60) return;
  const due = evPending().map((e) => ({ e, off: (evAbs(e) - from + 1440) % 1440 })).filter((x) => x.off > 0 && x.off <= delta).sort((x, y) => x.off - y.off).map((x) => x.e);
  if (due.length) { queueEvents(due); status(t('events.queued', { n: due.length })); }
}

function renderEvents() {
  const ul = $('eventsList');
  ul.innerHTML = '';
  $('eventsBox').hidden = !(profile && profile.events && profile.events.length);
  if (!profile || !profile.events) return;
  const pend = evPending().sort((x, y) => ((evAbs(x) - clockMinutes() + 1440) % 1440) - ((evAbs(y) - clockMinutes() + 1440) % 1440));
  pend.forEach((e) => {
    const li = h('li');
    li.append(h('span', null, `${hhmmOf(evAbs(e))} · ${e.kind}${e.who ? ' · ' + e.who : ''} · ${e.text}`));
    const go = h('button', null, t('events.fire'));
    go.title = t('events.fireTitle');
    go.onclick = () => { queueEvents([e]); status(t('events.queued', { n: 1 })); };
    const skip = h('button', null, '×');
    skip.title = t('events.skip');
    skip.onclick = () => { if (!e.daily) evDone.push(e.id); renderEvents(); save(); };
    li.append(go, skip);
    ul.appendChild(li);
  });
  if (!pend.length) ul.appendChild(h('li', 'empty', t('events.none')));
}

// Liste für itemsFrom: zuerst eine Listen-Variable, sonst eine Liste aus der Statuszeile.
function listFor(key) {
  if (profile.variables && profile.variables[key]) return vars[key] || [];
  const v = lastState && lastState[key];
  return Array.isArray(v) ? v : [];
}

function setTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  tabs.forEach((t) => { t.panel.hidden = t.id !== id; });
  renderBadges();
}

/* ---------- Bedingungen ("when") ---------- */
// Zustand für "when": Statuszeile plus die Variablen des Panels (Variablen gelten immer).
function whenState() {
  const hasVars = profile && profile.variables;
  if (lastState == null && !hasVars) return null;
  return { ...(lastState || {}), ...(hasVars ? vars : {}) };
}

function refreshDynamic() {
  dynGrids.forEach((f) => f());
  applyWhen();
}

function applyWhen() {
  const ws = whenState();
  whenEls.forEach(({ el, cond }) => { el.hidden = !MindProfiles.test(cond, ws); });
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
    const mine = [];
    // Baut die Buttons aus items und (optional) itemsFrom, einer Liste aus Variablen oder der Statuszeile.
    const build = () => {
      whenEls = whenEls.filter((w) => !mine.includes(w.el));
      mine.length = 0;
      grid.innerHTML = '';
      const dyn = b.itemsFrom ? listFor(b.itemsFrom) : [];
      const all = [...(b.items || []), ...dyn];
      all.forEach((it) => {
        const btn = h('button', null, typeof it === 'string' ? it : it.label);
        btn.onclick = () => afterMake(tab, runAction(b.action, { item: it, field: tabVals(tab) }));
        if (it && it.when) { whenEls.push({ el: btn, cond: it.when }); mine.push(btn); }
        grid.appendChild(btn);
      });
      if (!all.length && b.empty) grid.appendChild(h('p', 'hint', b.empty));
    };
    build();
    if (b.itemsFrom) dynGrids.push(build);
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
  dynGrids = [];
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
  refreshDynamic();
  $('statusRight').textContent = profile.statusRight ? MindProfiles.fill(profile.statusRight, { ...(st || {}), ...vars }).text : '';
  const vk = Object.keys(profile.variables || {});
  const vtext = vk.map((k) => `${profile.variables[k].icon ? profile.variables[k].icon + ' ' : ''}${varLabel(k)} ${varShow(k)}`).join(' · ');
  if (!st || !st.time) { hud.textContent = vtext; hud.hidden = !vtext; return; }
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
  hud.textContent = vtext ? `${text} · ${vtext}` : text;
  hud.hidden = false;
}

function applyState(st) {
  renderHud(st);
  if (!$('thSync').checked || !st) return;
  if (st.time) { const before = clockMinutes(); $('time').value = st.time; fireEvents(before, clockMinutes()); }
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
    await renderTarget();
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
  $('seed').addEventListener('change', () => { setSeed($('seed').value); save(); });
  $('varsReset').onclick = () => { vars = initVars(null); commitVars(); status(t('vars.resetDone')); };
  $('eventsRestart').onclick = () => { evDone = []; evStart = clock(); renderEvents(); save(); status(t('events.restarted')); };
  $('now').onclick = () => {
    const d = new Date();
    $('time').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    renderQueue();
    save();
  };
  ['time', 'userText', 'order', 'hprefix', 'wprefix', 'advance'].forEach((id) =>
    $(id).addEventListener('input', () => { renderPreview(); save(); }));
  DATA_CHECKS.forEach((id) => $(id).addEventListener('change', save));
  $('sendState').addEventListener('change', renderPreview);
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
  $('autoStart').onclick = autoStart;
  $('autoStop').onclick = () => autoStop('auto.stopped.manual');
  renderRelay();
  renderAuto();
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
  initFullpage();
  initProfileManager();
  initEditor();
  await refreshMind();
  if (TAB_MODE) { renderChat(); setInterval(renderChat, 1500); }
  setInterval(refreshMind, 3000); // Fängt Seitenwechsel in der Single-Page-App ab
})();
