# EXPLORATION — Canvas "add rectangle/note" splits the focus-duration session

Bug: while inside a CANVAS view, clicking the canvas UI to add a rectangle/note card triggers
an UNFOCUS of the canvas file, then a re-FOCUS when the card is placed — splitting the V3
duration session although the user never left the canvas.

All paths are absolute; line numbers as of branch `fix-unfocus-due-to-rectangle-choice`
(clean tree, HEAD `b21217d`).

---

## 1. Focus pipeline — `FocusTracker`

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/core/focusTracker/FocusTracker.ts`

**Sole trigger** is the Obsidian workspace event `active-leaf-change` (FocusTracker.ts:66-74).
No other workspace/DOM event feeds focus/unfocus dispatch. Dispatch is serialized through a
promise chain (`dispatchChain`, :60) — in-order but with **no debounce, no delay, no grace
period**: every event is handled the instant its turn in the chain comes.

The decision logic (FocusTracker.ts:88-108):

```ts
private async handleLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
  const view = leaf === null ? null : leaf.view;
  const nextEvent = view !== null && this.isTrackedProvider.isTrackedView(view)
    ? viewToFocusEvent(view)
    : null;

  // Unfocus whenever the focused FILE changes — including same-leaf
  // navigation to an untracked view, ...
  if (this.lastFocusEvent !== null && this.lastFocusEvent.file.path !== nextEvent?.file.path) {
    await this.dispatch(this.lastFocusEvent, 'onUnfocus');
  }

  this.lastFocusEvent = nextEvent;
  if (nextEvent !== null) {
    await this.dispatch(nextEvent, 'onFocus');
  }
}
```

Key consequences:

- **Focus is tracked by FILE path, not leaf** (`lastFocusEvent` doc, :45-51). Same file in a
  different leaf, or a duplicate event for the same leaf, dispatches NO unfocus (test-verified).
- **`leaf === null` → `nextEvent === null` → immediate unfocus** of `lastFocusEvent`
  (`nextEvent?.file.path` is `undefined`, which `!==` any real path). Same for a leaf whose
  view is untracked or file-less (`IsTrackedProvider.isTrackedView` returns false → `nextEvent = null`).
- After an unfocus caused by a null/untracked leaf, `lastFocusEvent` becomes `null`; the next
  `active-leaf-change` back to the canvas dispatches a fresh `onFocus` — i.e. the exact
  unfocus→refocus split described in the bug, produced by ANY transient
  `active-leaf-change(null | untracked)` in between.
- `viewToFocusEvent` (:28-40) carries `type`, `title`, `file`, and `ownerDocument`
  (`view.containerEl.ownerDocument`) — the per-window identity used downstream.

## 2. Listeners and the session state machine

### 2a. `VhV3FocusDurationListener`

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/core/focusTracker/listener/VhV3FocusDurationListener.ts`

- `onUnfocus` (:46-48) is unconditional: `this.focusDurationTracker.onDocUnfocused();`
- `onFocus` (:20-44) resolves the doc id via `docIdService.ensureDocId` ("cheap cached read"
  since `DocIdFocusListener`, registered first, already persisted it) and calls
  `onDocFocused(docId, event.ownerDocument)`. If id resolution fails / id is not
  filename-safe, it ALSO calls `onDocUnfocused()` (:35-41) — a second, independent split path.
- No InFlightDropGuard, no debounce here (class doc :10-11 says so explicitly).

