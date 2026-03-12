'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAccentColor } from '@/hooks/useAccentColor'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { UserRole } from '@/types'

function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [isCoach, setIsCoach] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Initialize accent color on mount (replaces applyStoredAccent)
  useAccentColor()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          const role = data?.role as UserRole | undefined
          if (role === 'coach' || role === 'admin') setIsCoach(true)
          if (role === 'admin') setIsAdmin(true)
        })
    })
  }, [supabase])

  const tabs = [
    { href: '/portal/dashboard', label: 'Home', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )},
    { href: '/portal/workouts', label: 'Workouts', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M6 4v16M18 4v16M3 8h4M17 8h4M3 16h4M17 16h4"/>
      </svg>
    )},
    { href: '/portal/nutrition', label: 'Voeding', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    )},
    { href: '/portal/progress', label: 'Progress', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )},
    { href: '/portal/profile', label: 'Profiel', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )},
  ]

  const coachTab = { href: '/portal/coach', label: 'Coach', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )}

  const adminTab = { href: '/portal/admin', label: 'Admin', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
    </svg>
  )}

  const visibleTabs = isAdmin
    ? [...tabs, coachTab, adminTab]
    : isCoach
    ? [...tabs, coachTab]
    : tabs

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="navigation"
      aria-label="Hoofdnavigatie"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-1" style={{ height: '60px' }}>
        {visibleTabs.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all flex-1"
              aria-current={active ? 'page' : undefined}
              aria-label={label}
            >
              <span className={active ? 'text-orange-500' : 'text-zinc-500'}>
                {icon}
              </span>
              <span className={`text-[9px] font-medium ${active ? 'text-orange-500' : 'text-zinc-600'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <div className="bg-zinc-950 min-h-screen">
        {children}
        <BottomNav />
      </div>
    </ErrorBoundary>
  )
}
