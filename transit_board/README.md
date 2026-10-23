# Transit Board

Departures for Berlin and Brandenburg, the Nürnberg / VAG network, Norway and Switzerland in Home Assistant, with separate cards shared by everyone allowed to open the app.

Install and start the app, choose **Open Web UI**, then **+ Add card**. Select a **Region**, search for stations and save. Each card has a **Settings** gear for its title, stops, modes, lines, direction/destination filter and departure limit. Enable **Show in sidebar** for quick access. No personal API key or dashboard resource is required.

Supports **amd64** and **aarch64**, accessed through Home Assistant Ingress. Each viewing browser contacts the selected region's BVG REST, VAG, Entur or Swiss transport API. Nürnberg / VAG network covers VAG's U-Bahn, tram and bus services, including served nearby cities, plus S-Bahn where supplied by the API; it does not cover all of Bavaria or the whole VGN network. VAG data is licensed CC BY 4.0. Coverage and realtime detail depend on the source and operator. The app creates no Home Assistant sensor entities or background automations.

See [app documentation](https://github.com/arminayat/home-assistant-transit-board/blob/main/transit_board/DOCS.md), the [setup guide](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/installation.md), [troubleshooting](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/troubleshooting.md), and [release notes](https://github.com/arminayat/home-assistant-transit-board/blob/main/transit_board/CHANGELOG.md).

Beta **0.1.0-beta.5**. Existing settings retain their stations, filters and selected regions; older cards without a region default to Berlin & Brandenburg. Beta 1's board becomes the first card. Reload all open pages after upgrading. No browser or live Home Assistant acceptance result is claimed.
