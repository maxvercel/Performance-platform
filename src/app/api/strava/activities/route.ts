import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Read token from httpOnly cookie (secure) or fallback to query param (legacy)
  const accessToken = request.cookies.get('strava_access_token')?.value
    || request.nextUrl.searchParams.get('access_token')

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  try {
    const res = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      // Token expired — clear cookies
      if (res.status === 401) {
        const response = NextResponse.json({ error: 'Token expired' }, { status: 401 })
        response.cookies.delete('strava_access_token')
        response.cookies.delete('strava_refresh_token')
        return response
      }
      return NextResponse.json({ error: 'Strava API error' }, { status: res.status })
    }

    const activities = await res.json()

    // Map to our format
    const mapped = activities.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      sport_type: a.sport_type,
      distance_km: typeof a.distance === 'number' ? Math.round(a.distance / 10) / 100 : null,
      duration_seconds: a.moving_time,
      elevation_gain: a.total_elevation_gain,
      avg_heart_rate: a.average_heartrate,
      max_heart_rate: a.max_heartrate,
      avg_speed_kmh: typeof a.average_speed === 'number' ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
      calories: a.calories,
      start_date: a.start_date_local,
      map_polyline: (a.map as Record<string, unknown>)?.summary_polyline,
    }))

    return NextResponse.json(mapped)
  } catch (err) {
    console.error('Strava activities error:', err)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
