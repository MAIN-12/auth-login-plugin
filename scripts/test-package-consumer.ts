import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildConsumerPackage,
  digestDirectory,
  installConsumerPackage,
  verifyNativePackage,
} from './consumer-package.ts'

const root = resolve(import.meta.dirname, '..')
const temp = await mkdtemp(join(tmpdir(), 'auth-package-consumer-'))
try {
  const { tarball, sourceHash, packedSha256 } = await buildConsumerPackage(
    root,
    join(temp, 'package'),
  )
  const consumer = join(temp, 'consumer')
  await mkdir(consumer)
  // Reuse the host's pinned peers/types, but install no database/router fixture.
  const host = JSON.parse(await readFile(join(root, 'tests/consumer/package.json'), 'utf8'))
  const dependencies = Object.fromEntries(
    [
      '@main12/auth-login',
      'payload',
      'next',
      'react',
      'react-dom',
      'framer-motion',
      '@heroui/react',
    ].map((name) => [name, host.dependencies[name]]),
  )
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'auth-login-package-consumer',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: host.devDependencies,
      pnpm: host.pnpm,
    }),
  )
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        jsx: 'react-jsx',
      },
      include: ['imports.tsx'],
    }),
  )
  await writeFile(
    join(consumer, 'imports.tsx'),
    `// Compile the public package surface without any Next app/router/configuration.
import { authLoginPlugin, migrateAuthLogin, type PublicAuthConfig } from '@main12/auth-login'
import { AuthCard, createAuthService, type AuthUser } from '@main12/auth-login/client'
import { AuthProvider, type AuthProviderProps } from '@main12/auth-login/rsc'
import { createAuthProxy, type AuthProxyOptions } from '@main12/auth-login/proxy'

const plugin = authLoginPlugin({
  collection: 'customers',
  passwordLogin: true,
  otpLogin: false,
  allowSignup: false,
  recovery: false,
  providers: { google: false },
})
const config: PublicAuthConfig = plugin.publicConfig
const user: AuthUser | null = null
const provider: AuthProviderProps = { publicConfig: config, initialUser: user }
const proxy: AuthProxyOptions = { publicConfig: config }
export const surface = {
  plugin,
  migrateAuthLogin,
  service: createAuthService(config),
  proxy: createAuthProxy(proxy),
  card: <AuthCard slug="login" />,
  provider: (
    <AuthProvider {...provider}>
      <span />
    </AuthProvider>
  ),
}
`,
  )

  await installConsumerPackage(consumer, tarball)
  verifyNativePackage(consumer)
  execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: consumer, stdio: 'inherit' })
  assert.equal(
    await digestDirectory(join(root, 'src')),
    sourceHash,
    'source changed during package checks',
  )
  console.log(
    JSON.stringify(
      {
        passed: true,
        packedSha256,
        node: process.version,
        verified: [
          'clean tarball contents and export targets',
          'external installation',
          'all public subpath resolution',
          'native ESM root/migration',
          'public declarations',
        ],
      },
      null,
      2,
    ),
  )
} finally {
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
}
