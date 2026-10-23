#!/usr/bin/env bash
# The `android:setup` entry point (see docs/android-tablet-testing.md). Linux x86_64.
#
# Safe to re-run; finished steps are skipped:
#   1. Builds the plugin into the seed vault (npm run setup:dev-vault)
#   2. Installs the Android command-line tools (no Android Studio needed)
#   3. Creates the tablet AVD (first run downloads emulator + system image)
#   4. Starts the emulator (returns once fully booted; no-op when running)
#   5. Installs the pinned Obsidian APK when the installed version differs
#   6. Copies .dev-vault ONE-WAY to the tablet as DEVICE_VAULT_NAME (re-run =
#      refresh; the previous tablet copy is moved to a backup dir, never deleted)
#   7. Grants Obsidian "All files access" so it can open a shared-storage vault
#
# MANUAL, once per fresh emulator (printed at the end): open the vault in Obsidian.
# WHY-NOT scripted: Obsidian keeps its vault list in private app storage, which the
# Google Play system image does not let adb (non-root) write.
set -euo pipefail

# ==============================================================================
# CONFIGURATION CONSTANTS (bump these when upstream versions move)
# ==============================================================================

# Build number from https://dl.google.com/android/repository/repository2-3.xml
# (grep 'commandlinetools-linux-'). Only used for the first install.
readonly CMDLINE_TOOLS_BUILD="16111833"
readonly CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_BUILD}_latest.zip"

# Version that https://obsidian.md/download links as the Android APK. It can lag the
# desktop release, and not every GitHub release has an .apk asset.
readonly OBSIDIAN_APK_VERSION="1.14.4"
readonly OBSIDIAN_APK_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_APK_VERSION}/Obsidian-${OBSIDIAN_APK_VERSION}.apk"

# Committed seed vault at the repo root (filled with the plugin build by setup:dev-vault).
readonly DEV_VAULT_DIR_NAME=".dev-vault"

# ==============================================================================
# DERIVED PATHS + SHARED CONSTANTS
# ==============================================================================

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
# shellcheck source-path=SCRIPTDIR source=android-tablet-emulator-common.sh
source "${script_dir}/android-tablet-emulator-common.sh"

readonly ANDROID_CLI="${SDK_DIR}/cmdline-tools/latest/bin/android"
# Under SDK_DIR, so the APK is downloaded once for all checkouts of this repo.
readonly DOWNLOADS_DIR="${SDK_DIR}/.downloads"
readonly HOST_TMP_DIR="${repo_root}/.tmp/android"
readonly DEVICE_VAULT_BACKUPS_DIR="${DEVICE_VAULTS_DIR}/.vault_backups"
# Scratch dir adb shell may always write to.
readonly DEVICE_TMP_DIR="/data/local/tmp"

# ==============================================================================
# FUNCTIONS
# ==============================================================================

print_usage() {
  log "Usage: ${0##*/}   (no arguments; npm run android:setup)"
  log "  Creates/starts the Android tablet emulator, installs Obsidian, and copies"
  log "  ${DEV_VAULT_DIR_NAME} to the tablet as [${DEVICE_VAULT_DIR}]. Safe to re-run."
  log "  SDK dir: sdk_dir=[${SDK_DIR}] (set ANDROID_HOME to change it)."
}

android_cli() {
  "${ANDROID_CLI}" --sdk="${SDK_DIR}" "$@"
}

require_kvm_access() {
  [[ -r /dev/kvm && -w /dev/kvm ]] \
    || die "No access to /dev/kvm; the emulator would be unusably slow. Add your user to the 'kvm' group and log in again."
}

require_writable_sdk_dir() {
  if mkdir -p "${SDK_DIR}" 2>/dev/null && [[ -w "${SDK_DIR}" ]]; then
    return 0
  fi
  die "Cannot write the Android SDK dir. sdk_dir=[${SDK_DIR}] Set ANDROID_HOME to a writable dir (e.g. ANDROID_HOME=\${HOME}/tools/android-sdk) and re-run."
}

