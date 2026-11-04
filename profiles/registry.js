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

  /* ---------- Mehrsprachige Texte ----------
     Jeder Text in einem Profil darf ein Objekt { "en": "…", "de": "…" } sein.
     resolve() ersetzt solche Objekte tief durch den Text der Oberflächensprache
     ("en" ist Pflicht und Rückfall; so wird kein normales Objekt verwechselt). */
  const LANG = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;
  const isL = (x) => isObj(x) && typeof x.en === 'string' &&
    Object.entries(x).every(([k, v]) => LANG.test(k) && typeof v === 'string');
  const pick = (x, lang) => (typeof x[lang] === 'string' ? x[lang] : x.en);
  function resolve(v, lang) {
    if (Array.isArray(v)) return v.map((x) => resolve(x, lang));
    if (isL(v)) return pick(v, lang);
    if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = resolve(v[k], lang); return o; }
    return v;
  }

  const MSG = {
    en: {
      notObj: "The file does not contain a profile object.",
      id: "id: 2–32 characters, only a–z, 0–9, _ and -.",
      name: "name is missing.",
      mindIds: "mindIds: list of Mind IDs (from the URL …/minds/local/<ID>/…).",
      titleBad: "titleMatch is not a valid regular expression.",
      needIdOrTitle: "Give either mindIds or titleMatch.",
      prefixesMissing: "prefixes.actor and prefixes.world are missing.",
      prefixBad: "prefixes.{k}: capital letters, digits, _ and -, 2–21 characters (e.g. NIGHTINGALE).",
      defaultTime: "defaultTime: HH:MM.",
      themeMissing: "theme is missing.",
      themeKey: "theme.{k}: colour like #7fb4ff.",
      glow: "theme.glow: \"r,g,b\" like 108,170,255.",
      logo: "header.logo is missing.",
      eventKindsObj: "eventKinds must be an object.",
      eventKindName: "eventKinds \"{k}\": invalid name.",
      eventKindColor: "eventKinds.{k}: colour like #ffb000.",
      numRegex: "state.numbers[{i}].regex is invalid.",
      meterRegex: "state.meters[{i}].regex is invalid.",
      tabsNone: "tabs: at least one tab.",
      tabIdLabel: "tabs[{i}]: id and label required.",
      tabDup: "tabs[{i}]: id \"{id}\" is used twice.",
      blockType: "{w}: type must be one of {list}.",
      rawOnly: "{w}: action.format may only be \"raw\".",
      itemsMissing: "{w}: items are missing.",
      actionParts: "{w}: action.parts is missing.",
      kindsMissing: "{w}: kinds are missing.",
      fieldId: "{w}: id is missing.",
      scenFields: "scenarios: fields and items are required.",
      scenTpl: "scenarios.template.segments is missing.",
      convention: "convention must be a text (or be left out).",
      clock: "clock: true or false.",
    },
    de: {
      notObj: "Die Datei enthält kein Profil-Objekt.",
      id: "id: 2–32 Zeichen, nur a–z, 0–9, _ und -.",
      name: "name fehlt.",
      mindIds: "mindIds: Liste von Mind-IDs (aus der URL …/minds/local/<ID>/…).",
      titleBad: "titleMatch ist kein gültiger regulärer Ausdruck.",
      needIdOrTitle: "Entweder mindIds oder titleMatch angeben.",
      prefixesMissing: "prefixes.actor und prefixes.world fehlen.",
      prefixBad: "prefixes.{k}: Großbuchstaben, Ziffern, _ und -, 2–21 Zeichen (z. B. NIGHTINGALE).",
      defaultTime: "defaultTime: HH:MM.",
      themeMissing: "theme fehlt.",
      themeKey: "theme.{k}: Farbe wie #7fb4ff.",
      glow: "theme.glow: \"r,g,b\" wie 108,170,255.",
      logo: "header.logo fehlt.",
      eventKindsObj: "eventKinds muss ein Objekt sein.",
      eventKindName: "eventKinds \"{k}\": Name ungültig.",
      eventKindColor: "eventKinds.{k}: Farbe wie #ffb000.",
      numRegex: "state.numbers[{i}].regex ungültig.",
      meterRegex: "state.meters[{i}].regex ungültig.",
      tabsNone: "tabs: mindestens ein Reiter.",
      tabIdLabel: "tabs[{i}]: id und label nötig.",
      tabDup: "tabs[{i}]: id \"{id}\" doppelt.",
      blockType: "{w}: type muss einer von {list} sein.",
      rawOnly: "{w}: action.format darf nur \"raw\" sein.",
      itemsMissing: "{w}: items fehlen.",
      actionParts: "{w}: action.parts fehlt.",
      kindsMissing: "{w}: kinds fehlen.",
      fieldId: "{w}: id fehlt.",
      scenFields: "scenarios: fields und items nötig.",
      scenTpl: "scenarios.template.segments fehlt.",
      convention: "convention muss ein Text sein (oder ganz fehlen).",
      clock: "clock: true oder false.",
    },
  };
  const explain = (errors, lang) => (errors || []).map((e) => {
    const tpl = (MSG[lang] || MSG.en)[e.k] || MSG.en[e.k] || e.k;
    return tpl.replace(/\{(\w+)\}/g, (_m, n) => (e.p && e.p[n] != null ? e.p[n] : ''));
  });

  /* ---------- Prüfung ---------- */
  function validate(raw) {
    const p = resolve(raw, 'en');
    const errors = [];
    const err = (k, p) => errors.push({ k, p });
    if (!isObj(p)) return { ok: false, errors: [{ k: 'notObj' }] };
    if (typeof p.id !== 'string' || !ID.test(p.id)) err('id');
    if (typeof p.name !== 'string' || !p.name.trim()) err('name');
    if (!Array.isArray(p.mindIds) || p.mindIds.some((x) => typeof x !== 'string' || !/^[A-Za-z0-9_-]{5,}$/.test(x))) err('mindIds');
    if (p.titleMatch != null) { try { rx(p.titleMatch); } catch { err('titleBad'); } }
    if ((!p.mindIds || !p.mindIds.length) && !p.titleMatch) err('needIdOrTitle');
    if (!isObj(p.prefixes) || !p.prefixes.actor || !p.prefixes.world) err('prefixesMissing');
    else ['actor', 'world'].forEach((k) => {
      // Der Chat erkennt Event-Zeilen nur an Präfixen in Großbuchstaben (2–21 Zeichen).
      if (!/^[A-ZÄÖÜ][A-ZÄÖÜ0-9_-]{1,20}$/.test(p.prefixes[k])) err('prefixBad', { k });
    });
    if (p.defaultTime != null && !/^\d{1,2}:\d{2}$/.test(p.defaultTime)) err('defaultTime');
    if (!isObj(p.theme)) err('themeMissing');
    else {
      THEME_KEYS.forEach((k) => { if (!HEX.test(p.theme[k] || '')) err('themeKey', { k }); });
      if (!RGB.test(p.theme.glow || '')) err('glow');
    }
    if (!isObj(p.header) || typeof p.header.logo !== 'string') err('logo');
    if (p.eventKinds != null) {
      if (!isObj(p.eventKinds)) err('eventKindsObj');
      else Object.entries(p.eventKinds).forEach(([k, c]) => {
        if (!KIND.test(k)) err('eventKindName', { k });
        if (!HEX.test(c)) err('eventKindColor', { k });
      });
    }
    const st = p.state || {};
    (st.numbers || []).forEach((n, i) => { try { rx(n.regex); } catch { err('numRegex', { i }); } });
    (st.meters || []).forEach((m, i) => { try { rx(m.regex); } catch { err('meterRegex', { i }); } });
    if (!Array.isArray(p.tabs) || !p.tabs.length) err('tabsNone');
    else {
      const ids = new Set();
      p.tabs.forEach((t, i) => {
        if (!t || typeof t.id !== 'string' || !t.label) { err('tabIdLabel', { i }); return; }
        if (ids.has(t.id)) err('tabDup', { i, id: t.id });
        ids.add(t.id);
        (t.blocks || []).forEach((b, j) => {
          const w = `tabs[${i}].blocks[${j}]`;
          if (!b || !BLOCKS.includes(b.type)) { err('blockType', { w, list: BLOCKS.join(', ') }); return; }
          if (b.action && b.action.format != null && b.action.format !== 'raw') err('rawOnly', { w });
          if (b.type === 'grid') {
            if (!Array.isArray(b.items) || !b.items.length) err('itemsMissing', { w });
            if (!isObj(b.action) || !Array.isArray(b.action.parts)) err('actionParts', { w });
          }
          if (b.type === 'compose') {
            if (!isObj(b.kinds) || !Object.keys(b.kinds).length) err('kindsMissing', { w });
            if (!isObj(b.action) || !Array.isArray(b.action.parts)) err('actionParts', { w });
          }
          if (b.type === 'field' && !b.id) err('fieldId', { w });
        });
      });
    }
    if (p.scenarios) {
      if (!Array.isArray(p.scenarios.fields) || !Array.isArray(p.scenarios.items)) err('scenFields');
      if (!isObj(p.scenarios.template) || !Array.isArray(p.scenarios.template.segments)) err('scenTpl');
    }
    if (p.convention != null && (typeof p.convention !== 'string' || !p.convention.trim())) err('convention');
    if (p.clock != null && typeof p.clock !== 'boolean') err('clock');
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

  let lang = 'en';
  const loc = new Map(); // Rohprofil -> aufgelöste Kopie (pro Sprache)
  const localized = (p) => { let c = loc.get(p); if (!c) { c = resolve(p, lang); loc.set(p, c); } return c; };
  const setLang = (l) => { lang = l || 'en'; loc.clear(); };
  const all = () => [...builtins, ...custom].map(localized);

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
      if (p) return { profile: p, mindId, source: 'assigned' };
    }
    if (mindId) {
      const p = list.find((x) => (x.mindIds || []).includes(mindId));
      if (p) return { profile: p, mindId, source: 'id' };
    }
    const p = list.find((x) => re(x).title && re(x).title.test(title || ''));
    if (p) return { profile: p, mindId, source: 'title' };
    return { profile: null, mindId, source: null };
  };

  // Eigene Profile (id -> Profil) aus dem Speicher übernehmen; ungültige werden übersprungen.
  const setCustom = (obj) => {
    custom = Object.values(obj || {}).filter((p) => validate(p).ok && !builtins.some((b) => b.id === p.id));
    loc.clear();
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
    get lang() { return lang; },
    raw: (id) => [...builtins, ...custom].find((p) => p.id === id),
    register: (p) => builtins.push(p),
    setLang, resolve, explain,
    setCustom, init, validate, detect, mindIdFromUrl, re, fill, segments, parts,
  };
})();
