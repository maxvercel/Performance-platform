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

  // 3. Create weeks, days, exercises
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

    for (const day of week.template_days) {
      const { data: progDay } = await supabase
        .from('program_days')
        .insert({
          week_id: progWeek.id,
          day_number: day.day_number,
          label: day.label,
          rest_day: day.rest_day,
        })
        .select().single()

      if (!progDay || day.rest_day) continue

      const dayExercises = exercises[day.id] ?? []
      for (let ei = 0; ei < dayExercises.length; ei++) {
        const ex = dayExercises[ei]
        if (!ex.name?.trim()) continue

        // Find or create exercise
        let exerciseId: string | null = null

        const { data: existing } = await supabase
          .from('exercises')
          .select('id, muscle_group')
          .ilike('name', ex.name.trim())
          .limit(1)
          .maybeSingle()

        if (existing) {
          exerciseId = existing.id
          // If exercise exists with 'general' muscle_group and we have better data, update it
          if (existing.muscle_group === 'general' && ex.muscle_group) {
            await supabase
              .from('exercises')
              .update({ muscle_group: ex.muscle_group })
              .eq('id', existing.id)
          }
        } else {
          const { data: created } = await supabase
            .from('exercises')
            .insert({
              name: ex.name.trim(),
              category: 'general',
              muscle_group: ex.muscle_group || 'general',
              is_global: true,
            })
            .select('id').single()
          exerciseId = created?.id ?? null
        }

        if (exerciseId) {
          await supabase.from('program_exercises').insert({
            day_id: progDay.id,
            exercise_id: exerciseId,
            sets: ex.sets ?? 3,
            reps: ex.reps ?? '8-10',
            weight_kg: ex.weight_kg ?? null,
            rest_seconds: ex.rest_seconds ?? 90,
            notes: ex.notes ?? null,
            superset_group: ex.superset_group ?? null,
            order_index: ei,
          })
          exerciseCount++
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    programId: program.id,
    exerciseCount,
    message: `Programma "${programName}" toegewezen met ${exerciseCount} oefeningen`,
  })
}
