// Offline operator entry point: runner has stopped both application writers before invoking this.
import { writeFile } from 'node:fs/promises'
import { migrateAuthLogin } from '@main12/auth-login'
import { getPayload } from 'payload'
import { config } from './app/auth-config'
const payload = await getPayload({ config })
try {
  const result = await migrateAuthLogin(payload, {
    collection: 'customers',
    maintenance: true,
    legacyOtpCollection: { slug: 'auth-otps', where: { collection: { equals: 'customers' } } },
  })
  await writeFile('migration-result.json', JSON.stringify(result))
  console.log(JSON.stringify(result))
} finally {
  await payload.destroy()
}
