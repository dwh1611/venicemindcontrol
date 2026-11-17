// Reine Node-Tests für world.js und die neuen Registry-Prüfungen (v1.3). Aufruf: node tests/world.test.js
global.self = global;
require('../profiles/registry.js');
require('../world.js');
const W = self.MindWorld, P = self.MindProfiles;
const res = [];
const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));
const J = (x) => JSON.stringify(x);

/* ---- Orte ---- */
const loc = { key: 'loc', start: 'hall', minutes: 3, items: [
  { id: 'hall', label: 'Hall', match: 'foyer|great hall', neighbours: ['kitchen', { id: 'garden', minutes: 10 }] },
  { id: 'kitchen', label: 'Kitchen', neighbours: ['hall'] },
  { id: 'garden', label: 'Garden', neighbours: ['hall', 'ghost'] },
] };
ok('findLocation by label, ci', W.findLocation(loc, 'kitchen').id === 'kitchen' && W.findLocation(loc, ' HALL ').id === 'hall');
ok('findLocation by id and match regex', W.findLocation(loc, 'The Foyer').id === 'hall' && W.findLocation(loc, 'garden').id === 'garden');
ok('findLocation unknown / empty', W.findLocation(loc, 'cellar') === null && W.findLocation(loc, '') === null && W.findLocation(null, 'x') === null);
ok('exits: neighbours with default and own minutes', J(W.exits(loc, 'hall')) === J([{ id: 'kitchen', label: 'Kitchen', text: 'Kitchen', m: 3 }, { id: 'garden', label: 'Garden', text: 'Garden', m: 10 }]), W.exits(loc, 'hall'));
ok('exits: unknown neighbours are left out, unknown place gives none', W.exits(loc, 'garden').length === 1 && W.exits(loc, 'nowhere').length === 0);

/* ---- Auswahl ---- */
const ch = (t, c) => W.parseChoices(t, c).map((x) => x.label);
ok('choices: numbered 1.', J(ch('You stand there.\n\n1. Open the door\n2. Run away\n3. Wait')) === '["Open the door","Run away","Wait"]');
ok('choices: numbered 1)', J(ch('What now?\n1) Left\n2) Right')) === '["Left","Right"]');
ok('choices: letters A)', J(ch('Pick:\nA) Fight\nB) Flee')) === '["Fight","Flee"]');
ok('choices: bullets', J(ch('Options:\n- Go north\n- Go south\n• Stay')) === '["Go north","Go south","Stay"]');
ok('choices: markdown is stripped', J(ch('1. **Open** the _door_\n2. `Run`')) === '["Open the door","Run"]');
ok('choices: status line is ignored', J(ch('1. Yes\n2. No\n\n⏱ 10:00 · 📍 Hall')) === '["Yes","No"]');
ok('choices: no options gives nothing', ch('Just a story with no list.').length === 0 && ch('').length === 0);
ok('choices: a single item is no choice', ch('1. Only one').length === 0);
ok('choices: list in the middle of the text is not a choice', ch('Intro\n- a\n- b\nOne.\nTwo.\nThree.').length === 0 && ch('Intro\n1. a\n2. b\nWhat do you do?').length === 2);
ok('choices: numbers must run in order', ch('1. a\n3. b').length === 0 && ch('2. a\n3. b').length === 0);
ok('choices: only the last block counts', J(ch('1. old\n2. old2\nText\n1. new\n2. new2')) === '["new","new2"]');
ok('choices: max', ch('1. a\n2. b\n3. c\n4. d', { max: 2 }).length === 2);
ok('choices: custom pattern, group 1 text and group 2 key', J(W.parseChoices('go on <7>\nstop <9>', { pattern: '^(.+?) <(\\d)>$' }).map((x) => [x.n, x.label])) === '[["7","go on"],["9","stop"]]');
ok('choices: custom pattern picks matching lines', J(W.parseChoices('>> Open\nnoise\n>> Close', { pattern: '^>>\\s*(.+)$' }).map((x) => [x.n, x.label])) === '[["1","Open"],["2","Close"]]');
ok('choices: bad pattern is harmless', W.parseChoices('x', { pattern: '(' }).length === 0);

