import { readFileSync, readdirSync } from 'node:fs'
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
    for (const next of edges(file)) walk(next, [...trail, file])
    finished.add(file)
  }
  for (const level of ['atoms', 'molecules', 'auth-presentation']) {
    for (const file of files(path.join(root, 'components', level))) walk(file, [])
  }
})

it('modal and dispatcher integration consume definitive visual owners directly', () => {
  const expected: Record<string, string[]> = {
    'components/AuthProvider.tsx': [
      'components/organisms/AuthModal/index.tsx',
      'components/organisms/AuthCard/index.tsx',
    ],
    'components/AuthCardServer.tsx': ['components/organisms/AuthCard/index.tsx'],
    'components/AuthPagesServer.tsx': ['components/pages/AuthPages.tsx'],
    'exports/client.ts': [
      'components/pages/AuthPages.tsx',
      'components/organisms/AuthCard/index.tsx',
      'components/templates/AuthLayout.tsx',
    ],
    'exports/rsc.ts': ['components/templates/AuthLayout.tsx'],
  }
  for (const [caller, targets] of Object.entries(expected)) {
    const dependencies = edges(path.join(root, caller)).map((file) => path.relative(root, file))
    for (const target of targets) expect(dependencies, caller).toContain(target)
  }
  expect(
    readFileSync(path.join(root, 'components/organisms/AuthModal/index.tsx'), 'utf8'),
  ).toContain("'use client'")
})
