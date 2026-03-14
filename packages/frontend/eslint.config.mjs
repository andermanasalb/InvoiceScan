/**
 * @file ESLint flat config for the InvoiceScan frontend.
 *
 * Stack:
 *   - ESLint 9 (flat config API)
 *   - typescript-eslint v8 for TypeScript-aware rules
 *   - eslint-config-prettier to disable formatting rules that conflict with Prettier
 *
 * Next.js-specific plugin (@next/eslint-plugin-next) is intentionally omitted
 * here because it requires `eslint-config-next` which pulls in a large set of
 * peer dependencies not yet added to this workspace.  Add it in FASE 12 when
 * the shared package is set up and the full lint pipeline is wired.
 */

import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Base TypeScript rules (recommended set)
  ...tseslint.configs.recommended,

  // Disable rules that conflict with Prettier
  prettierConfig,

  {
    // Files to lint
    files: ['**/*.{ts,tsx}'],

    languageOptions: {
      parserOptions: {
        // Type-aware linting — requires tsconfig.json to be present
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // ── TypeScript ─────────────────────────────────────────────────────────
      // Disallow `any` — use `unknown` + type guards instead
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
      // Disallow console.log — use structured logger or remove before commit
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Disallow debugger statements
      'no-debugger': 'error',
    },
  },

  {
    // Ignore generated / build artefacts
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      '*.config.mjs',
      '*.config.js',
      'postcss.config.mjs',
    ],
  },
);