### 2b. `FocusDurationTracker`

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/core/focusDuration/FocusDurationTracker.ts`

- `onDocUnfocused()` (:90-93) → `endSession(Date.now()); this.currentDoc = null;` —
  **immediate, unconditional session close + sink record**. No grace period anywhere.
- `onDocFocused(docId, windowHandle)` (:72-88): if `session?.docId === docId` it is a no-op
  (only adopts the window) — duplicate focus for the same doc does NOT fragment (:73-79).
  BUT this protection only helps when NO unfocus was dispatched in between; after
  `onDocUnfocused()` the session is already closed, so the refocus starts a brand-new session
  (:83-87, requires the hosting window ∈ `focusedWindows`).
- So: **unfocus→refocus in quick succession = two sink records** (two sessions). The tracker
  already has "keep `currentDoc` and reopen a session later" machinery for window-blur and
  idle closes (:48-52, :104-131) — but that machinery is bypassed by `onDocUnfocused`, which
  nulls `currentDoc`.
- Idle handling: single self-re-arming timer (`armIdleTimer`, :167-174), retroactive idle
  cutoff in `endSession` (:159-161) and `onUserActivity` (:115-120).

### 2c. `WindowActivityMonitor` — could window blur be the trigger?

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/core/focusDuration/WindowActivityMonitor.ts`

- Registers `blur`/`focus` on each Obsidian window (`win`) plus `visibilitychange` on its
  `document` (:85-96). `blur` → `tracker.onWindowBlurred(doc)` → `endSession` when the blurred
  window hosts the current doc (FocusDurationTracker.ts:95-102).
- These are **window-level** (`window.blur`) listeners, not element focusout. An in-canvas
  popup/menu that is ordinary DOM inside the same window does NOT fire `window.blur`. Only a
  separate OS window (native context menu on some platforms, popout) would. So a blur-driven
  split is possible in principle but requires the canvas affordance to open a native/OS-level
  surface — see hypotheses. Note a window blur close would keep `currentDoc` set and the
  session would silently REOPEN on window refocus (:104-111) — that path already self-heals,
  unlike the `onDocUnfocused` path.
- User input events (`mousedown`, `mousemove`, …, :8-15) only feed idle detection
  (`onUserActivity`), captured at document level; they never close sessions.

## 3. Tracked view types

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/Constants.ts:1-2`

```ts
export const TRACKED_VIEW_TYPES = new Set(['markdown', 'canvas', 'excalidraw']);
export const TRACKED_EXTENSIONS = new Set(["md", "canvas", "excalidraw"]);
```

File: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin-mirror-1/src/core/util/vault/IsTrackedProvider.ts:18-35`

`isTrackedView` requires: non-null view, view type ∈ TRACKED_VIEW_TYPES, a runtime `file`
property with a non-null `path`, path not under `_visit_history`. A view of type `canvas`
whose `file` is momentarily `null`, or any transient view type (`empty`, `file-explorer`,
suggester-backed surfaces), or a `null` leaf all yield "untracked" → `nextEvent = null` →
unfocus.

What canvas "add note" does in Obsidian (background knowledge, not verifiable in this repo —
the `obsidian` package is types-only): the canvas toolbar's "Add note from vault" / card
palette opens a **modal/suggester**, and dropping an md card gives the card an **embedded
inline markdown editor**. Whether Obsidian fires `active-leaf-change(null)` when a modal
takes focus, or activates a different leaf for the embedded editor, cannot be determined from
this codebase — it must be confirmed empirically (e.g. temporary logging of the leaf/view
type received). The FocusTracker code makes clear that ANY of these variants
(null leaf / untracked view type / canvas view with `file` null) produces the observed split.

## 4. Existing tests and fakes

- `/home/…/src/core/focusTracker/FocusTracker.test.ts` — 8 tests. Directly relevant:
  - `:159` "should NOT dispatch unfocus on a duplicate event for the same focused file"
  - `:175` "should NOT dispatch unfocus when the same file is refocused in a DIFFERENT leaf"
  - `:191` "should dispatch unfocus when the active leaf becomes null" — **this test pins the
    exact behavior that produces the bug** (a null leaf immediately unfocuses).
  - `:125` same-leaf nav to untracked view (PDF) → unfocus (deliberate semantics).
  - Test harness: `makeStubPlugin()` captures the `active-leaf-change` callback; `makeView`/
    `makeMutableLeaf`/`makeLeaf` build fake leaves; `OWNER_DOC` plain object as window handle;
    `RecordingListener` with an optional async gate for interleaving tests.
