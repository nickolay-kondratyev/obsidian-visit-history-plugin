# PARETO_COMPLEXITY_ANALYSIS — PRIVATE notes

## What I verified (commit 4783ad5)
- Production diff: +8 lines in `CanvasDocIdStore.ts`, of which 4 are code
  (`if (content.trim() === '') return {};`) and 4 are comments/doc-comment.
  Zero new classes, interfaces, config, or branches elsewhere.
- Single-seam claim verified by grep: `parseCanvas` is the ONLY JSON.parse
  site and is used by all 3 callers (getId L26, ensureId pre-check L51,
  in-transform re-parse L40). The clarification's key constraint
  ("re-parse inside Vault.process must also treat empty as {} or the write
  silently no-ops") is satisfied structurally, not by duplicated logic —
  the DRY-est possible shape.
- Tests: 4 (1 inverted per approved decision #2, +3 new). Each covers a
  distinct concern: read-only getId must NOT write/log; empty→id written;
  whitespace→same; `{}` baseline. The whitespace test is the only one that
  borders on redundant with empty-string (same code path after trim), but
  it pins the trim() semantics — acceptable, ~10 lines.
- Docs: AGENTS.md + docs/architecture.md updated to keep the "malformed
  never throws" invariant statement truthful (empty is NOT malformed).
  Required, since the old text now lies otherwise.
- Scope discipline: retry-on-modify explicitly deferred (clarification
  decision #3) — the tempting scope creep was declined. Good.

## Considered and rejected concerns
- "4 tests for a 4-line fix — over-tested?" No: the getId test guards the
  bulk-read invariant (read paths must never write), which is a separate
  business rule, not the same behavior re-asserted.
- Under-engineering check: could a canvas synced-in as empty then edited
  lose data? No — id write goes through Vault.process which re-reads
  current content; if content is no longer empty it parses normally, and
  the transform only adds the id key.

## Verdict reasoning
Value: real user-visible bug (every brand-new canvas silently untracked
until manually edited) fixed at the root. Complexity: near-minimum
possible. Ratio: about as high as it gets.
