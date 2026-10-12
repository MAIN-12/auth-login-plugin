import { createOtpEndpoints } from './otpLogin'
import { type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../../configuration/plugin/config'
import { authFailureResponse } from '../../shared/interface/http/authTransport'
import { AuthFailure } from '../../shared/contracts/errors'
import { createPasswordLoginEndpoint } from './passwordLogin'
import { createCapabilitiesEndpoint } from './session'

import { createPasswordEndpoints } from './ownership'

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
