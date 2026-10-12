import { sql } from 'drizzle-orm'
import { APIError } from 'payload'
import type { DrizzleDatabase } from '../../../../shared/infrastructure/payload/nativeTransaction'
/** Resolve the native adapter table and lock the durable user before every session read/write. */
export async function lockUserRow(
  db: DrizzleDatabase,
  tx: unknown,
  collection: string,
  userID: string | number,
): Promise<void> {
  const normalized = collection
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
  const tableName = db.tableNameMap.get(collection) ?? db.tableNameMap.get(normalized)
  if (!tableName) throw new APIError('AUTH_FAILED', 401)
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const table =
    db.name === 'postgres' && db.schemaName
      ? `${quote(db.schemaName)}.${quote(tableName)}`
      : quote(tableName)
  await db.execute({
    db: tx,
    sql:
      db.name === 'postgres'
        ? sql`SELECT id FROM ${sql.raw(table)} WHERE id = ${userID} FOR UPDATE`
        : sql`UPDATE ${sql.raw(table)} SET id = id WHERE id = ${userID}`,
  })
}
