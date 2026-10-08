import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const registry = 'https://registry.npmjs.org/'
const args = process.argv.slice(2)
const help =
  'Usage: node scripts/publish-package.mjs [--dry-run | --publish | --help]\nDefaults to dry-run. --publish uploads publicly with the latest tag.'

function run(command, commandArgs, capture = false) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status}).`)
  return result.stdout?.trim() ?? ''
}

function cleanHead() {
  if (run('git', ['status', '--porcelain', '--untracked-files=all'], true)) {
    throw new Error(
      'Publishing requires a clean Git tree, including untracked files. Commit or remove changes first.',
    )
  }
  return run('git', ['rev-parse', 'HEAD'], true)
}

let directory
try {
  if (
    args.length > 1 ||
    (args.length === 1 && !['--dry-run', '--publish', '--help'].includes(args[0]))
  ) {
    throw new Error(help)
  }
  if (args[0] === '--help') {
    console.log(help)
  } else {
    const publish = args[0] === '--publish'
    const head = publish ? cleanHead() : undefined
    for (const task of ['lint', 'typecheck', 'test:unit', 'build']) run('pnpm', ['run', task])
    directory = mkdtempSync(join(tmpdir(), 'auth-login-release-'))
    // pnpm applies publishConfig overrides to the packed manifest.
    run('pnpm', ['pack', '--pack-destination', directory])
    const tarballs = readdirSync(directory).filter((file) => file.endsWith('.tgz'))
    if (tarballs.length !== 1) throw new Error('Expected exactly one packed tarball.')
    const publishArgs = [
      'publish',
      join(directory, tarballs[0]),
      '--access=public',
      '--tag=latest',
      `--registry=${registry}`,
      `--@main12:registry=${registry}`,
      '--ignore-scripts',
    ]
    run('npm', [...publishArgs, '--dry-run'])
    if (publish) {
      if (cleanHead() !== head)
        throw new Error('Git HEAD changed during release checks. Retry from a stable checkout.')
      run('npm', [...publishArgs, '--dry-run=false'])
      console.log('Package published publicly with the latest tag.')
    } else {
      console.log('Release check passed. Nothing published. Run pnpm release:publish when ready.')
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  if (directory) rmSync(directory, { recursive: true, force: true })
}
