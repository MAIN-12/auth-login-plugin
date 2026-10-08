import { architecturePlugin } from './scripts/auth-architecture.mjs'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

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
      'src/configuration/**/*.{ts,tsx}',
      'src/contexts/**/*.{ts,tsx}',
      'src/hoc/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/i18n/**/*.ts',
      'src/auth/interface/client/**/*.{ts,tsx}',
      'src/auth/interface/react/**/*.{ts,tsx}',
    ],
    ignores: ['src/auth/interface/client/authService.ts'],
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
    files: ['src/auth/domain/**/*.{ts,tsx}', 'src/config.ts'],
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
            '**/auth/server/**',
            '**/application/**',
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/exports/client.ts',
      'src/auth/application/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/configuration/**/*.{ts,tsx}',
      'src/contexts/**/*.{ts,tsx}',
      'src/hoc/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/i18n/**/*.ts',
      'src/auth/interface/client/**/*.{ts,tsx}',
      'src/auth/interface/react/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['payload', 'payload/*', '**/auth/server/**', '**/endpoints/**'] },
      ],
    },
  },
  {
    files: [
      'src/auth/application/**/*.ts',
      'src/auth/domain/**/*.ts',
      'src/auth/domain/errors.ts',
      'src/auth/domain/passwordLoginRules.ts',
      'src/auth/domain/otpRules.ts',
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
