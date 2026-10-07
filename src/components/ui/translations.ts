/**
 * UI copy for the auth pages (login, signup, forgot-password, verify-otp, set-password).
 *
 * Built-in support for English (`en`) and Spanish (`es`) out of the box — no
 * configuration required. Consumers can override any subset of keys, and/or add
 * entirely new locales, via the `messages` prop on `<AuthPages />` / individual
 * page components. Missing keys always fall back to the built-in English copy.
 */

export interface UiTranslations {
  common: { loading: string }
  login: {
    title: string
    subtitle: string
    passwordStepTitle: string
    passwordStepSubtitle: string
    otpPromptTitle: string
    otpPromptSubtitle: string
    continueWithGoogle: string
    or: string
    emailLabel: string
    passwordLabel: string
    continue: string
    forgotPassword: string
    edit: string
    verificationNotice: string
    sendCode: string
    sendingCode: string
    noAccount: string
    signUpLink: string
  }
  errors: {
    noAccountFound: string
    otpSendFailed: string
    genericError: string
    invalidCredentials: string
    passwordMismatch: string
    invalidOtp: string
    otpExpired: string
    proofExpired: string
  }
  signup: {
    title: string
    subtitle: string
    fullNameLabel: string
    emailLabel: string
    continueWithGoogle: string
    or: string
    termsNotice: string
    termsLink: string
    andSeparator: string
    privacyLink: string
    createAccount: string
    haveAccount: string
    loginLink: string
  }
  forgotPassword: {
    title: string
    subtitle: string
    emailLabel: string
    sendResetCode: string
    backToLogin: string
  }
  verifyOtp: {
    incompleteLink: string
    codeLabel: string
    digitLabel: string
    title: string
    passwordResetTitle: string
    subtitle: string
    passwordResetSubtitle: string
    verify: string
    noCodeReceived: string
    resendCode: string
    resending: string
    resendIn: string
    backToLogin: string
  }
  setPassword: {
    showPassword: string
    hidePassword: string
    title: string
    subtitle: string
    newPasswordLabel: string
    confirmPasswordLabel: string
    passwordRequirements: string
    setPassword: string
    reauthenticationIntro: string
    currentPasswordLabel: string
    reauthenticate: string
    verifyByEmail: string
    backToLogin: string
  }
}

