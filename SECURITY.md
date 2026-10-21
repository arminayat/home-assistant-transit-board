# Security

## Supported version

Security fixes target the latest published beta release. Earlier releases and arbitrary development commits do not receive separate security updates. Check the [latest release](https://github.com/arminayat/home-assistant-transit-board/releases) before reporting a problem that may already be fixed.

## Report a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/arminayat/home-assistant-transit-board/security/advisories/new). Do not publish exploits, sensitive configuration or credentials in an issue. If the private form is unavailable, open a public issue asking for it to be enabled, without disclosing vulnerability details.

Include the affected app version, Home Assistant/Supervisor versions, architecture, security impact and a minimal reproduction with fabricated data. Identify the relevant code or request behavior when possible.

Do not attach tokens, complete logs containing secrets, Home Assistant `.storage` files, backups or personal station selections. A minimal redacted example is enough to start a report. Maintainers may coordinate more details, a fix and an advisory through GitHub; no response or remediation deadline is guaranteed.

## Security boundaries

Production access is through Home Assistant Ingress. The app does not expose a host port or call Home Assistant APIs. Every user allowed to open the app shares the household's card collection and can edit it; this shared-write behavior is intentional.

Report suspected Ingress bypasses, unsafe handling of configuration or external data, unintended disclosure and failures that can damage the saved configuration through the private process. Ordinary UI bugs, incorrect transit data and provider outages belong in [public bug reports](https://github.com/arminayat/home-assistant-transit-board/issues/new?template=bug_report.yml).

The public transit service is independently operated. This project cannot authorize testing against it or anyone else's Home Assistant instance. Keep reproduction work confined to code, fixtures and environments you are authorized to use.
