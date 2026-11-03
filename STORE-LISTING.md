# Chrome Web Store – Listing texts / Texte

Copy these into the Developer Dashboard. / Diese Texte ins Developer Dashboard kopieren.

## Name
Mind Console

## Summary (max 132 chars)
EN: Side panel to control your venice.ai Minds – auto-detects the Mind, built-in and custom JSON profiles. Unofficial.
DE: Seitenleiste zur Steuerung deiner venice.ai-Minds – erkennt das Mind automatisch, Profile als JSON. Inoffiziell.

## Category
Fun (Spaß) / Productivity

## Description – EN
Mind Console adds a side panel to venice.ai that turns a roleplay Mind into a game-master console.

• Detects the Mind you are talking to (by its Mind ID) and loads the matching profile
• Buttons for scenes, actions and time jumps – inserted into the chat in a clean, consistent line format
• Status HUD and clock parsed from the Mind's answers
• Built-in profiles: Nightingale, Ghostline
• Add your own Minds without code: import a profile as plain JSON (guide and a generator prompt included)
• Everything stays in your browser – no tracking, no servers

Unofficial tool, not affiliated with Venice.ai. Works with fictional roleplay Minds.
Docs & source: https://github.com/dwh1611/venicemindcontrol

## Description – DE
Mind Console ergänzt venice.ai um eine Seitenleiste, die ein Rollenspiel-Mind in eine Spielleiter-Konsole verwandelt.

• Erkennt das Mind (über die Mind-ID) und lädt das passende Profil
• Buttons für Szenen, Aktionen und Zeitsprünge – sauber formatiert in den Chat eingefügt
• Status-HUD und Uhr aus den Antworten des Minds
• Eingebaute Profile: Nightingale, Ghostline
• Eigene Minds ohne Code: Profil als reines JSON importieren (Anleitung und Generator-Prompt inklusive)
• Alles bleibt im Browser – kein Tracking, keine Server

Inoffiziell, nicht mit Venice.ai verbunden. Für fiktive Rollenspiel-Minds.

## Single purpose
Provide a side panel that detects the active venice.ai Mind and offers a control console for roleplay with it.

## Permission justifications
- **sidePanel**: the console UI is shown in Chrome's side panel.
- **storage**: saves profiles, queue, theme and game state locally.
- **scripting**: injects the content script into venice.ai tabs that were already open when the extension was installed or updated.
- **Host access (venice.ai)**: the content script reads the Mind ID, page title and chat messages, and inserts text into the chat input on the user's request. No other site is accessed.
- **Remote code**: none. Profiles are JSON data, never executed.

## Data usage form
No user data is collected, sold or transferred. Privacy policy URL:
https://github.com/dwh1611/venicemindcontrol/blob/main/PRIVACY.md

## Graphics
store/store-icon-512.png (icon), store/screenshot-*.png (1280×800), store/promo-tile-440x280.png
