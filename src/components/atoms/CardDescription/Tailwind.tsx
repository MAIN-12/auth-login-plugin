'use client'
import React from 'react'
import type { CardProps } from './types'
export const CardDescription: React.FC<CardProps> = ({ children, className = '' }) => (
  <p className={`text-gray-600 text-sm text-center ${className}`}>{children}</p>
)
