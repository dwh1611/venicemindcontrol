// Ghostline: Hacker auf dem iPhone der Zielperson (Jenny Brenner).
// Reine Daten (JSON-kompatibel), siehe PROFILE-FORMAT.md.
(() => {
  // L(en, de): Text mit englischer und deutscher Fassung (siehe PROFILE-FORMAT.md, "Mehrsprachige Texte").
  // Die Ereignis-Arten (ZUGRIFF, EINGRIFF, KONTAKT, …) bleiben unübersetzt: sie sind das Protokoll zum Mind.
  const L = (en, de) => ({ en, de });
  const need = (key, msg) => ({ need: key, msg });
  const CHANNELS = [
    ['SMS', L('SMS', 'SMS')], ['Anruf', L('Call', 'Anruf')], ['Voicemail', L('Voicemail', 'Voicemail')],
    ['Smart Speaker', L('Smart speaker', 'Smart Speaker')], ['Fernseher', L('TV', 'Fernseher')], ['Licht', L('Light', 'Licht')],
    ['Foto aus der Ferne', L('Photo from afar', 'Foto aus der Ferne')], ['Sperrbildschirm', L('Lock screen', 'Sperrbildschirm')],
  ];
  const contactKinds = {};
  CHANNELS.forEach(([c, label]) => { contactKinds[c] = { label, who: L('Unknown number', 'Unbekannte Nummer'), text: 'Where are you?', quick: [] }; });

  MindProfiles.register({
    id: 'ghostline',
    name: 'Ghostline',
    mindIds: ['TOz4jww'],
    titleMatch: 'Ghostline',
    defaultTime: '22:41',
    prefixes: { actor: 'GHOSTLINE', world: 'PHONE' },
    settingsLabels: { actor: L('Prefix hacker', 'Präfix Hacker'), world: L('Prefix world', 'Präfix Welt') },
    theme: {
      fg: '#3dff8a', dim: '#1fa65a', mut: '#4f8a66', line: '#14502e', bg: '#030906', bg2: '#06120b',
      deep: '#010502', ink: '#02140a', warn: '#ffb000', err: '#ff5252', txt: '#a6ffc8', glow: '61,255,138',
    },
    header: {
      logo: '╔═╗╦ ╦╔═╗╔═╗╔╦╗╦  ╦╔╗╔╔═╗\n║ ╦╠═╣║ ║╚═╗ ║ ║  ║║║║║╣\n╚═╝╩ ╩╚═╝╚═╝ ╩ ╩═╝╩╝╚╝╚═╝',
      meta: [['TARGET', 'BRENNER, J. · iPhone 13'], ['LINK  ', L('● STABLE · {lat} ms · SID {sid}', '● STABIL · {lat} ms · SID {sid}')]],
      prompt: 'root@ghostline:~#',
    },
    eventKinds: {
      EINGRIFF: '#ffb000', KONTAKT: '#ff5252', BEOBACHTE: '#8a93a3',
      SMS: '#6cc8ff', WhatsApp: '#6cc8ff', Anruf: '#6cc8ff', 'Gerät': '#6cc8ff', PHONE: '#6cc8ff',
    },
    state: {
      parts: [{ key: 'loc', icon: '📍' }, { key: 'phone', icon: '📱' }],
      numbers: [{ key: 'battery', regex: '(\\d{1,3})\\s*%', icon: '🔋', unit: ' %' }],
      meters: [{ key: 'suspicion', label: 'VERDACHT', regex: 'Verdacht\\s*(\\d)\\s*\\/\\s*(\\d)', max: 4 }],
    },
    statusRight: '🔋 {battery|—} %',

    tabs: [
      { id: 'access', label: L('ACCESS', 'ZUGRIFF'), blocks: [
        { type: 'field', id: 'depth', label: L('Depth / target (optional, appended to the next app)', 'Tiefe / Ziel (optional, wird an die nächste App gehängt)'), placeholder: L('Chat with Callum · Album Private · last 7 days', 'Chat mit Callum · Album Privat · letzte 7 Tage'), clear: true },
        { type: 'grid', cap: 'APPS',
          items: ['Messages', 'WhatsApp', 'Instagram', 'Photos', 'Camera', 'Notes', 'Mail', 'Safari', 'Maps', 'Music', 'Health', 'Monzo', 'Files', 'Voicemail', 'Contacts', L('Calendar', 'Kalender')],
          action: { who: 'actor', parts: ['ZUGRIFF'], body: ['{item}', '› {field.depth}'] } },
        { type: 'grid', cap: L('SENSORS / DATA', 'SENSOREN / DATEN'), items: [L('Front camera', 'Frontkamera'), L('Rear camera', 'Rückkamera'), L('Microphone', 'Mikrofon'), L('Location history', 'Standortverlauf'), L('Wi-Fi list', 'WLAN-Liste'), L('Passwords', 'Passwörter')],
          action: { who: 'actor', parts: ['SENSOR'], body: ['{item}'] } },
      ] },
      { id: 'tweak', label: L('TAMPER', 'EINGRIFF'), blocks: [
        { type: 'field', id: 'param', label: L('Parameter (optional)', 'Parameter (optional)'), placeholder: L('Sound: breathing · Photo: Jenny in the mirror · App: Photos', 'Ton: Atmen · Foto: Jenny im Spiegel · App: Photos'), clear: true },
        { type: 'grid', cap: L('SMALL TAMPERS', 'KLEINE EINGRIFFE'),
          items: [
            { label: L('Flicker screen', 'Display flackert'), text: L('Screen flickers briefly', 'Display flackert kurz') },
            { label: L('Camera LED', 'Kamera-LED'), text: L('Camera LED lights up briefly', 'Kamera-LED leuchtet kurz auf') },
            { label: L('Drain battery', 'Akku saugen'), text: L('Battery drops noticeably', 'Akku fällt spürbar') },
            { label: L('Jam Wi-Fi', 'WLAN stören'), text: L('Wi-Fi drops', 'WLAN bricht ab') },
            { label: L('Flashlight', 'Taschenlampe'), text: L('Flashlight turns on', 'Taschenlampe geht an') },
            { label: L('Play sound', 'Ton abspielen'), text: L('A sound is played', 'Ton wird abgespielt') },
            { label: L('Plant photo', 'Foto ablegen'), text: L('A photo is placed in the gallery', 'Foto wird in der Galerie abgelegt') },
            { label: L('Plant file', 'Datei ablegen'), text: L('A file is placed on the phone', 'Datei wird abgelegt') },
            { label: L('Open app', 'App öffnen'), text: L('An app opens by itself', 'App öffnet sich von selbst') },
            { label: L('Banner', 'Banner'), text: L('A notification appears', 'Benachrichtigung erscheint') },
          ],
          action: { who: 'actor', parts: ['EINGRIFF'], body: ['{item.text}', '– {field.param}'] } },
      ] },
      { id: 'contact', label: L('CONTACT', 'KONTAKT'), blocks: [
        { type: 'compose', kindLabel: L('Channel', 'Kanal'), whoLabel: L('Sender / voice', 'Absender / Stimme'), textLabel: L('Content', 'Inhalt'), kinds: contactKinds,
          action: { who: 'actor', parts: ['KONTAKT', '{kind}', '{who}'], body: ['{text}'], requires: [need('text', L('Content missing.', 'Inhalt fehlt.'))] } },
      ] },
      { id: 'world', label: L('WORLD', 'WELT'), blocks: [
        { type: 'hint', text: L('Events that do not come from the hacker: other people\'s messages, calls, device state.', 'Ereignisse, die nicht vom Hacker kommen: Nachrichten anderer, Anrufe, Gerätezustand.') },
        { type: 'compose', kindLabel: L('Type', 'Art'), whoLabel: L('Sender', 'Absender'), textLabel: L('Content', 'Inhalt'),
          kinds: {
            SMS: { who: L('Callum / Unknown number', 'Callum / Unbekannte Nummer'), text: 'you up?', quick: ['you up?', L('can you swap shifts tomorrow?', 'kannst du morgen die Schicht tauschen?'), 'sorry about earlier x'] },
            WhatsApp: { who: 'Priya / Mum / Tom', text: L('are you home tonight?', 'bist du heute Abend zu Hause?'), quick: [L('are you home tonight?', 'bist du heute Abend zu Hause?'), L('Photo', 'Foto'), L('Voice message (0:34)', 'Sprachnachricht (0:34)')] },
            Anruf: { label: L('Call', 'Anruf'), who: L('Mum / Unknown number', 'Mum / Unbekannte Nummer'), text: L('incoming, missed', 'eingehend, verpasst'), quick: [L('incoming, missed', 'eingehend, verpasst'), L('incoming, declined', 'eingehend, abgelehnt'), L('outgoing, 0:42 min', 'ausgehend, 0:42 min')] },
            'Gerät': { label: L('Device', 'Gerät'), who: L('(optional)', '(optional)'), text: L('What happens on the device?', 'Was passiert am Gerät?'), quick: [L('Battery drops suddenly', 'Akku fällt schlagartig'), L('Screen lights up briefly', 'Display leuchtet kurz auf'), L('Camera LED blinks', 'Kamera-LED blinkt'), L('Wi-Fi drops briefly', 'WLAN bricht kurz ab'), L('Phone gets warm', 'Telefon wird warm'), L('Speaker crackles', 'Lautsprecher knackt')] },
            Frei: { label: L('Free', 'Frei'), who: L('(optional)', '(optional)'), text: L('Free text', 'Freier Text'), quick: [] },
          },
          action: { who: 'world', parts: ['{kind}', '{who}'], body: ['{text}'], omitKinds: ['Frei'], requiresAny: { need: ['text', 'who'], msg: L('Content missing.', 'Inhalt fehlt.') } } },
      ] },
      { id: 'wait', label: L('TIME', 'ZEIT'), blocks: [
        { type: 'hint', text: L('Just watch. Time moves on, she lives her life.', 'Nur zusehen. Die Zeit läuft weiter, sie lebt ihr Leben.') },
        { type: 'grid', cap: L('OBSERVE', 'BEOBACHTEN'),
          items: [
            { label: '5 min', m: 5 }, { label: '15 min', m: 15 }, { label: '30 min', m: 30 },
            { label: '1 h', m: 60 }, { label: '3 h', m: 180 }, { label: L('until 07:00', 'bis 07:00'), until: '07:00' },
          ],
          action: { who: 'actor', parts: ['BEOBACHTE'], body: ['{item.label}', '({until_minutes} min)'], shift: true } },
      ] },
    ],

    convention: L(
      `[Convention] Lines in square brackets starting with "{hp}" are actions of the user (the hacker): ZUGRIFF = open an app or area, SENSOR = pull camera, microphone or data, EINGRIFF = small tamper on the device, KONTAKT = message to Jenny over the named channel, BEOBACHTE = time passes, the user only watches. Lines starting with "{wp}" are events on the phone or in Jenny's surroundings that the user does not trigger. The time in the line is the current in-world time. Free text below is direct speech or action of the user.`,
      `[Konvention] Zeilen in eckigen Klammern mit "{hp}" sind Aktionen des Nutzers (Hacker): ZUGRIFF = App oder Bereich öffnen, SENSOR = Kamera, Mikrofon oder Daten abrufen, EINGRIFF = kleiner Eingriff am Gerät, KONTAKT = Nachricht an Jenny über den genannten Kanal, BEOBACHTE = Zeit vergeht, der Nutzer sieht nur zu. Zeilen mit "{wp}" sind Ereignisse auf dem Telefon oder in Jennys Umfeld, die nicht vom Nutzer ausgelöst werden. Die Uhrzeit in der Zeile ist die aktuelle Spielzeit. Freier Text darunter ist direkte Rede oder Handlung des Nutzers.`,
    ),
  });
})();
