#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  # obsidian-id-lib is a git submodule consumed via npm `file:` dep — after a fresh
  # clone/pull the dir is empty and esbuild cannot resolve 'obsidian-id-lib'.
  eai2 git submodule update --init --recursive

  eai2 npm install

  eai2 npm run dev
}

main "${@}"
