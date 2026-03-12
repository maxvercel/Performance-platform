/**
 * Error boundary — catches React render errors and shows a fallback UI
 * instead of a white screen. Wraps the portal layout.
 */
'use client'

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service in production
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-white text-xl font-black mb-2">
              Er ging iets mis
            </h1>
            <p className="text-zinc-500 text-sm mb-6">
              {this.state.error?.message || 'Er is een onverwachte fout opgetreden.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold
                         px-6 py-3 rounded-2xl text-sm transition"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
