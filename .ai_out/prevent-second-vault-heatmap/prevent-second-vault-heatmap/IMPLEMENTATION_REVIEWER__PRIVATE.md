# Implementation Reviewer — PRIVATE notes

## Session 2026-07-22

Reviewed commit 5ea7050 "feat(heatmap): prevent second vault-root heatmap".

### Verdict: READY (1 #QUESTION_FOR_HUMAN — minAppVersion bump)

### What I verified myself
- Ran build/test/lint fresh: build exit 0; 414 tests pass (6 new); lint 0
  errors, 1 pre-existing warning (ConfirmModal setWarning). Not just trusting
  the impl summary — re-ran.
- Traced the initial-flag race explicitly: default `atVaultRoot = true` in
  VaultTreemapView is CORRECT because (a) fresh vault-level view is at root, and
  (b) restored layout seeds folderSegments from initialFolderPath=undefined → [].
  isVaultLevel gate protects folder-targeted views.
- Confirmed trail-derived at-root (App.tsx:221 trail.length===0) not raw
  segments — honest for unresolvable paths. Matches ticket note.
- handleAtVaultRootChange is a stable bound field → effect dep identity stable,
  no spurious re-fires.
- revealLeaf typing at obsidian.d.ts:8029 = Promise<void>; the 1.7.2 requirement
  is a TYPING/lint-DB artifact — runtime revealLeaf predates it. Documented in
  PUBLIC as human decision with 3 options; recommended accept.

### Findings count
- BLOCKING: 0
- SHOULD-FIX: 0
- NICE-TO-HAVE: 2 (rapid double-open async race; wiring untested — both
  acceptable per Pareto/scope)

### Open item
- minAppVersion 1.5.7→1.7.2 needs owner sign-off. versions.json correctly
  untouched; release npm run version must record 1.7.2.
