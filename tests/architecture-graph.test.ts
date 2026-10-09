import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { inspectArchitecture } from '../scripts/auth-architecture.ts'

it('rejects a domain dependency hidden by a type import and an alias barrel', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'auth-graph-'))
  try {
    const files = {
      'tsconfig.json': JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
      }),
      'src/auth/domain/rule.ts': "import type { Port } from '@/bridge'\nexport const result = 1",
      'src/bridge.ts': "export type { Port } from './auth/application/ports/port'",
      'src/auth/application/ports/port.ts': 'export interface Port { run(): void }',
    }
    for (const [name, source] of Object.entries(files)) {
      const file = path.join(root, name)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, source)
    }
    expect(inspectArchitecture(root).map((finding: { rule: string }) => finding.rule)).toContain(
      'domain-boundary',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function fixture(files: Record<string, string>, work: (root: string) => void) {
  const root = mkdtempSync(path.join(tmpdir(), 'auth-graph-'))
  try {
    for (const [name, source] of Object.entries({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          moduleResolution: 'bundler',
          module: 'preserve',
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
      }),
      ...files,
    })) {
      const file = path.join(root, name)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, source)
    }
    work(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

it.each([
  "import type { Port } from '@/bridge'; export type Result = Port",
  "export type { Port } from '@/bridge'",
  "export type Result = import('@/bridge').Port",
  "export async function run() { return import('@/bridge') }",
  "declare function require(name: string): object; export const port = require('@/bridge')",
  "import port = require('@/bridge'); export { port }",
])('rejects application reaching concrete adapters through a valid alias barrel: %s', (source) => {
  fixture(
    {
      'src/auth/application/run.ts': source,
      'src/bridge.ts': "export type { Port } from './auth/infrastructure/payload/port'",
      'src/auth/infrastructure/payload/port.ts': 'export interface Port { run(): void }',
    },
    (root) => {
      expect(inspectArchitecture(root).map((finding: { rule: string }) => finding.rule)).toContain(
        'application-boundary',
      )
    },
  )
})
it.each(['exports/client.ts', 'exports/rsc.ts', 'proxy.ts'])(
  'rejects server state reachable transitively from %s, including type reexports',
  (entry) => {
    fixture(
      {
        ['src/' + entry]: "export type { Port } from '@/bridge'",
        'src/bridge.ts': "export type { Port } from './auth/server/ledger'",
        'src/auth/server/ledger.ts': 'export interface Port { consume(): void }',
      },
      (root) => {
        expect(
          inspectArchitecture(root).map((finding: { rule: string }) => finding.rule),
        ).toContain('runtime-boundary')
      },
    )
  },
)
it('accepts portable policy, injected ports, client DTOs, and type-only HTTP scope contracts', () => {
  fixture(
    {
      'src/auth/domain/rule.ts': 'export const allowed = true',
      'src/auth/application/ports/port.ts': 'export interface Port { run(): void }',
      'src/auth/application/run.ts':
        "import { allowed } from '../domain/rule'; import type { Port } from './ports/port'; export function run(port: Port) { if (allowed) port.run() }",
      'src/auth/interface/http/run.ts':
        "import type { Scope } from '../../composition/run'; export function run(scope: Scope) { scope.run() }",
      'src/auth/composition/run.ts': 'export interface Scope { run(): void }',
      'src/exports/client.ts': "export { allowed } from '../auth/domain/rule'",
    },
    (root) => {
      expect(inspectArchitecture(root)).toEqual([])
    },
  )
})
it('cannot hide a protected dependency behind an unresolved local or nonliteral import', () => {
  fixture(
    {
      'src/auth/application/run.ts':
        "declare const name: string; export const run = () => import(name); export { x } from './missing'",
    },
    (root) => {
      expect(
        inspectArchitecture(root).filter(
          (finding: { rule: string }) => finding.rule === 'unresolved-boundary',
        ),
      ).toHaveLength(2)
    },
  )
})
it('the actual plugin respects the resolved architectural graph', () => {
  expect(inspectArchitecture(path.resolve('.'))).toEqual([])
})

import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { architecturePlugin, dependencies } from '../scripts/auth-architecture.ts'
import { readFileSync } from 'node:fs'

it('lint uses the same graph to reject an unsaved type import through a server barrel', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'auth-lint-'))
  try {
    for (const [name, source] of Object.entries({
      'tsconfig.json': '{}',
      'src/auth/domain/rule.ts': 'export const allowed = true',
      'src/bridge.ts': "export type { Port } from './auth/application/ports/port'",
      'src/auth/application/ports/port.ts': 'export interface Port { run(): void }',
    })) {
      const file = path.join(root, name)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, source)
    }
    const lint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: { parser: tseslint.parser },
          plugins: { architecture: architecturePlugin },
          rules: { 'architecture/boundaries': 'error' },
        },
      ],
    })
    const [denied] = await lint.lintText(
      "import type { Port } from '../../bridge'; export type Result = Port",
      { filePath: 'src/auth/domain/rule.ts' },
    )
    expect(denied.messages.map((message) => message.ruleId)).toEqual(['architecture/boundaries'])
    const [valid] = await lint.lintText('export const allowed = true', {
      filePath: 'src/auth/domain/rule.ts',
    })
    expect(valid.messages).toEqual([])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

