# Visit History

Ever wonder which notes you *actually* spend time in? Visit History quietly
records how long you focus on each note, canvas, and Excalidraw drawing, then
shows your whole vault as a colourful **activity heatmap** — so you can see, at a
glance, what's hot, what's gone cold, and what you've never touched.

Everything runs **fully offline and local**: no network calls, no accounts, no
telemetry. Your history never leaves your machine.

![Sample heatmap — vault activity coloured by recency](images/sample-heatmap.png)

*Vault activity coloured by how recently each file was visited (illustrative).
Brighter green = recent, deep blue = long ago, dim = no data yet.*

## What it does

**Visit recording.** Open a note, canvas, or Excalidraw drawing and Visit
History times how long it stays in focus. When you move on — navigate away,
switch windows, or go idle — it saves that session (start time + duration). Over
time you get an honest picture of where your attention goes.

**Vault heatmap.** A zoomable **treemap** of your entire vault: every file is a
rectangle nested inside its folders.

- **Size = file size** — bigger files, bigger tiles.
- **Colour = activity** — either **by type** (note / canvas / Excalidraw) or
  **by recency**: how recently each file was **created**, **modified**, or
  **visited**. Recent files glow; stale ones fade.
- **Drill down** — click a folder to zoom in, step back up the trail, click a
  file to open it. Pan and zoom with the mouse.
- **Filter** — narrow the view to files matching a **path** or their text
  **content**. Filters combine with **OR**: a file shows if it matches *any*
  term.
- **`_archive` folders are hidden** by default (open one from its folder menu to
  look inside).

### No visit history yet? The heatmap still works

You don't need any recorded visits to get value on day one. Colour the heatmap by
**created** or **modified** time and it immediately highlights your recently
edited and newly created files across the whole vault — visit-based colouring
then layers on top as you use the plugin. See the appendix if your files'
modified times look wrong after a `git` clone.

## Your history survives renames

Notes get renamed; folders get reorganised. The first time you open a note or
canvas, the plugin assigns it a small, permanent **id** (in the note's
frontmatter, or the canvas's metadata) and files history under that id — **not**
the path. Move or refactor freely; every second of history follows.

## Where your data is saved

All of it lives **inside your vault**, in `__visit_history/` — one small text
file per document, organised per user and per device. Nothing is uploaded.

- **Per user** keeps people who sync the same vault from mixing histories.
- **Per device** avoids sync conflicts between your machines.

Being plain files, it syncs wherever your vault syncs, and you can back it up or
delete it like any note.

## Installing & enabling

Once it's in the community plugin store you'll install it from **Settings →
Community plugins → Browse**. Until then, install manually (copy `main.js`,
`manifest.json`, `styles.css` into
`YourVault/.obsidian/plugins/visit-history/`) or via
[BRAT](https://github.com/TfTHacker/obsidian42-brat), then enable it under
**Settings → Community plugins**.

The first time you open a note, the plugin asks you to confirm a short user name
(only used to keep histories separate in shared vaults) — pick an existing one or
type a new one, and you're set.

## Settings

Under **Settings → Visit History**:

- **Idle timeout (seconds)** — how long without interaction before the current
  session is considered finished (default 180). Applies immediately.
- **Add ids to all eligible files** — assigns the persistent id to every note and
  canvas at once, instead of waiting until you next open each. Modifies files, so
  it's behind a confirmation.

Heatmap options (colouring mode, gradient, timestamp field, hot/cold thresholds)
live in the heatmap's own config panel and are **saved automatically** — your
setup is exactly as you left it.

## On the roadmap

Recording your visits unlocks tooling beyond the heatmap. *Not built yet, but
what the history enables:*

- **Journey visualization** — replay how you moved between notes over a session
  or a day, seeing the path your attention took through the vault.
- **Nearby search** — find the notes you visited *around the same time* as a
  given note, surfacing related work you touched together even when it isn't
  linked.

## Appendix: fixing file times after a `git` clone (`git-restore-mtime`)

The **created** and **modified** heatmap colouring reads each file's timestamp
from your operating system. Git does **not** store or restore these times, so
after you `git clone` or `git pull`, the OS stamps every checked-out file with
the moment you pulled — making your whole vault look freshly modified and washing
out the recency heatmap.

[`git-restore-mtime`](https://github.com/MestreLion/git-tools) fixes this: it
walks the git history and resets each file's modified time to the last commit
that actually changed it, restoring meaningful recency.

```bash
# From your vault (a git repo) — run after cloning or a big pull:
git restore-mtime
```

Install it from the [git-tools](https://github.com/MestreLion/git-tools) project
(e.g. `pipx install git-tools`, or your package manager). Visit-based colouring
is unaffected — it comes from `__visit_history/`, not the filesystem.

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
