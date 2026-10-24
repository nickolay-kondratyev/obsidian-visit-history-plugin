// Bundled-in `Buffer` for isomorphic-git, which expects Node's global `Buffer`
// — absent on Obsidian mobile. esbuild `inject` rewrites every free `Buffer`
// reference INSIDE our bundle to this import; it never assigns a global, so
// Obsidian's own globals (desktop has Node's Buffer) are neither leaked into
// nor clobbered. Resolves to the `buffer` npm package (not Node's builtin):
// esbuild.config.mjs keeps 'buffer' out of `external` for that.
export { Buffer } from 'buffer';
