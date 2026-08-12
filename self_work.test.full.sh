#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  npm run test && npm run test:e2e
}

main "${@}"
