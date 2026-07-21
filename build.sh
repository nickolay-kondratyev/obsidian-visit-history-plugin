#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  # obsidian-id-lib is a published npm dependency (its own repo) — plain
  # `npm install` resolves it from the registry; no submodule step needed.
  eai2 npm install

  eai2 npm run dev
  return
}

main "${@}"
