/**
 * Supabase query helpers for safe operations at scale.
 * PostgREST has a URL length limit (~8KB), so .in() with 100+ IDs can fail.
 * These helpers chunk large arrays into safe batches.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const CHUNK_SIZE = 80 // Safe limit for .in() (36-char UUIDs × 80 ≈ 3KB)

/**
 * Performs a SELECT query with .in() in safe chunks.
 * Returns all results combined from all chunks.
 */
export async function selectInChunks<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  selectColumns: string,
  inColumn: string,
  ids: string[],
  extraFilters?: (query: any) => any
): Promise<T[]> {
  if (ids.length === 0) return []

  // If small enough, do a single query
  if (ids.length <= CHUNK_SIZE) {
    let query = supabase.from(table).select(selectColumns).in(inColumn, ids)
    if (extraFilters) query = extraFilters(query)
    const { data, error } = await query
    if (error) {
      console.error(`selectInChunks error (${table}):`, error.message)
      return []
    }
    return (data as T[]) ?? []
  }

  // Chunk the IDs and run queries in parallel
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE))
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      let query = supabase.from(table).select(selectColumns).in(inColumn, chunk)
      if (extraFilters) query = extraFilters(query)
      const { data, error } = await query
      if (error) {
        console.error(`selectInChunks error (${table}, chunk):`, error.message)
        return []
      }
      return (data as T[]) ?? []
    })
  )

  return results.flat()
}
