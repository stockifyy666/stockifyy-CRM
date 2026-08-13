'use client'

interface Props {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
