import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve('.')
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options
const entries = ['src/exports/client.ts', 'src/exports/rsc.ts']
const program = ts.createProgram(
  entries.map((entry) => path.join(root, entry)),
  options,
)
const checker = program.getTypeChecker()
function exportedType(entry: string, name: string) {
  const file = program.getSourceFile(path.join(root, entry))!
  const symbol = checker
    .getExportsOfModule(checker.getSymbolAtLocation(file)!)
    .find((item) => item.name === name)!
  return checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(symbol))
}

it('RSC wrappers and client initialization still require explicit public configuration', () => {
  for (const [entry, names] of [
    ['src/exports/rsc.ts', ['AuthCardProps', 'AuthPagesProps', 'AuthProviderProps']],
    ['src/exports/client.ts', ['AuthProviderProps']],
  ] as const) {
    for (const name of names) {
      const property = checker.getPropertyOfType(exportedType(entry, name), 'publicConfig')!
      expect(property, `${entry}: ${name}`).toBeTruthy()
      expect(property.flags & ts.SymbolFlags.Optional).toBe(0)
      const type = checker.getTypeOfSymbolAtLocation(property, property.declarations![0])
      expect(checker.typeToString(type)).toBe('PublicAuthConfig')
    }
  }
})

it('the configuration allowed across the client/RSC boundary contains only public scalar fields', () => {
  const type = exportedType('src/exports/client.ts', 'PublicAuthConfig')
  const fields = checker.getPropertiesOfType(type)
  expect(fields.map((field) => field.name).sort()).toEqual([
    'allowSignup',
    'apiPrefix',
    'authBasePath',
    'authEndpointPrefix',
    'collection',
    'googleOAuthEnabled',
    'locale',
    'logoUrl',
    'modalLogin',
    'otpLogin',
    'passwordLogin',
    'projectName',
    'recovery',
    'routeRedirects',
    'style',
  ])
  for (const field of fields) {
    const value = checker.getTypeOfSymbolAtLocation(field, field.declarations![0])
    const parts = value.isUnion() ? value.types : [value]
    expect(
      parts.every((part) =>
        Boolean(
          part.flags &
          (ts.TypeFlags.StringLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Undefined),
        ),
      ),
      field.name,
    ).toBe(true)
  }
})
