# Changelog

## 0.1.0-beta.2

- Add multiple shared departure cards, each with a title, stations, modes, line/direction filters and departure limit.
- Add **+ Add card**, a Settings gear per card, one inline editor with Save/Cancel, and removal confirmation.
- Preserve beta 1 settings automatically in the first card and back up the original file before the first successful new-format save.
- Enforce 20 cards, 20 aggregate stop entries and 64 KiB; keep conflicting saves protected.

Reload pages left open during the update. No manual migration, new environment variable or native Home Assistant configuration change is required. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.1

- Initial Home Assistant app with Ingress and sidebar access for amd64 and aarch64.
- Visual station search, transport/line/direction filters and a shared departure board.
- Persistent app settings with atomic saves and protection against conflicting edits.
- Pinned MIT-licensed shared transit components and documentation.

Beta release: browser and live Home Assistant acceptance remain unverified.
