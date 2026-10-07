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
    plugins: { 'react-hooks': reactHooks },
    rules: {
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
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['payload', 'payload/*', '**/auth/server/**', '**/endpoints/**'] },
      ],
    },
  },
]
