/**
 * Shared calculation utilities for the 9toFit Performance Platform.
 * Extracted from inline usage across progress, records, and workouts pages.
 */

/**
 * Estimate 1 Rep Max using the Epley formula.
 * @param weight - Weight lifted in kg
 * @param reps - Number of reps performed
 * @returns Estimated 1RM in kg (rounded)
 */
export function calc1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

/**
 * Format a duration in seconds to a human-readable string.
 * @example formatDuration(3661) => "1u 1m"
 * @example formatDuration(90) => "1m 30s"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}u ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Format pace as min:sec per km.
 * @example formatPace(330) => "5:30 /km"
 */
export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

/**
 * Parse a reps string (e.g. "8-12") and return the first number as default.
 * Used for pre-filling set inputs.
 */
export function parseRepsDefault(reps: string | number | null | undefined): string {
  if (!reps) return ''
  const str = reps.toString()
  if (str.includes('-')) return str.split('-')[0]
  return str
}

/**
 * Format large numbers with 'k' suffix.
 * @example formatVolume(15340) => "15k"
 * @example formatVolume(800) => "800"
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000) return `${Math.round(volume / 1000)}k`
  return Math.round(volume).toString()
}

/**
 * Calculate completion percentage, clamped to 0-100.
 */
export function calcPercentage(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round(Math.min(100, (completed / total) * 100))
}
