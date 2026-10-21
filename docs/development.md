# Development

[← README](../README.md) · [Contributing](../CONTRIBUTING.md) · [Third-party notices](../THIRD_PARTY_NOTICES.md)

## Local setup

Use **Node.js 24**. Commands run from the app directory:

```sh
git clone https://github.com/arminayat/home-assistant-transit-board.git
cd home-assistant-transit-board/transit_board
npm ci
npm run check
npm run dev
```

Development serves `http://127.0.0.1:8099` and stores settings in ignored `.dev-data/`. Stop it with Ctrl+C. The local bypass is bound to loopback and must not become a production access option.

`npm run build` creates the production frontend. `npm start` starts the production server, which expects requests from the Supervisor Ingress peer; it is not a standalone public server. Build containers with `transit_board/` as the Docker context.

`npm run check` runs TypeScript validation, Node tests, the build and package/documentation validation. `npm test` builds first. The suite uses fabricated configuration, mocked provider calls and temporary data directories. Browser testing and live Home Assistant changes require explicit authorization under [AGENTS.md](../AGENTS.md).

## Ownership and invariants

The server owns access through Ingress, shared configuration validation, conditional saves and persistence. It stores one board in `/data/config.json`, limits configuration requests to 64 KiB and 20 stops, writes atomically, and preserves malformed data for recovery.

The frontend owns loading the shared configuration, displaying the departure component, editing settings and reporting save conflicts. The pinned shared components own provider calls, normalized departure data, visual station search, filtering and departure rendering.

Keep server authorization independent of untrusted forwarding headers. Preserve the distinction between production Ingress and the loopback-only development server. The app needs neither Home Assistant API access nor user-supplied secrets.

Prevent conflicting edits from overwriting another user's saved settings. Preserve atomic writes and explicit errors; never treat a corrupt file as permission to reset configuration silently. All signed-in users allowed to open Ingress share the same board and write access.

## Updating the shared components

The build dependency `transit-board-core` is pinned to commit `8fec0c7f6058525a91ab31143a41b566fd078a0f` from [arminayat/transit-board-card](https://github.com/arminayat/transit-board-card). It is MIT-licensed; see [Third-party notices](../THIRD_PARTY_NOTICES.md).

For an update:

1. Review the upstream diff from the pinned commit to the proposed exact commit, including configuration, editor events, provider requests, lifecycle cleanup and licensing.
2. Update the exact dependency pin and lockfile together. Do not use a floating branch or modify files inside `node_modules/`.
3. Run `npm ci`, `npm run check` and the production build. Exercise the shared editor's configuration flow and the server's validation/save path with focused tests.
4. Update notices and documentation if public behavior, required compatibility or the pinned revision changes.

An upstream card release does not automatically release this app. Keep the app's source, dependency pin, lockfile and container image tied to a reviewable commit. Keep the app-directory copies of `LICENSE` and `THIRD_PARTY_NOTICES.md` identical to their root originals so the Docker build includes the same notices.

## Documentation images

`docs/images/board.png` and `docs/images/editor.png` show the shared components with sample data, captured outside Home Assistant. Label them accordingly. They demonstrate appearance, rather than app installation, Ingress acceptance or live transit accuracy.

Use fabricated data and public central station examples when adding fixtures or captures. Do not publish personal board settings, app backups or Home Assistant exports. Assistants need an explicit request before browser testing or screenshot capture.

## Release

Prepare a release on `armin/release`, keeping the app manifest, package version and changelogs aligned. Commit the reviewed source and lockfile, run local checks, and push the branch before its version tag. For this beta, from the repository root:

```sh
app_version=0.1.0-beta.1
git switch armin/release
git push origin armin/release
git tag "v$app_version"
git push origin "v$app_version"
```

Pushing `vVERSION` triggers `.github/workflows/release.yml`. The workflow checks that the tag matches the app manifest, runs source/app checks, builds and smoke-tests native **amd64** and **aarch64** containers, then publishes their tested digests as `ghcr.io/arminayat/home-assistant-transit-board:VERSION`.

For later releases, the same workflow can be dispatched against a release branch whose manifest already contains the requested version:

```sh
gh workflow run release.yml --ref armin/release -f "version=$app_version"
```

Choose one publishing trigger for a version. Never move a released tag or overwrite an existing versioned image; the workflow refuses an existing image version. Use a new version for changed source or a replacement release.

Before promoting the manifest, confirm the workflow succeeded, the GHCR package is public, and anonymous pulls work for both `linux/amd64` and `linux/arm64`. Use a clean Docker credential configuration for that check; authenticated registry inspection does not prove public access. Only then fast-forward `main` to the exact tested release commit and create the prerelease:

```sh
git switch main
git merge --ff-only "v$app_version"
git push origin main
gh release create "v$app_version" --verify-tag --prerelease --generate-notes --title "Transit Board $app_version"
```

A manifest on `main` must never name images that are still building, private or unavailable for a supported architecture.

Report separate evidence for local checks, container builds, registry publication and acceptance inside Home Assistant. This beta has no browser or live Home Assistant acceptance result.
