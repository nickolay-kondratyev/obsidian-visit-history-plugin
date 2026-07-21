import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		// Build/test tooling (like esbuild.config.mjs above) — runs in Node,
		// not inside Obsidian, so Obsidian plugin rules don't apply.
		'vitest.config.ts',
		// AI tooling scratch + test screenshots (gitignored, never shipped).
		'.tmp',
		'.out',
		// Git submodules are foreign repos with their own tooling — the
		// plugin's eslint must not lint them (obsidian-id-lib is consumed
		// as a file: dependency).
		'submodules',
		// Node-side e2e harness/specs run OUTSIDE Obsidian (real-Obsidian
		// Playwright driver) — Obsidian plugin rules don't apply, and these
		// files have their own tsconfig (e2e/tsconfig.json) + typecheck step.
		'e2e',
		// Generated/seed e2e vault (installed plugin build is gitignored).
		'.dev-vault',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Type-checked safety rules: forbid operating on `any`-typed values,
		// which defeat TypeScript's guarantees at call/member/assignment sites.
		rules: {
			'@typescript-eslint/no-unsafe-call': 'error',
			'@typescript-eslint/no-unsafe-member-access': 'error',
			'@typescript-eslint/no-unsafe-assignment': 'error',
			'@typescript-eslint/no-unsafe-return': 'error',
			'@typescript-eslint/no-unsafe-argument': 'error',
		},
	},
);
