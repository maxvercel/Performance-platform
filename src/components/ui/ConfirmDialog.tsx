'use client'

import { Button } from '@/components/ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full">
          <h2 className="text-white font-bold text-lg mb-2">{title}</h2>
          <p className="text-zinc-400 text-sm mb-6">{description}</p>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onCancel}
              fullWidth
            >
              {cancelText}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              fullWidth
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
