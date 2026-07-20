# Visit History

Ever wonder which notes you *actually* spend your time in? Visit History quietly
records how long you focus on each note, canvas, and Excalidraw drawing — then
shows your whole vault as a colourful **activity heatmap** so you can see, at a
glance, what's hot, what's gone cold, and what you've never touched.

Everything runs **fully offline and local**: no network calls, no accounts, no
telemetry. Your history never leaves your machine.

![Sample heatmap — vault activity coloured by recency](images/sample-heatmap.png)

*Sample heatmap — vault activity coloured by how recently each file was visited
(illustrative). Brighter green = visited recently, deep blue = long ago, dim =
no data yet.*

## What it does

### Visit recording
Open a note, canvas, or Excalidraw drawing and Visit History times how long it
stays in focus. When you move on — navigate away, switch windows, or go idle —
it saves that session (when it started and how long it lasted). Over time you
build up an honest picture of where your attention actually goes.

### Vault heatmap
A zoomable **treemap** of your entire vault: every file is a rectangle, nested
inside its folders.

- **Size = file size** — bigger files, bigger tiles.
- **Colour = activity** — either **by type** (notes, canvases, Excalidraw drawings
  each get their own colour) or **by recency**: how recently each file was
  **created**, **modified**, or **visited** (your own recorded usage). Recent
  files glow; stale ones fade.
- **Drill down** — click a folder to zoom in, step back up the trail, click a
  file to open it. Pan and zoom with the mouse.
- **Filter** — narrow the view to files matching a path or their text content.
- **`_archive` folders are hidden** by default, so archived clutter doesn't drown
  out your active work (open one explicitly from its folder menu to look inside).

<!-- TODO: replace with a real screenshot -->
![Heatmap coloured by recency](images/heatmap-by-recency.png)
*The heatmap coloured by how recently each file was visited.*

<!-- TODO: replace with a real screenshot -->
![Heatmap config panel](images/heatmap-config-panel.png)
*The config panel — switch colouring mode, gradient, timestamp field, and the
hot/cold thresholds.*

## Your history survives renames

Notes get renamed. Folders get reorganised. Many tools lose track of a file the
moment you move it — Visit History doesn't.

The first time you open a note or canvas, the plugin assigns it a small,
permanent **id** (kept in the note's frontmatter, or in the canvas's metadata).
Your visit history is filed under that id, **not** the file's path — so you can
rename, move, or refactor a file freely, and it keeps every second of its history.

## Where your data is saved

All of it lives **inside your vault**, in a folder named `__visit_history/` —
one small text file per document, organised per user and per device. Nothing is
uploaded anywhere.

- **Per user** keeps different people who sync the same vault from mixing up
  their histories.
- **Per device** avoids sync conflicts between your machines.

Because it's stored as plain files in your vault, it syncs wherever your vault
syncs, and you can back it up or delete it like any other note.

## Installing & enabling

Once Visit History is in the Obsidian community plugin store you'll be able to
install it from **Settings → Community plugins → Browse**. In the meantime you
can install it manually (copy `main.js`, `manifest.json`, and `styles.css` into
`YourVault/.obsidian/plugins/visit-history/`) or via
[BRAT](https://github.com/TfTHacker/obsidian42-brat).

Then enable it: **Settings → Community plugins → enable *Visit History***.

The first time you open a note after enabling, the plugin asks you to confirm a
short user name (used only to keep histories separate in shared vaults) — pick
an existing one or type a new one, and you're set.

## Settings

Under **Settings → Visit History**:

- **Idle timeout (seconds)** — how long without any interaction before the
  current session is considered finished (default 180). Applies immediately, no
  reload needed.
- **Add ids to all eligible files** — assigns the persistent id to every note and
  canvas in your vault in one go, instead of waiting until you next open each
  file. This modifies files, so it's behind a confirmation.

Heatmap options (colouring mode, gradient, timestamp field, thresholds) are
changed right inside the heatmap's config panel and are **saved automatically** —
your setup is exactly as you left it next time you open it.

## Development & publishing

Contributing or cutting a release? See [`docs/`](docs/README.md) for the
architecture, on-disk format, and heatmap internals, and
[`docs/how-to-publish.md`](docs/how-to-publish.md) for the release checklist.

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