/* ---- Variablen-Änderungen ---- */
const spec = { hp: { type: 'number', min: 0, max: 10 }, gold: { type: 'number' }, items: { type: 'list' } };
const v0 = { hp: 8, gold: 5, items: ['key', 'rope'] };
const v1 = { hp: 5, gold: 5, items: ['rope', 'lamp'] };
const ops = W.diffVars(v0, v1, spec);
ok('diff: number delta and list add/del', J(ops) === J([{ k: 'hp', kind: 'num', d: -3 }, { k: 'items', kind: 'list', add: ['lamp'], del: ['key'] }]), ops);
ok('diff: nothing changed gives no ops', W.diffVars(v0, v0, spec).length === 0);
let r = W.applyOps(v1, ops, -1, spec);
ok('undo restores the old state', r.ok && r.vars.hp === 8 && J(r.vars.items.slice().sort()) === J(['key', 'rope']), r);
r = W.applyOps(r.vars, ops, 1, spec);
ok('redo reapplies', r.ok && r.vars.hp === 5 && J(r.vars.items.slice().sort()) === J(['lamp', 'rope']), r);
ok('undo does not modify its input', J(v1) === J({ hp: 5, gold: 5, items: ['rope', 'lamp'] }));
r = W.applyOps({ hp: 9, gold: 0, items: [] }, [{ k: 'hp', kind: 'num', d: -3 }], -1, spec);
ok('undo that would break the max is refused, state untouched', !r.ok && r.error.code === 'above' && r.vars.hp === 9, r);
r = W.applyOps({ hp: 1, gold: 0, items: [] }, [{ k: 'hp', kind: 'num', d: 3 }], -1, spec);
ok('undo that would break the min is refused', !r.ok && r.error.code === 'below');
r = W.applyOps({ gold: 0 }, [{ k: 'items', kind: 'list', add: ['x'], del: [] }], -1, spec);
ok('undo of a vanished variable is refused', !r.ok && r.error.code === 'gone');
r = W.applyOps({ hp: 5, gold: 0, items: ['a', 'A'] }, [{ k: 'items', kind: 'list', add: ['a'], del: [] }], -1, spec);
ok('undo of a push removes one matching entry only', r.ok && r.vars.items.length === 1);
ok('describe ops', W.describeOps(ops, (k) => k.toUpperCase()) === 'HP −3 · ITEMS +lamp, ITEMS −key', W.describeOps(ops, (k) => k.toUpperCase()));
ok('describe quest op', W.describeOps([{ kind: 'quest', id: 'q', from: 'open', to: 'done' }], (k) => 'Q:' + k) === 'Q:q open → done');
ok('quest ops pass through applyOps untouched', W.applyOps({}, [{ kind: 'quest', id: 'q', from: 'open', to: 'done' }], -1, {}).ok);

/* ---- Guard ---- */
const guard = { items: [{ key: 'hp', var: 'hp', label: 'HP' }, { key: 'items', var: 'items' }, { key: 'loc', location: true }] };
const vars = { hp: 5, gold: 0, items: ['key', 'rope'] };
ok('guard: all equal gives nothing', W.guardCheck(guard, { hp: 5, items: ['Rope', 'key'], loc: 'Hall' }, vars, spec, loc, 'hall').length === 0);
let gm = W.guardCheck(guard, { hp: 3, items: ['key'], loc: 'Kitchen' }, vars, spec, loc, 'hall');
ok('guard: number, list and location drift found', gm.length === 3 && gm[0].label === 'HP' && gm[0].mind === '3' && gm[0].panel === '5' && gm[1].mind === 'key' && gm[2].mind === 'Kitchen' && gm[2].panel === 'Hall', gm);
ok('guard: missing status values are no drift', W.guardCheck(guard, { time: '10:00' }, vars, spec, loc, 'hall').length === 0 && W.guardCheck(guard, null, vars, spec, loc, 'hall').length === 0);
ok('guard: unknown place text is no drift', W.guardCheck(guard, { loc: 'Moon' }, vars, spec, loc, 'hall').length === 0);

/* ---- Vorschläge ---- */
const rules = [{ pattern: 'you lose (\\d+) HP', add: { hp: '-{g1}' } }, { pattern: 'you find (?:a |an )?([^.\\n]+)', push: { items: '{g1}' } }];
let sg = W.suggestions(rules, 'Ouch, you lose 3 HP. Later you find a brass key.\n⏱ 10:00 · you lose 9 HP');
ok('suggest: matches with groups, status line ignored', sg.length === 2 && sg[0].groups.g1 === '3' && sg[1].groups.g1 === 'brass key', sg);
ok('suggest: same hit only once', W.suggestions(rules, 'you lose 3 HP and you lose 3 HP').length === 1);
ok('suggest: several different hits', W.suggestions(rules, 'you lose 3 HP, you lose 4 HP').length === 2);
ok('suggest: nothing found, bad pattern ignored', W.suggestions(rules, 'nothing happens').length === 0 && W.suggestions([{ pattern: '(' }], 'x').length === 0);

