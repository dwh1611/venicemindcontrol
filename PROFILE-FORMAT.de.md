# Profil-Format

English version: [PROFILE-FORMAT.md](PROFILE-FORMAT.md) · Schritt-für-Schritt-Anleitung: [AUTHOR-GUIDE.de.md](AUTHOR-GUIDE.de.md)

Ein Profil beschreibt ein Mind als **reine Daten (JSON)**. Es enthält keinen Code und führt keinen aus.
Hochladen: Panel → *PROFILE* → *IMPORTIEREN (.json)*. Eine fertige Vorlage gibt es im Panel unter *VORLAGE*,
eingebaute Profile lassen sich dort mit ⭳ als Beispiel exportieren.

Wer ein Profil nicht von Hand schreiben will: *PROMPT FÜR PROFIL-GENERATOR KOPIEREN*, in einen Chat einfügen,
das Mind beschreiben und die Antwort als `.json` speichern. Beispiele liegen in [`examples/`](examples/).

## Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | 2–32 Zeichen: a–z, 0–9, `_`, `-`. Eingebaute ids (`nightingale`, `ghostline`) sind belegt. Gleiche id beim Import ersetzt das eigene Profil. |
| `name` | ja | Anzeigename. |
| `mindIds` | ja* | Mind-IDs aus der URL `…/minds/local/<ID>/…`. |
| `titleMatch` | ja* | Regulärer Ausdruck für den Seitentitel (Rückfall). *Eines von beiden genügt. |
| `defaultTime` | nein | Startzeit `HH:MM`. |
| `prefixes` | ja | `actor` (Zeilen des Nutzers) und `world` (Ereignisse), z. B. `NIGHTINGALE` / `DESK`. Nur Großbuchstaben, Ziffern, `_`, `-`, 2–21 Zeichen, mit Buchstabe beginnend, sonst erkennt der Chat die Zeilen nicht. |
| `settingsLabels` | nein | Beschriftung der Präfix-Felder in den Einstellungen. |
| `theme` | ja | Farben `fg dim mut line bg bg2 deep ink warn err txt` als `#hex`, `glow` als `"r,g,b"`. |
| `header` | ja | `logo` (ASCII, `\n` für Zeilen), `meta` (Liste `[Schlüssel, Text]`, `{sid}` und `{lat}` sind Platzhalter, `●` blinkt), `prompt`. |
| `eventKinds` | nein | Art → Farbe der Event-Balken im Chat, z. B. `{ "ORDER": "#ffb000" }`. Unbekannte Arten bekommen `fg`. |
| `state` | nein | Wie die Statuszeile `⏱ HH:MM · …` gelesen wird (siehe unten). |
| `statusRight` | nein | Vorlage für die Anzeige neben der Uhr, z. B. `"📶 {signal\|—}"`. |
| `tabs` | ja | Reiter mit Blöcken (siehe unten). |
| `scenarios` | nein | Einsätze (siehe unten). |
| `convention` | nein | Text, der dem Mind die Zeilenformate erklärt (Button in den Einstellungen). `{hp}` und `{wp}` werden durch die Präfixe ersetzt. Ohne `convention` entfällt der Button. |
| `clock` | nein | `false` blendet Uhr, Zeitknöpfe und „Uhr nach Senden“ aus (für Minds ohne Spielzeit). |

## Event-Zeilen im Chat
Das Panel schreibt `[PRÄFIX · HH:MM · TEIL1 · TEIL2] Text`. Das Content-Script erkennt sie an
einem Präfix in Großbuchstaben und macht daraus Balken. `TEIL1` ist die „Art“ und bestimmt die Farbe.

## Statuszeile (`state`)
Das Mind beendet jede Antwort mit `⏱ HH:MM · 📍 Ort · …`. Daraus lesen:

- `parts`: Liste `{ "key": "loc", "icon": "📍" }`. Der Text hinter dem Symbol wird übernommen.
- `numbers`: `{ "key": "battery", "regex": "(\\d{1,3})\\s*%", "icon": "🔋", "unit": " %" }`. Gruppe 1 ist der Wert.
- `meters`: `{ "key": "risk", "label": "RISIKO", "regex": "Risiko\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 4 }`. Gruppe 1 ist der Wert, Gruppe 2 das Maximum.

Reguläre Ausdrücke sind JSON-Strings, also mit doppeltem Backslash.

## Reiter und Blöcke
Ein Reiter hat `id`, `label` und `blocks`. Block-Typen:

- `{"type":"hint","text":"…"}`
- `{"type":"field","id":"ziel","label":"…","placeholder":"…","clear":true,"kind":"input|textarea|select","options":[{"value":"","label":""}]}`
  `clear` leert das Feld nach jedem Klick im Reiter.
