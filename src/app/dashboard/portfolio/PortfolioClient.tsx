'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, X, PieChart, Trash2, Pencil, Search, Upload, Image as ImageIcon } from 'lucide-react'
import DateRangeFilter, { type DateRange, isInRange } from '@/components/DateRangeFilter'
import type { Profile, PortfolioClient as PC } from '@/lib/types'
import { fmtMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Toast, { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const INPUT = 'w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground transition-colors'
const EMPTY = { full_name: '', client_code: '', phone: '', duration: '', capital: '', amount: '', risk: '', notes: '' }

const RISK_OPTIONS = ['Low', 'Medium', 'High', 'Very High']

export default function PortfolioClient({ clients: initial, profile }: { clients: PC[]; profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast, showToast } = useToast()
  const [clients, setClients] = useState<PC[]>(initial)
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PC | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const canDelete = profile.role === 'admin'

  const months = Array.from({ length: 12 }, (_, i) => {
    const y = new Date().getFullYear()
    return `${y}-${String(i + 1).padStart(2, '0')}`
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients.filter(c => {
      const matchQ = !q || c.full_name.toLowerCase().includes(q) || c.phone.includes(q) || (c.client_code ?? '').toLowerCase().includes(q)
      const matchM = !filterMonth || c.created_at?.slice(0, 7) === filterMonth
      const matchD = !filterMonth && isInRange(c.created_at, dateRange)
      return matchQ && (filterMonth ? matchM : matchD)
    })
  }, [clients, search, filterMonth, dateRange])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  function openAdd() { setEditing(null); setForm(EMPTY); setFile(null); setPreview(null); setOpen(true) }
  function openEdit(c: PC) {
    setEditing(c)
    setForm({
      full_name: c.full_name, client_code: c.client_code ?? '', phone: c.phone,
      duration: c.duration, capital: String(c.capital),
      amount: c.amount != null ? String(c.amount) : '',
      risk: c.risk ?? '',
      notes: c.notes ?? '',
    })
    setFile(null); setPreview(c.screenshot_url)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let screenshot_url = editing?.screenshot_url ?? null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `portfolio-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, file)
      if (upErr) { showToast('Image upload failed', 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      screenshot_url = urlData.publicUrl
    } else if (!preview) {
      screenshot_url = null
    }
    const payload = {
      full_name: form.full_name.trim(),
      client_code: form.client_code.trim() || null,
      phone: form.phone.trim(),
      duration: form.duration.trim(),
      capital: parseFloat(form.capital),
      amount: form.amount ? parseFloat(form.amount) : null,
      risk: form.risk || null,
      screenshot_url,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('portfolio_clients').update(payload).eq('id', editing.id).select('*').single()
      if (error) { showToast('Update failed', 'error'); setSaving(false); return }
      setClients(prev => prev.map(c => c.id === editing.id ? { ...data, added_by_profile: (c as any).added_by_profile } : c))
      showToast('Client updated', 'success')
    } else {
      const { data, error } = await supabase.from('portfolio_clients').insert({ ...payload, added_by: profile.id }).select('*').single()
      if (error) { showToast('Failed to add client', 'error'); setSaving(false); return }
      setClients(prev => [{ ...data, added_by_profile: { name: profile.name, role: profile.role } }, ...prev])
      showToast('Client added', 'success')
    }
    setSaving(false); setOpen(false); router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolio_clients').delete().eq('id', id)
    if (error) { showToast('Delete failed', 'error'); return }
    setClients(prev => prev.filter(c => c.id !== id))
    showToast('Client removed', 'success')
  }

  return (
    <div>
      <Toast {...toast} />

      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <PieChart size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Portfolio Designing</h1>
            <p className="text-sm text-muted-foreground">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0">
          <Plus size={15} /> <span className="hidden sm:inline">Add Client</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <DateRangeFilter value={filterMonth ? null : dateRange} onChange={r => { setFilterMonth(''); setDateRange(r) }} label="Filter by date added:" />
      <div className="mb-4">
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setDateRange(null) }}
          className="w-full sm:w-56 px-3 py-2 text-sm border border-border rounded-lg outline-none bg-card text-foreground">
          <option value="">All Months</option>
          {months.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' })}</option>
          })}
        </select>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input type="text" placeholder="Search by name, phone or client code…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground" />
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground shadow-sm">
          {search ? 'No clients match your search.' : 'No portfolio clients yet.'}
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-foreground">{c.full_name}</div>
                  {c.client_code && <div className="text-xs font-mono text-primary">{c.client_code}</div>}
                  <div className="text-sm text-muted-foreground">{c.phone}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-foreground tabular-nums">{fmtMoney(c.capital)}</div>
                  {c.amount != null && <div className="text-xs text-muted-foreground">Paid: {fmtMoney(c.amount)}</div>}
                  <div className="text-xs text-muted-foreground">{c.duration}</div>
                  {c.risk && <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">Risk: {c.risk}</div>}
                </div>
              </div>
              {c.notes && <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3">{c.notes}</div>}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {c.screenshot_url && (
                  <button onClick={() => setLightbox(c.screenshot_url!)} className="flex-shrink-0">
                    <img src={c.screenshot_url} className="w-8 h-8 object-cover rounded-lg border border-border" alt="payment" />
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => openEdit(c)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors"><Pencil size={12} /> Edit</button>
                  {canDelete && <button onClick={() => setConfirmId(c.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"><Trash2 size={12} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden md:block bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-muted/50">
                {['#', 'Full Name', 'Client Code', 'Phone', 'Duration', 'Capital', 'Amount Paid', 'Risk', 'Payment', 'Notes', 'Added By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.full_name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-foreground whitespace-nowrap">{c.client_code ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.duration}</td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{fmtMoney(c.capital)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">{c.amount != null ? fmtMoney(c.amount) : '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.risk ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">{c.risk}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.screenshot_url
                      ? <button onClick={() => setLightbox(c.screenshot_url!)} className="hover:opacity-75 transition-opacity">
                          <img src={c.screenshot_url} className="w-9 h-9 object-cover rounded-lg border border-border" alt="payment" />
                        </button>
                      : <span className="text-muted-foreground/30"><ImageIcon size={18} /></span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{(c as any).added_by_profile?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs font-semibold text-foreground border border-border rounded-md hover:bg-muted transition-colors">Edit</button>
                      {canDelete && <button onClick={() => setConfirmId(c.id)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors">Del</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mt-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <h2 className="text-lg font-bold text-foreground">{editing ? 'Edit Client' : 'Add Portfolio Client'}</h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Full Name" required><input className={INPUT} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Client full name" required /></F>
              <F label="Client Code"><input className={INPUT} value={form.client_code} onChange={e => set('client_code', e.target.value)} placeholder="e.g. PD-001 (optional)" /></F>
              <F label="Phone Number" required><input className={INPUT} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 XXXXXXXXXX" required /></F>
              <F label="Duration" required><input className={INPUT} value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 6 months" required /></F>
              <F label="Capital (Rs)" required><input className={INPUT} type="number" min="0" step="0.01" value={form.capital} onChange={e => set('capital', e.target.value)} placeholder="0.00" required /></F>
              <F label="Amount Paid (Rs)"><input className={INPUT} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00 (optional)" /></F>
              <F label="Risk Level">
                <select className={INPUT} value={form.risk} onChange={e => set('risk', e.target.value)}>
                  <option value="">Select risk…</option>
                  {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </F>
              <F label="Notes" className="sm:col-span-2"><textarea className={INPUT} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" /></F>
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
                    : <><Upload size={24} className="mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Click to upload or drag & drop<br /><span className="text-primary font-semibold">PNG, JPG, WEBP</span> up to 5MB</p></>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                {preview && <button type="button" className="mt-1.5 text-xs text-destructive hover:text-destructive/80" onClick={() => { setFile(null); setPreview(null) }}>Remove image</button>}
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg transition-colors">
                  {saving ? 'Saving…' : editing ? 'Update' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmId && <ConfirmDialog title="Remove client?" message="This will permanently delete this portfolio client." onConfirm={() => { handleDelete(confirmId); setConfirmId(null) }} onCancel={() => setConfirmId(null)} />}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl">✕</button>
          <img src={lightbox} className="max-w-full max-h-[90vh] rounded-lg" alt="payment" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function F({ label, required, children, className = '' }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