/* ---- Quests ---- */
const qs = [{ id: 'key', label: 'Find key' }, { id: 'door', label: 'Open door', state: 'active' }];
const st = W.questInit(qs, { key: 'done', door: 'bogus' });
ok('quests: init uses saved states, falls back for junk', J(st) === '{"key":"done","door":"open"}', st);
ok('quests: default state from the profile', W.questInit(qs).door === 'active' && W.questInit(qs).key === 'open');
ok('quests: when keys and counters', J(W.questWhen(qs, { key: 'done', door: 'active' })) === J({ 'quest.key': 'done', 'quest.door': 'active', questsDone: 1, questsActive: 1 }));
ok('quests: when works with MindProfiles.test', P.test({ key: 'quest.key', eq: 'done' }, W.questWhen(qs, st)) === true && P.test({ key: 'questsDone', gte: 2 }, W.questWhen(qs, st)) === false);

/* ---- Registry: neue Abschnitte ---- */
const theme = { fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d', deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255' };
const act = { who: 'actor', parts: ['GO', '{item}'], shift: true };
const base = (over = {}) => ({
  id: 'w1', name: 'W', mindIds: ['TESTMIND1'], prefixes: { actor: 'PLAYER', world: 'WORLD' }, theme, header: { logo: 'T', meta: [], prompt: '>' },
  variables: { hp: { value: 5, min: 0, max: 10 }, items: { type: 'list', value: [] } },
  tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['One'], action: { who: 'actor', parts: ['ACT'] } }] }], ...over,
});
const errs = (p) => P.validate(p).errors.map((e) => e.k);
const goodLoc = { key: 'loc', start: 'hall', items: [
  { id: 'hall', label: { en: 'Hall', de: 'Halle' }, neighbours: ['kitchen'], hint: 'Cold', theme: { fg: '#ff0000', glow: '255,0,0' }, audio: 'https://x.test/a.mp3', image: 'https://x.test/a.jpg' },
  { id: 'kitchen', label: 'Kitchen', neighbours: [{ id: 'hall', minutes: 5 }] }] };
const withTravel = (extra) => base({ locations: goodLoc, tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'travel', cap: 'GO', action: act }] }], ...extra });
ok('registry: full world profile is valid', P.validate(withTravel({
  choices: { action: { who: 'actor', parts: ['CHOICE', '{item}'] }, max: 5, pattern: '^>>(.+)$' },
  suggest: [{ pattern: 'lose (\\d+)', add: { hp: '-{g1}' }, label: 'Damage' }],
  guard: { items: [{ key: 'hp', var: 'hp' }, { key: 'loc', location: true }] }, correction: { kind: 'FIX', text: 'x', undo: 'y' },
  quests: [{ id: 'key', label: 'Key', state: 'active' }],
  events: [{ id: 'e', at: '10:00', kind: 'SMS', text: 'x', when: { key: 'quest.key', eq: 'done' } }],
})).ok, P.validate(withTravel({})).errors);
ok('registry: localised place labels resolve', P.resolve(goodLoc, 'de').items[0].label === 'Halle');
ok('registry: travel without locations', errs(base({ tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'travel', action: act }] }] })).includes('travelNeedsLoc'));
ok('registry: travel needs action.parts', errs(withTravel({ tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'travel' }] }] })).includes('actionParts'));
ok('registry: unknown neighbour reported', errs(base({ locations: { items: [{ id: 'a1', label: 'A', neighbours: ['zz'] }] } })).includes('locNeighbour'));
ok('registry: unknown neighbour in { id } form reported', errs(base({ locations: { items: [{ id: 'a1', label: 'A', neighbours: [{ id: 'zz' }] }] } })).includes('locNeighbour'));
ok('registry: unknown start reported', errs(base({ locations: { start: 'no', items: [{ id: 'a1', label: 'A' }] } })).includes('locStart'));
ok('registry: duplicate place id', errs(base({ locations: { items: [{ id: 'a1', label: 'A' }, { id: 'a1', label: 'B' }] } })).includes('locDup'));
ok('registry: bad place (id, regex, theme colour, http url)', ['Bad Id', 'x'].every((id) => errs(base({ locations: { items: [{ id, label: 'A' }] } })).includes('locItem') || id === 'x') &&
  errs(base({ locations: { items: [{ id: 'a1', label: 'A', match: '(' }] } })).includes('locItem') &&
  errs(base({ locations: { items: [{ id: 'a1', label: 'A', theme: { fg: 'red' } }] } })).includes('locItem') &&
  errs(base({ locations: { items: [{ id: 'a1', label: 'A', audio: 'http://x.test/a.mp3' }] } })).includes('locItem') &&
  errs(base({ locations: { items: [{ id: 'a1', label: 'A', image: 'javascript:alert(1)' }] } })).includes('locItem'));
