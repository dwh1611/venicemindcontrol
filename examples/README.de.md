# Beispielprofile

**Deutsch** · [English](README.md)

Eine Datei im Panel unter **PROFILE → IMPORTIEREN (.json)** importieren. Jedes Beispiel nutzt eine Platzhalter-Mind-ID (`YOUR-MIND-ID`). Ersetze sie durch die ID aus der URL deines Minds (`venice.ai/chat/minds/local/<MIND-ID>/…`) oder ordne das Profil im Panel deinem Mind zu. Alle Beispiele bestehen dieselbe Prüfung wie importierte Profile.

| Datei | Stil | Was es zeigt |
|---|---|---|
| [`minimal.profile.json`](minimal.profile.json) | Kleinstes Profil | Die Pflichtfelder und ein Button-Raster. Hier anfangen. |
| [`cafe.de.profile.json`](cafe.de.profile.json) ([EN](cafe.profile.json)) | Alltags-Rollenspiel | Tutorial-Profil aus dem [Autorenleitfaden](../AUTHOR-GUIDE.de.md): Felder, Bestellungen, Uhr, HUD mit Meter und Zahl. |
| [`houseguest.profile.json`](houseguest.profile.json) | Gastgeber und Gast | Komplett zweisprachige Texte (`{ "en": …, "de": … }`), optionales Feld, Compose-Formulare, Zeitsprünge. |
| [`noir.profile.json`](noir.profile.json) ([EN](noir.en.profile.json)) | Agent / Detektiv | Szenarien mit Vorlage und versteckter Komplikation. |
| [`netrunner.profile.json`](netrunner.profile.json) | Hacker (fiktiv) | Terminal-Look, Pflichtfeld, Buttons, die erst ab einem Trace-Wert erscheinen (`when`). |
| [`survival.profile.json`](survival.profile.json) | Überlebensspiel | HUD-Werte sowie bedingte Buttons und Reiter (`when`), Zeitsprünge mit „bis zum Morgen“. |
| [`adventure.profile.json`](adventure.profile.json) | Abenteuer mit Regeln | Die Funktionen aus v1.2 zusammen: Spielzustand (HP, Gold, Rucksack) mit Zustandszeile, Würfel mit Zielwert, Zufallstabellen, geplante Ereignisse, Buttons aus dem Rucksack, bedingte Buttons und Reiter. |
| [`slash-commands.profile.json`](slash-commands.profile.json) | Befehle | Rohe Zeilen ohne Klammer und Uhr für Chat-Befehle. |
| [`two-minds.profiles.json`](two-minds.profiles.json) | Zwei Minds | Zwei Profile in einer Datei (Spielleiter und Figur) mit dem Feld `relay` für das Relay zwischen zwei Tabs. |

Hinweise:
- `two-minds.profiles.json` enthält `{ "profiles": [ … ] }`. Ein Import legt beide Profile an. Jedem Profil eine eigene Mind-ID geben.
- Die `when`-Bedingungen lesen die HUD-Werte aus der Statuszeile des Minds. Der Mind-Prompt muss seine Antworten mit dieser Zeile beenden; der `convention`-Text im Profil erklärt das Format.
- Für ein eigenes Beispiel eine Datei hier ergänzen und einen Pull Request öffnen. Siehe die [Format-Referenz](../PROFILE-FORMAT.de.md).
