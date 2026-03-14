import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: 'Strava not configured' }, { status: 500 })
  }

  // Build redirect URI from the actual request URL (no env var dependency)
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`
  const redirectUri = `${baseUrl}/api/strava/callback`

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read,activity:read_all&approval_prompt=auto`

  return NextResponse.redirect(stravaAuthUrl)
}
