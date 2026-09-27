'use client'

import React, { lazy, Suspense } from 'react'
import { useAuthPresentation } from '../auth-presentation/AuthPresentationContext'
import * as Tailwind from './tailwind'

// Keep the optional HeroUI dependency behind the selected presentation adapter.
const HeroButton = lazy(() => import('./hero').then(module => ({ default: module.Button })))
const HeroInput = lazy(() => import('./hero').then(module => ({ default: module.Input })))
const HeroCard = lazy(() => import('./hero').then(module => ({ default: module.Card })))
const HeroCardHeader = lazy(() => import('./hero').then(module => ({ default: module.CardHeader })))
const HeroCardContent = lazy(() => import('./hero').then(module => ({ default: module.CardContent })))
const HeroCardFooter = lazy(() => import('./hero').then(module => ({ default: module.CardFooter })))
const HeroCardTitle = lazy(() => import('./hero').then(module => ({ default: module.CardTitle })))
const HeroCardDescription = lazy(() => import('./hero').then(module => ({ default: module.CardDescription })))
const HeroDivider = lazy(() => import('./hero').then(module => ({ default: module.Divider })))
const HeroSpinner = lazy(() => import('./hero').then(module => ({ default: module.Spinner })))
const HeroOtpInput = lazy(() => import('./hero').then(module => ({ default: module.OtpInput })))

export function Button(props: React.ComponentProps<typeof Tailwind.Button>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroButton {...props} /></Suspense>
    : <Tailwind.Button {...props} />
}

export function Input(props: React.ComponentProps<typeof Tailwind.Input>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroInput {...props} /></Suspense>
    : <Tailwind.Input {...props} />
}

export function Card(props: React.ComponentProps<typeof Tailwind.Card>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCard {...props} /></Suspense>
    : <Tailwind.Card {...props} />
}

export function CardHeader(props: React.ComponentProps<typeof Tailwind.CardHeader>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCardHeader {...props} /></Suspense>
    : <Tailwind.CardHeader {...props} />
}

export function CardContent(props: React.ComponentProps<typeof Tailwind.CardContent>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCardContent {...props} /></Suspense>
    : <Tailwind.CardContent {...props} />
}

export function CardFooter(props: React.ComponentProps<typeof Tailwind.CardFooter>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCardFooter {...props} /></Suspense>
    : <Tailwind.CardFooter {...props} />
}

export function CardTitle(props: React.ComponentProps<typeof Tailwind.CardTitle>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCardTitle {...props} /></Suspense>
    : <Tailwind.CardTitle {...props} />
}

export function CardDescription(props: React.ComponentProps<typeof Tailwind.CardDescription>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroCardDescription {...props} /></Suspense>
    : <Tailwind.CardDescription {...props} />
}

export function Divider(props: React.ComponentProps<typeof Tailwind.Divider>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroDivider {...props} /></Suspense>
    : <Tailwind.Divider {...props} />
}

export function Spinner(props: React.ComponentProps<typeof Tailwind.Spinner>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroSpinner {...props} /></Suspense>
    : <Tailwind.Spinner {...props} />
}

export function OtpInput(props: React.ComponentProps<typeof Tailwind.OtpInput>) {
  const { style } = useAuthPresentation()
  return style === 'hero-ui'
    ? <Suspense fallback={null}><HeroOtpInput {...props} /></Suspense>
    : <Tailwind.OtpInput {...props} />
}
