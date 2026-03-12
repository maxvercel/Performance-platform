/**
 * Profile service — encapsulates all profile-related database operations.
 */
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const supabase = createClient()

export const profileService = {
  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('profileService.getById error:', error.message)
      return null
    }
    return data
  },

  async updateName(id: string, fullName: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', id)

    if (error) {
      console.error('profileService.updateName error:', error.message)
      return false
    }
    return true
  },

  async getByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (error) return null
    return data
  },
}
