/**
 * Shared loading spinner — replaces the repeated spinner pattern.
 */
'use client'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${sizeMap[size]} border-orange-500 border-t-transparent rounded-full animate-spin ${className}`}
    />
  )
}

/** Full-page centered spinner used as page loading state */
export function PageSpinner() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Spinner size="md" />
    </div>
  )
}
