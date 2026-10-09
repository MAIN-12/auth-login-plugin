import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { plugins } from './plugins/index'

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
        useSessions: true,
        verify: true,
        removeTokenFromResponses: true,
        maxLoginAttempts: 5,
      },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'authProvider', type: 'text', admin: { hidden: true } },
      ],
    },
  ],
  db: sqliteAdapter({
    client: { url: 'file:./dev.db' },
  }),
  editor: lexicalEditor(),
  // Configure a production email adapter before opting into OTP/signup/recovery.
  plugins,
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-key-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
