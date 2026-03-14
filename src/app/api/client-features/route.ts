import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rateLimit'

// GET — fetch features for a client (coach or client themselves)
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip + ':features-get', 60)) {
    return NextResponse.json({ error: 'Te veel verzoeken' }, { status: 429 })
  }
  const supabase = await createClient()
  const clientId = request.nextUrl.searchParams.get('client_id')
  if (!clientId) {
    return NextResponse.json({ error: 'client_id vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_features')
    .select('feature, enabled')
    .eq('client_id', clientId)

  if (error) {
    // Table might not exist yet — return empty features instead of error
    return NextResponse.json({ features: {} })
  }

  // Return as a map: { nutrition: true, ... }
  const features: Record<string, boolean> = {}
  data?.forEach(row => {
    features[row.feature] = row.enabled
  })

  return NextResponse.json({ features })
}

// POST — toggle a feature for a client (coach only)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip + ':features-post', 20)) {
    return NextResponse.json({ error: 'Te veel verzoeken' }, { status: 429 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the user is a coach/admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Alleen coaches en admins mogen features wijzigen' }, { status: 403 })
  }

  const body = await request.json()
  const { client_id, feature, enabled } = body

  if (!client_id || !feature || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'client_id, feature en enabled vereist' }, { status: 400 })
  }

  // Validate feature name
  const allowedFeatures = ['nutrition']
  if (!allowedFeatures.includes(feature)) {
    return NextResponse.json({ error: 'Onbekende feature' }, { status: 400 })
  }

  // Upsert the feature toggle
  const { error } = await supabase
    .from('client_features')
    .upsert(
      { client_id, feature, enabled },
      { onConflict: 'client_id,feature' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
