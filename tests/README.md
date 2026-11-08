# Tests

The panel tests run in a headless Electron window against `sidepanel.html` with a mocked `chrome` object
(`tests/preload.js`). They do **not** test the real Chrome or the real venice.ai page.

```bash
electron tests/rules.test.js      # any Electron binary works
for f in tests/*.test.js; do electron "$f"; done
```

Each test prints `PASS`/`FAIL` lines and a final `RESULT:` line; the exit code is 1 when something failed.
`tests/lib.js` has the shared helpers (open the panel with a profile, click, read the queue and status).
