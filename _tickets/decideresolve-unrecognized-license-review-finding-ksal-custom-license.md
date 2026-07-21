---
closed_iso: 2026-07-21T01:39:31Z
id: nid_0s630n2q2semscvz2ia77xpuh_E
title: "Decide/resolve unrecognized-license review finding (KSAL custom license)"
status: closed
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:39:31Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-review, license, owner-decision]
---

Obsidian/GitHub review: "The repository does not have a recognized license." CONTEXT: this is NOT a missing file — LICENSE.md exists and package.json declares `"license": "LicenseRef-KSAL-2.3"` (Kondratyev Source Available License, Version 2.3 — a custom, non-SPDX source-available license). GitHub's/Obsidian's license detector only recognizes standard SPDX licenses, hence the flag.

This is primarily an OWNER DECISION, not a mechanical fix. Options to present/act on:
1) Accept as-is (intentional custom source-available license) — document that the "unrecognized license" flag is expected and won't change; possibly rename file to plain `LICENSE` so GitHub at least surfaces it in the sidebar (detector still won't SPDX-match).
2) If broad recognition matters for the Obsidian community-plugin listing, adopt a recognized SPDX license — requires explicit owner approval (changes licensing terms; do NOT do this without human sign-off).

DO NOT change the license terms without explicit human approval (per CLAUDE.md: deviations from owner intent need approval; licensing is high-stakes). Recommended default action: keep KSAL, optionally rename LICENSE.md -> LICENSE, and record the decision here.

VERIFY: decision recorded; if only the file rename is done, confirm package.json `license` field + any references stay consistent.

## Acceptance Criteria

Owner decision recorded; license terms unchanged unless explicitly approved; any file rename keeps package.json license field consistent.

## Decision (recorded 2026-07-20)

**Chosen: Option 1 — Accept as-is. Keep KSAL-2.3. Do NOT rename `LICENSE.md`. License terms UNCHANGED.**

The "unrecognized license" flag is **expected and will not change**: GitHub's/Obsidian's
detector only SPDX-matches standard licenses, and KSAL-2.3 is an intentional custom
source-available license. This is a non-blocking, cosmetic classification — not an error.

Why the state is already correct (no code/config change needed):
- `LICENSE.md` present at repo root (KSAL-2.3 full text).
- `package.json` → `"license": "LicenseRef-KSAL-2.3"` — the SPDX-conformant `LicenseRef-`
  idiom for a non-standard license. Already best-practice; left unchanged.
- `README.md#license` and `docs/how-to-publish.md` disclose the license and already note
  Obsidian imposes no license-type requirement (e.g. Smart Connections ships a custom license
  and stays listed). References remain consistent.

Why the OPTIONAL rename `LICENSE.md` → `LICENSE` was **declined** (Pareto):
- GitHub already surfaces `LICENSE.md` in the repo sidebar/"License" link; renaming adds no
  surfacing benefit.
- The SPDX detector still won't match regardless of filename — the flag is about content, not name.
- Rename would churn two references (`README.md:151`, `docs/how-to-publish.md:162`) for zero value.

Option 2 (adopt a recognized SPDX license) is **NOT pursued** — it changes licensing terms and
requires explicit human sign-off. Revisit only if the owner decides broad SPDX recognition
outweighs the current source-available terms.

