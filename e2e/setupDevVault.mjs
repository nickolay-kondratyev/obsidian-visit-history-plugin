// Build the plugin and install the built artifacts into the committed seed vault
// (.dev-vault/.obsidian/plugins/visit-history/). The harness copies this vault fresh
// per launch. KISS: a plain Node ESM script, no compile step.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ID = 'visit-history';
const ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'];

function log(msg) {
  process.stderr.write(`[setup:dev-vault] ${msg}\n`);
}

if (!existsSync(join(REPO_ROOT, 'submodules/obsidian-id-lib/src/index.ts'))) {
  throw new Error(
    'submodules/obsidian-id-lib is missing — run `git submodule update --init` before building.',
  );
}

log('building plugin (npm run build)…');
execFileSync('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });

const destDir = join(REPO_ROOT, '.dev-vault/.obsidian/plugins', PLUGIN_ID);
mkdirSync(destDir, { recursive: true });

for (const artifact of ARTIFACTS) {
  const src = join(REPO_ROOT, artifact);
  if (!existsSync(src)) {
    throw new Error(`built artifact missing: ${artifact} (did the build fail?)`);
  }
  copyFileSync(src, join(destDir, artifact));
}

log(`installed ${ARTIFACTS.join(', ')} into ${destDir}`);
