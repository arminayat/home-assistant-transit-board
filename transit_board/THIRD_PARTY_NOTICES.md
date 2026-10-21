# Third-party notices

Transit Board is licensed under the [MIT license](LICENSE). It builds on these independently maintained projects and services.

## Transit Board Card

The build dependency `transit-board-core` supplies the departure-board and visual station-editor components from [arminayat/transit-board-card](https://github.com/arminayat/transit-board-card), pinned to commit [`8fec0c7f6058525a91ab31143a41b566fd078a0f`](https://github.com/arminayat/transit-board-card/tree/8fec0c7f6058525a91ab31143a41b566fd078a0f).

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

## Public transit service

Departure information and station search use the public [BVG REST API](https://v6.bvg.transport.rest/), built on [HAFAS client](https://github.com/public-transport/hafas-client). Coverage and realtime information depend on upstream BVG/VBB data. Transit Board is independent of these operators and of Home Assistant.

## Build and runtime tools

Node.js, the container base and development dependencies retain their respective licenses. Their license files are provided with the relevant distributions and installed packages. The app's package lockfile records its dependency versions. See [Development](https://github.com/arminayat/home-assistant-transit-board/blob/main/docs/development.md) for the shared-component update process.
