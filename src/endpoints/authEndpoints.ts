import { selectEmailLocale } from '../auth/domain/emailPresentation'
import { createOtpEndpoints } from '../auth/composition/otpLogin'
import { type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../config'
import { authFailureResponse } from '../auth/interface/http/authTransport'
export {
  readJSON,
  assertAllowedOrigin,
  authFailureResponse,
} from '../auth/interface/http/authTransport'
import { AuthFailure } from '../auth/domain/login'
import { createPasswordLoginEndpoint } from '../auth/composition/passwordLogin'
/** Compatibility entry point, retired by auth-clean 06. */
export { createPasswordLoginEndpoint } from '../auth/composition/passwordLogin'
import { createCapabilitiesEndpoint } from '../auth/composition/session'

import { createPasswordEndpoints } from './passwordEndpoints'

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

/** Compatibility entry point; remove in auth-clean 06 after caller audit. */
export { createRefreshEndpoint } from '../auth/composition/session'

/** Browser locale is explicit; unsupported values use the configured per-instance fallback. */
export function requestEmailSettings(req: PayloadRequest, options: OtpOptions) {
  const locale = req.headers.get('accept-language')
  return {
    ...options.email!,
    locale: selectEmailLocale(locale, options.email!.locale),
  }
}
