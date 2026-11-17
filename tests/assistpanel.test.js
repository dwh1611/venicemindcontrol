// Profil-Assistent im Panel: Auftrag senden, auf die Antwort warten, Editor öffnen, Mind-ID ergänzen.
// Aufruf: npx electron tests/assistpanel.test.js (nachgebautes chrome aus tests/preload.js)
const { open, base, run, wait, ROOT } = require('./lib');
const fs = require('fs');

run(async () => {
  const T = await open(base());
  const { ev, ok, click } = T;
  const tpl = fs.readFileSync(ROOT + '/PROMPT-Profile-Generator.md', 'utf8');
  await ev(`window.fetch = async () => ({ text: async () => ${JSON.stringify(tpl)} });0`);
  const $ = (id) => `document.getElementById('${id}')`;
  const set = (id, v) => ev(`${$(id)}.value=${JSON.stringify(v)};0`);
  const visible = (id) => ev(`!${$(id)}.hidden`);
  const reply = (txt) => ev(`window.__replies[1]=${JSON.stringify(txt)};0`);
  const injected = () => ev(`window.__injected`);

  const profile = { id: 'noir', name: 'Noir', mindIds: ['HIER-DIE-MIND-ID'], defaultTime: '23:10', prefixes: { actor: 'DETECTIVE', world: 'CITY' },
    theme: base().theme, header: base().header, tabs: base().tabs };

  ok('button exists', (await ev(`!!${$('passist')}`)) === true);
  await click('#passist');
  await wait(300);
  ok('assistant opens, app and editor hidden', (await visible('assist')) && !(await visible('app')) && !(await visible('editor')));
  ok('target line shows the mind id from the tab address', (await ev(`${$('asMind')}.textContent`)).includes('TESTMIND1'), await ev(`${$('asMind')}.textContent`));
  ok('language fields are prefilled', (await ev(`${$('asMindLang')}.value`)) === 'English');

  // Alter Stand im Chat soll nicht als Antwort zählen
  await reply('An old reply with {"id":"old","tabs":[]} in it.');
  await set('asName', 'Noir');
  await set('asAbout', 'A detective in 1948');
  await set('asActions', 'ask, watch');
  await click('#asStart');
  await wait(400);
  let inj = await injected();
  ok('prompt is injected and sent', inj.length === 1 && inj[0].send === true && inj[0].mode === 'replace', inj.map((x) => [x.send, x.mode]));
  ok('prompt carries the description and the mind id', inj[0].text.includes('- Name of the mind: Noir') && inj[0].text.includes('A detective in 1948') && inj[0].text.includes('- Mind ID (from the URL): TESTMIND1'));
  ok('start disabled and waiting text shown', (await ev(`${$('asStart')}.disabled`)) === true && (await ev(`${$('asState')}.textContent`)).includes('Waiting'));
  ok('open-now button appears', await visible('asNow'));
  await wait(3000);
  ok('old reply does not finish the run', !(await visible('editor')) && (await visible('assist')));

  // Antwort wächst, dann fertig: Editor öffnet sich von selbst
  await reply('```json\n{"id": "noir", "name": "No');
  await wait(3000);
  ok('streaming reply: editor stays closed', !(await visible('editor')));
  await reply('Sure:\n```json\n' + JSON.stringify(profile, null, 2) + '\n```\nThree notes follow.');
  await wait(AS_WAIT());
  ok('editor opens by itself, assistant closes', (await visible('editor')) && !(await visible('assist')));
  const txt = await ev(`${$('edText')}.value`);
  let obj; try { obj = JSON.parse(txt); } catch { /* */ }
  ok('editor holds the generated JSON', obj && obj.id === 'noir' && obj.tabs.length === 1, txt.slice(0, 80));
  ok('placeholder id replaced by the real mind id', obj && JSON.stringify(obj.mindIds) === '["TESTMIND1"]', obj && obj.mindIds);
  const note = await ev(`${$('edAssist')}.textContent`);
  ok('note tells the user to check and save, and the id was added', (await visible('edAssist')) && note.includes('JSON') && note.includes('TESTMIND1'), note);
  ok('draft is valid', (await ev(`${$('edStatus')}.textContent`)).includes('valid'), await ev(`${$('edStatus')}.textContent`));
  ok('polling stopped after finishing', (await injected()).length === 1);

  // Speichern legt das Profil ab
  await click('#edSave');
  await wait(500);
  const stored = await ev(`chrome.storage.local.get('customProfiles').then(r=>Object.keys(r.customProfiles))`);
  ok('save stores the profile', JSON.stringify(stored) === '["testprof","noir"]' || stored.includes('noir'), stored);

  // Zweiter Lauf: Mind antwortet erst im Rollenspiel (kein JSON), dann mit kaputtem JSON
  await reply('The rain falls. What do you do?');
  await click('#passist'); await wait(300);
  ok('form was remembered', (await ev(`${$('asName')}.value`)) === 'Noir');
  await click('#asStart'); await wait(300);
  await reply('I am the detective, how can I help?');
  await wait(8500);
  ok('prose reply: still waiting, hint shown', !(await visible('editor')) && (await ev(`${$('asState')}.textContent`)).includes('without profile JSON'), await ev(`${$('asState')}.textContent`));
  const broken = JSON.stringify({ ...profile, id: 'noir2', mindIds: [] }, null, 2).replace('"name": "Noir",', '"name": "Noir"');
  await reply('```json\n' + broken + '\n```');
  await wait(AS_WAIT());
  ok('broken JSON opens the editor with the errors', (await visible('editor')) && (await ev(`${$('edErrors')}.children.length`)) > 0, await ev(`${$('edStatus')}.textContent`));
  ok('broken note shown', (await ev(`${$('edAssist')}.textContent`)).includes('errors'), await ev(`${$('edAssist')}.textContent`));
  // Nutzer korrigiert und fügt ein: Text rundherum fällt weg, ID wird ergänzt
  await ev(`(()=>{const ta=${$('edText')};ta.value='Here is the profile:\\n'+${JSON.stringify(JSON.stringify({ ...profile, id: 'noir3', mindIds: [] }))}+'\\nenjoy';ta.dispatchEvent(new Event('paste'));})();0`);
  await wait(500);
  const pasted = JSON.parse(await ev(`${$('edText')}.value`));
  ok('paste: text around the JSON removed, mind id added', pasted.id === 'noir3' && JSON.stringify(pasted.mindIds) === '["TESTMIND1"]', pasted);
  ok('paste: draft becomes valid', (await ev(`${$('edStatus')}.textContent`)).includes('valid'), await ev(`${$('edStatus')}.textContent`));
  await click('#edClose'); await wait(300);
  ok('closing the editor clears the note context', (await ev(`${$('edAssist')}.hidden`)) === true);

  // EDITOR JETZT ÖFFNEN ohne Antwort: leerer Editor mit Hinweis zum Einfügen
  await click('#passist'); await wait(300);
  await reply('Just old text.');
  await click('#asStart'); await wait(300);
  await click('#asNow'); await wait(300);
  ok('open-now without a reply: empty editor with the paste hint', (await visible('editor')) && (await ev(`${$('edText')}.value`)) === '' && (await ev(`${$('edAssist')}.textContent`)).includes('paste'), await ev(`${$('edAssist')}.textContent`));
  await ev(`(()=>{const ta=${$('edText')};ta.value=${JSON.stringify(JSON.stringify({ ...profile, id: 'noir4', mindIds: [] }))};ta.dispatchEvent(new Event('paste'));})();0`);
  await wait(500);
  ok('paste into the empty editor adds the id as well', JSON.parse(await ev(`${$('edText')}.value`)).mindIds[0] === 'TESTMIND1');
  await click('#edClose'); await wait(200);

  // Ohne Assistent bleibt der normale Editor unberührt (keine ID-Automatik)
  await click('#pnew'); await wait(300);
  ok('plain editor: no assistant note', (await ev(`${$('edAssist')}.hidden`)) === true);
  await ev(`(()=>{const ta=${$('edText')};ta.value=${JSON.stringify(JSON.stringify({ ...profile, id: 'noir5', mindIds: [] }))};ta.dispatchEvent(new Event('paste'));})();0`);
  await wait(500);
  ok('plain editor: paste leaves mindIds alone', JSON.parse(await ev(`${$('edText')}.value`)).mindIds.length === 0);
  await click('#edClose'); await wait(200);

  // Schließen bricht einen laufenden Auftrag ab
  await click('#passist'); await wait(300);
  await click('#asStart'); await wait(300);
  await click('#asClose'); await wait(300);
  ok('close cancels the run and restores the app', (await visible('app')) && !(await visible('assist')));
  await reply('```json\n' + JSON.stringify(profile) + '\n```');
  await wait(AS_WAIT());
  ok('no editor pops up after cancelling', !(await visible('editor')));

  T.finish();
});

function AS_WAIT() { return 9000; }
