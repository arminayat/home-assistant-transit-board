# Configuration

[← README](../README.md) · [Installation](installation.md) · [Troubleshooting](troubleshooting.md)

Open Transit Board through Home Assistant and select **Settings**. A new board opens settings automatically. Search for a station, select a result and choose **Add stop**. Set any filters, then choose **Save** to update the shared board. Changes appear in your local preview before saving; **Cancel** discards unsaved edits. No YAML editing is needed.

## Shared settings

Everyone allowed to open the app shares the same configuration and may edit it. Changes are saved in app data, not in an individual browser or dashboard. Separate user profiles do not create separate boards.

Other visible viewers check for saved changes each minute and when their page regains focus. Unsaved drafts are retained. If someone saves while your settings are open, a conflicting save is rejected. Use **Reload saved board**, confirm that you want to discard your draft, then reapply your changes and save again. This protects another person's changes from being silently overwritten.

| Setting | Default | Meaning |
| --- | --- | --- |
| Title | Station name or `Departures` | Optional board heading. One stop uses its name; multiple stops use “Departures”. |
| Maximum departures | `5` | Whole number from `1` to `20`, applied to the combined board. |
| Stops | None | Up to `20` selected stations or boarding stops. |
| Transport modes | All | Optional nonempty selection of transport products for each stop. |
| Lines | All | Comma-separated provider line names, for example `U5, U8`; matching ignores case and surrounding whitespace. |
| Direction | All directions | A station along the desired route, selected through station search. |

The interface is in English. Clock times use `Europe/Berlin`, including local daylight saving time, regardless of your viewing device's time zone.

## Stops, modes and directions

Search needs at least two characters. Select a provider result before choosing **Add stop**; typing a name alone does not select one. Similarly named stations may have separate boarding locations, so check the result before saving. Use **Remove** to remove a stop from the board.

Available modes are S-Bahn (`suburban`), U-Bahn (`subway`), tram (`tram`), bus (`bus`), ferry (`ferry`), regional train (`regional`) and long-distance train (`express`). Leave all enabled for an initial board, then narrow the selection if needed.

Line filters are applied locally after departure results arrive. Transport and direction filters are sent to the provider. To show a direction, choose **Set direction** with a station along that route. A free-text destination name is not a direction filter. Clear the direction to include both ways again.

If an expected service disappears, clear line and direction filters, check the boarding stop and modes, then reapply filters one at a time. Raise the total departure limit if other stops fill the board first.

## What the board shows

Rows include line, destination, boarding stop, optional platform, departure time and countdown. Scheduled time is used when realtime data is absent. Cancellations are marked explicitly and have no live countdown.

The browser requests a 60-minute window with up to 100 results per stop, then merges duplicates, sorts by departure time and limits the combined board. Departures at different actual boarding stops remain distinct. At busy stations, local line filters may leave fewer rows than requested.

Each visible, attached board refreshes every 60 seconds. Hidden pages pause polling. Identical requests share a page-local cache; separate viewing devices make their own requests. Failed refreshes can retain data for up to five minutes with a stale warning, after which old results expire.

## Persistence and privacy

The app saves the shared configuration to `/data/config.json`. Settings are validated, limited to 20 stops and a 64 KiB request size, and written atomically with conflict detection. A malformed saved file is reported rather than silently replaced. Use an app backup for recovery; do not post this file publicly if it contains personal locations.

Each viewing browser sends searches, selected station IDs, transport/direction filters and its IP address to `v6.bvg.transport.rest`. Line filters remain local. The app needs no provider key, sends no Home Assistant credentials to the provider and does not collect analytics.

The app creates no Home Assistant entities, recorder history or background automations. Configuration persistence in app data is separate from the short-lived, in-memory departure cache in each browser.
