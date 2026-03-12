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
  const { data: tmpl, error: tmplErr } = await supabase
    .from('program_templates')
    .select('id, coach_id')
    .eq('id', templateId)
    .single()

  if (tmplErr || !tmpl) {
    return NextResponse.json({
      error: `Template niet gevonden: ${tmplErr?.message ?? 'onbekend'}`,
      debug: { templateId, tmplErr }
    }, { status: 403 })
  }

  if (tmpl.coach_id !== user.id) {
    return NextResponse.json({
      error: 'Geen toegang tot dit template',
      debug: { tmplCoachId: tmpl.coach_id, userId: user.id }
    }, { status: 403 })
  }

  // Quick check: verify table is accessible
  const { error: tableErr } = await supabase
    .from('template_exercises')
    .select('id')
    .limit(1)

  if (tableErr) {
    return NextResponse.json({
      success: false,
      error: `template_exercises niet bereikbaar: ${tableErr.message} (${tableErr.code})`,
      message: `Tabel error: ${tableErr.message}`,
    }, { status: 500 })
  }

  // Save exercises per day
  let savedCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const [dayId, dayExercises] of Object.entries(exercises)) {
    // Delete existing exercises for this day
    const { error: delError } = await supabase
      .from('template_exercises')
      .delete()
      .eq('day_id', dayId)

    if (delError) {
      errors.push(`DELETE ${dayId}: ${delError.message} (${delError.code})`)
      errorCount++
      continue
    }

    // Insert new exercises
    if (dayExercises.length > 0) {
      const rows = dayExercises.map((ex: any, i: number) => ({
        day_id: dayId,
        exercise_name: String(ex.name ?? '').trim() || 'Unnamed',
        sets: Number(ex.sets) || 3,
        reps: String(ex.reps ?? '8-10'),
        weight_kg: ex.weight_kg != null ? Number(ex.weight_kg) : null,
        rest_seconds: Number(ex.rest_seconds) || 90,
        notes: ex.notes ? String(ex.notes) : null,
        order_index: i,
      }))

      const { error: insError } = await supabase
        .from('template_exercises')
        .insert(rows)

      if (insError) {
        errors.push(`INSERT ${dayId} (${rows.length}): ${insError.message} (${insError.code})`)
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
    errors: errors.slice(0, 5),
    message: errorCount === 0
      ? `${savedCount} oefeningen opgeslagen`
      : `${savedCount} opgeslagen, ${errorCount} fouten`,
  })
}
