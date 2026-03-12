/**
 * Shared page header — replaces the repeated header pattern across all pages.
 */
'use client'

interface PageHeaderProps {
  /** Small label above the title (e.g. "Dagelijkse habits") */
  label?: string
  /** Main page title */
  title: string
  /** Subtitle text below the title */
  subtitle?: string
  /** Optional right-side content */
  rightContent?: React.ReactNode
  /** Optional children rendered below the header text */
  children?: React.ReactNode
}

export function PageHeader({
  label,
  title,
  subtitle,
  rightContent,
  children,
}: PageHeaderProps) {
  return (
    <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
      {label && (
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">
          {label}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-black">{title}</h1>
        {rightContent}
      </div>
      {subtitle && (
        <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>
      )}
      {children}
    </div>
  )
}
