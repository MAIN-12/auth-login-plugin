import assert from 'node:assert/strict'
import type { Browser, Page } from '@playwright/test'
import type { controlledOidcProvider } from '../scripts/oauth-provider.ts'

export type BrowserAcceptanceOptions = {
  browser: Browser
  origin: string
  origin2: string
  database: string
  onPage?: (page: Page) => void
}
export type OidcProvider = Awaited<ReturnType<typeof controlledOidcProvider>>
export type FixtureMessage = { to: string; html: string; subject: string; date: string }
export type FixtureUser = {
  id: string | number
  role?: string
  verified?: boolean
  sessions: { id: string; createdAt: string }[]
}
export type FixtureSnapshot = {
  now: number
  inbox: FixtureMessage[]
  users: FixtureUser[]
  logs: string[]
  hooks: string[]
}
export function requiredHeader(response: Response, name: string): string {
  const value = response.headers.get(name)
  assert.ok(value, `expected response header ${name}`)
  return value
}
export function messageCode(message: FixtureMessage | undefined): string {
  assert.ok(message, 'expected fixture email')
  const match = String(message.html).match(/\b(\d{6})\b/)
  assert.ok(match, 'expected six-digit email code')
  return match[1]
}
