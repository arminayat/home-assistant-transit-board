# Using Transit Board

## First run

1. Start **Transit Board** from its Home Assistant app page.
2. Choose **Open Web UI**, or enable **Show in sidebar** and open it there.
3. Search for a station, select a result and choose **Add stop**. A new board opens settings automatically; use **Settings** for later edits.
4. Optionally set transport modes, lines, direction, title and the total number of departures.
5. Choose **Save**.

The app uses Home Assistant Ingress. It needs no host port, API token, YAML, environment variables or database migration.

## One shared board

Everyone permitted to open the app through Home Assistant sees and can edit the same configuration. It is saved in the app's persistent data rather than a personal dashboard. Visible viewers check for changes each minute and when the page regains focus. If another viewer saved during your edit, your draft is retained. Choose **Reload saved board** to load their changes, confirm discarding your draft, then reapply your edit.

Edits appear in a local preview before saving. **Save** applies the board for everyone; **Cancel** discards your unsaved edits.

You may select up to 20 stops and display 1–20 departures across the combined board. Line filters match provider names without case sensitivity. Direction filters use a station along the desired route; clear the direction to include both ways.

## Data and privacy

Each visible browser refreshes departures from the public [BVG REST API](https://v6.bvg.transport.rest/) every 60 seconds. Hidden pages pause polling. Coverage is Berlin and Brandenburg; realtime estimates and availability depend on the provider. Old results expire after five minutes during failures.

Browsers send station searches, IDs, transport/direction filters and their IP address to the provider. No Home Assistant credentials are sent. The app creates no entities, recorder history or background automations.

## Backups and recovery

Include this app in your Home Assistant backups before updating. Settings are stored in `/data/config.json`, validated and saved atomically. If a saved file is corrupt, it is preserved and an error is shown. Restore an app backup rather than uninstalling or deleting the file to clear the error.

For installation, troubleshooting and all configuration details, see the [project documentation](https://github.com/arminayat/home-assistant-transit-board#documentation). Report problems with app/OS/Supervisor versions, architecture and sanitized logs; do not upload backups or private station settings.
