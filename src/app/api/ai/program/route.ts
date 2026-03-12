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

  // Build mode — week by week
  const allWeeks = []
  const totalWeeks = program.length

  for (const week of program) {
    const numDays = week.days.length
    const dayLabels = week.days.map((d) => `dag ${d.day_number}: ${d.dag}`).join(', ')

    const progressie =
      week.week <= 2 ? 'Opbouwfase: RPE 6-7, 3 sets per oefening' :
      week.week <= 4 ? 'Hoofdfase: RPE 7-8, 4 sets per oefening' :
      week.week === 5 ? 'Piekfase: RPE 8-9, 4-5 sets per oefening' :
      'Deload: RPE 5-6, 2-3 sets, minder volume'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: `Je bent een expert personal trainer. Reageer ALLEEN met valid JSON. Geen tekst, geen markdown. Begin met { en eindig met }.`,
        messages: [{
          role: 'user',
          content: `Programma: ${templateName}
Week: ${week.week} van ${totalWeeks}
Progressie: ${progressie}
Dagen: ${numDays} (${dayLabels})

Coach instructie: ${prompt}

Gebruik EXACT de oefeningen die de coach noemt in de instructie.
Je mag elke oefeninnaam gebruiken — ook als die nieuw is.
Vul ALLE ${numDays} dagen in met 5-6 oefeningen per dag.

Retourneer dit JSON:
{
  "week_number": ${week.week},
  "days": [
    ${week.days.map((d) => `{
      "day_number": ${d.day_number},
      "label": "${d.dag}",
      "exercises": [
        {"name": "OEFENING", "sets": 4, "reps": "8-10", "weight_kg": null, "rest_seconds": 90, "notes": "RPE 7"},
        {"name": "OEFENING", "sets": 4, "reps": "8-10", "weight_kg": null, "rest_seconds": 90, "notes": "RPE 7"},
        {"name": "OEFENING", "sets": 3, "reps": "10-12", "weight_kg": null, "rest_seconds": 75, "notes": "RPE 6"},
        {"name": "OEFENING", "sets": 3, "reps": "10-12", "weight_kg": null, "rest_seconds": 75, "notes": "RPE 6"},
        {"name": "OEFENING", "sets": 3, "reps": "12-15", "weight_kg": null, "rest_seconds": 60, "notes": "RPE 6"}
      ]
    }`).join(',\n    ')}
  ]
}`
        }]
      })
    })

    if (!response.ok) {
      console.error(`Anthropic API error (week ${week.week}):`, response.status)
      allWeeks.push({
        week_number: week.week,
        days: week.days.map((d) => ({
          day_number: d.day_number, label: d.dag, exercises: []
        }))
      })
      continue
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    try {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Auto-create new exercises in the database
      for (const day of parsed.days) {
        for (const ex of day.exercises) {
          if (!ex.name) continue
          const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', ex.name.trim())
            .limit(1)
            .maybeSingle()
          if (!existing) {
            await supabase.from('exercises').insert({
              name: ex.name.trim(),
              category: 'general',
              muscle_group: 'general',
              is_global: true,
            })
          }
        }
      }

      allWeeks.push(parsed)
    } catch {
      console.error(`Week ${week.week} parse error:`, text.substring(0, 300))
      allWeeks.push({
        week_number: week.week,
        days: week.days.map((d) => ({
          day_number: d.day_number, label: d.dag, exercises: []
        }))
      })
    }
  }

  return NextResponse.json({ program: { weeks: allWeeks } })
}
