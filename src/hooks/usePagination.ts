'use client'

import { useState, useMemo, useCallback } from 'react'

interface UsePaginationReturn<T> {
  /** The current page of items */
  page: T[]
  /** Current page number (0-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Whether there's a next page */
  hasNext: boolean
  /** Whether there's a previous page */
  hasPrev: boolean
  /** Go to the next page */
  next: () => void
  /** Go to the previous page */
  prev: () => void
  /** Go to a specific page (0-indexed) */
  goTo: (page: number) => void
  /** Reset to first page */
  reset: () => void
}

/**
 * Simple client-side pagination hook.
 *
 * @param items Full array of items to paginate
 * @param pageSize Number of items per page (default 10)
 */
export function usePagination<T>(items: T[], pageSize = 10): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // Reset page when items change (e.g. filtered list becomes shorter)
  const safePage = Math.min(currentPage, totalPages - 1)
  if (safePage !== currentPage) setCurrentPage(safePage)

  const page = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize]
  )

  const hasNext = safePage < totalPages - 1
  const hasPrev = safePage > 0

  const next = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages - 1))
  }, [totalPages])

  const prev = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 0))
  }, [])

  const goTo = useCallback((pg: number) => {
    setCurrentPage(Math.max(0, Math.min(pg, totalPages - 1)))
  }, [totalPages])

  const reset = useCallback(() => setCurrentPage(0), [])

  return { page, currentPage: safePage, totalPages, hasNext, hasPrev, next, prev, goTo, reset }
}