install_cmdline_tools_if_missing() {
  if [[ -x "${ANDROID_CLI}" ]]; then
    log "Android command-line tools already installed. sdk_dir=[${SDK_DIR}]"
    return 0
  fi
  require_writable_sdk_dir

  log "Installing Android command-line tools. url=[${CMDLINE_TOOLS_URL}]"
  mkdir -p "${HOST_TMP_DIR}"
  local work_dir
  work_dir="$(mktemp -d -p "${HOST_TMP_DIR}")"
  curl -sSLf -o "${work_dir}/cmdline-tools.zip" "${CMDLINE_TOOLS_URL}"
  unzip -q "${work_dir}/cmdline-tools.zip" -d "${work_dir}"
  mkdir -p "${SDK_DIR}/cmdline-tools"
  # The zip holds a top-level 'cmdline-tools/' dir; the SDK layout expects it at 'cmdline-tools/latest'.
  mv "${work_dir}/cmdline-tools" "${SDK_DIR}/cmdline-tools/latest"
  rm -rf "${work_dir}"
}

create_avd_if_missing() {
  local avd_list
  avd_list="$(android_cli emulator list)"
  if grep -qxF "${AVD_PROFILE}" <<< "${avd_list}"; then
    log "AVD already exists. avd=[${AVD_PROFILE}]"
    return 0
  fi

  log "Creating AVD (first run downloads emulator + system image, several minutes). avd=[${AVD_PROFILE}]"
  android_cli emulator create "${AVD_PROFILE}"
}

start_emulator() {
  log "Starting emulator (no-op when already running). avd=[${AVD_PROFILE}]"
  # Returns once the device is fully booted, or reports it is already running.
  android_cli emulator start "${AVD_PROFILE}"
}

installed_obsidian_version() {
  local serial="${1:?serial}"
  local package_dump
  package_dump="$("${ADB}" -s "${serial}" shell dumpsys package "${OBSIDIAN_PACKAGE}")"
  # dumpsys line looks like: '    versionName=1.14.4'. Prints the first match, then quits.
  sed -n '/^ *versionName=/{s///p;q}' <<< "${package_dump}" | tr -d '\r'
}

install_obsidian_if_needed() {
  local serial="${1:?serial}"
  local installed_version
  installed_version="$(installed_obsidian_version "${serial}")"
  if [[ "${installed_version}" == "${OBSIDIAN_APK_VERSION}" ]]; then
    log "Obsidian already installed. version=[${installed_version}]"
    return 0
  fi

  local apk_path="${DOWNLOADS_DIR}/Obsidian-${OBSIDIAN_APK_VERSION}.apk"
  if [[ ! -f "${apk_path}" ]]; then
    log "Downloading Obsidian APK. url=[${OBSIDIAN_APK_URL}]"
    mkdir -p "${DOWNLOADS_DIR}"
    # Download to .part first, so an interrupted download is never mistaken for a full APK.
    curl -sSLf -o "${apk_path}.part" "${OBSIDIAN_APK_URL}"
    mv "${apk_path}.part" "${apk_path}"
  fi

  log "Installing Obsidian. installed_version=[${installed_version}] target_version=[${OBSIDIAN_APK_VERSION}]"
  "${ADB}" -s "${serial}" install -r "${apk_path}"
}

# Moves an existing tablet copy aside so a re-run never silently drops edits made on the tablet.
backup_existing_device_vault() {
  local serial="${1:?serial}"
  if ! "${ADB}" -s "${serial}" shell "[ -d $(device_shell_quote "${DEVICE_VAULT_DIR}") ]"; then
    return 0
  fi

  local timestamp
  timestamp="$(date +%Y_%m_%dT%H_%M_%S)"
  local backup_dir="${DEVICE_VAULT_BACKUPS_DIR}/${DEVICE_VAULT_NAME}_${timestamp}"
  log "Tablet already has the dev vault; moving it aside. backup_dir=[${backup_dir}]"
  "${ADB}" -s "${serial}" shell "mkdir -p $(device_shell_quote "${DEVICE_VAULT_BACKUPS_DIR}") && mv $(device_shell_quote "${DEVICE_VAULT_DIR}") $(device_shell_quote "${backup_dir}")"
}