- `/home/…/src/core/focusDuration/FocusDurationTracker.test.ts` — 30 tests (see `it(` list):
  duplicate-focus no-fragment (:72), `A -> B -> A` = three sessions (:84), window blur/refocus
  = new session (:112), idle close/resume (:271-336), sleep retroactive cutoff (:356-396).
  **No test covers unfocus→refocus of the SAME doc within a short interval** — because today
  that is simply two sessions by design.
- `/home/…/src/core/focusTracker/listener/VhV3FocusDurationListener.test.ts` — 6 tests
  (id resolution failure → `onDocUnfocused`, etc.).
- `/home/…/src/core/focusDuration/WindowActivityMonitor.test.ts` — popout
  registration tests.
- Fakes available in `/home/…/src/testSupport/`: `fakes.ts` (incl. `FakeDocIdService`),
  `fileFactory.ts` (`makeTFile`), `FakeHiddenFileUtil`, `FakeNoteFileUtil`,
  `obsidianMock.ts` (runtime stand-in for the types-only `obsidian` npm package, aliased in
  `vitest.config.ts`). No fake timer helpers — `FocusDurationTracker.test.ts` uses vitest
  fake timers/`Date.now` control directly (Obsidian-agnostic class).

## 5. Session semantics — precise data cost of the bug

Sink → `/home/…/src/core/focusDuration/VhV3DurationRecorder.ts` → `VhV3DurationStore.appendFocusDuration`
appends one line per completed session to
`.visit_history/user/<user>/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3`:
`<ISO start stamp> D:<millis>` (docs/visit-history-format.md:49-60).

Per split (unfocus at t1, refocus at t2, final close at t3):

- **Two lines instead of one**: `[t0, t1]` and `[t2, t3]`.
- **The gap `t2 − t1` is LOST focus time.** With a mere re-render blip the gap is milliseconds;
  if the user spends time in the card-picker modal choosing a note, that whole interval is
  dropped even though the user is actively working in the canvas.
- Writes are append-only through one serialized chain (VhV3DurationRecorder.ts:27-43); the
  first session's line is on disk (and in `LastVisitCache`) by the time the second closes —
  no in-memory pending state survives the split that could be merged later.
- Heatmap "last visited" = max session START stamp, so the split adds an extra start stamp —
  harmless for last-visit, but session counts/aggregations over `.vh_v3` see inflated session
  counts and slightly deflated total durations.

## 6. Existing grace-period / merge logic reusable?

- **None exists.** Greps for grace/debounce/merge find only: max-merge in
  `VisitHistoryServiceV3` (LastVisitCache race, unrelated), heatmap saveData debounce
  (`HeatmapConfigStore`), and comments.
- Closest reusable **patterns** (not code):
  - `FocusDurationTracker`'s idle timer (`armIdleTimer`/`clearIdleTimer`/`onIdleTimerFired`,
    :167-199) — a self-managed single `setTimeout`, DOM-agnostic, fully unit-tested with fake
    timers. A "pending unfocus" grace timer could mirror it exactly.
  - The tracker's existing "session closed but `currentDoc` retained → next
    focus/interaction reopens" design (window blur + idle paths, :48-52) — the conceptual hook
    a grace mechanism would extend.
  - Idle timeout setting plumbing (`IdleTimeoutMsProvider`, settings.ts
    `idleTimeoutSeconds`) shows how a configurable duration is injected; a grace constant
    would more likely be a fixed named constant (no user knob needed).

## 7. Relevant CLAUDE.md / docs statements

- CLAUDE.md (project): FocusTracker "tracks focused FILE, not leaf — unfocus fires on any
  file change, incl. same-leaf nav to untracked views"; "FocusTracker dispatch is SERIALIZED";
  `FocusDurationTracker` "closes a session on navigation away, blur of the window HOSTING the
  doc, idle timeout …"; "A visit becomes visible only once its session CLOSES".
- `docs/architecture.md:14-28, 81-108`: same pipeline map; :202 one throwing listener isolated.
- `docs/visit-history-format.md:60-…`: session close conditions (navigation away, hosting
  window blur, idle timeout, unload flush).