/** Deep partial — every field at every level is optional, for override objects. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

const en: UiTranslations = {
  common: { loading: 'Loading' },
  login: {
    title: 'Welcome Back',
    subtitle: 'Sign in with your email to continue.',
    passwordStepTitle: 'Enter Password',
    passwordStepSubtitle: 'Enter your password to sign in.',
    otpPromptTitle: 'Verify Identity',
    otpPromptSubtitle: "We need to verify it's you.",
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    continue: 'Continue',
    forgotPassword: 'Forgot password?',
    edit: 'Edit',
    verificationNotice: "We'll send a verification code to this email.",
    sendCode: 'Send Code',
    sendingCode: 'Sending...',
    noAccount: "Don't have an account?",
    signUpLink: 'Sign up',
  },
  errors: {
    noAccountFound: 'No account found with this email. Please sign up.',
    otpSendFailed: 'Failed to send verification code. Please try again.',
    genericError: 'Something went wrong. Please try again.',
    invalidCredentials: 'Invalid email or password.',
    passwordMismatch: 'Passwords do not match.',
    invalidOtp: 'Invalid verification code. Please try again.',
    otpExpired: 'Verification code has expired. Please request a new one.',
    proofExpired: 'This permission is no longer valid. Request a new code or verify your identity again.',
  },
  signup: {
    title: 'Create Account',
    subtitle: 'Enter your details to get started',
    fullNameLabel: 'Full Name',
    emailLabel: 'Email',
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    termsNotice: 'By signing up, you agree to our',
    termsLink: 'Terms of Service',
    andSeparator: 'and',
    privacyLink: 'Privacy Policy',
    createAccount: 'Create Account',
    haveAccount: 'Already have an account?',
    loginLink: 'Login',
  },
  forgotPassword: {
    title: 'Forgot Password',
    subtitle: "Enter your email and we'll send you a reset code",
    emailLabel: 'Email',
    sendResetCode: 'Send Reset Code',
    backToLogin: 'Back to Login',
  },
  verifyOtp: {
    incompleteLink: 'This verification link is incomplete. Start again to request a code.',
    codeLabel: 'Verification code',
    digitLabel: 'Digit {position} of {length}',
    title: 'Check Your Email',
    passwordResetTitle: 'Reset Password',
    subtitle: 'We sent a 6-digit code to',
    passwordResetSubtitle: 'Enter the code to reset your password',
    verify: 'Verify',
    noCodeReceived: "Didn't receive a code?",
    resendCode: 'Resend Code',
    resending: 'Sending...',
    resendIn: 'Resend in {seconds}s',
    backToLogin: 'Back to Login',
  },
  setPassword: {
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    title: 'Set Your Password',
    subtitle: 'Create a secure password for your account',
    newPasswordLabel: 'New Password',
    confirmPasswordLabel: 'Confirm Password',
    passwordRequirements: 'At least 15 characters; use a unique phrase, not a common or compromised password',
    setPassword: 'Set Password',
    reauthenticationIntro: 'Verify your identity before changing or adding a password.',
    currentPasswordLabel: 'Current password',
    reauthenticate: 'Reauthenticate',
    verifyByEmail: 'Verify by email',
    backToLogin: 'Back to login',
  },
}

const es: UiTranslations = {
  common: { loading: 'Cargando' },
  login: {
    title: 'Bienvenido de Nuevo',
    subtitle: 'Inicia sesión con tu correo para continuar.',
    passwordStepTitle: 'Ingresa tu Contraseña',
    passwordStepSubtitle: 'Ingresa tu contraseña para iniciar sesión.',
    otpPromptTitle: 'Verificar Identidad',
    otpPromptSubtitle: 'Necesitamos verificar que eres tú.',
    continueWithGoogle: 'Continuar con Google',
    or: 'o',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    continue: 'Continuar',
    forgotPassword: '¿Olvidaste tu contraseña?',
    edit: 'Editar',
    verificationNotice: 'Enviaremos un código de verificación a este correo.',
    sendCode: 'Enviar Código',
    sendingCode: 'Enviando...',
    noAccount: '¿No tienes una cuenta?',
    signUpLink: 'Regístrate',
  },
  errors: {
    noAccountFound: 'No se encontró una cuenta con este correo. Por favor regístrate.',
    otpSendFailed: 'Error al enviar el código de verificación. Intenta de nuevo.',
    genericError: 'Algo salió mal. Por favor intenta de nuevo.',
    invalidCredentials: 'Correo o contraseña inválidos.',
    passwordMismatch: 'Las contraseñas no coinciden.',
    invalidOtp: 'Código de verificación inválido. Intenta de nuevo.',
    otpExpired: 'El código de verificación ha expirado. Solicita uno nuevo.',
    proofExpired: 'Este permiso ya no es válido. Solicita un nuevo código o verifica tu identidad otra vez.',
  },
  signup: {
    title: 'Crear Cuenta',
    subtitle: 'Ingresa tus datos para comenzar',
    fullNameLabel: 'Nombre Completo',
    emailLabel: 'Correo electrónico',
    continueWithGoogle: 'Continuar con Google',
    or: 'o',
    termsNotice: 'Al registrarte, aceptas nuestros',
    termsLink: 'Términos de Servicio',
    andSeparator: 'y',
    privacyLink: 'Política de Privacidad',
    createAccount: 'Crear Cuenta',
    haveAccount: '¿Ya tienes una cuenta?',
    loginLink: 'Inicia sesión',
  },
  forgotPassword: {
    title: 'Recuperar Contraseña',
    subtitle: 'Ingresa tu correo y te enviaremos un código para restablecerla',
    emailLabel: 'Correo electrónico',
    sendResetCode: 'Enviar Código',
    backToLogin: 'Volver al Inicio de Sesión',
  },
  verifyOtp: {
    incompleteLink: 'Este enlace de verificación está incompleto. Empieza de nuevo para solicitar un código.',
    codeLabel: 'Código de verificación',
    digitLabel: 'Dígito {position} de {length}',
    title: 'Revisa tu Correo',
    passwordResetTitle: 'Restablecer Contraseña',
    subtitle: 'Enviamos un código de 6 dígitos a',
    passwordResetSubtitle: 'Ingresa el código para restablecer tu contraseña',
    verify: 'Verificar',
    noCodeReceived: '¿No recibiste el código?',
    resendCode: 'Reenviar Código',
    resending: 'Enviando...',
    resendIn: 'Reenviar en {seconds}s',
    backToLogin: 'Volver al Inicio de Sesión',
  },
  setPassword: {
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    title: 'Establece tu Contraseña',
    subtitle: 'Crea una contraseña segura para tu cuenta',
    newPasswordLabel: 'Nueva Contraseña',
    confirmPasswordLabel: 'Confirmar Contraseña',
    passwordRequirements: 'Al menos 15 caracteres; usa una frase única, no una contraseña común o comprometida',
    setPassword: 'Establecer Contraseña',
    reauthenticationIntro: 'Verifica tu identidad antes de cambiar o añadir una contraseña.',
    currentPasswordLabel: 'Contraseña actual',
    reauthenticate: 'Reautenticar',
    verifyByEmail: 'Verificar por correo',
    backToLogin: 'Volver a iniciar sesión',
  },
}

/** Built-in dictionaries. Consumers can add more locales via the `messages` prop. */
export const uiTranslations: Record<string, UiTranslations> = { en, es }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) return base
  const result = { ...base } as Record<string, unknown>
  for (const key in override) {
    const overrideValue = (override as Record<string, unknown>)[key]
    const baseValue = (base as Record<string, unknown>)[key]
    if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
      result[key] = deepMerge(baseValue, overrideValue)
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue
    }
  }
  return result as T
}

