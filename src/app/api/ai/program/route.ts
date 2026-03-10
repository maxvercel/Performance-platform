import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { prompt, program, templateName, mode } = await request.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    const data = await response.json()
    return NextResponse.json({ response: data.content?.[0]?.text ?? '' })
  }

  const allWeeks = []
  const totalWeeks = program.length

  for (const week of program) {
    const numDays = week.days.length
    const dayLabels = week.days.map((d: any) => `dag ${d.day_number}: ${d.dag}`).join(', ')

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
    ${week.days.map((d: any) => `{
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

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    try {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Auto-voeg nieuwe oefeningen toe aan de database
      for (const day of parsed.days) {
        for (const ex of day.exercises) {
          if (!ex.name) continue

          // Check of oefening al bestaat
          const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', ex.name.trim())
            .single()

          // Zo niet — voeg toe
          if (!existing) {
            await supabase.from('exercises').insert({
              name: ex.name.trim(),
              category: 'general',
              muscle_group: 'general',
              is_global: true,
            })
            console.log('Nieuwe oefening toegevoegd:', ex.name)
          }
        }
      }

      allWeeks.push(parsed)
    } catch {
      console.error(`Week ${week.week} parse fout:`, text.substring(0, 300))
      allWeeks.push({
        week_number: week.week,
        days: week.days.map((d: any) => ({
          day_number: d.day_number,
          label: d.dag,
          exercises: []
        }))
      })
    }
  }

  return NextResponse.json({ program: { weeks: allWeeks } })
}