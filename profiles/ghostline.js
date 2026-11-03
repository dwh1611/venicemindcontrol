// Ghostline: Hacker auf dem iPhone der Zielperson (Jenny Brenner).
// Reine Daten (JSON-kompatibel), siehe PROFILE-FORMAT.md.
(() => {
  const need = (key, msg) => ({ need: key, msg });
  const CHANNELS = ['SMS', 'Anruf', 'Voicemail', 'Smart Speaker', 'Fernseher', 'Licht', 'Foto aus der Ferne', 'Sperrbildschirm'];
  const contactKinds = {};
  CHANNELS.forEach((c) => { contactKinds[c] = { who: 'Unbekannte Nummer', text: 'Where are you?', quick: [] }; });

  MindProfiles.register({
    id: 'ghostline',
    name: 'Ghostline',
    mindIds: ['TOz4jww'],
    titleMatch: 'Ghostline',
    defaultTime: '22:41',
    prefixes: { actor: 'GHOSTLINE', world: 'PHONE' },
    settingsLabels: { actor: 'Präfix Hacker', world: 'Präfix Welt' },
    theme: {
      fg: '#3dff8a', dim: '#1fa65a', mut: '#4f8a66', line: '#14502e', bg: '#030906', bg2: '#06120b',
      deep: '#010502', ink: '#02140a', warn: '#ffb000', err: '#ff5252', txt: '#a6ffc8', glow: '61,255,138',
    },
    header: {
      logo: '╔═╗╦ ╦╔═╗╔═╗╔╦╗╦  ╦╔╗╔╔═╗\n║ ╦╠═╣║ ║╚═╗ ║ ║  ║║║║║╣\n╚═╝╩ ╩╚═╝╚═╝ ╩ ╩═╝╩╝╚╝╚═╝',
      meta: [['TARGET', 'BRENNER, J. · iPhone 13'], ['LINK  ', '● STABIL · {lat} ms · SID {sid}']],
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
      { id: 'access', label: 'ZUGRIFF', blocks: [
        { type: 'field', id: 'depth', label: 'Tiefe / Ziel (optional, wird an die nächste App gehängt)', placeholder: 'Chat mit Callum · Album Privat · letzte 7 Tage', clear: true },
        { type: 'grid', cap: 'APPS',
          items: ['Messages', 'WhatsApp', 'Instagram', 'Photos', 'Camera', 'Notes', 'Mail', 'Safari', 'Maps', 'Music', 'Health', 'Monzo', 'Files', 'Voicemail', 'Contacts', 'Kalender'],
          action: { who: 'actor', parts: ['ZUGRIFF'], body: ['{item}', '› {field.depth}'] } },
        { type: 'grid', cap: 'SENSOREN / DATEN', items: ['Frontkamera', 'Rückkamera', 'Mikrofon', 'Standortverlauf', 'WLAN-Liste', 'Passwörter'],
          action: { who: 'actor', parts: ['SENSOR'], body: ['{item}'] } },
      ] },
      { id: 'tweak', label: 'EINGRIFF', blocks: [
        { type: 'field', id: 'param', label: 'Parameter (optional)', placeholder: 'Ton: Atmen · Foto: Jenny im Spiegel · App: Photos', clear: true },
        { type: 'grid', cap: 'KLEINE EINGRIFFE',
          items: [
            { label: 'Display flackert', text: 'Display flackert kurz' },
            { label: 'Kamera-LED', text: 'Kamera-LED leuchtet kurz auf' },
            { label: 'Akku saugen', text: 'Akku fällt spürbar' },
            { label: 'WLAN stören', text: 'WLAN bricht ab' },
            { label: 'Taschenlampe', text: 'Taschenlampe geht an' },
            { label: 'Ton abspielen', text: 'Ton wird abgespielt' },
            { label: 'Foto ablegen', text: 'Foto wird in der Galerie abgelegt' },
            { label: 'Datei ablegen', text: 'Datei wird abgelegt' },
            { label: 'App öffnen', text: 'App öffnet sich von selbst' },
            { label: 'Banner', text: 'Benachrichtigung erscheint' },
          ],
          action: { who: 'actor', parts: ['EINGRIFF'], body: ['{item.text}', '– {field.param}'] } },
      ] },
      { id: 'contact', label: 'KONTAKT', blocks: [
        { type: 'compose', kindLabel: 'Kanal', whoLabel: 'Absender / Stimme', textLabel: 'Inhalt', kinds: contactKinds,
          action: { who: 'actor', parts: ['KONTAKT', '{kind}', '{who}'], body: ['{text}'], requires: [need('text', 'Inhalt fehlt.')] } },
      ] },
      { id: 'world', label: 'WELT', blocks: [
        { type: 'hint', text: 'Ereignisse, die nicht vom Hacker kommen: Nachrichten anderer, Anrufe, Gerätezustand.' },
        { type: 'compose', kindLabel: 'Art', whoLabel: 'Absender', textLabel: 'Inhalt',
          kinds: {
            SMS: { who: 'Callum / Unbekannte Nummer', text: 'you up?', quick: ['you up?', 'kannst du morgen die Schicht tauschen?', 'sorry about earlier x'] },
            WhatsApp: { who: 'Priya / Mum / Tom', text: 'bist du heute Abend zu Hause?', quick: ['bist du heute Abend zu Hause?', 'Foto', 'Sprachnachricht (0:34)'] },
            Anruf: { who: 'Mum / Unbekannte Nummer', text: 'eingehend, verpasst', quick: ['eingehend, verpasst', 'eingehend, abgelehnt', 'ausgehend, 0:42 min'] },
            'Gerät': { who: '(optional)', text: 'Was passiert am Gerät?', quick: ['Akku fällt schlagartig', 'Display leuchtet kurz auf', 'Kamera-LED blinkt', 'WLAN bricht kurz ab', 'Telefon wird warm', 'Lautsprecher knackt'] },
            Frei: { who: '(optional)', text: 'Freier Text', quick: [] },
          },
          action: { who: 'world', parts: ['{kind}', '{who}'], body: ['{text}'], omitKinds: ['Frei'], requiresAny: { need: ['text', 'who'], msg: 'Inhalt fehlt.' } } },
      ] },
      { id: 'wait', label: 'ZEIT', blocks: [
        { type: 'hint', text: 'Nur zusehen. Die Zeit läuft weiter, sie lebt ihr Leben.' },
        { type: 'grid', cap: 'BEOBACHTEN',
          items: [
            { label: '5 min', m: 5 }, { label: '15 min', m: 15 }, { label: '30 min', m: 30 },
            { label: '1 h', m: 60 }, { label: '3 h', m: 180 }, { label: 'bis 07:00', until: '07:00' },
          ],
          action: { who: 'actor', parts: ['BEOBACHTE'], body: ['{item.label}', '({until_minutes} min)'], shift: true } },
      ] },
    ],

    convention:
      `[Konvention] Zeilen in eckigen Klammern mit "{hp}" sind Aktionen des Nutzers (Hacker): ZUGRIFF = App oder Bereich öffnen, SENSOR = Kamera, Mikrofon oder Daten abrufen, EINGRIFF = kleiner Eingriff am Gerät, KONTAKT = Nachricht an Jenny über den genannten Kanal, BEOBACHTE = Zeit vergeht, der Nutzer sieht nur zu. Zeilen mit "{wp}" sind Ereignisse auf dem Telefon oder in Jennys Umfeld, die nicht vom Nutzer ausgelöst werden. Die Uhrzeit in der Zeile ist die aktuelle Spielzeit. Freier Text darunter ist direkte Rede oder Handlung des Nutzers.`,
  });
})();
