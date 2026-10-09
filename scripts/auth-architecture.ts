import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { isBuiltin } from 'node:module'
import type { ESLint, Rule } from 'eslint'

type Dependency = { specifier: string | null; typeOnly: boolean }
type GraphEdge = Dependency & { local: string | undefined; unresolved: boolean }
type Finding = { file: string; rule: string; trail: string[] }

const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/
const externalServer =
  /^(?:node:crypto|crypto|payload(?:\/|$)|drizzle-orm(?:\/|$)|@libsql\/client|jose|oauth4webapi)/
const externalImpure =
  /^(?:node:|payload(?:\/|$)|drizzle-orm(?:\/|$)|@libsql\/|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$)|jose(?:\/|$)|oauth4webapi(?:\/|$)|crypto$)/
const portableForbidden =
  /^(?:auth\/(?:infrastructure|interface|composition|server|contracts)\/|components\/|(?:configuration|contexts|hoc|theme)\/|i18n\/|endpoints\/|(?:config|otpOptions|googleOptions|adminOptions)\.)/
const serverImplementation =
  /^(?:auth\/(?:infrastructure|composition|server)\/|endpoints\/|index\.)/
const clientEntry =
  /^(?:exports\/client\.|auth\/interface\/(?:client|react)\/|components\/|(?:configuration|contexts|hoc|theme)\/|i18n\/)/
// Server entries sit next to their client owner, but remain RSC-only modules.
const reactServerEntry =
  /^(?:components\/(?:organisms\/AuthCard|pages\/AuthPages)\/server\.tsx$|auth\/interface\/react\/providers\/AuthProviderServer\/)/
const emailModule = /^auth\/infrastructure\/email\//

function sources(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? sources(file) : sourceExtensions.test(file) ? [file] : []
  })
}

/** Parse syntax, not source substrings: includes type imports, reexports, import types and CJS. */
export function dependencies(file: string, source: string): Dependency[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const edges: Dependency[] = []
  const add = (node: ts.Node | undefined, typeOnly = false) => {
    edges.push({ specifier: node && ts.isStringLiteralLike(node) ? node.text : null, typeOnly })
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, node.importClause?.isTypeOnly)
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier)
      add(node.moduleSpecifier, node.isTypeOnly)
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      add(node.moduleReference.expression, node.isTypeOnly)
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node.argument.literal, true)
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      add(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return edges
}

/** The same resolved transitive graph is consumed by lint and tests. No production modules execute. */
export function inspectArchitecture(
  root: string,
  overrides: ReadonlyMap<string, string> = new Map(),
): Finding[] {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const options = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, root).options
  const src = path.join(root, 'src')
  const files = [...new Set([...sources(src), ...overrides.keys()])]
  const graph = new Map<string, GraphEdge[]>()
  const relative = (file: string) => path.relative(src, file).split(path.sep).join('/')
  const resolve = (specifier: string, file: string) =>
    ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName
  for (const file of files) {
    const edges = dependencies(file, overrides.get(file) ?? fs.readFileSync(file, 'utf8')).map(
      (edge) => {
        const resolved = edge.specifier === null ? undefined : resolve(edge.specifier, file)
        const asset =
          edge.specifier &&
          /\.(?:css|scss|svg|png|jpg|woff2?)(?:\?.*)?$/.test(edge.specifier) &&
          fs.existsSync(path.resolve(path.dirname(file), edge.specifier.split('?')[0]))
        const local = resolved && resolved.startsWith(src + path.sep) ? resolved : undefined
        return {
          ...edge,
          local,
          unresolved:
            !resolved &&
            !asset &&
            edge.specifier !== null &&
            (edge.specifier.startsWith('.') || edge.specifier.startsWith('@/')),
        }
      },
    )
    graph.set(file, edges)
  }
  const findings: Finding[] = []
  const seenFindings = new Set<string>()
  const report = (file: string, rule: string, trail: string[]) => {
    const key = file + rule + trail.join(' -> ')
    if (!seenFindings.has(key)) {
      seenFindings.add(key)
      findings.push({ file, rule, trail })
    }
  }
  for (const file of files) {
    const name = relative(file)
    const pure = name.startsWith('auth/domain/') || name.startsWith('auth/application/')
    const domain = name.startsWith('auth/domain/')
    const http = name.startsWith('auth/interface/http/')
    const rsc = name === 'exports/rsc.ts' || reactServerEntry.test(name)
    const client = clientEntry.test(name) && !emailModule.test(name) && !reactServerEntry.test(name)
    const proxy = name === 'proxy.ts'
    if (!pure && !http && !client && !rsc && !proxy) continue
    const visited = new Set<string>()
    const walk = (current: string, trail: string[]) => {
      if (visited.has(current)) return
      visited.add(current)
      for (const edge of graph.get(current) ?? []) {
        const target = edge.local ? relative(edge.local) : edge.specifier
        const next = [...trail, target ?? '<nonliteral import>']
        if (target === null || edge.unresolved) {
          report(file, 'unresolved-boundary', next)
          continue
        }
        if (
          pure &&
          (externalImpure.test(target) ||
            isBuiltin(target) ||
            (edge.local && portableForbidden.test(target)) ||
            (domain && target.startsWith('auth/application/')))
        ) {
          report(file, domain ? 'domain-boundary' : 'application-boundary', next)
          continue
        }
        if (
          http &&
          edge.local &&
          /^(?:auth\/(?:infrastructure|server)\/|endpoints\/)/.test(target)
        ) {
          report(file, 'http-boundary', next)
          continue
        }
        // Types of a composed HTTP scope are allowed; concrete factory calls belong only to composition.
        if (http && edge.local && target.startsWith('auth/composition/') && !edge.typeOnly) {
          report(file, 'http-composition', next)
          continue
        }
        if (
          (client || rsc || proxy) &&
          ((edge.local &&
            serverImplementation.test(target) &&
            !(rsc && emailModule.test(target))) ||
            (!edge.local &&
              (externalServer.test(target) || isBuiltin(target)) &&
              !(
                edge.typeOnly &&
                rsc &&
                target === 'payload' &&
                ['adminOptions.ts', 'otpOptions.ts'].includes(relative(current))
              )))
        ) {
          report(file, 'runtime-boundary', next)
          continue
        }
        if (client && (emailModule.test(target) || (edge.local && reactServerEntry.test(target)))) {
          report(file, 'runtime-boundary', next)
          continue
        }
        if (edge.local && !(http && edge.typeOnly && target.startsWith('auth/composition/')))
          walk(edge.local, next)
      }
    }
    walk(file, [name])
  }
  return findings
}

export const architecturePlugin = {
  rules: {
    boundaries: {
      meta: { type: 'problem', schema: [], messages: { boundary: '{{rule}}: {{trail}}' } },
      create(context: Rule.RuleContext) {
        return {
          Program(node) {
            const file = context.filename
            const root = context.cwd
            // Include current source so unsaved lint input cannot bypass the on-disk graph.
            const findings = inspectArchitecture(root, new Map([[file, context.sourceCode.text]]))
            for (const finding of findings.filter((item) => item.file === file))
              context.report({
                node,
                messageId: 'boundary',
                data: { rule: finding.rule, trail: finding.trail.join(' -> ') },
              })
          },
        }
      },
    },
  },
} satisfies ESLint.Plugin
