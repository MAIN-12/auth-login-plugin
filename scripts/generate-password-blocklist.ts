import { readFile, writeFile } from 'node:fs/promises'

const domain = new URL('../src/auth/domain/', import.meta.url)
const rules = await readFile(new URL('passwordRules.ts', domain), 'utf8')
const minimum = rules.match(/export const MIN_PASSWORD_LENGTH = (\d+)/)?.[1]
if (!minimum) throw new Error('Cannot read MIN_PASSWORD_LENGTH; update blocklist generator')
const parsed: unknown = JSON.parse(
  await readFile(new URL('password-blocklist.json', domain), 'utf8'),
)
if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string'))
  throw new Error('Password corpus must contain only strings')
const corpus = parsed as string[]
// Pruning ASCII entries is length-preserving for every case variant. A future Unicode
// corpus requires reviewing case-mapping length semantics before regenerating.
if (corpus.some((entry) => /[^\x00-\x7f]/.test(entry)))
  throw new Error('Review Unicode case-mapping before pruning the password corpus')
const eligible = [...new Set(corpus.map((entry) => entry.toLowerCase()))]
  .filter((entry) => Array.from(entry).length >= Number(minimum))
  .sort()
await writeFile(
  new URL('password-blocklist-eligible.json', domain),
  JSON.stringify(eligible, null, 2) + '\n',
)
