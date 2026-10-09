import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST_DIR = path.resolve(process.cwd(), 'dist')

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry)
      const fileStat = await stat(fullPath)
      if (fileStat.isDirectory()) return walk(fullPath)
      return [fullPath]
    }),
  )
  return files.flat()
}

function rewriteRelativeSpecifier(
  specifier: string,
  file: string,
  emittedFiles: Set<string>,
): string {
  if (
    specifier !== '.' &&
    specifier !== '..' &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../')
  )
    return specifier
  if (specifier.endsWith('.js') || specifier.endsWith('.mjs') || specifier.endsWith('.cjs'))
    return specifier
  // Stylesheets are emitted as assets, not JavaScript modules.
  if (/\.(?:json|css|scss|sass|less)(?:[?#].*)?$/.test(specifier)) return specifier
  // SWC preserves extensionless imports, which may target either a file or a
  // directory barrel. Only executable output counts (not adjacent .d.ts files).
  for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
    if (emittedFiles.has(path.resolve(path.dirname(file), candidate))) return candidate
  }
  throw new Error(`Cannot resolve emitted relative import ${specifier} in ${file}`)
}

function patchContent(content: string, file: string, emittedFiles: Set<string>): string {
  let updated = content

  // import ... from '...'
  updated = updated.replace(
    /(from\s+['"])([^'"]+)(['"])/g,
    (_m: string, p1: string, spec: string, p3: string) => {
      return `${p1}${rewriteRelativeSpecifier(spec, file, emittedFiles)}${p3}`
    },
  )

  // export ... from '...'
  updated = updated.replace(
    /(export\s+[^\n]*?from\s+['"])([^'"]+)(['"])/g,
    (_m: string, p1: string, spec: string, p3: string) => {
      return `${p1}${rewriteRelativeSpecifier(spec, file, emittedFiles)}${p3}`
    },
  )

  // import('...')
  updated = updated.replace(
    /(import\(\s*['"])([^'"]+)(['"]\s*\))/g,
    (_m: string, p1: string, spec: string, p3: string) => {
      return `${p1}${rewriteRelativeSpecifier(spec, file, emittedFiles)}${p3}`
    },
  )

  // Side-effect imports have no `from` clause.
  updated = updated.replace(
    /(import\s*['"])([^'"]+)(['"])/g,
    (_m: string, p1: string, spec: string, p3: string) => {
      return `${p1}${rewriteRelativeSpecifier(spec, file, emittedFiles)}${p3}`
    },
  )

  return updated
}

async function main() {
  const allFiles = await walk(DIST_DIR)
  const jsFiles = allFiles.filter((file) => file.endsWith('.js'))
  const emittedFiles = new Set(jsFiles)

  await Promise.all(
    jsFiles.map(async (file) => {
      const content = await readFile(file, 'utf8')
      const patched = patchContent(content, file, emittedFiles)
      if (patched !== content) {
        await writeFile(file, patched, 'utf8')
      }
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
