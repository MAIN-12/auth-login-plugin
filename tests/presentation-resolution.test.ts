import { describe, expect, it } from 'vitest'
import { mergeAuthPresentation } from '../src/configuration/authAppearance/resolveAppearance'
import { getAuthAppearanceDefaults } from '../src/configuration/authAppearance/defaults'
import { publicConfig } from './auth-test-config'
import { getUiTranslations } from '../src/i18n/ui'

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

describe('serializable appearance defaults', () => {
  it('returns data, not a React logo, without mutating public settings', () => {
    const config = Object.freeze({ ...publicConfig, locale: 'es', logoUrl: '/brand.svg' })
    expect(getAuthAppearanceDefaults(config)).toEqual({
      style: config.style,
      locale: 'es',
      logoUrl: '/brand.svg',
    })
    expect(getAuthAppearanceDefaults(config)).not.toHaveProperty('logo')
    expect(config.logoUrl).toBe('/brand.svg')
  })
  it('retains standalone style and language defaults without invented branding', () => {
    expect(getAuthAppearanceDefaults()).toEqual({
      style: 'tailwind',
      locale: 'en',
      logoUrl: undefined,
    })
  })
})
