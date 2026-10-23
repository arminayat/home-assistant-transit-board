# Configuration

[← README](../README.md) · [Installation](installation.md) · [Troubleshooting](troubleshooting.md)

Open Transit Board through Home Assistant and choose **+ Add card**. Select a **Region**, search for a station, select a result and choose **Add stop**. Set a title and any filters, then choose **Save**. A successful save closes settings and returns to the updated card; a failed or conflicting save keeps the editor open with your draft and an error. Use a card's **Settings** gear to edit it later. Changes appear in your local preview before saving; **Cancel** discards unsaved edits. No YAML editing is needed.

Each card has independent settings. You can use the same station on several cards, such as a bus card and a train card, or one card per direction. One inline editor is open at a time. **Remove card** asks for confirmation for a saved card and marks it for removal in your draft; choose **Save** to apply the removal or **Cancel** to restore it. Removing or cancelling a new, unsaved card simply drops that draft.

## Regions and coverage

| Region | Data source | Departure clock |
| --- | --- | --- |
| Berlin & Brandenburg | [BVG REST API](https://v6.bvg.transport.rest/) | Berlin (`Europe/Berlin`) |
| Norway | [Entur](https://developer.entur.no/docs/open-services) | Oslo (`Europe/Oslo`) |
| Switzerland | [Swiss transport API](https://transport.opendata.ch/) | Zürich (`Europe/Zurich`) |

Choose the region before searching. Station IDs, supported modes and filters belong to that provider; use the selected region's search instead of copying IDs from another source. A card contains stops from one region, while different cards can use different regions. Existing cards default to Berlin & Brandenburg.

Changing Region on a card with stops asks for confirmation, then clears its stops and their mode, line and direction/destination filters. Its title and maximum departures remain. Cancelling the region change keeps its previous selection. Save applies the changed card; Cancel discards the draft.

Coverage depends on each source's available operators and timetables. A supported region does not guarantee that every service has realtime predictions, platforms or cancellation data. Scheduled departures remain useful when realtime information is absent. The Swiss API's current stationboard schema does not provide explicit cancellation data, so the app does not infer cancelled services.

## Shared settings

Everyone allowed to open the app shares the same collection and may add, edit or remove cards. Changes are saved in app data, not in an individual browser or dashboard. Separate user profiles do not create separate collections.

Other visible viewers check for saved changes each minute and when their page regains focus. Unsaved drafts are retained. If someone saves while your settings are open, a conflicting save is rejected. Use **Reload saved board**, confirm that you want to discard your draft, then reapply your changes and save again. This protects another person's changes from being silently overwritten.

| Setting | Default | Meaning |
| --- | --- | --- |
| Cards | None | Up to `20` cards in the shared collection. |
| Region | Berlin & Brandenburg | Source for this card's stations, modes, filters and local departure clock. |
| Title | Station name or `Departures` | Optional card heading. One stop uses its name; multiple stops use “Departures”. |
| Maximum departures | `5` | Whole number from `1` to `20`, applied separately to each card. |
| Stops | None | Stations or boarding stops for this card; at most `20` stop entries across all cards. |
| Transport modes | All | Optional nonempty selection of transport products for each stop. |
| Lines | All | Comma-separated provider line names, for example `U5, U8`; matching ignores case and surrounding whitespace. |
| Direction | All directions | Berlin & Brandenburg: a station along the desired route, selected through search. |
| Destination contains | Unset | Norway/Switzerland: case-insensitive text contained in the displayed destination, up to 200 characters. |

The same station on two cards counts as two stop entries toward the shared limit. The interface is in English. Clock times use the card's region, including local daylight saving time, regardless of your viewing device's time zone.

## Stops, modes and directions

Search needs at least two characters. Select a provider result before choosing **Add stop**; typing a name alone does not select one. Similarly named stations may have separate boarding locations, so check the result before saving. Use **Remove** to remove a stop from the board.

Berlin & Brandenburg offers S-Bahn, U-Bahn, tram, bus, ferry, regional and long-distance train. Norway offers Train, Metro / U-Bahn, Tram, Bus, Ferry and Cable car / funicular. Switzerland offers Train, Tram, Bus, Ferry and Cable car / funicular, with no separate metro category in its API. These are filter categories; actual services depend on the selected stop and provider data. Leave all enabled initially, then narrow the selection if needed.

Line filters are applied locally after results arrive and match provider line names without case sensitivity. For Berlin & Brandenburg, choose **Set direction** with a station along the route; the provider uses its station ID to select departures.

For Norway and Switzerland, **Destination contains (optional)** matches text anywhere in the displayed destination without case sensitivity. It does not mean “via this station” or filter intermediate stops. For example, entering a city name only matches services whose displayed destination contains that name. Clear the filter to include all destinations. Mode filtering follows the selected region's available categories.

If an expected service disappears, clear line and direction filters, check the boarding stop and modes, then reapply filters one at a time. Raise that card's departure limit if its other stops fill it first, or place the services on separate cards.

## What the board shows

Rows include line, destination, boarding stop, optional platform, departure time and countdown. Scheduled time is used when realtime data is absent. Cancellations are marked explicitly and have no live countdown.

For BVG and Entur, requests cover up to 60 minutes and 100 departures per stop. Switzerland requests up to 100 stationboard rows; that source does not guarantee the same 60-minute window. Each card merges duplicate records, sorts by departure time and applies its own limit. Different actual boarding stops remain distinct. Busy stops and local filters can leave fewer displayed rows than requested.

Each visible, attached board refreshes every 60 seconds. Hidden pages pause polling. Identical requests share a page-local cache; separate viewing devices make their own requests. Failed refreshes can retain data for up to five minutes with a stale warning, after which old results expire.

## Persistence and privacy

The app saves the shared card collection to `/data/config.json`. Settings are validated, limited to 20 cards, 20 stop entries in total and a 64 KiB request size, and written atomically with conflict detection. A malformed saved file is reported rather than silently replaced. Use an app backup for recovery; do not post this file publicly if it contains personal locations.

Beta 1's single board is loaded as the first card with ID `legacy`, preserving its settings without changing the original file on load. Before the first successful new-format save, the original is copied to `/data/config.v1.backup.json`. No manual migration is needed. Reload pages left open during the upgrade before editing.

Cards saved by earlier versions without a provider are read as Berlin & Brandenburg, preserving titles, stops and filters. Reading does not rewrite the saved file; an explicit Save stores the current format. Reload old pages before saving, since older write requests are rejected.

Each viewing browser sends searches, selected station IDs, required query parameters and its IP address to the card's source: `v6.bvg.transport.rest`, `api.entur.io` or `transport.opendata.ch`. Line and foreign destination-text filters are local. Entur requests include the app's public `ET-Client-Name` identifier; it is not a personal credential. No personal API keys are required, Home Assistant credentials are not sent to providers, and the app collects no analytics.

The app creates no Home Assistant entities, recorder history or background automations. Configuration persistence in app data is separate from the short-lived, in-memory departure cache in each browser.
