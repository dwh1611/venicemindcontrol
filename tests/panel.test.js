// Regression für die Kernfunktionen des Panels: Tastenkürzel, Favoriten, Verlauf, Export, Spielstände,
// Relay, Auto-Forward und Profil-Editor.
const { open, base, run } = require('./lib');

run(async () => {
  const profile = base({
    tabs: [{ id: 'a', label: 'A', blocks: [
      { type: 'grid', cap: 'G', items: ['One', 'Two', 'Three'], action: { who: 'actor', parts: ['ACT'], body: ['{item}'] } },
    ] }],
  });
  const T = await open(profile);
  const { ev, ok, click, queue, status, wait } = T;
  await ev(`window.confirm=()=>true;window.__dl=[];HTMLAnchorElement.prototype.click=function(){window.__dl.push(this.download)};URL.createObjectURL=(b)=>{window.__blob=b;return 'blob:x'};0`);
  const key = (code) => ev(`document.dispatchEvent(new KeyboardEvent('keydown',{code:'${code}',altKey:true,bubbles:true}));0`);
  const clear = () => ev(`document.getElementById('clearQueue').click();0`);

  // Tastenkürzel
  ok('badges on buttons', JSON.stringify(await ev(`[...document.querySelectorAll('.panel:not([hidden]) .grid button')].map(b=>b.dataset.key)`)) === '["1","2","3"]');
  await key('Digit2');
  ok('Alt+2 queues second button', (await queue()).length === 1 && (await queue())[0].includes('Two'), await queue());
  await key('KeyZ');
  ok('Alt+Z removes last line', (await queue()).length === 0);
  await key('Digit1'); await key('Digit3'); await key('KeyX');
  ok('Alt+X clears the queue', (await queue()).length === 0);

  // Favoriten
  await key('Digit1'); await key('Digit3');
  await ev(`document.getElementById('macroName').value='Combo';document.getElementById('macroSave').click();0`);
  const fav = await ev(`window.__store['testprof:favs']`);
  ok('favorite stored with clock token', fav && fav[0].lines.length === 2 && fav[0].lines[0].includes('{t}'), fav);
  await clear();
  await ev(`(()=>{const t=document.getElementById('time');t.value='23:15';t.dispatchEvent(new Event('input'))})();0`);
  await click('#favs button');
  ok('favorite runs with the current clock', (await queue()).every((l) => l.includes('23:15')) && (await queue()).length === 2, await queue());

  // Verlauf
  await click('#send'); await wait(300);
  ok('send adds history entry and advances clock', (await ev(`history.length`)) === 1 && (await ev(`document.getElementById('time').value`)) === '23:16');
  await ev(`document.querySelector('#history li button').click();0`);
  ok('pin entry', await ev(`history[0].pin === true`));
  await ev(`for(let i=0;i<120;i++) history.push({text:'filler '+i,at:Date.now()}); trimHistory(); renderHistory();0`);
  ok('trim keeps pin plus 100', await ev(`history.length === 101 && history[0].pin`));
  await ev(`(()=>{const s=document.getElementById('hsearch');s.value='filler 7';s.dispatchEvent(new Event('input'))})();0`);
  ok('search filters', (await ev(`document.querySelectorAll('#history li .htext').length`)) === 11);
  await ev(`(()=>{const s=document.getElementById('hsearch');s.value='';s.dispatchEvent(new Event('input'))})();document.getElementById('hClear').click();0`);
  ok('clear unpinned keeps pinned', (await ev(`history.length`)) === 1);

  // Export und Spielstände
  await click('#hExportMd');
  ok('markdown export', (await ev(`window.__dl.pop()`)).endsWith('.md') && (await ev(`window.__blob.text()`)).includes('# Test'));
  await click('#hExportJson');
  const exp = JSON.parse(await ev(`window.__blob.text()`));
  ok('json export', exp.format === 'mind-console-session' && exp.favorites.length === 1 && exp.profile.id === 'testprof');
  const savedTime = await ev(`document.getElementById('time').value`);
  await ev(`document.getElementById('slotName').value='A';document.getElementById('slotSave').click();0`);
  await ev(`history=[];document.getElementById('time').value='01:00';0`);
  await ev(`document.querySelector('#slotList li button').click();0`);
  ok('slot restores clock and history, backs up the old state', (await ev(`document.getElementById('time').value`)) === savedTime && (await ev(`history.length`)) === 1 && (await ev(`slots.length`)) === 2);

  // Profil-Editor
  await click('#pnew');
  ok('editor opens with a valid template', (await ev(`!document.getElementById('editor').hidden && document.getElementById('app').hidden`)) && (await ev(`document.getElementById('edStatus').className`)).includes('ok'));
  await ev(`(()=>{const ta=document.getElementById('edText');ta.value=ta.value.replace('"id": "mymind",','"id": "mymind"');ta.dispatchEvent(new Event('input'))})();0`);
  await wait(500);
  ok('syntax error with jump target', (await ev(`document.querySelector('#edErrors li.jump')!==null`)));
  const tpl = await ev(`JSON.stringify(TEMPLATE)`); const t2 = JSON.parse(tpl); t2.id = 'previewonly';
  await ev(`(()=>{const ta=document.getElementById('edText');ta.value=${JSON.stringify(JSON.stringify(t2))};ta.dispatchEvent(new Event('input'))})();0`);
  await wait(500);
  const before = JSON.stringify(await ev(`Object.keys(window.__store).sort()`));
  await click('#edPreview'); await wait(600);
  ok('preview shows the draft and writes nothing', (await ev(`document.getElementById('logo').textContent`)) === 'MY MIND' && JSON.stringify(await ev(`Object.keys(window.__store).sort()`)) === before);
  await click('#edSave'); await wait(800);
  ok('save stores a custom profile and closes', (await ev(`!!window.__store.customProfiles.previewonly && document.getElementById('editor').hidden`)));
  await wait(3600);
  ok('real profile is back', (await T.text('#mindbar')).includes('Test'), await T.text('#mindbar'));

  // Relay und Auto-Forward mit zwei Tabs
  await ev(`window.__tabs.push({id:2,url:'https://venice.ai/chat/minds/local/TESTMIND2/y',title:'Other'});window.__active=1;0`);
  await click('#relaySetA'); await wait(300);
  await ev(`window.__active=2;0`); await click('#relaySetB'); await wait(300);
  ok('tabs assigned', (await T.text('#relayA')).includes('Test') && !(await ev(`document.getElementById('relayAB').disabled`)), [await T.text('#relayA'), await T.text('#relayB')]);
  await ev(`window.__replies[1]='Reply A\\n⏱ 10:00 · x';window.__injected=[];0`);
  await click('#relayAB'); await wait(400);
  let inj = await ev(`JSON.stringify(window.__injected)`).then(JSON.parse);
  ok('manual relay inserts once, not sent, without status line', inj.length === 1 && inj[0].id === 2 && inj[0].send === false && inj[0].text.includes('Reply A') && !inj[0].text.includes('⏱'), inj);
  await click('#relayAB'); await wait(300);
  ok('same reply needs a second click', (await ev(`window.__injected.length`)) === 1 && (await status()).includes('already'));
  await ev(`window.__replies[1]='Loading...\\nThinking...';0`);
  await click('#relayBA'); await ev(`window.__replies[2]='Loading...';0`); await click('#relayBA'); await wait(300);
  ok('placeholder replies are not relayed', (await status()).includes('still being written') && (await ev(`window.__injected.length`)) === 1, await status());
  // auto-forward
  await ev(`window.__replies[1]='Old A';window.__replies[2]='Old B';document.getElementById('autoMode').value='both';document.getElementById('autoMax').value='2';document.getElementById('autoWait').value='1';0`);
  await click('#autoStart'); await wait(500);
  ok('auto bar visible', await ev(`!document.getElementById('autoBar').hidden`));
  await wait(2500);
  ok('baseline replies not forwarded', (await ev(`window.__injected.length`)) === 1);
  await ev(`window.__replies[1]='New A';0`); await wait(3500);
  inj = await ev(`JSON.stringify(window.__injected)`).then(JSON.parse);
  ok('auto-forward sends in replace mode', inj.length === 2 && inj[1].send === true && inj[1].mode === 'replace' && inj[1].text.includes('New A'), inj[1]);
  await ev(`window.__replies[2]='Streaming';0`); await wait(500); await ev(`window.__replies[2]='Streaming done';0`); await wait(3500);
  ok('stops at the maximum', !(await ev(`!document.getElementById('autoBar').hidden`)) && (await status()).includes('2 forwards'), await status());
  ok('forwarded the final streamed text once', (await ev(`window.__injected.length`)) === 3 && (await ev(`window.__injected[2].text`)).includes('Streaming done'));
  await click('#autoStart'); await wait(300);
  await ev(`window.__tabs=window.__tabs.filter(t=>t.id!==2);0`); await wait(2500);
  ok('stops when a tab closes', !(await ev(`!document.getElementById('autoBar').hidden`)) && (await status()).includes('tab was closed'), await status());
  T.finish();
});
