# Shared Note-ID Library — Problem & Design Brief

## Problem

We have two Obsidian plugins that both need a unique identifier present in each note's frontmatter. Each plugin, on `file-open`, wants to ensure the opened note has an `id` — creating one if absent. Both plugins may be installed together, installed alone, and ship/version independently.

The core hazard is a **read-modify-write race**: when a note without an ID opens, both plugins fire on the same event, both observe "no ID," both generate one, and both write — producing duplicate/clobbered frontmatter or two competing IDs. Obsidian offers no official plugin-dependency mechanism and no cross-plugin write lock, so coordination must be built.

Two facts shape the solution:
- Both plugins run in the **same renderer process** (same `window`), so coordination can be in-process — no filesystem lockfiles (which also break on mobile, where there's no Node `fs`).
- Because the library is **bundled into each plugin**, each plugin gets its *own copy* of the code. Any shared state must live on a shared global (`window`), not in a module-level variable, or the two copies won't rendezvous.

## Solution

Extract a small reusable library, bundled into both plugins, providing safe ID read/ensure with cross-plugin serialization.

**1. Per-path async lock on a versioned `window` global.**
A lock registry (`Map<path, Promise>`) hangs off a namespaced, versioned `window` key (e.g. `__note-id-lock-registry-v1__`), so both bundled copies share one registry. Locking is **per file path**: distinct files proceed in parallel; only same-path writes serialize. Acquire by chaining off the path's current tail promise; release in a `finally` (guaranteed release on success or throw — **no timeout/expiry**). A predecessor's rejection must not wedge the chain (swallow it so the next waiter still runs), and only the current tail cleans up its `Map` entry (`=== next` guard) to avoid detaching a queued successor.

**2. Collision-safe ID generation.**
IDs use a collision-safe generator (uuid/nanoid) — never a counter or content-hash that two plugins could compute identically.

**3. Idempotency backstop inside `processFrontMatter`.**
All frontmatter writes go through `app.fileManager.processFrontMatter`, and the callback checks `if (fm.id) return` before writing. This is the seatbelt: even if the lock fails to engage (version-mismatched copies, a third plugin not using the lib), the second writer sees the existing ID and bails. Notes that already have an ID short-circuit here — the majority path.

## Library API surface

- `getId(app, file)` — read-only; returns the existing ID or null. Available to all consumers.
- `ensureId(app, file)` — lock-guarded read-or-create; returns the ID. This is the single entry point for creation.

## Contracts to preserve

- **The `window` registry key is a cross-plugin API.** Its name and value shape (a plain Promise chain) are a compatibility contract between bundled copies — possibly of different library versions. Keep the value a plain Promise so versions interoperate; bump the key only as a deliberate breaking change.
- **The frontmatter ID field name and format** (`id`, and its scheme) is the real on-disk contract — more important than any code interface. Version it explicitly if it may evolve.

## Non-goals

- No filesystem/temp-file locks; no holder timeouts or lock expiry.
- No reliance on Obsidian serializing concurrent `processFrontMatter` calls — the `window` lock is the primary mechanism, the idempotency check the backstop.