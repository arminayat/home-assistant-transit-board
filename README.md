# Transit Board

**Berlin and Brandenburg departures in your Home Assistant sidebar.**

Install the app, choose stations in its visual settings, and open your departure board. Show buses, U-Bahn, S-Bahn and other services, with destinations, platforms, delays and cancellations.

![Departure-board component showing fictional services at Alexanderplatz](docs/images/board.png)

*Shared departure-board component rendered with sample data. This is not a screenshot of an installed Home Assistant app.*

## Quick start

Requires a Home Assistant installation with **Supervisor and Apps**, on **amd64** or **aarch64**. The current version is **0.1.0-beta.1**.

[![Add app repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Farminayat%2Fhome-assistant-transit-board)

Use the button to prefill the repository URL, or follow these steps:

1. Open **Settings → Apps → Install app → ⋮ → Repositories**.
2. Add `https://github.com/arminayat/home-assistant-transit-board`.
3. Find **Transit Board**, install it, and select **Start**.
4. Select **Open Web UI**. Enable **Show in sidebar** for convenient access.
5. In Transit Board's settings, search for a station, select it, choose **Add stop**, then **Save**. Settings open automatically for a new board.

No API key, YAML, environment variables or dashboard resource is needed. See [Installation](docs/installation.md) for details.

## Make the board yours

Combine nearby stops, choose transport types, filter lines and directions, and set a title and departure limit. Everyone who can open the app through Home Assistant shares the same board and can edit its settings.

<details>
<summary>See the station settings component</summary>

![Station-settings component with a U5 line and direction selected](docs/images/editor.png)

*Shared editor component with sample configuration, shown outside Home Assistant.*

</details>

The public [BVG REST API](https://v6.bvg.transport.rest/) supplies Berlin and Brandenburg data. Each viewing browser fetches departures while the board is visible; the app creates no Home Assistant entities or background automations. Read about [configuration and privacy](docs/configuration.md).

## Documentation

| Guide | What it covers |
| --- | --- |
| [Installation](docs/installation.md) | App repository, startup, updates and removal |
| [Configuration](docs/configuration.md) | Shared settings, filters, limits and privacy |
| [Troubleshooting](docs/troubleshooting.md) | Ingress, empty boards, failed saves and provider errors |
| [Development](docs/development.md) | Node setup, architecture, dependency updates and release checks |

This is a **beta**. The images demonstrate the shared components with sample data. Browser testing and acceptance inside Home Assistant have not been performed for this app.

Looking for the separately installed dashboard card? [Transit Board Card](https://github.com/arminayat/transit-board-card) remains a separate project.

## Get involved

See [Support](SUPPORT.md) for questions, [Contributing](CONTRIBUTING.md) for changes, and the [Code of Conduct](CODE_OF_CONDUCT.md) for participation. Report vulnerabilities through the [private security process](SECURITY.md).

[MIT licensed](LICENSE). Attribution and dependency details are in [Third-party notices](THIRD_PARTY_NOTICES.md).
