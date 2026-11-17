// v1.3 im Panel: Orte, Theme, Ambiente, Änderungslog, Neu würfeln, Senden zurück, Zweig, Auswahl, Vorschläge, Guard, Quests.
// Aufruf: electron tests/worldpanel.test.js (nachgebautes chrome aus tests/preload.js)
const { open, base, run, wait } = require('./lib');

run(async () => {
  const profile = base({
    id: 'worldtest',
    variables: { hp: { label: 'HP', value: 5, min: 0, max: 10 }, gold: { label: 'Gold', value: 10, min: 0 }, items: { type: 'list', label: 'Items', value: ['key'] } },
    locations: { key: 'loc', start: 'hall', minutes: 2, items: [
      { id: 'hall', label: 'Hall', hint: 'Cold and big', neighbours: ['kitchen', { id: 'garden', minutes: 10 }] },
      { id: 'kitchen', label: 'Kitchen', neighbours: ['hall'], theme: { fg: '#ff0000', glow: '255,0,0' } },
      { id: 'garden', label: 'Garden', neighbours: ['hall'], audio: 'https://example.invalid/rain.mp3', image: 'https://example.invalid/g.jpg' }] },
    quests: [{ id: 'q1', label: 'Find the key' }, { id: 'q2', label: 'Open the door', text: 'needs the key' }],
    events: [{ id: 'e2', at: '11:00', kind: 'SMS', text: 'Hi', when: { key: 'quest.q1', eq: 'done' } }],
    choices: { cap: 'WHAT NOW', action: { who: 'actor', parts: ['CHOICE', '{item}'] } },
    suggest: [{ pattern: 'you lose (\\d+) HP', add: { hp: '-{g1}' } }, { pattern: 'you find (?:a |an )?([a-z ]+)', push: { items: '{g1}' } }],
    guard: { items: [{ key: 'hp', var: 'hp', label: 'HP' }, { key: 'items', var: 'items', label: 'Items' }, { key: 'loc', location: true, label: 'Place' }] },
    tabs: [{ id: 'a', label: 'A', blocks: [
      { type: 'travel', cap: 'GO', action: { who: 'actor', parts: ['GO', '{item}'], shift: true } },
      { type: 'grid', cap: 'ACT', items: ['Buy', 'Hurt', 'Roll', 'Finish'], action: { who: 'actor', parts: ['DO', '{item}'] } },
      { type: 'grid', cap: 'BUY', items: ['Buy'], action: { who: 'actor', parts: ['BUY'], add: { gold: -3 }, push: { items: 'map' } } },
      { type: 'grid', cap: 'HURT', items: ['Hurt'], action: { who: 'actor', parts: ['HURT'], add: { hp: -2 } } },
      { type: 'grid', cap: 'ROLL', items: ['Roll'], action: { who: 'actor', parts: ['ROLL', '{roll.total}'], roll: { dice: 'd20' }, add: { gold: -1 } } },
      { type: 'grid', cap: 'WAIT', items: [{ label: 'Wait', m: 10 }], action: { who: 'actor', parts: ['WAIT'], shift: true } },
      { type: 'grid', cap: 'QUEST', items: ['Finish'], action: { who: 'actor', parts: ['FINISH'], quest: { q1: 'done' } } },
      { type: 'hint', text: 'q2 is done', when: { key: 'quest.q2', eq: 'done' } },
      { type: 'hint', text: 'in kitchen', when: { key: 'location', eq: 'kitchen' } },
    ] }],
  });
  const T = await open(profile);
  const { ev, ok, click, queue, status } = T;
  const $ = (id) => `document.getElementById('${id}')`;
  const vars = () => ev(`JSON.stringify(vars)`).then(JSON.parse);
  const btn = (cap, text) => ev(`[...document.querySelectorAll('.panel:not([hidden]) .grid')].find(g=>g.previousElementSibling&&g.previousElementSibling.textContent==='${cap}').querySelectorAll('button').forEach(b=>{if(b.textContent.startsWith('${text}'))b.click()});0`);
  const btns = (cap) => ev(`[...[...document.querySelectorAll('.panel:not([hidden]) .grid')].find(g=>g.previousElementSibling&&g.previousElementSibling.textContent==='${cap}').querySelectorAll('button')].map(b=>b.textContent)`);
  const vis = (id) => ev(`!${$(id)}.hidden`);
  const txt = (id) => ev(`${$(id)}.textContent`);
  const clock = () => ev(`${$('time')}.value`);
  const clear = () => ev(`${$('clearQueue')}.click();0`);
  const state = (o) => ev(`chrome.storage.local.set({'worldtest:gameState':${JSON.stringify({ time: '10:00', ...o })}});0`);
  const reply = (t) => ev(`window.__replies[1]=${JSON.stringify(t)};0`);
  const logs = () => ev(`[...document.querySelectorAll('#logList li')].map(l=>l.textContent+(l.classList.contains('undone')?' [undone]':''))`);
  const store = (k) => ev(`JSON.stringify(window.__store['worldtest:${k}'])`).then((s) => (s ? JSON.parse(s) : s));

  /* ---------- Orte (#14) ---------- */
  ok('world box shows the start place and its hint', (await vis('worldBox')) && (await txt('locName')).includes('Hall') && (await txt('locHint')) === 'Cold and big', await txt('locName'));
  ok('travel offers the neighbours with travel time', JSON.stringify(await btns('GO')) === '["Kitchen · 2′","Garden · 10′"]', await btns('GO'));
  await btn('GO', 'Kitchen');
  ok('travel queues the line and moves the clock', JSON.stringify(await queue()) === '["[PLAYER · 10:00 · GO · Kitchen]"]' && (await clock()) === '10:02', [await queue(), await clock()]);
  ok('current place and exits follow', (await txt('locName')).includes('Kitchen') && JSON.stringify(await btns('GO')) === '["Hall · 2′"]', await btns('GO'));
  ok('location is a condition for when', await ev(`[...document.querySelectorAll('.panel .hint')].some(h=>h.textContent==='in kitchen'&&!h.hidden)`));
  ok('place persisted', (await store('data')).curLoc === 'kitchen');

  /* ---------- Theme je Ort (#16) ---------- */
  ok('place theme overrides the panel colour', (await ev(`document.documentElement.style.getPropertyValue('--fg')`)) === '#ff0000');
  ok('place theme is handed to the chat page via storage', (await store('locTheme')).fg === '#ff0000', await store('locTheme'));
  await btn('GO', 'Hall');
  ok('leaving the place restores the theme', (await ev(`document.documentElement.style.getPropertyValue('--fg')`)) === '#7fb4ff' && (await store('locTheme')) === null, await store('locTheme'));
  await clear();

  // Der Ort aus der Statuszeile gilt, sobald sie sich ändert
  await state({ loc: 'Garden', hp: 5, items: ['key'] });
  await wait(300);
  ok('a new place in the status line moves the panel', (await txt('locName')).includes('Garden'), await txt('locName'));
  await state({ loc: 'Garden', hp: 5, items: ['key'], note: 'x' });
  await btn('GO', 'Hall');
  await wait(300);
  ok('an unchanged status place does not undo a panel move', (await txt('locName')).includes('Hall'), await txt('locName'));
  await clear();

  /* ---------- Ambiente (#16) ---------- */
  ok('ambience row visible, off by default', (await vis('ambRow')) && (await ev(`${$('ambOn')}.checked`)) === false && (await ev(`ambAudio === null`)) === true);
  ok('ambience image hidden while off', (await ev(`${$('ambImg')}.hidden`)) === true);
  await btn('GO', 'Garden');
  await ev(`(()=>{const c=${$('ambOn')};c.checked=true;c.dispatchEvent(new Event('change'))})();0`);
  ok('switching on loads the place audio (looping) and image', (await ev(`ambAudio && ambAudio.src`)) === 'https://example.invalid/rain.mp3' && (await ev(`ambAudio.loop`)) === true && (await ev(`${$('ambImg')}.hidden`)) === false);
  await click('#ambMute');
  ok('mute control mutes and shows it', (await ev(`ambAudio.muted`)) === true && (await txt('ambMute')) === '🔇');
  ok('mute and volume are remembered, "on" is not', JSON.stringify(await ev(`JSON.stringify(window.__store.ambience)`).then(JSON.parse)) === '{"mute":true,"vol":50}');
  await btn('GO', 'Hall');
  ok('a place without audio silences it', (await ev(`ambAudio.paused`)) === true && (await ev(`${$('ambImg')}.hidden`)) === true);
  await clear();
  await ev(`(()=>{const c=${$('ambOn')};c.checked=false;c.dispatchEvent(new Event('change'))})();0`);

  /* ---------- Änderungslog (#29) ---------- */
  await btn('BUY', 'Buy');
  ok('effects are logged with readable changes', (await vars()).gold === 7 && (await logs())[0].includes('Gold −3') && (await logs())[0].includes('Items +map'), await logs());
  await ev(`document.querySelector('#logList li button').click();0`);
  ok('undo of one entry restores the state and strikes it through', (await vars()).gold === 10 && JSON.stringify((await vars()).items) === '["key"]' && (await logs())[0].includes('[undone]'), [await vars(), await logs()]);
  ok('undo also removes the queued line', (await queue()).length === 0, await queue());
  await btn('BUY', 'Buy');
  await ev(`document.querySelector('#queue li button').click();0`);
  ok('removing a queued line reverts its changes automatically', (await vars()).gold === 10 && (await queue()).length === 0 && (await status()).includes('reverted'), [await vars(), await status()]);
  await btn('BUY', 'Buy');
  await ev(`${$('autosend')}.checked=false;0`);
  await click('#send');
  await wait(300);
  ok('after sending the entry can still be undone from the log', (await vars()).gold === 7, await vars());
  await ev(`document.querySelector('#logList li button').click();0`);
  ok('undo after send works (panel state only)', (await vars()).gold === 10 && JSON.stringify((await vars()).items) === '["key"]', await vars());
  await btn('HURT', 'Hurt');                                  // hp 5 -> 3
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][0];i.value='10';i.dispatchEvent(new Event('change'))})();0`);
  await ev(`document.querySelector('#logList li button').click();0`); // hp would become 12
  ok('undo that would break a limit is refused', (await vars()).hp === 10 && (await status()).includes('limits') && !(await logs())[0].includes('[undone]'), [await vars(), await status(), await logs()]);
  await clear();
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][0];i.value='5';i.dispatchEvent(new Event('change'))})();0`);

  /* ---------- Neu würfeln (#32) ---------- */
  await ev(`rng = () => 0;0`);
  await btn('ROLL', 'Roll');
  ok('roll queued, gold spent', (await queue()).length === 1 && (await queue())[0].includes('ROLL · 1]') && (await vars()).gold === 9, [await queue(), await vars()]);
  ok('reroll enabled', (await ev(`${$('reroll')}.disabled`)) === false);
  await ev(`rng = () => 0.99;0`);
  await click('#reroll');
  ok('reroll replaces the queued line with a new roll', (await queue()).length === 1 && (await queue())[0].includes('ROLL · 20]'), await queue());
  ok('reroll replaces the effects instead of stacking them', (await vars()).gold === 9, await vars());
  ok('log shows the old entry undone and a new one', (await logs()).length >= 2 && (await logs()).filter((l) => l.includes('[undone]')).length >= 1 && (await logs()).filter((l) => l.includes('Gold −1') && !l.includes('[undone]')).length === 1, await logs());
  await clear();
  await ev(`rng = Math.random;0`);
  const t0 = await clock();
  await btn('WAIT', 'Wait');
  const t1 = await clock();
  await click('#reroll');
  ok('reroll does not shift the clock twice', t1 !== t0 && (await clock()) === t1 && (await queue()).length === 1, [t0, t1, await clock(), await queue()]);
  await clear();
  ok('reroll with nothing to repeat says so', await ev(`(()=>{lastAct=null;document.getElementById('reroll').disabled=false;document.getElementById('reroll').click();return document.getElementById('status').textContent})()`).then((s) => s.includes('no action')), 0);

  /* ---------- Senden zurück (#17) ---------- */
  await clear();
  await ev(`${$('time')}.value='12:00';0`);
  await btn('BUY', 'Buy');
  await ev(`${$('userText')}.value='hello';0`);
  const hBefore = await ev(`history.length`);
  await click('#send');
  await wait(300);
  ok('send clears the queue and advances the clock', (await queue()).length === 0 && (await clock()) === '12:01' && (await ev(`history.length`)) === hBefore + 1, [await queue(), await clock()]);
  ok('undo-send is available', (await ev(`${$('undoTurn')}.disabled`)) === false);
  await click('#undoTurn');
  ok('undo-send restores queue, text, clock, history and state', (await queue()).length === 1 && (await ev(`${$('userText')}.value`)) === 'hello' && (await clock()) === '12:00' && (await ev(`history.length`)) === hBefore && (await vars()).gold === 7, [await queue(), await clock(), await vars()]);
  ok('limitation is shown in the UI', (await vis('turnNote')) && (await txt('turnNote')).includes('already sent'), await txt('turnNote'));
  ok('restored entry is queued again (× reverts it)', (await ev(`varLog[0].state`)) === 'queued');
  await click('#turnFix');
  ok('correction line is queued, note closes', (await queue()).some((l) => l.includes('· CORRECTION] The previous message is withdrawn')) && !(await vis('turnNote')), await queue());
  await clear();
  ok('turns are persisted', Array.isArray((await store('data')).turns));

  /* ---------- Zweig (#17) ---------- */
  await ev(`(()=>{${$('slotName')}.value='S1';document.getElementById('slotSave').click()})();0`);
  const s1 = await ev(`JSON.stringify(slots.find(s=>s.name==='S1'))`);
  await btn('BUY', 'Buy');
  await ev(`[...document.querySelectorAll('#slotList li')].find(l=>l.textContent.startsWith('S1 ·')).querySelectorAll('button')[1].click();0`);
  const names = await ev(`slots.map(s=>s.name)`);
  ok('branch creates a new save and leaves the source untouched', names.includes('S1 ↳') && (await ev(`JSON.stringify(slots.find(s=>s.name==='S1'))`)) === s1, names);
  ok('branch continues from the loaded state and prefills the name', (await vars()).gold === 10 && (await ev(`${$('slotName')}.value`)) === 'S1 ↳', await vars());
  await ev(`[...document.querySelectorAll('#slotList li')].find(l=>l.textContent.startsWith('S1 ·')).querySelectorAll('button')[1].click();0`);
  ok('second branch gets the next free name', (await ev(`slots.map(s=>s.name)`)).includes('S1 ↳2'), await ev(`slots.map(s=>s.name)`));

  /* ---------- Auswahl aus der Antwort (#15) ---------- */
  await clear();
  await reply('Ahead is a door.\n\n1. Open it\n2. Knock politely');
  await wait(7500);
  ok('options appear as buttons under the configured title', (await vis('choicesBox')) && (await txt('choicesCap')) === 'WHAT NOW' && JSON.stringify(await ev(`[...document.querySelectorAll('#choicesList button')].map(b=>b.textContent)`)) === '["Open it","Knock politely"]', await ev(`[...document.querySelectorAll('#choicesList button')].map(b=>b.textContent)`));
  await ev(`document.querySelector('#choicesList button').click();0`);
  ok('a click queues the choice with the profile template and closes the bar', (await queue())[0].endsWith('· CHOICE · Open it]') && !(await vis('choicesBox')), await queue());
  await clear();
  await reply('The room is empty and silent.');
  await wait(7500);
  ok('no options, nothing shown', !(await vis('choicesBox')));

  /* ---------- Vorschläge (#31) ---------- */
  await reply('Ouch, you lose 2 HP. Then you find a lamp.');
  await wait(7500);
  ok('suggestions listed, nothing applied silently', (await vis('suggestBox')) && (await ev(`document.querySelectorAll('#suggestList li').length`)) === 2 && (await vars()).hp === 5, await vars());
  ok('suggestion shows the change', (await txt('suggestList')).includes('HP -2') && (await txt('suggestList')).includes('Items +lamp'), await txt('suggestList'));
  await ev(`document.querySelector('#suggestList li button').click();0`);
  ok('apply changes the state and writes the log', (await vars()).hp === 3 && (await logs())[0].includes('suggested') && (await logs())[0].includes('HP −2'), [await vars(), await logs()]);
  ok('applied suggestion disappears, the other stays', (await ev(`document.querySelectorAll('#suggestList li').length`)) === 1);
  ok('suggested change is not tied to the queue (CLEAR keeps it)', await (async () => { await clear(); return (await vars()).hp === 3; })());
  await ev(`document.querySelectorAll('#suggestList li button')[1].click();0`);
  ok('dismiss removes it without a change', !(await vis('suggestBox')) && (await vars()).items.length === 1);
  await reply('You lose 9 HP.');
  await wait(7500);
  await ev(`document.querySelector('#suggestList li button').click();0`);
  ok('an impossible suggestion is refused and stays', (await vars()).hp === 3 && (await status()).includes('below 0') && (await vis('suggestBox')), [await vars(), await status()]);

  /* ---------- State-Guard (#30) ---------- */
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][0];i.value='5';i.dispatchEvent(new Event('change'))})();0`);
  await state({ loc: 'Hall', hp: 5, items: ['key'], n: 1 });
  await wait(300);
  ok('matching status line: no warning', !(await vis('guardBox')));
  await state({ loc: 'Hall', hp: 3, items: ['key', 'rope'], n: 2 });
  await wait(300);
  ok('drift is shown with both values', (await vis('guardBox')) && (await txt('guardList')).includes('HP: the Mind says 3, the panel has 5') && (await txt('guardList')).includes('Items'), await txt('guardList'));
  await click('#guardFix');
  ok('correction line is queued, never sent', (await queue()).length === 1 && (await queue())[0].includes('· CORRECTION]') && (await queue())[0].includes('HP: 5') && (await ev(`window.__injected.length`)) >= 1 && !(await vis('guardBox')), await queue());
  ok('a repeated identical drift stays hidden (ignored)', await (async () => { await state({ loc: 'Hall', hp: 3, items: ['key', 'rope'], n: 3 }); await wait(300); return !(await vis('guardBox')); })());
  await state({ loc: 'Hall', hp: 2, items: ['key', 'rope'], n: 4 });
  await wait(300);
  ok('a different drift is shown again', await vis('guardBox'));
  await click('#guardHide');
  ok('IGNORE hides it', !(await vis('guardBox')));
  await clear();
  await btn('GO', 'Kitchen');
  await state({ loc: 'Hall', hp: 5, items: ['key'], n: 5 });
  await wait(300);
  ok('location drift: the Mind ignored the move', (await txt('guardList')).includes('Place: the Mind says Hall, the panel has Kitchen'), await txt('guardList'));
  await clear();
  await btn('GO', 'Hall');

  /* ---------- Quests (#33) ---------- */
  ok('quest list shows both quests', (await vis('questBox')) && (await ev(`document.querySelectorAll('#questList li').length`)) === 2 && (await txt('questList')).includes('needs the key'));
  ok('event with a quest condition is not offered yet', (await txt('eventsList')).includes('No scheduled') || !(await txt('eventsList')).includes('Hi'), await txt('eventsList'));
  await btn('QUEST', 'Finish');
  ok('action effect sets the quest, log shows it', (await ev(`quests.q1`)) === 'done' && (await logs())[0].includes('open → done'), [await ev(`quests.q1`), await logs()]);
  ok('quest state is persisted', (await store('data')).quests.q1 === 'done');
  ok('quest drives scheduled events', (await txt('eventsList')).includes('Hi'), await txt('eventsList'));
  await ev(`document.querySelector('#logList li button').click();0`);
  ok('undo returns the quest to open', (await ev(`quests.q1`)) === 'open' && !(await txt('eventsList')).includes('Hi'));
  await ev(`(()=>{const s=document.querySelectorAll('#questList select')[1];s.value='done';s.dispatchEvent(new Event('change'))})();0`);
  ok('manual quest change works and drives when', (await ev(`quests.q2`)) === 'done' && (await ev(`[...document.querySelectorAll('.panel .hint')].some(h=>h.textContent==='q2 is done'&&!h.hidden)`)), await ev(`quests.q2`));
  ok('manual quest change is logged', (await logs())[0].includes('Open the door') && (await logs())[0].includes('open → done'), await logs());
  await clear();

  T.finish();
});
