# Android tablet testing (emulator)

Manual testing of the plugin in Obsidian for Android, on a local tablet emulator
(Linux x86_64 with KVM). The tablet gets a one-way copy of the committed seed vault
`.dev-vault/` (A.md, B.md, C.canvas + the plugin build, enabled in the tablet copy),
named `visit-history-dev-vault` on the device. Your own vaults are never touched.

## Commands

```bash
npm run android:setup        # emulator + Obsidian + dev vault (safe to re-run)
npm run android:push-plugin  # rebuild, push the plugin, restart Obsidian
```

- `android:setup` builds the plugin into `.dev-vault` (`npm run setup:dev-vault`),
  installs the Android command-line tools, creates and starts the `medium_tablet`
  emulator (the first run downloads the emulator and system image, several
  minutes), installs the pinned Obsidian APK and copies the vault to
  `/sdcard/Documents/visit-history-dev-vault`. A re-run refreshes the
  copy; the previous tablet copy is moved to `/sdcard/Documents/.vault_backups/`.
- `android:push-plugin` pushes only `main.js`, `manifest.json` and `styles.css`.
  `data.json` is not pushed, so the plugin settings on the tablet are kept. It
  needs the emulator running and the vault on the tablet (run `android:setup` first).
  The restart reopens the vault Obsidian had open last. If that is another vault
  on the tablet (it has its own copy of the plugin), the pushed build is not what
  runs: open `visit-history-dev-vault` once (next section) and later restarts
  reopen it.

Pinned versions (cmdline-tools build, Obsidian APK version, AVD profile) are
constants at the top of the scripts in `scripts/android/`.

## SDK location: `ANDROID_HOME`

The SDK lives in `${ANDROID_HOME}`, default `~/Android/Sdk`. If that dir is not
writable (e.g. created by root), set `ANDROID_HOME` to a writable dir and use the
same value for both commands:

```bash
ANDROID_HOME=~/android-sdk npm run android:setup
```

Your user also needs read/write access to `/dev/kvm` (the `kvm` group), and
`curl`, `unzip` and GNU `tar` on the host.

## Emulator crashed (setup stops with exit 255, `adb: device ... not found`)

The emulator process died, usually in its GPU renderer right after a quick-boot
snapshot restore (seen once with emulator 37.2.12; `coredumpctl list` shows a
`qemu-system-x86_64` SIGSEGV). Start it cold, without the snapshot, then re-run setup:

```bash
"${ANDROID_HOME}/cmdline-tools/latest/bin/android" --sdk="${ANDROID_HOME}" emulator start --cold medium_tablet
npm run android:setup
```

## One-time manual steps: open the dev vault in Obsidian

The scripts cannot add the vault to Obsidian's vault list: Obsidian keeps it in
private app storage, which adb cannot write without root. Once per fresh emulator
(or when Obsidian shows another vault), tap:

1. Fresh install: Obsidian -> "Use my existing vault" -> "On this device" ->
   "Choose folder". Another vault already open: vault switcher -> "Open folder as vault".
2. Documents/visit-history-dev-vault -> "Use this folder" -> "Allow"
3. "Trust author and enable plugins" (Obsidian asks because the vault has a
   community plugin enabled).
4. The plugin's "Choose your visit history user name" prompt: pick a name.
   Until a name is confirmed, no visit history is recorded. No prompt when this
   device already pinned a name (the pin is per device, not per vault).

## Inspecting the running plugin (Chrome DevTools)

Obsidian for Android runs in a WebView that exposes Chrome DevTools. Easiest:
open `chrome://inspect` in desktop Chrome and pick the Obsidian page.

Scriptable variant (the basis for future automated mobile tests). `adb` is
`${ANDROID_HOME}/platform-tools/adb`:

```bash
pid="$(adb shell pidof md.obsidian | tr -d '\r')"
adb shell cat /proc/net/unix | grep "webview_devtools_remote_${pid}"   # socket exists?
adb forward tcp:9333 "localabstract:webview_devtools_remote_${pid}"
curl -s http://127.0.0.1:9333/json   # page entry with webSocketDebuggerUrl
```

Connect a CDP client to `webSocketDebuggerUrl`; `Runtime.evaluate` works (e.g.
read `app.plugins.plugins['visit-history']`) and so does `Page.captureScreenshot`.
Playwright's `chromium.connectOverCDP` does NOT work here (fails with
`Browser context management is not supported`), so talk raw CDP to the page
websocket (Node's built-in `WebSocket` is enough). Remove the forward when done:

```bash
adb forward --remove tcp:9333
```
