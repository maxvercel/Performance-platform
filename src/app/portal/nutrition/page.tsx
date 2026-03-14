'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'

interface MealEntry {
  id: string
  client_id: string
  date: string
  meal_type: 'ontbijt' | 'lunch' | 'diner' | 'snack'
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
}

interface DailyTarget {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface FoodSearchResult {
  name: string
  brand: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  image: string | null
}

interface RecentItem {
  name: string
  brand: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  image: string | null
}

const DEFAULT_TARGETS: DailyTarget = {
  calories: 2500,
  protein_g: 180,
  carbs_g: 280,
  fat_g: 80,
}

const MEAL_TYPES = [
  { key: 'ontbijt' as const, label: 'Ontbijt', icon: '🌅', time: '07:00 - 10:00' },
  { key: 'lunch' as const, label: 'Lunch', icon: '☀️', time: '12:00 - 14:00' },
  { key: 'diner' as const, label: 'Diner', icon: '🌙', time: '18:00 - 21:00' },
  { key: 'snack' as const, label: 'Snacks', icon: '🍎', time: 'Tussendoor' },
]

const QUICK_ADD_ITEMS = [
  { name: 'Eiwitshake', calories: 150, protein_g: 30, carbs_g: 5, fat_g: 2 },
  { name: 'Banaan', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0 },
  { name: 'Kipfilet (150g)', calories: 230, protein_g: 43, carbs_g: 0, fat_g: 5 },
  { name: 'Rijst (200g gekookt)', calories: 260, protein_g: 5, carbs_g: 56, fat_g: 1 },
  { name: 'Havermout (80g)', calories: 300, protein_g: 11, carbs_g: 52, fat_g: 6 },
  { name: 'Ei', calories: 72, protein_g: 6, carbs_g: 0, fat_g: 5 },
  { name: 'Brood (2 sneetjes)', calories: 180, protein_g: 7, carbs_g: 33, fat_g: 2 },
  { name: 'Griekse yoghurt', calories: 130, protein_g: 12, carbs_g: 8, fat_g: 6 },
  { name: 'Pindakaas (30g)', calories: 190, protein_g: 8, carbs_g: 4, fat_g: 16 },
  { name: 'Avocado (half)', calories: 160, protein_g: 2, carbs_g: 9, fat_g: 15 },
  { name: 'Tonijn blik', calories: 120, protein_g: 26, carbs_g: 0, fat_g: 1 },
  { name: 'Cottage cheese (150g)', calories: 105, protein_g: 15, carbs_g: 4, fat_g: 3 },
]

export default function NutritionPage() {
  const supabase = createClient()
  const { profile, loading: authLoading } = useAuth()

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [targets, setTargets] = useState<DailyTarget>(DEFAULT_TARGETS)
  const [loading, setLoading] = useState(true)
  const [addMealType, setAddMealType] = useState<'ontbijt' | 'lunch' | 'diner' | 'snack'>('ontbijt')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showTargetModal, setShowTargetModal] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showPortionModal, setShowPortionModal] = useState(false)
  const [selectedSearchItem, setSelectedSearchItem] = useState<FoodSearchResult | null>(null)
  const [portionSize, setPortionSize] = useState('100')
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null)

  const [form, setForm] = useState({
    name: '',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
  })

  useEffect(() => {
    if (authLoading || !profile) return
    loadMeals()
  }, [authLoading, profile?.id, selectedDate])

  useEffect(() => {
    // Load recent items from localStorage
    const stored = localStorage.getItem('nutrition_recent_items')
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load recent items:', e)
      }
    }
  }, [])

  useEffect(() => {
    // Debounced search
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current)
    }

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchDebounceTimer.current = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current)
      }
    }
  }, [searchQuery])

  async function loadMeals() {
    if (!profile) return
    setLoading(true)

    const [mealsRes, targetRes] = await Promise.all([
      supabase
        .from('nutrition_logs')
        .select('*')
        .eq('client_id', profile.id)
        .eq('date', selectedDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('nutrition_targets')
        .select('*')
        .eq('client_id', profile.id)
        .maybeSingle(),
    ])

    setMeals(mealsRes.data ?? [])

    if (targetRes.data) {
      setTargets({
        calories: targetRes.data.calories ?? DEFAULT_TARGETS.calories,
        protein_g: targetRes.data.protein_g ?? DEFAULT_TARGETS.protein_g,
        carbs_g: targetRes.data.carbs_g ?? DEFAULT_TARGETS.carbs_g,
        fat_g: targetRes.data.fat_g ?? DEFAULT_TARGETS.fat_g,
      })
    }

    setLoading(false)
  }

  async function addMeal() {
    if (!profile || !form.name) return
    setSaving(true)

    await supabase.from('nutrition_logs').insert({
      client_id: profile.id,
      date: selectedDate,
      meal_type: addMealType,
      name: form.name,
      calories: parseInt(form.calories) || null,
      protein_g: parseFloat(form.protein_g) || null,
      carbs_g: parseFloat(form.carbs_g) || null,
      fat_g: parseFloat(form.fat_g) || null,
    })

    setForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
    setShowQuickAdd(false)
    await loadMeals()
    setSaving(false)
  }

  async function quickAdd(item: typeof QUICK_ADD_ITEMS[0]) {
    if (!profile) return
    setSaving(true)

    await supabase.from('nutrition_logs').insert({
      client_id: profile.id,
      date: selectedDate,
      meal_type: addMealType,
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    })

    await loadMeals()
    setSaving(false)
    setShowQuickAdd(false)
  }

  async function deleteMeal(id: string) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  async function performSearch(query: string) {
    try {
      const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setSearchResults(data.results || [])
      setSearchError(null)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
      setSearchError('Zoeken mislukt. Controleer je verbinding.')
    } finally {
      setSearching(false)
    }
  }

  function addRecentItem(item: FoodSearchResult) {
    const updated = [
      item,
      ...recentItems.filter(r => r.name !== item.name)
    ].slice(0, 10)
    setRecentItems(updated)
    localStorage.setItem('nutrition_recent_items', JSON.stringify(updated))
  }

  async function addSearchItem(item: FoodSearchResult) {
    if (!profile) return

    addRecentItem(item)

    const portion = parseInt(portionSize) || 100
    const multiplier = portion / 100

    const calories = item.calories ? Math.round(item.calories * multiplier) : null
    const protein = item.protein_g ? Math.round(item.protein_g * multiplier * 10) / 10 : null
    const carbs = item.carbs_g ? Math.round(item.carbs_g * multiplier * 10) / 10 : null
    const fat = item.fat_g ? Math.round(item.fat_g * multiplier * 10) / 10 : null

    const itemName = portion === 100 ? item.name : `${item.name} (${portion}g)`

    setSaving(true)
    await supabase.from('nutrition_logs').insert({
      client_id: profile.id,
      date: selectedDate,
      meal_type: addMealType,
      name: itemName,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    })

    setPortionSize('100')
    setSelectedSearchItem(null)
    setShowPortionModal(false)
    setSearchQuery('')
    setSearchResults([])
    await loadMeals()
    setSaving(false)
  }

  async function saveTargets() {
    if (!profile) return
    setSaving(true)

    await supabase.from('nutrition_targets').upsert({
      client_id: profile.id,
      calories: targets.calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
    }, { onConflict: 'client_id' })

    setShowTargetModal(false)
    setSaving(false)
  }

  // Computed totals
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  const pct = (val: number, target: number) => Math.min(100, Math.round((val / target) * 100))

  if (authLoading || loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Voeding</p>
        <h1 className="text-white text-2xl font-black">Macro Tracker</h1>
      </div>

      {/* Date selector */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition"
            aria-label="Vorige dag"
          >
            ←
          </button>
          <div className="text-center">
            <p className="text-white font-bold">
              {format(parseISO(selectedDate), 'EEEE', { locale: nl })}
            </p>
            <p className="text-zinc-500 text-xs">
              {format(parseISO(selectedDate), 'd MMMM yyyy', { locale: nl })}
            </p>
          </div>
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition"
            aria-label="Volgende dag"
          >
            →
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Macro overview */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-5">
            {/* Calorie circle */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={totals.calories > targets.calories ? '#ef4444' : '#f97316'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(1, totals.calories / targets.calories))}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white text-xl font-black">{totals.calories}</span>
                <span className="text-zinc-500 text-xs">/ {targets.calories}</span>
              </div>
            </div>

            {/* Macro bars */}
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-blue-400 font-bold">Eiwit</span>
                  <span className="text-xs text-zinc-400">{Math.round(totals.protein_g)}g / {targets.protein_g}g</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct(totals.protein_g, targets.protein_g)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-orange-400 font-bold">Koolhydraten</span>
                  <span className="text-xs text-zinc-400">{Math.round(totals.carbs_g)}g / {targets.carbs_g}g</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct(totals.carbs_g, targets.carbs_g)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-yellow-400 font-bold">Vet</span>
                  <span className="text-xs text-zinc-400">{Math.round(totals.fat_g)}g / {targets.fat_g}g</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct(totals.fat_g, targets.fat_g)}%` }} />
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setShowTargetModal(true)}
            className="mt-3 text-zinc-600 text-xs hover:text-zinc-400 transition">
            Doelen aanpassen
          </button>
        </div>

        {/* Meal sections */}
        {MEAL_TYPES.map(mt => {
          const mealEntries = meals.filter(m => m.meal_type === mt.key)
          const mealCals = mealEntries.reduce((a, m) => a + (m.calories ?? 0), 0)

          return (
            <div key={mt.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{mt.icon}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{mt.label}</p>
                    <p className="text-zinc-600 text-xs">{mt.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mealCals > 0 && (
                    <span className="text-zinc-500 text-xs font-bold">{mealCals} kcal</span>
                  )}
                  <button
                    onClick={() => { setAddMealType(mt.key); setShowQuickAdd(true) }}
                    className="w-11 h-11 bg-orange-500/15 text-orange-400 rounded-xl
                               flex items-center justify-center text-lg hover:bg-orange-500/25 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {mealEntries.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {mealEntries.map(entry => (
                    <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-zinc-200 text-sm">{entry.name}</p>
                        <div className="flex gap-3 mt-0.5">
                          {entry.calories != null && <span className="text-zinc-500 text-xs">{entry.calories} kcal</span>}
                          {entry.protein_g != null && <span className="text-blue-400/60 text-xs">E{entry.protein_g}g</span>}
                          {entry.carbs_g != null && <span className="text-orange-400/60 text-xs">K{entry.carbs_g}g</span>}
                          {entry.fat_g != null && <span className="text-yellow-400/60 text-xs">V{entry.fat_g}g</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteMeal(entry.id)}
                        className="w-9 h-9 flex items-center justify-center text-zinc-700 hover:text-red-400 text-lg transition ml-2 rounded-lg">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-4 text-center">
                  <p className="text-zinc-700 text-xs">Nog niets toegevoegd</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Remaining */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-3">Resterend vandaag</p>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <p className={`text-lg font-black ${targets.calories - totals.calories >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {targets.calories - totals.calories}
              </p>
              <p className="text-zinc-600 text-xs">kcal</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-black ${targets.protein_g - totals.protein_g >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {Math.round(targets.protein_g - totals.protein_g)}g
              </p>
              <p className="text-zinc-600 text-xs">Eiwit</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-black ${targets.carbs_g - totals.carbs_g >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {Math.round(targets.carbs_g - totals.carbs_g)}g
              </p>
              <p className="text-zinc-600 text-xs">Koolh.</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-black ${targets.fat_g - totals.fat_g >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(targets.fat_g - totals.fat_g)}g
              </p>
              <p className="text-zinc-600 text-xs">Vet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowQuickAdd(false) }}>
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white font-bold">
                {MEAL_TYPES.find(m => m.key === addMealType)?.icon}{' '}
                {MEAL_TYPES.find(m => m.key === addMealType)?.label} toevoegen
              </h3>
              <button onClick={() => setShowQuickAdd(false)} className="text-zinc-500 text-xl">×</button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {/* Search Database */}
              <div className="p-4 border-b border-zinc-800">
                <p className="text-zinc-500 text-xs font-bold uppercase mb-3">Zoeken in database</p>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Zoek voeding..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 pl-9 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                  />
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {searching && (
                  <div className="mt-3 text-center text-zinc-500 text-xs">Zoeken...</div>
                )}

                {/* Recent items */}
                {!searchQuery && recentItems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-zinc-600 text-xs font-bold mb-2">Recent gebruikt</p>
                    <div className="space-y-2">
                      {recentItems.map((item, idx) => (
                        <button
                          key={`${item.name}-${idx}`}
                          onClick={() => {
                            setSelectedSearchItem(item)
                            setShowPortionModal(true)
                          }}
                          disabled={saving}
                          className="w-full text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-2.5 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{item.name}</p>
                              <p className="text-zinc-600 text-xs">{item.brand}</p>
                              <div className="flex gap-2 mt-1">
                                {item.calories != null && <span className="text-zinc-500 text-xs">{Math.round(item.calories)} kcal</span>}
                                {item.protein_g != null && <span className="text-blue-400/60 text-xs">E{Math.round(item.protein_g * 10) / 10}g</span>}
                              </div>
                            </div>
                            {item.image && (
                              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover ml-2" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                {searchQuery && searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((item, idx) => (
                      <button
                        key={`${item.name}-${idx}`}
                        onClick={() => {
                          setSelectedSearchItem(item)
                          setShowPortionModal(true)
                        }}
                        disabled={saving}
                        className="w-full text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-2.5 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{item.name}</p>
                            <p className="text-zinc-600 text-xs">{item.brand}</p>
                            <div className="flex gap-2 mt-1">
                              {item.calories != null && <span className="text-zinc-500 text-xs">{Math.round(item.calories)} kcal/100g</span>}
                              {item.protein_g != null && <span className="text-blue-400/60 text-xs">E{Math.round(item.protein_g * 10) / 10}g</span>}
                            </div>
                          </div>
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover ml-2" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchError && (
                  <div className="mt-3 text-center text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl py-2 px-3">
                    {searchError}
                  </div>
                )}

                {searchQuery && !searching && !searchError && searchResults.length === 0 && (
                  <div className="mt-3 text-center text-zinc-600 text-xs">Geen resultaten gevonden</div>
                )}
              </div>

              <div className="p-4">
                <p className="text-zinc-500 text-xs font-bold uppercase mb-2">Snel toevoegen</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ADD_ITEMS.map(item => (
                    <button key={item.name} onClick={() => quickAdd(item)} disabled={saving}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-3 text-left transition">
                      <p className="text-white text-sm font-medium">{item.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-zinc-500 text-xs">{item.calories} kcal</span>
                        <span className="text-blue-400/60 text-xs">E{item.protein_g}g</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-zinc-800">
                <p className="text-zinc-500 text-xs font-bold uppercase mb-3">Handmatig toevoegen</p>
                <div className="space-y-3">
                  <input type="text" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Naam (bijv. Kipfilet met rijst)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" inputMode="numeric" value={form.calories}
                      onChange={e => setForm(p => ({ ...p, calories: e.target.value }))}
                      placeholder="Calorieën (kcal)"
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500" />
                    <input type="number" inputMode="decimal" value={form.protein_g}
                      onChange={e => setForm(p => ({ ...p, protein_g: e.target.value }))}
                      placeholder="Eiwit (g)"
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500" />
                    <input type="number" inputMode="decimal" value={form.carbs_g}
                      onChange={e => setForm(p => ({ ...p, carbs_g: e.target.value }))}
                      placeholder="Koolhydraten (g)"
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500" />
                    <input type="number" inputMode="decimal" value={form.fat_g}
                      onChange={e => setForm(p => ({ ...p, fat_g: e.target.value }))}
                      placeholder="Vet (g)"
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-yellow-500" />
                  </div>
                  <button onClick={addMeal} disabled={saving || !form.name}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm">
                    {saving ? 'Toevoegen...' : 'Toevoegen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portion Size Modal */}
      {showPortionModal && selectedSearchItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPortionModal(false) }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
            <h3 className="text-white font-bold text-lg mb-4">Portiegrootte</h3>
            <div className="space-y-3 mb-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-sm font-medium">{selectedSearchItem.name}</p>
                  {selectedSearchItem.image && (
                    <img src={selectedSearchItem.image} alt={selectedSearchItem.name} className="w-12 h-12 rounded-lg object-cover" />
                  )}
                </div>
                <p className="text-zinc-600 text-xs mb-3">{selectedSearchItem.brand}</p>

                <label className="text-zinc-400 text-xs font-bold mb-2 block">Gram per portie</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="9999"
                    value={portionSize}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 9999)) {
                        setPortionSize(val)
                      }
                    }}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-zinc-500 text-xs font-bold">g</span>
                </div>

                {/* Macro preview */}
                <div className="mt-4 p-3 bg-zinc-800 rounded-xl">
                  <p className="text-zinc-500 text-xs font-bold mb-2">Per portie ({portionSize}g):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {selectedSearchItem.calories != null && (
                      <div>
                        <span className="text-zinc-600">Calorieën:</span>
                        <p className="text-white font-bold">{Math.round((selectedSearchItem.calories / 100) * parseInt(portionSize))} kcal</p>
                      </div>
                    )}
                    {selectedSearchItem.protein_g != null && (
                      <div>
                        <span className="text-blue-400/60">Eiwit:</span>
                        <p className="text-white font-bold">{Math.round((selectedSearchItem.protein_g / 100) * parseInt(portionSize) * 10) / 10}g</p>
                      </div>
                    )}
                    {selectedSearchItem.carbs_g != null && (
                      <div>
                        <span className="text-orange-400/60">Koolhydraten:</span>
                        <p className="text-white font-bold">{Math.round((selectedSearchItem.carbs_g / 100) * parseInt(portionSize) * 10) / 10}g</p>
                      </div>
                    )}
                    {selectedSearchItem.fat_g != null && (
                      <div>
                        <span className="text-yellow-400/60">Vet:</span>
                        <p className="text-white font-bold">{Math.round((selectedSearchItem.fat_g / 100) * parseInt(portionSize) * 10) / 10}g</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPortionModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl transition text-sm">
                Annuleren
              </button>
              <button onClick={() => addSearchItem(selectedSearchItem)} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition text-sm">
                {saving ? 'Toevoegen...' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTargetModal(false) }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
            <h3 className="text-white font-bold text-lg mb-4">Dagelijkse doelen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-xs font-bold mb-1 block">Calorieën (kcal)</label>
                <input type="number" inputMode="numeric" value={targets.calories}
                  onChange={e => setTargets(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-blue-400 text-xs font-bold mb-1 block">Eiwit (g)</label>
                <input type="number" inputMode="numeric" value={targets.protein_g}
                  onChange={e => setTargets(p => ({ ...p, protein_g: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-orange-400 text-xs font-bold mb-1 block">Koolhydraten (g)</label>
                <input type="number" inputMode="numeric" value={targets.carbs_g}
                  onChange={e => setTargets(p => ({ ...p, carbs_g: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-yellow-400 text-xs font-bold mb-1 block">Vet (g)</label>
                <input type="number" inputMode="numeric" value={targets.fat_g}
                  onChange={e => setTargets(p => ({ ...p, fat_g: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl transition text-sm">
                  Annuleren
                </button>
                <button onClick={saveTargets} disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition text-sm">
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
