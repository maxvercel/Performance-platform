import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase/server'
import { validateAIProgramRequest } from '@/lib/validation'

// Simple in-memory rate limiter (per-IP, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function POST(request: Request) {
  // Authentication check
  const browserClient = await createBrowserClient()
  const { data: { user } } = await browserClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  }

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ?? user.id
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' },
      { status: 429 }
    )
  }

  // Check API key exists
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables')
    return NextResponse.json(
      { error: 'AI service niet geconfigureerd. Stel de ANTHROPIC_API_KEY in bij Vercel Environment Variables.' },
      { status: 500 }
    )
  }

  // Validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  const validation = validateAIProgramRequest(body)
  if (!validation.valid || !validation.data) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { prompt, program, templateName, mode } = validation.data

  console.log(`AI request: mode=${mode}, template="${templateName}", weeks=${program.length}, prompt length=${prompt.length}`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Advice mode
  if (mode !== 'build') {
    const context = JSON.stringify(program, null, 2)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Programma: ${templateName}\n\n${context}\n\nInstructie: ${prompt}\n\nGeef advies in het Nederlands.`
        }]
      })
    })

    if (!response.ok) {
      console.error('Anthropic API error (advice):', response.status)
      return NextResponse.json({ error: 'AI service tijdelijk niet beschikbaar.' }, { status: 502 })
    }

    const data = await response.json()
    return NextResponse.json({ response: data.content?.[0]?.text ?? '' })
  }

  // Pre-load exercise cache (1 query instead of ~60)
  const exerciseCache: Record<string, { id: string; muscle_group: string }> = {}
  const { data: allExercises } = await supabase.from('exercises').select('id, name, muscle_group')
  allExercises?.forEach(e => { exerciseCache[e.name.toLowerCase()] = { id: e.id, muscle_group: e.muscle_group } })

  // Build mode — all weeks in PARALLEL for speed
  const totalWeeks = program.length
  const errors: string[] = []

  console.log(`Building program: ${totalWeeks} weeks, days per week: ${program.map(w => w.days.length).join(',')}`)

  const weekPromises = program.map(async (week) => {
    const numDays = week.days.length
    const dayLabels = week.days.map((d: any) => `dag ${d.day_number}: ${d.dag}`).join(', ')

    const progressie =
      week.week <= 2 ? 'Opbouwfase: RPE 6-7, 3 sets per oefening' :
      week.week <= 4 ? 'Hoofdfase: RPE 7-8, 4 sets per oefening' :
      week.week === 5 ? 'Piekfase: RPE 8-9, 4-5 sets per oefening' :
      'Deload: RPE 5-6, 2-3 sets, minder volume'

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8192,
          system: `Je bent een expert personal trainer. Reageer ALLEEN met valid JSON. Begin met { en eindig met }.
REGELS: 1) Gebruik EXACT de oefeningen die de coach noemt, verzin GEEN eigen. 2) Superset labels A1/A2→superset_group "A". 3) Neem ALLE oefeningen over. 4) Pas reps aan per week als coach progressie noemt. 5) Behoud tempo/zijde in notes. 6) muscle_group: "Borst","Rug","Benen","Schouders","Armen","Core","Billen","Cardio".`,
          messages: [{
            role: 'user',
            content: `Programma: ${templateName}
Week: ${week.week}/${totalWeeks} — ${progressie}
Dagen: ${numDays} (${dayLabels})

Coach instructie:
${prompt}

JSON formaat (ALLEEN dit, geen tekst):
{"week_number":${week.week},"days":[${week.days.map((d: any) => `{"day_number":${d.day_number},"label":"${d.dag}","exercises":[{"name":"...","sets":3,"reps":"...","weight_kg":null,"rest_seconds":90,"notes":"...","superset_group":null,"muscle_group":"..."}]}`).join(',')}]}`
          }]
        })
      })

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        console.error(`Anthropic API error (week ${week.week}): status=${response.status}, body=${errBody.substring(0, 500)}`)
        errors.push(`Week ${week.week}: Anthropic API error ${response.status}`)
        return {
          week_number: week.week,
          days: week.days.map((d: any) => ({
            day_number: d.day_number, label: d.dag, exercises: []
          })),
          _exercisesToSync: [],
        }
      }

      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''
      console.log(`Week ${week.week} AI response length: ${text.length} chars`)

      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Collect exercises to sync with DB (done in bulk after all weeks)
      parsed._exercisesToSync = [] as { name: string; muscle_group: string }[]
      for (const day of parsed.days) {
        for (const ex of day.exercises) {
          if (ex.name) parsed._exercisesToSync.push({ name: ex.name.trim(), muscle_group: ex.muscle_group || 'general' })
        }
      }

      return parsed
    } catch (err: any) {
      console.error(`Week ${week.week} error:`, err.message ?? err)
      errors.push(`Week ${week.week}: ${err.message ?? 'Onbekende fout'}`)
      return {
        week_number: week.week,
        days: week.days.map((d: any) => ({
          day_number: d.day_number, label: d.dag, exercises: []
        })),
        _exercisesToSync: [],
      }
    }
  })

  const allWeeks = await Promise.all(weekPromises)
  allWeeks.sort((a, b) => a.week_number - b.week_number)

  // Bulk sync exercises with DB (instead of per-exercise queries)
  const newExercises: { name: string; category: string; muscle_group: string; is_global: boolean }[] = []
  const muscleUpdates: { id: string; muscle_group: string }[] = []

  for (const week of allWeeks) {
    for (const ex of (week._exercisesToSync ?? [])) {
      const key = ex.name.toLowerCase()
      const cached = exerciseCache[key]
      if (!cached) {
        newExercises.push({ name: ex.name, category: 'general', muscle_group: ex.muscle_group, is_global: true })
        exerciseCache[key] = { id: '', muscle_group: ex.muscle_group } // placeholder
      } else if (cached.muscle_group === 'general' && ex.muscle_group !== 'general') {
        muscleUpdates.push({ id: cached.id, muscle_group: ex.muscle_group })
        cached.muscle_group = ex.muscle_group
      }
    }
    delete week._exercisesToSync
  }

  // Batch insert new exercises
  if (newExercises.length > 0) {
    // Deduplicate by name
    const unique = [...new Map(newExercises.map(e => [e.name.toLowerCase(), e])).values()]
    await supabase.from('exercises').insert(unique)
    console.log(`Bulk created ${unique.length} new exercises`)
  }

  // Batch update muscle groups
  if (muscleUpdates.length > 0) {
    await Promise.all(muscleUpdates.map(u =>
      supabase.from('exercises').update({ muscle_group: u.muscle_group }).eq('id', u.id)
    ))
  }

  const totalExercises = allWeeks.reduce((sum, w) =>
    sum + (w.days?.reduce((ds: number, d: any) => ds + (d.exercises?.length ?? 0), 0) ?? 0), 0)

  console.log(`AI build complete: ${allWeeks.length} weeks, ${totalExercises} total exercises, ${errors.length} errors`)

  if (errors.length > 0 && totalExercises === 0) {
    return NextResponse.json({
      error: `AI generatie mislukt: ${errors.join('; ')}`,
      program: { weeks: allWeeks }
    }, { status: 502 })
  }

  return NextResponse.json({
    program: { weeks: allWeeks },
    ...(errors.length > 0 ? { warnings: errors } : {})
  })
}
