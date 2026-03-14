'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-[fadeInDown_0.2s_ease-out] pointer-events-auto ${
                t.type === 'success' ? 'bg-green-500 text-white' :
                t.type === 'error' ? 'bg-red-500 text-white' :
                'bg-zinc-800 text-white border border-zinc-700'
              }`}
            >
              {t.type === 'success' && '✓ '}
              {t.type === 'error' && '✕ '}
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
