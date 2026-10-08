'use client'
import React from 'react'
import type { CardProps } from './types'
import { Card as HeroCard } from '@heroui/react'
export const Card = ({ children, className = '' }: CardProps) => (
  <HeroCard className={`w-full ${className}`} style={{ maxWidth: '400px' }}>
    {children}
  </HeroCard>
)
