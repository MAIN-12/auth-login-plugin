import { createOtpEndpoints } from '../composition/otpLogin'
import { type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../../config'
import { authFailureResponse } from '../interface/http/authTransport'
import { AuthFailure } from '../contracts/errors'
import { createPasswordLoginEndpoint } from '../composition/passwordLogin'
import { createCapabilitiesEndpoint } from '../composition/session'

import { createPasswordEndpoints } from '../composition/ownership'

export function createAuthEndpoints(
  settings: PublicAuthConfig,
  otpOptions?: OtpOptions,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
): Endpoint[] {
  const disabled: Endpoint['handler'] = (req) =>
    authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
  return [
    createPasswordLoginEndpoint(settings),
    ...createOtpEndpoints(settings, otpOptions, assertPublicAccount),
    ...createPasswordEndpoints(settings, otpOptions, assertPublicAccount),
    { path: `${settings.authEndpointPrefix}/check-email`, method: 'post', handler: disabled },
    createCapabilitiesEndpoint(settings),
    ...['oauth/google', 'oauth/google/callback'].map((path) => ({
      path: `${settings.authEndpointPrefix}/${path}`,
      method: 'post' as const,
      handler: disabled,
    })),
  ]
}
