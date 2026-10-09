import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const script = resolve('scripts/publish-package.mjs')
const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function execute(args: string[], settings: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'publish-script-test-'))
  directories.push(directory)
  const log = join(directory, 'commands.jsonl')
  const fake = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify({command, args}) + '\\n');
if (command === 'git') {
  if (args[0] === 'status') {
    const prior = fs.readFileSync(process.env.RELEASE_TEST_LOG, 'utf8');
    const packed = prior.includes('"pack"');
    process.stdout.write(process.env.RELEASE_TEST_DIRTY || (packed ? process.env.RELEASE_TEST_DIRTY_AFTER || '' : ''));
  } else process.stdout.write('test-head');
}
if (command === 'pnpm' && args[0] === 'pack') {
  fs.writeFileSync(path.join(args[2], 'package.tgz'), 'mock tarball');
}
if (command === 'pnpm' && args[1] === process.env.RELEASE_TEST_FAIL) process.exit(1);
`
  for (const command of ['pnpm', 'npm', 'git']) {
    writeFileSync(join(directory, command), fake, { mode: 0o755 })
  }
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: directory + delimiter + process.env.PATH,
      RELEASE_TEST_LOG: log,
      ...settings,
    },
  })
  const commands = (() => {
    try {
      return readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { command: string; args: string[] })
    } catch {
      return []
    }
  })()
  return { ...result, commands }
}

describe('package publishing CLI', () => {
  it('provides help and rejects invalid/combined arguments without running commands', () => {
    expect(execute(['--help']).status).toBe(0)
    for (const args of [['--yes'], ['--publish', '--dry-run']]) {
      const result = execute(args)
      expect(result.status).toBe(1)
      expect(result.commands).toEqual([])
    }
  })

  it.each([[], ['--dry-run']])('defaults to a safe artifact dry run (%j)', (...args) => {
    const result = execute(args)
    expect(result.status).toBe(0)
    expect(
      result.commands
        .filter(({ command }) => command === 'pnpm')
        .map(({ args }) => args.slice(0, 2)),
    ).toEqual([
      ['run', 'lint'],
      ['run', 'typecheck'],
      ['run', 'test:unit'],
      ['run', 'build'],
      ['pack', '--pack-destination'],
    ])
    const publishes = result.commands.filter(({ command }) => command === 'npm')
    expect(publishes).toHaveLength(1)
    expect(publishes[0].args).toContain('--dry-run')
    expect(publishes[0].args[1]).toMatch(/\.tgz$/)
  })

  it.each([' M package.json', '?? unknown.txt'])(
    'refuses dirty tracked/untracked files (%s)',
    (dirty) => {
      const result = execute(['--publish'], { RELEASE_TEST_DIRTY: dirty })
      expect(result.status).toBe(1)
      expect(result.commands.map(({ command }) => command)).toEqual(['git'])
    },
  )

  it('refuses changes introduced during packaging before any upload', () => {
    const result = execute(['--publish'], { RELEASE_TEST_DIRTY_AFTER: ' M package.json' })
    expect(result.status).toBe(1)
    expect(result.commands.filter(({ command }) => command === 'npm')).toHaveLength(1)
    expect(result.commands.find(({ command }) => command === 'npm')?.args).toContain('--dry-run')
  })

  it('stops at a failed quality gate without packing or publishing', () => {
    const result = execute([], { RELEASE_TEST_FAIL: 'typecheck' })
    expect(result.status).toBe(1)
    expect(result.commands.map(({ args }) => args)).toEqual([
      ['run', 'lint'],
      ['run', 'typecheck'],
    ])
  })

  it('only explicitly publishes the same checked artifact with fixed public registry and latest tag', () => {
    const result = execute(['--publish'])
    expect(result.status).toBe(0)
    const publishes = result.commands.filter(({ command }) => command === 'npm')
    expect(publishes).toHaveLength(2)
    expect(publishes[0].args.at(-1)).toBe('--dry-run')
    expect(publishes[1].args.at(-1)).toBe('--dry-run=false')
    expect(publishes[0].args.slice(0, -1)).toEqual(publishes[1].args.slice(0, -1))
    expect(publishes[1].args).toEqual(
      expect.arrayContaining([
        '--access=public',
        '--tag=latest',
        '--registry=https://registry.npmjs.org/',
        '--@main12:registry=https://registry.npmjs.org/',
        '--ignore-scripts',
      ]),
    )
    expect(
      result.commands.filter(({ command, args }) => command === 'git' && args[0] === 'status'),
    ).toHaveLength(2)
  })
})
