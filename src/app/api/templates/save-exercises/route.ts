import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Verify user is authenticated
  const browserClient = await createBrowserClient()
  const { data: { user } } = await browserClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  // Use service role for database operations (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { templateId, exercises } = body as {
    templateId: string
    exercises: Record<string, Array<{
      name: string
      sets: number
      reps: string
      weight_kg: number | null
      rest_seconds: number | null
      notes: string | null
      order_index: number
    }>>
  }

  if (!templateId || !exercises) {
    return NextResponse.json({ error: 'templateId en exercises zijn verplicht' }, { status: 400 })
  }

  // Verify user owns this template
  const { data: tmpl } = await supabase
    .from('program_templates')
    .select('id, coach_id')
    .eq('id', templateId)
    .single()

  if (!tmpl || tmpl.coach_id !== user.id) {
    return NextResponse.json({ error: 'Template niet gevonden of geen toegang' }, { status: 403 })
  }

  // Save exercises per day
  let savedCount = 0
  let errorCount = 0

  for (const [dayId, dayExercises] of Object.entries(exercises)) {
    // Delete existing exercises for this day
    const { error: delError } = await supabase
      .from('template_exercises')
      .delete()
      .eq('day_id', dayId)

    if (delError) {
      console.error(`Delete error for day ${dayId}:`, delError)
      errorCount++
      continue
    }

    // Insert new exercises
    if (dayExercises.length > 0) {
      const rows = dayExercises.map((ex, i) => ({
        day_id: dayId,
        exercise_name: ex.name?.trim() || 'Unnamed',
        sets: ex.sets ?? 3,
        reps: ex.reps ?? '8-10',
        weight_kg: ex.weight_kg ?? null,
        rest_seconds: ex.rest_seconds ?? 90,
        notes: ex.notes ?? null,
        order_index: i,
      }))

      const { error: insError } = await supabase
        .from('template_exercises')
        .insert(rows)

      if (insError) {
        console.error(`Insert error for day ${dayId}:`, insError)
        errorCount++
      } else {
        savedCount += rows.length
      }
    }
  }

  return NextResponse.json({
    success: errorCount === 0,
    savedCount,
    errorCount,
    message: errorCount === 0
      ? `${savedCount} oefeningen opgeslagen`
      : `${savedCount} opgeslagen, ${errorCount} fouten`
  })
}
