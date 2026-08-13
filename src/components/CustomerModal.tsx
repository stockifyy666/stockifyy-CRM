'use client'

import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import type { Customer } from '@/lib/types'
import { SUB_TYPES } from '@/lib/types'
import { toLocalInput } from '@/lib/utils'

interface Props {
  customer: Customer | null
  onClose: () => void
  onSave: (data: Partial<Customer>, file: File | null) => Promise<void>
}

export default function CustomerModal({ customer, onClose, onSave }: Props) {
  const isEdit = !!customer
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(customer?.screenshot_url ?? null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const end1m = new Date(now); end1m.setMonth(end1m.getMonth() + 1)
  const localEnd = new Date(end1m.getTime() - end1m.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [form, setForm] = useState({
    name: customer?.name ?? '',
    client_code: customer?.client_code ?? '',
    mobile: customer?.mobile ?? '',
    subscription_type: customer?.subscription_type ?? '',
    amount: customer?.amount?.toString() ?? '',

    subscription_start: toLocalInput(customer?.subscription_start) || localNow,
    subscription_end: toLocalInput(customer?.subscription_end) || localEnd,
    notes: customer?.notes ?? '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const isCourse = form.subscription_type === 'Technical Analysis Course'

  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.mobile || !form.subscription_type || !form.amount) return
    if (!isCourse && (!form.subscription_start || !form.subscription_end)) return
    setSaving(true)
    await onSave({
      name: form.name.trim(),
      client_code: form.client_code.trim() || null,
      mobile: form.mobile.trim(),
      subscription_type: form.subscription_type as any,
      amount: parseFloat(form.amount),

      subscription_start: isCourse ? null : new Date(form.subscription_start).toISOString(),
      subscription_end: isCourse ? null : new Date(form.subscription_end).toISOString(),
      notes: form.notes.trim() || null,
      screenshot_url: file ? undefined : (customer?.screenshot_url ?? null),
    }, file)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl relative mt-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground tracking-tight">{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <input className={INPUT} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Customer full name" required />
            </Field>
            <Field label="Client Code">
              <input className={INPUT} value={form.client_code} onChange={e => set('client_code', e.target.value)} placeholder="e.g. STK-001 (optional)" />
            </Field>
            <Field label="Mobile Number" required>
              <input className={INPUT} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+92 XXXXXXXXXX" required />
            </Field>
            <Field label="Subscription Type" required>
              <select className={INPUT} value={form.subscription_type} onChange={e => set('subscription_type', e.target.value)} required>
                <option value="">Select type…</option>
                {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Payment Amount (Rs)" required>
              <input className={INPUT} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required />
            </Field>


            {!isCourse && (
              <>
                <Field label="Subscription Start" required>
                  <input className={INPUT} type="datetime-local" value={form.subscription_start} onChange={e => set('subscription_start', e.target.value)} required />
                </Field>
                <Field label="Subscription End" required>
                  <input className={INPUT} type="datetime-local" value={form.subscription_end} onChange={e => set('subscription_end', e.target.value)} required />
                </Field>
              </>
            )}

            {isCourse && (
              <div className="sm:col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Technical Analysis Course — no subscription period required.</p>
              </div>
            )}

            <Field label="Notes" className="sm:col-span-2">
              <textarea className={INPUT} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any relevant notes…" />
            </Field>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Screenshot</label>
              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f) }}
              >
                {preview
                  ? <img src={preview} className="max-h-40 max-w-full mx-auto rounded-lg border border-border object-contain" alt="preview" />
                  : <><Upload size={24} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload or drag & drop<br /><span className="text-primary font-semibold">PNG, JPG, WEBP</span> up to 5MB</p></>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {preview && <button type="button" className="mt-1.5 text-xs text-destructive hover:text-destructive/80" onClick={() => { setFile(null); setPreview(null) }}>Remove screenshot</button>}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3 justify-end bg-muted/20 rounded-b-xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg transition-colors shadow-sm">
              {saving ? 'Saving…' : isEdit ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT = 'w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground transition-colors'

function Field({ label, required, children, className = '' }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
