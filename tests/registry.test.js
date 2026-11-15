// Reine Node-Tests für profiles/registry.js (Validierung, Bedingungen, Würfel). Aufruf: node tests/registry.test.js
global.self = global;
require('../profiles/registry.js');
const P = self.MindProfiles;
const res = [];
const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));

const theme = { fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d', deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255' };
const base = (over = {}) => ({
  id: 'testprof', name: 'Test', mindIds: ['TESTMIND1'], prefixes: { actor: 'PLAYER', world: 'WORLD' }, theme,
  header: { logo: 'T', meta: [], prompt: '>' },
  tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['One'], action: { who: 'actor', parts: ['ACT'], body: ['{item}'] } }] }],
  ...over,
});
const errs = (p) => P.validate(p).errors.map((e) => e.k);
const withAction = (action, extra = {}) => base({ ...extra, tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'G', items: ['One'], action: { who: 'actor', parts: ['ACT'], body: ['{item}'], ...action } }] }] });

// Würfel
ok('parseDice d20', JSON.stringify(P.parseDice('d20')) === '{"n":1,"sides":20,"mod":0}', P.parseDice('d20'));
ok('parseDice 2d6+1', JSON.stringify(P.parseDice('2d6+1')) === '{"n":2,"sides":6,"mod":1}');
ok('parseDice 3D8-2', JSON.stringify(P.parseDice('3D8-2')) === '{"n":3,"sides":8,"mod":-2}');
ok('parseDice rejects junk', !P.parseDice('banana') && !P.parseDice('d1') && !P.parseDice('0d6') && !P.parseDice('21d6') && !P.parseDice('d1001'));

// gültiges Profil mit allen neuen Feldern
const full = base({
  variables: { hp: { type: 'number', label: 'HP', value: 5, min: 0, max: 10 }, money: { value: 100, min: 0 }, items: { type: 'list', value: ['key'] } },
  tables: { weather: ['Rain', { text: 'Storm', weight: 3 }], mood: { entries: ['a', 'b'] } },
  events: [{ id: 'e1', at: '22:00', kind: 'SMS', who: 'Mara', text: 'hi' }, { id: 'e2', in: 30, kind: 'WEATHER', text: 'rain' }],
  state: { lists: [{ key: 'seen', regex: 'Seen:\\s*(.+)' }] },
  tabs: [{ id: 'a', label: 'A', blocks: [
    { type: 'grid', cap: 'x', itemsFrom: 'items', action: { who: 'actor', parts: ['USE'], body: ['{item}'], remove: { items: '{item}' }, add: { hp: 1 } } },
    { type: 'grid', cap: 'y', itemsFrom: 'seen', action: { who: 'actor', parts: ['LOOK'], body: ['{item}'] } },
    { type: 'grid', cap: 'z', items: ['Roll'], action: { who: 'actor', parts: ['ROLL'], body: ['{roll.text}', '{table}'], roll: { dice: '2d6+1', vs: 8 }, table: 'weather', push: { items: 'x' }, set: { money: 0 } } },
  ] }],
});
ok('full profile valid', P.validate(full).ok, P.explain(P.validate(full).errors, 'en'));

