import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')

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
      return NextResponse.json({ error: 'Strava API error' }, { status: res.status })
    }

    const activities = await res.json()

    // Map to our format
    const mapped = activities.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      sport_type: a.sport_type,
      distance_km: a.distance ? Math.round(a.distance / 10) / 100 : null,
      duration_seconds: a.moving_time,
      elevation_gain: a.total_elevation_gain,
      avg_heart_rate: a.average_heartrate,
      max_heart_rate: a.max_heartrate,
      avg_speed_kmh: a.average_speed ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
      calories: a.calories,
      start_date: a.start_date_local,
      map_polyline: a.map?.summary_polyline,
    }))

    return NextResponse.json(mapped)
  } catch (err) {
    console.error('Strava activities error:', err)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
