#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  scripts/release.sh patch
  return
}

main "${@}"
