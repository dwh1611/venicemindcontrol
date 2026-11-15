// Läuft auf venice.ai. Erkennt das Mind (Profil) und
//  1) befüllt / sendet die Chatbox (vom Side Panel gesteuert),
//  2) stylt den Chat (Terminal-Theme, Screens, Event-Zeilen) mit den Farben des Profils,
//  3) liest den Spielzustand aus der ⏱-Zeile und meldet ihn ans Side Panel.
(() => {
  if (window.__mindConsoleLoaded) return;
  window.__mindConsoleLoaded = true;

  /* =====================  1) EINGABE  ===================== */
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };

  function findInput() {
    const exact = document.querySelector('textarea[aria-label="Chat message input"], textarea[placeholder="Chat message input"]');
    if (exact && isVisible(exact)) return exact;
    const candidates = [
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"]'),
      ...document.querySelectorAll('[role="textbox"]'),
    ].filter(isVisible);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return candidates[0];
  }

  const readText = (el) => (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? el.value : el.innerText);

  function writeText(el, text, mode) {
    el.focus();
    const isForm = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
    const existing = readText(el).replace(/\n$/, '');
    const finalText = mode === 'append' && existing.trim() ? existing + '\n' + text : text;
    if (isForm) {
      // React merkt sich Werte selbst: nativer Setter + input-Event.
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      setter.call(el, finalText);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.setSelectionRange(finalText.length, finalText.length);
    } else {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, finalText);
    }
  }

  function findSendButton(input) {
    const byId = document.querySelector('[data-testid="minds-chat-send-button"], [testid="minds-chat-send-button"]');
    if (byId && !byId.disabled) return byId;
    const scope = input.closest('form') || input.parentElement?.parentElement?.parentElement || document;
    const selectors = ['button[type="submit"]', 'button[aria-label*="send" i]', 'button[aria-label*="senden" i]'];
    for (const root of [scope, document]) {
      for (const sel of selectors) {
        const btn = [...root.querySelectorAll(sel)].find((b) => isVisible(b) && !b.disabled);
        if (btn) return btn;
      }
    }
    return null;
  }

  function pressEnter(el) {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'ping') { sendResponse({ ok: true }); return; }
    if (msg?.type === 'whoami') {
      const d = detectNow();
      sendResponse({ ok: true, mindId: d.mindId, profile: d.profile ? d.profile.id : null, source: d.source });
      return;
    }
    if (msg?.type === 'lastReply') {
      const msgs = [...document.querySelectorAll('.assistant .assistant-content')];
      const last = msgs[msgs.length - 1];
      sendResponse(last ? { ok: true, text: last.innerText.trim(), count: msgs.length } : { ok: false, code: 'no_reply' });
      return;
    }
    if (msg?.type === 'transcript') {
      const all = [...document.querySelectorAll('.assistant-content')];
      const list = all.slice(-(msg.limit || 80)).map((ac) => ({
        role: ac.closest('.assistant') ? 'mind' : 'user',
        // Roh-Text je Absatz; die vom Panel gebauten Event-Boxen (.mc-evbox) doppeln nur die versteckten Zeilen.
        html: (() => {
          const c = ac.cloneNode(true);
          c.querySelectorAll('.mc-evbox').forEach((b) => b.remove());
          c.querySelectorAll('.mc-hidden').forEach((e) => e.classList.remove('mc-hidden'));
          return c.innerHTML.slice(0, 60000);
        })(),
        text: [...ac.children].filter((c) => !c.classList.contains('mc-evbox')).map((c) => c.textContent.trim()).filter(Boolean).join('\n\n'),
      }));
      const last = list[list.length - 1];
      const sig = all.length + ':' + (last ? last.text.length + ':' + last.text.slice(-40) : '');
      if (msg.sig && msg.sig === sig) { sendResponse({ ok: true, same: true }); return; }
      sendResponse({ ok: true, sig, title: document.title, total: all.length, messages: list });
      return;
    }
    if (msg?.type !== 'inject') return;

    const input = findInput();
    if (!input) { sendResponse({ ok: false, code: 'no_input', error: 'No chat box found.' }); return; }
    try {
      writeText(input, msg.text, msg.mode || 'replace');
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
      return;
    }
    if (!msg.send) { sendResponse({ ok: true, sent: false }); return; }
    setTimeout(() => {
      const btn = findSendButton(input);
      if (btn) btn.click(); else pressEnter(input);
      sendResponse({ ok: true, sent: true, via: btn ? 'button' : 'enter' });
    }, 200);
    return true;
  });

  /* =====================  PROFIL  ===================== */
  let mindMap = {};
  let profile = null;     // aktuelles Profil oder null
  let cfg = null;         // Darstellung pro Profil
  const DEFAULTS = { theme: true, scan: true, screens: true, events: true, sync: true };

  const detectNow = () => MindProfiles.detect(location.href, document.title, mindMap);

  /* =====================  2) STYLING  ===================== */
  const MONO = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';
  const styleEl = document.createElement('style');
  styleEl.id = 'mc-style';
  document.documentElement.appendChild(styleEl);

  function buildCss(p) {
    const t = p.theme;
    const kinds = Object.entries(p.eventKinds || {})
      .map(([k, color]) => `.mc-ev[data-k="${k.replace(/"/g, '')}"] { --c: ${color}; }`).join('\n');
    return `
    html.mc-theme body:not(#mc-x),
    html.mc-theme .minds-chat-container,
    html.mc-theme .minds-chat-scroll { background: ${t.bg} !important; }

    html.mc-theme .assistant-content,
    html.mc-theme .assistant-content p,
    html.mc-theme .assistant-content li,
    html.mc-theme .assistant-content strong,
    html.mc-theme .assistant-content em {
      color: ${t.txt} !important;
      font-family: ${MONO} !important;
      font-size: 14px;
      line-height: 1.55;
      text-shadow: 0 0 4px rgba(${t.glow},.22);
    }

    html.mc-scan::after {
      content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
      background:
        radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,.4) 100%),
        repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,.16) 3px);
    }

    html.mc-screens .codeblock.mc-screen {
      width: fit-content; max-width: 100%; min-width: 260px;
      background: #000 !important; border: 1px solid rgba(${t.glow},.35) !important; border-radius: 6px !important;
      box-shadow: 0 0 14px rgba(${t.glow},.18), inset 0 0 18px rgba(${t.glow},.06);
    }
    html.mc-screens .codeblock.mc-screen .code-block-header { display: none !important; }
    html.mc-screens .codeblock.mc-screen pre,
    html.mc-screens .codeblock.mc-screen pre * {
      font-family: ${MONO} !important; font-size: 13px !important; line-height: 1.15 !important;
      color: ${t.fg} !important; background: transparent !important;
      white-space: pre !important; font-variant-ligatures: none;
      text-shadow: 0 0 6px rgba(${t.glow},.5);
    }

    html:not(.mc-events) .mc-evbox { display: none !important; }
    html.mc-events .mc-hidden { display: none !important; }
    .mc-evbox { display: flex; flex-direction: column; gap: 3px; margin: 2px 0; font-family: ${MONO}; }
    .mc-ev {
      --c: ${t.fg}; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline;
      border-left: 2px solid var(--c); padding: 3px 9px; background: rgba(${t.glow},.05);
      font-size: 12.5px; word-break: break-word;
    }
    .mc-ev .t { color: var(--c); font-weight: 700; letter-spacing: .08em; font-size: 11px; }
    .mc-ev .m { color: ${t.mut}; font-size: 11px; }
    .mc-ev .b { color: ${t.txt}; flex-basis: 100%; }
    ${kinds}
    .mc-user { color: ${t.txt}; padding: 3px 9px; font-family: ${MONO}; font-size: 13px; }

    html.mc-theme .assistant-content p.mc-hud {
      color: ${t.warn} !important; font-size: 12px !important; letter-spacing: .04em;
      border-top: 1px dashed rgba(${t.glow},.3); padding-top: 6px;
      text-shadow: 0 0 6px rgba(255,176,0,.45);
    }
  `;
  }

  function applyCfg() {
    const h = document.documentElement;
    const on = !!profile && !!cfg;
    h.classList.toggle('mc-theme', on && !!cfg.theme);
    h.classList.toggle('mc-scan', on && !!(cfg.theme && cfg.scan));
    h.classList.toggle('mc-screens', on && !!cfg.screens);
    h.classList.toggle('mc-events', on && !!cfg.events);
    if (on) mark();
  }

  const themeKey = () => `${profile.id}:theme`;

  function setProfile(p) {
    if ((p && p.id) === (profile && profile.id)) return;
    document.querySelectorAll('.mc-evbox').forEach((b) => b.remove());
    document.querySelectorAll('.mc-hidden').forEach((e) => { e.classList.remove('mc-hidden'); delete e.dataset.mcDone; });
    profile = p;
    lastState = '';
    cfg = null;
    styleEl.textContent = p ? buildCss(p) : '';
    if (!p) { applyCfg(); return; }
    try {
      chrome.storage.local.get(themeKey(), (s) => {
        cfg = { ...DEFAULTS, ...((s && s[themeKey()]) || {}) };
        applyCfg();
      });
    } catch { cfg = { ...DEFAULTS }; applyCfg(); }
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };

  // [PRÄFIX · HH:MM · ART · Zusatz] Inhalt
  const EV = /^\[([A-ZÄÖÜ][A-ZÄÖÜ0-9_-]{1,20})\s*·\s*(\d{1,2}:\d{2})\s*·?\s*([^\]]*)\]\s*(.*)$/;

  function paragraphLines(p) {
    let out = '';
    p.childNodes.forEach((n) => { out += n.nodeName === 'BR' ? '\n' : n.textContent; });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function buildEvents(p) {
    const lines = paragraphLines(p);
    if (!lines.some((l) => EV.test(l))) return;
    const box = document.createElement('div');
    box.className = 'mc-evbox';
    lines.forEach((l) => {
      const m = EV.exec(l);
      if (!m) { box.appendChild(el('div', 'mc-user', l)); return; }
      const rest = m[3].split('·').map((s) => s.trim()).filter(Boolean);
      const kind = rest[0] || m[1];
      const row = document.createElement('div');
      row.className = 'mc-ev';
      row.dataset.k = kind;
      row.append(el('span', 't', kind), el('span', 'm', [m[2], ...rest.slice(1)].join(' · ')), el('span', 'b', m[4]));
      box.appendChild(row);
    });
    p.classList.add('mc-hidden');
    p.dataset.mcDone = '1';
    p.insertAdjacentElement('afterend', box); // React-Knoten bleiben unangetastet
  }

  function mark() {
    if (!profile) return;
    document.querySelectorAll('.codeblock').forEach((cb) => {
      const pre = cb.querySelector('pre');
      if (!pre) return;
      const t = pre.textContent.trimStart();
      cb.classList.toggle('mc-screen', /^[┌╔]/.test(t) || t.includes('│'));
    });
    // Verwaiste Event-Boxen entfernen (React hat den Absatz ersetzt)
    document.querySelectorAll('.mc-evbox').forEach((b) => {
      const prev = b.previousElementSibling;
      if (!prev || !prev.classList.contains('mc-hidden')) b.remove();
    });
    // Nachrichten: Nutzer = .assistant-content ohne .assistant-Vorfahre
    document.querySelectorAll('.assistant-content').forEach((ac) => {
      const isAssistant = !!ac.closest('.assistant');
      ac.querySelectorAll('p').forEach((p) => {
        const txt = p.textContent.trim();
        if (isAssistant) p.classList.toggle('mc-hud', txt.startsWith('⏱'));
        else if (!p.dataset.mcDone && txt.startsWith('[')) buildEvents(p);
      });
    });
  }

  /* =====================  3) SPIELZUSTAND  ===================== */
  let lastState = '';

  function readState() {
    if (!profile) return;
    const msgs = [...document.querySelectorAll('.assistant .assistant-content')];
    const last = msgs[msgs.length - 1];
    if (!last) return;
    const m = [...last.innerText.matchAll(/⏱\s*(\d{1,2}):(\d{2})([^\n]*)/g)].pop();
    if (!m) return;
    const rest = m[3];
    const spec = profile.state || {};
    const state = { time: `${m[1].padStart(2, '0')}:${m[2]}` };
    const segments = rest.split('·').map((s) => s.trim());
    (spec.parts || []).forEach((part) => {
      const seg = segments.find((s) => s.startsWith(part.icon));
      if (seg) state[part.key] = seg.replace(part.icon, '').trim();
    });
    const rx = MindProfiles.re(profile);
    (spec.numbers || []).forEach((n, i) => {
      const r = rx.numbers[i].exec(rest);
      if (r) state[n.key] = parseInt(r[1], 10);
    });
    (spec.meters || []).forEach((mt, i) => {
      const r = rx.meters[i].exec(rest);
      if (r) { state[mt.key] = parseInt(r[1], 10); state[mt.key + 'Max'] = parseInt(r[2], 10); }
    });
    (spec.lists || []).forEach((l, i) => {
      const r = rx.lists[i].exec(rest);
      if (r) state[l.key] = r[1].split(l.sep || ',').map((s) => s.trim()).filter(Boolean);
    });
    const key = JSON.stringify(state);
    if (key === lastState) return;
    lastState = key;
    try { chrome.storage.local.set({ [`${profile.id}:gameState`]: { ...state, at: Date.now() } }); } catch { /* Extension neu geladen */ }
  }

  /* =====================  START  ===================== */
  function refresh() {
    const d = detectNow();
    setProfile(d.profile);
    if (!d.profile) return;
    mark();
    readState();
  }

  try {
    MindProfiles.init(() => {
      chrome.storage.local.get('mindMap', (s) => { mindMap = (s && s.mindMap) || {}; refresh(); });
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.customProfiles) {
        MindProfiles.setCustom(ch.customProfiles.newValue);
        setProfile(null); // neu aufbauen, falls ein Profil ersetzt wurde
        refresh();
      }
      if (ch.mindMap) { mindMap = ch.mindMap.newValue || {}; refresh(); }
      if (profile && ch[themeKey()]) { cfg = { ...DEFAULTS, ...(ch[themeKey()].newValue || {}) }; applyCfg(); }
    });
  } catch { refresh(); }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
