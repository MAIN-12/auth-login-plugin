'use client'
import React from 'react'
import type { CardProps } from './types'
import { Card as HeroCard } from '@heroui/react'
export const CardHeader = (props: CardProps) => <HeroCard.Header {...props} />
