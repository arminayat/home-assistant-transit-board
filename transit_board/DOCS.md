# Using Transit Board

## First run

1. Start **Transit Board** from its Home Assistant app page.
2. Choose **Open Web UI**, or enable **Show in sidebar** and open it there.
3. Choose **+ Add card**, search for a station, select a result and choose **Add stop**.
4. Optionally set that card's transport modes, lines, direction, title and number of departures.
5. Choose **Save**.

The app uses Home Assistant Ingress. It needs no host port, API token, YAML, environment variables or database migration.

## Shared cards

Everyone permitted to open the app through Home Assistant sees and can edit the same card collection. It is saved in the app's persistent data rather than a personal dashboard. Visible viewers check for changes each minute and when the page regains focus. If another viewer saved during your edit, your draft is retained. Choose **Reload saved board** to load their changes, confirm discarding your draft, then reapply your edit.

Use a card's **Settings** gear to edit its title, stops and filters. One inline editor opens at a time. Edits appear in a local preview before saving. **Save** applies changes for everyone; **Cancel** discards unsaved edits. **Remove card** confirms removal of a saved card in your draft; press **Save** to apply it or **Cancel** to restore it. Removing or cancelling a new, unsaved card drops the draft.

Create up to 20 cards with 20 stop entries across the collection. The same station may appear on different cards, for example for buses and trains; each occurrence counts toward the stop limit. Each card displays 1–20 departures. Line filters match provider names without case sensitivity. Direction filters use a station along the desired route; clear the direction to include both ways.

## Upgrade from beta 1

Reload pages left open during an upgrade to **0.1.0-beta.2** before saving. Your previous board becomes the first card, preserving its settings automatically. The original file remains untouched on load and is copied to `/data/config.v1.backup.json` before the first successful save in the new format. No manual migration or new environment variable is needed.

## Data and privacy

Each visible browser refreshes departures from the public [BVG REST API](https://v6.bvg.transport.rest/) every 60 seconds. Hidden pages pause polling. Coverage is Berlin and Brandenburg; realtime estimates and availability depend on the provider. Old results expire after five minutes during failures.

Browsers send station searches, IDs, transport/direction filters and their IP address to the provider. No Home Assistant credentials are sent. The app creates no entities, recorder history or background automations.

## Backups and recovery

Include this app in your Home Assistant backups before updating. Settings and the migration backup are stored under `/data/`. The collection in `config.json` is validated and saved atomically, with a 64 KiB request limit. If a saved file is corrupt, it is preserved and an error is shown. Restore an app backup rather than uninstalling or deleting the file to clear the error. Rolling back to beta 1 after saving a collection also requires restoring beta 1 data.

For installation, troubleshooting and all configuration details, see the [project documentation](https://github.com/arminayat/home-assistant-transit-board#documentation). Report problems with app/OS/Supervisor versions, architecture and sanitized logs; do not upload backups or private station settings.
