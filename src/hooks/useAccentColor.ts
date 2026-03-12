/**
 * Accent color hook — manages the user's selected accent color
 * and applies the CSS overrides. Replaces the duplicated logic
 * in profile/page.tsx and portal/layout.tsx.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_ACCENT_COLOR } from '@/utils/constants'

const STORAGE_KEY = 'accentColor'
const STYLE_ID = 'accent-color-override'

/**
 * Inject a <style> tag that overrides Tailwind's orange classes
 * with the user's chosen accent color.
 */
function applyAccentCSS(hex: string): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(STYLE_ID)
  if (existing) existing.remove()

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    :root { --accent: ${hex}; }
    .text-orange-500, .text-orange-400 { color: ${hex} !important; }
    .bg-orange-500 { background-color: ${hex} !important; }
    .bg-orange-600, .hover\\:bg-orange-600:hover { background-color: ${hex}dd !important; }
    .border-orange-500, .focus\\:border-orange-500:focus { border-color: ${hex} !important; }
    .bg-orange-500\\/20, .bg-orange-500\\/10 { background-color: ${hex}33 !important; }
    .border-orange-500\\/30, .border-orange-500\\/40 { border-color: ${hex}55 !important; }
    .text-orange-400 { color: ${hex}cc !important; }
    .ring-orange-500, .focus\\:ring-orange-500:focus { --tw-ring-color: ${hex} !important; }
  `
  document.head.appendChild(style)
}

interface UseAccentColorReturn {
  /** Current accent color hex value */
  accentColor: string
  /** Update the accent color (persists to localStorage and applies CSS) */
  setAccentColor: (hex: string) => void
}

export function useAccentColor(): UseAccentColorReturn {
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT_COLOR)

  // Load stored color on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT_COLOR
    setAccentColorState(stored)
    applyAccentCSS(stored)
  }, [])

  const setAccentColor = useCallback((hex: string) => {
    setAccentColorState(hex)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, hex)
      applyAccentCSS(hex)
    }
  }, [])

  return { accentColor, setAccentColor }
}
