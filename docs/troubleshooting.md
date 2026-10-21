# Troubleshooting

[← README](../README.md) · [Installation](installation.md) · [Configuration](configuration.md)

## The app is missing from the store

Add `https://github.com/arminayat/home-assistant-transit-board` through **Settings → Apps → Install app → ⋮ → Repositories**, then refresh the store. Confirm your installation provides Supervisor Apps and uses amd64 or aarch64. This repository is not installed through HACS.

## The app will not start or open

Check the app's Home Assistant **Log** tab for a startup error. Include the app version, Home Assistant OS/Supervisor versions and architecture in a report, with sanitized logs.

Open it with **Open Web UI** or its sidebar entry. Production access requires Home Assistant Ingress; opening a container address or publishing a port is not a supported alternative. The app does not need a Home Assistant API token or manually configured environment variables.

If an update left an old page open, reload it. Confirm the app is started before reopening the Web UI. A browser request outside the Supervisor Ingress path is expected to be rejected.

## Settings will not save

- If another viewer saved while you were editing, your draft is retained. Choose **Reload saved board**, confirm that you want to discard the draft, then reapply your changes and save again.
- Keep at least one transport mode for each filtered stop, use whole-number departure limits from 1 to 20, and select stations from search results.
- The shared board supports up to 20 stops and a 64 KiB configuration request. Reduce unnecessary entries if a size limit is reported.
- If saving reports a storage error, check app logs and available storage. Do not repeatedly uninstall or delete app data to clear the message.

A corrupt saved configuration is preserved and produces an error rather than being silently reset. Restore an app backup using Home Assistant's backup flow. If no backup is available, ask for help with a minimal sanitized error; preserve the original file for recovery.

## Search or departures are unavailable

Station search needs at least two characters. Try a shorter station name, select a result, and then choose **Add stop**. Search covers provider stops in Berlin and Brandenburg; it excludes addresses and landmarks.

The device displaying the board connects directly to the public BVG REST API. Check that device's network, DNS and content blockers if requests fail. Successful app startup does not establish provider connectivity from every viewing device.

Provider outages and rate limits are retried automatically. A 429 response means the service is busy; respect the pause instead of repeatedly reloading. Failure backoff reaches five minutes, while a provider `Retry-After` value can require a longer wait.

## The board is empty or shows the wrong direction

First confirm that a stop is saved. Then clear line and direction filters and include the relevant transport modes. Verify the boarding stop, because similarly named stops may represent different locations.

A direction is a station along the desired route, rather than a free-text destination label. Clear it to include both ways. Line names are matched case-insensitively against provider results. Add filters back one at a time to identify the restrictive one.

The API request covers 60 minutes and asks for at most 100 results per stop. Busy stops and locally applied line filters may return fewer rows than the configured maximum. An empty board is not proof that no service exists. The departure limit is shared across all selected stops.

## Data is stale, scheduled or incomplete

The board refreshes every minute while visible. A hidden tab or suspended mobile app does not keep polling. Return to the page to resume updates.

Failed refreshes can retain successful results for up to five minutes with a warning. Older results expire. “Scheduled” means no realtime information is available; missing platforms mean the provider did not supply one. Cancellations are marked explicitly.

Clock times use Berlin local time. Countdowns also depend on your device's clock being correct. Check operator information before travelling, particularly during disruption.

## Report a problem

Search [existing issues](https://github.com/arminayat/home-assistant-transit-board/issues), then use the [bug form](https://github.com/arminayat/home-assistant-transit-board/issues/new?template=bug_report.yml). Include a short reproduction, version details and a minimal redacted configuration or sanitized log excerpt if relevant.

Do not upload app backups, tokens, raw Home Assistant storage files, private hostnames or personal station selections. Documentation images and local tests do not establish acceptance inside a live Home Assistant installation.
