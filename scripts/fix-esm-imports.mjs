import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST_DIR = path.resolve(process.cwd(), 'dist')

async function walk(dir) {
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

function rewriteRelativeSpecifier(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return specifier
  if (specifier.endsWith('.js') || specifier.endsWith('.mjs') || specifier.endsWith('.cjs')) return specifier
  if (specifier.endsWith('.json')) return specifier
  return `${specifier}.js`
}

function patchContent(content) {
  let updated = content

  // import ... from '...'
  updated = updated.replace(/(from\s+['"])([^'"]+)(['"])/g, (_m, p1, spec, p3) => {
    return `${p1}${rewriteRelativeSpecifier(spec)}${p3}`
  })

  // export ... from '...'
  updated = updated.replace(/(export\s+[^\n]*?from\s+['"])([^'"]+)(['"])/g, (_m, p1, spec, p3) => {
    return `${p1}${rewriteRelativeSpecifier(spec)}${p3}`
  })

  // import('...')
  updated = updated.replace(/(import\(\s*['"])([^'"]+)(['"]\s*\))/g, (_m, p1, spec, p3) => {
    return `${p1}${rewriteRelativeSpecifier(spec)}${p3}`
  })

  return updated
}

async function main() {
  const allFiles = await walk(DIST_DIR)
  const jsFiles = allFiles.filter((file) => file.endsWith('.js'))

  await Promise.all(
    jsFiles.map(async (file) => {
      const content = await readFile(file, 'utf8')
      const patched = patchContent(content)
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
