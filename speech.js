// Sprachausgabe (#28): reine Textlogik. Wählt aus einer Antwort die Sätze, die gesprochen werden, und ordnet
// ihnen Stimmen zu. Kein Zugriff auf Chrome-APIs, damit sich alles in Node testen lässt.
// Das eigentliche Sprechen (speechSynthesis) steht in sidepanel.js.
(() => {
  const STATUS_LINE = /^\s*⏱/;
  const SPEAKER = /^\s*[*_]*\s*([^\s:：*_][^:：*_\n]{0,30}?)\s*[*_]*\s*[:：]\s*(.*)$/;

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);

  // Markdown und Zeichen, die man nicht vorlesen will.
  function plain(line) {
    return line
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/`+/g, '')
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/[*_]{1,3}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Sehr kurze Sätze pro Stück, denn Chrome bricht lange Äußerungen nach etwa 15 Sekunden ab.
  function chunks(text, max = 180) {
    const out = [];
    const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    let cur = '';
    for (const s of sentences) {
      if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
      cur += s;
      while (cur.length > max * 1.5) { // Satz ohne Satzzeichen: an einem Leerzeichen trennen
        const at = cur.lastIndexOf(' ', max);
        const cut = at > 20 ? at : max;
        out.push(cur.slice(0, cut).trim());
        cur = cur.slice(cut);
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter((c) => /[\p{L}\p{N}]/u.test(c));
  }

  // Grobe Spracherkennung für Antworten ohne festgelegte Sprache: Deutsch oder Englisch.
  function guessLang(text) {
    const de = (text.match(/\b(und|der|die|das|nicht|ich|ist|ein|eine|mit|zu|nur|auch|wie|was|du|sie|er)\b/gi) || []).length;
    const en = (text.match(/\b(the|and|you|is|to|of|that|it|with|for|was|her|his|she|he|they)\b/gi) || []).length;
    return de > en ? 'de' : 'en';
  }

  // Aus Antworttext und Profil-Block `speech` die Liste der zu sprechenden Stücke:
  // [{ speaker, text, voice, rate, pitch, lang }]
  function plan(body, speech) {
    const cfg = speech && typeof speech === 'object' ? speech : {};
    const speakers = cfg.speakers && typeof cfg.speakers === 'object' ? cfg.speakers : {};
    const byName = {};
    Object.keys(speakers).forEach((k) => { byName[k.toLowerCase()] = k; });
    const skip = (Array.isArray(cfg.skip) ? cfg.skip : []).map((r) => { try { return new RegExp(r, 'i'); } catch { return null; } }).filter(Boolean);
    const lang = cfg.lang || guessLang(String(body));
    const out = [];
    let current = null;
    for (const raw of String(body).split('\n')) {
      if (!raw.trim() || STATUS_LINE.test(raw) || skip.some((r) => r.test(raw))) continue;
      let line = raw;
      const m = SPEAKER.exec(raw);
      if (m && byName[m[1].trim().toLowerCase()]) { current = byName[m[1].trim().toLowerCase()]; line = m[2]; }
      const text = plain(line);
      if (!text) continue;
      const sp = current ? speakers[current] || {} : {};
      for (const c of chunks(text)) {
        out.push({
          speaker: current,
          text: c,
          voice: sp.voice || cfg.voice || '',
          rate: clamp(num(sp.rate, num(cfg.rate, 1)), 0.5, 2),
          pitch: clamp(num(sp.pitch, num(cfg.pitch, 1)), 0, 2),
          lang: sp.lang || lang,
        });
      }
    }
    return out;
  }

  // Passende Stimme aus der Liste: erst nach Name (Teilstring), dann nach Sprache.
  function pickVoice(voices, name, lang) {
    if (!voices || !voices.length) return null;
    const n = String(name || '').trim().toLowerCase();
    if (n) {
      const v = voices.find((x) => x.name.toLowerCase() === n) || voices.find((x) => x.name.toLowerCase().includes(n));
      if (v) return v;
    }
    const l = String(lang || '').slice(0, 2).toLowerCase();
    if (l) return voices.find((x) => x.lang.toLowerCase().startsWith(l) && x.default) || voices.find((x) => x.lang.toLowerCase().startsWith(l)) || null;
    return null;
  }

  self.MindSpeech = { plan, chunks, plain, guessLang, pickVoice };
})();
