# Configuration

[← README](../README.md) · [Installation](installation.md) · [Troubleshooting](troubleshooting.md)

Open Transit Board through Home Assistant and choose **+ Add card**. Search for a station, select a result and choose **Add stop**. Set a title and any filters, then choose **Save**. A successful save closes settings and returns to the updated card; a failed or conflicting save keeps the editor open with your draft and an error. Use a card's **Settings** gear to edit it later. Changes appear in your local preview before saving; **Cancel** discards unsaved edits. No YAML editing is needed.

Each card has independent settings. You can use the same station on several cards, such as a bus card and a train card, or one card per direction. One inline editor is open at a time. **Remove card** asks for confirmation for a saved card and marks it for removal in your draft; choose **Save** to apply the removal or **Cancel** to restore it. Removing or cancelling a new, unsaved card simply drops that draft.

## Shared settings

Everyone allowed to open the app shares the same collection and may add, edit or remove cards. Changes are saved in app data, not in an individual browser or dashboard. Separate user profiles do not create separate collections.

Other visible viewers check for saved changes each minute and when their page regains focus. Unsaved drafts are retained. If someone saves while your settings are open, a conflicting save is rejected. Use **Reload saved board**, confirm that you want to discard your draft, then reapply your changes and save again. This protects another person's changes from being silently overwritten.

| Setting | Default | Meaning |
| --- | --- | --- |
| Cards | None | Up to `20` cards in the shared collection. |
| Title | Station name or `Departures` | Optional card heading. One stop uses its name; multiple stops use “Departures”. |
| Maximum departures | `5` | Whole number from `1` to `20`, applied separately to each card. |
| Stops | None | Stations or boarding stops for this card; at most `20` stop entries across all cards. |
| Transport modes | All | Optional nonempty selection of transport products for each stop. |
| Lines | All | Comma-separated provider line names, for example `U5, U8`; matching ignores case and surrounding whitespace. |
| Direction | All directions | A station along the desired route, selected through station search. |

The same station on two cards counts as two stop entries toward the shared limit. The interface is in English. Clock times use `Europe/Berlin`, including local daylight saving time, regardless of your viewing device's time zone.

## Stops, modes and directions

Search needs at least two characters. Select a provider result before choosing **Add stop**; typing a name alone does not select one. Similarly named stations may have separate boarding locations, so check the result before saving. Use **Remove** to remove a stop from the board.

Available modes are S-Bahn (`suburban`), U-Bahn (`subway`), tram (`tram`), bus (`bus`), ferry (`ferry`), regional train (`regional`) and long-distance train (`express`). Leave all enabled for an initial board, then narrow the selection if needed.

Line filters are applied locally after departure results arrive. Transport and direction filters are sent to the provider. To show a direction, choose **Set direction** with a station along that route. A free-text destination name is not a direction filter. Clear the direction to include both ways again.

If an expected service disappears, clear line and direction filters, check the boarding stop and modes, then reapply filters one at a time. Raise that card's departure limit if its other stops fill it first, or place the services on separate cards.

## What the board shows

Rows include line, destination, boarding stop, optional platform, departure time and countdown. Scheduled time is used when realtime data is absent. Cancellations are marked explicitly and have no live countdown.

For each card, the browser requests a 60-minute window with up to 100 results per stop, then merges duplicates, sorts by departure time and applies that card's limit. Departures at different actual boarding stops remain distinct. At busy stations, local line filters may leave fewer rows than requested.

Each visible, attached board refreshes every 60 seconds. Hidden pages pause polling. Identical requests share a page-local cache; separate viewing devices make their own requests. Failed refreshes can retain data for up to five minutes with a stale warning, after which old results expire.

## Persistence and privacy

The app saves the shared card collection to `/data/config.json`. Settings are validated, limited to 20 cards, 20 stop entries in total and a 64 KiB request size, and written atomically with conflict detection. A malformed saved file is reported rather than silently replaced. Use an app backup for recovery; do not post this file publicly if it contains personal locations.

Beta 1's single board is loaded as the first card with ID `legacy`, preserving its settings without changing the original file on load. Before the first successful new-format save, the original is copied to `/data/config.v1.backup.json`. No manual migration is needed. Reload pages left open during the upgrade before editing.

Each viewing browser sends searches, selected station IDs, transport/direction filters and its IP address to `v6.bvg.transport.rest`. Line filters remain local. The app needs no provider key, sends no Home Assistant credentials to the provider and does not collect analytics.

The app creates no Home Assistant entities, recorder history or background automations. Configuration persistence in app data is separate from the short-lived, in-memory departure cache in each browser.
