'use client'

import { useState, useEffect } from 'react'

export interface RestTimerOverlayProps {
  timeRemaining: number | null
  isActive: boolean
  totalSeconds: number
  onSkip: () => void
  onAddTime: (seconds: number) => void
}

export function RestTimerOverlay({
  timeRemaining,
  isActive,
  totalSeconds,
  onSkip,
  onAddTime,
}: RestTimerOverlayProps) {
  const [showFlash, setShowFlash] = useState(false)

  // Trigger flash animation when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && isActive) {
      setShowFlash(true)
      const timer = setTimeout(() => setShowFlash(false), 600)
      return () => clearTimeout(timer)
    }
  }, [timeRemaining, isActive])

  if (!isActive || timeRemaining === null) {
    return null
  }

  // Format time as MM:SS
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // Calculate progress percentage
  const progress = ((totalSeconds - timeRemaining) / totalSeconds) * 100

  // SVG circle parameters
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div
      className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50
        transition-all duration-300 ease-out ${
        isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
      } ${showFlash ? 'animate-pulse' : ''}`}
    >
      {/* Card container */}
      <div
        className={`bg-zinc-900/95 backdrop-blur-xl border rounded-3xl px-8 py-6
        shadow-2xl transition-colors duration-300 ${
          showFlash ? 'border-green-500 bg-green-500/10' : 'border-zinc-700'
        }`}
      >
        {/* Main timer display with progress ring */}
        <div className="flex flex-col items-center gap-4 mb-4">
          {/* Circular progress ring with timer */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* SVG circle background */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140">
              {/* Background circle */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-zinc-800"
              />
              {/* Progress circle */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`text-orange-500 transition-all duration-100 ease-linear ${
                  showFlash ? 'text-green-500' : ''
                }`}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '70px 70px',
                }}
              />
            </svg>

            {/* Timer text in center */}
            <div className="text-center z-10">
              <div className="text-4xl font-black text-white tabular-nums">
                {timeDisplay}
              </div>
              <div className="text-xs text-zinc-500 font-bold mt-1">
                {Math.round(progress)}%
              </div>
            </div>
          </div>

          {/* Exercise label */}
          <div className="text-sm font-bold text-zinc-400">
            Rusttijd
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onAddTime(30)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold
                     py-2.5 px-4 rounded-xl transition-all active:scale-95
                     text-sm shadow-lg hover:shadow-orange-500/20"
          >
            +30s
          </button>
          <button
            onClick={onSkip}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold
                     py-2.5 px-4 rounded-xl transition-all active:scale-95
                     text-sm border border-zinc-700 hover:border-zinc-600"
          >
            Overslaan
          </button>
        </div>
      </div>
    </div>
  )
}
