// Würfel, Zufallstabellen, Ereignisse, Spielzustand und dynamische Buttons im Panel.
const { open, base, run } = require('./lib');

run(async () => {
  const profile = base({
    variables: {
      hp: { label: 'HP', value: 5, min: 0, max: 10, icon: '❤' },
      money: { label: 'Money', value: 100, min: 0 },
      items: { type: 'list', label: 'Items', value: ['key'] },
    },
    tables: { weather: ['Rain'] },
    events: [
      { id: 'sms', at: '10:30', kind: 'SMS', who: 'Mara', text: 'Hi' },
      { id: 'rain', in: 60, kind: 'WEATHER', text: 'Rain starts' },
    ],
    tabs: [
      { id: 'a', label: 'A', blocks: [
        { type: 'grid', cap: 'USE', itemsFrom: 'items', empty: '(nothing)', action: { who: 'actor', parts: ['USE'], body: ['{item}'], remove: { items: '{item}' } } },
        { type: 'grid', cap: 'BUY', items: [{ label: 'Buy map', price: 30, thing: 'map' }, { label: 'Buy yacht', price: 500, thing: 'yacht' }],
          action: { who: 'actor', parts: ['BUY', '{item.thing}'], add: { money: '-{item.price}' }, push: { items: '{item.thing}' } } },
        { type: 'grid', cap: 'HP', items: ['Hurt'], action: { who: 'actor', parts: ['HURT'], add: { hp: -3 } } },
        { type: 'grid', cap: 'HEAL', items: ['Heal'], action: { who: 'actor', parts: ['HEAL'], add: { hp: 9 } } },
        { type: 'grid', cap: 'ROLL', items: [{ label: 'Stealth', vs: 12 }, { label: 'Fire', dice: '2d6', mod: 1 }],
          action: { who: 'actor', parts: ['ROLL', '{roll.label}', '{roll.text}'], roll: { dice: '{item.dice|d20}', mod: '{item.mod|2}', vs: '{item.vs}', label: '{item.label}' } } },
        { type: 'grid', cap: 'TABLE', items: ['Weather'], action: { who: 'world', parts: ['WEATHER'], body: ['{table}'], table: 'weather' } },
        { type: 'grid', cap: 'COND', items: [{ label: 'Panic', when: { key: 'hp', lt: 3 } }], action: { who: 'actor', parts: ['PANIC'] } },
      ] },
      { id: 'b', label: 'B', when: { key: 'items', has: 'map' }, blocks: [{ type: 'hint', text: 'has map' }] },
    ],
  });
  const T = await open(profile);
  const { ev, ok, click, queue, status, buttons, wait } = T;
  const btn = (text) => ev(`[...document.querySelectorAll('.panel:not([hidden]) .grid button')].find(b=>b.textContent==='${text}').click();0`);
  const vars = () => ev(`JSON.stringify(vars)`).then(JSON.parse);
  const clear = () => ev(`document.getElementById('clearQueue').click();0`);
  const grid = (cap) => ev(`[...document.querySelectorAll('.panel:not([hidden]) .grid')].find(g=>g.previousElementSibling.textContent==='${cap}')`);
  const gridBtns = (cap) => ev(`[...[...document.querySelectorAll('.panel:not([hidden]) .grid')].find(g=>g.previousElementSibling.textContent==='${cap}').querySelectorAll('button,.hint')].filter(b=>!b.hidden).map(b=>b.textContent)`);

  // --- Spielzustand und HUD
  ok('state box visible', await ev(`!document.getElementById('varsBox').hidden`));
  ok('HUD shows variables', (await T.text('#hud')).includes('❤ HP 5/10') && (await T.text('#hud')).includes('Money 100') && (await T.text('#hud')).includes('Items key'), await T.text('#hud'));
  ok('HUD not hidden without status line', await ev(`!document.getElementById('hud').hidden`));
  ok('variable inputs rendered', await ev(`document.querySelectorAll('#varsList input').length`) === 3);

  // --- dynamische Buttons aus einer Liste
  ok('itemsFrom builds buttons', JSON.stringify(await gridBtns('USE')) === '["key"]', await gridBtns('USE'));
  await btn('key');
  ok('use removes item from list', JSON.stringify((await vars()).items) === '[]' && JSON.stringify(await queue()) === '["[PLAYER · 10:00 · USE] key"]', [await vars(), await queue()]);
  ok('empty text when no items', JSON.stringify(await gridBtns('USE')) === '["(nothing)"]', await gridBtns('USE'));
  await clear();
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][2];i.value='key, rope';i.dispatchEvent(new Event('change'))})();0`);
  ok('manual list edit rebuilds buttons', JSON.stringify(await gridBtns('USE')) === '["key","rope"]', await gridBtns('USE'));
  ok('manual edit persisted', JSON.stringify((await ev(`window.__store['testprof:data'].vars.items`))) === '["key","rope"]');

  // --- Effekte, Grenzen
  await btn('Buy map');
  ok('buy: money down, item pushed', (await vars()).money === 70 && (await vars()).items.includes('map'), await vars());
  ok('buy rebuilds dynamic grid', (await gridBtns('USE')).includes('map'), await gridBtns('USE'));
  ok('tab with has-condition appears', !(await ev(`document.querySelector('[data-tab=b]').hidden`)));
  const qBefore = (await queue()).length;
  await btn('Buy yacht');
  ok('too expensive is blocked', (await vars()).money === 70 && (await queue()).length === qBefore && (await status()).includes('cannot go below 0'), [await vars(), await status()]);
  ok('blocked action did not push item', !(await vars()).items.includes('yacht'));
  await btn('Hurt'); // 5 -> 2
  ok('hp 2', (await vars()).hp === 2);
  ok('when with variable shows Panic', (await gridBtns('COND')).includes('Panic'), await gridBtns('COND'));
  await btn('Heal'); // 2 + 9 = 11 > 10
  ok('above max blocked', (await vars()).hp === 2 && (await status()).includes('cannot go above 10'), [await vars(), await status()]);
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][0];i.value='20';i.dispatchEvent(new Event('change'))})();0`);
  ok('manual edit beyond max rejected', (await vars()).hp === 2 && (await status()).includes('not allowed'), await status());
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][0];i.value='9';i.dispatchEvent(new Event('change'))})();0`);
  ok('manual number edit', (await vars()).hp === 9 && !(await gridBtns('COND')).includes('Panic'), [await vars(), await gridBtns('COND')]);

  // --- Zustandszeile
  const prev = await T.text('#preview');
  ok('preview has state line', /\[WORLD · 10:00 · STATE\] HP 9\/10 · Money 70 · Items: key, rope, map/.test(prev), prev);
  await ev(`document.getElementById('sendState').click();document.getElementById('sendState').dispatchEvent(new Event('change'));0`);
  ok('state line can be switched off', !(await T.text('#preview')).includes('STATE'), await T.text('#preview'));
  await ev(`document.getElementById('sendState').click();document.getElementById('sendState').dispatchEvent(new Event('change'));0`);
  await clear();
  ok('empty message has no state line', (await T.text('#preview')) === '(nothing prepared)', await T.text('#preview'));

  // --- Würfel
  await ev(`(()=>{const s=document.getElementById('seed');s.value='abc';s.dispatchEvent(new Event('change'))})();0`);
  await btn('Stealth'); await btn('Stealth'); await btn('Fire');
  const q1 = await queue();
  ok('roll line format', /^\[PLAYER · 10:00 · ROLL · Stealth · \d+ vs 12 · (SUCCESS|FAILURE)\]$/.test(q1[0]), q1);
  ok('d20+2 within 3..22', q1.slice(0, 2).every((l) => { const n = +/· (\d+) vs/.exec(l)[1]; return n >= 3 && n <= 22; }), q1);
  ok('2d6+1 within 3..13, no vs', /ROLL · Fire · (\d+)\]$/.test(q1[2]) && +/· (\d+)\]$/.exec(q1[2])[1] >= 3 && +/· (\d+)\]$/.exec(q1[2])[1] <= 13, q1[2]);
  ok('outcome matches total', q1.slice(0, 2).every((l) => { const m = /· (\d+) vs 12 · (\w+)/.exec(l); return (+m[1] >= 12) === (m[2] === 'SUCCESS'); }), q1);
  await clear();
  await ev(`(()=>{const s=document.getElementById('seed');s.value='abc';s.dispatchEvent(new Event('change'))})();0`);
  await btn('Stealth'); await btn('Stealth'); await btn('Fire');
  ok('same seed gives same rolls', JSON.stringify(await queue()) === JSON.stringify(q1), [await queue(), q1]);
  ok('roll list shows entries', await ev(`document.querySelectorAll('#rollList li').length`) >= 3 && !(await ev(`document.getElementById('rollBox').hidden`)));
  ok('roll log persisted', (await ev(`window.__store['testprof:data'].rollLog.length`)) >= 3);
  ok('seed persisted', (await ev(`window.__store['testprof:data'].seed`)) === 'abc');
  await clear();
  await ev(`(()=>{const s=document.getElementById('seed');s.value='';s.dispatchEvent(new Event('change'))})();0`);
  await btn('Weather');
  ok('table pick', JSON.stringify(await queue()) === '["[WORLD · 10:00 · WEATHER] Rain"]', await queue());
  await clear();

  // --- Ereignisse
  ok('events box visible with 2 pending', !(await ev(`document.getElementById('eventsBox').hidden`)) && (await ev(`document.querySelectorAll('#eventsList li:not(.empty)').length`)) === 2);
  await click('[data-add="30"]');
  ok('event at 10:30 fires once', JSON.stringify(await queue()) === '["[WORLD · 10:30 · SMS · Mara] Hi"]', await queue());
  await click('[data-add="1"]');
  ok('does not fire again', (await queue()).length === 1, await queue());
  await ev(`document.querySelector('[data-add="30"]').click();0`); // 10:31 -> 11:01 passes 11:00
  ok('relative event (in 60) fires at 11:00', (await queue()).length === 2 && (await queue())[1] === '[WORLD · 11:00 · WEATHER] Rain starts', await queue());
  ok('no pending events left', (await T.text('#eventsList')).includes('no pending'), await T.text('#eventsList'));
  await clear();
  await ev(`(()=>{const t=document.getElementById('time');t.value='10:00';t.dispatchEvent(new Event('input'))})();0`);
  await click('[data-add="60"]');
  ok('already fired events do not fire again', (await queue()).length === 0, await queue());
  await click('#eventsRestart');
  ok('restart brings them back', (await ev(`document.querySelectorAll('#eventsList li:not(.empty)').length`)) === 2);
  await ev(`document.querySelector('#eventsList li button').click();0`);
  ok('fire now queues and removes', (await queue()).length === 1 && (await ev(`document.querySelectorAll('#eventsList li:not(.empty)').length`)) === 1, await queue());
  await ev(`document.querySelectorAll('#eventsList li button')[1].click();0`);
  ok('skip removes without queueing', (await queue()).length === 1 && (await ev(`document.querySelectorAll('#eventsList li:not(.empty)').length`)) === 0);
  ok('events state persisted', (await ev(`window.__store['testprof:data'].evDone.length`)) === 2);
  await clear();
  await ev(`(()=>{const t=document.getElementById('time');t.value='23:50';t.dispatchEvent(new Event('input'))})();0`);
  await click('#eventsRestart');
  await click('[data-add="30"]'); // 23:50 -> 00:20: nothing at 10:30/00:50? evStart=23:50 -> rain at 00:50
  ok('midnight rollover keeps order', (await queue()).length === 0, await queue());
  await click('[data-add="30"]'); // 00:20 -> 00:50 fires "rain" (in 60 from 23:50)
  ok('relative event after midnight', (await queue()).length === 1 && (await queue())[0].includes('00:50 · WEATHER'), await queue());
  await clear();

  // --- Spielstand enthält Zustand
  await ev(`(()=>{const i=document.getElementById('slotName');i.value='S1';document.getElementById('slotSave').click()})();0`);
  await ev(`(()=>{const i=[...document.querySelectorAll('#varsList input')][1];i.value='5';i.dispatchEvent(new Event('change'))})();0`);
  ok('money changed', (await vars()).money === 5);
  await ev(`[...document.querySelectorAll('#slotList li button')].find(b=>b.textContent==='LOAD').click();0`);
  ok('load slot restores variables', (await vars()).money === 70, await vars());
  const exp = await ev(`JSON.stringify(sessionData())`).then(JSON.parse);
  ok('export has variables and rolls', exp.variables && exp.variables.money === 70 && Array.isArray(exp.rolls) && exp.rolls.length >= 3, exp.variables);

  // --- Zurücksetzen
  await click('#varsReset');
  ok('reset to start values', JSON.stringify(await vars()) === '{"hp":5,"money":100,"items":["key"]}', await vars());

  // --- Sprache
  await ev(`(()=>{const s=document.getElementById('lang');s.value='de';s.dispatchEvent(new Event('change'))})();0`);
  await wait(3600);
  ok('German UI for new sections', (await T.text('#varsBox summary')) === 'SPIELZUSTAND' && (await T.text('#eventsBox summary')) === 'GEPLANTE EREIGNISSE', await T.text('#varsBox summary'));
  T.finish();
});
