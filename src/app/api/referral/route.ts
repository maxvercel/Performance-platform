import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/referral — Get or create the current user's referral code + signup count
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get existing code
  let { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', user.id)
    .single()

  // Generate one if none exists
  if (!existing) {
    const { data: generated } = await supabase.rpc('generate_referral_code')
    const code = generated || Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data: inserted } = await supabase
      .from('referral_codes')
      .insert({ user_id: user.id, code })
      .select('code')
      .single()

    existing = inserted
  }

  // Count signups via this user's code
  const { count } = await supabase
    .from('referral_signups')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)

  return NextResponse.json({
    code: existing?.code ?? null,
    signupCount: count ?? 0,
  })
}

/**
 * POST /api/referral — Record a referral signup (called after a new user registers)
 * Body: { code: string, newUserId: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { code, newUserId } = await req.json()

  if (!code || !newUserId) {
    return NextResponse.json({ error: 'Missing code or newUserId' }, { status: 400 })
  }

  // Look up the referral code
  const { data: referralCode } = await supabase
    .from('referral_codes')
    .select('user_id')
    .eq('code', code.toUpperCase())
    .single()

  if (!referralCode) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
  }

  // Don't let users refer themselves
  if (referralCode.user_id === newUserId) {
    return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
  }

  // Record the signup (upsert to avoid duplicates)
  const { error } = await supabase
    .from('referral_signups')
    .upsert({
      referrer_id: referralCode.user_id,
      referred_id: newUserId,
      code: code.toUpperCase(),
    }, { onConflict: 'referred_id' })

  if (error) {
    console.error('Referral signup error:', error)
    return NextResponse.json({ error: 'Failed to record referral' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
