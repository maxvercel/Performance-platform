import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
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

  // Build mode — all weeks in PARALLEL for speed
  const totalWeeks = program.length
  const errors: string[] = []

  console.log(`Building program: ${totalWeeks} weeks, days per week: ${program.map(w => w.days.length).join(',')}`)

  // Generate all weeks in parallel to avoid Vercel timeout
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
          system: `Je bent een expert personal trainer. Reageer ALLEEN met valid JSON. Geen tekst, geen markdown. Begin met { en eindig met }.

KRITIEKE REGELS:
1. Gebruik EXACT de oefeningen en volgorde die de coach noemt. Verzin GEEN eigen oefeningen.
2. Als de coach superset labels gebruikt (A1, A2, B1, B2, C1 etc.), zet dan de LETTER als superset_group ("A", "B", "C", "D").
3. Neem ALLE oefeningen over — sla er GEEN over. Als de coach 9 oefeningen per training geeft, geef je 9 terug.
4. Als de coach week-specifieke reps/progressie noemt (bijv. "week 1-2: 12, week 3-4: 15"), pas dit aan per week.
5. Behoud tempo notaties, zijde-aanduidingen en alle details in de notes.
6. Zet muscle_group op: "Borst", "Rug", "Benen", "Schouders", "Armen", "Core", "Billen" of "Cardio".`,
          messages: [{
            role: 'user',
            content: `Programma: ${templateName}
Week: ${week.week} van ${totalWeeks}
Progressie: ${progressie}
Dagen: ${numDays} (${dayLabels})

Coach instructie:
${prompt}

BELANGRIJK:
- Neem ALLE oefeningen uit de instructie over, exact zoals beschreven
- Als de coach A1/A2/B1/B2 superset labels gebruikt: A1+A2+A3 krijgen superset_group "A", B1+B2 krijgen "B", etc.
- Pas reps aan voor week ${week.week} als de coach week-specifieke progressie noemt
- Zet tempo en andere details in het notes veld

Retourneer ALLEEN dit JSON formaat:
{
  "week_number": ${week.week},
  "days": [
    ${week.days.map((d: any) => `{
      "day_number": ${d.day_number},
      "label": "${d.dag}",
      "exercises": [
        {"name": "Side Lying Hip Abduction", "sets": 3, "reps": "12/zijde", "weight_kg": null, "rest_seconds": 0, "notes": "tempo 1-1-2-1, RPE 6-7", "superset_group": "A", "muscle_group": "Billen"},
        {"name": "Dead Bug", "sets": 3, "reps": "12/zijde", "weight_kg": null, "rest_seconds": 0, "notes": "tempo 3-1-3-1", "superset_group": "A", "muscle_group": "Core"},
        {"name": "Lateral Band Walk", "sets": 3, "reps": "10 m", "weight_kg": null, "rest_seconds": 90, "notes": "RPE 6-7", "superset_group": "A", "muscle_group": "Billen"},
        {"name": "Single Leg Glute Bridge", "sets": 3, "reps": "8-10/zijde", "weight_kg": null, "rest_seconds": 0, "notes": "tempo 1-1-3-2", "superset_group": "B", "muscle_group": "Billen"},
        {"name": "Single Leg Balance Reach", "sets": 3, "reps": "8-10/zijde", "weight_kg": null, "rest_seconds": 90, "notes": "3x8 richtingen", "superset_group": "B", "muscle_group": "Benen"}
      ]
    }`).join(',\n    ')}
  ]
}`
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
          }))
        }
      }

      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''
      console.log(`Week ${week.week} AI response length: ${text.length} chars`)

      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Auto-create new exercises in the database (fire and forget)
      for (const day of parsed.days) {
        for (const ex of day.exercises) {
          if (!ex.name) continue
          const { data: existing } = await supabase
            .from('exercises')
            .select('id, muscle_group')
            .ilike('name', ex.name.trim())
            .limit(1)
            .maybeSingle()
          if (!existing) {
            await supabase.from('exercises').insert({
              name: ex.name.trim(),
              category: 'general',
              muscle_group: ex.muscle_group || 'general',
              is_global: true,
            })
          } else if (existing.muscle_group === 'general' && ex.muscle_group) {
            await supabase
              .from('exercises')
              .update({ muscle_group: ex.muscle_group })
              .eq('id', existing.id)
          }
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
        }))
      }
    }
  })

  const allWeeks = await Promise.all(weekPromises)
  // Sort by week number to ensure correct order
  allWeeks.sort((a, b) => a.week_number - b.week_number)

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
