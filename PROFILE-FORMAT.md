# Profile format

German version: [PROFILE-FORMAT.de.md](PROFILE-FORMAT.de.md) · Step-by-step guide: [AUTHOR-GUIDE.md](AUTHOR-GUIDE.md)

A profile describes a mind as **plain data (JSON)**. It contains no code and runs none.
Upload it: panel → *PROFILE* (profiles) → *IMPORTIEREN (.json)* (import). A ready template is available in the panel under *VORLAGE* (template),
and built-in profiles can be exported there with ⭳ as examples. More examples are in [`examples/`](examples/).

If you do not want to write a profile by hand: *PROMPT FÜR PROFIL-GENERATOR KOPIEREN (EN)* (copy profile generator prompt), paste it into a chat,
describe the mind and save the answer as a `.json` file.

> The panel interface itself is in German. Profile texts (labels, hints, button names) can be in any language.

## Fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | 2-32 characters: a-z, 0-9, `_`, `-`. Built-in ids (`nightingale`, `ghostline`) are taken. Importing the same id replaces your own profile. |
| `name` | yes | Display name. |
| `mindIds` | yes* | Mind IDs from the URL `.../minds/local/<ID>/...` or `.../minds/<name-123>/<chat>` (catalog Minds). Pasting the whole URL also works. |
| `titleMatch` | yes* | Regular expression for the page title (fallback). *One of the two is enough. |
| `defaultTime` | no | Start time `HH:MM`. |
| `prefixes` | yes | `actor` (the user's lines) and `world` (events), e.g. `NIGHTINGALE` / `DESK`. Only capital letters, digits, `_`, `-`, 2-21 characters, starting with a letter. Otherwise the chat does not recognise the lines. |
| `settingsLabels` | no | Labels of the prefix fields in the settings. |
| `theme` | yes | Colours `fg dim mut line bg bg2 deep ink warn err txt` as `#hex`, `glow` as `"r,g,b"`. |
| `header` | yes | `logo` (ASCII, `\n` for line breaks), `meta` (list of `[key, text]`, `{sid}` and `{lat}` are placeholders, `●` blinks), `prompt`. |
| `eventKinds` | no | Kind -> colour of the event bars in the chat, e.g. `{ "ORDER": "#ffb000" }`. Unknown kinds get `fg`. |
| `state` | no | How the status line `⏱ HH:MM · ...` is read (see below). |
| `statusRight` | no | Template for the display next to the clock, e.g. `"📶 {signal\|—}"`. |
| `tabs` | yes | Tabs with blocks (see below). |
| `scenarios` | no | Missions (see below). |
| `convention` | no | Text that explains the line formats to the mind (button in the settings). `{hp}` and `{wp}` are replaced by the prefixes. Without `convention` the button is hidden. |
| `clock` | no | `false` hides the clock, the time buttons and "advance clock after sending" (for minds without in-world time). |

## Event lines in the chat
The panel writes `[PREFIX · HH:MM · PART1 · PART2] text`. The content script recognises them by a
prefix in capital letters and turns them into bars. `PART1` is the "kind" and decides the colour.

## Status line (`state`)
The mind ends every reply with `⏱ HH:MM · 📍 place · ...`. Read from it:

- `parts`: list of `{ "key": "loc", "icon": "📍" }`. The text after the symbol is taken over.
- `numbers`: `{ "key": "battery", "regex": "(\\d{1,3})\\s*%", "icon": "🔋", "unit": " %" }`. Group 1 is the value.
- `meters`: `{ "key": "risk", "label": "RISK", "regex": "Risk\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 4 }`. Group 1 is the value, group 2 the maximum.

Regular expressions are JSON strings, so backslashes are doubled.

## Tabs and blocks
A tab has `id`, `label` and `blocks`. Block types:

- `{"type":"hint","text":"..."}`
- `{"type":"field","id":"target","label":"...","placeholder":"...","clear":true,"kind":"input|textarea|select","options":[{"value":"","label":""}]}`
  `clear` empties the field after every click in the tab.
- `{"type":"row","fields":[field, field]}` two fields side by side.
- `{"type":"grid","cap":"HEADING","items":[...],"action":ACTION}` one button per item. Items are text or
  `{ "label": "", "text": "", "m": 5, "until": "06:00" }` (`m` minutes, `until` up to a time of day).
- `{"type":"compose","kindLabel":"","whoLabel":"","textLabel":"","kinds":{"KIND":{"who":"placeholder","text":"placeholder","quick":["..."]}},"action":ACTION}`
  A form with kind, sender, content and quick texts.
- `{"type":"scenarios"}` shows the mission list (only together with `scenarios`).

## ACTION
```json
{
  "who": "actor",
  "parts": ["ACCESS", "{item}"],
  "body": ["{item.text}", "- {field.target}"],
  "requires": [{ "need": "field.target", "msg": "Target is missing." }],
  "requiresAny": { "need": ["text", "who"], "msg": "Content is missing." },
  "omitKinds": ["Free"],
  "shift": true
}
```
- `who`: `actor` or `world` (which prefix the line gets).
- `format`: `"raw"` writes plain text without `[PREFIX · time ...]`, e.g. `/scene text` for minds steered with slash commands. Then `parts` are the words before the text (joined with spaces) and `who` is not needed. A segment may contain `\n`.
- `parts`: the parts after the time, separated by `·`.
- `body`: segments of the text, joined with spaces.
- A segment or part is dropped if a placeholder in it is empty. `{x|fallback}` provides a fallback value.
- `requires` / `requiresAny`: mandatory inputs. If something is missing, `msg` is shown and nothing is queued.
- `omitKinds`: kinds for which `{kind}` stays empty.
- `shift`: advances the clock by `m` minutes (or until `until`). The placeholder `{until_minutes}` is only filled for `until`.

Placeholders: `{item}`, `{item.text}`, `{item.label}`, `{field.<id>}` (fields of the tab), `{kind}`, `{who}`, `{text}` (compose), `{until_minutes}`.

## Scenarios (optional)
```json
"scenarios": {
  "items": [{ "title": "...", "city": "...", "time": "22:10", "place": "..." }],
  "fields": [{ "key": "title", "label": "Title", "ph": "...", "required": true },
             { "key": "time", "label": "Time", "half": true }],
  "twist": true,
  "template": {
    "segments": ["Place: {place}.", "Mission: {mission}"],
    "complication": { "choose": "Complication: your choice, intensity {level}, keep it secret.",
                      "none": "Complication: none planned.", "spoiler": "Complication: {twist}" },
    "closing": "Open with the character already in position."
  }
}
```
Each scenario is an object with the `key`s from `fields`. `{level}` is the intensity (`light`, `medium`, `hard`),
`{twist}` the suggestion from the scenario's `twist` field. Values have no final full stop, because the template adds it.
The panel sends `[WORLD · HH:MM · SCENARIO · Title] ...`. Show the list with a tab that contains `{"type":"scenarios"}`.

## Rules in the panel (v1.2)
Several optional parts move game rules out of the Mind and into the panel. All are optional and combine with each other.

### Dice (`roll` in an ACTION)
```json
"roll": { "dice": "d20", "mod": 2, "vs": "{item.vs}", "label": "{item.label}" }
```
- `dice`: `d20`, `2d6+1` (1–20 dice, 2–1000 sides). `mod` adds a modifier, `vs` is an optional target value. All three may use placeholders such as `{item.dice|d20}`.
- Fills `{roll.total}`, `{roll.vs}`, `{roll.outcome}` (`SUCCESS` or `FAILURE`, changeable with `success` and `failure`), `{roll.label}`, `{roll.dice}`, `{roll.rolls}` and `{roll.text}` (for example `14 vs 12 · SUCCESS`).
- Typical use: `"parts": ["ROLL", "{roll.label}", "{roll.text}"]` gives `[PREFIX · 21:40 · ROLL · Stealth · 14 vs 12 · SUCCESS]`.
- The panel lists the last rolls (*ROLLS*). A *Dice seed* in the settings makes rolls repeatable.
- Explain `ROLL` lines in the `convention` text so the Mind respects the result.

### Random tables (`tables` and `table` in an ACTION)
```json
"tables": { "weather": { "label": "Weather", "entries": ["Rain", { "text": "Storm", "weight": 3 }] } }
```
An action with `"table": "weather"` picks one entry (`weight` defaults to 1) and fills `{table}`. A shorter form is a plain list: `"weather": ["Rain", "Fog"]`.

### Scheduled events (`events`)
```json
"events": [
  { "id": "sms1", "at": "22:00", "kind": "SMS", "who": "Mara", "text": "Are you coming?" },
  { "id": "rain", "in": 60, "kind": "WEATHER", "text": "Rain starts." }
]
```
- Exactly one of `at` (clock time) or `in` (minutes after the clock when the events were started; *RESTART EVENTS* resets it). `daily: true` repeats the event every day.
- When the in-world clock passes the time (time buttons, *send*, or the clock taken from the status line), the event is **queued** as a `WORLD` line with its own time. It is never sent by itself.
- Typing the clock by hand and jumps of more than 18 hours do not trigger events. The panel lists pending events with *NOW* and skip.
- `kind` stays a plain string (protocol), `text` may be translated.

### Game state (`variables`)
```json
"variables": {
  "hp":    { "label": "HP", "value": 8, "min": 0, "max": 10, "icon": "❤" },
  "gold":  { "label": "Gold", "value": 60, "min": 0 },
  "items": { "type": "list", "label": "Pack", "value": ["rope"] }
}
```
- Types: `number` (default, optional `min`, `max`) and `list` (strings). Names: `hp`, `money`, `itemList` (letters, digits, `_`).
- An ACTION changes them with `set`, `add` (numbers) and `push`, `remove` (lists). Values may use placeholders, for example `"add": { "gold": "-{item.price}" }`, `"push": { "items": "{item.thing}" }`.
- A change that would go below `min` or above `max` is blocked with a message and nothing is queued. Removing something that is not in the list is blocked as well.
- Changes happen when the action is queued; removing the line from the queue does not undo them (edit the value in the *GAME STATE* box).
- Every message gets a state line at the end, for example `[WORLD · 21:40 · STATE] HP 8/10 · Gold 60 · Pack: rope`. `stateLine` replaces it with your own template (`{hp}`, `{hpMax}`, `{items}`); it can be switched off in the box.
- The values show in the HUD, take part in `when` conditions, and are part of saves and the session export.
- The convention text should say that the `STATE` line is authoritative.

### Buttons from lists (`itemsFrom`)
```json
{ "type": "grid", "cap": "USE", "itemsFrom": "items", "empty": "(the pack is empty)",
  "action": { "who": "actor", "parts": ["USE"], "body": ["{item}"], "remove": { "items": "{item}" } } }
```
- `itemsFrom` names a list variable or a list read from the status line. One button per entry, rebuilt when the list changes. `items` and `itemsFrom` can be combined; `empty` is shown when there are no buttons.
- Lists from the status line: `state.lists`: `{ "key": "seen", "regex": "Seen:\\s*([^·\\n]+)", "sep": "," }`. Group 1 is split at `sep` (default `,`).
- `when` accepts `{ "key": "items", "has": "key" }` for lists (and text that contains a word).

## Conditions (`when`)
Tabs, blocks and grid items (objects) may have a `when` condition. It is checked against the last status line (the HUD values), so
buttons only appear when they make sense:

```json
{ "label": "Heal", "when": { "key": "hp", "lt": 50 } }
{ "type": "grid", "when": { "all": [ { "key": "loc", "match": "bar" }, { "not": { "key": "alarm", "gt": 2 } } ] }, ... }
```

- `key` is a state key (a `parts`, `numbers`, `meters` or `lists` key from `state`, plus `time`; meters also have `<key>Max`) or a variable from `variables`. Variables always count, and take precedence over a status line key with the same name.
- Exactly one operator per condition: `eq`, `ne`, `lt`, `lte`, `gt`, `gte` (numbers or text), `match` (regular expression), `has` (list contains a value, or text contains a word), `exists` (`true`/`false`).
- Combine with `all` (and), `any` (or) and `not`.
- Until the first status line has been read, everything is shown. A missing value makes the condition false (except `exists: false`).
- If the open tab gets hidden, the panel switches to the first visible tab.

## Relay (`relay`, optional)
With two Mind tabs open, the panel can copy the last reply of one Mind into the chat box of the other (*RELAY BETWEEN TWO MINDS*).
The line is built with the **receiving** profile:

```json
"relay": { "kind": "DIALOGUE", "who": "world" }
```

- `kind`: event kind of the line (capital letters), default `RELAY`.
- `who`: `"world"` (default) or `"actor"`, which prefix of the receiving profile is used.
- Result: `[PREFIX · HH:MM · KIND · Name of the sender] reply text`. The time is the clock of the receiving mind (or its `defaultTime`).
- Without `relay`, the defaults apply. Add the kind to `eventKinds` to colour it in the chat.

## Multilingual texts
Any text value in a profile may be an object instead of a string:

```json
"label": { "en": "Target", "de": "Ziel" }
```

- `en` is required and is the fallback if the selected language is missing. Other keys are two-letter language codes (`de`, `fr`, …).
- The panel resolves these objects for its interface language before use. This works for tab labels, hints, field labels and placeholders, grid captions and items (the sent text follows the interface language), compose labels, `settingsLabels`, `header.meta`, scenario titles and fields, and `convention`.
- A plain string is valid everywhere and is shown in every language.
- Do **not** translate the event kinds (`parts`, `eventKinds` keys, the keys of `kinds`) or `prefixes`: they are the protocol your mind prompt knows. To show another name for a `compose` kind, add `"label": { "en": "...", "de": "..." }` to that kind; the original key is still what is sent.
- Exporting a profile keeps all languages.

## Safety
- Imported files are checked (colours, names, regular expressions, structure) and only inserted as text.
- There is no `eval`, no loading of scripts and no network access from profiles.
