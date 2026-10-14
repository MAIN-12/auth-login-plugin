import React from 'react'
import { AuthSignupConfig } from '../AuthSignupConfig/index'
import { AuthProvider as ClientAuthProvider, type AuthProviderProps } from '../AuthProvider/index'
import { AuthConfigProvider } from '../AuthConfigProvider/index'
import { AuthPresentationDefaults } from '../../../../../contexts/AuthAppearanceContext'
import { getServerPresentationDefaults } from './defaults'

/** Server composition root: adapt plugin/request defaults without overriding parent context. */
export async function AuthProvider({
  authCardProps = {},
  publicConfig,
  ...props
}: AuthProviderProps) {
  const presentation = await getServerPresentationDefaults(publicConfig)
  return (
    <AuthConfigProvider publicConfig={publicConfig}>
      <AuthPresentationDefaults value={presentation}>
        <AuthSignupConfig enabled={publicConfig.allowSignup}>
          <ClientAuthProvider
            publicConfig={publicConfig}
            {...props}
            modalLogin={props.modalLogin ?? publicConfig.modalLogin}
            basePath={props.basePath ?? publicConfig.authBasePath}
            authCardProps={{
              ...authCardProps,
              showGoogleOAuth: authCardProps.showGoogleOAuth ?? publicConfig.googleOAuthEnabled,
              passwordLogin: authCardProps.passwordLogin ?? publicConfig.passwordLogin,
              otpLogin: authCardProps.otpLogin ?? publicConfig.otpLogin,
            }}
          />
        </AuthSignupConfig>
      </AuthPresentationDefaults>
    </AuthConfigProvider>
  )
}
export type { AuthProviderProps } from '../AuthProvider/index'
