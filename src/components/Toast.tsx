'use client'

import { useState, useCallback } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

interface ToastState { message: string; type: 'success' | 'error'; visible: boolean }

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false })
  let timer: ReturnType<typeof setTimeout>

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer)
    setToast({ message, type, visible: true })
    timer = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }, [])

  return { toast, showToast }
}

export default function Toast({ message, type, visible }: ToastState) {
  if (!visible) return null
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium transition-all ${type === 'success' ? 'bg-[#0C2340]' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={15} className="text-[#00C07F]" /> : <XCircle size={15} />}
      {message}
    </div>
  )
}
