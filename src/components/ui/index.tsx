'use client'

import React, { lazy } from 'react'
import * as Tailwind from './tailwind'
import { VisualLoadingBoundary } from '../auth-presentation/VisualLoadingBoundary'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
export {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  Divider,
  Spinner,
} from '../atoms'
export { FormField as Input } from '../molecules/FormField'

const HeroOtpInput = lazy(() => import('./hero').then((module) => ({ default: module.OtpInput })))
export function OtpInput(props: React.ComponentProps<typeof Tailwind.OtpInput>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui' ? (
    <VisualLoadingBoundary>
      <HeroOtpInput {...props} />
    </VisualLoadingBoundary>
  ) : (
    <Tailwind.OtpInput {...props} />
  )
}
