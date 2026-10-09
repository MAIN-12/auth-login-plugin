import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { expect, test } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

function unresolvedImports(dist: string): string[] {
  const unresolved: string[] = []
  for (const entry of readdirSync(dist, { recursive: true }) as string[]) {
    if (!entry.endsWith('.js')) continue
    const file = path.join(dist, entry)
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    function visit(node: ts.Node) {
      let specifier: ts.Node | undefined
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        specifier = node.moduleSpecifier
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        specifier = node.arguments[0]
      }
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier.text)
        if (!existsSync(target) || !statSync(target).isFile() || !path.extname(specifier.text)) {
          unresolved.push(`${entry}: ${specifier.text}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return unresolved
}

test('rewrites relative imports against emitted JavaScript, including directory modules', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'auth-esm-imports-'))
  try {
    const files: Record<string, string> = {
      'dist/index.js': `import { logo } from './Logo'
export { logo } from './Logo'
export * from './Logo'
const lazy = import('./Logo')
import './Logo'
import './styles.css'
import './leaf.js'
import { leaf } from './leaf'
import { peer } from 'peer'
`,
      'dist/Logo/index.js': 'export const logo = 1',
      'dist/Logo/server.js': "export { logo } from '.'; export * from '..'",
      // Declarations must not be mistaken for executable modules.
      'dist/Logo.d.ts': 'export declare const logo: number',
      'dist/leaf.js': 'export const leaf = 1',
      'dist/leaf/index.js': 'export const leaf = 2',
      'dist/styles.css': '',
    }
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(temp, file)), { recursive: true })
      await writeFile(path.join(temp, file), content)
    }
    execFileSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(root, 'scripts/fix-esm-imports.ts'),
      ],
      { cwd: temp },
    )
    const output = await readFile(path.join(temp, 'dist/index.js'), 'utf8')
    expect(output.match(/\.\/Logo\/index\.js/g)).toHaveLength(5)
    expect(output).toContain("import { leaf } from './leaf.js'")
    expect(output).toContain("import './styles.css'")
    expect(output).toContain("from 'peer'")
    expect(await readFile(path.join(temp, 'dist/Logo/server.js'), 'utf8')).toBe(
      "export { logo } from './index.js'; export * from '../index.js'",
    )
    expect(unresolvedImports(path.join(temp, 'dist'))).toEqual([])
    execFileSync(
      process.execPath,
      [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        path.join(root, 'scripts/fix-esm-imports.ts'),
      ],
      { cwd: temp },
    )
    expect(await readFile(path.join(temp, 'dist/index.js'), 'utf8')).toBe(output)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test.skipIf(!existsSync(path.join(root, 'dist')))(
  'all emitted static imports, re-exports, and dynamic relative imports resolve',
  () => {
    expect(unresolvedImports(path.join(root, 'dist'))).toEqual([])
  },
)
