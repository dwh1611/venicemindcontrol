# Prompt: Profil-JSON für Mind Console erzeugen

So geht's: Den Text zwischen den beiden Markierungen kopieren (oder im Panel unter *PROFILE* auf
*PROMPT FÜR PROFIL-GENERATOR KOPIEREN* klicken), in einen **normalen Chat** einfügen (nicht in das Rollenspiel-Mind selbst),
unten bei „MEIN MIND“ die Angaben ausfüllen und senden. Die Antwort als `.json` speichern und im Panel importieren.

Hinweis: Die Mind-ID steht in der URL: `venice.ai/chat/minds/local/<MIND-ID>/<chat>`.

<!-- PROMPT START -->
Du erzeugst ein Profil als JSON für die Browser-Erweiterung "Mind Console". Die Erweiterung zeigt neben einem Venice-Chat ein Bedienpanel mit Buttons. Ein Klick fügt eine Zeile wie `[PRÄFIX · 21:40 · ART · TEIL] Text` in die Chatbox ein. Das Rollenspiel-Mind liest diese Zeilen und antwortet mit einer Statuszeile, die das Panel ausliest.

# AUSGABE
- Antworte mit genau einem JSON-Objekt in einem einzigen Codeblock (```json). Keine Kommentare im JSON, keine abschließenden Kommas, keine Funktionen.
- Danach höchstens drei kurze Hinweise (z. B. "Mind-ID fehlt, bitte in mindIds eintragen"). Davor nichts.
- Fehlt eine Angabe, wähle eine sinnvolle Lösung und weise danach darauf hin. Frage nur nach, wenn die Beschreibung unten völlig fehlt.

# SPRACHEN
- Alles, was das Panel anzeigt (label, cap, hint, placeholder, header, settingsLabels): Deutsch.
- Alles, was in den Chat geschrieben wird und das Mind liest (parts, body, items[].text, quick, convention, scenarios-Template): in der Sprache des Minds (laut Beschreibung unten).

# FORMAT
Pflichtfelder:
- "id": 2–32 Zeichen, nur a–z, 0–9, _ und -.
- "name": Anzeigename.
- "mindIds": Liste mit der Mind-ID aus der URL (mind. 5 Zeichen). "titleMatch" (Textteil des Seitentitels als regulärer Ausdruck) ist ein optionaler Rückfall. Eines von beiden muss vorhanden sein.
- "defaultTime": "HH:MM" (Startzeit der Spielzeit).
- "prefixes": {"actor": "...", "world": "..."}. Nur Großbuchstaben, Ziffern, _ und -, 2–21 Zeichen, mit Buchstabe beginnend. "actor" markiert Aktionen des Nutzers, "world" Ereignisse, die nicht vom Nutzer kommen.
- "settingsLabels": {"actor": "Präfix …", "world": "Präfix …"}.
- "theme": Farben als #hex für fg, dim, mut, line, bg, bg2, deep, ink, warn, err, txt. Dazu "glow" als "r,g,b" (die Farbe von fg als Zahlen).
  fg = leuchtende Hauptfarbe, dim = gedämpfter, mut = Nebentext, line = Linien (dunkel), bg = Seitenhintergrund (sehr dunkel), bg2 = Panelfläche (etwas heller als bg), deep = Eingabefelder (noch dunkler), ink = Textfarbe auf fg-Buttons (sehr dunkel), warn = Gelb/Orange für Uhr und Hinweise, err = Rot, txt = gut lesbarer Fließtext im Chat (hell, zu fg passend).
- "header": {"logo": "ASCII-Logo, Zeilen mit \n", "meta": [["SCHLÜSSEL", "Text"]], "prompt": "name@host:~#"}. In meta-Texten sind {sid} (zufällige ID) und {lat} (Zahl) erlaubt, ● blinkt.
- "eventKinds": Art → Farbe (#hex). Siehe unten.
- "state": Wie die Statuszeile gelesen wird. Siehe unten.
- "statusRight": Vorlage neben der Uhr, z. B. "📶 {signal|—}" (Werte aus state, hinter | steht der Ersatz).
- "tabs": 3–7 Reiter, Aufbau siehe unten.
- "convention": Text, der dem Mind die Zeilenformate erklärt. {hp} und {wp} werden durch die Präfixe ersetzt. Optional: Minds, die ihre Befehle schon kennen (z. B. Slash-Befehle), brauchen keine.
- "clock": false (optional) blendet Uhr und Zeitknöpfe aus, wenn das Mind keine Spielzeit hat.
Optional: "scenarios" (siehe unten).

# EVENT-ZEILEN
Das Panel erzeugt `[PRÄFIX · HH:MM · TEIL1 · TEIL2 · …] Text`. TEIL1 ist die "Art" und bestimmt die Farbe des Balkens im Chat. Trage in "eventKinds" jede Art ein, die als erster Teil nach der Uhrzeit vorkommt (bei Aktionen der erste Eintrag in "parts", bei compose-Blöcken die Namen der "kinds", wenn "{kind}" der erste Teil ist). Arten sind Wörter ohne Leerzeichen, max. 24 Zeichen (z. B. ORDER, SMS, Gerät). Gib ähnlichen Arten gleiche Farben, kritischen Rot, Eingriffen Amber, Beobachten Grau.

# STATUSZEILE ("state")
Das Mind beendet jede Antwort mit einer Zeile `⏱ HH:MM · 📍 Ort · …`. Das Panel liest daraus:
- "parts": [{"key": "loc", "icon": "📍"}] liest den Text hinter dem Symbol (Teile sind durch · getrennt).
- "numbers": [{"key": "battery", "regex": "(\\d{1,3})\\s*%", "icon": "🔋", "unit": " %"}]. Gruppe 1 der Regex ist der Wert.
- "meters": [{"key": "risk", "label": "RISIKO", "regex": "Risiko\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 4}]. Gruppe 1 ist der Wert, Gruppe 2 das Maximum.
Reguläre Ausdrücke sind JSON-Strings: Backslashes immer verdoppeln (\\d, \\s, \\/).
Wichtig: Beschreibe die Statuszeile in "convention" exakt so, wie die Regeln sie lesen (gleiche Symbole, gleiche Reihenfolge, gleiche Schreibweise wie "Risiko 2/4").

# REITER UND BLÖCKE
Jeder Reiter: {"id": "eindeutig", "label": "GROSSBUCHSTABEN", "blocks": [ … ]}. Gute Reiter haben 6–16 Buttons, die zur Rolle des Nutzers passen. Blocktypen:
- {"type": "hint", "text": "…"}
- {"type": "field", "id": "ziel", "label": "…", "placeholder": "…", "clear": true, "kind": "input"}. kind: input (Standard), textarea oder select (dann "options": [{"value": "", "label": "normal"}, …]). "clear": true leert das Feld nach jedem Klick im Reiter.
- {"type": "row", "fields": [Feld, Feld]} zeigt zwei Felder nebeneinander (Felder ohne "type").
- {"type": "grid", "cap": "ÜBERSCHRIFT", "items": [ … ], "action": ACTION}. Ein Button pro Eintrag. Einträge sind Text oder {"label": "Anzeige", "text": "Text für den Chat", "m": 5, "until": "06:00"} ("m" = Minuten, "until" = bis zu einer Uhrzeit).
- {"type": "compose", "kindLabel": "Art", "whoLabel": "Absender", "textLabel": "Inhalt", "kinds": {"SMS": {"who": "Platzhalter", "text": "Platzhalter", "quick": ["Schnelltext", "…"]}}, "action": ACTION}. Formular mit Art, Absender und Inhalt. Die Arten sind die Schlüssel von "kinds".
- {"type": "scenarios"} zeigt die Einsatzliste, nur zusammen mit "scenarios".

# ACTION
{
  "who": "actor" oder "world",
  "parts": ["ART", "{item}"],
  "body": ["{item.text}", "– {field.ziel}"],
  "requires": [{"need": "field.ziel", "msg": "Ziel fehlt."}],
  "requiresAny": {"need": ["text", "who"], "msg": "Inhalt fehlt."},
  "omitKinds": ["Frei"],
  "shift": true
}
- "who" bestimmt, welches Präfix die Zeile bekommt. "parts" sind die Teile hinter der Uhrzeit (mit · verbunden). "body" sind Textsegmente (mit Leerzeichen verbunden).
- Ein Teil oder Segment entfällt automatisch, wenn ein Platzhalter darin leer ist. "{x|Ersatz}" setzt einen Ersatzwert.
- Platzhalter: {item} (Text oder label), {item.text}, {item.label}, {field.<id>} (ein Feld desselben Reiters, die id muss dort existieren), {kind}, {who}, {text} (nur in compose), {until_minutes} (nur bei Einträgen mit "until").
- "requires" und "requiresAny" sind optionale Pflichtangaben. "need" nennt einen Platzhalter ohne Klammern (z. B. "field.ziel" oder "text"). Fehlt etwas, erscheint "msg".
- "omitKinds": Arten, bei denen {kind} leer bleibt (z. B. "Frei").
- "format": "raw" schreibt reinen Text ohne [PRÄFIX · Uhrzeit …]-Klammer, z. B. "/scene Text" (Mind wird mit Slash-Befehlen gesteuert). Dann sind "parts" die Wörter vor dem Text und "who" entfällt. Ein Segment darf \n enthalten.
- "shift": true rückt die Spielzeit um "m" Minuten (oder bis "until") vor. Nur sinnvoll bei Warten/Beobachten.
- Grid: Platzhalter {item…} und {field…}. Compose: {kind}, {who}, {text}.

# SZENARIEN (optional)
Nur sinnvoll, wenn das Mind in abgeschlossenen Einsätzen oder Situationen läuft.
"scenarios": {
  "items": [ {"title": "…", "city": "…", "time": "22:10", "place": "…", …} ],
  "fields": [ {"key": "title", "label": "Titel", "ph": "…", "required": true}, {"key": "time", "label": "Uhrzeit", "half": true}, {"key": "place", "label": "Ort", "area": true, "required": true} ],
  "twist": true,
  "template": {
    "segments": ["Place: {place}.", "Mission: {mission}"],
    "complication": {"choose": "Complication: your choice, intensity {level}, keep it secret.", "none": "Complication: none planned.", "spoiler": "Complication: {twist}"},
    "closing": "Open with the character already in position."
  }
}
Szenario-Werte stehen ohne Schlusspunkt, denn die Segmente im Template setzen ihn selbst ("Place: {place}."). Jedes Szenario enthält die "key"s aus "fields" (plus optional "twist" und "city"). "half": true setzt zwei Felder nebeneinander. "area": true macht ein Mehrzeilenfeld. In "template" steht, was das Mind liest, in dessen Sprache. {level} ist light, medium oder hard. Der Reiter dazu: {"id": "scenario", "label": "SZENARIO", "blocks": [{"type": "scenarios"}]}.

# CONVENTION SCHREIBEN
Ein Absatz in der Sprache des Minds, der Folgendes erklärt:
1. Zeilen in eckigen Klammern mit "{hp}" sind Aktionen des Nutzers. Jede Art (die Wörter aus "parts") kurz erklären.
2. Zeilen mit "{wp}" sind Ereignisse, die nicht vom Nutzer kommen. Arten erklären.
3. Die Uhrzeit in der Zeile ist die aktuelle Spielzeit und darf nie rückwärts laufen.
4. Freier Text unter den Zeilen ist direkte Rede oder Handlung des Nutzers.
5. Jede Antwort endet mit der Statuszeile in genau dem Format, das "state" liest.
Die Convention darf außer {hp} und {wp} keine geschweiften Klammern enthalten.

# PRÜFLISTE (vor dem Antworten durchgehen)
- Gültiges JSON, ein Objekt, nichts außer Codeblock und höchstens drei Hinweiszeilen.
- id passt zum Muster. prefixes sind Großbuchstaben. Alle Farben sind #hex, glow ist "r,g,b".
- Jede Aktions-"parts"-Art (und jeder compose-Kind-Name als erster Teil) steht in "eventKinds".
- Jedes {field.x} verweist auf ein Feld mit der id x im selben Reiter. Jedes "need" ist ein gültiger Platzhalter.
- Reiter-ids sind eindeutig. Jeder Reiter hat mindestens einen Block.
- Reguläre Ausdrücke haben verdoppelte Backslashes und passen zur Statuszeile aus "convention".
- Panel-Texte sind deutsch, Chat-Texte in der Sprache des Minds.

# BEISPIEL (vollständig und gültig)
```json
{
  "id": "noir",
  "name": "Noir",
  "mindIds": ["HIER-DIE-MIND-ID"],
  "titleMatch": "Noir",
  "defaultTime": "23:10",
  "prefixes": { "actor": "DETECTIVE", "world": "CITY" },
  "settingsLabels": { "actor": "Präfix Detektiv", "world": "Präfix Stadt" },
  "theme": {
    "fg": "#e8b04a", "dim": "#a87b2a", "mut": "#8a7a5a", "line": "#4a3a1a", "bg": "#0b0905", "bg2": "#141008",
    "deep": "#070502", "ink": "#1a1204", "warn": "#ffb000", "err": "#ff5252", "txt": "#f1ddb2", "glow": "232,176,74"
  },
  "header": {
    "logo": "N O I R",
    "meta": [["CASE ", "Nr. 417 · ● OFFEN · SID {sid}"]],
    "prompt": "det@precinct:~#"
  },
  "eventKinds": { "FRAGE": "#e8b04a", "FOLGEN": "#ffb000", "FUNK": "#6cc8ff", "TIP": "#5fe0c4", "REGEN": "#8a93a3" },
  "state": {
    "parts": [{ "key": "loc", "icon": "📍" }],
    "numbers": [{ "key": "cash", "regex": "(\\d{1,5})\\s*\\$", "icon": "💵", "unit": " $" }],
    "meters": [{ "key": "heat", "label": "HITZE", "regex": "Hitze\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 4 }]
  },
  "statusRight": "💵 {cash|—} $",
  "tabs": [
    { "id": "frage", "label": "FRAGEN", "blocks": [
      { "type": "hint", "text": "Wen oder was befragst du?" },
      { "type": "field", "id": "ziel", "label": "Person / Ort", "placeholder": "Barkeeper, Hafenlager 9 …", "clear": true },
      { "type": "grid", "cap": "BEFRAGEN",
        "items": ["Wo waren Sie gestern Nacht?", "Kennen Sie diesen Mann?", "Wer bezahlt Sie?"],
        "action": { "who": "actor", "parts": ["FRAGE"], "body": ["{item}", "→ {field.ziel}"],
                    "requires": [{ "need": "field.ziel", "msg": "Wen befragst du?" }] } }
    ] },
    { "id": "funk", "label": "FUNK", "blocks": [
      { "type": "compose", "kindLabel": "Art", "whoLabel": "Von", "textLabel": "Inhalt",
        "kinds": {
          "FUNK": { "who": "Zentrale", "text": "Was kommt über Funk?", "quick": ["Verdächtiger gesehen.", "Verstärkung unterwegs."] },
          "TIP": { "who": "Informant", "text": "Was flüstert er?", "quick": ["Lagerhaus am Pier."] }
        },
        "action": { "who": "world", "parts": ["{kind}", "{who}"], "body": ["{text}"],
                    "requires": [{ "need": "text", "msg": "Inhalt fehlt." }] } }
    ] },
    { "id": "warten", "label": "WARTEN", "blocks": [
      { "type": "grid", "cap": "ZEIT VERGEHT",
        "items": [{ "label": "10 min", "m": 10 }, { "label": "1 h", "m": 60 }, { "label": "bis 06:00", "until": "06:00" }],
        "action": { "who": "actor", "parts": ["FOLGEN"], "body": ["{item.label}", "({until_minutes} min)"], "shift": true } }
    ] },
    { "id": "scenario", "label": "FÄLLE", "blocks": [{ "type": "scenarios" }] }
  ],
  "scenarios": {
    "items": [
      { "title": "Der Pier", "city": "Hafen", "time": "23:10", "place": "A foggy pier, warehouse 9 ahead", "mission": "Find out who is unloading crates" }
    ],
    "fields": [
      { "key": "title", "label": "Titel", "ph": "Der Pier", "required": true },
      { "key": "time", "label": "Uhrzeit", "ph": "23:10" },
      { "key": "place", "label": "Ort", "ph": "A foggy pier", "area": true, "required": true },
      { "key": "mission", "label": "Auftrag", "ph": "Find out who is unloading crates", "area": true }
    ],
    "twist": false,
    "template": {
      "segments": ["Place: {place}.", "Mission: {mission}"],
      "complication": { "choose": "Complication: your choice, keep it hidden.", "none": "Complication: none.", "spoiler": "Complication: {twist}" },
      "closing": "Open with the detective already on the scene."
    }
  },
  "convention": "Lines in square brackets starting with \"{hp}\" are the detective's actions: FRAGE = a question put to a person, FOLGEN = time passes while the detective watches. Lines starting with \"{wp}\" are events that do not come from the detective: FUNK = a radio message, TIP = an informant's whisper. The time in each line is the current in-world time and never runs backwards. Free text below the lines is the detective speaking or acting. End every reply with one status line in this exact form: ⏱ HH:MM · 📍 location · 150 $ · Hitze 2/4"
}
```

# MEIN MIND (ausfüllen)
- Name des Minds:
- Mind-ID (aus der URL, falls bekannt):
- Sprache des Minds (Chat-Texte):
- Worum geht es (Rolle des Nutzers, Figur, Stimmung, Welt):
- Was kann der Nutzer tun? (Aktionen, die als Buttons erscheinen sollen, gern nach Gruppen):
- Welche Ereignisse kommen von außen? (Nachrichten, Funk, Technik, Zufälle):
- Welche Werte stehen in der Statuszeile? (Ort, Akku, Risiko, Verletzungen, Geld …):
- Gewünschte Optik (Farben, Stil):
- Szenarien gewünscht? (ja/nein, welche):
<!-- PROMPT END -->