// Fehlerfälle
ok('bad dice', errs(withAction({ roll: { dice: 'banana' } })).includes('rollBad'));
ok('bad roll vs', errs(withAction({ roll: { dice: 'd20', vs: 'high' } })).includes('rollBad'));
ok('templated dice allowed', P.validate(withAction({ roll: { dice: '{item.dice|d20}', mod: '{item.mod|0}' } })).ok);
ok('unknown table', errs(withAction({ table: 'nope' })).includes('tableMissing'));
ok('empty table', errs(base({ tables: { t: [] } })).includes('tableBad'));
ok('table weight must be positive', errs(base({ tables: { t: [{ text: 'a', weight: 0 }] } })).includes('tableBad'));
ok('variable value outside min/max', errs(base({ variables: { hp: { value: 20, max: 10 } } })).includes('varBad'));
ok('variable bad key', errs(base({ variables: { 'Bad-Key': { value: 1 } } })).includes('varBad'));
ok('list needs strings', errs(base({ variables: { items: { type: 'list', value: [1] } } })).includes('varBad'));
ok('add needs number variable', errs(withAction({ add: { items: 1 } }, { variables: { items: { type: 'list', value: [] } } })).includes('varMissing'));
ok('push needs list variable', errs(withAction({ push: { hp: 'x' } }, { variables: { hp: { value: 1 } } })).includes('varMissing'));
ok('unknown variable in set', errs(withAction({ set: { ghost: 1 } })).includes('varMissing'));
ok('set must be object', errs(withAction({ set: 5 })).includes('fxBad'));
ok('event needs exactly one of at/in', errs(base({ events: [{ id: 'a', at: '10:00', in: 5, kind: 'SMS', text: 't' }] })).includes('eventBad') && errs(base({ events: [{ id: 'a', kind: 'SMS', text: 't' }] })).includes('eventBad'));
ok('event kind and text required', errs(base({ events: [{ id: 'a', at: '10:00', kind: 'bad kind', text: 't' }] })).includes('eventBad') && errs(base({ events: [{ id: 'a', at: '10:00', kind: 'SMS', text: '' }] })).includes('eventBad'));
ok('duplicate event id', errs(base({ events: [{ id: 'a', at: '10:00', kind: 'SMS', text: 't' }, { id: 'a', in: 5, kind: 'SMS', text: 't' }] })).includes('eventDup'));
ok('itemsFrom unknown', errs(base({ tabs: [{ id: 'a', label: 'A', blocks: [{ type: 'grid', cap: 'x', itemsFrom: 'ghost', action: { who: 'actor', parts: ['A'] } }] }] })).includes('itemsFromBad'));
ok('state list regex invalid', errs(base({ state: { lists: [{ key: 'k', regex: '(' }] } })).includes('listRegex'));
ok('errors have EN and DE text', P.explain(P.validate(withAction({ roll: { dice: 'x' } })).errors, 'de')[0].includes('roll.dice') && P.explain([{ k: 'eventBad', p: { i: 2 } }], 'de')[0].includes('events[2]'));

// has-Bedingung
ok('has: list includes', P.test({ key: 'items', has: 'Key' }, { items: ['key', 'map'] }) === true);
ok('has: list lacks', P.test({ key: 'items', has: 'sword' }, { items: ['key'] }) === false);
ok('has: string contains', P.test({ key: 'loc', has: 'bar' }, { loc: 'Red Bar' }) === true);
ok('has validates', P.validate(base({ tabs: [{ id: 'a', label: 'A', when: { key: 'items', has: 'key' }, blocks: [{ type: 'hint', text: 'x' }] }] })).ok);

// mindIds ist optional, wenn titleMatch gesetzt ist (und umgekehrt)
{
  const noIds = base({ titleMatch: 'Mel|Taminda' }); delete noIds.mindIds;
  ok('mindIds optional with titleMatch', P.validate(noIds).ok === true, P.validate(noIds).errors);
  const neither = base(); delete neither.mindIds;
  const r = P.validate(neither);
  ok('neither mindIds nor titleMatch is an error', r.ok === false && r.errors.some((e) => e.k === 'needIdOrTitle') && !r.errors.some((e) => e.k === 'mindIds'), r.errors);
  ok('mindIds must be a list when given', P.validate(base({ mindIds: 'ABCDE12' })).ok === false);
}
// Mind-IDs: lokale Minds, Katalog-Minds (Slug) und eingefügte URLs
ok('url: local mind', P.mindIdFromUrl('https://venice.ai/chat/minds/local/AbC12xY/9fk2lm') === 'AbC12xY');
ok('url: catalog mind slug', P.mindIdFromUrl('https://venice.ai/chat/minds/mel-taminda-an-interactive-story-3281/bnOmuOw') === 'mel-taminda-an-interactive-story-3281');
ok('mindIds: slug accepted', P.validate(base({ mindIds: ['mel-taminda-an-interactive-story-3281'] })).ok === true);
ok('mindIds: pasted URL accepted', P.validate(base({ mindIds: ['https://venice.ai/chat/minds/mel-taminda-an-interactive-story-3281/bnOmuOw'] })).ok === true);
ok('mindIds: junk rejected', P.validate(base({ mindIds: ['no'] })).ok === false && P.validate(base({ mindIds: ['a b c d e'] })).ok === false);
{
  P.setCustom({ cat: base({ id: 'cat', mindIds: ['https://venice.ai/chat/minds/mel-taminda-an-interactive-story-3281/x'] }) });
  const d = P.detect('https://venice.ai/chat/minds/mel-taminda-an-interactive-story-3281/bnOmuOw', 'x', {});
  ok('detect: pasted URL in mindIds matches the catalog mind', d.profile && d.profile.id === 'cat' && d.source === 'id', d);
}

console.log(res.join('\n'));
const failed = res.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `RESULT: ${failed} FAILED` : `RESULT: ALL ${res.length} PASSED`);
process.exit(failed ? 1 : 0);
