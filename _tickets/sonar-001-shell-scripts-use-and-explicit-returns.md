---
id: nid_f6rm1i0yvyk0fxqxd5b7zivki_E
title: "sonar-001: Shell scripts — use [[ ]] and explicit returns"
status: old
deps: []
links: []
created_iso: 2026-07-20T23:33:36Z
status_updated_iso: 2026-10-23T15:56:57Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sonar, shell]
---

Fix SonarQube MAJOR shell-script findings. All bash; process together.

Rule shelldre:S7688 (use `[[` instead of `[` for conditional tests):
- scripts/release.sh:30, :36, :46, :55, :69
- scripts/verify-release.sh:19, :41

Rule shelldre:S7682 (add explicit return at end of function):
- external_release_with_patch_version.sh:4
- build.sh:4

Acceptance: swap `[ ... ]` for `[[ ... ]]` at listed lines (verify quoting/globbing semantics unchanged); add explicit `return` at end of the flagged functions. Run each script / shellcheck if available.

Sonar keys: AZ-A6ZFDvHH-bhIdtzMm/n/o/p/q, AZ-A6ZHJvHH-bhIdtzMr/s, AZ-BwPhgGGwPEcqwBqgh, AZ6O-yM_1xdYyyVCMYFA


## Notes

**2026-10-23T15:56:57Z**

Marked old (2026-10-23 ticket triage): already done — scripts/release.sh and scripts/verify-release.sh use [[ ]]; build.sh and external_release_with_patch_version.sh main() end with explicit return.
