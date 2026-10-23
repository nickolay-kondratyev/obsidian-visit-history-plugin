#!/usr/bin/env bash
# The `android:push-plugin` entry point (see docs/android-tablet-testing.md).
#
# Builds the plugin, pushes only its code files (main.js, manifest.json, styles.css)
# into the dev vault on the running tablet emulator, then restarts Obsidian so the
# new code loads. data.json is NOT pushed, so the plugin's tablet settings are kept.
#
# Prerequisite: npm run android:setup (emulator running + dev vault on the tablet).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
# shellcheck source-path=SCRIPTDIR source=android-tablet-emulator-common.sh
source "${script_dir}/android-tablet-emulator-common.sh"

print_usage() {
  log "Usage: ${0##*/}   (no arguments; npm run android:push-plugin)"
  log "  Builds the plugin and pushes it into [${DEVICE_PLUGIN_DIR}] on the running"
  log "  tablet emulator, then restarts Obsidian. Run npm run android:setup first."
}

push_plugin_code_files() {
  local serial="${1:?serial}"
  local code_file
  for code_file in "${PLUGIN_CODE_FILES[@]}"; do
    [[ -f "${repo_root}/${code_file}" ]] || die "Built file missing (did the build fail?). file=[${repo_root}/${code_file}]"
    "${ADB}" -s "${serial}" push -q "${repo_root}/${code_file}" "${DEVICE_PLUGIN_DIR}/"
    log "Pushed. file=[${code_file}]"
  done
}

restart_obsidian() {
  local serial="${1:?serial}"
  "${ADB}" -s "${serial}" shell am force-stop "${OBSIDIAN_PACKAGE}"
  # [monkey -p PKG -c LAUNCHER 1]: sends one launcher-intent event to PKG, i.e. taps its app icon.
  "${ADB}" -s "${serial}" shell monkey -p "${OBSIDIAN_PACKAGE}" -c android.intent.category.LAUNCHER 1 > /dev/null
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_usage
    return 0
  fi
  if [[ $# -ne 0 ]]; then
    print_usage
    return 1
  fi

  [[ -x "${ADB}" ]] \
    || die "adb not found; run npm run android:setup first (or set ANDROID_HOME to the SDK dir it used). adb=[${ADB}]"

  local serial
  serial="$(find_emulator_serial)" \
    || die "Tablet emulator is not running; run npm run android:setup first. avd=[${AVD_PROFILE}]"

  # The plugin dir implies the vault: both come from the setup copy.
  "${ADB}" -s "${serial}" shell "[ -d $(device_shell_quote "${DEVICE_PLUGIN_DIR}") ]" \
    || die "Dev vault (with the plugin) not found on the tablet; run npm run android:setup first. device_plugin_dir=[${DEVICE_PLUGIN_DIR}]"

  (cd "${repo_root}" && npm run build)

  push_plugin_code_files "${serial}"
  restart_obsidian "${serial}"
  log "Plugin pushed and Obsidian restarted. serial=[${serial}] device_plugin_dir=[${DEVICE_PLUGIN_DIR}]"
}

main "$@"
