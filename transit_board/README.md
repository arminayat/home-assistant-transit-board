# Transit Board

Berlin and Brandenburg departures in Home Assistant, with visual station setup and one shared board for everyone allowed to open the app.

Install and start the app, choose **Open Web UI**, then open **Settings** to search for stations and save the board. Enable **Show in sidebar** for quick access. No API key or dashboard resource is required.

Supports **amd64** and **aarch64**, accessed through Home Assistant Ingress. Departure requests go from each viewing browser to the public BVG REST API. The app creates no Home Assistant sensor entities or background automations.

See [app documentation](https://github.com/arminayat/home-assistant-transit-board/blob/main/transit_board/DOCS.md), the [setup guide](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/installation.md), [troubleshooting](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/troubleshooting.md), and [release notes](https://github.com/arminayat/home-assistant-transit-board/blob/main/transit_board/CHANGELOG.md).

Beta **0.1.0-beta.1**. No browser or live Home Assistant acceptance result is claimed. The [separate dashboard card](https://github.com/arminayat/transit-board-card) remains independent.
