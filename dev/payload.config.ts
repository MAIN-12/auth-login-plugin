import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { plugins } from './plugins/index.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    // Users collection with auth enabled — required by the plugin
    {
      slug: 'users',
      auth: {
        tokenExpiration: 7200, // 2 hours
        verify: false,
        maxLoginAttempts: 5,
      },
      fields: [
        { name: 'name', type: 'text' },
        // OTP fields used by the plugin
        { name: 'otpHash', type: 'text', admin: { hidden: true } },
        { name: 'otpPurpose', type: 'text', admin: { hidden: true } },
        { name: 'otpAttempts', type: 'number', admin: { hidden: true } },
        { name: 'otpExpiresAt', type: 'text', admin: { hidden: true } },
        { name: 'authProvider', type: 'text', admin: { hidden: true } },
      ],
    },
    // Dedicated OTP collection (fallback if users don't have OTP fields)
    {
      slug: 'otps',
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'hash', type: 'text', required: true },
        { name: 'purpose', type: 'text' },
        { name: 'attempts', type: 'number', defaultValue: 0 },
        { name: 'expiresAt', type: 'date' },
      ],
    },
  ],
  db: sqliteAdapter({
    client: { url: 'file:./dev.db' },
  }),
  editor: lexicalEditor(),
  plugins,
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-key-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})