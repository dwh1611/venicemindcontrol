// Weltlogik für v1.3 (reine Funktionen, kein Chrome-Zugriff, in Node testbar):
// Orte (#14/#16), Antwort-Optionen (#15), Variablen-Log mit Undo (#29/#32/#17), State-Guard (#30),
// Änderungsvorschläge (#31) und Quests (#33). Das Panel (sidepanel.js) verdrahtet sie mit der Oberfläche.
(() => {
  const lc = (x) => String(x == null ? '' : x).trim().toLowerCase();
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const QUEST_STATES = ['open', 'active', 'done', 'failed'];

  /* ---------- Orte ---------- */
  // Neighbours: "id" oder { id, minutes }.
  const neighbourId = (n) => (typeof n === 'string' ? n : n && n.id);

  function locItems(loc) { return loc && Array.isArray(loc.items) ? loc.items : []; }

  // Ort zu einem Text aus der Statuszeile: Regex "match", sonst id oder Label (ohne Groß-/Kleinschreibung).
  function findLocation(loc, text) {
    const v = lc(text);
    if (!v) return null;
    for (const it of locItems(loc)) {
      if (it.match) { try { if (new RegExp(it.match, 'i').test(String(text))) return it; } catch { /* ungültig */ } }
    }
    return locItems(loc).find((it) => lc(it.id) === v || lc(it.label) === v) || null;
  }

  const byId = (loc, id) => locItems(loc).find((it) => it.id === id) || null;

  // Nachbarn eines Ortes als Buttons: [{ id, label, text, m }]
  function exits(loc, fromId) {
    const from = byId(loc, fromId);
    if (!from) return [];
    const dflt = typeof loc.minutes === 'number' ? loc.minutes : 0;
    return (from.neighbours || []).map((n) => {
      const id = neighbourId(n);
      const to = byId(loc, id);
      if (!to) return null;
      const m = isObj(n) && typeof n.minutes === 'number' ? n.minutes : dflt;
      return { id, label: to.label || id, text: to.label || id, m };
    }).filter(Boolean);
  }

  /* ---------- Antwort-Optionen ---------- */
  const OPT = /^\s*(?:[-*•]\s+|\(?([0-9]{1,2}|[A-Za-z])[.)\]:]\s+)(.+?)\s*$/;
  const plainText = (s) => String(s).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]{1,3}/g, '').replace(/\s+/g, ' ').trim();
  const isStatus = (l) => /^\s*⏱/.test(l);

  // Findet die Optionen einer Antwort. Ohne pattern: der letzte zusammenhängende Block aus nummerierten
  // (1. / 1)), gebuchstabten (A) / A.) oder Aufzählungszeilen (- • *), mindestens zwei, bei Zahlen und Buchstaben der Reihe nach.
  // Mit pattern: jede Zeile, die passt (Gruppe 1 = Text, Gruppe 2 = Kennung).
  function parseChoices(reply, cfg) {
    const max = Math.min(20, Math.max(1, (cfg && cfg.max) || 8));
    const lines = String(reply || '').split('\n').filter((l) => l.trim() && !isStatus(l));
    if (cfg && cfg.pattern) {
      let re; try { re = new RegExp(cfg.pattern, 'i'); } catch { return []; }
      const out = [];
      for (const l of lines) {
        const m = re.exec(l);
        if (m) { const label = plainText(m[1] != null ? m[1] : m[0]); if (label) out.push({ n: m[2] != null ? String(m[2]) : String(out.length + 1), label, text: label }); }
      }
      return out.slice(0, max);
    }
    const blocks = [];
    let cur = [];
    let trail = 0; // Zeilen nach dem letzten Block (z. B. eine Schlussfrage)
    for (const l of lines) {
      const m = OPT.exec(l);
      if (m) { cur.push({ key: m[1] || '', label: plainText(m[2]) }); trail = 0; }
      else { if (cur.length) blocks.push(cur); cur = []; trail++; }
    }
    if (cur.length) blocks.push(cur);
    const last = blocks[blocks.length - 1];
    // Nur der letzte Block am Ende der Antwort zählt (höchstens zwei Zeilen danach); Aufzählungen mitten im Text nicht.
    const pick = last && last.length >= 2 && inOrder(last) && trail <= 2 ? last : null;
    return (pick || []).filter((o) => o.label).slice(0, max).map((o, i) => ({ n: o.key || String(i + 1), label: o.label, text: o.label }));
  }
  function inOrder(b) {
    const keys = b.map((o) => o.key);
    if (keys.every((k) => k === '')) return true;       // Aufzählung
    if (keys.some((k) => k === '')) return false;       // gemischt
    if (keys.every((k) => /^\d+$/.test(k))) return keys.every((k, i) => i === 0 || Number(k) === Number(keys[i - 1]) + 1) && Number(keys[0]) <= 1;
    return keys.every((k, i) => i === 0 || k.toLowerCase().charCodeAt(0) === keys[i - 1].toLowerCase().charCodeAt(0) + 1) && /^a$/i.test(keys[0]);
  }

  /* ---------- Variablen-Änderungen (Log, Undo, Reroll) ---------- */
  const counts = (arr) => { const m = new Map(); (arr || []).forEach((x) => m.set(lc(x), (m.get(lc(x)) || 0) + 1)); return m; };

  // Unterschiede zweier Spielzustände als umkehrbare Operationen.
  function diffVars(before, after, spec) {
    const ops = [];
    for (const k of Object.keys(spec || {})) {
      if (spec[k].type === 'list') {
        const b = counts(before[k]), a = counts(after[k]);
        const add = [], del = [];
        for (const [name, n] of a) for (let i = 0; i < n - (b.get(name) || 0); i++) add.push((after[k].find((x) => lc(x) === name)));
        for (const [name, n] of b) for (let i = 0; i < n - (a.get(name) || 0); i++) del.push((before[k].find((x) => lc(x) === name)));
        if (add.length || del.length) ops.push({ k, kind: 'list', add, del });
      } else if (before[k] !== after[k]) ops.push({ k, kind: 'num', d: after[k] - before[k] });
    }
    return ops;
  }

  // Wendet Operationen vorwärts (dir = 1) oder rückwärts (dir = -1) an. Gibt { ok, vars, error } zurück;
  // bei einem Fehler (Grenze verletzt, Eintrag fehlt nicht) bleibt vars unverändert.
  function applyOps(vars, ops, dir, spec) {
    const next = JSON.parse(JSON.stringify(vars));
    for (const op of ops || []) {
      if (op.kind === 'quest') continue;
      const sp = (spec || {})[op.k];
      if (!sp || !(op.k in next)) return { ok: false, vars, error: { code: 'gone', key: op.k } };
      if (op.kind === 'num') {
        next[op.k] += dir * op.d;
        if (sp.min != null && next[op.k] < sp.min) return { ok: false, vars, error: { code: 'below', key: op.k, limit: sp.min } };
        if (sp.max != null && next[op.k] > sp.max) return { ok: false, vars, error: { code: 'above', key: op.k, limit: sp.max } };
      } else {
        const put = dir > 0 ? op.add : op.del;
        const take = dir > 0 ? op.del : op.add;
        for (const x of take) {
          const i = next[op.k].findIndex((y) => lc(y) === lc(x));
          if (i >= 0) next[op.k].splice(i, 1);
        }
        put.forEach((x) => next[op.k].push(x));
      }
    }
    return { ok: true, vars: next };
  }

  // Kurzbeschreibung der Änderungen, z. B. "HP −3 · Items +key".
  function describeOps(ops, label) {
    const nm = label || ((k) => k);
    return (ops || []).map((o) => {
      if (o.kind === 'quest') return `${nm(o.id, true)} ${o.from} → ${o.to}`;
      if (o.kind === 'num') return `${nm(o.k)} ${o.d > 0 ? '+' : '−'}${Math.abs(o.d)}`;
      return [...o.add.map((x) => `${nm(o.k)} +${x}`), ...o.del.map((x) => `${nm(o.k)} −${x}`)].join(', ');
    }).filter(Boolean).join(' · ');
  }

  /* ---------- State-Guard ---------- */
  // items: [{ key, var, label }] für Zahlen/Listen, [{ key, location: true }] für den Ort.
  // Gibt die Abweichungen zurück: [{ label, mind, panel }]. Fehlt ein Wert in der Statuszeile, ist es keine Abweichung.
  function guardCheck(guard, status, vars, spec, loc, curLoc) {
    const out = [];
    if (!guard || !status) return out;
    for (const it of guard.items || []) {
      const mv = status[it.key];
      if (mv == null || mv === '') continue;
      if (it.location) {
        const m = findLocation(loc, mv);
        const cur = byId(loc, curLoc);
        if (m && cur && m.id !== cur.id) out.push({ label: it.label || 'Location', mind: m.label || m.id, panel: cur.label || cur.id });
        continue;
      }
      const sp = (spec || {})[it.var];
      if (!sp || !(it.var in vars)) continue;
      const label = it.label || sp.label || it.var;
      if (sp.type === 'list') {
        if (!Array.isArray(mv)) continue;
        const a = [...counts(mv).entries()].map(([k, n]) => k + 'x' + n).sort().join('|');
        const b = [...counts(vars[it.var]).entries()].map(([k, n]) => k + 'x' + n).sort().join('|');
        if (a !== b) out.push({ label, mind: mv.join(', ') || '—', panel: vars[it.var].join(', ') || '—' });
      } else {
        const n = Number(mv);
        if (!Number.isNaN(n) && n !== vars[it.var]) out.push({ label, mind: String(mv), panel: String(vars[it.var]) });
      }
    }
    return out;
  }

  /* ---------- Änderungsvorschläge aus einer Antwort ---------- */
  // rules: [{ pattern, label?, set/add/push/remove/quest }]. Gibt [{ rule, index, groups, match }] zurück.
  function suggestions(rules, reply) {
    const out = [];
    const text = String(reply || '').split('\n').filter((l) => !isStatus(l)).join('\n');
    (rules || []).forEach((rule, index) => {
      let re; try { re = new RegExp(rule.pattern, 'gi'); } catch { return; }
      let m, n = 0;
      while ((m = re.exec(text)) && n < 10) {
        n++;
        if (m[0] === '') { re.lastIndex++; continue; }
        const groups = {};
        m.slice(1).forEach((g, i) => { groups['g' + (i + 1)] = plainText(g == null ? '' : g); });
        out.push({ rule, index, groups, match: plainText(m[0]), key: index + ':' + lc(m[0]) });
      }
    });
    // gleiche Treffer nur einmal
    const seen = new Set();
    return out.filter((s) => (seen.has(s.key) ? false : seen.add(s.key)));
  }

  /* ---------- Quests ---------- */
  const questState = (s) => (QUEST_STATES.includes(s) ? s : 'open');
  function questInit(spec, saved) {
    const out = {};
    (spec || []).forEach((q) => { out[q.id] = questState((saved && saved[q.id]) || q.state); });
    return out;
  }
  // Schlüssel für "when": quest.<id>, dazu Zähler.
  function questWhen(spec, states) {
    const o = {};
    (spec || []).forEach((q) => { o['quest.' + q.id] = states[q.id]; });
    o.questsDone = Object.values(states).filter((s) => s === 'done').length;
    o.questsActive = Object.values(states).filter((s) => s === 'active').length;
    return o;
  }

  self.MindWorld = {
    QUEST_STATES, findLocation, byId, exits, neighbourId, parseChoices, diffVars, applyOps, describeOps,
    guardCheck, suggestions, questInit, questWhen, questState, plainText,
  };
})();
