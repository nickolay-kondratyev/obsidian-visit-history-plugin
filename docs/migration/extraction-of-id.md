# Shared Note-ID Library — Problem & Design Brief

> **STATUS: IMPLEMENTED** — the library lives in `submodules/obsidian-id-lib`
> (git submodule, own repo), consumed via the `"obsidian-id-lib": "file:..."`
> npm dependency and bundled by esbuild. See the lib README for the public
> contracts (window lock key at `ref.ap_e7fWGWziwxrLmnegjIYKX_E`, id format at
> `ref.ap_iZAE3fAcs5zXIWrTiIdx3_E`). This brief records the problem and the
> final decisions.

## Problem

We have two Obsidian plugins that both need a unique identifier present in each note's frontmatter. Each plugin, on `file-open`, wants to ensure the opened note has an `id` — creating one if absent. Both plugins may be installed together, installed alone, and ship/version independently.

The core hazard is a **read-modify-write race**: when a note without an ID opens, both plugins fire on the same event, both observe "no ID," both generate one, and both write — producing duplicate/clobbered frontmatter or two competing IDs. Obsidian offers no official plugin-dependency mechanism and no cross-plugin write lock, so coordination must be built.

Two facts shape the solution:
- Both plugins run in the **same renderer process** (same `window`), so coordination can be in-process — no filesystem lockfiles (which also break on mobile, where there's no Node `fs`).
- Because the library is **bundled into each plugin**, each plugin gets its *own copy* of the code. Any shared state must live on a shared global (`window`), not in a module-level variable, or the two copies won't rendezvous.

## Solution

Extract a small reusable library, bundled into both plugins, providing safe ID read/ensure with cross-plugin serialization. Scope covers markdown frontmatter AND `.canvas` files (`metadata.frontmatter.id`), incl. the empty-file-as-new-canvas rule.

**1. Per-path async lock on a versioned `window` global.** *(implemented as `CrossPluginPathLock`)*
A lock registry (`Map<path, Promise>`) hangs off a namespaced, versioned `window` key, so both bundled copies share one registry. **Final key: `__obsidian_id_lib_path_lock_registry_v1__`; value shape: a plain `Map<string, Promise<unknown>>` — path → current tail promise.** Locking is **per file path**: distinct files proceed in parallel; only same-path writes serialize. Acquire by chaining off the path's current tail promise; release is implicit — the stored tail settles on success or throw (guaranteed release, **no timeout/expiry**). A predecessor's rejection must not wedge the chain (swallow it so the next waiter still runs), the stored tail itself never rejects (protects foreign waiters), and only the current tail cleans up its `Map` entry (`=== next` guard) to avoid detaching a queued successor. The lock guards the WHOLE read-decide-write inside `DocIdService.ensureDocId`; the read-only `getDocId` stays lock-free.

**2. Collision-safe ID generation.** *(implemented as `DocIdGeneratorDefault`)*
IDs are crypto-random `docid_{24 base36 lowercase}_e` (36^24 > 2^122 — random space above UUID v4) — never a counter or content-hash that two plugins could compute identically. **Existing ids of ANY format are honored as-is** (never rewritten), and an occupied-but-unusable id slot is never overwritten.

**3. Idempotency backstop inside the atomic `Vault.process` transform.**
All writes go through raw-text edits inside `Vault.process`, and the transform re-checks for an existing ID before writing. This is the seatbelt: even if the lock fails to engage (version-mismatched copies, a third plugin not using the lib), the second writer sees the existing ID and bails. Notes that already have an ID short-circuit on the cached-read fast path — the majority path.
**WHY-NOT `app.fileManager.processFrontMatter`** (this brief's original suggestion): it re-serializes the WHOLE frontmatter block, normalizing formatting of keys the plugin does not own (e.g. stripping quotes from `"some key": v`). The raw-text edit only ever adds/fills the single id line and leaves every other byte untouched, while `Vault.process` keeps the read-modify-write atomic — the backstop's goal is fully met without the formatting damage (owner decision, carried over from the plugin).

## Library API surface

DI-style classes behind interfaces (no free functions), plus a one-line facade:

- `DocIdServices.createDefault(app.vault)` — wires generator + both stores + the cross-plugin lock.
- `DocIdService.getDocId(file)` — read-only; returns the existing ID or null. Lock-free; never writes.
- `DocIdService.ensureDocId(file)` — lock-guarded read-or-create; the single entry point for creation.
- Custom wiring: `DocIdServiceDefault(frontmatterStore, canvasStore, pathLock)` with `FrontmatterDocIdStore`/`CanvasDocIdStore` over the 2-method `FileContentAccess` seam (`cachedRead` + `process`), `DocIdGeneratorDefault`, `CrossPluginPathLock`. The `PathLock` constructor arg is REQUIRED so an unlocked wiring cannot happen by accident.

## Contracts to preserve

- **The `window` registry key is a cross-plugin API.** Its name (`__obsidian_id_lib_path_lock_registry_v1__`) and value shape (a plain `Map<string, Promise<unknown>>` of path → tail) are a compatibility contract between bundled copies — possibly of different library versions. Keep the value a plain Promise so versions interoperate; bump the key only as a deliberate breaking change. (`ref.ap_e7fWGWziwxrLmnegjIYKX_E`)
- **The frontmatter ID field name and format** (`id`, `docid_{24 base36 lowercase}_e`, existing ids honored as-is) is the real on-disk contract — more important than any code interface. Version it explicitly if it may evolve. (`ref.ap_iZAE3fAcs5zXIWrTiIdx3_E`)

## Non-goals

- No filesystem/temp-file locks; no holder timeouts or lock expiry.
- No reliance on Obsidian serializing concurrent writes — the `window` lock is the primary mechanism, the in-transform idempotency check the backstop.
