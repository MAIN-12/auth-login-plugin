import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type AddressInfo } from 'node:net'
export async function freePort() {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const port = (probe.address() as AddressInfo).port
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}
export async function temporaryPostgres() {
  const bin = process.env.AUTH_TEST_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
  if (process.env.AUTH_TEST_DATABASE_URL) {
    const parent = process.env.AUTH_TEST_DATABASE_URL
    const name = `auth_acceptance_${process.pid}_${Date.now()}`
    const run = (sql: string) =>
      execFileSync(join(bin, 'psql'), [parent, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
        stdio: 'pipe',
      })
    run(`CREATE DATABASE "${name}"`)
    const database = new URL(parent)
    database.pathname = `/${name}`
    return {
      url: database.href,
      version: execFileSync(join(bin, 'psql'), [parent, '-Atc', 'SELECT version()'])
        .toString()
        .trim(),
      outage: async <T>(work: () => Promise<T>): Promise<T> => {
        run(`ALTER DATABASE "${name}" ALLOW_CONNECTIONS false`)
        run(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}'`)
        try {
          return await work()
        } finally {
          run(`ALTER DATABASE "${name}" ALLOW_CONNECTIONS true`)
        }
      },
      close: async () => {
        run(`DROP DATABASE "${name}" WITH (FORCE)`)
      },
    }
  }
  const dir = await mkdtemp(join(tmpdir(), 'auth-otp-pg17-'))
  const port = await freePort()
  const run = (command: string, args: string[]) =>
    execFileSync(join(bin, command), args, { stdio: 'pipe' })
  try {
    run('initdb', ['-D', dir, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
    run('pg_ctl', [
      '-D',
      dir,
      '-l',
      join(dir, 'server.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -k ${dir}`,
      '-w',
      'start',
    ])
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'acceptance'])
    return {
      url: `postgres://postgres@127.0.0.1:${port}/acceptance`,
      version: run('postgres', ['--version']).toString().trim(),
      outage: async <T>(work: () => Promise<T>): Promise<T> => {
        run('pg_ctl', ['-D', dir, '-m', 'fast', '-w', 'stop'])
        try {
          return await work()
        } finally {
          run('pg_ctl', [
            '-D',
            dir,
            '-l',
            join(dir, 'server.log'),
            '-o',
            `-h 127.0.0.1 -p ${port} -k ${dir}`,
            '-w',
            'start',
          ])
        }
      },
      close: async () => {
        run('pg_ctl', ['-D', dir, '-m', 'immediate', '-w', 'stop'])
        await rm(dir, { recursive: true, force: true })
      },
    }
  } catch (error) {
    try {
      run('pg_ctl', ['-D', dir, '-m', 'immediate', '-w', 'stop'])
    } catch {}
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}
