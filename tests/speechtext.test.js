// Reine Node-Tests für speech.js (Textaufbereitung für die Sprachausgabe). Aufruf: node tests/speechtext.test.js
global.self = global;
require('../speech.js');
const S = self.MindSpeech;
const res = [];
const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));

// Bereinigen
ok('plain: markdown removed', S.plain('**Bold** and _it_ and `code` # not') === 'Bold and it and code # not');
ok('plain: heading, quote, list, link', S.plain('## Title') === 'Title' && S.plain('> quote') === 'quote' && S.plain('- item') === 'item' && S.plain('[text](http://x.y)') === 'text');
ok('plain: bare url dropped', S.plain('see https://venice.ai/x now') === 'see now');

// Plan: Statuszeile und Leerzeilen fallen weg
const p1 = S.plan('The door opens.\n\n⏱ 10:05 · 📍 Hall · HP 5', {});
ok('plan: status line skipped', p1.length === 1 && p1[0].text === 'The door opens.', p1);

// Sprecher
const cfg = { voice: 'Alex', speakers: { Mel: { pitch: 1.3, rate: 1.1 }, Tam: { voice: 'Daniel', pitch: 0.8 } } };
const p2 = S.plan('Mel: Hello there.\nStill Mel talking.\n**Tam:** Hi!\nOther: unknown speaker line.', cfg);
ok('plan: speakers detected', p2[0].speaker === 'Mel' && p2[0].text === 'Hello there.' && p2[0].pitch === 1.3 && p2[0].rate === 1.1 && p2[0].voice === 'Alex', p2[0]);
ok('plan: unmarked line keeps the last speaker', p2[1].speaker === 'Mel' && p2[1].text === 'Still Mel talking.', p2[1]);
ok('plan: bold name marker, own voice', p2[2].speaker === 'Tam' && p2[2].text === 'Hi!' && p2[2].voice === 'Daniel' && p2[2].pitch === 0.8, p2[2]);
ok('plan: unknown name is not a speaker', p2[3].speaker === 'Tam' && p2[3].text === 'Other: unknown speaker line.', p2[3]);
ok('plan: case-insensitive name', S.plan('mel: x y z', cfg)[0].speaker === 'Mel');

// skip, Grenzen
const p3 = S.plan('Keep this.\n(OOC: ignore me)', { skip: ['^\\(OOC'] });
ok('plan: skip regex', p3.length === 1 && p3[0].text === 'Keep this.', p3);
ok('plan: rate and pitch are clamped', S.plan('Hello world', { rate: 9, pitch: -3 })[0].rate === 2 && S.plan('Hello world', { rate: 9, pitch: -3 })[0].pitch === 0);
ok('plan: nothing to say gives no items', S.plan('---\n\n⏱ 10:00', {}).length === 0);

// Stücke
const long = 'One sentence here. '.repeat(30);
const c = S.chunks(long);
ok('chunks: split into short parts', c.length > 1 && c.every((x) => x.length <= 200), c.map((x) => x.length));
ok('chunks: text without punctuation is cut at spaces', S.chunks('word '.repeat(100)).every((x) => x.length <= 280));

// Sprache und Stimme
ok('lang: german', S.guessLang('Ich bin nicht sicher, was das ist und warum du es tust.') === 'de');
ok('lang: english', S.guessLang('She was not sure what it was and why he did it.') === 'en');
ok('plan: explicit lang wins', S.plan('Ich bin nicht sicher.', { lang: 'en-GB' })[0].lang === 'en-GB');
const voices = [{ name: 'Alex', lang: 'en-US', default: true }, { name: 'Daniel', lang: 'en-GB' }, { name: 'Anna', lang: 'de-DE', default: true }];
ok('voice: by exact and partial name', S.pickVoice(voices, 'daniel', 'de').name === 'Daniel' && S.pickVoice(voices, 'ann', 'en').name === 'Anna');
ok('voice: by language, default first', S.pickVoice(voices, '', 'en').name === 'Alex' && S.pickVoice(voices, '', 'de-DE').name === 'Anna');
ok('voice: none when nothing matches', S.pickVoice(voices, 'nobody', '') === null && S.pickVoice([], 'x', 'en') === null);

console.log(res.join('\n'));
const failed = res.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `RESULT: ${failed} FAILED` : `RESULT: ALL ${res.length} PASSED`);
process.exit(failed ? 1 : 0);
