/**
 * @file ESLint flat config for the InvoiceScan frontend.
 *
 * Stack:
 *   - ESLint 9 (flat config API)
 *   - typescript-eslint v8 for TypeScript-aware rules
 *   - @next/eslint-plugin-next for Next.js-specific rules (App Router, images, etc.)
 *   - eslint-config-prettier to disable formatting rules that conflict with Prettier
 */

import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  // Base TypeScript rules (recommended set)
  ...tseslint.configs.recommended,

  // Disable rules that conflict with Prettier
  prettierConfig,

  {
    // Files to lint
    files: ['**/*.{ts,tsx}'],

    plugins: {
      '@next/next': nextPlugin,
    },

    languageOptions: {
      parserOptions: {
        // Type-aware linting — requires tsconfig.json to be present
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // ── Next.js core rules ─────────────────────────────────────────────────
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // ── TypeScript ─────────────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',

      // Allow unused vars that start with _ (conventional placeholder)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Prefer `import type` for type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Disallow non-null assertions — be explicit about null handling
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Allow async functions that don't await (common in React event handlers)
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      // ── General ────────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },

  {
    // Ignore generated / build artefacts and Playwright E2E tests.
    // E2E tests use their own tsconfig (e2e/tsconfig.json) with
    // moduleResolution: node which is incompatible with the Next.js
    // bundler-resolution tsconfig, so we exclude them from the
    // type-aware linting pass entirely.
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'e2e/**',
      '*.config.mjs',
      '*.config.js',
      'postcss.config.mjs',
    ],
  },
);
