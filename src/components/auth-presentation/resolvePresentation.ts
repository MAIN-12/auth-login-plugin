import { mergeUiMessages } from '../ui/translations'
import type { AuthPresentationProps } from './types'

/** Pure, immutable resolution from least to most specific. Undefined means inherit. */
export function mergeAuthPresentation(
  ...layers: Array<AuthPresentationProps | undefined>
): AuthPresentationProps {
  const result: AuthPresentationProps = {}
  for (const layer of layers) {
    if (!layer) continue
    if (layer.locale !== undefined) result.locale = layer.locale
    if (layer.style !== undefined) result.style = layer.style
    if (layer.logo !== undefined) result.logo = layer.logo
    if (layer.messages !== undefined)
      result.messages = mergeUiMessages(result.messages, layer.messages)
    if (layer.poweredBy !== undefined) {
      result.poweredBy = { ...result.poweredBy }
      for (const key of ['enabled', 'logoUrl', 'linkUrl', 'width', 'height'] as const) {
        const value = layer.poweredBy[key]
        if (value !== undefined) Object.assign(result.poweredBy, { [key]: value })
      }
    }
  }
  return result
}
