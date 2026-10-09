import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export type OidcAccount = {
  sub: string
  email: string
  recent?: boolean
  authTime?: number
  amr?: string[]
}
type Grant = {
  account: OidcAccount
  nonce: string | null
  challenge: string | null
  redirect: string | null
  client: string | null
  failure: string
}

// Controlled OIDC server: real HTTP, PKCE verification, RSA-signed ID tokens and JWKS.
// It models provider protocol failures; it is not evidence of live Google acceptance.
export async function controlledOidcProvider() {
  const expectedIssuer = 'https://accounts.google.com'
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'acceptance-rsa',
    use: 'sig',
    alg: 'RS256',
  }
  const codes = new Map<string, Grant>()
  const callbacks: string[] = []
  const exchanges: { code: string | null; hasVerifier: boolean }[] = []
  let account: OidcAccount = { sub: 'google-public-1', email: 'google-public@example.com' }
  let failure = ''
  let issuer = 'http://127.0.0.1'
  let browserIssuer = 'http://localhost'
  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', issuer)
      if (url.pathname === '/.well-known/openid-configuration')
        return json(response, 200, {
          issuer: expectedIssuer,
          authorization_endpoint: `${browserIssuer}/authorize`,
          token_endpoint: `${expectedIssuer}/token`,
          jwks_uri: `${expectedIssuer}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
          code_challenge_methods_supported: ['S256'],
        })
      if (url.pathname === '/jwks') return json(response, 200, { keys: [jwk] })
      if (url.pathname === '/authorize') {
        const params = url.searchParams
        if (
          params.get('code_challenge_method') !== 'S256' ||
          !params.get('code_challenge') ||
          !params.get('nonce')
        )
          return json(response, 400, { error: 'invalid_request' })
        const code = randomBytes(24).toString('base64url')
        const callback = new URL(params.get('redirect_uri') ?? '')
        callback.searchParams.set('state', params.get('state') ?? '')
        if (failure === 'authorization') callback.searchParams.set('error', 'access_denied')
        else {
          codes.set(code, {
            account: { ...account },
            nonce: params.get('nonce'),
            challenge: params.get('code_challenge'),
            redirect: params.get('redirect_uri'),
            client: params.get('client_id'),
            failure,
          })
          callback.searchParams.set('code', code)
        }
        callbacks.push(callback.href)
        response.writeHead(302, { location: callback.href })
        return response.end()
      }
      if (url.pathname === '/token' && request.method === 'POST') {
        let raw = ''
        for await (const chunk of request) raw += chunk
        const params = new URLSearchParams(raw)
        const code = params.get('code')
        const grant = codes.get(code ?? '')
        codes.delete(code ?? '')
        exchanges.push({ code, hasVerifier: Boolean(params.get('code_verifier')) })
        if (
          params.get('client_id') !== 'consumer-google-client' ||
          params.get('client_secret') !== 'consumer-google-secret-private'
        )
          return json(response, 401, { error: 'invalid_client' })
        if (
          !grant ||
          grant.failure === 'code' ||
          params.get('redirect_uri') !== grant.redirect ||
          createHash('sha256')
            .update(params.get('code_verifier') ?? '')
            .digest('base64url') !== grant.challenge
        )
          return json(response, 400, { error: 'invalid_grant' })
        const now = Math.floor(Date.now() / 1000)
        const claims = {
          iss: grant.failure === 'issuer' ? 'https://attacker.invalid' : expectedIssuer,
          aud: grant.failure === 'audience' ? 'other-client' : grant.client,
          sub: grant.account.sub,
          email: grant.account.email,
          email_verified: true,
          iat: now,
          exp: grant.failure === 'expired-token' ? now - 60 : now + 300,
          nonce: grant.failure === 'nonce' ? 'wrong-nonce' : grant.nonce,
          ...(grant.account.recent ? { auth_time: grant.account.authTime ?? now } : {}),
          ...(grant.account.amr ? { amr: grant.account.amr } : {}),
        }
        const header = Buffer.from(
          JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' }),
        ).toString('base64url')
        const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
        const signed = `${header}.${payload}`
        const signature = sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')
        return json(response, 200, {
          access_token: randomBytes(24).toString('base64url'),
          token_type: 'Bearer',
          expires_in: 300,
          id_token: `${signed}.${grant.failure === 'signature' ? signature.slice(0, -4) + 'AAAA' : signature}`,
        })
      }
      json(response, 404, { error: 'not_found' })
    } catch {
      json(response, 500, { error: 'server_error' })
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  browserIssuer = `http://localhost:${(server.address() as AddressInfo).port}`
  return {
    issuer,
    browserIssuer,
    callbacks,
    exchanges,
    configure(next: OidcAccount, mode = '') {
      account = { ...next }
      failure = mode
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}
