// Vollbild-Modus (?mode=tab): Tab-Auswahl, feste Zielzuordnung, Öffnen-Button im Panel.
const { open, base, run, wait } = require('./lib');

run(async () => {
  // 1) Im Seitenpanel: Button vorhanden, Auswahl versteckt, Klick öffnet den Tab mit dem aktuellen Venice-Tab.
  const P = await open(base());
  const { ev, ok } = P;
  ok('panel: no fullpage class', (await ev(`document.body.classList.contains('fullpage')`)) === false);
  ok('panel: target bar hidden', (await ev(`document.getElementById('targetBar').hidden`)) === true);
  await ev(`document.getElementById('openTab').click();0`);
  await wait(200);
  const created = await ev(`window.__created`);
  ok('panel: opens page in tab mode with current tab', created && created[0] === 'chrome-extension://test/sidepanel.html?mode=tab&tab=1', created);
  P.win.hide();

  // 2) Im Vollbild: Auswahl sichtbar, zweiter Venice-Tab wählbar, Senden geht an den gewählten Tab.
  const T = await open(base(), { query: 'mode=tab' });
  await T.ev(`localStorage.clear();0`);
  await T.ev(`if(!document.body.classList.contains('lay-right'))document.getElementById('layBtn').click();0`); // Zustand vorheriger Läufe zurücksetzen
  const t = T.ev;
  await t(`window.__tabs.push({id:2,url:'https://venice.ai/chat/minds/local/TESTMIND1/y',title:'Second'});window.__active=1;0`);
  await wait(3800);
  ok('full: fullpage class', (await t(`document.body.classList.contains('fullpage')`)) === true);
  ok('full: open button hidden', (await t(`getComputedStyle(document.getElementById('openTab')).display`)) === 'none');
  const opts = await t(`[...document.querySelectorAll('#target option')].map(o=>o.value)`);
  ok('full: picker lists auto and both tabs', JSON.stringify(opts) === '["","1","2"]', opts);
  await t(`const s=document.getElementById('target');s.value='2';s.dispatchEvent(new Event('change'));0`);
  await wait(500);
  await t(`document.querySelector('.grid button').click();0`);
  await t(`document.getElementById('send').click();0`);
  await wait(300);
  const inj = await t(`window.__injected.map(i=>i.id)`);
  ok('full: send goes to the picked tab', inj.length === 1 && inj[0] === 2, inj);
  // Gewählter Tab schließt: zurück auf automatisch
  await t(`window.__tabs=window.__tabs.filter(x=>x.id!==2);0`);
  await wait(3800);
  ok('full: closed tab falls back to auto', (await t(`document.getElementById('target').value`)) === '');
  // Chat-Ansicht: zeigt den Verlauf des gewählten Tabs, aktualisiert sich bei neuen Nachrichten
  await t(`window.__transcript={1:[{role:'user',text:'[WORLD · 10:00 · ACTION · x] hello'},{role:'mind',text:'Reply one',html:'<p>Reply <strong>one</strong></p><ul><li>a</li></ul><p>⏱ 10:00 · hp 5</p><script>window.__xss=1<\\/script><p onclick=\\"window.__xss=2\\">x</p>'}]};0`);
  await wait(2200);
  ok('chat: pane visible', (await t(`document.getElementById('chatPane').hidden`)) === false);
  const msgs = await t(`[...document.querySelectorAll('#chatList .msg')].map(m=>m.className+'|'+m.querySelector('.body').textContent)`);
  ok('chat: shows both messages with roles', msgs.length === 2 && msgs[0].startsWith('msg user|') && msgs[1].startsWith('msg mind|Reply one'), msgs);
  ok('chat: event line becomes a chip row', (await t(`document.querySelector('#chatList .ev .chip').textContent`)) === 'ACTION' && (await t(`document.querySelector('#chatList .ev .txt').textContent`)) === 'hello');
  ok('chat: markdown formatting kept', (await t(`document.querySelectorAll('#chatList .msg.mind strong, #chatList .msg.mind li').length`)) === 2);
  ok('chat: scripts and attributes are dropped', (await t(`!window.__xss && !document.querySelector('#chatList [onclick], #chatList script')`)) === true);
  ok('chat: status line is set apart', (await t(`document.querySelectorAll('#chatList .hud').length`)) === 1);
  await t(`window.__transcript[1].push({role:'user',text:'next'});0`);
  await wait(2200);
  ok('chat: picks up new message', (await t(`document.querySelectorAll('#chatList .msg').length`)) === 3);
  ok('chat: pane hidden in side panel', (await ev(`document.getElementById('chatPane').hidden`)) === true);
  ok('layout: default is chat right', (await t(`document.body.classList.contains('lay-right')`)) === true);
  await t(`document.getElementById('layBtn').click();0`);
  ok('layout: toggles to chat bottom', (await t(`document.body.classList.contains('lay-bottom') && !document.body.classList.contains('lay-right')`)) === true);
  const cf0 = parseInt(await t(`document.body.style.getPropertyValue('--cf')`), 10);
  await t(`document.getElementById('cfPlus').click();0`);
  ok('layout: chat size changes', (await t(`document.body.style.getPropertyValue('--cf')`)) === (cf0 + 1) + 'px');
  // Chatbox: schreibt direkt in den gewählten Tab
  const before = (await t(`window.__injected.length`));
  await t(`(()=>{const i=document.getElementById('chatInput');i.value='Hello Mind';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})();0`);
  await wait(600);
  const last = await t(`window.__injected[window.__injected.length-1]`);
  ok('composer: Enter sends the text as typed', (await t(`window.__injected.length`)) === before + 1 && last.text === 'Hello Mind' && last.send === true && last.mode === 'replace', last);
  ok('composer: box is cleared after sending', (await t(`document.getElementById('chatInput').value`)) === '');
  await t(`(()=>{const i=document.getElementById('chatInput');i.value='line1';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));})();0`);
  await wait(300);
  ok('composer: Shift+Enter does not send', (await t(`window.__injected.length`)) === before + 1);
  await t(`document.getElementById('chatInput').value='';0`);
  await t(`localStorage.clear();0`); // Layout-Einstellungen nicht in den nächsten Lauf mitnehmen
  ok('full: no page errors', T.errs.length === 0, T.errs);
  P.finish();
});