ok('registry: locations needs items', errs(base({ locations: {} })).includes('locBad') && errs(base({ locations: { items: [] } })).includes('locBad'));
ok('registry: choices needs action.parts', errs(base({ choices: {} })).includes('choicesBad') && errs(base({ choices: { action: { parts: ['X'] }, pattern: '(' } })).includes('choicesBad') && errs(base({ choices: { action: { parts: ['X'] }, max: 99 } })).includes('choicesBad'));
ok('registry: choices action effects are checked', errs(base({ choices: { action: { parts: ['X'], add: { nope: 1 } } } })).includes('varMissing'));
ok('registry: suggest needs pattern and an effect', errs(base({ suggest: [{ pattern: 'x' }] })).includes('suggestBad') && errs(base({ suggest: [{ add: { hp: 1 } }] })).includes('suggestBad') && errs(base({ suggest: [{ pattern: '(', add: { hp: 1 } }] })).includes('suggestBad'));
ok('registry: suggest effects point to variables', errs(base({ suggest: [{ pattern: 'x', add: { nope: 1 } }] })).includes('varMissing'));
ok('registry: guard needs a known variable', errs(base({ guard: { items: [{ key: 'hp', var: 'nope' }] } })).includes('guardVar') && errs(base({ guard: { items: [] } })).includes('guardBad') && errs(base({ guard: { items: [{ key: 'loc', location: true }] } })).includes('guardBad'));
ok('registry: correction kind must be capitals', errs(base({ correction: { kind: 'fix' } })).includes('correctionBad') && !errs(base({ correction: { kind: 'FIX' } })).includes('correctionBad'));
ok('registry: quests need unique ids and labels', errs(base({ quests: [{ id: 'a1', label: 'A' }, { id: 'a1', label: 'B' }] })).includes('questsBad') && errs(base({ quests: [{ id: 'a1' }] })).includes('questsBad') && errs(base({ quests: [{ id: 'a1', label: 'A', state: 'weird' }] })).includes('questsBad') && errs(base({ quests: [] })).includes('questsBad'));
const qa = (quest) => base({ quests: [{ id: 'k1', label: 'K' }], tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['x'], action: { who: 'actor', parts: ['A'], quest } }] }] });
ok('registry: quest effect', !errs(qa({ k1: 'done' })).length && errs(qa({ nope: 'done' })).includes('questMissing') && errs(qa({ k1: 'weird' })).includes('questMissing') && errs(qa('x')).includes('fxBad'));
ok('registry: quest effect without quests section', errs(base({ tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['x'], action: { who: 'actor', parts: ['A'], quest: { k1: 'done' } } }] }] })).includes('questMissing'));
ok('registry: event when is validated', errs(base({ events: [{ id: 'e', at: '10:00', kind: 'SMS', text: 'x', when: { key: 'a' } }] })).includes('whenBad'));
ok('registry: german messages exist for every new code', ['locBad', 'locItem', 'locDup', 'locNeighbour', 'locStart', 'travelNeedsLoc', 'choicesBad', 'guardBad', 'guardVar', 'correctionBad', 'suggestBad', 'questsBad', 'questMissing']
  .every((k) => { const de = P.explain([{ k, p: { w: 'x', i: 1, id: 'x', k: 'x' } }], 'de')[0]; const en = P.explain([{ k, p: { w: 'x', i: 1, id: 'x', k: 'x' } }], 'en')[0]; return de && en && de !== k && en !== k && de !== en; }));

console.log(res.join('\n'));
const failed = res.filter((x) => x.startsWith('FAIL')).length;
console.log(failed ? `RESULT: ${failed} FAILED` : `RESULT: ALL ${res.length} PASSED`);
process.exit(failed ? 1 : 0);
