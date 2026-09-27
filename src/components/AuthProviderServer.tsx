import React from 'react'
import { AuthSignupConfig } from './AuthSignupConfig'
import { AuthProvider as ClientAuthProvider, type AuthProviderProps } from './AuthProvider'
import { getServerAllowSignup, getServerGoogleOAuthEnabled, getServerModalLogin, getServerProviderConfig } from '../config'
import { AuthPresentationDefaults } from './auth-presentation/AuthPresentationContext'
import { getServerPresentationDefaults } from './auth-presentation/serverDefaults'

/** Server composition root: adapt plugin/request defaults without overriding parent context. */
export async function AuthProvider({ authCardProps = {}, ...props }: AuthProviderProps) {
  const settings = getServerProviderConfig()
  const presentation = await getServerPresentationDefaults()
  return (
    <AuthPresentationDefaults value={presentation}>
      <AuthSignupConfig enabled={getServerAllowSignup()}>
        <ClientAuthProvider
          {...props}
          modalLogin={props.modalLogin ?? getServerModalLogin()}
          basePath={props.basePath ?? settings.authBasePath}
          authCardProps={{
            ...authCardProps,
            showGoogleOAuth: authCardProps.showGoogleOAuth ?? getServerGoogleOAuthEnabled(),
            passwordLogin: authCardProps.passwordLogin ?? settings.passwordLogin,
            otpLogin: authCardProps.otpLogin ?? settings.otpLogin,
          }}
        />
      </AuthSignupConfig>
    </AuthPresentationDefaults>
  )
}
export type { AuthProviderProps } from './AuthProvider'
