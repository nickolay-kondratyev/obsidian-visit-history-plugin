#!/usr/bin/env bash
# Shared constants + helpers for the Android tablet emulator dev scripts in this
# directory (see docs/android-tablet-testing.md). Sourced, not run.
# shellcheck disable=SC2034 # constants are used by the scripts that source this file

# ==============================================================================
# CONFIGURATION CONSTANTS
# ==============================================================================

# Override with ANDROID_HOME, e.g. when ~/Android/Sdk exists but is not writable.
readonly SDK_DIR="${ANDROID_HOME:-${HOME}/Android/Sdk}"

# Device profile of the Android CLI (`android emulator create --list-profiles`).
# The CLI names the AVD after its profile, so this is also the AVD name.
readonly AVD_PROFILE="medium_tablet"

readonly OBSIDIAN_PACKAGE="md.obsidian"

# Shared storage, so Obsidian ("On this device" -> "Choose folder") can see it.
readonly DEVICE_VAULTS_DIR="/sdcard/Documents"
# WHY-NOT '.dev-vault': a dot-folder is hidden in the folder picker and would make
# the vault's name in Obsidian '.dev-vault'.
readonly DEVICE_VAULT_NAME="visit-history-dev-vault"

# Plugin files Obsidian loads. data.json (settings) is deliberately not listed:
# a plugin push must keep the tablet's settings.
readonly PLUGIN_CODE_FILES=(main.js manifest.json styles.css)
readonly PLUGIN_DIR_IN_VAULT=".obsidian/plugins/visit-history"

# ==============================================================================
# DERIVED PATHS
# ==============================================================================

readonly ADB="${SDK_DIR}/platform-tools/adb"
readonly DEVICE_VAULT_DIR="${DEVICE_VAULTS_DIR}/${DEVICE_VAULT_NAME}"
readonly DEVICE_PLUGIN_DIR="${DEVICE_VAULT_DIR}/${PLUGIN_DIR_IN_VAULT}"

# ==============================================================================
# FUNCTIONS
# ==============================================================================

log() { printf '[android] %s\n' "$*" >&2; }

die() {
  log "ERROR: $*"
  exit 1
}

# Single-quotes one value for the device's sh: 'adb shell "<cmd>"' runs <cmd> through the
# device shell, so paths with spaces or quotes must be escaped.
# [${1//\'/\'\\\'\'}]: replaces every ' with '\'' (close quote, escaped quote, reopen quote).
device_shell_quote() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

# Prints the adb serial (e.g. emulator-5554) of the running AVD named AVD_PROFILE.
# Returns 1 when that AVD is not running.
find_emulator_serial() {
  local devices serial avd_name
  devices="$("${ADB}" devices | awk '/^emulator-/ && $2 == "device" {print $1}')"
  for serial in ${devices}; do
    # [emu avd name]: asks the emulator console for its AVD name; output ends with an 'OK' line and CRLFs.
    avd_name="$("${ADB}" -s "${serial}" emu avd name | head -n 1 | tr -d '\r')"
    if [[ "${avd_name}" == "${AVD_PROFILE}" ]]; then
      echo "${serial}"
      return 0
    fi
  done
  return 1
}
