# Changelog

## 0.1.0-beta.2

- Add **+ Add card** and separate departure cards with independent titles, stops, transport modes, lines, directions and departure limits.
- Add a Settings gear on each card, one inline editor with Save/Cancel, and confirmed removal. Reuse a station on multiple cards.
- Keep the household's cards shared, with conflict protection and limits of 20 cards, 20 total stop entries and 64 KiB.
- Automatically load beta 1's board as the first card, preserving all settings and keeping an original `config.v1.backup.json` before the first successful new-format save.
- Require pages left open during the upgrade to reload before saving; old single-board writes are rejected.
- Include the exact MIT component snapshot and verified source hashes locally so builds do not depend on the unavailable original repository.

No manual migration, environment variable or native Home Assistant configuration change is required. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.1

- Introduce Transit Board as a Home Assistant app with Ingress and sidebar access on amd64 and aarch64.
- Configure one shared departure board through visual station search, transport, line and direction filters.
- Persist shared configuration in app data with atomic saves and protection against conflicting edits.
- Reuse the MIT-licensed departure-board and station-editor components from a pinned Transit Board Card commit.
- Include installation, configuration, troubleshooting and contributor documentation.

This beta has not undergone browser or live Home Assistant acceptance testing. Documentation images show component demos with sample data.
