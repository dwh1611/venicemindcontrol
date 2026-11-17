# Contributing to Mind Console

Thanks for your interest! Bug reports, profile ideas, translations and pull requests are welcome.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Ways to help

- **Report a bug or suggest a feature**: open an [issue](https://github.com/dwh1611/venicemindcontrol/issues/new/choose) and use a template.
- **Share a profile**: profiles are plain JSON. See [PROFILE-FORMAT.md](PROFILE-FORMAT.md) and [AUTHOR-GUIDE.md](AUTHOR-GUIDE.md); examples live in `examples/`.
- **Translate**: the panel texts are in `i18n.js`; the docs exist in English and German (`*.de.md`).

## Development setup

The extension has no build step for development:

1. Clone the repository.
2. Open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked* and select the project folder.
3. Open a Venice mind chat and open the side panel.

To produce the Chrome Web Store ZIP: `./build.sh` (writes to `dist/`).

## Tests

The tests run in a headless Electron against a mocked `chrome` object (see [tests/README.md](tests/README.md)):

```bash
for f in tests/*.test.js; do electron "$f"; done
```

Please run them before opening a pull request, and add or adjust a test when you change behaviour.
Note that they do not cover the real Chrome or the real venice.ai page.

## Pull requests

1. Fork the repo and create a branch from `main` (for example `fix/hud-parsing`).
2. Keep the change focused: one topic per pull request.
3. Update the documentation. Docs exist in English and German, so please change both `X.md` and `X.de.md` or mention that the German version still needs an update.
4. Describe what and why in the pull request and link the related issue.

## Reporting security issues

Please do not open a public issue for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the project's [license](LICENSE).
