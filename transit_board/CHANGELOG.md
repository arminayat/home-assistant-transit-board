# Changelog

## 0.1.0-beta.5

- Add the key-free **Nürnberg / VAG network** region with station search, departures and CC BY 4.0 attribution to VAG Nürnberg.
- Cover VAG's U-Bahn, tram and bus network, including served nearby cities, plus S-Bahn where supplied by the API; coverage does not extend to all Bavaria or the whole VGN network.
- Add the local destination-text filter and Nürnberg departure clock. Destination matching ignores case and uses displayed destinations, not intermediate stops.
- Preserve existing card regions, settings and shared editing behavior.

Reload every open Web UI page before saving after updating. No manual migration, API key, new environment variable or native Home Assistant configuration change is needed. Back up first and restore compatible app data with an older image when rolling back. Realtime information depends on the source. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.4

- Add per-card regions: Berlin & Brandenburg, Norway/Entur and Switzerland/Swiss transport API.
- Add regional station search, transport filters, local departure clocks and destination-text filters for Norway and Switzerland, without personal API keys.
- Preserve existing card settings and default older cards to BVG. Keep BVG direction-station filtering and shared Save/Cancel behavior.
- Confirm region changes before clearing incompatible stops/filters; keep the original MIT snapshot unchanged with app-owned adaptations.

Reload every open Web UI page before saving after updating. No manual migration or new environment variable is needed. Back up first and restore compatible app data with an older image when rolling back. Realtime information depends on the source. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.3

- Close settings after successful Save and show the updated card.
- Preserve the open editor and draft when saving fails or conflicts.
- Polish form spacing, controls and interaction feedback.
- Block invalid departure limits while preserving your draft for correction or cancellation.

Reload the Web UI after updating. No new migration or environment variable is required. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.2

- Add multiple shared departure cards, each with a title, stations, modes, line/direction filters and departure limit.
- Add **+ Add card**, a Settings gear per card, one inline editor with Save/Cancel, and removal confirmation.
- Preserve beta 1 settings automatically in the first card and back up the original file before the first successful new-format save.
- Enforce 20 cards, 20 aggregate stop entries and 64 KiB; keep conflicting saves protected.
- Build from a local, verified MIT component snapshot instead of fetching the unavailable original repository.

Reload pages left open during the update. No manual migration, new environment variable or native Home Assistant configuration change is required. Browser and live Home Assistant acceptance remain unverified.

## 0.1.0-beta.1

- Initial Home Assistant app with Ingress and sidebar access for amd64 and aarch64.
- Visual station search, transport/line/direction filters and a shared departure board.
- Persistent app settings with atomic saves and protection against conflicting edits.
- Pinned MIT-licensed shared transit components and documentation.

Beta release: browser and live Home Assistant acceptance remain unverified.
