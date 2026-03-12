import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/progress?strava=error`
    )
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/portal/progress?strava=error`
      )
    }

    // Get the athlete info
    const athleteId = tokenData.athlete?.id

    // Store tokens in Supabase
    // Note: we need the user's auth session to link it
    // For now, redirect with the token info to be stored client-side
    const params = new URLSearchParams({
      strava: 'connected',
      athlete_id: String(athleteId ?? ''),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: String(tokenData.expires_at),
    })

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/progress?${params.toString()}`
    )
  } catch (err) {
    console.error('Strava callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/progress?strava=error`
    )
  }
}
