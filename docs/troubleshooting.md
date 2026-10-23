# Troubleshooting

[← README](../README.md) · [Installation](installation.md) · [Configuration](configuration.md)

## The app is missing from the store

Add `https://github.com/arminayat/home-assistant-transit-board` through **Settings → Apps → Install app → ⋮ → Repositories**, then refresh the store. Confirm your installation provides Supervisor Apps and uses amd64 or aarch64. This repository is not installed through HACS.

## The app will not start or open

Check the app's Home Assistant **Log** tab for a startup error. Include the app version, Home Assistant OS/Supervisor versions and architecture in a report, with sanitized logs.

Open it with **Open Web UI** or its sidebar entry. Production access requires Home Assistant Ingress; opening a container address or publishing a port is not a supported alternative. The app does not need a Home Assistant API token or manually configured environment variables.

If an update left an old page open, reload it. Confirm the app is started before reopening the Web UI. A browser request outside the Supervisor Ingress path is expected to be rejected.

## Settings will not save

Successful saves close settings and show the updated card. If settings stay open with an error, your draft is retained so you can resolve the problem and retry.

- If another viewer saved while you were editing, your draft is retained. Choose **Reload saved board**, confirm that you want to discard the draft, then reapply your changes and save again.
- Keep at least one transport mode for each filtered stop, use whole-number departure limits from 1 to 20, and select stations from search results.
- Select stations after choosing Region. Unsupported providers and malformed station IDs are rejected, but a numeric ID from another source can still have a valid format and point to the wrong service. Use region search rather than copied IDs. After upgrading to beta 4, reload all open pages before saving, since older write requests are rejected.
- The collection supports up to 20 cards, 20 stop entries across all cards and a 64 KiB configuration request. Reusing a station on two cards counts as two entries. Reduce unnecessary entries if a limit is reported.
- If saving reports a storage error, check app logs and available storage. Do not repeatedly uninstall or delete app data to clear the message.

Removing a saved card changes your draft after confirmation; choose **Save** to make the removal visible to everyone. **Cancel** restores it. A new, unsaved card is dropped when removed or cancelled.

A corrupt saved configuration is preserved and produces an error rather than being silently reset. Restore an app backup using Home Assistant's backup flow. If no backup is available, ask for help with a minimal sanitized error; preserve the original file for recovery.

After upgrading from beta 1, reload pages left open before the update. Their old single-board save format is intentionally rejected. Your previous settings migrate into the first card automatically; `/data/config.v1.backup.json` preserves the original before the first successful save in the new format.

If migration reports the 64 KiB limit, the original file is preserved. Use the previous app version to reduce its settings, or restore a smaller backup, before upgrading again. Do not delete the preserved file to bypass the limit.

## Search or departures are unavailable

Choose the correct **Region** first. Station search needs at least two characters. Try a shorter station name, select a result, and then choose **Add stop**. Search covers stops supplied by that region's provider, rather than general addresses or landmarks.

The viewing device connects directly to `v6.bvg.transport.rest` for Berlin & Brandenburg, `api.entur.io` for Norway or `transport.opendata.ch` for Switzerland. Check that device's network, DNS and content blockers if requests fail. Entur needs the app's public client-identification header, which is included automatically; no personal key is needed. Successful app startup does not establish provider connectivity from every device.

Provider outages and rate limits are retried automatically. A 429 response means the service is busy; respect the pause instead of repeatedly reloading. Failure backoff reaches five minutes, while a provider `Retry-After` value can require a longer wait.

## The board is empty or shows the wrong direction

On a new installation, use **+ Add card** to create the first card. For an empty card, open its **Settings** gear and confirm that a stop is saved. Then clear line and direction filters and include the relevant transport modes. Verify the boarding stop, because similarly named stops may represent different locations.

For Berlin & Brandenburg, a direction is a station along the desired route. For Norway and Switzerland, **Destination contains** matches the displayed destination text without case sensitivity, not intermediate stops or a station ID. Clear the direction/destination filter to include both ways. Line names match provider results case-insensitively. Add filters back one at a time to identify the restrictive one.

BVG and Entur request up to 60 minutes and 100 results per stop. Switzerland requests up to 100 stationboard rows, without guaranteeing the same time window. Busy stops and local filters may leave fewer rows than the configured maximum. An empty card is not proof that no service exists. Each card's departure limit applies to the stops on that card.

## Data is stale, scheduled or incomplete

The board refreshes every minute while visible. A hidden tab or suspended mobile app does not keep polling. Return to the page to resume updates.

Failed refreshes can retain successful results for up to five minutes with a warning. Older results expire. “Scheduled” means no realtime information is available; missing platforms mean the provider did not supply one. Cancellations are marked when explicitly reported. The Swiss stationboard currently supplies no explicit cancellation field, so absence from the board is not interpreted as a cancellation.

Clock times use the card's region: Berlin, Oslo or Zürich. Countdowns also depend on your device's clock being correct. Check operator information before travelling, particularly during disruption.

## Report a problem

Search [existing issues](https://github.com/arminayat/home-assistant-transit-board/issues), then use the [bug form](https://github.com/arminayat/home-assistant-transit-board/issues/new?template=bug_report.yml). Include a short reproduction, version details and a minimal redacted configuration or sanitized log excerpt if relevant.

Do not upload app backups, tokens, raw Home Assistant storage files, private hostnames or personal station selections. Documentation images and local tests do not establish acceptance inside a live Home Assistant installation.