/**
 * Resolve the final UI translations for a given locale, applying any consumer
 * overrides on top of the built-in dictionaries.
 *
 * Resolution order per key: `messages[locale]` → `messages.en` → built-in
 * `[locale]` → built-in `en`. Consumers may pass a partial override object —
 * any key they don't specify falls back automatically.
 *
 * @param locale - Target locale, e.g. 'en', 'es', or any custom locale defined in `messages`.
 * @param messages - Optional map of locale -> partial translation overrides. Can also
 *   introduce brand-new locales not built into the plugin.
 */
export function getUiTranslations(
  locale: string = 'en',
  messages?: Record<string, DeepPartial<UiTranslations>>,
): UiTranslations {
  // Layer, in order: built-in en -> built-in locale -> consumer en override -> consumer locale override
  let result = uiTranslations.en
  if (locale !== 'en' && uiTranslations[locale]) {
    result = deepMerge(result, uiTranslations[locale] as DeepPartial<UiTranslations>)
  }
  if (messages?.en) result = deepMerge(result, messages.en)
  if (locale !== 'en' && messages?.[locale]) result = deepMerge(result, messages[locale])
  return result
}

/** Merge partial dictionaries without resolving a locale or mutating either input. */
export function mergeUiMessages(
  base: Record<string, DeepPartial<UiTranslations>> = {},
  overrides?: Record<string, DeepPartial<UiTranslations>>,
): Record<string, DeepPartial<UiTranslations>> {
  return deepMerge(base, overrides)
}

/** Unknown transport codes or consumer exceptions never become visible raw messages. */
export function authErrorMessage(error: string | null, translations: UiTranslations): string | null {
  if (!error) return null
  const messages = translations.errors
  return Object.prototype.hasOwnProperty.call(messages, error) ? messages[error as keyof typeof messages] : messages.genericError
}
