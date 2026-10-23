---
id: nid_2sx3if2tus8bc7j3i4oio11b7_e
title: "Automated Android tablet smoke tests (Obsidian mobile WebView over CDP)"
status: open
deps: []
links: [nid_8u6pi2do1vss1yt2hfgc6uicc_e, nid_u48zcq4xb5jni7w3jrwqdc405_E]
created_iso: 2026-10-23T15:56:17Z
status_updated_iso: 2026-10-23T15:56:17Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [e2e, obsidian-mobile, playwright, decide]
---

## Goal

The plugin claims mobile support (`manifest.json`: `"isDesktopOnly": false`), but only desktop Obsidian is tested (`npm run test:e2e`, `docs/e2e-testing.md`). Mobile-only breakage, such as tablet CSS hiding the heatmap icons (ticket `nid_8u6pi2do1vss1yt2hfgc6uicc_e`), goes unseen until someone looks by hand. Add a small automated smoke suite that runs against real Obsidian on the Android tablet emulator and catches that kind of regression. This is the owner's stated direction ("build towards"), and the manual scripts are step one.

## Done criteria

- With the emulator set up (`npm run android:setup`), one command (for example `npm run test:android`) runs the suite non-interactively and exits non-zero on failure.
- The suite opens the dev vault in Obsidian on the emulator with no human taps (see Decide below), loads the freshly built plugin and opens the heatmap view.
- It has at least these smoke checks:
  - The plugin is enabled and loaded.
  - The heatmap view opens.
  - Every heatmap header icon SVG has a non-zero rendered width. This is the regression guard for ticket `nid_8u6pi2do1vss1yt2hfgc6uicc_e`.
- `docs/android-tablet-testing.md` documents how to run it and what it does not cover.

## Context

- Manual tooling, as of 2026-10-23 (on the branch that adds `scripts/android/`):
  - `npm run android:setup` installs the SDK tools, creates and starts the `medium_tablet` AVD, installs the Obsidian APK and copies `.dev-vault` to `/sdcard/Documents/visit-history-dev-vault`.
  - `npm run android:push-plugin` builds the plugin, pushes it and restarts Obsidian.
  - Docs: `docs/android-tablet-testing.md`.
- Verified 2026-10-23: Obsidian Android's WebView exposes Chrome DevTools at the abstract socket `webview_devtools_remote_<obsidian pid>`.
  - After `adb forward tcp:<port> localabstract:webview_devtools_remote_<pid>`, `http://127.0.0.1:<port>/json` lists the page.
  - CDP `Runtime.evaluate` works there (that is how the tablet CSS bug was diagnosed).
  - So Playwright `chromium.connectOverCDP` is a likely driver, consistent with the desktop suite in `e2e/`, which also uses Playwright.
- The desktop e2e harness is `e2e/obsidianHarness.ts` and `e2e/harnessFixture.ts`, with the seed vault `.dev-vault/` and `e2e/setupDevVault.mjs`. Reuse its patterns, but do not merge the two harnesses (different launch model).
- Related: ticket `nid_u48zcq4xb5jni7w3jrwqdc405_E` (desktop e2e in CI). Running the emulator in CI is out of scope here.

## Decide (before building)

What needs deciding: how to open the vault and get past first-run prompts without human taps. Today that is manual: "Use my existing vault", then the folder picker, "Allow", "Trust author and enable plugins", and the plugin's user-name modal. Obsidian keeps its vault list in private app storage that non-root adb cannot write on the Google Play system image.

Options:
- A: drive Obsidian's own onboarding UI through CDP (DOM clicks) and the Android system folder picker through `adb shell input` or uiautomator.
- B: use a `google_apis` (non-Play) AVD image, where `adb root` works, and pre-seed Obsidian's app storage.
- C: snapshot the AVD once after a manual first-run (`emulator -snapshot`), then always boot from that snapshot.

Recommendation: C first (cheapest, no brittle UI driving), with B as the fallback if snapshots prove flaky. Spike briefly before committing.

## Non-goals

- Running Android tests in CI.
- Phone form factor.
- Porting the full desktop e2e suite; keep it to a few smoke checks.
- iOS.
