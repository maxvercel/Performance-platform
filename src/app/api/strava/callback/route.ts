import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/portal/progress?strava=error`)
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
      return NextResponse.redirect(`${appUrl}/portal/progress?strava=error`)
    }

    // Redirect with success param — store token in httpOnly cookie
    const response = NextResponse.redirect(`${appUrl}/portal/progress?strava=connected`)

    // Set httpOnly cookie — not accessible from JS, much safer than localStorage
    response.cookies.set('strava_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokenData.expires_in || 21600, // Default 6 hours
    })

    if (tokenData.refresh_token) {
      response.cookies.set('strava_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return response
  } catch (err) {
    console.error('Strava callback error:', err)
    return NextResponse.redirect(`${appUrl}/portal/progress?strava=error`)
  }
}
