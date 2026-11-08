// Dynamische Buttons aus einer Liste der Statuszeile (state.lists) und Zustandszeile mit eigener Vorlage.
const { open, base, run } = require('./lib');

run(async () => {
  const profile = base({
    state: { lists: [{ key: 'seen', regex: 'Seen:\\s*([^·\\n]+)', sep: ',' }] },
    variables: { gold: { label: 'Gold', value: 7, min: 0 } },
    stateLine: '[STATE] gold={gold}',
    tabs: [{ id: 'a', label: 'A', blocks: [
      { type: 'grid', cap: 'SEEN', itemsFrom: 'seen', empty: '(none seen)', action: { who: 'actor', parts: ['LOOK'], body: ['{item}'] } },
      { type: 'grid', cap: 'COND', items: [{ label: 'Talk to Mara', when: { key: 'seen', has: 'Mara' } }], action: { who: 'actor', parts: ['TALK'] } },
    ] }],
  });
  const T = await open(profile);
  const { ev, ok, queue } = T;
  const gridBtns = (cap) => ev(`[...[...document.querySelectorAll('.panel:not([hidden]) .grid')].find(g=>g.previousElementSibling.textContent==='${cap}').querySelectorAll('button,.hint')].filter(b=>!b.hidden).map(b=>b.textContent)`);
  ok('empty text before any status', JSON.stringify(await gridBtns('SEEN')) === '["(none seen)"]', await gridBtns('SEEN'));
  await ev(`chrome.storage.local.set({'testprof:gameState':{time:'10:05',seen:['Mara','Karl']}});0`);
  await T.wait(400);
  ok('buttons from state list', JSON.stringify(await gridBtns('SEEN')) === '["Mara","Karl"]', await gridBtns('SEEN'));
  ok('has condition on state list', (await gridBtns('COND')).includes('Talk to Mara'), await gridBtns('COND'));
  await ev(`[...document.querySelectorAll('.panel:not([hidden]) .grid')][0].querySelector('button').click();0`);
  ok('item from state list in action', JSON.stringify(await queue()) === '["[PLAYER · 10:05 · LOOK] Mara"]', await queue());
  ok('custom state line template', (await T.text('#preview')).endsWith('[STATE] gold=7'), await T.text('#preview'));
  await ev(`chrome.storage.local.set({'testprof:gameState':{time:'10:06',seen:['Karl']}});0`);
  await T.wait(400);
  ok('list update removes button and condition', JSON.stringify(await gridBtns('SEEN')) === '["Karl"]' && !(await gridBtns('COND')).includes('Talk to Mara'), [await gridBtns('SEEN'), await gridBtns('COND')]);
  T.finish();
});
