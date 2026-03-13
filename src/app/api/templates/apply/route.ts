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

  const { templateId, clientId, programName, startDate, exercises, weeks } = body as {
    templateId: string
    clientId: string
    programName: string
    startDate: string
    exercises: Record<string, Array<{
      name: string
      sets: number
      reps: string
      weight_kg: number | null
      rest_seconds: number | null
      notes: string | null
      superset_group: string | null
      muscle_group?: string | null
    }>>
    weeks: Array<{
      week_number: number
      label: string
      template_days: Array<{
        id: string
        day_number: number
        label: string
        rest_day: boolean
      }>
    }>
  }

  if (!templateId || !clientId || !programName || !weeks) {
    return NextResponse.json({ error: 'Velden ontbreken' }, { status: 400 })
  }

  // Verify user owns this template
  const { data: tmpl } = await supabase
    .from('program_templates')
    .select('id, coach_id, goal')
    .eq('id', templateId)
    .single()

  if (!tmpl || tmpl.coach_id !== user.id) {
    return NextResponse.json({ error: 'Template niet gevonden of geen toegang' }, { status: 403 })
  }

  // Verify client belongs to this coach via coach_client table
  const { data: relation } = await supabase
    .from('coach_client')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .eq('active', true)
    .maybeSingle()

  if (!relation) {
    return NextResponse.json({ error: 'Client niet gevonden of geen toegang' }, { status: 403 })
  }

  // 1. Deactivate existing active programs
  await supabase
    .from('programs')
    .update({ is_active: false })
    .eq('client_id', clientId)
    .eq('is_active', true)

  // 2. Create program
  const { data: program, error: progErr } = await supabase
    .from('programs')
    .insert({
      coach_id: user.id,
      client_id: clientId,
      name: programName,
      goal: tmpl.goal,
      start_date: startDate,
      is_active: true,
    })
    .select().single()

  if (progErr || !program) {
    return NextResponse.json({ error: `Kon programma niet aanmaken: ${progErr?.message}` }, { status: 500 })
  }

  // 3. Pre-load ALL exercises in one query (avoid N+1 lookups)
  const exerciseCache: Record<string, { id: string; muscle_group: string }> = {}
  const { data: allExercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group')
  allExercises?.forEach(e => {
    exerciseCache[e.name.toLowerCase()] = { id: e.id, muscle_group: e.muscle_group }
  })

  const muscleGroupUpdates: { id: string; muscle_group: string }[] = []

  async function resolveExerciseId(name: string, muscleGroup?: string | null): Promise<string | null> {
    const key = name.toLowerCase()
    const cached = exerciseCache[key]
    if (cached) {
      if (cached.muscle_group === 'general' && muscleGroup) {
        muscleGroupUpdates.push({ id: cached.id, muscle_group: muscleGroup })
        cached.muscle_group = muscleGroup
      }
      return cached.id
    }
    const { data: created } = await supabase
      .from('exercises')
      .insert({ name: name.trim(), category: 'general', muscle_group: muscleGroup || 'general', is_global: true })
      .select('id').single()
    if (created) {
      exerciseCache[key] = { id: created.id, muscle_group: muscleGroup || 'general' }
      return created.id
    }
    return null
  }

  // 4. Create weeks, days, exercises with batch inserts
  let exerciseCount = 0

  for (const week of weeks) {
    const { data: progWeek } = await supabase
      .from('program_weeks')
      .insert({
        program_id: program.id,
        week_number: week.week_number,
        label: week.label || `Week ${week.week_number}`,
      })
      .select().single()

    if (!progWeek) continue

    // Batch insert all days for this week
    const { data: progDays } = await supabase
      .from('program_days')
      .insert(week.template_days.map(day => ({
        week_id: progWeek.id,
        day_number: day.day_number,
        label: day.label,
        rest_day: day.rest_day,
      })))
      .select('id, day_number, rest_day')

    if (!progDays) continue
    const dayMap = new Map(progDays.map(d => [d.day_number, d]))

    // Resolve exercises and batch insert per week
    const exerciseInserts: Array<{
      day_id: string; exercise_id: string; sets: number; reps: string;
      weight_kg: number | null; rest_seconds: number | null;
      notes: string | null; superset_group: string | null; order_index: number;
    }> = []

    for (const day of week.template_days) {
      const progDay = dayMap.get(day.day_number)
      if (!progDay || progDay.rest_day) continue

      const dayExercises = exercises[day.id] ?? []
      for (let ei = 0; ei < dayExercises.length; ei++) {
        const ex = dayExercises[ei]
        if (!ex.name?.trim()) continue

        const exerciseId = await resolveExerciseId(ex.name.trim(), ex.muscle_group)
        if (exerciseId) {
          exerciseInserts.push({
            day_id: progDay.id, exercise_id: exerciseId,
            sets: ex.sets ?? 3, reps: ex.reps ?? '8-10',
            weight_kg: ex.weight_kg ?? null, rest_seconds: ex.rest_seconds ?? 90,
            notes: ex.notes ?? null, superset_group: ex.superset_group ?? null,
            order_index: ei,
          })
        }
      }
    }

    if (exerciseInserts.length > 0) {
      const { error: batchErr } = await supabase.from('program_exercises').insert(exerciseInserts)
      if (!batchErr) exerciseCount += exerciseInserts.length
      else console.error('Batch exercise insert error:', batchErr)
    }
  }

  // Batch muscle group updates
  if (muscleGroupUpdates.length > 0) {
    await Promise.all(muscleGroupUpdates.map(u =>
      supabase.from('exercises').update({ muscle_group: u.muscle_group }).eq('id', u.id)
    ))
  }

  return NextResponse.json({
    success: true,
    programId: program.id,
    exerciseCount,
    message: `Programma "${programName}" toegewezen met ${exerciseCount} oefeningen`,
  })
}
