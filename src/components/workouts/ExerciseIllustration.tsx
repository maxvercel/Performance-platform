'use client'

import { useState } from 'react'

interface ExerciseIllustrationProps {
  exerciseName: string
  muscleGroup: string
}

/** Map common exercise keywords to emoji + short form cues */
const EXERCISE_ICONS: Record<string, { icon: string; cues: string[] }> = {
  // Borst
  'bench press': { icon: '🏋️', cues: ['Schouderbladen samen', 'Borst omhoog', 'Voeten plat'] },
  'chest press': { icon: '🏋️', cues: ['Ellebogen 45°', 'Gecontroleerd zakken'] },
  'push up': { icon: '💪', cues: ['Rug recht', 'Core aanspannen', 'Volle ROM'] },
  'dumbbell fly': { icon: '🦅', cues: ['Lichte buiging ellebogen', 'Borst strekken'] },
  'cable fly': { icon: '🦅', cues: ['Licht voorover', 'Knijp in de borst'] },
  'incline': { icon: '📐', cues: ['30-45° hoek', 'Borst omhoog'] },
  'decline': { icon: '📐', cues: ['Benen vasthaken', 'Borst open'] },
  'dip': { icon: '⬇️', cues: ['Voorover leunen', 'Ellebogen achter'] },
  // Rug
  'deadlift': { icon: '🏋️', cues: ['Rug recht', 'Heupen naar voren', 'Stang langs benen'] },
  'row': { icon: '🚣', cues: ['Schouderbladen samen', 'Ellebogen langs lichaam'] },
  'pull up': { icon: '🧗', cues: ['Schouders omlaag', 'Borst naar stang'] },
  'chin up': { icon: '🧗', cues: ['Onderhandse grip', 'Ellebogen naar ribben'] },
  'lat pulldown': { icon: '⬇️', cues: ['Borst omhoog', 'Stang naar kin'] },
  'pulldown': { icon: '⬇️', cues: ['Borst omhoog', 'Schouders omlaag'] },
  // Benen
  'squat': { icon: '🏋️', cues: ['Knieën over tenen', 'Borst omhoog', 'Diep zakken'] },
  'leg press': { icon: '🦵', cues: ['Voeten schouderbreedte', 'Rug plat tegen pad'] },
  'lunge': { icon: '🦵', cues: ['Knie 90°', 'Romp rechtop'] },
  'leg extension': { icon: '🦵', cues: ['Gecontroleerd', 'Knijp bovenbeen'] },
  'leg curl': { icon: '🦵', cues: ['Heupen plat', 'Squeeze bovenbeen'] },
  'calf raise': { icon: '🦶', cues: ['Volle stretch', 'Pauze bovenaan'] },
  'hip thrust': { icon: '🍑', cues: ['Kin naar borst', 'Knijp billen'] },
  'romanian': { icon: '🏋️', cues: ['Benen licht gebogen', 'Heupen naar achteren'] },
  // Schouders
  'shoulder press': { icon: '🏋️', cues: ['Core strak', 'Niet te ver achter hoofd'] },
  'overhead press': { icon: '🏋️', cues: ['Stang boven hoofd', 'Lockout'] },
  'lateral raise': { icon: '🦅', cues: ['Lichte buiging', 'Pinky omhoog'] },
  'face pull': { icon: '🔙', cues: ['Hoog trekken', 'Extern roteren'] },
  'front raise': { icon: '🦅', cues: ['Gecontroleerd', 'Tot schouderhoogte'] },
  'shrug': { icon: '🤷', cues: ['Recht omhoog', 'Houd vast bovenaan'] },
  // Armen
  'bicep curl': { icon: '💪', cues: ['Ellebogen vast', 'Volledige squeeze'] },
  'curl': { icon: '💪', cues: ['Niet slingeren', 'Gecontroleerd zakken'] },
  'tricep': { icon: '💪', cues: ['Ellebogen vast', 'Volledig strekken'] },
  'pushdown': { icon: '⬇️', cues: ['Ellebogen langs lichaam', 'Knijp tricep'] },
  'skull crusher': { icon: '💀', cues: ['Ellebogen stil', 'Naar voorhoofd'] },
  'hammer curl': { icon: '🔨', cues: ['Neutrale grip', 'Gecontroleerd'] },
  // Core
  'plank': { icon: '🧘', cues: ['Rug recht', 'Core aanspannen', 'Neutraal hoofd'] },
  'crunch': { icon: '🧘', cues: ['Schouders optillen', 'Onderrug op grond'] },
  'ab': { icon: '🧘', cues: ['Gecontroleerd', 'Adem uit bij contractie'] },
  'russian twist': { icon: '🔄', cues: ['Voeten van grond', 'Roteer vanuit romp'] },
  'leg raise': { icon: '🦵', cues: ['Onderrug plat', 'Gecontroleerd zakken'] },
  'cable woodchop': { icon: '🪓', cues: ['Rotatie vanuit heupen', 'Armen recht'] },
}

const MUSCLE_GROUP_GRADIENTS: Record<string, string> = {
  Borst: 'from-blue-500/20 to-blue-600/5',
  Rug: 'from-purple-500/20 to-purple-600/5',
  Benen: 'from-red-500/20 to-red-600/5',
  Schouders: 'from-yellow-500/20 to-yellow-600/5',
  Armen: 'from-orange-500/20 to-orange-600/5',
  Core: 'from-green-500/20 to-green-600/5',
  Billen: 'from-pink-500/20 to-pink-600/5',
}

const MUSCLE_GROUP_BORDER: Record<string, string> = {
  Borst: 'border-blue-500/20',
  Rug: 'border-purple-500/20',
  Benen: 'border-red-500/20',
  Schouders: 'border-yellow-500/20',
  Armen: 'border-orange-500/20',
  Core: 'border-green-500/20',
  Billen: 'border-pink-500/20',
}

function findExerciseMatch(name: string): { icon: string; cues: string[] } | null {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(EXERCISE_ICONS)) {
    if (lower.includes(key)) return value
  }
  return null
}

export function ExerciseIllustration({ exerciseName, muscleGroup }: ExerciseIllustrationProps) {
  const [expanded, setExpanded] = useState(false)
  const match = findExerciseMatch(exerciseName)
  const gradient = MUSCLE_GROUP_GRADIENTS[muscleGroup] ?? 'from-zinc-500/20 to-zinc-600/5'
  const border = MUSCLE_GROUP_BORDER[muscleGroup] ?? 'border-zinc-500/20'

  if (!match) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 text-xs font-bold transition
          ${expanded ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Uitvoering tips</span>
      </button>

      {expanded && (
        <div className={`mt-2 bg-gradient-to-br ${gradient} border ${border} rounded-xl p-3`}>
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0">{match.icon}</div>
            <div className="space-y-1.5">
              {match.cues.map((cue, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-zinc-200 text-xs">{cue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
