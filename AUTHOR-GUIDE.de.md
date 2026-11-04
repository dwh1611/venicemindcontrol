# Autoren-Leitfaden: eigenes Profil bauen

English version: [AUTHOR-GUIDE.md](AUTHOR-GUIDE.md) · Referenz: [PROFILE-FORMAT.de.md](PROFILE-FORMAT.de.md)

Dieser Leitfaden führt Schritt für Schritt von „Ich habe ein Venice-Mind“ zu „Ich habe ein eigenes Bedienpanel dafür“. Programmieren musst du nicht.
Ein Profil ist eine Textdatei im JSON-Format. Wenn du es lieber von einem Chat-Modell schreiben lässt, nimm den
[Generator-Prompt](PROMPT-Profile-Generator.de.md). Lies vorher aber diesen Leitfaden, damit du das Ergebnis prüfen und korrigieren kannst.

> Die Oberfläche des Panels ist deutsch. Die Texte im Profil (Button-Namen, Hinweise, Platzhalter) können in jeder Sprache sein.

## Inhalt
1. [So funktioniert es in zwei Minuten](#1-so-funktioniert-es-in-zwei-minuten)
2. [Schritt 1: das Gespräch zwischen Panel und Mind planen](#2-schritt-1-das-gespr%C3%A4ch-zwischen-panel-und-mind-planen)
3. [Schritt 2: die Mind-ID finden](#3-schritt-2-die-mind-id-finden)
4. [Schritt 3: das Profil bauen (Tutorial „Café-Stammgast“)](#4-schritt-3-das-profil-bauen-tutorial-caf%C3%A9-stammgast)
5. [Schritt 4: dem Mind das Format beibringen](#5-schritt-4-dem-mind-das-format-beibringen)
6. [Schritt 5: importieren und testen](#6-schritt-5-importieren-und-testen)
7. [Rezepte](#7-rezepte)
8. [Gestaltungstipps](#8-gestaltungstipps)
9. [Weitergeben und Versionen](#9-weitergeben-und-versionen)
10. [Fehlerbehebung](#10-fehlerbehebung)
11. [Checkliste](#11-checkliste)

## 1. So funktioniert es in zwei Minuten
```
du klickst einen Button        Panel baut eine Zeile           Mind antwortet
        │                             │                              │
        ▼                             ▼                              ▼
 [BESTELLEN · Espresso] ──►  [GAST · 08:05 · ORDER · Espresso]  ──►  Erzähltext ...
                                                                     ⏱ 08:07 · 📍 Tisch 4 · 12 € · Mood 3/5
                                                                                 │
                              HUD im Panel  ◄────────────────────────────────────┘
```
Zwischen Panel und Mind laufen zwei Dinge:
- **Zeilen von dir.** Jeder Button erzeugt eine Zeile, meist `[PRÄFIX · Zeit · ART · Detail] Text`. Das Mind liest sie als deinen Zug.
- **Eine Statuszeile vom Mind.** Das Mind beendet jede Antwort mit `⏱ HH:MM · 📍 Ort · …`. Das Panel liest sie und zeigt sie als HUD (Ort, Werte, Balken) und stellt die Uhr nach.

Ein Profil beschreibt beide Seiten: welche Buttons es gibt, welche Zeilen sie schreiben und wie die Statuszeile gelesen wird.
Die Erweiterung erkennt das Mind an seiner ID (oder am Seitentitel) und lädt das passende Profil automatisch.

Ein Mind kann auch mit reinen **Slash-Befehlen** (`/scene …`) gesteuert werden. Dann gibt es keine Klammern und keine Uhr, siehe [Rezept 7.8](#78-ein-mind-mit-slash-befehlen).

## 2. Schritt 1: das Gespräch zwischen Panel und Mind planen
Beantworte diese Fragen, bevor du JSON schreibst. Sie bestimmen das ganze Profil.

| Frage | Beispiel (Café) |
|---|---|
| Wer ist der Nutzer in der Geschichte, und was kann er tun? | Ein Gast: bestellen, reden, warten. |
| Was passiert dem Nutzer, ohne dass er es auslöst? | Geräusche, Verhalten des Personals. |
| Hat das Mind eine Spielzeit? | Ja, sie beginnt um 08:00. |
| Welche Werte sollen immer sichtbar sein? | Ort, Bargeld, Stimmung. |
| In welcher Sprache liest das Mind die Zeilen? | Englisch. |
| Welche „Arten“ von Zeilen gibt es? | ORDER, TALK, WAIT (deine), NOISE, STAFF (die der Welt). |

Faustregeln:
- **Arten sind Verben oder kurze Hauptwörter in Großbuchstaben** (ORDER, ASK, RADIO). Sie werden im Chat zu Farbbalken.
- **Zwei Präfixe:** eines für Zeilen vom Nutzer (`GAST`), eines für Ereignisse, die nicht vom Nutzer kommen (`CAFE`). Großbuchstaben, Ziffern, `_`, `-`, 2–21 Zeichen.
- **Die Statuszeile kurz halten.** Drei bis fünf Werte reichen. Jeder Wert braucht eine feste Schreibweise, die das Panel lesen kann, etwa `12 €` oder `Mood 3/5`.

## 3. Schritt 2: die Mind-ID finden
Öffne den Mind-Chat auf venice.ai. Die Adresse sieht so aus:

```
https://venice.ai/chat/minds/local/AbC12xY/9fk2lm
                                    └─────┘
                                   Mind-ID
```
Die Mind-ID ist der Teil hinter `/minds/local/`. Sie bleibt gleich, wenn du das Mind umbenennst. Notiere sie.
Ohne ID kann die Erweiterung auf den Seitentitel zurückgreifen (`titleMatch`), die ID ist aber verlässlicher.

## 4. Schritt 3: das Profil bauen (Tutorial „Café-Stammgast“)
Wir bauen ein kleines Profil für ein Café-Rollenspiel. Das fertige Ergebnis ist [`examples/cafe.de.profile.json`](examples/cafe.de.profile.json).
Du kannst auch im Panel unter *PROFILE → VORLAGE* ein lauffähiges Gerüst herunterladen und von dort starten.

Arbeite in einem Texteditor (nicht in einer Textverarbeitung) und speichere als `cafe.profile.json`. JSON-Regeln: doppelte Anführungszeichen, keine Kommas am Ende, keine Kommentare.

### 3.1 Identität und Erkennung
```json
{
  "id": "cafe",
  "name": "Café-Stammgast",
  "mindIds": ["AbC12xY"],
  "titleMatch": "Café",
  "defaultTime": "08:00",
  "prefixes": { "actor": "GUEST", "world": "CAFE" },
  "settingsLabels": { "actor": "Präfix Gast", "world": "Präfix Café" }
}
```
- `id`: dein Kurzname, klein geschrieben, unter deinen Profilen eindeutig.
- `mindIds`: die ID aus Schritt 2 (es dürfen mehrere sein). `titleMatch` ist der Rückfall.
- `prefixes`: die zwei Präfixe aus Schritt 1.

### 3.2 Optik
```json
"theme": {
  "fg": "#e8a76a", "dim": "#a8703a", "mut": "#8a7560", "line": "#4a3322", "bg": "#0e0a07", "bg2": "#171009",
  "deep": "#080503", "ink": "#1d1108", "warn": "#ffcc66", "err": "#ff5252", "txt": "#f3dcc2", "glow": "232,167,106"
},
"header": {
  "logo": "C A F É",
  "meta": [["ORT  ", "Eckcafé · ● OFFEN · SID {sid}"]],
  "prompt": "guest@cafe:~#"
}
```
Rollen der Farben: `fg` leuchtende Akzentfarbe, `dim` gedämpfter Akzent, `mut` Nebentext, `line` Rahmen, `bg` Seite, `bg2` Panel, `deep` Eingabefelder,
`ink` Text auf leuchtenden Buttons (sehr dunkel), `warn` Uhr, `err` Rot, `txt` Chat-Text (hell), `glow` = `fg` als `"r,g,b"`.
Wähle eine Akzentfarbe und leite den Rest ab: dunkle Hintergründe und ein heller `txt`, der zum Akzent passt. Mit jeder Farbwahl-Anwendung liest du `#hex` und RGB-Werte ab.

### 3.3 Farben der Ereignisse
```json
"eventKinds": { "ORDER": "#e8a76a", "TALK": "#6cc8ff", "WAIT": "#8a93a3", "STAFF": "#5fe0c4", "NOISE": "#ff8a5c" }
```
Jede Art, die als erster Teil nach der Uhrzeit vorkommt, braucht eine Farbe. Sonst bekommt sie `fg`.

### 3.4 Der erste Reiter: Buttons mit optionaler Notiz
```json
"tabs": [
  { "id": "order", "label": "BESTELLEN", "blocks": [
    { "type": "hint", "text": "Bestelle etwas. Mit Notiz, wenn du magst." },
    { "type": "field", "id": "note", "label": "Notiz (optional)", "placeholder": "Hafermilch, extra heiß", "clear": true },
    { "type": "grid", "cap": "GETRÄNKE",
      "items": ["Espresso", "Flat white", "Tea", "Hot chocolate"],
      "action": { "who": "actor", "parts": ["ORDER", "{item}"], "body": ["{field.note}"] } }
  ] }
]
```
Das passiert, wenn du „Hafermilch“ ins Notizfeld schreibst und **Flat white** klickst:

```
[GUEST · 08:00 · ORDER · Flat white] Hafermilch
```
- `parts` sind die Teile nach der Uhrzeit, getrennt durch `·`. `{item}` ist der Button-Text.
- `body` ist der Text hinter der Klammer. `{field.note}` ist das Feld mit der id `note` im selben Reiter.
- Ist die Notiz leer, entfällt das Segment: `[GUEST · 08:00 · ORDER · Flat white]`.
- `"clear": true` leert das Feld nach jedem Klick.

Einträge können auch Objekte mit getrenntem Button- und Chat-Text sein:
```json
"items": [{ "label": "Croissant", "text": "one croissant" }, { "label": "Toast", "text": "toast with jam" }],
"action": { "who": "actor", "parts": ["ORDER", "{item.label}"], "body": ["{item.text}", "– {field.note}"] }
```
**Croissant** mit der Notiz „extra Butter“ ergibt: `[GUEST · 08:00 · ORDER · Croissant] one croissant – extra Butter`.

### 3.5 Ein Formular für freien Text (`compose`)
```json
{ "id": "talk", "label": "REDEN", "blocks": [
  { "type": "compose", "kindLabel": "Art", "whoLabel": "An", "textLabel": "Text",
    "kinds": {
      "TALK": { "who": "Barista / Nachbar", "text": "Was sagst du?", "quick": ["Is this seat taken?", "Do you have a charger?"] }
    },
    "action": { "who": "actor", "parts": ["{kind}", "{who}"], "body": ["{text}"],
                "requires": [{ "need": "text", "msg": "Text fehlt." }] } }
] }
```
- Das Formular hat eine Art-Auswahl, ein „An“-Feld, ein Textfeld und Schnelltext-Buttons (`quick`).
- Mit „barista“ im Feld „An“ und „Is this seat taken?“ als Text entsteht `[GUEST · 08:00 · TALK · barista] Is this seat taken?`.
- `requires` verhindert eine leere Nachricht: Das Panel zeigt `msg` und reiht nichts ein.
- Die Platzhalter in einem compose-Block sind `{kind}`, `{who}` und `{text}`.

### 3.6 Dinge, die nicht vom Nutzer kommen
Ereignisse der Welt nutzen das **Welt-Präfix**. Weil `who` pro Aktion fest ist, gehören sie in einen eigenen Block:
```json
{ "id": "cafe", "label": "CAFÉ", "blocks": [
  { "type": "compose", "kindLabel": "Art", "whoLabel": "Quelle", "textLabel": "Text",
    "kinds": {
      "NOISE": { "who": "(optional)", "text": "Was passiert um dich herum?", "quick": ["The espresso machine hisses."] },
      "STAFF": { "who": "Barista", "text": "Was tut das Personal?", "quick": ["The barista wipes the counter."] }
    },
    "action": { "who": "world", "parts": ["{kind}", "{who}"], "body": ["{text}"],
                "requires": [{ "need": "text", "msg": "Text fehlt." }] } }
] }
```
Ergebnis: `[CAFE · 08:00 · NOISE] The espresso machine hisses.`

### 3.7 Zeit vergehen lassen
```json
{ "id": "time", "label": "ZEIT", "blocks": [
  { "type": "grid", "cap": "ZEIT VERGEHT",
    "items": [{ "label": "5 min", "m": 5 }, { "label": "30 min", "m": 30 }, { "label": "bis Mittag", "until": "12:00" }],
    "action": { "who": "actor", "parts": ["WAIT"], "body": ["{item.label}", "({until_minutes} min)"], "shift": true } }
] }
```
- `m` ist die Zahl der Minuten, `until` eine Uhrzeit. `shift: true` rückt die Panel-Uhr um diesen Betrag vor.
- `{until_minutes}` ist nur bei `until`-Einträgen gefüllt. „bis Mittag“ wird also zu `bis Mittag (240 min)`, „5 min“ bleibt `5 min`.

### 3.8 Die Statuszeile lesen (HUD)
Das Mind beendet seine Antworten zum Beispiel mit:
```
⏱ 08:07 · 📍 Tisch 4 · 12 € · Mood 3/5
```
So lernt das Panel sie zu lesen:
```json
"state": {
  "parts": [{ "key": "loc", "icon": "📍" }],
  "numbers": [{ "key": "cash", "regex": "(\\d{1,4})\\s*€", "icon": "💶", "unit": " €" }],
  "meters": [{ "key": "mood", "label": "STIMMUNG", "regex": "Mood\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 5 }]
},
"statusRight": "💶 {cash|—} €"
```
- `parts`: Text hinter einem Symbol (`📍 Tisch 4` ergibt `loc = Tisch 4`).
- `numbers`: ein regulärer Ausdruck, dessen erste Gruppe die Zahl ist (`12 €` ergibt `cash = 12`).
- `meters`: Gruppe 1 ist der Wert, Gruppe 2 das Maximum. Angezeigt als Balken: `STIMMUNG ▮▮▮▯▯ 3/5`.
- **In JSON wird jeder Backslash verdoppelt**: `\\d` in der Datei bedeutet `\d` für den regulären Ausdruck. Funktioniert eine Regex nicht, schau zuerst hier.
- `statusRight` ist die kleine Anzeige neben der Uhr. `{cash|—}` zeigt einen Strich, bis ein Wert bekannt ist.
- Die Panel-Uhr folgt dem Teil `⏱ HH:MM` automatisch.

### 3.9 Die Convention
```json
"convention": "Lines in square brackets starting with \"{hp}\" are the guest's actions: ORDER = ..., TALK = ..., WAIT = ... Lines starting with \"{wp}\" are things that happen in the café and do not come from the guest: NOISE = ..., STAFF = ... The time in each line is the current in-world time and never runs backwards. Free text below the lines is the guest speaking or acting. End every reply with one status line in this exact form: ⏱ HH:MM · 📍 table · 12 € · Mood 3/5"
```
Die Convention ist ein Text für das Mind (also in der Sprache des Minds). `{hp}` und `{wp}` werden zu deinen zwei Präfixen.
Das Panel fügt sie über *Einstellungen → KONVENTIONS-TEXT EINFÜGEN* in die Chatbox ein. Besser: in den System-Prompt des Minds kopieren (Schritt 4).

### 3.10 Die vollständige Datei
```json
{
  "id": "cafe",
  "name": "Café-Stammgast",
  "mindIds": [
    "YOUR-MIND-ID"
  ],
  "titleMatch": "Café",
  "defaultTime": "08:00",
  "prefixes": {
    "actor": "GUEST",
    "world": "CAFE"
  },
  "settingsLabels": {
    "actor": "Präfix Gast",
    "world": "Präfix Café"
  },
  "theme": {
    "fg": "#e8a76a",
    "dim": "#a8703a",
    "mut": "#8a7560",
    "line": "#4a3322",
    "bg": "#0e0a07",
    "bg2": "#171009",
    "deep": "#080503",
    "ink": "#1d1108",
    "warn": "#ffcc66",
    "err": "#ff5252",
    "txt": "#f3dcc2",
    "glow": "232,167,106"
  },
  "header": {
    "logo": "C A F É",
    "meta": [
      [
        "ORT  ",
        "Eckcafé · ● OFFEN · SID {sid}"
      ]
    ],
    "prompt": "guest@cafe:~#"
  },
  "eventKinds": {
    "ORDER": "#e8a76a",
    "TALK": "#6cc8ff",
    "WAIT": "#8a93a3",
    "STAFF": "#5fe0c4",
    "NOISE": "#ff8a5c"
  },
  "state": {
    "parts": [
      {
        "key": "loc",
        "icon": "📍"
      }
    ],
    "numbers": [
      {
        "key": "cash",
        "regex": "(\\d{1,4})\\s*€",
        "icon": "💶",
        "unit": " €"
      }
    ],
    "meters": [
      {
        "key": "mood",
        "label": "STIMMUNG",
        "regex": "Mood\\s*(\\d)\\s*\\/\\s*(\\d)",
        "max": 5
      }
    ]
  },
  "statusRight": "💶 {cash|—} €",
  "tabs": [
    {
      "id": "order",
      "label": "BESTELLEN",
      "blocks": [
        {
          "type": "hint",
          "text": "Bestelle etwas. Mit Notiz, wenn du magst."
        },
        {
          "type": "field",
          "id": "note",
          "label": "Notiz (optional)",
          "placeholder": "Hafermilch, extra heiß",
          "clear": true
        },
        {
          "type": "grid",
          "cap": "GETRÄNKE",
          "items": [
            "Espresso",
            "Flat white",
            "Tea",
            "Hot chocolate"
          ],
          "action": {
            "who": "actor",
            "parts": [
              "ORDER",
              "{item}"
            ],
            "body": [
              "{field.note}"
            ]
          }
        },
        {
          "type": "grid",
          "cap": "ESSEN",
          "items": [
            {
              "label": "Croissant",
              "text": "one croissant"
            },
            {
              "label": "Toast",
              "text": "toast with jam"
            }
          ],
          "action": {
            "who": "actor",
            "parts": [
              "ORDER",
              "{item.label}"
            ],
            "body": [
              "{item.text}",
              "– {field.note}"
            ]
          }
        }
      ]
    },
    {
      "id": "talk",
      "label": "REDEN",
      "blocks": [
        {
          "type": "compose",
          "kindLabel": "Art",
          "whoLabel": "An",
          "textLabel": "Text",
          "kinds": {
            "TALK": {
              "who": "Barista / Nachbar",
              "text": "Was sagst du?",
              "quick": [
                "Is this seat taken?",
                "Do you have a charger?"
              ]
            }
          },
          "action": {
            "who": "actor",
            "parts": [
              "{kind}",
              "{who}"
            ],
            "body": [
              "{text}"
            ],
            "requires": [
              {
                "need": "text",
                "msg": "Text fehlt."
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cafe",
      "label": "CAFÉ",
      "blocks": [
        {
          "type": "hint",
          "text": "Dinge, die um den Gast herum passieren und nicht vom Gast kommen."
        },
        {
          "type": "compose",
          "kindLabel": "Art",
          "whoLabel": "Quelle",
          "textLabel": "Text",
          "kinds": {
            "NOISE": {
              "who": "(optional)",
              "text": "Was passiert um dich herum?",
              "quick": [
                "The espresso machine hisses.",
                "A tram rattles past."
              ]
            },
            "STAFF": {
              "who": "Barista",
              "text": "Was tut das Personal?",
              "quick": [
                "The barista wipes the counter.",
                "Someone turns the music up."
              ]
            }
          },
          "action": {
            "who": "world",
            "parts": [
              "{kind}",
              "{who}"
            ],
            "body": [
              "{text}"
            ],
            "requires": [
              {
                "need": "text",
                "msg": "Text fehlt."
              }
            ]
          }
        }
      ]
    },
    {
      "id": "time",
      "label": "ZEIT",
      "blocks": [
        {
          "type": "grid",
          "cap": "ZEIT VERGEHT",
          "items": [
            {
              "label": "5 min",
              "m": 5
            },
            {
              "label": "30 min",
              "m": 30
            },
            {
              "label": "bis Mittag",
              "until": "12:00"
            }
          ],
          "action": {
            "who": "actor",
            "parts": [
              "WAIT"
            ],
            "body": [
              "{item.label}",
              "({until_minutes} min)"
            ],
            "shift": true
          }
        }
      ]
    }
  ],
  "convention": "Lines in square brackets starting with \"{hp}\" are the guest's actions: ORDER = something ordered from the counter, TALK = something the guest says, WAIT = time passes while the guest sits. Lines starting with \"{wp}\" are things that happen in the café and do not come from the guest: NOISE = sounds and small events, STAFF = what the staff do. The time in each line is the current in-world time and never runs backwards. Free text below the lines is the guest speaking or acting. End every reply with one status line in this exact form: ⏱ HH:MM · 📍 table · 12 € · Mood 3/5"
}
```

## 5. Schritt 4: dem Mind das Format beibringen
Das Panel schreibt nur Zeilen. Das Mind muss sie verstehen. Füge einen Block wie diesen in den **System-Prompt** deines Minds ein
(eine anpassbare Fassung der `convention` aus dem Profil):

```text
# PANEL LINES
The user controls the scene with lines in square brackets: [GUEST · HH:MM · KIND · detail] text.
- ORDER = the guest orders something. TALK = the guest says something. WAIT = time passes while the guest sits.
- Lines starting with CAFE are events that do not come from the guest: NOISE = sounds, STAFF = what the staff do.
- The time in each line is the current in-world time. Never let it run backwards.
- Free text below the lines is the guest speaking or acting.
- Never write the guest's actions, words or thoughts.

# STATUS LINE
End EVERY reply with exactly one last line in this form, nothing after it:
⏱ HH:MM · 📍 place · 12 € · Mood 3/5
HH:MM is the in-world time after your reply. Keep the symbols, the order and the spelling ("Mood 3/5").
```
Zwei Details entscheiden, ob das HUD funktioniert:
- Das Mind muss die Statuszeile **immer** schreiben, als **letzte** Zeile und in **genau der Schreibweise**, die deine regulären Ausdrücke erwarten.
- Änderst du im Profil eine Schreibweise (etwa `Mood` zu `Stimmung`), ändere sie im Prompt mit.

## 6. Schritt 5: importieren und testen
1. Panel öffnen (Erweiterungs-Symbol) und **PROFILE** aufklappen.
2. **IMPORTIEREN (.json)** klicken und die Datei wählen. Bei Erfolg steht dort `Importiert: Café-Stammgast`, das Profil erscheint in der Liste mit „eigenes“.
3. Den Mind-Chat öffnen. Die Mind-Leiste oben im Panel zeigt das Profil und woran es erkannt wurde (Mind-ID oder Titel).

Schlägt der Import fehl, nennt die Meldung das Feld:

| Meldung | Abhilfe |
|---|---|
| `Keine gültige JSON-Datei: …` | Ein Komma, Anführungszeichen oder eine Klammer stimmt nicht. Datei in einen JSON-Validator einfügen, der zeigt die Zeile. |
| `id: 2–32 Zeichen …` | Kleinbuchstaben, Ziffern, `_` und `-` verwenden. |
| `prefixes.actor: Großbuchstaben …` | Nur Großbuchstaben: `GUEST`, nicht `Guest`. |
| `theme.fg: Farbe wie #7fb4ff` | `#` und Hex-Ziffern verwenden. Alle 11 Farben und `glow` („r,g,b“) sind Pflicht. |
| `state.numbers[0].regex ungültig` | Eine Klammer im regulären Ausdruck ist offen oder ein Backslash ist nicht verdoppelt. |
| `tabs[1].blocks[0]: type muss …` | Block-Typ auf Tippfehler prüfen. |
| `id "ghostline" ist von einem eingebauten Profil belegt` | Andere id wählen. |

**Manueller Test, fünf Minuten:**
1. Einen Button pro Reiter klicken und die Zeilen in der Warteschlange mit deinem Plan vergleichen.
2. Senden. Antwortet das Mind in der Rolle und endet mit der Statuszeile?
3. Zeigt das HUD Ort, Werte und Balken? Bewegt sich die Uhr?
4. Ein Pflichtfeld leer lassen. Erscheint deine `msg`?
5. Zu einem anderen Mind-Tab wechseln und zurück. Wechselt das Panel das Profil?

## 7. Rezepte
### 7.0 Mehrere Sprachen in einem Profil
Jeder Text kann in mehreren Sprachen angegeben werden. Statt eines Strings ein Objekt mit `en` (Pflicht, ist der Rückfall) schreiben:

```json
{ "id": "order", "label": { "en": "ORDER", "de": "BESTELLEN" }, "blocks": [] }
```

Das Panel zeigt den Text in der gewählten Oberflächensprache. Das gilt auch für Button-Texte: der gesendete Text folgt der Oberflächensprache. Die *Ereignis-Arten* (das erste `parts`, z. B. `"ORDER"`) als einfache Strings lassen, weil dein Mind-Prompt sich darauf bezieht. Details: [PROFILE-FORMAT.de.md](PROFILE-FORMAT.de.md#mehrsprachige-texte).

### 7.1 Optionaler Parameter
Ein Feld plus ein Segment, das davon abhängt. Ist das Feld leer, entfällt das Segment:
`"body": ["{item}", "– {field.ziel}"]`

### 7.2 Pflichtparameter
`requires` ergänzen:
`"requires": [{ "need": "field.ziel", "msg": "Ziel fehlt." }]`

### 7.3 Auswahlliste statt freiem Text
```json
{ "type": "field", "id": "mode", "label": "Vorgehen", "kind": "select",
  "options": [{ "value": "", "label": "normal" }, { "value": "quietly", "label": "leise" }, { "value": "loudly", "label": "laut" }] }
```
`"({field.mode})"` als body-Segment verwenden. Bei der leeren Option entfällt das Segment.

### 7.4 Zwei Felder nebeneinander
```json
{ "type": "row", "fields": [ { "id": "a", "label": "Erstes" }, { "id": "b", "label": "Zweites" } ] }
```

### 7.5 Schnell-Buttons mit anderem Button- und Chat-Text
`items`: `{ "label": "Go", "text": "GO. Green light." }`, dann `{item.label}` und `{item.text}`.

### 7.6 Eine Art auslassen (für „freie“ Einträge)
In einem compose-Block soll eine Art wie `Frei` nicht in der Zeile stehen:
`"omitKinds": ["Frei"]`. Der Teil `{kind}` entfällt dann.

### 7.7 Einsätze mit festem Ort, Datum und Wetter
`scenarios` ergänzen (items, fields, template) und einen Reiter mit `{ "type": "scenarios" }`. Siehe [PROFILE-FORMAT.de.md](PROFILE-FORMAT.de.md#szenarien-optional)
und [`examples/noir.profile.json`](examples/noir.profile.json). Szenario-Werte haben keinen Schlusspunkt, das Template setzt ihn selbst.

### 7.8 Ein Mind mit Slash-Befehlen
Versteht dein Mind Befehle wie `/scene` oder `/tone`, schreibst du mit `"format": "raw"` reinen Text ohne Klammern:
```json
"action": { "format": "raw", "parts": ["{item.cmd}"], "body": ["{field.text}"],
            "requires": [{ "need": "field.text", "msg": "Text fehlt." }] }
```
`"clock": false` auf oberster Ebene blendet Uhr und Zeitknöpfe aus, wenn das Mind keine Spielzeit hat. Eine `convention` ist dann optional.
Vollständiges Beispiel: [`examples/slash-commands.profile.json`](examples/slash-commands.profile.json).

### 7.9 Mehrzeilige Nachrichten
Ein body-Segment darf `\n` enthalten: `"body": ["\n{field.history}\n/end"]`.

## 8. Gestaltungstipps
- **Arten so benennen, dass das Mind sie nicht missversteht.** `ORDER` ist klarer als `DO`. Erkläre jede Art in der Convention in einem Satz.
- **Die 6–16 häufigsten Aktionen auf Buttons legen**, seltene als freien Text. Buttons mit Überschriften (`cap`) gruppieren.
- **Eine Idee pro Reiter.** Drei bis sieben Reiter, Namen in Großbuchstaben und kurz.
- **Farben:** starker Kontrast zwischen `bg` und `txt`, verwandte Arten bekommen verwandte Farben (Gefahr rot, Eingriffe amber, Warten grau).
- **Chat-Texte in der Sprache des Minds, Panel-Texte in deiner.** Button-Beschriftungen sind für dich, `text` und `body` für das Mind.
- **Regeln nicht im Profil verstecken.** Was das Mind wissen muss (Schreibweise der Statuszeile, Bedeutung der Arten), gehört in seinen Prompt.
- **Präfixe stabil halten.** Änderst du sie im Profil, aktualisiere den Mind-Prompt und alte Chats.

## 9. Weitergeben und Versionen
- Exportiere dein Profil im Panel mit dem ⭳-Button daneben. Die Datei ist genau das, was du importiert hast.
- Dieselbe `id` erneut zu importieren **ersetzt** dein Profil. Bewahre die Datei in einer Versionsverwaltung auf oder einfach mit Datum im Dateinamen.
- Profile enthalten keinen Code, das Weitergeben ist daher auch für Leser sicher. Lies trotzdem ein fremdes Profil, bevor du es benutzt: Seine Texte gehen an dein Mind.
- Keine privaten Daten in Profile legen, die du teilst (Namen, Szenario-Details).
- Ein Beispiel für dieses Repository legst du als Datei in `examples/` ab und öffnest einen Pull Request.

## 10. Fehlerbehebung
| Problem | Ursache und Abhilfe |
|---|---|
| Panel sagt „Unbekanntes Mind“ | ID oder Titel passen nicht. Im Panel *Zuordnen* nutzen oder `mindIds` korrigieren. |
| Das Panel zeigt das falsche Profil | Ein anderes Profil beansprucht dieselbe ID oder denselben Titel. Manuelle Zuordnung in den Einstellungen entfernen oder `titleMatch` anpassen. |
| Buttons erzeugen nichts | Ein `requires` ist nicht erfüllt. Das Panel zeigt `msg` unter der Warteschlange. |
| Zeile sieht anders aus als erwartet | Ein leerer Platzhalter lässt sein Segment weg. `parts`, `body` und Feld-ids prüfen. |
| Balken erscheinen nicht im Chat | Das Präfix ist nicht in Großbuchstaben, oder die Art hat keine Farbe (dann `fg`), oder *Event-Zeilen formatieren* ist aus. |
| HUD bleibt leer | Das Mind hat die Statuszeile nicht geschrieben, oder ihre Schreibweise passt nicht zu deinem regulären Ausdruck. |
| Uhr folgt dem Mind nicht | Die Statuszeile beginnt nicht mit `⏱ HH:MM`. |
| Leere Sprechblasen | Eine andere Erweiterung bearbeitet dieselbe Seite. Ausschalten. |

## 11. Checkliste
- [ ] `id`, `name`, `mindIds` (und `titleMatch`), zwei Präfixe in Großbuchstaben.
- [ ] Alle 11 Farben und `glow`.
- [ ] Jeder erste Teil einer Aktion steht in `eventKinds`.
- [ ] Jedes `{field.x}` hat ein Feld `x` im selben Reiter.
- [ ] Reguläre Ausdrücke haben verdoppelte Backslashes und passen zur Statuszeile des Minds.
- [ ] `convention` oder Mind-Prompt beschreibt jede Art und die Statuszeile genau.
- [ ] Import klappt, ein Klick pro Reiter erzeugt die erwartete Zeile.
- [ ] Das Mind beendet jede Antwort mit der Statuszeile, und das HUD zeigt sie.
