# Using Transit Board

## First run

1. Start **Transit Board** from its Home Assistant app page.
2. Choose **Open Web UI**, or enable **Show in sidebar** and open it there.
3. Choose **+ Add card**, select a **Region**, search for a station, select a result and choose **Add stop**.
4. Optionally set that card's transport modes, lines, direction/destination filter, title and number of departures.
5. Choose **Save**. Settings close after a successful save; a failure keeps the editor open with your draft and an error.

The app uses Home Assistant Ingress. It needs no host port, API token, YAML, environment variables or database migration.

## Shared cards

Everyone permitted to open the app through Home Assistant sees and can edit the same card collection. It is saved in the app's persistent data rather than a personal dashboard. Visible viewers check for changes each minute and when the page regains focus. If another viewer saved during your edit, your draft is retained. Choose **Reload saved board** to load their changes, confirm discarding your draft, then reapply your edit.

Use a card's **Settings** gear to edit its title, stops and filters. One inline editor opens at a time. Edits appear in a local preview before saving. **Save** applies changes for everyone; **Cancel** discards unsaved edits. **Remove card** confirms removal of a saved card in your draft; press **Save** to apply it or **Cancel** to restore it. Removing or cancelling a new, unsaved card drops the draft.

Create up to 20 cards with 20 stop entries across the collection. The same station may appear on different cards, for example for buses and trains; each occurrence counts toward the stop limit. Each card displays 1–20 departures. Line filters match provider names without case sensitivity; direction/destination filtering depends on the selected region, as described below.

## Regions and filters

Choose **Berlin & Brandenburg** (BVG REST), **Nürnberg / VAG network** (VAG), **Norway** (Entur) or **Switzerland** (Swiss transport API) independently for each card. Departure clock times use Berlin, Nürnberg, Oslo or Zürich respectively. A supported region does not guarantee realtime information or full coverage of every operator.

Berlin & Brandenburg keeps station-search direction filters. For Nürnberg / VAG network, Norway and Switzerland, **Destination contains (optional)** matches the displayed destination text without case sensitivity; it does not select services via an intermediate station. Norway offers train, metro, tram, bus, ferry and cable car/funicular filters. Switzerland offers the same categories except a separate metro category, which its API does not provide.

Nürnberg / VAG network covers VAG's U-Bahn, tram and bus network, including served nearby cities, plus S-Bahn where supplied by the API. It does not cover all of Bavaria or the whole VGN network. Its [official public API](https://opendata.vag.de/dataset/api-echtzeitauskunft) requires no key and supplies data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Choose Region before searching for stops. Changing a card with stops to another region asks for confirmation and clears its stop selections and filters while retaining its title and departure limit. Save applies the change; Cancel discards it.

## Upgrade to beta 5

Reload every open Web UI page before saving after an update to **0.1.0-beta.5**. Older write requests are rejected. Existing cards retain their selected regions and settings. Cards without a provider load as Berlin & Brandenburg with their settings preserved; the file is not rewritten until you explicitly save. No manual migration, personal API key or new environment variable is needed.

For beta 1 data, your previous board becomes the first card. The original file stays untouched on load and is copied to `/data/config.v1.backup.json` before the first successful new-format save.

## Data and privacy

Each visible browser refreshes departures from the card's [BVG REST](https://v6.bvg.transport.rest/), [VAG](https://opendata.vag.de/dataset/api-echtzeitauskunft), [Entur](https://developer.entur.no/docs/open-services) or [Swiss transport API](https://transport.opendata.ch/) source every 60 seconds. Hidden pages pause polling. Realtime estimates, platforms and cancellation information depend on the source. The current VAG and Swiss boards do not supply explicit cancellation data; the app does not infer cancellations from missing services. Old results expire after five minutes during failures.

Browsers send station searches, IDs, required query parameters and their IP address to the provider. VAG requests go to `https://start.vag.de/dm/api/`. Line and destination-text filters stay local. Entur requests carry the app's public `ET-Client-Name` identifier. No personal API key or Home Assistant credentials are sent. The app creates no entities, recorder history or background automations.

## Backups and recovery

Include this app in your Home Assistant backups before updating. Settings and the migration backup are stored under `/data/`. The collection in `config.json` is validated and saved atomically, with a 64 KiB request limit. If a saved file is corrupt, it is preserved and an error is shown. Restore an app backup rather than uninstalling or deleting the file to clear the error. When rolling back, restore compatible pre-upgrade app data together with the older image, which may not understand saved regions or foreign stop IDs.

For installation, troubleshooting and all configuration details, see the [project documentation](https://github.com/arminayat/home-assistant-transit-board#documentation). Report problems with app/OS/Supervisor versions, architecture and sanitized logs; do not upload backups or private station settings.
