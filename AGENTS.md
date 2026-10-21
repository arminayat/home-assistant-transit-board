# Agent instructions

- Do not test in a browser unless explicitly requested. Do not change live Home Assistant as part of app development.
- Run `npm run check` from `transit_board/` before release. Keep local tests deterministic; provider and HA checks are separate evidence.
- Keep files below 500 lines and apply YAGNI. Extend the layer that owns an invariant instead of duplicating it.
- Preserve production Ingress-only access, shared configuration ownership, strict validation, atomic persistence and conflict detection.
- The local development bypass must bind only to loopback and use ignored `.dev-data/`; never expose it as a production option.
- Render external transit labels as text. Do not add credentials, private hostnames, personal station selections, backups or raw `.storage` exports.
- Do not modify installed shared-component dependency files. Update its exact commit pin and lockfile deliberately, review the upstream diff and run the documented checks.
- Before publishing an app manifest version, verify matching immutable amd64/aarch64 images exist and record the image-build results. Never present a local build as Home Assistant acceptance.
- At completion, report visible behavior, system changes, verification and any material deployment or acceptance requirements.
