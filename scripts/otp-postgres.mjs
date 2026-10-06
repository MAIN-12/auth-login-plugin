import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
export async function freePort() {
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  return port
}
export async function temporaryPostgres() {
  const bin = process.env.AUTH_TEST_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
  const dir = await mkdtemp(join(tmpdir(), 'auth-otp-pg17-'))
  const port = await freePort()
  const run = (command, args) => execFileSync(join(bin, command), args, { stdio: 'pipe' })
  try {
    run('initdb', ['-D', dir, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
    run('pg_ctl', ['-D', dir, '-l', join(dir, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, '-w', 'start'])
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'acceptance'])
    return { url: `postgres://postgres@127.0.0.1:${port}/acceptance`, version: run('postgres', ['--version']).toString().trim(), outage: async work => { run('pg_ctl', ['-D', dir, '-m', 'fast', '-w', 'stop']); try { return await work() } finally { run('pg_ctl', ['-D', dir, '-l', join(dir, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, '-w', 'start']) } }, close: async () => { run('pg_ctl', ['-D', dir, '-m', 'immediate', '-w', 'stop']); await rm(dir, { recursive: true, force: true }) } }
  } catch (error) {
    try { run('pg_ctl', ['-D', dir, '-m', 'immediate', '-w', 'stop']) } catch {}
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}
