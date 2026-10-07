import type { Access, Config, PayloadRequest } from 'payload'
import type { AuthenticationEvidence, AdminOptions } from '../../adminOptions'
export type { AuthenticationEvidence, AdminOptions } from '../../adminOptions'
interface NativeProof {
  value: Readonly<AuthenticationEvidence>
  principal: NonNullable<PayloadRequest['user']>
  id: string | number
  sid: string
  collection: string
}
// Native GraphQL isolates request properties using a Proxy. Headers and the native
// principal retain their exact identities; no client-visible marker or user-field fallback.
const registryKey = Symbol.for('@main12/auth-login/native-evidence/v1')
const server = globalThis as typeof globalThis & {
  [key: symbol]: WeakMap<PayloadRequest['payload'], WeakMap<Headers, NativeProof>> | undefined
}
// Next may evaluate plugin modules independently for REST and GraphQL bundles.
// Share only capability storage, partitioned by exact native Payload instance;
// never share configuration, secrets, policy callbacks or consumer settings.
const evidence = (server[registryKey] ??= new WeakMap<
  PayloadRequest['payload'],
  WeakMap<Headers, NativeProof>
>())
export function setAuthenticationEvidence(req: PayloadRequest, value: AuthenticationEvidence) {
  if (!req.user || typeof req.user._sid !== 'string' || typeof req.user.collection !== 'string')
    return
  const requests = evidence.get(req.payload) ?? new WeakMap<Headers, NativeProof>()
  requests.set(req.headers, {
    value: Object.freeze({ ...value, amr: value.amr ? Object.freeze([...value.amr]) : undefined }),
    principal: req.user,
    id: req.user.id,
    sid: req.user._sid,
    collection: req.user.collection,
  })
  evidence.set(req.payload, requests)
}
export function getAuthenticationEvidence(req: PayloadRequest) {
  const proof = evidence.get(req.payload)?.get(req.headers)
  return proof &&
    req.user === proof.principal &&
    req.user.id === proof.id &&
    req.user._sid === proof.sid &&
    req.user.collection === proof.collection
    ? proof.value
    : undefined
}
export function createAdminPolicy(
  options?: AdminOptions,
  originalAdmin?: (args: { req: PayloadRequest }) => boolean | Promise<boolean>,
) {
  if (
    options !== undefined &&
    (!options ||
      typeof options !== 'object' ||
      Array.isArray(options) ||
      typeof options.authorize !== 'function' ||
      !Array.isArray(options.collections) ||
      (options.globals !== undefined && !Array.isArray(options.globals)))
  )
    throw new Error('auth-login: invalid admin policy')
  for (const resources of [options?.collections, options?.globals]) {
    const slugs = new Set<string>()
    for (const resource of resources ?? []) {
      if (
        !resource ||
        typeof resource.slug !== 'string' ||
        slugs.has(resource.slug) ||
        !Array.isArray(resource.operations) ||
        !resource.operations.length
      )
        throw new Error('auth-login: invalid or duplicate admin resource')
      slugs.add(resource.slug)
    }
  }
  const permits = async (req: PayloadRequest): Promise<boolean> => {
    const proof = getAuthenticationEvidence(req)
    if (!req.user || !proof || proof.method === 'otp' || !options) return false
    try {
      return (
        (originalAdmin ? (await originalAdmin({ req })) === true : true) &&
        (await options.authorize({ req, evidence: proof })) === true
      )
    } catch {
      return false
    }
  }
  const compose =
    (original?: Access): Access =>
    async (args) => {
      if (!(await permits(args.req))) return false
      return original ? original(args) : true
    }
  function protect(config: Config): Config {
    for (const resource of options?.collections ?? [])
      if (
        !config.collections?.some((collection) => collection.slug === resource.slug) ||
        !resource.operations.length ||
        resource.operations.some(
          (operation) => !['read', 'create', 'update', 'delete'].includes(operation),
        )
      )
        throw new Error('auth-login: invalid admin collection resource')
    for (const resource of options?.globals ?? [])
      if (
        !config.globals?.some((global) => global.slug === resource.slug) ||
        !resource.operations.length ||
        resource.operations.some((operation) => !['read', 'update'].includes(operation))
      )
        throw new Error('auth-login: invalid admin global resource')
    return {
      ...config,
      collections: config.collections?.map((collection) => {
        const resource = options?.collections.find((resource) => resource.slug === collection.slug)
        if (!resource) return collection
        const access = { ...collection.access }
        for (const operation of resource.operations) access[operation] = compose(access[operation])
        return { ...collection, access }
      }),
      globals: config.globals?.map((global) => {
        const resource = options?.globals?.find((resource) => resource.slug === global.slug)
        if (!resource) return global
        const access = { ...global.access }
        for (const operation of resource.operations) access[operation] = compose(access[operation])
        return { ...global, access }
      }),
    }
  }
  return { permits, compose, protect }
}
