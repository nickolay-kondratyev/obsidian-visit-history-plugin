// Runtime constants for the e2e layer.
//
// WHY these are DUPLICATED rather than imported: the `obsidian` npm package is
// types-only (no runtime .js), so node-side e2e code must never `import "obsidian"`.
// The plugin's own constants live in `src/` and are bundled into main.js — the e2e
// harness runs OUTSIDE that bundle. Keep the values below in sync with:
//   - PLUGIN_ID / view types  → src/Constants.ts, manifest.json
//   - VH_TOP_DIR + path layout → src/core/service/visitHistoryService/v3/VhV3Paths.ts,
//                                 .../user/VhUserPaths.ts
//   - localStorage keys        → UserNameProvider.ts / DeviceNameProvider.ts
//   - SESSION_LINE_RE          → VhV3SessionLineParser.ts
//   - DEV_OVERRIDES_* env var  → src/core/config/DevOverridesFileSource.ts

export const PLUGIN_ID = 'visit-history';

// Env var the plugin reads to load a dev config overrides JSON file, which can
// bypass hard-limited config (e.g. the min-5 s idle-timeout floor) for e2e.
// Keep in sync with DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR in the src source above.
export const DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR = '__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__';

export const VH_TOP_DIR = '__visit_history';

// Deterministic identity pinned via localStorage before the plugin is enabled.
export const USER_NAME = 'e2e_user';
export const DEVICE_NAME = 'e2e_device';

export const LS_KEY_USER_NAME = 'obsidian-vh-user-name';
export const LS_KEY_DEVICE_NAME = 'obsidian-device-name';

// Seeded, format-valid ids (`docid_<24 base36 lowercase>_e`) so the produced
// `.vh_v3` filenames are known up front. Mirrors the seeds in .dev-vault/.
export const DOC_ID_A = 'docid_aaaaaaaaaaaaaaaaaaaaaaaa_e';
export const DOC_ID_B = 'docid_bbbbbbbbbbbbbbbbbbbbbbbb_e';
export const DOC_ID_C = 'docid_cccccccccccccccccccccccc_e';

export const FILE_A = 'A.md';
export const FILE_B = 'B.md';
export const FILE_C = 'C.canvas';

// One completed session per line: `<ISO start stamp> D:<durationMillis>`.
// Tested with `.test()` against individually split+trimmed single lines, so no `m`
// (multiline `^`/`$`) flag is needed.
export const SESSION_LINE_RE = /^\S+ D:\d+$/;
