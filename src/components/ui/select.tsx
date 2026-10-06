'use client'

import * as React from 'react'

/**
 * A lightweight, dependency-free Shadcn-styled <select> built on the native
 * select element (matching the utility classes used throughout the app).
 * Rendered as a plain <select> so it works without a Radix dependency.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'