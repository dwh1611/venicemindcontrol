# Security policy

## Supported versions

Only the latest release receives security fixes.

| Version | Supported |
| ------- | --------- |
| 1.3.x   | yes       |
| < 1.3   | no        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately via GitHub:
[Report a vulnerability](https://github.com/dwh1611/venicemindcontrol/security/advisories/new).

Please include:

- a description of the issue and its impact,
- steps to reproduce (browser version, extension version, profile used if relevant),
- any suggested fix, if you have one.

You can expect a first reply within about 7 days. After a fix is released, the report can be disclosed together with credit to you, if you wish.

## Scope

Relevant are the extension code (`content.js`, `background.js`, `sidepanel.*`, `assistant.js`, `world.js`) and the handling of imported profiles.
See [PRIVACY.md](PRIVACY.md) for what data the extension touches. Issues in venice.ai itself should be reported to Venice.
