import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function digestDirectory(directory: string) {
  const hash = createHash('sha256')
  async function visit(path: string, relative = '') {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const name = `${relative}/${entry.name}`
      if (entry.isDirectory()) await visit(join(path, entry.name), name)
      else if (entry.isFile()) hash.update(name).update(await readFile(join(path, entry.name)))
    }
  }
  await visit(directory)
  return hash.digest('hex')
}

export async function buildConsumerPackage(root: string, packageDir: string) {
  const sourceHash = await digestDirectory(join(root, 'src'))
  await mkdir(join(root, 'dist'), { recursive: true })
  await writeFile(join(root, 'dist', '__stale-consumer-test.js'), 'obsolete')
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  await assert.rejects(access(join(root, 'dist', '__stale-consumer-test.js')))
  execFileSync('pnpm', ['pack', '--pack-destination', packageDir], { cwd: root, stdio: 'inherit' })
  const tarballName = (await readdir(packageDir)).find((file) => file.endsWith('.tgz'))
  assert.ok(tarballName, 'pnpm pack must produce a tarball')
  const tarball = join(packageDir, tarballName)
  const packedEntries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n')
  assert.ok(
    !packedEntries.some(
      (entry) =>
        entry.includes('__stale-consumer-test') || /^package\/(src|tests|dev)\//.test(entry),
    ),
    'tarball must exclude stale/source/test/development files',
  )
  const normativeDocs = ['package/docs/migration.md', 'package/docs/plugin-contracts.md']
  for (const doc of normativeDocs)
    assert.ok(packedEntries.includes(doc), `${doc} must ship with the package`)
  assert.ok(
    !packedEntries.some(
      (entry) =>
        entry.startsWith('package/docs/') && !entry.endsWith('/') && !normativeDocs.includes(entry),
    ),
    'tarball must exclude unrelated copied guides',
  )
  const packedManifest = JSON.parse(
    execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
  )
  for (const [subpath, contract] of Object.entries(
    packedManifest.exports as Record<string, Record<string, string>>,
  )) {
    for (const condition of ['import', 'types'])
      assert.ok(
        packedEntries.includes(`package/${contract[condition].replace(/^\.\//, '')}`),
        `${subpath} ${condition} target must exist in packed package`,
      )
  }
  assert.equal(
    await digestDirectory(join(root, 'src')),
    sourceHash,
    'production source changed during build/pack; rerun at a frozen checkpoint',
  )
  return {
    tarball,
    sourceHash,
    packedSha256: createHash('sha256')
      .update(await readFile(tarball))
      .digest('hex'),
  }
}

export async function installConsumerPackage(directory: string, tarball: string) {
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  manifest.dependencies['@main12/auth-login'] = `file:${tarball}`
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  execFileSync('pnpm', ['install', '--ignore-scripts'], { cwd: directory, stdio: 'inherit' })
  return manifest
}

export function verifyNativePackage(directory: string) {
  // Node cannot execute stylesheet/React client entry points; resolve every public
  // subpath here, typecheck them separately, and execute the server root natively.
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    for (const suffix of ['', '/client', '/rsc', '/proxy']) {
      assert.ok(import.meta.resolve('@main12/auth-login' + suffix).includes('/node_modules/'));
    }
    const pkg = await import('@main12/auth-login');
    assert.equal(typeof pkg.authLoginPlugin, 'function');
    assert.equal(typeof pkg.migrateAuthLogin, 'function');
    console.log('Packed export resolution and native ESM root/migration GREEN');
  `,
    ],
    { cwd: directory, stdio: 'inherit' },
  )
}
