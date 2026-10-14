import { createClient, type Config as SQLiteConfig } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import type { SQL } from 'drizzle-orm'
import { APIError } from 'payload'
export interface DrizzleDatabase {
  name: string
  tableNameMap: Map<string, string>
  schemaName?: string
  clientConfig?: SQLiteConfig
  schema?: Record<string, unknown>
  sessions: Record<
    string,
    { db: unknown; reject: () => Promise<void>; resolve: () => Promise<void> }
  >
  drizzle: { transaction<T>(work: (tx: unknown) => Promise<T>, options?: unknown): Promise<T> }
  execute(args: { db: unknown; raw?: string; sql?: SQL }): Promise<unknown>
}
export async function nativeTransaction<T>(
  db: DrizzleDatabase,
  work: (tx: unknown) => Promise<T>,
): Promise<T> {
  if (db.name !== 'sqlite') return db.drizzle.transaction(work)
  if (!db.clientConfig || !db.schema) throw new APIError('AUTH_FAILED', 401)
  for (let attempt = 0; ; attempt++) {
    const client = createClient(db.clientConfig)
    let started = false
    try {
      const connection = drizzle(client, { schema: db.schema })
      return await connection.transaction(async (tx) => {
        started = true
        return work(tx)
      })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (started || attempt >= 19 || (code !== 'SQLITE_BUSY' && code !== 'SQLITE_LOCKED'))
        throw error
    } finally {
      client.close()
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
