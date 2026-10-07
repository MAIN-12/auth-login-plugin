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
    await writeFile(
      file,
      `import styles from './AuthPageTexture.module.css';
import theme from './theme.css?inline';
import './global.css';
import { Card } from './Card';
export { Form } from './Form';
const css = import('./optional.css');
const modal = import('./Modal');
`,
    )
    const run = () =>
      execFileSync(
        process.execPath,
        ['--import', import.meta.resolve('tsx'), path.resolve('scripts/fix-esm-imports.ts')],
        {
          cwd: fixture,
        },
      )
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

it('emits JSON import attributes for native Node rather than relying on Next bundling', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'auth-json-import-'))
  try {
    const source = path.resolve('src/auth/domain/passwordRules.ts')
    const output = path.join(fixture, 'passwordRules.mjs')
    execFileSync('pnpm', [
      'exec',
      'swc',
      source,
      '-o',
      output,
      '--config-file',
      path.resolve('.swcrc'),
    ])
    await writeFile(
      path.join(fixture, 'password-blocklist.json'),
      await readFile(path.resolve('src/auth/domain/password-blocklist.json')),
    )
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify('file://' + output)}); if (m.MIN_PASSWORD_LENGTH !== 15) throw new Error('missing export')`,
      ],
      { encoding: 'utf8' },
    )
    expect(result).toBe('')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
