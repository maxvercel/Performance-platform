/**
 * 9toFit Auto-Adjustment Algorithm
 *
 * Adjusts training intensity based on:
 * 1. Daily readiness score (sleep, energy, stress, soreness, motivation)
 * 2. Recent RPE trends (are sets feeling too hard/easy?)
 * 3. Progressive overload principle
 *
 * Inspired by auto-regulation methods used by Jeff Nippard, RP, and
 * evidence-based strength coaching.
 */

export interface AdjustmentInput {
  /** Previous best weight for this exercise (kg) */
  previousWeight: number
  /** Average RPE from last session for this exercise */
  lastSessionAvgRpe: number | null
  /** Today's readiness score (1-5) */
  readinessScore: number | null
  /** Target RPE for the exercise (from coach notes, default 7.5) */
  targetRpe?: number
  /** Number of consecutive sessions with RPE > 9 */
  highRpeStreak?: number
}

export interface AdjustmentResult {
  /** Adjusted suggested weight (kg, rounded to 0.5) */
  suggestedWeight: number
  /** Percentage adjustment from baseline (+2.5kg progression) */
  adjustmentPercent: number
  /** Human-readable reason for the adjustment */
  reason: string
  /** Indicator color for UI */
  indicator: 'green' | 'yellow' | 'orange' | 'red'
  /** Should we suggest a deload? */
  suggestDeload: boolean
}

/**
 * Calculate an auto-adjusted weight suggestion.
 *
 * Base progression: previousWeight + 2.5kg (standard progressive overload)
 * Then adjustments are applied based on readiness & RPE data.
 */
export function calculateAdjustedWeight(input: AdjustmentInput): AdjustmentResult {
  const { previousWeight, lastSessionAvgRpe, readinessScore, targetRpe = 7.5, highRpeStreak = 0 } = input

  // Base: standard +2.5kg progression
  let baseWeight = previousWeight + 2.5
  let adjustmentPercent = 0
  let reason = ''
  let indicator: AdjustmentResult['indicator'] = 'green'
  let suggestDeload = false

  // ─── 1. RPE-based adjustment ───────────────────────────────
  if (lastSessionAvgRpe !== null) {
    const rpeDiff = lastSessionAvgRpe - targetRpe

    if (rpeDiff >= 2) {
      // Way too hard — reduce weight
      adjustmentPercent -= 10
      reason = 'Vorige sessie was te zwaar (RPE te hoog)'
      indicator = 'red'
    } else if (rpeDiff >= 1) {
      // Slightly too hard — hold weight, don't increase
      adjustmentPercent -= 5
      reason = 'Vorige sessie was vrij zwaar'
      indicator = 'orange'
    } else if (rpeDiff <= -2) {
      // Way too easy — bigger jump
      adjustmentPercent += 5
      reason = 'Vorige sessie was makkelijk — extra verhoging'
      indicator = 'green'
    }
    // rpeDiff between -1 and 1 = on target, normal progression
  }

  // ─── 2. Readiness-based adjustment ─────────────────────────
  if (readinessScore !== null) {
    if (readinessScore <= 1.5) {
      adjustmentPercent -= 15
      reason = 'Readiness laag — train veel lichter of rust'
      indicator = 'red'
      if (highRpeStreak >= 2) suggestDeload = true
    } else if (readinessScore <= 2.5) {
      adjustmentPercent -= 8
      reason = reason || 'Readiness matig — train wat lichter'
      indicator = indicator === 'red' ? 'red' : 'orange'
    } else if (readinessScore <= 3.5) {
      // Normal — no additional adjustment
      adjustmentPercent -= 0
    } else if (readinessScore >= 4.5) {
      adjustmentPercent += 3
      reason = reason || 'Readiness top — push door!'
      indicator = 'green'
    }
  }

  // ─── 3. High RPE streak — deload detection ────────────────
  if (highRpeStreak >= 3) {
    suggestDeload = true
    adjustmentPercent -= 15
    reason = 'Al 3+ sessies op hoge RPE — deload aanbevolen'
    indicator = 'red'
  }

  // ─── Apply adjustment ──────────────────────────────────────
  const adjustedWeight = baseWeight * (1 + adjustmentPercent / 100)
  const roundedWeight = Math.round(adjustedWeight * 2) / 2 // Round to 0.5kg

  // Ensure we never suggest less than the bar (20kg) for barbell exercises
  const finalWeight = Math.max(roundedWeight, 0)

  if (!reason) {
    reason = 'Normale progressie (+2.5kg)'
    indicator = 'green'
  }

  return {
    suggestedWeight: finalWeight,
    adjustmentPercent,
    reason,
    indicator,
    suggestDeload,
  }
}

/**
 * Calculate average RPE from a set of RPE values.
 */
export function averageRpe(rpeValues: (number | null)[]): number | null {
  const valid = rpeValues.filter((v): v is number => v !== null && v > 0)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

/**
 * Count consecutive sessions where average RPE was >= threshold.
 */
export function countHighRpeStreak(
  sessionRpes: (number | null)[],
  threshold = 9
): number {
  let streak = 0
  for (const rpe of sessionRpes) {
    if (rpe !== null && rpe >= threshold) streak++
    else break
  }
  return streak
}

/**
 * Get a readiness-based training recommendation.
 */
export function getTrainingRecommendation(readinessScore: number | null): {
  type: 'full' | 'moderate' | 'light' | 'rest'
  label: string
  description: string
} {
  if (readinessScore === null) return { type: 'full', label: 'Normaal trainen', description: 'Geen readiness data — train normaal' }
  if (readinessScore >= 4) return { type: 'full', label: 'Volle gas', description: 'Je bent fit — push door vandaag!' }
  if (readinessScore >= 3) return { type: 'moderate', label: 'Normaal trainen', description: 'Readiness is prima — train op schema' }
  if (readinessScore >= 2) return { type: 'light', label: 'Train lichter', description: 'Neem het rustig aan — verlaag gewichten 5-10%' }
  return { type: 'rest', label: 'Rustdag', description: 'Je lichaam heeft herstel nodig — overweeg rust' }
}
