'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

type Props = {
  data: Array<{ logged_at: string; weight_kg: number }>
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
      <p className="text-orange-400 font-bold text-sm">{payload[0].value} kg</p>
      <p className="text-zinc-500 text-xs">
        {format(new Date(payload[0].payload.logged_at), 'd MMM', { locale: nl })}
      </p>
    </div>
  )
}

export default function WeightChart({ data }: Props) {
  if (!data || data.length < 2) return (
    <div className="flex items-center justify-center h-32 border border-dashed 
                    border-zinc-700 rounded-xl">
      <p className="text-zinc-600 text-sm">Log minimaal 2 metingen voor een grafiek</p>
    </div>
  )

  const formatted = data.map(d => ({
    ...d,
    date: format(new Date(d.logged_at), 'd MMM', { locale: nl })
  }))

  const min = Math.min(...data.map(d => d.weight_kg)) - 1
  const max = Math.max(...data.map(d => d.weight_kg)) + 1

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={formatted} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#52525b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#52525b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[min, max]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46' }} />
        <Line
          type="monotone"
          dataKey="weight_kg"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#f97316' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}