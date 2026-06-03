#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  eai2 npm install

  eai2 npm run dev
}

main "${@}"
