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
6. In Transit Board, choose **+ Add card**, select a **Region**, search for a station, choose **Add stop**, and **Save**. Use a card's **Settings** gear for later edits.

Home Assistant versions that use the older terminology call Apps “Add-ons”. This is an app repository, so it is added in the app store rather than HACS or dashboard resources.

The app uses Home Assistant Ingress for access. It exposes no host port, requires no Home Assistant API token and needs no environment variables, YAML configuration or database migration. Installing and starting the app does not require restarting Home Assistant core.

## Who can edit the cards?

The household shares one collection of cards. Everyone allowed to open the app through Home Assistant can add, edit or remove cards. Other visible viewers check for saved changes each minute and when the page regains focus. Unsaved drafts are retained. This app does not maintain personal collections or a separate read-only role.

Selected stations are stored in the app's persistent data. Include the app in your normal Home Assistant backup routine, particularly before an update.

## Update or roll back

Install updates from the app's Home Assistant page. Back up the app first, read the [changelog](../CHANGELOG.md), update, and reopen the Web UI. If a page remains open during an update, reload it to use the current frontend and configuration.

**Upgrading from 0.1.0-beta.1:** your existing board becomes the first card, retaining its title, stops and filters. No manual migration or new environment variable is needed. Before the first successful save in the new format, the app preserves the original file as `/data/config.v1.backup.json`, included with app data in backups. Old pages must reload before saving; their previous save format is rejected.

**Upgrading to 0.1.0-beta.4:** existing cards without a region/provider are loaded as Berlin & Brandenburg and keep their settings. Loading leaves the saved file unchanged until an explicit Save. Reload every open app page before editing; older clients cannot write the regional configuration format. Norway and Switzerland require no personal API keys or new environment variables.

The beta is published with versioned images for both supported architectures. A repository manifest names the version to install; do not substitute an arbitrary image or development build when following these instructions.

To recover from an unsuccessful update, restore a Home Assistant backup containing the app and compatible pre-upgrade data. Earlier images may not understand saved regions, foreign station IDs or filters; restoring only an older image can be insufficient after saving. A beta 1 image also cannot read a card collection. Follow Home Assistant's restore flow rather than editing production files inside the container.

## Remove

Back up the app if you want to preserve its station settings. Stop and uninstall **Transit Board** from its Home Assistant page, then remove the repository if no longer needed. Uninstalling can remove app data, so do not treat uninstall/reinstall as a configuration repair procedure.

No dashboard card, resource URL, sensors or database tables need to be removed. Installing or removing this app does not modify your native Home Assistant dashboards.
