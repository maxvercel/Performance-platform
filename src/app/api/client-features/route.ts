import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch features for a client (coach or client themselves)
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('client_id')
  if (!clientId) {
    return NextResponse.json({ error: 'client_id vereist' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('client_features')
    .select('feature, enabled')
    .eq('client_id', clientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  const body = await request.json()
  const { client_id, feature, enabled } = body

  if (!client_id || !feature || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'client_id, feature en enabled vereist' }, { status: 400 })
  }

  // Upsert the feature toggle
  const { error } = await supabaseAdmin
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
