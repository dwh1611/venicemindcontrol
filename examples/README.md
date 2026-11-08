# Example profiles

[Deutsch](README.de.md) · **English**

Import a file in the panel under **PROFILES → IMPORT (.json)**. Every example uses a placeholder Mind ID (`YOUR-MIND-ID`). Replace it with the ID from your Mind's URL (`venice.ai/chat/minds/local/<MIND-ID>/…`), or assign the profile to your Mind in the panel. All examples pass the same validation as imported profiles.

| File | Style | What it shows |
|---|---|---|
| [`minimal.profile.json`](minimal.profile.json) | Smallest possible | The required fields and one button grid. Start here. |
| [`cafe.profile.json`](cafe.profile.json) ([DE](cafe.de.profile.json)) | Everyday roleplay | Tutorial profile from the [author guide](../AUTHOR-GUIDE.md): fields, orders, clock, HUD with meter and number. |
| [`houseguest.profile.json`](houseguest.profile.json) | Host and guest | Fully bilingual texts (`{ "en": …, "de": … }`), optional field, compose forms for offers and events, time jumps. |
| [`noir.en.profile.json`](noir.en.profile.json) ([DE](noir.profile.json)) | Agent / detective | Scenarios with a template and a hidden complication. |
| [`netrunner.profile.json`](netrunner.profile.json) | Hacker (fictional) | Terminal look, required field, buttons that only appear above a trace value (`when`). |
| [`survival.profile.json`](survival.profile.json) | Survival game | HUD values and conditional buttons and tabs (`when`), time jumps with "until dawn". |
| [`adventure.profile.json`](adventure.profile.json) | Adventure with rules | The v1.2 features together: game state (HP, gold, pack) with a state line, dice with a target value, random tables, scheduled events, buttons built from the pack, conditional buttons and tab. |
| [`slash-commands.profile.json`](slash-commands.profile.json) | Commands | Raw lines without brackets or clock for chat commands. |
| [`two-minds.profiles.json`](two-minds.profiles.json) | Two Minds | Two profiles in one file (game master and character) with the `relay` field for the relay between two tabs. |

Notes:
- `two-minds.profiles.json` contains `{ "profiles": [ … ] }`. One import adds both profiles. Give each its own Mind ID.
- The `when` conditions read the HUD values from the Mind's status line. The Mind prompt must end its answers with that line; the `convention` text in the profile explains the format.
- To contribute an example, add a file here and open a pull request. See the [format reference](../PROFILE-FORMAT.md).
