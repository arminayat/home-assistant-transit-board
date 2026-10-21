# Installation

[← README](../README.md) · [Configuration](configuration.md) · [Troubleshooting](troubleshooting.md)

Transit Board is a Home Assistant **app**, installed through Supervisor's app store. Use a Home Assistant installation that provides **Settings → Apps**, on an **amd64** or **aarch64** system. Home Assistant Container/Core installations without Supervisor cannot install this app.

## Install and open

1. Open **Settings → Apps → Install app**.
2. Open the three-dot menu, choose **Repositories**, and add:

   ```text
   https://github.com/arminayat/home-assistant-transit-board
   ```

3. Find **Transit Board** in the added repository and select **Install**.
4. Select **Start**, then **Open Web UI**.
5. Enable **Show in sidebar** to keep the board within reach.
6. In Transit Board, search for a station, select a result, choose **Add stop**, and **Save**. A new board opens settings automatically; use **Settings** for later edits.

Home Assistant versions that use the older terminology call Apps “Add-ons”. This is an app repository, so it is added in the app store rather than HACS or dashboard resources.

The app uses Home Assistant Ingress for access. It exposes no host port, requires no Home Assistant API token and needs no environment variables, YAML configuration or database migration. Installing and starting the app does not require restarting Home Assistant core.

## Who can edit the board?

There is **one shared board**. Everyone allowed to open the app through Home Assistant can change its settings. Other visible viewers check for saved changes each minute and when the page regains focus. Unsaved drafts are retained. This app does not maintain personal boards or a separate read-only role.

Selected stations are stored in the app's persistent data. Include the app in your normal Home Assistant backup routine, particularly before an update.

## Update or roll back

Install updates from the app's Home Assistant page. Back up the app first, read the [changelog](../CHANGELOG.md), update, and reopen the Web UI. If a page remains open during an update, reload it to use the current frontend and configuration.

The beta is published with versioned images for both supported architectures. A repository manifest names the version to install; do not substitute an arbitrary image or development build when following these instructions.

To recover from an unsuccessful update, restore a Home Assistant backup containing the app and its data. Follow Home Assistant's restore flow rather than editing production files inside the container.

## Remove

Back up the app if you want to preserve its station settings. Stop and uninstall **Transit Board** from its Home Assistant page, then remove the repository if no longer needed. Uninstalling can remove app data, so do not treat uninstall/reinstall as a configuration repair procedure.

No dashboard card, resource URL, sensors or database tables need to be removed. The separately installed [Transit Board Card](https://github.com/arminayat/transit-board-card) is independent and is not changed by installing or removing this app.
