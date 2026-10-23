# Third-party notices

Transit Board is licensed under the [MIT license](LICENSE). The following component and service attributions apply.

## Transit Board Card

The local build dependency `transit-board-core` uses an exact MIT-licensed snapshot retained in `vendor/transit-board-card` within the app directory. Its nine source files and original license come from commit `8fec0c7f6058525a91ab31143a41b566fd078a0f` of the original repository, `https://github.com/arminayat/transit-board-card`.

That repository is currently unavailable. Its URL records historical provenance; this app builds from its checked-in snapshot without fetching the original repository. `UPSTREAM.json` records the source commit and SHA-256 hashes of the ten retained source/license files. The package check verifies those hashes and the recorded revision.

The retained snapshot remains byte-for-byte unchanged. Provider-aware card, configuration, editor, board-view and departure logic are adapted in app-owned `src/` modules with MIT attribution. The app continues to reuse the snapshot's unchanged BVG API and styles. The copyright and permission notice below applies to the retained source and these adaptations.

Copyright (c) 2026 Armin Ayat. Used under the MIT license:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

The documentation images demonstrate these shared components with sample data. They are not proof of installation or acceptance inside Home Assistant.

## Public transit services

Berlin & Brandenburg uses the public [BVG REST API](https://v6.bvg.transport.rest/), built on [HAFAS client](https://github.com/public-transport/hafas-client). Coverage and realtime information depend on upstream BVG/VBB data.

Nürnberg / VAG network uses [VAG Verkehrs-Aktiengesellschaft Nürnberg's public realtime API](https://opendata.vag.de/dataset/api-echtzeitauskunft) at `https://start.vag.de/dm/api/`, without an API key. Data is provided by VAG Nürnberg under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The app normalizes and filters the supplied data for display. Coverage is VAG's U-Bahn, tram and bus network, including served nearby cities, plus S-Bahn where supplied by the API; it does not establish coverage of all Bavaria or the whole VGN network. The current VAG departure board supplies no explicit cancellation data.

Norway uses [Entur's public APIs](https://developer.entur.no/docs/open-services), including the current geocoder and Journey Planner. Requests include the app's public `ET-Client-Name` identification header, rather than a personal API key. Data availability and use conditions are described by Entur.

Switzerland uses the community [Swiss transport API](https://transport.opendata.ch/), with source credit to [opentransportdata.swiss](https://opentransportdata.swiss/en/). Timetable, platform and realtime information depend on its available upstream data; the current stationboard does not report explicit cancellations.

Provider documentation and its data-use conditions remain authoritative. The app does not guarantee every operator or realtime feature in a supported region. Transit Board is independent of these services, transport operators and Home Assistant.

## Build and runtime tools

Node.js, the container base and development dependencies retain their respective licenses. Their license files are provided with the relevant distributions and installed packages. The app's package lockfile records its dependency versions. See [Development](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/development.md) for the shared-component update process.
