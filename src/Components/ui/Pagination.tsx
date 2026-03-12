'use client'

interface PaginationProps {
  currentPage: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  onNext: () => void
  onPrev: () => void
}

export function Pagination({ currentPage, totalPages, hasNext, hasPrev, onNext, onPrev }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 py-3" role="navigation" aria-label="Paginering">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Vorige pagina"
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition
                   bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← Vorige
      </button>
      <span className="text-zinc-500 text-xs">
        {currentPage + 1} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Volgende pagina"
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition
                   bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Volgende →
      </button>
    </div>
  )
}
