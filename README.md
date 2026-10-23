# Transit Board

**Departures for Berlin and Brandenburg, Norway and Switzerland in your Home Assistant sidebar.**

Install the app and add departure cards for the stations and services you want. Give each card its own title, transport modes, lines and direction, with destinations, platforms, delays and cancellations.

![Departure-board component showing fictional services at Alexanderplatz](docs/images/board.png)

*Baseline departure-card component rendered with sample data. The app's regional and multi-card controls are not pictured; this is not a screenshot of an installed Home Assistant app.*

## Quick start

Requires a Home Assistant installation with **Supervisor and Apps**, on **amd64** or **aarch64**. The current version is **0.1.0-beta.4**.

[![Add app repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Farminayat%2Fhome-assistant-transit-board)

Use the button to prefill the repository URL, or follow these steps:

1. Open **Settings → Apps → Install app → ⋮ → Repositories**.
2. Add `https://github.com/arminayat/home-assistant-transit-board`.
3. Find **Transit Board**, install it, and select **Start**.
4. Select **Open Web UI**. Enable **Show in sidebar** for convenient access.
5. Choose **+ Add card**, select a **Region**, search for a station, choose **Add stop**, then **Save**.

No API key, YAML, environment variables or dashboard resource is needed. See [Installation](docs/installation.md) for details.

## Make the board yours

Create separate cards for buses, trains or different directions—even at the same station. Each card has its own **Region**, title, stops, filters and departure limit. Choose Berlin & Brandenburg, Norway or Switzerland; cards from different regions can share the same page. Norway and Switzerland support an optional destination-text filter, while Berlin & Brandenburg keeps its direction-station search.

Open a card's **Settings** gear to edit it. One inline editor opens at a time; a successful **Save** applies changes and closes settings, while errors retain your draft. **Cancel** discards the draft. Removing a saved card asks for confirmation, then **Save** applies the removal; **Cancel** restores it.

Everyone who can open the app through Home Assistant shares the household's cards and can edit them. Existing cards keep their settings and default to Berlin & Brandenburg after upgrading. Reload all open app pages before saving.

<details>
<summary>See the station settings component</summary>

![Station-settings component with a U5 line and direction selected](docs/images/editor.png)

*Earlier editor component with sample configuration, shown outside Home Assistant; regional controls are not pictured.*

</details>

Data comes from the public [BVG REST API](https://v6.bvg.transport.rest/), [Entur](https://developer.entur.no/docs/open-services) and [Swiss transport API](https://transport.opendata.ch/). Coverage and realtime information vary by operator. Each viewing browser fetches departures while the board is visible; the app creates no Home Assistant entities or background automations. Read about [regions, filters and privacy](docs/configuration.md).

## Documentation

| Guide | What it covers |
| --- | --- |
| [Installation](docs/installation.md) | App repository, startup, updates and removal |
| [Configuration](docs/configuration.md) | Shared settings, filters, limits and privacy |
| [Troubleshooting](docs/troubleshooting.md) | Ingress, empty boards, failed saves and provider errors |
| [Development](docs/development.md) | Node setup, architecture, dependency updates and release checks |

This is a **beta**. The images demonstrate the shared components with sample data. Browser testing and acceptance inside Home Assistant have not been performed for this app.

## Get involved

See [Support](SUPPORT.md) for questions, [Contributing](CONTRIBUTING.md) for changes, and the [Code of Conduct](CODE_OF_CONDUCT.md) for participation. Report vulnerabilities through the [private security process](SECURITY.md).

[MIT licensed](LICENSE). Attribution and dependency details are in [Third-party notices](THIRD_PARTY_NOTICES.md).
