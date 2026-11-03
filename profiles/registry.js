// Gemeinsame Profil-Registry für Content-Script und Side Panel.
// Ein Profil ist reine Daten (JSON): Erkennung, Optik, Reiter, Statuszeile.
// Eingebaute Profile liegen in profiles/*.js, eigene werden im Panel hochgeladen
// und in chrome.storage ("customProfiles") gehalten. Format: siehe PROFILE-FORMAT.md.
(() => {
  const builtins = [];
  let custom = [];
  const compiled = new WeakMap();

  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const RGB = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/;
  const KIND = /^[\wÄÖÜäöüß-]{1,24}$/;
  const ID = /^[a-z0-9][a-z0-9_-]{1,31}$/;
  const BLOCKS = ['hint', 'field', 'row', 'grid', 'compose', 'scenarios'];
  const THEME_KEYS = ['fg', 'dim', 'mut', 'line', 'bg', 'bg2', 'deep', 'ink', 'warn', 'err', 'txt'];

  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const rx = (src) => new RegExp(src, 'i');

  /* ---------- Vorlagen ({item}, {field.x}, {x|Ersatz}) ---------- */
  const lookup = (path, scope) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), scope);
  const str = (v) => (v == null ? '' : String(v));

  // Gibt { text, empty } zurück; leer, wenn ein Platzhalter ohne Ersatz keinen Wert hat.
  function fill(tpl, scope) {
    let empty = false;
    const text = String(tpl).replace(/\{([^{}|]+)(?:\|([^{}]*))?\}/g, (_m, path, fallback) => {
      let v = lookup(path.trim(), scope);
      if (isObj(v) && 'label' in v) v = v.label; // {item} bei Objekten
      v = str(v).trim();
      if (!v) { if (fallback !== undefined) return fallback; empty = true; return ''; }
      return v;
    });
    return { text, empty };
  }
  // Liste von Vorlagen -> zusammengefügter Text; Segmente mit leerem Platzhalter entfallen.
  const segments = (list, scope, sep) => (list || [])
    .map((t) => fill(t, scope)).filter((r) => !r.empty && r.text.trim()).map((r) => r.text).join(sep == null ? ' ' : sep);
  const parts = (list, scope) => (list || [])
    .map((t) => fill(t, scope)).filter((r) => !r.empty && r.text.trim()).map((r) => r.text);

  /* ---------- Prüfung ---------- */
  function validate(p) {
    const errors = [];
    const err = (m) => errors.push(m);
    if (!isObj(p)) return { ok: false, errors: ['Die Datei enthält kein Profil-Objekt.'] };
    if (typeof p.id !== 'string' || !ID.test(p.id)) err('id: 2–32 Zeichen, nur a–z, 0–9, _ und -.');
    if (typeof p.name !== 'string' || !p.name.trim()) err('name fehlt.');
    if (!Array.isArray(p.mindIds) || p.mindIds.some((x) => typeof x !== 'string' || !/^[A-Za-z0-9_-]{5,}$/.test(x))) err('mindIds: Liste von Mind-IDs (aus der URL …/minds/local/<ID>/…).');
    if (p.titleMatch != null) { try { rx(p.titleMatch); } catch { err('titleMatch ist kein gültiger regulärer Ausdruck.'); } }
    if ((!p.mindIds || !p.mindIds.length) && !p.titleMatch) err('Entweder mindIds oder titleMatch angeben.');
    if (!isObj(p.prefixes) || !p.prefixes.actor || !p.prefixes.world) err('prefixes.actor und prefixes.world fehlen.');
    else ['actor', 'world'].forEach((k) => {
      // Der Chat erkennt Event-Zeilen nur an Präfixen in Großbuchstaben (2–21 Zeichen).
      if (!/^[A-ZÄÖÜ][A-ZÄÖÜ0-9_-]{1,20}$/.test(p.prefixes[k])) err(`prefixes.${k}: Großbuchstaben, Ziffern, _ und -, 2–21 Zeichen (z. B. NIGHTINGALE).`);
    });
    if (p.defaultTime != null && !/^\d{1,2}:\d{2}$/.test(p.defaultTime)) err('defaultTime: HH:MM.');
    if (!isObj(p.theme)) err('theme fehlt.');
    else {
      THEME_KEYS.forEach((k) => { if (!HEX.test(p.theme[k] || '')) err(`theme.${k}: Farbe wie #7fb4ff.`); });
      if (!RGB.test(p.theme.glow || '')) err('theme.glow: "r,g,b" wie 108,170,255.');
    }
    if (!isObj(p.header) || typeof p.header.logo !== 'string') err('header.logo fehlt.');
    if (p.eventKinds != null) {
      if (!isObj(p.eventKinds)) err('eventKinds muss ein Objekt sein.');
      else Object.entries(p.eventKinds).forEach(([k, c]) => {
        if (!KIND.test(k)) err(`eventKinds "${k}": Name ungültig.`);
        if (!HEX.test(c)) err(`eventKinds.${k}: Farbe wie #ffb000.`);
      });
    }
    const st = p.state || {};
    (st.numbers || []).forEach((n, i) => { try { rx(n.regex); } catch { err(`state.numbers[${i}].regex ungültig.`); } });
    (st.meters || []).forEach((m, i) => { try { rx(m.regex); } catch { err(`state.meters[${i}].regex ungültig.`); } });
    if (!Array.isArray(p.tabs) || !p.tabs.length) err('tabs: mindestens ein Reiter.');
    else {
      const ids = new Set();
      p.tabs.forEach((t, i) => {
        if (!t || typeof t.id !== 'string' || !t.label) { err(`tabs[${i}]: id und label nötig.`); return; }
        if (ids.has(t.id)) err(`tabs[${i}]: id "${t.id}" doppelt.`);
        ids.add(t.id);
        (t.blocks || []).forEach((b, j) => {
          const w = `tabs[${i}].blocks[${j}]`;
          if (!b || !BLOCKS.includes(b.type)) { err(`${w}: type muss einer von ${BLOCKS.join(', ')} sein.`); return; }
          if (b.action && b.action.format != null && b.action.format !== 'raw') err(`${w}: action.format darf nur "raw" sein.`);
          if (b.type === 'grid') {
            if (!Array.isArray(b.items) || !b.items.length) err(`${w}: items fehlen.`);
            if (!isObj(b.action) || !Array.isArray(b.action.parts)) err(`${w}: action.parts fehlt.`);
          }
          if (b.type === 'compose') {
            if (!isObj(b.kinds) || !Object.keys(b.kinds).length) err(`${w}: kinds fehlen.`);
            if (!isObj(b.action) || !Array.isArray(b.action.parts)) err(`${w}: action.parts fehlt.`);
          }
          if (b.type === 'field' && !b.id) err(`${w}: id fehlt.`);
        });
      });
    }
    if (p.scenarios) {
      if (!Array.isArray(p.scenarios.fields) || !Array.isArray(p.scenarios.items)) err('scenarios: fields und items nötig.');
      if (!isObj(p.scenarios.template) || !Array.isArray(p.scenarios.template.segments)) err('scenarios.template.segments fehlt.');
    }
    if (p.convention != null && (typeof p.convention !== 'string' || !p.convention.trim())) err('convention muss ein Text sein (oder ganz fehlen).');
    if (p.clock != null && typeof p.clock !== 'boolean') err('clock: true oder false.');
    return { ok: !errors.length, errors };
  }

  /* ---------- Registry ---------- */
  const re = (p) => {
    let c = compiled.get(p);
    if (!c) {
      const st = p.state || {};
      c = {
        title: p.titleMatch ? rx(p.titleMatch) : null,
        numbers: (st.numbers || []).map((n) => rx(n.regex)),
        meters: (st.meters || []).map((m) => rx(m.regex)),
      };
      compiled.set(p, c);
    }
    return c;
  };

  const all = () => [...builtins, ...custom];

  // …/chat/minds/local/<id>/<chat>, …/minds/local/<id>/edit, …/minds/local/<id>
  const mindIdFromUrl = (url) => {
    const m = /\/minds\/(?:local\/)?([A-Za-z0-9_-]{5,})/.exec(url || '');
    return m ? m[1] : null;
  };

  // Reihenfolge: manuelle Zuordnung, bekannte Mind-ID, Seitentitel.
  const detect = (url, title, mindMap) => {
    const mindId = mindIdFromUrl(url);
    const map = mindMap || {};
    const list = all();
    if (mindId && map[mindId]) {
      const p = list.find((x) => x.id === map[mindId]);
      if (p) return { profile: p, mindId, source: 'zugeordnet' };
    }
    if (mindId) {
      const p = list.find((x) => (x.mindIds || []).includes(mindId));
      if (p) return { profile: p, mindId, source: 'Mind-ID' };
    }
    const p = list.find((x) => re(x).title && re(x).title.test(title || ''));
    if (p) return { profile: p, mindId, source: 'Titel' };
    return { profile: null, mindId, source: null };
  };

  // Eigene Profile (id -> Profil) aus dem Speicher übernehmen; ungültige werden übersprungen.
  const setCustom = (obj) => {
    custom = Object.values(obj || {}).filter((p) => validate(p).ok && !builtins.some((b) => b.id === p.id));
  };

  const init = (cb) => {
    try {
      chrome.storage.local.get('customProfiles', (s) => { setCustom(s && s.customProfiles); cb && cb(); });
    } catch { cb && cb(); }
  };

  self.MindProfiles = {
    get list() { return all(); },
    get builtins() { return builtins; },
    get custom() { return custom; },
    register: (p) => builtins.push(p),
    setCustom, init, validate, detect, mindIdFromUrl, re, fill, segments, parts,
  };
})();
