import type { OtpEmailParams } from '../../domain/emailTemplates'

/** Shared semantic content keeps HTML and text alternatives in agreement. */
export function otpContent(params: OtpEmailParams) {
  const language = params.language ?? params.baseOptions?.language ?? 'en'
  const es = language === 'es'
  const brand = params.baseOptions?.projectName?.trim() || (es ? 'tu cuenta' : 'your account')
  // Header values must never introduce additional email headers, including standalone exports.
  if (/[\r\n]/.test(brand)) throw new Error('auth-login: invalid email project name')
  const purpose = params.purpose ?? 'login'
  const subjects = es
    ? {
        login: `Código de acceso a ${brand}`,
        signup: `Confirma tu registro en ${brand}`,
        'verify-email': `Verifica tu correo en ${brand}`,
        'password-reset': `Restablece tu contraseña en ${brand}`,
        reauth: `Confirma tu identidad en ${brand}`,
      }
    : {
        login: `Sign-in code for ${brand}`,
        signup: `Confirm your registration with ${brand}`,
        'verify-email': `Verify your email with ${brand}`,
        'password-reset': `Reset your password with ${brand}`,
        reauth: `Confirm your identity with ${brand}`,
      }
  const instructions = es
    ? {
        login: `Usa este código para iniciar sesión en ${brand}:`,
        signup: `Usa este código para confirmar tu correo y continuar con tu registro en ${brand}:`,
        'verify-email': `Usa este código para verificar tu correo en ${brand}:`,
        'password-reset': `Usa este código para restablecer tu contraseña en ${brand}:`,
        reauth: `Usa este código para confirmar tu identidad y continuar con la acción iniciada en ${brand}:`,
      }
    : {
        login: `Use this code to sign in to ${brand}:`,
        signup: `Use this code to confirm your email and continue your registration with ${brand}:`,
        'verify-email': `Use this code to verify your email with ${brand}:`,
        'password-reset': `Use this code to reset your password with ${brand}:`,
        reauth: `Use this code to confirm your identity and continue the action you started with ${brand}:`,
      }
  let expiry: string
  if (params.expiresAt !== undefined) {
    if (!Number.isFinite(params.expiresAt)) throw new Error('auth-login: invalid email expiry')
    const deadline = new Date(params.expiresAt)
      .toISOString()
      .replace('T', ' ')
      .replace('.000Z', ' UTC')
      .replace('Z', ' UTC')
    expiry = `${es ? 'Este código vence el' : 'This code expires at'} ${deadline}.`
  } else {
    const seconds = params.expiresInSeconds ?? 300
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new Error('auth-login: invalid email expiry')
    const wholeSeconds = Math.floor(seconds)
    // Never round a short remaining lifetime up to a whole minute.
    const minutes = wholeSeconds > 0 && wholeSeconds % 60 === 0
    const value = minutes ? wholeSeconds / 60 : wholeSeconds
    const unit = minutes
      ? es
        ? value === 1
          ? 'minuto'
          : 'minutos'
        : value === 1
          ? 'minute'
          : 'minutes'
      : es
        ? value === 1
          ? 'segundo'
          : 'segundos'
        : value === 1
          ? 'second'
          : 'seconds'
    expiry = `${es ? 'Este código expira en' : 'This code expires in'} ${value} ${unit}.`
  }
  return {
    subject: subjects[purpose],
    preheader: subjects[purpose] + '.',
    instruction: instructions[purpose],
    greeting: `${es ? 'Hola' : 'Hi'}${params.userName.trim() ? ` ${params.userName.trim()}` : ''}`,
    expiry,
    doNotShare: es
      ? 'No compartas este código. Úsalo solo en el flujo que tú iniciaste.'
      : 'Do not share this code. Use it only in the flow you started.',
  }
}
