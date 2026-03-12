/**
 * Rest timer hook — extracted from the duplicated timer logic
 * in both ExerciseLogger components.
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseRestTimerReturn {
  /** Current seconds remaining, null if not active */
  timeRemaining: number | null
  /** Whether the timer is currently counting down */
  isActive: boolean
  /** Start the countdown from the given number of seconds */
  start: (seconds: number) => void
  /** Skip/cancel the current timer */
  skip: () => void
}

export function useRestTimer(): UseRestTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isActive, setIsActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isActive && timeRemaining !== null) {
      if (timeRemaining <= 0) {
        setIsActive(false)
        setTimeRemaining(null)
        return
      }
      timerRef.current = setTimeout(
        () => setTimeRemaining(prev => (prev ?? 1) - 1),
        1000
      )
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isActive, timeRemaining])

  const start = useCallback((seconds: number) => {
    setTimeRemaining(seconds)
    setIsActive(true)
  }, [])

  const skip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsActive(false)
    setTimeRemaining(null)
  }, [])

  return { timeRemaining, isActive, start, skip }
}
