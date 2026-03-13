export interface Achievement {
  id: string
  name: string
  description: string
  emoji: string
  condition: string
}

export interface UserStats {
  totalWorkouts?: number
  workoutStreak?: number // in weeks
  totalPRs?: number
  habitsStreak?: number // consecutive days with 100% habits
  totalVolume?: number // in kg
  earlyBirdCount?: number // workouts before 8am
  weeklyWorkoutDays?: number
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_workout',
    name: 'Eerste Training',
    description: 'Voltooi je eerste workout',
    emoji: '🎯',
    condition: 'Complete 1 workout',
  },
  {
    id: 'streak_3',
    name: '3 Weken Streak',
    description: 'Train 3 weken op rij',
    emoji: '🔥',
    condition: '3 week streak',
  },
  {
    id: 'streak_8',
    name: '2 Maanden Streak',
    description: 'Train 8 weken zonder onderbreking',
    emoji: '⚡',
    condition: '8 week streak',
  },
  {
    id: 'pr_hunter',
    name: 'PR Jager',
    description: 'Haal 5 persoonlijke records',
    emoji: '🎖️',
    condition: 'Get 5 personal records',
  },
  {
    id: 'pr_collector',
    name: 'PR Verzamelaar',
    description: 'Haal 20 persoonlijke records',
    emoji: '💎',
    condition: 'Get 20 personal records',
  },
  {
    id: 'habit_master',
    name: 'Habit Meester',
    description: 'Voltooi alle gewoontes 7 dagen achter elkaar',
    emoji: '✨',
    condition: '100% habits 7 days in a row',
  },
  {
    id: 'volume_king',
    name: 'Volume King',
    description: 'Log 100.000kg totaal gewicht',
    emoji: '👑',
    condition: 'Log 100,000kg total volume',
  },
  {
    id: 'early_bird',
    name: 'Vroege Vogel',
    description: 'Voltooi een workout voor 08:00',
    emoji: '🌅',
    condition: 'Complete workout before 8am',
  },
  {
    id: 'iron_will',
    name: 'IJzeren Wil',
    description: 'Train 4 of meer dagen in één week',
    emoji: '💪',
    condition: 'Train 4+ days in one week',
  },
]

export function checkAchievements(stats: UserStats): Achievement[] {
  const unlockedAchievements: Achievement[] = []

  // First workout
  if ((stats.totalWorkouts ?? 0) >= 1) {
    unlockedAchievements.push(ACHIEVEMENTS[0])
  }

  // 3 week streak
  if ((stats.workoutStreak ?? 0) >= 3) {
    unlockedAchievements.push(ACHIEVEMENTS[1])
  }

  // 8 week streak
  if ((stats.workoutStreak ?? 0) >= 8) {
    unlockedAchievements.push(ACHIEVEMENTS[2])
  }

  // 5 personal records
  if ((stats.totalPRs ?? 0) >= 5) {
    unlockedAchievements.push(ACHIEVEMENTS[3])
  }

  // 20 personal records
  if ((stats.totalPRs ?? 0) >= 20) {
    unlockedAchievements.push(ACHIEVEMENTS[4])
  }

  // Habit master (7 days 100% habits)
  if ((stats.habitsStreak ?? 0) >= 7) {
    unlockedAchievements.push(ACHIEVEMENTS[5])
  }

  // Volume king (100,000 kg)
  if ((stats.totalVolume ?? 0) >= 100000) {
    unlockedAchievements.push(ACHIEVEMENTS[6])
  }

  // Early bird (at least one early workout)
  if ((stats.earlyBirdCount ?? 0) >= 1) {
    unlockedAchievements.push(ACHIEVEMENTS[7])
  }

  // Iron will (4+ days in one week)
  if ((stats.weeklyWorkoutDays ?? 0) >= 4) {
    unlockedAchievements.push(ACHIEVEMENTS[8])
  }

  return unlockedAchievements
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

export function getAllAchievements(): Achievement[] {
  return ACHIEVEMENTS
}
