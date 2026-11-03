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
| `mindIds` | yes* | Mind IDs from the URL `.../minds/local/<ID>/...`. |
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

## Safety
- Imported files are checked (colours, names, regular expressions, structure) and only inserted as text.
- There is no `eval`, no loading of scripts and no network access from profiles.