- A grace/merge fix would need these docs + CLAUDE.md updated ("unfocus fires on any file
  change" would gain a qualifier).
- `docs/tickets/` has no ticket for this bug; `retry-doc-id-on-modify.md` and
  `id-lib-canvas-ensureid-return-asymmetry.md` touch canvas/doc-id but not focus semantics.

---

## Hypotheses on root cause (ranked)

1. **[Most likely] Obsidian fires a transient `active-leaf-change` with `null` or an
   untracked/file-less view when the canvas card-creation UI takes focus** (card palette /
   "Add note from vault" suggester / the new card's embedded editor grabbing keyboard focus),
   then fires again for the canvas leaf when the card is placed. Evidence: FocusTracker.ts:100
   converts ANY such event into an instant unfocus (behavior pinned by
   FocusTracker.test.ts:191); the same-file dedupe (:100, `!== nextEvent?.file.path`) only
   protects when the intermediate event still reports the canvas file. This is the only
   mechanism in this codebase that produces exactly "unfocus then refocus of the same file".
   The precise leaf/view Obsidian reports must be confirmed empirically (temporary logging).
2. **[Possible, lower] The canvas card editor activates a DIFFERENT leaf whose view is
   `canvas`-embedded markdown with `file === null`** → `isTrackedView` false (IsTrackedProvider.ts:29-33)
   → same unfocus path as H1. Functionally identical outcome; distinguishes only WHAT the
   transient event carries.
3. **[Unlikely] Window blur**: only plausible if the affordance opens a native OS surface;
   window-blur closes self-heal on refocus (session reopens via
   FocusDurationTracker.ts:104-111) — the doc would still be `currentDoc`. The reported
   symptom ("plugin registers unfocus … re-focus when placed") matches the leaf-change path,
   and an intra-window popup cannot fire `window.blur`. Also blur alone still splits into two
   .vh_v3 lines, so it cannot be ruled out purely from the data.
4. **[Very unlikely] Id-resolution failure path** (VhV3FocusDurationListener.ts:35-41) — would
   require `ensureDocId` to transiently fail for an already-id'd canvas; no evidence.

## Candidate fix directions (no plan)

1. **Grace period inside `FocusDurationTracker`**: `onDocUnfocused` marks the session
   "pending close" (or closes lazily); a refocus of the SAME doc within N seconds resumes/
   continues instead of starting a new session. Pro: Obsidian-agnostic, unit-testable with the
   existing fake-timer test style, reuses the idle-timer pattern; Con: the grace tail counts
   as focus time when the user really did leave, and the sink record is delayed by N.
2. **Grace period in `FocusTracker` dispatch**: hold the unfocus dispatch for N ms; cancel it
   if the next event refocuses the same file. Pro: fixes it for ALL listeners at the source;
   Con: timers inside the serialized dispatch chain complicate ordering guarantees, and it
   changes documented FocusTracker semantics for every listener.
3. **Smarter transient-event filtering in `FocusTracker`**: on a null/untracked event, check
   whether the previously focused file's leaf/view still exists and still shows that file
   (workspace query) and skip the unfocus if so. Pro: no timers, targets root cause; Con:
   leans on Obsidian workspace internals, risks regressing the DELIBERATE "same-leaf nav to
   untracked view unfocuses" behavior (test :125), and may not distinguish "canvas still open
   in background" from "user actually moved elsewhere".
4. **Merge at write time (`VhV3DurationRecorder`/store)**: when appending, if the previous
   line is the same doc and ends within N ms of the new start, rewrite it as one merged
   session. Pro: trackers untouched; Con: breaks the append-only store contract
   (read-modify-write, sync-conflict surface), and the intermediate state was already
   published to `LastVisitCache`.

**Empirical confirmation step (cheap, prerequisite for choosing between 1-3):** temporarily
log leaf/view-type/file in `handleLeafChange` and reproduce the canvas interaction to learn
exactly what event Obsidian emits (H1 vs H2 vs H3).
