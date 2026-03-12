/**
 * Shared constants for the 9toFit Performance Platform.
 * Centralizes magic strings and configuration objects.
 */

import type { RankInfo, HabitCategory } from '@/types/database'

// ─── Muscle Group Colors ─────────────────────────────────────────────────────

export const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Borst: 'text-blue-400',
  Rug: 'text-purple-400',
  Benen: 'text-red-400',
  Schouders: 'text-yellow-400',
  Armen: 'text-orange-400',
  Core: 'text-green-400',
  Billen: 'text-pink-400',
} as const

// ─── Habit Category Config ───────────────────────────────────────────────────

export interface HabitCategoryConfig {
  icon: string
  color: string
  unit: string
}

export const HABIT_CATEGORY_CONFIG: Record<HabitCategory, HabitCategoryConfig> = {
  water: { icon: '💧', color: 'blue', unit: 'ml' },
  steps: { icon: '👣', color: 'green', unit: 'stappen' },
  sleep: { icon: '😴', color: 'purple', unit: 'uur' },
  mobility: { icon: '🧘', color: 'orange', unit: 'min' },
  supplements: { icon: '💊', color: 'red', unit: 'x' },
  nutrition: { icon: '🥗', color: 'teal', unit: 'x' },
} as const

/** Categories that support numeric input */
export const NUMERIC_HABIT_CATEGORIES: HabitCategory[] = [
  'water', 'steps', 'sleep', 'mobility',
]

// ─── Accent Colors ───────────────────────────────────────────────────────────

export interface AccentColor {
  name: string
  hex: string
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: 'Oranje', hex: '#f97316' },
  { name: 'Blauw', hex: '#3b82f6' },
  { name: 'Groen', hex: '#22c55e' },
  { name: 'Paars', hex: '#a855f7' },
  { name: 'Rood', hex: '#ef4444' },
  { name: 'Roze', hex: '#ec4899' },
] as const

export const DEFAULT_ACCENT_COLOR = '#f97316'

// ─── Feeling Emojis ──────────────────────────────────────────────────────────

export const FEELING_EMOJIS: Record<number, string> = {
  1: '😫',
  2: '😕',
  3: '😊',
  4: '💪',
  5: '🔥',
} as const

export const FEELING_OPTIONS = [
  { val: 1, emoji: '😫', label: 'Zwaar' },
  { val: 2, emoji: '😕', label: 'Meh' },
  { val: 3, emoji: '😊', label: 'Goed' },
  { val: 4, emoji: '💪', label: 'Sterk' },
  { val: 5, emoji: '🔥', label: 'Top!' },
] as const

// ─── Rank System ─────────────────────────────────────────────────────────────

/**
 * Rank systeem — gebaseerd op sessie-PRs (niet individuele sets).
 *
 * Een PR telt alleen als het zwaarste gewicht van een workout-sessie
 * hoger is dan alle eerdere sessies voor die oefening.
 * De eerste sessie ooit telt als PR 1.
 *
 * minPRs  = hoeveel keer je een nieuw persoonlijk record moet breken
 * minPct  = OF hoeveel procent je bent gegroeid (eerste sessie → huidig max)
 *
 * Voorbeeld: Bench Press sessies: 60kg → 65kg → 65kg → 70kg → 75kg
 *   PRs = 4 (60, 65, 70, 75)  |  verbetering = +25%  →  Gold rank
 */
export const RANKS: RankInfo[] = [
  {
    id: 'olympian', name: 'Olympian', minPRs: 20, minPct: 100,
    g1: '#064e3b', g2: '#34d399', outline: '#6ee7b7', textColor: '#6ee7b7',
  },
  {
    id: 'titan', name: 'Titan', minPRs: 15, minPct: 75,
    g1: '#7f1d1d', g2: '#f87171', outline: '#fca5a5', textColor: '#fca5a5',
  },
  {
    id: 'champion', name: 'Champion', minPRs: 12, minPct: 50,
    g1: '#6b21a8', g2: '#e879f9', outline: '#f0abfc', textColor: '#f0abfc',
  },
  {
    id: 'diamond', name: 'Diamond', minPRs: 9, minPct: 40,
    g1: '#1e40af', g2: '#818cf8', outline: '#a5b4fc', textColor: '#a5b4fc',
  },
  {
    id: 'platinum', name: 'Platinum', minPRs: 7, minPct: 30,
    g1: '#0e7490', g2: '#22d3ee', outline: '#67e8f9', textColor: '#67e8f9',
  },
  {
    id: 'gold', name: 'Gold', minPRs: 5, minPct: 20,
    g1: '#92400e', g2: '#f59e0b', outline: '#fcd34d', textColor: '#fcd34d',
  },
  {
    id: 'silver', name: 'Silver', minPRs: 3, minPct: 10,
    g1: '#374151', g2: '#9ca3af', outline: '#d1d5db', textColor: '#d1d5db',
  },
  {
    id: 'bronze', name: 'Bronze', minPRs: 2, minPct: 5,
    g1: '#78350f', g2: '#c77f4b', outline: '#e6a96e', textColor: '#e6a96e',
  },
  {
    id: 'wood', name: 'Wood', minPRs: 1, minPct: 0,
    g1: '#451a03', g2: '#92400e', outline: '#b45309', textColor: '#d97706',
  },
] as const

export const RANK_ORDER: Record<string, number> = {
  olympian: 9, titan: 8, champion: 7, diamond: 6,
  platinum: 5, gold: 4, silver: 3, bronze: 2, wood: 1,
}

/**
 * Get the rank for a given PR count and improvement percentage.
 */
export function getRank(prCount: number, improvementPct: number): RankInfo {
  for (const rank of RANKS) {
    if (prCount >= rank.minPRs || improvementPct >= rank.minPct) return rank
  }
  return RANKS[RANKS.length - 1]
}

// ─── Role Labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach',
  admin: 'Admin',
  client: 'Atleet',
} as const
