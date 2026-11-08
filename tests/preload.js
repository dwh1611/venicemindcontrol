// Nachgebautes chrome-Objekt für die Tests im Headless-Electron (kein echtes Chrome).
const store = {};
const listeners = [];
window.__store = store;
window.__tabs = [{ id: 1, url: 'https://venice.ai/chat/minds/local/TESTMIND1/x', title: 'Test' }];
window.__active = 1;
window.__replies = {};
window.__injected = [];
const clone = (x) => JSON.parse(JSON.stringify(x));
const all = () => window.__tabs.map((t) => ({ ...t, active: t.id === window.__active, lastFocusedWindow: true }));
window.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in store) out[k] = clone(store[k]); });
        if (cb) cb(out);
        return Promise.resolve(out);
      },
      set: (o) => {
        const ch = {};
        Object.entries(clone(o)).forEach(([k, v]) => { ch[k] = { oldValue: store[k], newValue: v }; store[k] = v; });
        listeners.forEach((f) => f(ch, 'local'));
        return Promise.resolve();
      },
    },
    onChanged: { addListener: (fn) => listeners.push(fn) },
  },
  tabs: {
    query: async () => all(),
    get: async (id) => { const t = all().find((x) => x.id === id); if (!t) throw new Error('No tab'); return t; },
    sendMessage: async (id, msg) => {
      if (msg.type === 'ping') return { ok: true };
      if (msg.type === 'lastReply') { const r = window.__replies[id]; return r ? { ok: true, text: r, count: 3 } : { ok: false, code: 'no_reply' }; }
      if (msg.type === 'inject') { window.__injected.push({ id, ...msg }); return { ok: true, sent: !!msg.send }; }
      return { ok: true };
    },
    create: async (o) => { (window.__created = window.__created || []).push(o.url); return { id: 99 }; },
    onActivated: { addListener() {} },
    onUpdated: { addListener() {} },
  },
  runtime: { getURL: (x) => 'chrome-extension://test/' + x },
  scripting: { executeScript: async () => {} },
};