import ts from 'typescript'
it('published entrypoints use explicit exports and only authService owns client HTTP', () => {
  for (const entry of [
    'src/index.ts',
    'src/exports/client.ts',
    'src/exports/rsc.ts',
    'src/proxy.ts',
  ]) {
    const ast = ts.createSourceFile(
      entry,
      readFileSync(entry, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    expect(
      ast.statements.filter((node) => ts.isExportDeclaration(node) && !node.exportClause),
    ).toEqual([])
  }
  // Scan call syntax throughout the browser graph, rather than counting the word fetch.
  const seen = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ((ts.isIdentifier(node.expression) && node.expression.text === 'fetch') ||
          (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'fetch'))
      )
        expect(path.relative('.', file)).toBe('src/auth/interface/client/authService.ts')
      ts.forEachChild(node, visit)
    }
    visit(ast)
    for (const edge of dependencies(file, source)) {
      if (!edge.specifier?.startsWith('.')) continue
      const resolved = ts.resolveModuleName(
        edge.specifier,
        file,
        { moduleResolution: ts.ModuleResolutionKind.Bundler },
        ts.sys,
      ).resolvedModule?.resolvedFileName
      if (resolved && /\.[jt]sx?$/.test(resolved)) walk(resolved)
    }
  }
  walk(path.resolve('src/exports/client.ts'))
})

it.each(['contexts', 'configuration', 'hoc', 'theme'])(
  '%s support cannot hide server state from the browser graph',
  (directory) => {
    fixture(
      {
        [`src/${directory}/bridge.ts`]: "export type { Port } from '../auth/server/ledger'",
        'src/auth/server/ledger.ts': 'export interface Port { consume(): void }',
      },
      (root) => {
        expect(
          inspectArchitecture(root).map((finding: { rule: string }) => finding.rule),
        ).toContain('runtime-boundary')
      },
    )
  },
)

it.each([
  'components/organisms/AuthCard/server.tsx',
  'components/pages/AuthPages/server.tsx',
  'auth/interface/react/providers/AuthProviderServer/index.tsx',
])('preserves RSC isolation for colocated server entry %s', (serverEntry) => {
  fixture(
    {
      ['src/' + serverEntry]: 'export const server = 1',
      'src/exports/rsc.ts': `export { server } from '../${serverEntry.replace(/\.tsx$/, '')}'`,
      'src/exports/client.ts': `export { server } from '../${serverEntry.replace(/\.tsx$/, '')}'`,
    },
    (root) => {
      const findings = inspectArchitecture(root)
      expect(
        findings.filter((finding: { file: string }) => finding.file.endsWith('exports/rsc.ts')),
      ).toEqual([])
      expect(
        findings.filter((finding: { file: string }) => finding.file.endsWith('exports/client.ts')),
      ).toHaveLength(1)
    },
  )
})
