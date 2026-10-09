import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateReleaseTag(tag, manifest) {
  if (manifest.name !== '@main12/auth-login') {
    throw new Error('Release package must be @main12/auth-login.')
  }
  if (typeof tag !== 'string' || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error(
      'Release tag must be a stable vX.Y.Z version, without prerelease or build metadata.',
    )
  }
  if (tag !== `v${manifest.version}`) {
    throw new Error(
      `Release tag ${tag} must match package.json version ${manifest.version} exactly.`,
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    validateReleaseTag(process.env.RELEASE_TAG, manifest)
    console.log(`Validated ${manifest.name}@${manifest.version}.`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
