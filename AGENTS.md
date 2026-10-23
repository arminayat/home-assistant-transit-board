# Agent instructions

- Do not test in a browser unless explicitly requested. Do not change live Home Assistant as part of app development.
- Run `npm run check` from `transit_board/` before release. Keep local tests deterministic; provider and HA checks are separate evidence.
- Keep files below 500 lines and apply YAGNI. Extend the layer that owns an invariant instead of duplicating it.
- Preserve production Ingress-only access, shared configuration ownership, strict validation, atomic persistence and conflict detection.
- Preserve the 20-card/20-total-stop/64-KiB limits, legacy read migration and exact original backup before the first successful collection save. Reject old single-board write payloads.
- The local development bypass must bind only to loopback and use ignored `.dev-data/`; never expose it as a production option.
- Render external transit labels as text. Do not add credentials, private hostnames, personal station selections, backups or raw `.storage` exports.
- Do not modify files in `node_modules/`. Keep the vendored MIT component snapshot exact to its recorded source commit; deliberately update its provenance, SHA-256 manifest, license and package checks when refreshing it. Follow the documented review process.
- Provider-aware card, editor, configuration, rendering and departure adaptations belong to app-owned source with MIT attribution. Reuse the retained BVG API and styles unchanged; never alter snapshot hashes to accommodate app changes.
- Preserve region-specific ID formats, modes, local clocks and filter semantics. Numeric BVG/Swiss IDs do not prove their origin; require fresh stop selection when changing region. Reject unsupported providers and old write protocol requests; disk migration may default a missing provider to BVG without rewriting on load.
- Before publishing an app manifest version, verify matching immutable amd64/aarch64 images exist and record the image-build results. Never present a local build as Home Assistant acceptance.
- At completion, report visible behavior, system changes, verification and any material deployment or acceptance requirements.
