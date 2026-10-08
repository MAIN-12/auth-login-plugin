import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { dependencies } from '../scripts/auth-architecture.mjs'

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : []
  })
}
const root = path.resolve('src')
const config = ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile)
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, path.resolve('.')).options
function edges(file: string) {
  return dependencies(file, readFileSync(file, 'utf8')).flatMap(
    (edge: { specifier: string | null }) => {
      if (!edge.specifier) throw new Error(`Nonliteral dependency: ${file}`)
      const resolved = ts.resolveModuleName(edge.specifier, file, options, ts.sys).resolvedModule
        ?.resolvedFileName
      return resolved?.startsWith(root + path.sep) ? [resolved] : []
    },
  )
}
function reachable(file: string, seen = new Set<string>()) {
  if (seen.has(file)) return seen
  seen.add(file)
  for (const next of edges(file)) reachable(next, seen)
  return seen
}

it('atoms and molecules cannot reach workflow, transport or higher visual owners, even through support', () => {
  for (const level of ['atoms', 'molecules']) {
    const forbidden =
      level === 'atoms'
        ? /components\/(molecules|organisms|templates|pages|auth-card|forms)\//
        : /components\/(organisms|templates|pages|auth-card|forms)\//
    for (const file of files(path.join(root, 'components', level))) {
      const invalid = [...reachable(file)]
        .map((target) => path.relative(root, target))
        .filter(
          (target) =>
            forbidden.test(target) ||
            /^auth\/(interface|application|composition|server|infrastructure)\//.test(target),
        )
      expect(invalid, path.relative(root, file)).toEqual([])
    }
  }
})
it('the migrated visual and presentation dependency graph has no cycles', () => {
  const finished = new Set<string>()
  const walk = (file: string, trail: string[]) => {
    expect(trail.includes(file), trail.map((item) => path.relative(root, item)).join(' -> ')).toBe(
      false,
    )
    if (finished.has(file)) return
    // Integration infrastructure has its own auth-clean boundaries. This cycle
    // check covers visual owners and their presentation support, including types.
    for (const next of edges(file)) {
      if (
        /^(?:components\/(atoms|molecules|organisms|templates|pages)\/|(?:configuration|contexts|hoc|theme)\/|i18n\/)/.test(
          path.relative(root, next),
        )
      ) {
        walk(next, [...trail, file])
      }
    }
    finished.add(file)
  }
  for (const level of ['atoms', 'molecules', 'organisms', 'templates', 'pages']) {
    for (const file of files(path.join(root, 'components', level))) walk(file, [])
  }
  for (const directory of ['configuration', 'contexts', 'hoc', 'theme', 'i18n']) {
    for (const file of files(path.join(root, directory))) walk(file, [])
  }
})

it('modal and dispatcher integration consume definitive visual owners directly', () => {
  const expected: Record<string, string[]> = {
    'auth/interface/react/providers/AuthProvider/index.tsx': [
      'components/organisms/AuthModal/index.tsx',
      'components/organisms/AuthCard/index.tsx',
    ],
    'components/organisms/AuthCard/server.tsx': ['components/organisms/AuthCard/index.tsx'],
    'components/pages/AuthPages/server.tsx': ['components/pages/AuthPages/index.tsx'],
    'exports/client.ts': [
      'components/pages/AuthPages/index.tsx',
      'components/organisms/AuthCard/index.tsx',
      'components/templates/AuthLayout/index.tsx',
    ],
    'exports/rsc.ts': ['components/templates/AuthLayout/index.tsx'],
  }
  for (const [caller, targets] of Object.entries(expected)) {
    const dependencies = edges(path.join(root, caller)).map((file) => path.relative(root, file))
    for (const target of targets) expect(dependencies, caller).toContain(target)
  }
  expect(
    readFileSync(path.join(root, 'components/organisms/AuthModal/index.tsx'), 'utf8'),
  ).toContain("'use client'")
})

it('the visual tree contains only Atomic Design levels and folder-owned components', () => {
  expect(existsSync(path.join(root, 'presentation'))).toBe(false)
  const levels = ['atoms', 'molecules', 'organisms', 'pages', 'templates']
  expect(readdirSync(path.join(root, 'components')).sort()).toEqual(levels)
  for (const level of levels) {
    for (const entry of readdirSync(path.join(root, 'components', level), {
      withFileTypes: true,
    })) {
      // A level may have a public barrel, but never a loose visual component.
      expect(entry.isDirectory() || entry.name === 'index.tsx', level + '/' + entry.name).toBe(true)
      if (entry.isDirectory())
        expect(readdirSync(path.join(root, 'components', level, entry.name))).toContain('index.tsx')
    }
  }
  expect(readdirSync(path.join(root, 'i18n')).sort()).toEqual(['email.ts', 'locale.ts', 'ui.ts'])
})

it('visual owners only compose their own or lower visual levels', () => {
  const forbiddenByLevel: Record<string, RegExp> = {
    organisms: /^components\/(templates|pages)\//,
    templates: /^components\/pages\//,
  }
  for (const [level, forbidden] of Object.entries(forbiddenByLevel)) {
    for (const file of files(path.join(root, 'components', level))) {
      if (file.endsWith('/server.tsx')) continue
      expect(
        edges(file)
          .map((target) => path.relative(root, target))
          .filter((target) => forbidden.test(target)),
        path.relative(root, file),
      ).toEqual([])
    }
  }
})

it('appearance configuration and data-only handshake contexts do not render UI or load React adapters', () => {
  for (const file of files(path.join(root, 'configuration', 'authAppearance'))) {
    const source = readFileSync(file, 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const jsx: ts.Node[] = []
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
        jsx.push(node)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    expect(jsx, path.relative(root, file)).toEqual([])
    expect(
      edges(file).filter((target) => /\/(components|contexts|hoc|theme)\//.test(target)),
    ).toEqual([])
  }
  for (const name of ['AuthConfigContext', 'AuthCardLoadingContext']) {
    const file = path.join(root, 'contexts', name, 'index.ts')
    expect(edges(file).map((target) => path.relative(root, target))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^(?:components|auth\/interface)\//)]),
    )
  }
})
