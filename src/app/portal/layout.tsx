'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [isCoach, setIsCoach] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role === 'coach' || data?.role === 'admin') setIsCoach(true)
        })
    })
  }, [])

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
    { href: '/portal/habits', label: 'Habits', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    )},
    { href: '/portal/progress', label: 'Progress', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )},
  ]

  const coachTab = { href: '/portal/coach', label: 'Coach', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )}

  const visibleTabs = isCoach ? [...tabs, coachTab] : tabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {visibleTabs.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all">
              <span className={active ? 'text-orange-500' : 'text-zinc-500'}>
                {icon}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-orange-500' : 'text-zinc-600'}`}>
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
    <div className="bg-zinc-950 min-h-screen">
      {children}
      <BottomNav />
    </div>
  )
}