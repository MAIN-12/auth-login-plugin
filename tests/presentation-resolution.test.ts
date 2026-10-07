import { describe, expect, it } from 'vitest'
import { mergeAuthPresentation } from '../src/components/auth-presentation/resolvePresentation'
import { getUiTranslations } from '../src/components/ui/translations'

describe('presentation precedence', () => {
  it('resolves explicit values above provider and fallback without mutation', () => {
    const fallback = Object.freeze({ locale: 'en', style: 'tailwind' as const, logo: 'default' })
    const provider = Object.freeze({ locale: 'es', logo: 'shared' })
    expect(
      mergeAuthPresentation(fallback, provider, { locale: undefined, logo: 'override' }),
    ).toEqual({ locale: 'es', style: 'tailwind', logo: 'override' })
    expect(fallback.logo).toBe('default')
    expect(provider.logo).toBe('shared')
  })
  it('preserves null logos and false attribution flags while undefined inherits', () => {
    const result = mergeAuthPresentation(
      { logo: 'default', poweredBy: { enabled: true, width: 42 } },
      { logo: null, poweredBy: { enabled: false, width: undefined } },
    )
    expect(result).toEqual({ logo: null, poweredBy: { enabled: false, width: 42 } })
  })
  it('merges partial dictionaries by locale, section, and individual key', () => {
    const shared = Object.freeze({
      messages: {
        es: { login: { title: 'Shared title', subtitle: 'Shared subtitle' } },
        fr: { login: { title: 'Bonjour' } },
      },
    })
    const resolved = mergeAuthPresentation(shared, {
      messages: { es: { login: { title: 'Local title', subtitle: undefined } } },
    })
    expect(getUiTranslations('es', resolved.messages).login).toMatchObject({
      title: 'Local title',
      subtitle: 'Shared subtitle',
    })
    expect(getUiTranslations('fr', resolved.messages).login.title).toBe('Bonjour')
    expect(shared.messages.es.login.title).toBe('Shared title')
  })
})
