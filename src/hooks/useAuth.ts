/**
 * Authentication hook — provides the current user and profile.
 * Replaces the duplicated auth pattern across every page.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

interface AuthState {
  /** The authenticated user's profile, null while loading */
  profile: Profile | null
  /** The raw Supabase user ID */
  userId: string | null
  /** Whether auth check is in progress */
  loading: boolean
  /** Re-fetch the user profile */
  refreshProfile: () => Promise<void>
  /** Sign out and redirect to login */
  signOut: () => Promise<void>
}

/**
 * Hook that handles authentication and profile loading.
 * Automatically redirects to /portal/login if not authenticated.
 *
 * @param options.requireOnboarding - If true, redirects to /portal/onboarding when name is missing
 */
export function useAuth(options?: { requireOnboarding?: boolean }): AuthState {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/portal/login')
      return
    }

    setUserId(user.id)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      router.push('/portal/login')
      return
    }

    const profileWithEmail: Profile = { ...data, email: user.email }
    setProfile(profileWithEmail)

    // Redirect to onboarding if name not set
    if (options?.requireOnboarding && !data.full_name) {
      router.push('/portal/onboarding')
      return
    }

    setLoading(false)
  }, [supabase, router, options?.requireOnboarding])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/portal/login')
  }, [supabase, router])

  return {
    profile,
    userId,
    loading,
    refreshProfile: fetchProfile,
    signOut,
  }
}
