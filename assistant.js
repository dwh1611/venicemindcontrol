// Profil-Assistent (#41): reine Textlogik. Baut den Auftrag an das Mind, holt das JSON aus dessen Antwort
// und trägt die Mind-ID nach. Kein Zugriff auf Chrome-APIs, damit sich alles in Node testen lässt.
// Das Senden, Warten und Öffnen des Editors steht in sidepanel.js.
(() => {
  const ID_RX = /^[A-Za-z0-9_-]{5,}$/;
  // Platzhalter aus der Vorlage, die das Mind gern unverändert übernimmt.
  const PLACEHOLDER = /mind[-_ ]?id|hier|your|example|xxx|[<>]|^id$/i;

  // Die Vorlage endet mit einem Abschnitt "MY MIND" / "MEIN MIND" (zum Ausfüllen). Er wird durch die Angaben ersetzt.
  function buildPrompt(template, f, mindId) {
    const de = /MEIN MIND/.test(template);
    const cut = template.search(/^# (MY MIND|MEIN MIND)[^\n]*$/m);
    const body = (cut >= 0 ? template.slice(0, cut) : template).trimEnd();
    const val = (x) => String(x || '').trim() || (de ? '(nicht angegeben, sinnvoll wählen)' : '(not given, choose sensibly)');
    const rows = de
      ? [['Name des Minds', f.name], ['Mind-ID (aus der URL)', mindId || '(unbekannt)'], ['Sprache des Minds (Chat-Texte)', f.mindLang],
        ['Sprache des Panels (Beschriftungen)', f.panelLang], ['Worum geht es (Rolle des Nutzers, Figur, Stimmung, Welt)', f.about],
        ['Was kann der Nutzer tun? (Aktionen, die zu Buttons werden sollen)', f.actions], ['Welche Ereignisse kommen von außen?', f.events],
        ['Welche Werte stehen in der Statuszeile?', f.status], ['Gewünschte Optik', f.look], ['Szenarien gewünscht?', f.scenarios]]
      : [['Name of the mind', f.name], ['Mind ID (from the URL)', mindId || '(unknown)'], ['Language of the mind (chat texts)', f.mindLang],
        ['Language of the panel (labels)', f.panelLang], ['What is it about (role of the user, character, mood, world)', f.about],
        ['What can the user do? (actions that should become buttons)', f.actions], ['Which events come from outside?', f.events],
        ['Which values are in the status line?', f.status], ['Desired look', f.look], ['Scenarios wanted?', f.scenarios]];
    const head = de
      ? 'WICHTIG: Das ist ein technischer Auftrag der Browser-Erweiterung, kein Teil des Rollenspiels. Steige für diese Antwort aus der Rolle aus und antworte nur wie unten verlangt.\n\n'
      : 'IMPORTANT: This is a technical task from the browser extension, not part of the roleplay. Step out of any role for this reply and answer only as required below.\n\n';
    return head + body + '\n\n# ' + (de ? 'MEIN MIND' : 'MY MIND') + '\n' + rows.map(([k, v]) => `- ${k}: ${val(v)}`).join('\n') + '\n';
  }

  // Alle ausgeglichenen {...}-Stücke eines Textes (Anführungszeichen und Escapes werden beachtet).
  function objects(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '{') continue;
      let depth = 0, str = false, esc = false;
      for (let j = i; j < text.length; j++) {
        const c = text[j];
        if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
        if (c === '"') str = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { out.push(text.slice(i, j + 1)); i = j; break; }
      }
    }
    return out;
  }

  const looksLikeProfile = (o) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.id === 'string' && (o.tabs || o.prefixes || o.theme);

  // Holt das Profil aus einer Antwort. { obj, text } bei gültigem JSON, { obj: null, text } mit dem größten
  // Fund (zum Nachbessern im Editor), sonst null, wenn gar keine Klammer vorkommt.
  function extractJson(reply) {
    const s = String(reply || '').replace(/[“”]/g, '"');
    let best = null;
    for (const chunk of objects(s)) {
      try {
        const obj = JSON.parse(chunk);
        if (looksLikeProfile(obj) && (!best || !best.obj || chunk.length > best.text.length)) best = { obj, text: chunk };
      } catch { /* kein gültiges JSON */ }
    }
    if (best) return best;
    // Abgebrochen oder fehlerhaft: ab der ersten Klammer, die nach einem Profil aussieht, bis zur letzten schließenden.
    const first = s.search(/\{\s*"id"\s*:/);
    if (first < 0) return null;
    const last = s.lastIndexOf('}');
    return { obj: null, text: s.slice(first, last > first ? last + 1 : undefined).trim() };
  }

  const normId = (x) => {
    const s = String(x || '').trim();
    if (ID_RX.test(s)) return s;
    const m = /\/minds\/(?:local\/)?([A-Za-z0-9_-]{5,})/.exec(s);
    return m ? m[1] : null;
  };

  // Trägt die Mind-ID ein, falls das Mind sie nicht (oder nur als Platzhalter) geschrieben hat.
  // Gibt { obj, added } zurück; obj ist eine Kopie.
  function withMindId(obj, mindId) {
    const id = normId(mindId);
    if (!obj || typeof obj !== 'object' || !id) return { obj, added: false };
    const have = (Array.isArray(obj.mindIds) ? obj.mindIds : []).map(normId).filter((x) => x && !PLACEHOLDER.test(x));
    const same = Array.isArray(obj.mindIds) && obj.mindIds.length === have.length && have.includes(id);
    if (same) return { obj, added: false };
    if (have.includes(id)) return { obj: { ...obj, mindIds: have }, added: false };
    return { obj: { ...obj, mindIds: [...have, id] }, added: true };
  }

  // Fertigerkennung: die Antwort ist neu (Zähler oder Text weicht vom Stand vor dem Senden ab) und blieb
  // `settleMs` lang unverändert. state wird fortgeschrieben: { base, text, since }.
  function settled(state, reply, now, settleMs) {
    if (!reply || !reply.ok) return false;
    const fresh = reply.count !== state.base.count || reply.text !== state.base.text;
    if (!fresh) return false;
    if (reply.text !== state.text) { state.text = reply.text; state.since = now; return false; }
    return now - state.since >= settleMs;
  }

  self.MindAssistant = { buildPrompt, extractJson, withMindId, settled, objects, normId };
})();
