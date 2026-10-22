# Visit History

Ever wonder which notes you *actually* spend time in? Visit History quietly
records how long you focus on each note, canvas, and Excalidraw drawing, then
shows your whole vault as a colourful **activity heatmap** — so you can see, at a
glance, what's hot, what's gone cold, and what you've never touched.

Everything runs **fully offline and local**: no network calls, no accounts, no
telemetry. Your history never leaves your device.

![Sample heatmap — vault activity coloured by recency](images/sample-heatmap.png)

*Vault activity coloured by how recently each file was visited (illustrative).
Brighter green = recent, deep blue = long ago, dim = no data yet.*

## See your vault's activity, from day one

The heatmap is a zoomable **treemap** of your entire vault: every file is a
rectangle nested inside its folders, sized by file size or by how long you've
spent in it (see [Sizing](#sizing-content-size-or-visit-time)). Colour is where it gets
interesting — you pick which timestamp drives it:

- **Visited** — where your attention actually goes, based on recorded focus time.
- **Modified** — what you've been editing lately.
- **Created** — what's new in the vault.

Switch between them and the same vault tells three different stories. Recent
files glow; stale ones fade. **Created** and **modified** work immediately on
install — no waiting, no setup. Visit-based colouring layers on top as you use
the plugin, and that's when it gets genuinely revealing: the notes you *think*
matter versus the ones you keep returning to are rarely the same set.

Tune the gradient and the hot/cold thresholds to your vault's rhythm. A vault you
touch daily wants a different scale than a decade-old archive.

Files can also be coloured **by type** (note / canvas / Excalidraw) when you want
a structural view instead of a temporal one.

### Sizing: content size or visit time

Pick what a rectangle's size means:

- **Content size** — bigger file, bigger rectangle.
- **Visit time** — the more total time you've spent in a file, the bigger its
  rectangle. Files you've never visited are left out, so the view shows only
  where your time actually went.

Each mode has its own **curve** (**Linear**, **Sqrt**, or **Log**) to tame a few
huge files that would otherwise crowd out everything else, and its own per-type
size scales. Both are remembered separately for each mode.

### Getting around

- **Drill down** — click a folder to zoom in, step back up the trail, click a
  file to open it. Pan and zoom with the mouse.
- **Filter** — narrow the view to files matching a **path** or their text
  **content**. Filters combine with **OR**: a file shows if it matches *any*
  term.
- **`_archive` folders are hidden** by default (open one from its folder menu to
  look inside).
- Open the heatmap for a specific folder straight from the `Files` view:

![sample-open-heatmap-for-folder.png](images/sample-open-heatmap-for-folder.png)

Heatmap options (colouring mode, sizing, gradient, timestamp field, hot/cold thresholds)
live in the heatmap's own config panel and are **saved automatically** — your
setup is exactly as you left it.

## How visit recording works

Open a note, canvas, or Excalidraw drawing and Visit History times how long it
stays in focus. When you move on — navigate away, switch windows, or go idle — it
saves that session (start time + duration). Very quick in-and-out visits (under
2 seconds by default) are not recorded at all. Over time you get an honest picture
of where your attention goes.

## Your history survives renames

Notes get renamed; folders get reorganised. The first time you open a note or
canvas, the plugin assigns it a small, permanent **id** (in the note's
frontmatter, or the canvas's metadata) and files history under that id — **not**
the path. Move or refactor freely; every second of history follows.

## Inline a note into the note that links to it

Have a small note that only one other note links to? **Inline note (visit history
aware)** merges it into that note — content **and** visit history — then moves the
small note to the trash. Run it from the small note's file menu or the command
palette, or click the inline icon that appears when you hover a `![[note]]`
embed of it.

- The note's content is placed right after the link, with its headings shifted
  to fit; its frontmatter properties are added to the receiving note (existing
  ones are kept as they are).
- Its visit history is merged in, so the time you spent there counts toward the
  receiving note from now on.
- It only runs when the whole vault (canvases included) has **exactly one** link
  to the note. Otherwise a dialog explains why it can't, and nothing changes.
- You confirm before anything changes. If any step fails, the original note is
  kept.

## Where your data is saved

All of it lives **inside your vault**, in the hidden `.plugin_data/visit_history/`
folder — one small text file per document, organised per user and per device.
Nothing is uploaded.

- **Per user** keeps people who share the same vault from mixing histories.
- **Per device** avoids conflicts between your machines.

Because the folder is hidden (dot-prefixed), it stays out of Obsidian's file
explorer and search — and **Obsidian Sync skips it**, so with Obsidian Sync each
device keeps its own history. Being plain files, you can back it up or delete it
like any other file. Curious about the exact layout and line format? See
[The files it writes](#the-files-it-writes-and-their-format) below.

## Installing & enabling

Install it from **Settings → Community plugins → Browse**, search for **Visit
History**, and enable it. Open the heatmap and colour by **modified** — you'll
have something useful to look at before you've recorded a single visit.

The first time you open a note, the plugin asks you to confirm a short user name
(only used to keep histories separate in shared vaults) — pick an existing one or
type a new one, and you're set.

## Settings

Under **Settings → Visit History**:

- **Idle timeout (seconds)** — how long without interaction before the current
  session is considered finished (default 180). Applies immediately.
- **Minimum focus time (seconds)** — visits shorter than this are not recorded
  at all (default 2). Set to 0 to record everything. Applies immediately.
- **Add ids to all eligible files** — assigns the persistent id to every note and
  canvas at once, instead of waiting until you next open each. Modifies files, so
  it's behind a confirmation.

## On the roadmap

Recording your visits unlocks tooling beyond the heatmap. *Not built yet, but
what the history enables:*

- **Journey visualization** — replay how you moved between notes over a session
  or a day, seeing the path your attention took through the vault.
- **Nearby search** — find the notes you visited *around the same time* as a
  given note, surfacing related work you touched together even when it isn't
  linked.

## The files it writes (and their format)

Your history is just **plain text** — nothing proprietary, nothing locked away.
You can open it, read it, back it up, or delete it like any other file.
Here's exactly what gets written and where, so there are no surprises.

Everything lives under `.plugin_data/visit_history/` at the root of your vault,
organised by **user** and then by **device**:

```
.plugin_data/visit_history/
  user/
    <your-name>/                       # keeps people who share a vault separate
      v3/
        README__generated__vh_v3_format.md   # a copy of this format, written by the plugin
        focus_duration_per_device/
          <device-name>/               # one folder per machine — no conflicts
            <doc-id>.vh_v3             # one file per document you've visited
        merged_in_focus_duration_per_device/
          ...                          # history of notes inlined into another note
```

- The **file name is the document's permanent id** — the same id stored in the
  note's frontmatter or the canvas's metadata. That's why your history follows a
  file through renames and moves.
- **One file per document, per device.** Each device writes only its own folder,
  so two synced machines never fight over the same file.

Inside each `.vh_v3` file, **every line is one completed focus session** — the
moment it started plus how long you stayed, in milliseconds:

```
<ISO 8601 UTC start time> D:<milliseconds in focus>
```

For example, a 5.6-second visit that began on 9 July 2026 looks like:

```
2026-07-09T22:02:15.745Z D:5600
```

That's the whole format. The plugin also drops a `README__generated__vh_v3_format.md`
next to your data describing the same thing, so it's documented right where it lives.

> **Note:** `.plugin_data/` is intentionally a hidden (dot-prefixed) folder, so it
> never clutters your file explorer or search. The trade-off: Obsidian Sync skips
> dot-folders, so with Obsidian Sync your history stays on each device.
> Older versions stored history in `.visit_history/` or `__visit_history/`; the
> plugin moves it to the new location automatically.

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
is unaffected — it comes from `.plugin_data/visit_history/`, not file timestamps.

## License

Released under the Kondratyev Source Available License (KSAL-3.0). See [LICENSE.md](LICENSE.md).

In short:

- **Use it anywhere.** Personal vaults, work vaults, client work, companies of any size. No restrictions on what you do with the notes and data you produce.
- **Free features are free.** Some features may be gated behind a license key in the future and require a payment. You may not remove, disable, or bypass those checks.
- **Source is available, not strictly open.** You may read, study, and modify the code for noncommercial purposes. You may not sell it, distribute it commercially, ship it inside a product, or run it as a hosted service.

For commercial licensing, reach out.
