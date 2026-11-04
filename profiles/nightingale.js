// Nightingale: Freya Ashcombe, SIS-Feldoffizierin. Du bist der Operator im Ohr.
// Reine Daten (JSON-kompatibel), siehe PROFILE-FORMAT.md.
(() => {
  // L(en, de): Text mit englischer und deutscher Fassung (siehe PROFILE-FORMAT.md, "Mehrsprachige Texte").
  // Die Ereignis-Arten (QUERY, OPERATE, ORDER, COMMS, …) bleiben unübersetzt: sie sind das Protokoll zum Mind.
  const L = (en, de) => ({ en, de });
  const SCENARIOS = [
      {
        id: 'ams-obs', title: 'Observation Amsterdam', city: 'Amsterdam', time: '22:10',
        date: 'Tuesday 4 November', weather: 'steady rain, 6°C, wind off the water',
        place: 'Herengracht, canal-side doorway opposite a tall canal house with a brass plate',
        mission: 'Confirm whether a second man visits the house tonight; photograph him if he does. No contact.',
        target: 'A fixer known only as "Bram", reportedly meeting a buyer',
        legend: 'Freya is a language student killing time. Cover 4/4, handset clean, battery 71%.',
        opponents: 'Two lookouts, one on a bicycle, one in a parked estate car',
        twist: 'The lookout on the bike has already clocked her; the house calls it in within the first ten minutes.',
      },
      {
        id: 'vie-drop', title: L('Dead Drop Vienna', 'Dead Drop Wien'), city: 'Vienna', time: '08:20',
        date: 'Friday 12 December', weather: 'thick fog, 1°C',
        place: 'Karlsplatz U-Bahn concourse, then the Naschmarkt stalls beyond',
        mission: 'Service a dead drop behind a tiled column and carry the contents to the fallback. Check for interference first.',
        target: 'No target. The drop belongs to an asset codenamed "Linden"',
        legend: 'Freya is a commuter with a gym bag. Cover 4/4, handset clean, battery 90%.',
        opponents: 'Possible counter-surveillance on the concourse, unconfirmed',
        twist: 'The drop has been emptied and replaced with a decoy; someone is watching who collects it.',
      },
      {
        id: 'prg-meet', title: L('Hotel Meeting Prague', 'Hotel-Treffen Prag'), city: 'Prague', time: '19:30',
        date: 'Thursday 16 October', weather: 'dry, mild, early dark',
        place: 'Hotel lobby bar in Malá Strana, a few streets below the castle',
        mission: 'Meet a go-between for a prospective defector. Verify who he is and hand over a one-time phrase, nothing else.',
        target: 'A go-between with a limp, calling himself "Pavel"',
        legend: 'Freya is a translator in town for a conference. Cover 4/4, handset clean, battery 64%.',
        opponents: 'None known. The Station Chief has not vouched for the contact',
        twist: 'Pavel arrives with a second man he did not mention, and neither of them looks nervous.',
      },
      {
        id: 'ber-tail', title: L('Tail in Berlin', 'Verfolgung Berlin'), city: 'Berlin', time: '17:45',
        date: 'Wednesday 7 January', weather: 'dry cold, light snow, -3°C',
        place: 'Kreuzberg, starting on Oranienstraße',
        mission: 'Follow a courier from the café to wherever he goes. Run an SDR first. Do not lose him, do not burn.',
        target: 'A courier in a green anorak carrying a small hard case',
        legend: 'Freya is a tourist with a day pass and a bad sense of direction. Cover 4/4, handset clean, battery 58%.',
        opponents: 'The courier is a pro and uses a double-back through a shopping arcade',
        twist: 'Halfway through, a second woman picks up Freya instead of the courier.',
      },
      {
        id: 'trs-port', title: L('Port of Trieste', 'Hafen Triest'), city: 'Trieste', time: '04:50',
        date: 'Saturday 14 March', weather: 'cold, gale-force bora wind, dry',
        place: 'Molo Audace and the old port warehouses behind Piazza Unità d\'Italia',
        mission: 'Observe a cargo handoff at a warehouse. Log vehicles and plates. Intervene only if told.',
        target: 'A cargo of unknown contents moving off a small coaster',
        legend: 'Freya is a dock-side photographer shooting the dawn. Cover 4/4, handset clean, battery 80%.',
        opponents: 'Port security, two armed men on the quay, one drone',
        twist: 'The wind carries her voice; a man on the quay turns around when she answers the operator.',
      },
      {
        id: 'zrh-auction', title: L('Auction House Zurich', 'Auktionshaus Zürich'), city: 'Zurich', time: '14:00',
        date: 'Monday 11 May', weather: 'bright sun, 19°C',
        place: 'A private auction house off Bahnhofstrasse',
        mission: 'Identify an anonymous telephone bidder by watching who signals the auctioneer. Photograph the paddle.',
        target: 'The anonymous bidder on lot 47, a small bronze',
        legend: 'Freya is an art adviser with a paddle and a budget. Cover 4/4, handset clean, battery 95%. No signal inside the vault room.',
        opponents: 'House security, a rival buyer who recognises her face',
        twist: 'The rival buyer is an old acquaintance from her Cambridge years and says her real name aloud.',
      },
      {
        id: 'rtm-dock', title: L('Port of Rotterdam', 'Hafen Rotterdam'), city: 'Rotterdam', time: '02:30',
        date: 'Sunday 9 November', weather: 'wind, drizzle, 8°C',
        place: 'Waalhaven container terminal, outside the fence at the stack yard',
        mission: 'Find one container by its seal number and photograph the paperwork. Do not enter the fenced area.',
        target: 'A grey 40-foot container, seal ending 4471',
        legend: 'Freya is a drifter looking for work at the gate. Cover 4/4, handset clean, battery 49%.',
        opponents: 'Patrol cars every nine minutes, a night supervisor who likes to talk',
        twist: 'The seal number has been swapped; the real container is two stacks away and under inspection.',
      },
      {
        id: 'bud-embassy', title: L('Embassy Reception Budapest', 'Botschaftsempfang Budapest'), city: 'Budapest', time: '21:00',
        date: 'Friday 19 September', weather: 'warm evening, light breeze',
        place: 'Reception at an embassy residence on Andrássy út',
        mission: 'Photograph the guest list and get a name and a face for a man in a grey suit. Do not draw attention.',
        target: 'A guest listed only as "D. Marsh, trade attaché"',
        legend: 'Freya is a freelance interpreter hired for the evening. Cover 4/4, handset clean, battery 72%. Poor signal indoors.',
        opponents: 'Embassy security, a drunk journalist who knows everyone',
        twist: 'The man in the grey suit is expecting an interpreter and asks her to join a private conversation.',
      },
      {
        id: 'lis-extract', title: L('Safehouse Lisbon', 'Safehouse Lissabon'), city: 'Lisbon', time: '23:40',
        date: 'Tuesday 17 February', weather: 'drizzle, 11°C, slick cobbles',
        place: 'Alfama, steep alleys above the Sé cathedral',
        mission: 'The safehouse has gone silent. Check it from the outside, extract the asset if safe, abort if not.',
        target: 'An asset codenamed "Wren", missing for six hours',
        legend: 'Freya is a visiting niece with a key she does not own. Cover 4/4, handset clean, battery 33%. Signal drops in the alleys.',
        opponents: 'Unknown. Neighbours may be watching, a car idles at the foot of the hill',
        twist: 'The asset is inside and alive, but not alone, and signals her to leave without speaking.',
      },
      {
        id: 'nj-train', title: L('Night Train Vienna–Venice', 'Nachtzug Wien-Venedig'), city: 'Vienna', time: '22:05',
        date: 'Tuesday 18 November', weather: 'cold clear night, 2°C',
        place: 'Wien Hauptbahnhof, platform for the overnight sleeper',
        mission: 'Board the sleeper, locate a man in the first-class compartment and shadow him until Villach. Do not let him leave your sight.',
        target: 'A man travelling as "Karl Weiss", 50s, grey overcoat, one suitcase',
        legend: 'Freya is a young professional heading south on holiday. Cover 4/4, handset clean, battery 87%. Signal comes and goes in tunnels.',
        opponents: 'A conductor who remembers faces, a man in the corridor who is not what he seems',
        twist: 'At the first stop the target gets off and someone else boards in his place wearing his coat.',
      },
    ];

  const need = (key, msg) => ({ need: key, msg });
  const opsGrid = (sys, cap, items) => ({
    type: 'grid', cap, items,
    action: { who: 'actor', parts: ['OPERATE', sys], body: ['{item}', '– {field.opsTarget}', '({field.opsMode})'] },
  });

  MindProfiles.register({
    id: 'nightingale',
    name: 'Nightingale',
    mindIds: ['c7UAr2z'],
    titleMatch: 'Nightingale',
    defaultTime: '21:40',
    prefixes: { actor: 'NIGHTINGALE', world: 'DESK' },
    settingsLabels: { actor: L('Prefix operator', 'Präfix Operator'), world: L('Prefix situation', 'Präfix Lage') },
    theme: {
      fg: '#7fb4ff', dim: '#4a7fc4', mut: '#6a809e', line: '#1b3555', bg: '#05080d', bg2: '#0a121d',
      deep: '#010502', ink: '#04101f', warn: '#ffb000', err: '#ff5252', txt: '#cfe0ff', glow: '108,170,255',
    },
    header: {
      logo: '╔╗╔╦╔═╗╦ ╦╔╦╗╦╔╗╔╔═╗╔═╗╦  ╔═╗\n║║║║║ ╦╠═╣ ║ ║║║║║ ╦╠═╣║  ║╣\n╝╚╝╩╚═╝╩ ╩ ╩ ╩╝╚╝╚═╝╩ ╩╩═╝╚═╝',
      meta: [['FIELD', 'ASHCOMBE, F. · NIGHTINGALE'], ['DESK ', L('VAUXHALL CROSS · ● SECURE · SID {sid}', 'VAUXHALL CROSS · ● SICHER · SID {sid}')]],
      prompt: 'op@vauxhall:~#',
    },
    eventKinds: {
      ORDER: '#ffb000', OPERATE: '#ff8a5c', SCENARIO: '#c792ff', SILENCE: '#8a93a3',
      QUERY: '#5fe0c4', INTEL: '#5fe0c4', COMMS: '#7fb4ff', WIRE: '#ff5252', STATION: '#ff5252',
    },
    state: {
      parts: [{ key: 'loc', icon: '📍' }, { key: 'signal', icon: '📶' }, { key: 'injury', icon: '🩹' }],
      numbers: [],
      meters: [{ key: 'cover', label: 'COVER', regex: 'Cover\\s*(\\d)\\s*\\/\\s*(\\d)', max: 4 }],
    },
    statusRight: '📶 {signal|—}',

    tabs: [
      { id: 'scenario', label: L('SCENARIO', 'SZENARIO'), blocks: [{ type: 'scenarios' }] },
      { id: 'query', label: L('QUERY', 'ABFRAGE'), blocks: [
        { type: 'hint', text: L('Freya asks, you pull the data. Pick the system, name the target.', 'Freya fragt, du greifst zu. Wähle das System, nenne das Ziel.') },
        { type: 'field', id: 'target', label: L('Target / search term', 'Ziel / Suchbegriff'), placeholder: L('Plate LK19 XBT · name · mobile no. · address', 'Kennzeichen LK19 XBT · Name · Handy-Nr · Adresse'), clear: true },
        { type: 'grid', cap: L('SYSTEMS', 'SYSTEME'), items: ['AEGIS', 'SABLE', 'ORACLE', 'KESTREL'],
          action: { who: 'actor', parts: ['QUERY', '{item}'], body: ['{field.target}'], requires: [need('field.target', L('Target missing.', 'Ziel fehlt.'))] } },
        { type: 'grid', cap: L('LOCAL SOURCES', 'QUELLEN VOR ORT'),
          items: [L('Company register', 'Handelsregister'), L('Land registry', 'Grundbuch'), L('Plate keeper', 'Kennzeichen-Halter'), L('Flight data', 'Flugdaten'), 'Social media', L('Press / web', 'Presse / Web'), L('Station asset', 'Station-Asset'), 'Cut-out', L('Weather / sun', 'Wetter / Sonne'), L('Map / access routes', 'Karte / Zugänge')],
          action: { who: 'actor', parts: ['QUERY', '{item}'], body: ['{field.target}'], requires: [need('field.target', L('Target missing.', 'Ziel fehlt.'))] } },
      ] },
      { id: 'ops', label: L('INTERVENE', 'EINGRIFF'), blocks: [
        { type: 'hint', text: L('Intervene actively, not just gather intel. Every intervention leaves traces.', 'Aktiv eingreifen, nicht nur aufklären. Jeder Eingriff hinterlässt Spuren.') },
        { type: 'row', fields: [
          { id: 'opsTarget', label: L('Target / object', 'Ziel / Objekt'), placeholder: L('Lift Frankrijklei 41 · phone +32… · camera corner Meir', 'Lift Frankrijklei 41 · Handy +32… · Kamera Ecke Meir'), clear: true },
          { id: 'opsMode', label: L('Approach', 'Vorgehen'), kind: 'select', options: [
            { value: '', label: L('normal', 'normal') },
            { value: L('quiet, slow, few traces', 'leise, langsam, wenig Spuren'), label: L('quiet', 'leise') },
            { value: L('immediate, brute force, leaves traces', 'sofort, brachial, hinterlässt Spuren'), label: L('loud', 'laut') },
          ] },
        ] },
        opsGrid('SABLE', L('HANDSET / RADIO (SABLE)', 'HANDSET / FUNK (SABLE)'), [L('Compromise handset', 'Handset kompromittieren'), L('Record call', 'Anruf mitschneiden'), L('Live location', 'Standort live'), L('Intercept SMS', 'SMS abfangen'), L('Jam cell tower', 'Funkzelle stören'), L('Activate microphone', 'Mikrofon aktivieren'), L('Redirect call', 'Anruf umleiten'), L('Lock handset', 'Handset sperren')]),
        opsGrid('ORACLE', L('CAMERAS / DATA (ORACLE)', 'KAMERAS / DATEN (ORACLE)'), [L('Take over camera', 'Kamera übernehmen'), L('CCTV loop', 'CCTV-Schleife'), L('Delete footage', 'Aufnahmen löschen'), L('Live face search', 'Gesicht live suchen'), L('Plate alert', 'Kennzeichen-Alarm'), L('Movement profile', 'Bewegungsprofil')]),
        opsGrid('GEBÄUDE', L('BUILDING / CITY', 'GEBÄUDE / STADT'), [L('Stop lift', 'Lift anhalten'), L('Open door', 'Tür öffnen'), L('Lock door', 'Tür verriegeln'), L('Silence alarm', 'Alarm stummschalten'), L('Cut lights', 'Licht kappen'), L('Cut power', 'Strom kappen'), L('Switch traffic light', 'Ampel schalten'), L('Unlock entryphone', 'Entryphone freischalten')]),
        opsGrid('KESTREL', L('LEGEND / PAPERS (KESTREL)', 'LEGENDE / PAPIERE (KESTREL)'), [L('Create ID', 'Ausweis erzeugen'), L('Plant data trail', 'Datenspur anlegen'), L('Set register entry', 'Registereintrag setzen'), L('Provide vehicle', 'Fahrzeug bereitstellen'), L('Lay account trail', 'Konto-Spur legen'), L('Wipe trail', 'Spur verwischen')]),
      ] },
      { id: 'order', label: 'ORDER', blocks: [
        { type: 'field', id: 'param', label: L('Parameter (optional)', 'Parameter (optional)'), placeholder: L('Place · time · route · reason', 'Ort · Uhrzeit · Route · Grund'), clear: true },
        { type: 'grid', cap: L('ORDERS TO FREYA', 'BEFEHLE AN FREYA'),
          items: [
            { label: 'Go', text: 'GO. Green light.' },
            { label: 'Hold', text: 'HOLD. Stay where you are.' },
            { label: 'Sitrep', text: 'SITREP. Report.' },
            { label: L('Run SDR', 'SDR fahren'), text: 'Run a surveillance detection route before you proceed' },
            { label: L('Abort', 'Abbruch'), text: 'ABORT. Walk away, now.' },
            { label: L('Extraction', 'Extraktion'), text: 'EXTRACT. Move to the fallback point' },
            { label: 'Dead drop', text: 'Service the dead drop' },
            { label: L('Switch legend', 'Legende wechseln'), text: 'Burn the current legend, switch to the backup' },
            { label: L('Send photo', 'Foto senden'), text: 'Send me a photo of what you see' },
            { label: L('Observe', 'Beobachten'), text: 'Observe only. No contact.' },
          ],
          action: { who: 'actor', parts: ['ORDER'], body: ['{item.text}', '– {field.param}'] } },
      ] },
      { id: 'comms', label: L('RADIO', 'FUNK'), blocks: [
        { type: 'compose', kindLabel: L('Type', 'Art'), whoLabel: L('Subject', 'Betreff'), textLabel: L('Content', 'Inhalt'),
          kinds: {
            Funk: { label: L('Radio', 'Funk'), who: L('(optional)', '(optional)'), text: L('What do you say?', 'Was sagst du?'), quick: ['Hold. Counter-surveillance is on you.', 'Say again, you are breaking up.', 'Stand by.'] },
            Text: { label: L('Text', 'Text'), who: L('(optional)', '(optional)'), text: L('Text to the handset', 'Text aufs Handset'), quick: ['Burner is compromised, switch handset.', 'Call me when you are clear.'] },
            Warnung: { label: L('Warning', 'Warnung'), who: L('(optional)', '(optional)'), text: L('What do you see that she does not?', 'Was siehst du, das sie nicht sieht?'), quick: ['You have a tail, grey Passat behind you.', 'Target is early.'] },
            Antwort: { label: L('Answer', 'Antwort'), who: L('(optional)', '(optional)'), text: L('Answer to Freya\'s question', 'Antwort auf Freyas Frage'), quick: ['Copy.', 'Negative.', 'Your call.'] },
            Frei: { label: L('Free', 'Frei'), who: L('(optional)', '(optional)'), text: L('Free text', 'Freier Text'), quick: [] },
          },
          action: { who: 'actor', parts: ['COMMS', '{kind}', '{who}'], body: ['{text}'], requires: [need('text', L('Content missing.', 'Inhalt fehlt.'))] } },
      ] },
      { id: 'wire', label: L('SITUATION', 'LAGE'), blocks: [
        { type: 'hint', text: L('Events that do not come from you: station, situation, technology.', 'Ereignisse, die nicht von dir kommen: Station, Lage, Technik.') },
        { type: 'compose', kindLabel: L('Type', 'Art'), whoLabel: L('Source', 'Quelle'), textLabel: L('Content', 'Inhalt'),
          kinds: {
            STATION: { who: 'Station Chief / Cut-out', text: L('Safe House 2 is cold', 'Safe House 2 ist kalt'), quick: [L('Station Chief demands a status report', 'Station Chief verlangt Statusbericht'), L('Safe House 2 is cold', 'Safe House 2 ist kalt'), L('Cut-out is not responding', 'Cut-out meldet sich nicht')] },
            WIRE: { who: L('(optional)', '(optional)'), text: L('What happens on the channel?', 'Was passiert am Kanal?'), quick: [L('Connection drops', 'Verbindung bricht ab'), L('Signal heavily distorted', 'Signal stark verzerrt'), L('SABLE feed down', 'SABLE-Feed ausgefallen')] },
            INTEL: { who: 'AEGIS / SABLE / ORACLE / KESTREL', text: L('What does the system deliver?', 'Was liefert das System?'), quick: [L('AEGIS hit: two candidates', 'AEGIS-Treffer: zwei Kandidaten'), L('ORACLE: face not conclusive', 'ORACLE: Gesicht nicht eindeutig'), L('File outdated (2021)', 'Akte veraltet (2021)')] },
            Frei: { label: L('Free', 'Frei'), who: L('(optional)', '(optional)'), text: L('Free text', 'Freier Text'), quick: [] },
          },
          action: { who: 'world', parts: ['{kind}', '{who}'], body: ['{text}'], omitKinds: ['Frei'], requiresAny: { need: ['text', 'who'], msg: L('Content missing.', 'Inhalt fehlt.') } } },
      ] },
      { id: 'wait', label: L('SILENCE', 'SCHWEIGEN'), blocks: [
        { type: 'hint', text: L('You say nothing. Freya counts the seconds and acts on her own.', 'Du sagst nichts. Freya zählt die Sekunden und handelt auf eigene Faust.') },
        { type: 'grid', cap: L('RADIO SILENCE', 'FUNKSTILLE'),
          items: [
            { label: '30 s', m: 0.5 }, { label: '2 min', m: 2 }, { label: '5 min', m: 5 },
            { label: '15 min', m: 15 }, { label: '1 h', m: 60 }, { label: L('until 06:00', 'bis 06:00'), until: '06:00' },
          ],
          action: { who: 'actor', parts: ['SILENCE'], body: ['{item.label}', '({until_minutes} min)'], shift: true } },
      ] },
    ],

    scenarios: {
      items: SCENARIOS,
      fields: [
        { key: 'title', label: L('Title', 'Titel'), ph: 'Observation Amsterdam', required: true },
        { key: 'time', label: L('Time', 'Uhrzeit'), ph: '22:10', half: true },
        { key: 'date', label: L('Date', 'Datum'), ph: 'Tuesday 4 November', half: true },
        { key: 'weather', label: L('Weather', 'Wetter'), ph: 'steady rain, 6°C' },
        { key: 'place', label: L('Place', 'Ort'), ph: 'Herengracht, doorway opposite the house', area: true, required: true },
        { key: 'mission', label: L('Mission', 'Auftrag'), ph: 'Confirm whether a second man visits tonight', area: true },
        { key: 'target', label: L('Target', 'Ziel'), ph: 'A fixer known as Bram' },
        { key: 'legend', label: L('Legend / equipment', 'Legende / Ausrüstung'), ph: 'Language student. Cover 4/4, battery 71%.', area: true },
        { key: 'opponents', label: L('Opposition', 'Gegner'), ph: 'Two lookouts, one on a bicycle' },
      ],
      twist: true,
      template: {
        segments: ['Place: {place}.', 'Date: {date}.', 'Weather: {weather}.', 'Mission: {mission}', 'Target: {target}.', 'Legend: {legend}', 'Opposition: {opponents}.'],
        complication: {
          choose: 'Complication: your choice, intensity {level}, keep it secret.',
          none: 'Complication: none planned.',
          spoiler: 'Complication: {twist}',
        },
        closing: 'Open with Freya already in position and a short sitrep.',
      },
    },

    convention:
      `[Convention] Lines in square brackets starting with "{hp}" are the operator's actions: QUERY = a request run through AEGIS, SABLE, ORACLE or KESTREL or a public source (answer with concrete, partial intel and its limits), OPERATE = an active intervention run through SABLE (handset, cell network), ORACLE (cameras, plate and face systems), the building or city infrastructure, or KESTREL (legends, papers); resolve it with concrete effects, delay, and traces left behind, and let it fail or be noticed when the situation warrants, ORDER = an instruction to Freya, COMMS = a message on the handset, SILENCE = the operator says nothing for the stated time and Freya acts on her own judgement. Lines starting with "{wp}" are events that do not come from the operator: STATION, WIRE (channel and technical), INTEL (a system delivering unprompted), SCENARIO (the briefing for a new mission: take place, date, time, weather, mission, target, legend and opposition as fixed facts for the whole scene, never contradict them, open with Freya already in position and a short sitrep, and if the complication is your choice, pick one that fits the stated intensity, keep it secret and trigger it within four to eight beats). The time in each line is the current in-world time. Free text below is the operator speaking into Freya's earpiece. End every beat with one status line in this exact form: ⏱ HH:MM · 📍 location · 📶 signal · 🩹 condition · Cover n/4`,
  });
})();
