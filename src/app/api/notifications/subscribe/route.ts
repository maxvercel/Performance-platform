import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface RequestBody {
  subscription: PushSubscription
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Niet ingelogd.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: RequestBody = await request.json()
    const { subscription } = body

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Ongeldig abonnement formaat.' },
        { status: 400 }
      )
    }

    // Save subscription to database
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          client_id: user.id,
          subscription_json: subscription,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,endpoint',
        }
      )
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Kon abonnement niet opslaan.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Abonnement opgeslagen.',
        subscription: data
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json(
      { error: 'Fout bij het verwerken van verzoek.' },
      { status: 500 }
    )
  }
}
