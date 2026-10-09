export type SupportedLanguage = 'en' | 'es'

export interface EmailTranslations {
  greeting: string
  footerCopyright: string
  footerTagline: string
  footerContactMessage: string
  footerEmailSentTo: string
  footerSecurityNotice: string
  otp: {
    subjectLogin: string
    subjectPasswordReset: string
    preheader: string
    purposeLogin: string
    purposePasswordReset: string
    expiresIn: string
    ignoreMessage: string
  }
  welcome: {
    subject: string
    preheader: string
    title: string
    introMessage: string
    ctaButton: string
    helpMessage: string
  }
  passwordReset: {
    subject: string
    preheader: string
    title: string
    intro: string
    expiresIn: string
    warningMessage: string
  }
  passwordChanged: {
    subject: string
    preheader: string
    title: string
    message: string
    warningMessage: string
    ctaButton: string
  }
}

const translations: Record<SupportedLanguage, EmailTranslations> = {
  en: {
    greeting: 'Hi',
    footerCopyright: 'All rights reserved.',
    footerTagline: 'Powered by Main12',
    footerContactMessage: 'If you have any issues, contact us at',
    footerEmailSentTo: 'This email was sent to',
    footerSecurityNotice: "If you don't recognize this action, please contact us.",
    otp: {
      subjectLogin: 'Your verification code',
      subjectPasswordReset: 'Your password reset code',
      preheader: 'Your verification code is',
      purposeLogin: 'Use this code to sign in to your account:',
      purposePasswordReset: 'Use this code to reset your password:',
      expiresIn: 'This code expires in',
      ignoreMessage: "If you didn't request this code, you can safely ignore this email.",
    },
    welcome: {
      subject: 'Welcome! 🎉',
      preheader: 'Your account is ready',
      title: 'Welcome',
      introMessage: 'Your account is ready. Start exploring and get the most out of the platform.',
      ctaButton: 'Get Started',
      helpMessage: "Questions? We're here to help. Just reply to this email anytime.",
    },
    passwordReset: {
      subject: 'Reset your password',
      preheader: 'Your password reset code is',
      title: 'Reset your password',
      intro: 'We received a request to reset your password. Use this code to continue:',
      expiresIn: 'This code expires in',
      warningMessage:
        "If you didn't request a password reset, please ignore this email or contact support.",
    },
    passwordChanged: {
      subject: 'Your password has been updated',
      preheader: 'Your password has been changed successfully.',
      title: 'Password updated',
      message:
        'Your password has been successfully changed. You can now use your new password to sign in.',
      warningMessage:
        "If you didn't make this change, please reset your password immediately and contact support.",
      ctaButton: 'Sign In',
    },
  },
  es: {
    greeting: 'Hola',
    footerCopyright: 'Todos los derechos reservados.',
    footerTagline: 'Desarrollado por Main12',
    footerContactMessage: 'Si tienes algún problema, contáctanos a',
    footerEmailSentTo: 'Este correo fue enviado a',
    footerSecurityNotice: 'Si no reconoces esta acción, por favor contáctanos.',
    otp: {
      subjectLogin: 'Tu código de verificación',
      subjectPasswordReset: 'Tu código para restablecer la contraseña',
      preheader: 'Tu código de verificación es',
      purposeLogin: 'Usa este código para iniciar sesión en tu cuenta:',
      purposePasswordReset: 'Usa este código para restablecer tu contraseña:',
      expiresIn: 'Este código expira en',
      ignoreMessage: 'Si no solicitaste este código, puedes ignorar este correo.',
    },
    welcome: {
      subject: '¡Bienvenido! 🎉',
      preheader: 'Tu cuenta está lista',
      title: 'Bienvenido',
      introMessage:
        'Tu cuenta está lista. Comienza a explorar y aprovecha la plataforma al máximo.',
      ctaButton: 'Comenzar',
      helpMessage: '¿Preguntas? Estamos aquí para ayudar. Solo responde a este correo.',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña',
      preheader: 'Tu código para restablecer la contraseña es',
      title: 'Restablece tu contraseña',
      intro: 'Recibimos una solicitud para restablecer tu contraseña. Usa este código:',
      expiresIn: 'Este código expira en',
      warningMessage:
        'Si no solicitaste restablecer tu contraseña, ignora este correo o contacta a soporte.',
    },
    passwordChanged: {
      subject: 'Tu contraseña ha sido actualizada',
      preheader: 'Tu contraseña ha sido cambiada exitosamente.',
      title: 'Contraseña actualizada',
      message:
        'Tu contraseña ha sido cambiada exitosamente. Ahora puedes usar tu nueva contraseña.',
      warningMessage:
        'Si no realizaste este cambio, restablece tu contraseña inmediatamente y contacta a soporte.',
      ctaButton: 'Iniciar Sesión',
    },
  },
}

export function getEmailTranslations(language: SupportedLanguage = 'en'): EmailTranslations {
  return translations[language] || translations.en
}

export default translations