- `{"type":"row","fields":[Feld, Feld]}` zwei Felder nebeneinander.
- `{"type":"grid","cap":"ÜBERSCHRIFT","items":[…],"action":ACTION}` ein Button pro Eintrag. Einträge sind Text oder
  `{ "label": "", "text": "", "m": 5, "until": "06:00" }` (`m` Minuten, `until` bis zu einer Uhrzeit).
- `{"type":"compose","kindLabel":"","whoLabel":"","textLabel":"","kinds":{"ART":{"who":"Platzhalter","text":"Platzhalter","quick":["…"]}},"action":ACTION}`
  Formular mit Art, Absender, Inhalt und Schnelltexten.
- `{"type":"scenarios"}` zeigt die Einsatz-Auswahl (nur mit `scenarios`).

## ACTION
```json
{
  "who": "actor",
  "parts": ["ZUGRIFF", "{item}"],
  "body": ["{item.text}", "– {field.ziel}"],
  "requires": [{ "need": "field.ziel", "msg": "Ziel fehlt." }],
  "requiresAny": { "need": ["text", "who"], "msg": "Inhalt fehlt." },
  "omitKinds": ["Frei"],
  "shift": true
}
```
- `who`: `actor` oder `world` (welches Präfix die Zeile bekommt).
- `format`: `"raw"` schreibt reinen Text ohne `[PRÄFIX · Uhrzeit …]`, z. B. `/scene Text` für Minds, die mit Slash-Befehlen gesteuert werden. Dann sind `parts` die Wörter vor dem Text (mit Leerzeichen verbunden), `who` entfällt. Ein Segment darf `\n` enthalten.
- `parts`: die Teile hinter der Uhrzeit, getrennt durch `·`.
- `body`: Segmente des Textes, mit Leerzeichen verbunden.
- Ein Segment oder Teil entfällt, wenn ein Platzhalter darin leer ist. Mit `{x|Ersatz}` gibt es einen Ersatzwert.
- `requires` / `requiresAny`: Pflichtangaben. Fehlt etwas, erscheint `msg` und nichts wird eingereiht.
- `omitKinds`: Arten, bei denen `{kind}` leer bleibt.
- `shift`: rückt die Uhr um `m` Minuten (oder bis `until`) vor. Platzhalter `{until_minutes}` ist nur bei `until` gefüllt.

Platzhalter: `{item}`, `{item.text}`, `{item.label}`, `{field.<id>}` (Reiter-Felder), `{kind}`, `{who}`, `{text}` (compose), `{until_minutes}`.

## Szenarien (optional)
```json
"scenarios": {
  "items": [{ "title": "…", "city": "…", "time": "22:10", "place": "…" }],
  "fields": [{ "key": "title", "label": "Titel", "ph": "…", "required": true },
             { "key": "time", "label": "Uhrzeit", "half": true }],
  "twist": true,
  "template": {
    "segments": ["Place: {place}.", "Mission: {mission}"],
    "complication": { "choose": "Complication: your choice, intensity {level}, keep it secret.",
                      "none": "Complication: none planned.", "spoiler": "Complication: {twist}" },
    "closing": "Open with the character already in position."
  }
}
```
Jedes Szenario ist ein Objekt mit den `key`s aus `fields`. `{level}` ist die Härte (`light`, `medium`, `hard`),
`{twist}` der Vorschlag aus dem Feld `twist` des Szenarios. Das Panel sendet `[WELT · HH:MM · SCENARIO · Titel] …`.

## Mehrsprachige Texte
Jeder Textwert in einem Profil darf statt eines Strings ein Objekt sein:

```json
"label": { "en": "Target", "de": "Ziel" }
```

- `en` ist Pflicht und Rückfall, falls die gewählte Sprache fehlt. Weitere Schlüssel sind zweistellige Sprachcodes (`de`, `fr`, …).
- Das Panel löst diese Objekte für seine Oberflächensprache auf. Das gilt für Reiter-Namen, Hinweise, Feld-Beschriftungen und Platzhalter, Überschriften und Einträge von Grids (der gesendete Text folgt der Oberflächensprache), Compose-Beschriftungen, `settingsLabels`, `header.meta`, Szenario-Titel und -Felder sowie `convention`.
- Ein einfacher String ist überall gültig und wird in jeder Sprache angezeigt.
- Die Ereignis-Arten (`parts`, Schlüssel in `eventKinds`, Schlüssel in `kinds`) und `prefixes` **nicht** übersetzen: sie sind das Protokoll, das dein Mind-Prompt kennt. Um für eine `compose`-Art einen anderen Namen anzuzeigen, `"label": { "en": "...", "de": "..." }` an der Art ergänzen; gesendet wird weiter der ursprüngliche Schlüssel.
- Beim Export bleiben alle Sprachen erhalten.

## Sicherheit
- Importierte Dateien werden geprüft (Farben, Namen, reguläre Ausdrücke, Aufbau) und nur als Text angezeigt.
- Es gibt kein `eval`, keinen Nachladen von Skripten und keine Netzwerkzugriffe aus Profilen.
