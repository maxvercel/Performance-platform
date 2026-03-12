'use client'

import { useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { X } from 'lucide-react'

interface PhotoCompareProps {
  beforePhoto: {
    id: string
    photo_url: string
    taken_at: string
  }
  afterPhoto: {
    id: string
    photo_url: string
    taken_at: string
  }
  onClose: () => void
}

export default function PhotoCompare({
  beforePhoto,
  afterPhoto,
  onClose,
}: PhotoCompareProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const beforeDate = format(parseISO(beforePhoto.taken_at), 'PPP', { locale: nl })
  const afterDate = format(parseISO(afterPhoto.taken_at), 'PPP', { locale: nl })
  const daysDiff = Math.floor(
    (parseISO(afterPhoto.taken_at).getTime() - parseISO(beforePhoto.taken_at).getTime()) /
      (1000 * 60 * 60 * 24)
  )

  const handleMouseDown = () => {
    isDraggingRef.current = true
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  const handleMouseMove = (e: MouseEvent | React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const x = (e as MouseEvent).clientX - rect.left

    if (x >= 0 && x <= rect.width) {
      const percentage = (x / rect.width) * 100
      setSliderPosition(Math.max(0, Math.min(100, percentage)))
    }
  }

  const handleTouchStart = () => {
    isDraggingRef.current = true
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const x = e.touches[0].clientX - rect.left

    if (x >= 0 && x <= rect.width) {
      const percentage = (x / rect.width) * 100
      setSliderPosition(Math.max(0, Math.min(100, percentage)))
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleMouseMove(e)
    const onUp = () => handleMouseUp()
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <X size={24} className="text-white" />
      </button>

      {/* Comparison Container */}
      <div className="w-full max-w-4xl max-h-full overflow-hidden">
        {/* Header */}
        <div className="mb-4 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Voortgang</h3>
          <p className="text-zinc-400">
            {daysDiff} dagen verschil • {beforeDate} tot {afterDate}
          </p>
        </div>

        {/* Comparison Slider */}
        <div
          ref={containerRef}
          className="relative w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 aspect-square max-h-[70vh]"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Before Photo (Left Side) */}
          <div className="absolute inset-0">
            <img
              src={beforePhoto.photo_url}
              alt="Start foto"
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Before Label */}
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded-lg">
              <p className="text-xs font-semibold text-white">Start</p>
              <p className="text-xs text-zinc-300">{beforeDate}</p>
            </div>
          </div>

          {/* After Photo (Right Side - Clipped) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              width: `${sliderPosition}%`,
              clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
            }}
          >
            <img
              src={afterPhoto.photo_url}
              alt="Huidige foto"
              className="w-full h-full object-cover"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
            {/* After Label */}
            <div className="absolute top-4 right-4 px-3 py-1 bg-orange-500/80 rounded-lg">
              <p className="text-xs font-semibold text-white">Nu</p>
              <p className="text-xs text-orange-100">{afterDate}</p>
            </div>
          </div>

          {/* Slider Handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-orange-500 cursor-col-resize hover:w-2 transition-all shadow-lg"
            style={{
              left: `${sliderPosition}%`,
              transform: 'translateX(-50%)',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Handle Icon */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-orange-500 rounded-full shadow-lg flex items-center justify-center pointer-events-none">
              <div className="flex gap-1">
                <div className="w-0.5 h-4 bg-white rounded-full" />
                <div className="w-0.5 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-sm text-zinc-400">
          <p>Sleep de schuifbalk om voor en na te vergelijken</p>
        </div>
      </div>
    </div>
  )
}
