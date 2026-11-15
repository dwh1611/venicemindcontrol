// Sprachausgabe im Panel (#28): nachgebaute speechSynthesis aus tests/preload.js.
const { open, base, run, wait } = require('./lib');

run(async () => {
  const T = await open(base({ speech: { speakers: { Mel: { pitch: 1.3 } } } }));
  const { ev, ok } = T;
  const spoken = () => ev(`window.__spoken`);
  const reply = (txt) => ev(`window.__replies[1]=${JSON.stringify(txt)};0`);
  const toggle = (on) => ev(`const c=document.getElementById('speechOn');c.checked=${on};c.dispatchEvent(new Event('change'));0`.replace('const c', 'var c'));

  ok('speech box exists', (await ev(`!!document.getElementById('speechBox')`)) === true);
  const optsLocal = await ev(`[...document.querySelectorAll('#speechVoice option')].map(o=>o.value)`);
  ok('voices: local only by default', JSON.stringify(optsLocal) === '["","Anna","Daniel","Alex"]', optsLocal);

  // Bereits vorhandene Antwort wird beim Einschalten nicht gelesen
  await reply('Existing reply that must stay silent.');
  await toggle(true);
  await wait(2200);
  ok('baseline: existing reply is not spoken', (await spoken()).length === 0, await spoken());

  // Neue Antwort: erst nach der Ruhezeit, ohne Statuszeile, Sprecher aus dem Profil
  await reply('Mel: New reply here.\n\n⏱ 10:05 · 📍 Hall');
  await wait(1500);
  ok('settle: not spoken while still fresh', (await spoken()).length === 0, await spoken());
  await wait(3500);
  let s = await spoken();
  ok('new reply is spoken once, status line left out', s.length === 1 && s[0].text === 'New reply here.', s);
  ok('speaker pitch from profile and a matching voice', s[0].pitch === 1.3 && s[0].voice === 'Alex' && s[0].lang === 'en-US', s[0]);
  await wait(2500);
  ok('same reply is not repeated', (await spoken()).length === 1);

  // Antwort, die noch wächst: nur die fertige Fassung
  await reply('Part one');
  await wait(1300);
  await reply('Part one and the finished text.');
  await wait(5000);
  s = await spoken();
  ok('streaming reply is spoken only when settled', s.length === 2 && s[1].text === 'Part one and the finished text.', s);

  // Platzhalter sind keine Antwort
  await reply('Loading...');
  await wait(4500);
  ok('placeholder is not spoken', (await spoken()).length === 2);

  // Einstellungen: Stimme wählen, Tempo, Speicherung
  await ev(`var v=document.getElementById('speechVoice');v.value='Daniel';v.dispatchEvent(new Event('change'));var r=document.getElementById('speechRate');r.value='1.5';r.dispatchEvent(new Event('change'));0`);
  const prefs = await ev(`window.__store.speechPrefs`);
  ok('prefs stored', prefs && prefs.voice === 'Daniel' && prefs.rate === 1.5, prefs);
  await reply('Another reply with a chosen voice.');
  await wait(5000);
  s = await spoken();
  ok('chosen voice and speed are used', s.length === 3 && s[2].voice === 'Daniel' && s[2].rate === 1.5, s[2]);

  // Online-Stimmen nur nach Zustimmung
  await ev(`var o=document.getElementById('speechOnline');o.checked=true;o.dispatchEvent(new Event('change'));0`);
  const optsAll = await ev(`[...document.querySelectorAll('#speechVoice option')].map(o=>o.value)`);
  ok('voices: online listed after opt-in', optsAll.includes('Google US English'), optsAll);

  // Test-Knopf und STILL
  const n0 = (await spoken()).length;
  await ev(`document.getElementById('speechTest').click();0`);
  ok('test button speaks a sample', (await spoken()).length === n0 + 1);
  const c0 = await ev(`window.__cancelled`);
  await ev(`document.getElementById('speechStop').click();0`);
  ok('silence cancels the queue', (await ev(`window.__cancelled`)) === c0 + 1);

  // Ausschalten
  await toggle(false);
  const n1 = (await spoken()).length;
  await reply('A reply after switching off.');
  await wait(4500);
  ok('off: nothing more is spoken', (await spoken()).length === n1);

  T.finish();
});
