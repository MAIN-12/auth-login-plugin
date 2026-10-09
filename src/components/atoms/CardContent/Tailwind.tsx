'use client'
import React from 'react'
import type { CardProps } from './types'
export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-8 pb-6 ${className}`}>{children}</div>
)
