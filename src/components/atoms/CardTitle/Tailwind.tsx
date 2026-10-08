'use client'
import React from 'react'
import type { CardProps } from './types'
export const CardTitle: React.FC<CardProps> = ({ children, className = '' }) => (
  <h1 className={`text-xl font-semibold text-gray-900 ${className}`}>{children}</h1>
)
