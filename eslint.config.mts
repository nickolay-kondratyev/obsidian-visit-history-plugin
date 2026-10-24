import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'esbuild.buffer-inject.mjs',
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
		// Unit tests + their test-only helpers run under vitest in NODE, never
		// inside Obsidian or on mobile (testSupport/ is imported by tests only),
		// so Node builtins/globals are fine there — e.g. integration tests that
		// build a temp git repo with the git CLI. Production code keeps the rule.
		// WHY-NOT inline eslint-disable: the obsidianmd config forbids disabling
		// obsidianmd/* rules inline (eslint-comments/no-restricted-disable).
		files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/testSupport/**'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
		},
	},
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
