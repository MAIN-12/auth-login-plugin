import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'

it('preserves stylesheet assets while rewriting extensionless JavaScript imports', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'auth-imports-'))
  try {
    await mkdir(path.join(fixture, 'dist'))
    const file = path.join(fixture, 'dist', 'example.js')
    await writeFile(file, `import styles from './AuthPageTexture.module.css';
import theme from './theme.css?inline';
import './global.css';
import { Card } from './Card';
export { Form } from './Form';
const css = import('./optional.css');
const modal = import('./Modal');
`)
    const run = () => execFileSync(process.execPath, [path.resolve('scripts/fix-esm-imports.mjs')], { cwd: fixture })
    run()
    const output = await readFile(file, 'utf8')
    expect(output).toContain("from './AuthPageTexture.module.css'")
    expect(output).toContain("from './theme.css?inline'")
    expect(output).toContain("import './global.css'")
    expect(output).toContain("import('./optional.css')")
    expect(output).toContain("from './Card.js'")
    expect(output).toContain("from './Form.js'")
    expect(output).toContain("import('./Modal.js')")
    run()
    expect(await readFile(file, 'utf8')).toBe(output)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
