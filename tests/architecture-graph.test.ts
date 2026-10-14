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
      'src/collections/Fixture/domain/rule.ts':
        "import type { Port } from '@/bridge'\nexport const result = 1",
      'src/bridge.ts': "export type { Port } from './collections/Fixture/application/ports/port'",
      'src/collections/Fixture/application/ports/port.ts': 'export interface Port { run(): void }',
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
      'src/collections/Fixture/application/run.ts': source,
      'src/bridge.ts':
        "export type { Port } from './collections/Fixture/infrastructure/payload/port'",
      'src/collections/Fixture/infrastructure/payload/port.ts':
        'export interface Port { run(): void }',
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
        'src/bridge.ts':
          "export type { Port } from './collections/Fixture/infrastructure/payload/ledger'",
        'src/collections/Fixture/infrastructure/payload/ledger.ts':
          'export interface Port { consume(): void }',
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
      'src/collections/Fixture/domain/rule.ts': 'export const allowed = true',
      'src/collections/Fixture/application/ports/port.ts': 'export interface Port { run(): void }',
      'src/collections/Fixture/application/run.ts':
        "import { allowed } from '../domain/rule'; import type { Port } from './ports/port'; export function run(port: Port) { if (allowed) port.run() }",
      'src/collections/Fixture/interface/http/run.ts':
        "import type { Scope } from '../../wiring/run'; export function run(scope: Scope) { scope.run() }",
      'src/collections/Fixture/wiring/run.ts': 'export interface Scope { run(): void }',
      'src/exports/client.ts': "export { allowed } from '../collections/Fixture/domain'",
      'src/collections/Fixture/domain.ts': "export { allowed } from './domain/rule'",
    },
    (root) => {
      expect(inspectArchitecture(root)).toEqual([])
    },
  )
})
it('cannot hide a protected dependency behind an unresolved local or nonliteral import', () => {
  fixture(
    {
      'src/collections/Fixture/application/run.ts':
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
      'src/collections/Fixture/domain/rule.ts': 'export const allowed = true',
      'src/bridge.ts': "export type { Port } from './collections/Fixture/application/ports/port'",
      'src/collections/Fixture/application/ports/port.ts': 'export interface Port { run(): void }',
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
      { filePath: 'src/collections/Fixture/domain/rule.ts' },
    )
    expect(denied.messages.map((message) => message.ruleId)).toEqual(['architecture/boundaries'])
    const [valid] = await lint.lintText('export const allowed = true', {
      filePath: 'src/collections/Fixture/domain/rule.ts',
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
        expect(path.relative('.', file)).toBe('src/authentication/interface/client/authService.ts')
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

it.each(['contexts', 'configuration/authAppearance', 'hoc', 'theme'])(
  '%s support cannot hide server state from the browser graph',
  (directory) => {
    fixture(
      {
        [`src/${directory}/bridge.ts`]: `export type { Port } from '${directory.includes('/') ? '../../' : '../'}collections/Fixture/infrastructure/payload/ledger'`,
        'src/collections/Fixture/infrastructure/payload/ledger.ts':
          'export interface Port { consume(): void }',
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
  'authentication/interface/react/providers/AuthProviderServer/index.tsx',
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

it('rejects deep cross-collection implementation imports including type-only references', () => {
  fixture(
    {
      'src/collections/Users/wiring/run.ts':
        "import type { State } from '../../Otp/infrastructure/payload/store'",
      'src/collections/Otp/infrastructure/payload/store.ts':
        'export interface State { value: string }',
    },
    (root) => {
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain(
        'collection-owner-boundary',
      )
    },
  )
})

it('rejects shared-to-owner coupling hidden through an alias barrel', () => {
  fixture(
    {
      'src/shared/contracts/input.ts': "export type { Input } from '@/bridge'",
      'src/bridge.ts': "export type { Input } from './collections/Users/application/ports/input'",
      'src/collections/Users/application/ports/input.ts':
        'export interface Input { value: string }',
    },
    (root) => {
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('shared-owner-boundary')
    },
  )
})

it('enforces portable and client runtime rules at the new collection paths', () => {
  fixture(
    {
      'src/collections/Otp/domain/rule.ts': "import type { Payload } from 'payload'",
      'src/collections/Users/interface/client/service.ts':
        "import { run } from '../../infrastructure/payload/run'",
      'src/collections/Users/infrastructure/payload/run.ts': 'export const run = () => 1',
    },
    (root) => {
      const rules = inspectArchitecture(root).map((item) => item.rule)
      expect(rules).toContain('domain-boundary')
      expect(rules).toContain('runtime-boundary')
    },
  )
})

it('accepts explicit portable cross-owner seams without exposing infrastructure', () => {
  fixture(
    {
      'src/collections/Users/application/use-cases/run.ts':
        "import { allowed } from '../../../Otp/domain'",
      'src/collections/Otp/domain.ts': "export { allowed } from './domain/rule'",
      'src/collections/Otp/domain/rule.ts': 'export const allowed = true',
    },
    (root) => {
      expect(inspectArchitecture(root)).toEqual([])
    },
  )
})

it.each([
  'domain/rule.ts',
  'application/run.ts',
  'interface/http/run.ts',
  'infrastructure/payload/workflow.ts',
])('authentication cannot import SQL drivers outside repositories/queries: %s', (entry) => {
  fixture(
    {
      ['src/authentication/' + entry]:
        "import { sql } from 'drizzle-orm'; export const value = sql`SELECT 1`",
    },
    (root) => {
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('storage-boundary')
    },
  )
})
it('authentication HTTP cannot reach persistence through its server barrel', () => {
  fixture(
    {
      'src/authentication/interface/http/run.ts': "import { run } from '../../index'",
      'src/authentication/index.ts': "export { run } from './infrastructure/repositories/run'",
      'src/authentication/infrastructure/repositories/run.ts': 'export const run = () => 1',
    },
    (root) => expect(inspectArchitecture(root).map((item) => item.rule)).toContain('http-boundary'),
  )
})
it('shared cannot depend on authentication orchestration', () => {
  fixture(
    {
      'src/shared/contracts/input.ts':
        "export type { Input } from '../../authentication/application/input'",
      'src/authentication/application/input.ts': 'export interface Input { value: string }',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('shared-owner-boundary'),
  )
})
it('authentication composes explicit collection seams instead of deep storage imports', () => {
  fixture(
    {
      'src/authentication/wiring/run.ts':
        "import { lock } from '../../collections/Locks/infrastructure/repositories/lock'",
      'src/collections/Locks/infrastructure/repositories/lock.ts': 'export const lock = () => 1',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain(
        'collection-owner-boundary',
      ),
  )
})

it.each([
  'exports/client.ts',
  'proxy.ts',
  'configuration/authAppearance/bridge.ts',
  'contexts/bridge.ts',
  'theme/bridge.ts',
])('cannot hide plugin configuration behind a type-only support barrel from %s', (entry) => {
  fixture(
    {
      ['src/' + entry]: "export type { Options } from '@/bridge'",
      'src/bridge.ts': "export type { Options } from './configuration/plugin/config'",
      'src/configuration/plugin/config.ts': 'export interface Options { secret: string }',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('runtime-boundary'),
  )
})

it('RSC may expose plugin option types without granting runtime access to configuration', () => {
  fixture(
    {
      'src/exports/rsc.ts': "export type { Options } from '../configuration/plugin/config'",
      'src/configuration/plugin/config.ts':
        "import type { OtpOptions } from './otpOptions'; export interface Options { otp: OtpOptions }; export const resolve = () => 1",
      'src/configuration/plugin/otpOptions.ts':
        "import type { PayloadRequest } from 'payload'; export interface OtpOptions { origin: (req: PayloadRequest) => string }",
    },
    (root) => {
      expect(inspectArchitecture(root)).toEqual([])
      const file = path.join(root, 'src/exports/rsc.ts')
      expect(
        inspectArchitecture(
          root,
          new Map([[file, "export { resolve } from '../configuration/plugin/config'"]]),
        ).map((item) => item.rule),
      ).toContain('runtime-boundary')
    },
  )
})

it('the RSC option type exception cannot hide a runtime Payload import', () => {
  fixture(
    {
      'src/exports/rsc.ts': "export type { Options } from '../configuration/plugin/otpOptions'",
      'src/configuration/plugin/otpOptions.ts':
        "import { getPayload } from 'payload'; export interface Options { secret: string }; export const run = getPayload",
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('runtime-boundary'),
  )
})

it('RSC option type exceptions still reject transitive server infrastructure', () => {
  fixture(
    {
      'src/exports/rsc.ts': "export type { Options } from '../configuration/plugin/config'",
      'src/configuration/plugin/config.ts': "export type { Options } from '@/bridge'",
      'src/bridge.ts': "export type { Options } from './authentication/infrastructure/options'",
      'src/authentication/infrastructure/options.ts': 'export interface Options { secret: string }',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain('runtime-boundary'),
  )
})

it('production SQL storage rule does not reject ESLint source overrides for test fixtures', () => {
  fixture(
    {
      'src/authentication/domain/rule.ts': 'export const allowed = true',
      'tests/native-storage.test.ts':
        "import { sql } from 'drizzle-orm'; export const query = sql`SELECT 1`",
    },
    (root) => {
      const file = path.join(root, 'tests/native-storage.test.ts')
      expect(inspectArchitecture(root, new Map([[file, readFileSync(file, 'utf8')]]))).toEqual([])
    },
  )
})

it.each([
  ['src/authentication/wiring/run.ts', 'collection-owner-boundary'],
  ['src/collections/Otp/wiring/run.ts', 'collection-owner-boundary'],
  ['src/shared/contracts/run.ts', 'shared-owner-boundary'],
  ['src/exports/client.ts', 'runtime-boundary'],
  ['src/proxy.ts', 'runtime-boundary'],
])('protects the configured auth collection owner from %s', (entry, rule) => {
  fixture(
    {
      ['' + entry]: "export type { State } from '@/bridge'",
      'src/bridge.ts':
        "export type { State } from './collections/ConfiguredAuthCollection/infrastructure/payload/state'",
      'src/collections/ConfiguredAuthCollection/infrastructure/payload/state.ts':
        'export interface State { id: string }',
    },
    (root) => expect(inspectArchitecture(root).map((item) => item.rule)).toContain(rule),
  )
})
it('configured auth collection state cannot depend back on authentication even through a portable seam', () => {
  fixture(
    {
      'src/collections/ConfiguredAuthCollection/infrastructure/payload/store.ts':
        "export type { State } from '@/bridge'",
      'src/bridge.ts': "export type { State } from './authentication/application'",
      'src/authentication/application.ts': 'export interface State { id: string }',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain(
        'collection-workflow-boundary',
      ),
  )
})
it('authentication may compose the explicit configured collection server and portable seams', () => {
  fixture(
    {
      'src/authentication/wiring/run.ts':
        "export { run } from '../../collections/ConfiguredAuthCollection/index'",
      'src/authentication/application/run.ts':
        "export type { State } from '../../collections/ConfiguredAuthCollection/domain'",
      'src/collections/ConfiguredAuthCollection/index.ts':
        "export { run } from './infrastructure/payload/store'",
      'src/collections/ConfiguredAuthCollection/infrastructure/payload/store.ts':
        'export const run = () => 1',
      'src/collections/ConfiguredAuthCollection/domain.ts':
        "export type { State } from './domain/state'",
      'src/collections/ConfiguredAuthCollection/domain/state.ts':
        'export interface State { id: string }',
    },
    (root) => expect(inspectArchitecture(root)).toEqual([]),
  )
})
it.each(['domain/rule.ts', 'application/run.ts', 'infrastructure/payload/run.ts'])(
  'configured auth collection SQL drivers remain restricted to storage seams: %s',
  (entry) =>
    fixture(
      {
        ['src/collections/ConfiguredAuthCollection/' + entry]:
          "import { sql } from 'drizzle-orm'; export const run = sql`SELECT 1`",
      },
      (root) =>
        expect(inspectArchitecture(root).map((item) => item.rule)).toContain('storage-boundary'),
    ),
)

it('all collection owners reject private imports hidden behind foreign barrels', () => {
  fixture(
    {
      'src/collections/Otp/wiring/run.ts': "export type { State } from '@/bridge'",
      'src/bridge.ts':
        "export type { State } from './collections/Identities/infrastructure/payload/state'",
      'src/collections/Identities/infrastructure/payload/state.ts':
        'export interface State { id: string }',
    },
    (root) =>
      expect(inspectArchitecture(root).map((item) => item.rule)).toContain(
        'collection-owner-boundary',
      ),
  )
})
