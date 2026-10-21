# Contributing

Focused bug fixes, documentation improvements and practical improvements to station setup are welcome. Open a [feature request](https://github.com/arminayat/home-assistant-transit-board/issues/new?template=feature_request.yml) before taking on a substantial change so its scope can be discussed.

## Local setup

Use Node.js **24**. Fork the repository, create a branch, and run:

```sh
cd transit_board
npm ci
npm run check
```

Run `npm run dev` for the local loopback-only app on `http://127.0.0.1:8099`. Development settings are stored in ignored `.dev-data/`. This mode is for local development; production access is through Home Assistant Ingress.

See [Development](docs/development.md) for the architecture, commands and pinned shared-component dependency. Do not edit installed dependencies or generated output by hand.

## Changes and verification

- Keep files below 500 lines. Extend the layer that owns the behavior and avoid speculative settings or services.
- Preserve Ingress access checks, input validation, response size limits, atomic writes and protection against conflicting saves.
- Treat the card collection as shared configuration. Preserve legacy-file migration and its original backup. Do not add per-user behavior without first discussing its effect on the product and storage model.
- Render external labels as text and keep credentials, private Home Assistant settings and personal travel information out of fixtures and screenshots.
- Add focused behavioral coverage for changed behavior, including failure paths. Mock provider requests in automated tests.
- Run `npm run check` from `transit_board/` and `git diff --check` before submitting a change. Update guides and the changelog when visible behavior changes.

Browser, container and Home Assistant acceptance checks establish different things. Describe the checks you performed and any remaining acceptance limits. AI assistants must follow [AGENTS.md](AGENTS.md), including the restriction on browser testing and live Home Assistant changes.

## Pull requests

Explain the problem, resulting behavior and verification. Keep unrelated formatting and dependency updates out of the change. Follow the [Code of Conduct](CODE_OF_CONDUCT.md), and use the [private process](SECURITY.md) for suspected vulnerabilities.

Contributions use the repository's [MIT license](LICENSE). There is no separate contributor agreement or sign-off requirement.
