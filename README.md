# Visit History Plugin

Obsidian plugin that records **when and for how long you visit your notes** — and visualizes vault activity as a zoomable **heatmap treemap**.

Fully offline and local: no network calls, no telemetry. Everything stays inside your vault.

## Features

### Visit history recording
Every focus session on a note, canvas, or Excalidraw drawing is logged to a per-user, per-document, per-device file under the hidden `.visit_history/` folder:

- **Focus durations (V3)** — one completed session per line (`<ISO 8601 UTC start stamp> D:<milliseconds>`) at `.visit_history/user/<user-name>/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3`. A session closes when you navigate away, the window loses focus, or you go idle (configurable idle timeout — see Settings). Popout windows are fully supported.
- **Per-user folders** keep the histories of different people syncing one vault apart (the user name is your OS account name on desktop; a stable generated id on mobile). The heatmap still shows whole-vault activity across all users.
- Logs are keyed by a **persistent doc id** (stored in the note's frontmatter / canvas metadata, assigned on first focus), so history survives file renames and moves.
- Legacy v2 and `_visit_history/` (V1) data from older versions of this plugin is no longer read or written — its content is left untouched (a pre-user-scoped `.visit_history/v2|v3` layout is moved under your user folder once, on load).

The `.visit_history/user/<user-name>/v3/` folder contains a generated README describing the format.

### Vault heatmap
A treemap of your whole vault where cell size = file size (weighted per file type) and color = file activity.

- Open via the **`Open vault heatmap` command**, the **ribbon icon**, or a folder's **file-tree context menu → "Open heatmap for folder"** (opens pre-drilled into that folder).
- **Coloring modes**: by file type, or heatmap by a timestamp field — last **visited** (from your visit history), last **modified**, or **created**.
- **Gradients**: three color gradients (Nature, Ember, Mono); "hot" and "cold" day thresholds control how age maps to color.
- **Navigation**: click a folder to drill in, "back" walks up the ancestor chain; click a file to open it. Pan/zoom with the mouse.
- **Config panel** ("⚙ config" in the header): coloring mode, gradient, timestamp field, hot/cold thresholds, and per-type scale factors. Threshold and scale sliders have **editable min/max bounds**. All of it is **persisted** — your configuration survives Obsidian restarts.

#### Hidden feature: `_archive` folders
Folders named `_archive` are **hidden from the heatmap** — archived content doesn't drown out your active notes.

- To view an archive, use its file-tree context menu → **"Open heatmap for folder"**: scoped into an archive, ALL archived content is shown (nested archives included).
- Backing out of the archive hides it again.

## Install

### Build the plugin
- In your vault, go to `.obsidian/plugins/`
- `git clone https://github.com/nickolay-kondratyev/obsidian-visit-history-plugin.git`
- `cd obsidian-visit-history-plugin`
- `npm install && npm run build`

### Enable the plugin
- In Obsidian: Settings → Community plugins → enable **Visit History Plugin**.

## Settings
Under **Settings → Visit History**:

- **Idle timeout (seconds)** — how long without interaction before a focus-duration session is closed (default 180 s). Applies live, no reload needed.
- **Add ids to all eligible files** — assigns a persistent doc id to every tracked file in the vault at once (behind a confirmation; modifies files).

Heatmap configuration is edited in the heatmap view itself (config panel) and persisted automatically.

## More docs
- [docs/](docs/README.md) — architecture, on-disk formats, heatmap view internals
- [README_DEVELOPMENT.md](./README_DEVELOPMENT.md)
- [README_ORIGINAL.md](./README_ORIGINAL.md)


### License

This project is source-available under the Kondratyev Source Available
License 2.3 (KSAL-2.3). In short:

- **You can** use, modify, fork, and redistribute the code for free for
  personal, educational, research, and other noncommercial purposes.
- **Individual creators** — including freelancers, sole proprietors, and
  single-person LLCs — may commercialize anything they *create with* the
  software (sites, content, client deliverables), but not the software
  itself.
- **You cannot** otherwise use it for commercial purposes — including
  company/business use, selling products built on it, or offering it as
  a hosted service — without a paid license.
- A one-time 30-day commercial evaluation is permitted to decide whether
  to purchase.
- Paid functionality behind a license key is not covered by this grant
  and requires a subscription.
- Do not bypass or tamper with license key / subscription checks.
- Contributions you submit are licensed to the author for any use.

This summary is informational only and is not the license. The full text
in [LICENSE.md](LICENSE.md) is the sole and final authority on your
rights and obligations.