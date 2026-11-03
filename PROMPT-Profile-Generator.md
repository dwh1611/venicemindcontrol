# Prompt: generate a profile JSON for Mind Console

How to use: copy the text between the two markers (or click *PROMPT FÜR PROFIL-GENERATOR KOPIEREN (EN)* in the panel under *PROFILE*),
paste it into a **normal chat** (not into the roleplay mind itself), fill in the "MY MIND" section at the bottom and send.
Save the answer as a `.json` file and import it in the panel.

Tip: the mind ID is in the URL: `venice.ai/chat/minds/local/<MIND-ID>/<chat>`.
German version: [PROMPT-Profile-Generator.de.md](PROMPT-Profile-Generator.de.md)

<!-- PROMPT START -->
You generate a profile as JSON for the browser extension "Mind Console". The extension shows a control panel with buttons next to a Venice chat. One click inserts a line such as `[PREFIX · 21:40 · KIND · PART] text` into the chatbox. The roleplay mind reads these lines and answers with a status line that the panel reads back.

# OUTPUT
- Reply with exactly one JSON object in a single code block (```json). No comments in the JSON, no trailing commas, no functions.
- After it, at most three short notes (for example "mind ID missing, please add it to mindIds"). Nothing before it.
- If something is missing, choose a sensible solution and mention it afterwards. Ask a question only if the description below is missing entirely.

# LANGUAGES
- Everything the panel displays (label, cap, hint, placeholder, header, settingsLabels): in the language I name under "MY MIND" (default: English).
- Everything that is written into the chat and read by the mind (parts, body, items[].text, quick, convention, scenarios template): in the language of the mind (see below).

# FORMAT
Required fields:
- "id": 2-32 characters, only a-z, 0-9, _ and -.
- "name": display name.
- "mindIds": list with the mind ID from the URL (at least 5 characters). "titleMatch" (part of the page title as a regular expression) is an optional fallback. One of the two must be present.
- "defaultTime": "HH:MM" (start of the in-world clock).
- "prefixes": {"actor": "...", "world": "..."}. Only capital letters, digits, _ and -, 2-21 characters, starting with a letter. "actor" marks the user's actions, "world" marks events that do not come from the user.
- "settingsLabels": {"actor": "Prefix ...", "world": "Prefix ..."}.
- "theme": colours as #hex for fg, dim, mut, line, bg, bg2, deep, ink, warn, err, txt. Plus "glow" as "r,g,b" (the colour of fg as numbers).
  fg = bright main colour, dim = softer, mut = secondary text, line = lines (dark), bg = page background (very dark), bg2 = panel surface (slightly lighter than bg), deep = input fields (even darker), ink = text on fg buttons (very dark), warn = yellow/orange for the clock and hints, err = red, txt = easily readable body text in the chat (light, matching fg).
- "header": {"logo": "ASCII logo, lines separated by \n", "meta": [["KEY", "Text"]], "prompt": "name@host:~#"}. In meta texts {sid} (random ID) and {lat} (number) are allowed, ● blinks.
- "eventKinds": kind -> colour (#hex). See below.
- "state": how the status line is read. See below.
- "statusRight": template next to the clock, for example "📶 {signal|—}" (values from state, the text after | is the fallback).
- "tabs": 3-7 tabs, structure below.
- "convention": text that explains the line formats to the mind. {hp} and {wp} are replaced by the prefixes. Optional: minds that already know their commands (for example slash commands) do not need one.
- "clock": false (optional) hides the clock and time buttons if the mind has no in-world time.
Optional: "scenarios" (see below).

# EVENT LINES
The panel produces `[PREFIX · HH:MM · PART1 · PART2 · ...] text`. PART1 is the "kind" and decides the colour of the bar in the chat. Add every kind that appears as the first part after the time to "eventKinds" (for actions the first entry of "parts", for compose blocks the names of the "kinds" if "{kind}" is the first part). Kinds are single words without spaces, at most 24 characters (for example ORDER, SMS, Device). Give similar kinds the same colour, critical ones red, interventions amber, watching grey.

# STATUS LINE ("state")
The mind ends every reply with a line like `⏱ HH:MM · 📍 place · ...`. The panel reads:
- "parts": [{"key": "loc", "icon": "📍"}] reads the text after the symbol (parts are separated by ·).
- "numbers": [{"key": "battery", "regex": "(\\d{1,3})\\s*%", "icon": "🔋", "unit": " %"}]. Group 1 of the regex is the value.
- "meters": [{"key": "risk", "label": "RISK", "regex": "Risk\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 4}]. Group 1 is the value, group 2 the maximum.
Regular expressions are JSON strings: always double the backslashes (\\d, \\s, \\/).
Important: describe the status line in "convention" exactly as the expressions read it (same symbols, same order, same spelling as "Risk 2/4").

# TABS AND BLOCKS
Each tab: {"id": "unique", "label": "CAPITALS", "blocks": [ ... ]}. Good tabs have 6-16 buttons that fit the user's role. Block types:
- {"type": "hint", "text": "..."}
- {"type": "field", "id": "target", "label": "...", "placeholder": "...", "clear": true, "kind": "input"}. kind: input (default), textarea or select (then "options": [{"value": "", "label": "normal"}, ...]). "clear": true empties the field after every click in the tab.
- {"type": "row", "fields": [field, field]} shows two fields side by side (fields without "type").
- {"type": "grid", "cap": "HEADING", "items": [ ... ], "action": ACTION}. One button per item. Items are text or {"label": "display", "text": "text for the chat", "m": 5, "until": "06:00"} ("m" = minutes, "until" = until a time of day).
- {"type": "compose", "kindLabel": "Kind", "whoLabel": "From", "textLabel": "Text", "kinds": {"SMS": {"who": "placeholder", "text": "placeholder", "quick": ["quick text", "..."]}}, "action": ACTION}. A form with kind, sender and content. The kinds are the keys of "kinds".
- {"type": "scenarios"} shows the scenario list, only together with "scenarios".

# ACTION
{
  "who": "actor" or "world",
  "parts": ["KIND", "{item}"],
  "body": ["{item.text}", "- {field.target}"],
  "requires": [{"need": "field.target", "msg": "Target is missing."}],
  "requiresAny": {"need": ["text", "who"], "msg": "Content is missing."},
  "omitKinds": ["Free"],
  "shift": true
}
- "who" decides which prefix the line gets. "parts" are the parts after the time (joined with ·). "body" are text segments (joined with spaces).
- A part or segment is dropped automatically if a placeholder in it is empty. "{x|fallback}" sets a fallback value.
- Placeholders: {item} (text or label), {item.text}, {item.label}, {field.<id>} (a field of the same tab, the id must exist there), {kind}, {who}, {text} (compose only), {until_minutes} (only for items with "until").
- "requires" and "requiresAny" are optional mandatory inputs. "need" names a placeholder without braces (for example "field.target" or "text"). If something is missing, "msg" is shown.
- "omitKinds": kinds for which {kind} stays empty (for example "Free").
- "format": "raw" writes plain text without the [PREFIX · time ...] brackets, for example "/scene text" (for minds steered with slash commands). Then "parts" are the words before the text and "who" is not needed. A segment may contain \n.
- "shift": true advances the in-world time by "m" minutes (or until "until"). Only useful for waiting and watching.
- Grid: placeholders {item...} and {field...}. Compose: {kind}, {who}, {text}.

# SCENARIOS (optional)
Only useful if the mind runs in self-contained missions or situations.
"scenarios": {
  "items": [ {"title": "...", "city": "...", "time": "22:10", "place": "...", ...} ],
  "fields": [ {"key": "title", "label": "Title", "ph": "...", "required": true}, {"key": "time", "label": "Time", "half": true}, {"key": "place", "label": "Place", "area": true, "required": true} ],
  "twist": true,
  "template": {
    "segments": ["Place: {place}.", "Mission: {mission}"],
    "complication": {"choose": "Complication: your choice, intensity {level}, keep it secret.", "none": "Complication: none planned.", "spoiler": "Complication: {twist}"},
    "closing": "Open with the character already in position."
  }
}
Scenario values have no final full stop, because the segments in the template add it themselves ("Place: {place}."). Each scenario contains the "key"s from "fields" (plus optionally "twist" and "city"). "half": true puts two fields side by side. "area": true makes a multi-line field. "template" is what the mind reads, in its language. {level} is light, medium or hard. The matching tab: {"id": "scenario", "label": "SCENARIOS", "blocks": [{"type": "scenarios"}]}.

# WRITING THE CONVENTION
One paragraph in the mind's language that explains:
1. Lines in square brackets starting with "{hp}" are the user's actions. Briefly explain each kind (the words from "parts").
2. Lines starting with "{wp}" are events that do not come from the user. Explain the kinds.
3. The time in each line is the current in-world time and never runs backwards.
4. Free text below the lines is direct speech or action of the user.
5. Every reply ends with the status line in exactly the format that "state" reads.
The convention must not contain curly braces other than {hp} and {wp}.

# CHECKLIST (go through it before answering)
- Valid JSON, one object, nothing besides the code block and at most three note lines.
- id matches the pattern. prefixes are capitals. All colours are #hex, glow is "r,g,b".
- Every "parts" kind of an action (and every compose kind name used as first part) is listed in "eventKinds".
- Every {field.x} points to a field with id x in the same tab. Every "need" is a valid placeholder.
- Tab ids are unique. Every tab has at least one block.
- Regular expressions have doubled backslashes and match the status line from "convention".
- Panel texts are in the requested language, chat texts in the mind's language.

# EXAMPLE (complete and valid)
```json
{
  "id": "noir",
  "name": "Noir",
  "mindIds": [
    "HIER-DIE-MIND-ID"
  ],
  "titleMatch": "Noir",
  "defaultTime": "23:10",
  "prefixes": {
    "actor": "DETECTIVE",
    "world": "CITY"
  },
  "settingsLabels": {
    "actor": "Prefix detective",
    "world": "Prefix city"
  },
  "theme": {
    "fg": "#e8b04a",
    "dim": "#a87b2a",
    "mut": "#8a7a5a",
    "line": "#4a3a1a",
    "bg": "#0b0905",
    "bg2": "#141008",
    "deep": "#070502",
    "ink": "#1a1204",
    "warn": "#ffb000",
    "err": "#ff5252",
    "txt": "#f1ddb2",
    "glow": "232,176,74"
  },
  "header": {
    "logo": "N O I R",
    "meta": [
      [
        "CASE ",
        "No. 417 · ● OPEN · SID {sid}"
      ]
    ],
    "prompt": "det@precinct:~#"
  },
  "eventKinds": {
    "ASK": "#e8b04a",
    "WATCH": "#ffb000",
    "RADIO": "#6cc8ff",
    "TIP": "#5fe0c4"
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
        "regex": "(\\d{1,5})\\s*\\$",
        "icon": "💵",
        "unit": " $"
      }
    ],
    "meters": [
      {
        "key": "heat",
        "label": "HEAT",
        "regex": "Heat\\s*(\\d)\\s*\\/\\s*(\\d)",
        "max": 4
      }
    ]
  },
  "statusRight": "💵 {cash|—} $",
  "tabs": [
    {
      "id": "ask",
      "label": "QUESTIONS",
      "blocks": [
        {
          "type": "hint",
          "text": "Who or what do you question?"
        },
        {
          "type": "field",
          "id": "target",
          "label": "Person / place",
          "placeholder": "Bartender, warehouse 9 …",
          "clear": true
        },
        {
          "type": "grid",
          "cap": "QUESTION",
          "items": [
            "Where were you last night?",
            "Do you know this man?",
            "Who pays you?"
          ],
          "action": {
            "who": "actor",
            "parts": [
              "ASK"
            ],
            "body": [
              "{item}",
              "→ {field.target}"
            ],
            "requires": [
              {
                "need": "field.target",
                "msg": "Whom do you question?"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "radio",
      "label": "RADIO",
      "blocks": [
        {
          "type": "compose",
          "kindLabel": "Kind",
          "whoLabel": "From",
          "textLabel": "Text",
          "kinds": {
            "RADIO": {
              "who": "Dispatch",
              "text": "What comes over the radio?",
              "quick": [
                "Suspect sighted.",
                "Backup is on the way."
              ]
            },
            "TIP": {
              "who": "Informant",
              "text": "What does he whisper?",
              "quick": [
                "Warehouse on the pier."
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
                "msg": "Text is missing."
              }
            ]
          }
        }
      ]
    },
    {
      "id": "wait",
      "label": "WAIT",
      "blocks": [
        {
          "type": "grid",
          "cap": "TIME PASSES",
          "items": [
            {
              "label": "10 min",
              "m": 10
            },
            {
              "label": "1 h",
              "m": 60
            },
            {
              "label": "until 06:00",
              "until": "06:00"
            }
          ],
          "action": {
            "who": "actor",
            "parts": [
              "WATCH"
            ],
            "body": [
              "{item.label}",
              "({until_minutes} min)"
            ],
            "shift": true
          }
        }
      ]
    },
    {
      "id": "scenario",
      "label": "CASES",
      "blocks": [
        {
          "type": "scenarios"
        }
      ]
    }
  ],
  "scenarios": {
    "items": [
      {
        "title": "Der Pier",
        "city": "Hafen",
        "time": "23:10",
        "place": "A foggy pier, warehouse 9 ahead",
        "mission": "Find out who is unloading crates"
      }
    ],
    "fields": [
      {
        "key": "title",
        "label": "Title",
        "ph": "The Pier",
        "required": true
      },
      {
        "key": "time",
        "label": "Time",
        "ph": "23:10"
      },
      {
        "key": "place",
        "label": "Place",
        "ph": "A foggy pier",
        "area": true,
        "required": true
      },
      {
        "key": "mission",
        "label": "Mission",
        "ph": "Find out who is unloading crates",
        "area": true
      }
    ],
    "twist": false,
    "template": {
      "segments": [
        "Place: {place}.",
        "Mission: {mission}"
      ],
      "complication": {
        "choose": "Complication: your choice, keep it hidden.",
        "none": "Complication: none.",
        "spoiler": "Complication: {twist}"
      },
      "closing": "Open with the detective already on the scene."
    }
  },
  "convention": "Lines in square brackets starting with \"{hp}\" are the detective's actions: ASK = a question put to a person, WATCH = time passes while the detective watches. Lines starting with \"{wp}\" are events that do not come from the detective: RADIO = a radio message, TIP = an informant's whisper. The time in each line is the current in-world time and never runs backwards. Free text below the lines is the detective speaking or acting. End every reply with one status line in this exact form: ⏱ HH:MM · 📍 location · 150 $ · Heat 2/4"
}
```

# MY MIND (fill in)
- Name of the mind:
- Mind ID (from the URL, if known):
- Language of the mind (chat texts):
- Language of the panel (labels):
- What is it about (role of the user, character, mood, world):
- What can the user do? (actions that should become buttons, preferably in groups):
- Which events come from outside? (messages, radio, technology, chance):
- Which values are in the status line? (place, battery, risk, injuries, money ...):
- Desired look (colours, style):
- Scenarios wanted? (yes/no, which):
<!-- PROMPT END -->