count_device_files() {
  local serial="${1:?serial}"
  "${ADB}" -s "${serial}" shell "find $(device_shell_quote "${DEVICE_VAULT_DIR}") -type f | wc -l" | tr -d '\r '
}

copy_dev_vault_to_device() {
  local serial="${1:?serial}"
  local host_vault_dir="${repo_root}/${DEV_VAULT_DIR_NAME}"

  # Obsidian must not hold the vault open while it is swapped underneath it.
  "${ADB}" -s "${serial}" shell am force-stop "${OBSIDIAN_PACKAGE}"
  backup_existing_device_vault "${serial}"

  log "Copying dev vault to tablet. host_vault_dir=[${host_vault_dir}] device_vault_dir=[${DEVICE_VAULT_DIR}]"
  # WHY one tar file, not 'adb push <dir>': a directory push aborted mid-way on a big vault.
  # WHY-NOT stream into 'adb exec-in tar -x': exec-in returns before the device tar finishes writing.
  mkdir -p "${HOST_TMP_DIR}"
  local host_tar="${HOST_TMP_DIR}/${DEVICE_VAULT_NAME}.tar"
  local device_tar="${DEVICE_TMP_DIR}/${DEVICE_VAULT_NAME}.tar"
  # [--transform s|^\.dev-vault|NAME|]: renames the top-level dir inside the archive only.
  tar -C "${repo_root}" --transform="s|^\\${DEV_VAULT_DIR_NAME}|${DEVICE_VAULT_NAME}|" \
    -cf "${host_tar}" "${DEV_VAULT_DIR_NAME}"
  "${ADB}" -s "${serial}" push -q "${host_tar}" "${device_tar}"
  rm "${host_tar}"
  "${ADB}" -s "${serial}" shell "tar -xf $(device_shell_quote "${device_tar}") -C $(device_shell_quote "${DEVICE_VAULTS_DIR}") && rm $(device_shell_quote "${device_tar}")"

  local host_file_count device_file_count
  host_file_count="$(find "${host_vault_dir}" -type f | wc -l)"
  device_file_count="$(count_device_files "${serial}")"
  if [[ "${device_file_count}" != "${host_file_count}" ]]; then
    die "Vault copy is incomplete. host_file_count=[${host_file_count}] device_file_count=[${device_file_count}] device_vault_dir=[${DEVICE_VAULT_DIR}]"
  fi
  log "Vault copied. file_count=[${device_file_count}] device_vault_dir=[${DEVICE_VAULT_DIR}]"
}

grant_obsidian_all_files_access() {
  local serial="${1:?serial}"
  # [appops MANAGE_EXTERNAL_STORAGE allow]: same as toggling Settings > Apps > Obsidian > "All files access".
  "${ADB}" -s "${serial}" shell appops set --uid "${OBSIDIAN_PACKAGE}" MANAGE_EXTERNAL_STORAGE allow
}

print_manual_open_vault_steps() {
  cat >&2 <<EOF

Done. If Obsidian on the tablet is not already showing vault [${DEVICE_VAULT_NAME}], open it once:
  Obsidian -> "Use my existing vault" -> "On this device" -> "Choose folder"
  -> Documents/${DEVICE_VAULT_NAME} -> "Use this folder" -> "Allow" -> "Trust author and enable plugins"
  Then pick a name in the plugin's "Choose your visit history user name" prompt.

After code changes: npm run android:push-plugin
Re-run npm run android:setup to refresh the tablet copy (one-way; the old copy is moved to ${DEVICE_VAULT_BACKUPS_DIR}).
EOF
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

  require_kvm_access

  # First, so a broken build fails before minutes of emulator work.
  (cd "${repo_root}" && npm run setup:dev-vault)

  install_cmdline_tools_if_missing
  create_avd_if_missing
  start_emulator

  local serial
  serial="$(find_emulator_serial)" || die "Emulator did not show up in 'adb devices'. avd=[${AVD_PROFILE}]"
  log "Emulator is running. serial=[${serial}]"

  install_obsidian_if_needed "${serial}"
  copy_dev_vault_to_device "${serial}"
  grant_obsidian_all_files_access "${serial}"

  print_manual_open_vault_steps
}

main "$@"
