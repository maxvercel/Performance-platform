import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
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

    // Fetch all user data in parallel
    const [
      profilesRes,
      workoutLogsRes,
      exerciseLogsRes,
      habitsRes,
      habitLogsRes,
      nutritionLogsRes,
      dailyReadinessRes,
      progressMetricsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id),
      supabase.from('workout_logs').select('*').eq('user_id', user.id),
      supabase.from('exercise_logs').select('*').eq('user_id', user.id),
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('*').eq('user_id', user.id),
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id),
      supabase.from('daily_readiness').select('*').eq('user_id', user.id),
      supabase.from('progress_metrics').select('*').eq('user_id', user.id),
    ])

    // Compile all data
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      data: {
        profile: profilesRes.data || [],
        workoutLogs: workoutLogsRes.data || [],
        exerciseLogs: exerciseLogsRes.data || [],
        habits: habitsRes.data || [],
        habitLogs: habitLogsRes.data || [],
        nutritionLogs: nutritionLogsRes.data || [],
        dailyReadiness: dailyReadinessRes.data || [],
        progressMetrics: progressMetricsRes.data || [],
      },
    }

    // Create JSON response
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })

    // Format date for filename
    const dateStr = new Date().toISOString().split('T')[0]

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="9tofit-export-${dateStr}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Exporteren mislukt.' },
      { status: 500 }
    )
  }
}
