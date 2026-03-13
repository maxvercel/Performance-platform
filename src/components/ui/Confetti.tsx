'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  show: boolean
  duration?: number
}

export function Confetti({ show, duration = 3000 }: ConfettiProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!show) return

    setIsVisible(true)
    const timer = setTimeout(() => setIsVisible(false), duration)

    return () => clearTimeout(timer)
  }, [show, duration])

  if (!isVisible) return null

  // Generate random confetti particles
  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.2,
    duration: 2 + Math.random() * 1,
    color: ['bg-orange-500', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-500'][
      Math.floor(Math.random() * 5)
    ],
  }))

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          to {
            transform: translateY(100vh) rotateZ(360deg);
            opacity: 0;
          }
        }

        .confetti-particle {
          position: fixed;
          pointer-events: none;
          top: -10px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: confettiFall linear forwards;
        }
      `}</style>

      {particles.map(particle => (
        <div
          key={particle.id}
          className={`confetti-particle z-50 ${particle.color}`}
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </>
  )
}
