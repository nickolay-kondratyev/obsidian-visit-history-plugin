# CLARIFICATION — resolved decisions (from HUMAN, 2026-07-16)

Feature: extract-id-lib | Branch: move-id-out

## Resolved decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Write mechanism: `processFrontMatter` (design brief) vs raw-text `Vault.process` (current code) | **Keep raw-text `Vault.process` + in-transform re-check.** Update the design brief (docs/migration/extraction-of-id.md). KEY REQUIREMENT: the cross-plugin LOCK (per-path async lock on versioned `window` global) is the critical part — it MUST be implemented. |
| Q2 | Id format contract | **Library standardizes on `docid_{24 base36 lowercase}_e`.** Existing ids of ANY format honored as-is (never rewritten). Other plugin confirmed OK with this scheme. |
| Q3 | API shape | **DI-style classes behind interfaces** (plugin wires them). Optionally a thin `app`-taking facade for easy adoption. No free-floating functions. |
| Q4 | Canvas scope | **Canvas support moves INTO the library** (md frontmatter + canvas `metadata.frontmatter.id`, incl. empty-file-as-new-canvas rule). |
| — | Unused `ulid` npm dependency | **Remove it** (approved by human). |

## Non-negotiables carried forward
- Cross-plugin per-path async lock on a versioned `window` global per docs/migration/extraction-of-id.md §Solution.1 (Promise-chain registry, finally-release, no timeout/expiry, tail-cleanup `=== next` guard, predecessor-rejection swallow).
- Library bundles into each plugin (esbuild); shared state ONLY on `window`, never module-level.
- Idempotency backstop: re-check for existing id inside the atomic write transform.
- Existing behavior preserved: unusable occupied id slot never overwritten; raw `.excalidraw` skipped; bulk read paths never write.
