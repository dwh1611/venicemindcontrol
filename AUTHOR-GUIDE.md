# Author guide: build your own profile

German version: [AUTHOR-GUIDE.de.md](AUTHOR-GUIDE.de.md) · Reference: [PROFILE-FORMAT.md](PROFILE-FORMAT.md)

This guide takes you from "I have a Venice mind" to "my own control panel for it", step by step. You do not need to program.
A profile is a text file in JSON format. If you would rather let a chat model write it,
use the [generator prompt](PROMPT-Profile-Generator.md), but read this guide first, so you can check and fix what comes back.

> The panel interface itself is in German. The profile texts (button names, hints, placeholders) can be in any language.

## Contents
1. [How it works in two minutes](#1-how-it-works-in-two-minutes)
2. [Step 1: plan the conversation between panel and mind](#2-step-1-plan-the-conversation-between-panel-and-mind)
3. [Step 2: find the mind ID](#3-step-2-find-the-mind-id)
4. [Step 3: build the profile (tutorial "Café Regular")](#4-step-3-build-the-profile-tutorial-caf%C3%A9-regular)
5. [Step 4: teach the mind the format](#5-step-4-teach-the-mind-the-format)
6. [Step 5: import and test](#6-step-5-import-and-test)
7. [Recipes](#7-recipes)
8. [Design tips](#8-design-tips)
9. [Sharing and versions](#9-sharing-and-versions)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist](#11-checklist)

## 1. How it works in two minutes
```
you click a button          panel builds a line            mind answers
       │                           │                            │
       ▼                           ▼                            ▼
 [ORDER · Espresso]  ──►  [GUEST · 08:05 · ORDER · Espresso]  ──►  story text ...
                                                                    ⏱ 08:07 · 📍 table 4 · 12 € · Mood 3/5
                                                                                │
                              HUD in the panel  ◄───────────────────────────────┘
```
Two things travel between panel and mind:
- **Lines from you.** Each button produces one line, usually `[PREFIX · time · KIND · detail] text`. The mind reads it as your move.
- **A status line from the mind.** The mind ends every reply with `⏱ HH:MM · 📍 place · ...`. The panel reads it and shows it as the HUD (place, values, meters) and updates the clock.

A profile describes both sides: which buttons exist, which lines they write, and how to read the status line.
The extension recognises the mind by its ID (or page title) and loads the matching profile automatically.

Alternatively a mind can be steered with plain **slash commands** (`/scene ...`). Then there are no brackets and no clock; see [recipe 7.8](#78-a-mind-steered-by-slash-commands).

## 2. Step 1: plan the conversation between panel and mind
Answer these questions before you write any JSON. They determine the whole profile.

| Question | Example (café) |
|---|---|
| Who is the user in the story, and what can they do? | A guest: order, talk, wait. |
| Which things happen to the user that they do not cause? | Noises, staff behaviour. |
| Does the mind have an in-world clock? | Yes, it starts at 08:00. |
| Which values should always be visible? | Place, cash, mood. |
| In which language does the mind read lines? | English. |
| What are the "kinds" of lines? | ORDER, TALK, WAIT (yours), NOISE, STAFF (the world's). |

Rules of thumb:
- **Kinds are verbs or short nouns in capitals** (ORDER, ASK, RADIO). They become colour bars in the chat.
- **Two prefixes:** one for lines from the user (`GUEST`), one for events that do not come from the user (`CAFE`). Capital letters, digits, `_`, `-`, 2-21 characters.
- **Keep the status line short.** Three to five values are plenty. Every value needs a fixed spelling the panel can read, such as `12 €` or `Mood 3/5`.

## 3. Step 2: find the mind ID
Open the mind chat on venice.ai. The address looks like this:

```
https://venice.ai/chat/minds/local/AbC12xY/9fk2lm
                                    └─────┘
                                   mind ID
```
The mind ID is the part after `/minds/local/`. It stays the same when you rename the mind. Write it down.
Without an ID the extension can fall back to the page title (`titleMatch`), but the ID is more reliable.

## 4. Step 3: build the profile (tutorial "Café Regular")
We build a small profile for a café roleplay. The finished result is [`examples/cafe.profile.json`](examples/cafe.profile.json).
You can also start from the panel under *PROFILE → VORLAGE* (profiles → template), which downloads a working skeleton.

Work in a text editor (not a word processor). Save as `cafe.profile.json`. JSON rules: double quotes, no trailing commas, no comments.

### 3.1 Identity and detection
```json
{
  "id": "cafe",
  "name": "Café Regular",
  "mindIds": ["AbC12xY"],
  "titleMatch": "Café",
  "defaultTime": "08:00",
  "prefixes": { "actor": "GUEST", "world": "CAFE" },
  "settingsLabels": { "actor": "Prefix guest", "world": "Prefix café" }
}
```
- `id`: your short name, lowercase, unique among your profiles.
- `mindIds`: the ID from step 2 (you can list several). `titleMatch` is the fallback.
- `prefixes`: the two prefixes from step 1.

### 3.2 Look
```json
"theme": {
  "fg": "#e8a76a", "dim": "#a8703a", "mut": "#8a7560", "line": "#4a3322", "bg": "#0e0a07", "bg2": "#171009",
  "deep": "#080503", "ink": "#1d1108", "warn": "#ffcc66", "err": "#ff5252", "txt": "#f3dcc2", "glow": "232,167,106"
},
"header": {
  "logo": "C A F É",
  "meta": [["PLACE", "Corner café · ● OPEN · SID {sid}"]],
  "prompt": "guest@cafe:~#"
}
```
Colour roles: `fg` bright accent, `dim` softer accent, `mut` secondary text, `line` borders, `bg` page, `bg2` panel, `deep` input fields,
`ink` text on bright buttons (very dark), `warn` clock, `err` red, `txt` chat text (light), `glow` = `fg` as `"r,g,b"`.
Pick one accent colour and derive the rest: dark backgrounds, a light `txt` that matches the accent. Use any colour picker to read `#hex` and RGB values.

### 3.3 Event colours
```json
"eventKinds": { "ORDER": "#e8a76a", "TALK": "#6cc8ff", "WAIT": "#8a93a3", "STAFF": "#5fe0c4", "NOISE": "#ff8a5c" }
```
Every kind that appears as the first part after the time needs a colour. Otherwise it gets `fg`.

### 3.4 The first tab: buttons with an optional note
```json
"tabs": [
  { "id": "order", "label": "ORDER", "blocks": [
    { "type": "hint", "text": "Order something. Add a note if you want." },
    { "type": "field", "id": "note", "label": "Note (optional)", "placeholder": "oat milk, extra hot", "clear": true },
    { "type": "grid", "cap": "DRINKS",
      "items": ["Espresso", "Flat white", "Tea", "Hot chocolate"],
      "action": { "who": "actor", "parts": ["ORDER", "{item}"], "body": ["{field.note}"] } }
  ] }
]
```
What happens when you type "oat milk" into the note field and click **Flat white**:

```
[GUEST · 08:00 · ORDER · Flat white] oat milk
```
- `parts` are the pieces after the time, separated by `·`. `{item}` is the button text.
- `body` is the text after the bracket. `{field.note}` is the field with id `note` in the same tab.
- If the note is empty, the segment is dropped: `[GUEST · 08:00 · ORDER · Flat white]`.
- `"clear": true` empties the field after each click.

Items can also be objects with separate button text and chat text:
```json
"items": [{ "label": "Croissant", "text": "one croissant" }, { "label": "Toast", "text": "toast with jam" }],
"action": { "who": "actor", "parts": ["ORDER", "{item.label}"], "body": ["{item.text}", "- {field.note}"] }
```
Click **Croissant** with the note "extra butter": `[GUEST · 08:00 · ORDER · Croissant] one croissant - extra butter`.

### 3.5 A form for free text (`compose`)
```json
{ "id": "talk", "label": "TALK", "blocks": [
  { "type": "compose", "kindLabel": "Kind", "whoLabel": "To", "textLabel": "Text",
    "kinds": {
      "TALK": { "who": "barista / neighbour", "text": "What do you say?", "quick": ["Is this seat taken?", "Do you have a charger?"] }
    },
    "action": { "who": "actor", "parts": ["{kind}", "{who}"], "body": ["{text}"],
                "requires": [{ "need": "text", "msg": "Text is missing." }] } }
] }
```
- The form has a kind selector, a "to" field, a text box and quick buttons (`quick`).
- With "barista" in the "to" field and "Is this seat taken?" as text: `[GUEST · 08:00 · TALK · barista] Is this seat taken?`.
- `requires` stops an empty message: the panel shows `msg` and queues nothing.
- The placeholders in a compose block are `{kind}`, `{who}` and `{text}`.

### 3.6 Things that do not come from the user
Events from the world use the **world prefix**. Because `who` is fixed per action, put them in their own block:
```json
{ "id": "cafe", "label": "CAFÉ", "blocks": [
  { "type": "compose", "kindLabel": "Kind", "whoLabel": "Source", "textLabel": "Text",
    "kinds": {
      "NOISE": { "who": "(optional)", "text": "What happens around you?", "quick": ["The espresso machine hisses."] },
      "STAFF": { "who": "barista", "text": "What does the staff do?", "quick": ["The barista wipes the counter."] }
    },
    "action": { "who": "world", "parts": ["{kind}", "{who}"], "body": ["{text}"],
                "requires": [{ "need": "text", "msg": "Text is missing." }] } }
] }
```
Result: `[CAFE · 08:00 · NOISE] The espresso machine hisses.`

### 3.7 Letting time pass
```json
{ "id": "time", "label": "TIME", "blocks": [
  { "type": "grid", "cap": "LET TIME PASS",
    "items": [{ "label": "5 min", "m": 5 }, { "label": "30 min", "m": 30 }, { "label": "until noon", "until": "12:00" }],
    "action": { "who": "actor", "parts": ["WAIT"], "body": ["{item.label}", "({until_minutes} min)"], "shift": true } }
] }
```
- `m` is the number of minutes, `until` a time of day. `shift: true` advances the panel clock by that amount.
- `{until_minutes}` is only filled for `until` items, so "until noon" becomes `until noon (240 min)` while "5 min" stays `5 min`.

### 3.8 Reading the status line (HUD)
The mind will end its replies with, for example:
```
⏱ 08:07 · 📍 table 4 · 12 € · Mood 3/5
```
Teach the panel to read it:
```json
"state": {
  "parts": [{ "key": "loc", "icon": "📍" }],
  "numbers": [{ "key": "cash", "regex": "(\\d{1,4})\\s*€", "icon": "💶", "unit": " €" }],
  "meters": [{ "key": "mood", "label": "MOOD", "regex": "Mood\\s*(\\d)\\s*\\/\\s*(\\d)", "max": 5 }]
},
"statusRight": "💶 {cash|—} €"
```
- `parts`: text after a symbol (`📍 table 4` gives `loc = table 4`).
- `numbers`: a regular expression whose first group is the number (`12 €` gives `cash = 12`).
- `meters`: group 1 is the value, group 2 the maximum. Shown as a bar: `MOOD ▮▮▮▯▯ 3/5`.
- **In JSON every backslash is doubled**: `\\d` in the file means `\d` for the regex. If a regex does not work, look here first.
- `statusRight` is the small display next to the clock. `{cash|—}` shows a dash until a value is known.
- The panel clock follows the `⏱ HH:MM` part automatically.

### 3.9 The convention
```json
"convention": "Lines in square brackets starting with \"{hp}\" are the guest's actions: ORDER = ..., TALK = ..., WAIT = ... Lines starting with \"{wp}\" are things that happen in the café and do not come from the guest: NOISE = ..., STAFF = ... The time in each line is the current in-world time and never runs backwards. Free text below the lines is the guest speaking or acting. End every reply with one status line in this exact form: ⏱ HH:MM · 📍 table · 12 € · Mood 3/5"
```
The convention is a text for the mind (so write it in the mind's language). `{hp}` and `{wp}` become your two prefixes.
The panel inserts it into the chatbox with *SETTINGS → INSERT CONVENTION TEXT*. Better: copy it into the mind's system prompt (step 4).

### 3.10 The complete file
```json
{
  "id": "cafe",
  "name": "Café Regular",
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
    "actor": "Prefix guest",
    "world": "Prefix café"
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
        "PLACE",
        "Corner café · ● OPEN · SID {sid}"
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
        "label": "MOOD",
        "regex": "Mood\\s*(\\d)\\s*\\/\\s*(\\d)",
        "max": 5
      }
    ]
  },
  "statusRight": "💶 {cash|—} €",
  "tabs": [
    {
      "id": "order",
      "label": "ORDER",
      "blocks": [
        {
          "type": "hint",
          "text": "Order something. Add a note if you want."
        },
        {
          "type": "field",
          "id": "note",
          "label": "Note (optional)",
          "placeholder": "oat milk, extra hot",
          "clear": true
        },
        {
          "type": "grid",
          "cap": "DRINKS",
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
          "cap": "FOOD",
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
      "label": "TALK",
      "blocks": [
        {
          "type": "compose",
          "kindLabel": "Kind",
          "whoLabel": "To",
          "textLabel": "Text",
          "kinds": {
            "TALK": {
              "who": "barista / neighbour",
              "text": "What do you say?",
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
                "msg": "Text is missing."
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
          "text": "Things that happen around the guest and do not come from the guest."
        },
        {
          "type": "compose",
          "kindLabel": "Kind",
          "whoLabel": "Source",
          "textLabel": "Text",
          "kinds": {
            "NOISE": {
              "who": "(optional)",
              "text": "What happens around you?",
              "quick": [
                "The espresso machine hisses.",
                "A tram rattles past."
              ]
            },
            "STAFF": {
              "who": "barista",
              "text": "What does the staff do?",
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
                "msg": "Text is missing."
              }
            ]
          }
        }
      ]
    },
    {
      "id": "time",
      "label": "TIME",
      "blocks": [
        {
          "type": "grid",
          "cap": "LET TIME PASS",
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
              "label": "until noon",
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

## 5. Step 4: teach the mind the format
The panel only writes lines. The mind has to understand them. Add a block like this to the **system prompt** of your mind
(a ready-to-adapt version of the profile's `convention`):

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
Two details decide whether the HUD works:
- The mind must **always** produce the status line, as the **last** line, with the **same spelling** your regular expressions expect.
- If you change a spelling in the profile (for example `Mood` to `Stimmung`), change it in the prompt too.

## 6. Step 5: import and test
1. Open the panel (extension icon) and expand **PROFILES**.
2. Click **IMPORTIEREN (.json)** (import) and choose your file. On success the panel shows `Importiert: Café Regular`; the profile appears in the list marked "eigenes" (own).
3. Open the mind chat. The mind bar at the top of the panel shows the profile and how it was recognised (by mind ID or title).

If the import fails, the message names the field. The panel shows the messages in German; the table gives the English meaning:

| Message | Fix |
|---|---|
| `Not a valid JSON file: ...` | A comma, quote or bracket is wrong. Paste the file into a JSON validator to find the line. |
| `id: 2-32 characters ...` | Use lowercase letters, digits, `_` and `-`. |
| `prefixes.actor: capital letters ...` | Capitals only: `GUEST`, not `Guest`. |
| `theme.fg: colour like #7fb4ff` | Use `#` and hex digits. All 11 colours and `glow` ("r,g,b") are required. |
| `state.numbers[0].regex invalid` | A bracket in the regular expression is open, or a backslash is not doubled. |
| `tabs[1].blocks[0]: type must be ...` | Check the block type for typos. |
| `id "ghostline" is taken by a built-in profile` | Choose another id. |

**Manual test, five minutes:**
1. Click one button of every tab and check the queue lines (*QUEUE*) against your plan.
2. Send. Does the mind answer in character and end with the status line?
3. Does the HUD show place, values and meters? Does the clock move?
4. Leave a required field empty. Do you get your `msg`?
5. Switch to another mind tab and back. Does the panel switch profiles?

## 7. Recipes
### 7.0 Several languages in one profile
Any text can be given in several languages. Write an object with an `en` entry (required, it is the fallback) instead of a string:

```json
{ "id": "order", "label": { "en": "ORDER", "de": "BESTELLEN" }, "blocks": [] }
```

The panel shows the text in the selected interface language. This also works for button texts: the sent text follows the interface language. Keep the *event kinds* (the first `parts`, e.g. `"ORDER"`) as plain strings, because your mind prompt refers to them. Details: [PROFILE-FORMAT.md](PROFILE-FORMAT.md#multilingual-texts).

### 7.1 Optional parameter
Use a field plus a segment that depends on it. When the field is empty the segment disappears:
`"body": ["{item}", "- {field.target}"]`

### 7.2 Mandatory parameter
Add `requires`:
`"requires": [{ "need": "field.target", "msg": "Target is missing." }]`

### 7.3 Dropdown instead of free text
```json
{ "type": "field", "id": "mode", "label": "Manner", "kind": "select",
  "options": [{ "value": "", "label": "normal" }, { "value": "quietly", "label": "quiet" }, { "value": "loudly", "label": "loud" }] }
```
Use `"({field.mode})"` as a body segment. For the empty option the segment is dropped.

### 7.4 Two fields side by side
```json
{ "type": "row", "fields": [ { "id": "a", "label": "First" }, { "id": "b", "label": "Second" } ] }
```

### 7.5 Quick buttons with different button and chat text
`items`: `{ "label": "Go", "text": "GO. Green light." }`, then `{item.label}` and `{item.text}`.

### 7.6 Skipping a kind (for "free" entries)
In a compose block, a kind such as `Free` should not appear in the line:
`"omitKinds": ["Free"]`. The `{kind}` part is then dropped.

### 7.7 Missions with fixed place, date and weather
Add `scenarios` (items, fields, template) and a tab containing `{ "type": "scenarios" }`. See [PROFILE-FORMAT.md](PROFILE-FORMAT.md#scenarios-optional)
and [`examples/noir.en.profile.json`](examples/noir.en.profile.json). Scenario values have no final full stop; the template adds it.

### 7.8 A mind steered by slash commands
If your mind understands commands such as `/scene` or `/tone`, write plain text without brackets with `"format": "raw"`:
```json
"action": { "format": "raw", "parts": ["{item.cmd}"], "body": ["{field.text}"],
            "requires": [{ "need": "field.text", "msg": "Text is missing." }] }
```
Add `"clock": false` at the top level if the mind has no in-world time, so the clock and time buttons are hidden. A `convention` is then optional.
Complete example: [`examples/slash-commands.profile.json`](examples/slash-commands.profile.json).

### 7.9 Multi-line messages
A body segment may contain `\n`: `"body": ["\n{field.history}\n/end"]`.

## 8. Design tips
- **Name kinds so the mind cannot misread them.** `ORDER` is clearer than `DO`. Explain each kind in the convention in one sentence.
- **Put the 6-16 most used actions on buttons**, rarely used ones into free text. Group buttons by heading (`cap`).
- **One idea per tab.** Three to seven tabs; tab names in capitals, short.
- **Colours:** keep strong contrast between `bg` and `txt`; give related kinds related colours (dangerous red, interventions amber, waiting grey).
- **Write chat texts in the mind's language, panel texts in yours.** Button labels are for you; `text` and `body` are for the mind.
- **Do not hide rules in the profile.** Anything the mind must know (spelling of the status line, meaning of kinds) belongs in its prompt.
- **Keep prefixes stable.** If you change them in the profile, update the mind prompt and old chats.

## 9. Sharing and versions
- Export your profile from the panel (*PROFILE*) with the ⭳ button next to it. The file is exactly what you imported.
- Importing the same `id` again **replaces** your profile. Keep a copy of the file under version control or simply with a date in the file name.
- Profiles contain no code, so sharing them is safe for the reader as well. Still read a profile you did not write before using it: its texts are sent to your mind.
- Do not put private data in profiles you share (names, scenario details).
- To contribute an example to this repository, add a file to `examples/` and open a pull request.

## 10. Troubleshooting
| Problem | Cause and fix |
|---|---|
| Panel says "Unknown mind" | The ID or title does not match. Use *ASSIGN* in the panel, or correct `mindIds`. |
| The panel shows the wrong profile | Another profile claims the same ID or title. Remove the manual assignment (*REMOVE MIND ASSIGNMENT* in the settings), or fix `titleMatch`. |
| Buttons produce nothing | A `requires` is not met. The panel shows the `msg` under the queue. |
| Line looks different than expected | An empty placeholder drops its segment. Check `parts`/`body` and field ids. |
| Bars do not appear in the chat | The prefix is not in capital letters, or the kind has no colour (then it uses `fg`), or *Format event lines* is switched off in the settings. |
| HUD stays empty | The mind did not write the status line, or its spelling does not match your regular expression. |
| Clock does not follow the mind | The status line does not start with `⏱ HH:MM`. |
| Empty speech bubbles | Another extension edits the same page. Switch it off. |

## 11. Checklist
- [ ] `id`, `name`, `mindIds` (and `titleMatch`), two capital-letter prefixes.
- [ ] All 11 colours and `glow`.
- [ ] Every first part of an action is listed in `eventKinds`.
- [ ] Every `{field.x}` has a field `x` in the same tab.
- [ ] Regular expressions have doubled backslashes and match the mind's status line.
- [ ] `convention` or mind prompt describes every kind and the status line exactly.
- [ ] Import succeeds, one click per tab produces the expected line.
- [ ] The mind ends every reply with the status line and the HUD shows it.
