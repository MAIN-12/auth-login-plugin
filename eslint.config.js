import { tsImport } from 'tsx/esm/api'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Scope TypeScript loading to this development-only plugin; plain eslint still works.
const { architecturePlugin } = await tsImport('./scripts/auth-architecture.ts', import.meta.url)

// The vendor config had undocumented repository-wide formatting requirements,
// a missing dependency, and a parser that does not support this repo's TS6.
// Keep executable correctness lint at the actual plugin/test boundary.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'dev/**', '.scratch/**', 'docs/**', 'reports/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    plugins: { 'react-hooks': reactHooks, architecture: architecturePlugin },
    rules: {
      'architecture/boundaries': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/configuration/authAppearance/**/*.{ts,tsx}',
      'src/contexts/**/*.{ts,tsx}',
      'src/hoc/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/i18n/**/*.ts',
      'src/{collections/*,authentication,shared}/interface/client/**/*.{ts,tsx}',
      'src/{collections/*,authentication,shared}/interface/react/**/*.{ts,tsx}',
    ],
    ignores: ['src/authentication/interface/client/authService.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Client HTTP belongs to authService.' },
      ],
      'no-restricted-properties': [
        'error',
        ...['globalThis', 'window'].map((object) => ({
          object,
          property: 'fetch',
          message: 'Client HTTP belongs to authService.',
        })),
      ],
    },
  },
  {
    files: [
      'src/{collections/*,authentication,shared}/domain/**/*.{ts,tsx}',
      'src/configuration/plugin/config.ts',
    ],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Pass explicit configuration instead of reading environment in the domain.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react/*',
            'next',
            'next/*',
            'payload',
            'payload/*',
            '**/components/**',
            '**/configuration/**',
            '**/contexts/**',
            '**/hoc/**',
            '**/theme/**',
            '**/i18n/**',
            '**/infrastructure/payload/**',
            '**/application/**',
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/exports/client.ts',
      'src/{collections/*,authentication,shared}/application/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/configuration/authAppearance/**/*.{ts,tsx}',
      'src/contexts/**/*.{ts,tsx}',
      'src/hoc/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/i18n/**/*.ts',
      'src/{collections/*,authentication,shared}/interface/client/**/*.{ts,tsx}',
      'src/{collections/*,authentication,shared}/interface/react/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['payload', 'payload/*', '**/infrastructure/payload/**', '**/endpoints/**'] },
      ],
    },
  },
  {
    files: [
      'src/{collections/*,authentication,shared}/application/**/*.ts',
      'src/{collections/*,authentication,shared}/domain/**/*.ts',
      'src/{collections/*,authentication,shared}/domain/errors.ts',
      'src/{collections/*,authentication,shared}/domain/passwordLoginRules.ts',
      'src/{collections/*,authentication,shared}/domain/otpRules.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'payload',
            'payload/*',
            'drizzle-orm',
            'drizzle-orm/*',
            'react',
            'react/*',
            'next',
            'next/*',
            'node:*',
            '**/server/**',
            '**/infrastructure/**',
            '**/composition/**',
            '**/interface/**',
            '**/contracts/**',
            '**/components/**',
            '**/configuration/**',
            '**/contexts/**',
            '**/hoc/**',
            '**/theme/**',
            '**/i18n/**',
            '**/endpoints/**',
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'Request',
        'Response',
        'Headers',
        'fetch',
        'process',
        'Buffer',
        'crypto',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now' },
        { object: 'Math', property: 'random' },
      ],
    },
  },
]
