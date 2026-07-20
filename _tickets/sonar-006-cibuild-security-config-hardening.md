---
id: nid_e4zwzp2lq5rh8ipo2pizydqbo_E
title: "sonar-006: CI/build security config hardening"
status: open
deps: []
links: []
created_iso: 2026-07-20T23:33:54Z
status_updated_iso: 2026-07-20T23:33:54Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sonar, security, ci]
---

Fix SonarQube MAJOR security/vulnerability findings in CI/build config.

Rule githubactions:S6505 (omitting --ignore-scripts allows lifecycle scripts during install):
- .github/workflows/lint.yml:27 (npm install/ci step)
- .github/workflows/release.yml:28 (npm install/ci step)
  Fix: add `--ignore-scripts` to the npm install commands. VERIFY the build still works — this plugin bundles obsidian-id-lib via a file: dep; confirm no required lifecycle/prepare script is skipped, or add an explicit build step.

Rule text:S8569 (build.gradle.kts): dependency versions not predictable without a lock file.
- build.gradle.kts (no line) — CONFIRM WITH OWNER whether build.gradle.kts is still relevant to this npm/TS plugin. If unused, remove it (best fix); otherwise add gradle.lockfile / verification-metadata.xml.

Acceptance: workflows still pass; decision on build.gradle.kts recorded.

Sonar keys: AZ-AslUyw_Adoi_0Ajsw, AZ-AslSjw_Adoi_0Ajsv, AZ6TcnYW9gwWsKrrQtdQ

