// Reine Node-Tests für assistant.js (Profil-Assistent). Aufruf: node tests/assistant.test.js
global.self = global;
require('../assistant.js');
const fs = require('fs');
const A = self.MindAssistant;
const res = [];
const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));

const tplOf = (f) => { const md = fs.readFileSync(f, 'utf8'); return md.split('<!-- PROMPT START -->')[1].split('<!-- PROMPT END -->')[0].trim(); };
const en = tplOf(__dirname + '/../PROMPT-Profile-Generator.md');
const de = tplOf(__dirname + '/../PROMPT-Profile-Generator.de.md');
const form = { name: 'Noir', mindLang: 'English', panelLang: 'German', about: 'A detective in 1948', actions: 'ask, watch', events: 'radio', status: 'place, cash', look: 'amber', scenarios: 'no' };

// Auftrag
let p = A.buildPrompt(en, form, 'abc123XY');
ok('prompt: starts with the out-of-role note', p.startsWith('IMPORTANT: This is a technical task'), p.slice(0, 80));
ok('prompt: keeps the format rules', p.includes('# FORMAT') && p.includes('# CHECKLIST') && p.includes('# EXAMPLE'));
ok('prompt: fill-in block replaced, once', (p.match(/# MY MIND/g) || []).length === 1 && !p.includes('(fill in)'));
ok('prompt: values and mind id are in', p.includes('- Name of the mind: Noir') && p.includes('- Mind ID (from the URL): abc123XY') && p.includes('A detective in 1948'));
ok('prompt: ends with the filled block', /- Scenarios wanted\?: no\n$/.test(p), p.slice(-60));
p = A.buildPrompt(en, { name: 'X' }, null);
ok('prompt: empty fields get a neutral text, unknown id said so', p.includes('- Mind ID (from the URL): (unknown)') && p.includes('- Desired look: (not given, choose sensibly)'));
p = A.buildPrompt(de, form, 'abc123XY');
ok('prompt de: German note and block', p.startsWith('WICHTIG:') && p.includes('# MEIN MIND') && p.includes('- Mind-ID (aus der URL): abc123XY') && !p.includes('(ausfüllen)'));

// JSON aus der Antwort
const prof = { id: 'noir', name: 'Noir', mindIds: ['abc123XY'], prefixes: { actor: 'A', world: 'W' }, tabs: [{ id: 't', label: 'T', blocks: [] }], convention: 'Use "{hp}" and {wp}.' };
const json = JSON.stringify(prof, null, 2);
let r = A.extractJson('Here you go:\n```json\n' + json + '\n```\nNote: check the colours.');
ok('extract: code block with notes around', r && r.obj && r.obj.id === 'noir', r);
r = A.extractJson('json\n' + json + '\nCopy code');
ok('extract: innerText of a code block (label and button text)', r && r.obj && r.obj.id === 'noir', r);
r = A.extractJson('{"hint": "x"} and then ' + json);
ok('extract: picks the profile, not other braces', r && r.obj && r.obj.id === 'noir', r);
r = A.extractJson(json.replace('"noir"', '“noir”'));
ok('extract: typographic quotes are repaired', r && r.obj && r.obj.id === 'noir', r);
ok('extract: braces inside strings do not confuse it', A.extractJson(JSON.stringify({ id: 'a1', tabs: [], convention: 'x } y { z' })).obj.id === 'a1');
r = A.extractJson('```json\n' + json.replace('"name": "Noir",', '"name": "Noir"') + '\n```');
ok('extract: broken JSON is returned as text for fixing', r && r.obj === null && r.text.startsWith('{') && r.text.includes('"id": "noir"'), r);
r = A.extractJson('```json\n' + json.slice(0, 120));
ok('extract: truncated reply is returned as text', r && r.obj === null && r.text.includes('"id"'), r);
ok('extract: prose without JSON gives null', A.extractJson('I am the detective. What do you do?') === null && A.extractJson('') === null && A.extractJson(null) === null);
ok('extract: array of objects without profile is no profile', A.extractJson('[{"a":1},{"b":2}]') === null);

// Mind-ID
let w = A.withMindId({ id: 'a1', tabs: [] }, 'abc123XY');
ok('mindId: missing list is added', w.added && JSON.stringify(w.obj.mindIds) === '["abc123XY"]', w);
w = A.withMindId({ id: 'a1', mindIds: [] }, 'abc123XY');
ok('mindId: empty list is filled', w.added && w.obj.mindIds[0] === 'abc123XY', w);
w = A.withMindId({ id: 'a1', mindIds: ['HIER-DIE-MIND-ID'] }, 'abc123XY');
ok('mindId: placeholder from the template is replaced', w.added && JSON.stringify(w.obj.mindIds) === '["abc123XY"]', w);
w = A.withMindId({ id: 'a1', mindIds: ['<MIND-ID>'] }, 'abc123XY');
ok('mindId: <placeholder> is replaced', JSON.stringify(w.obj.mindIds) === '["abc123XY"]', w);
w = A.withMindId({ id: 'a1', mindIds: ['abc123XY'] }, 'abc123XY');
ok('mindId: already there, object untouched', !w.added && w.obj.mindIds.length === 1);
const same = { id: 'a1', mindIds: ['abc123XY'] };
ok('mindId: returns the very same object when nothing changes', A.withMindId(same, 'abc123XY').obj === same);
w = A.withMindId({ id: 'a1', mindIds: ['otherId99'] }, 'abc123XY');
ok('mindId: a real other id is kept, ours is added', JSON.stringify(w.obj.mindIds) === '["otherId99","abc123XY"]', w);
w = A.withMindId({ id: 'a1', mindIds: ['https://venice.ai/chat/minds/local/abc123XY/x'] }, 'abc123XY');
ok('mindId: pasted URL counts as the id (the registry reads URLs too)', !w.added && w.obj.mindIds.length === 1, w);
w = A.withMindId({ id: 'a1' }, null);
ok('mindId: unknown id changes nothing', !w.added && !('mindIds' in w.obj));
ok('mindId: original object is not modified', (() => { const o = { id: 'a1' }; A.withMindId(o, 'abc123XY'); return !('mindIds' in o); })());
ok('normId: url, id and junk', A.normId('https://venice.ai/chat/minds/mel-taminda-3281/bnOmuOw') === 'mel-taminda-3281' && A.normId('abc12') === 'abc12' && A.normId('ab') === null);

// Fertigerkennung
const st = { base: { count: 3, text: 'old' }, text: '', since: 0 };
ok('settled: nothing new yet', A.settled(st, { ok: true, count: 3, text: 'old' }, 1000, 6000) === false);
ok('settled: no reply object', A.settled(st, { ok: false }, 1000, 6000) === false && A.settled(st, null, 1000, 6000) === false);
ok('settled: first sight of new text starts the timer', A.settled(st, { ok: true, count: 4, text: 'new' }, 2000, 6000) === false && st.since === 2000);
ok('settled: text still growing resets the timer', A.settled(st, { ok: true, count: 4, text: 'new, longer' }, 5000, 6000) === false && st.since === 5000);
ok('settled: unchanged but too early', A.settled(st, { ok: true, count: 4, text: 'new, longer' }, 9000, 6000) === false);
ok('settled: unchanged long enough', A.settled(st, { ok: true, count: 4, text: 'new, longer' }, 11000, 6000) === true);
ok('settled: same count but changed text counts as new', A.settled({ base: { count: 3, text: 'a' }, text: '', since: 0 }, { ok: true, count: 3, text: 'b' }, 1, 1) === false);

console.log(res.join('\n'));
const failed = res.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `RESULT: ${failed} FAILED` : `RESULT: ALL ${res.length} PASSED`);
process.exit(failed ? 1 : 0);
