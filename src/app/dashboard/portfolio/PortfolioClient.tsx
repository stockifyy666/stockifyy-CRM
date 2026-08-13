'use client'

import { useState } from 'react'
import { Plus, X, PieChart, Trash2, Pencil } from 'lucide-react'
import type { Profile, PortfolioClient as PC } from '@/lib/types'
import { fmtMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Toast, { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const INPUT = 'w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground transition-colors'

const EMPTY = { full_name: '', client_code: '', phone: '', duration: '', capital: '', notes: '' }

export default function PortfolioClient({ clients: initial, profile }: { clients: PC[]; profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast, showToast } = useToast()
  const [clients, setClients] = useState<PC[]>(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PC | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const canDelete = profile.role === 'admin'

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(c: PC) {
    setEditing(c)
    setForm({ full_name: c.full_name, client_code: c.client_code, phone: c.phone, duration: c.duration, capital: String(c.capital), notes: c.notes ?? '' })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name: form.full_name.trim(),
      client_code: form.client_code.trim(),
      phone: form.phone.trim(),
      duration: form.duration.trim(),
      capital: parseFloat(form.capital),
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

      {clients.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground shadow-sm">
          No portfolio clients yet. Click "Add Client" to get started.
        </div>
      )}

      {/* Mobile cards */}
      {clients.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          {clients.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-foreground">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.client_code}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-foreground tabular-nums">{fmtMoney(c.capital)}</div>
                  <div className="text-xs text-muted-foreground">{c.duration}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-3">{c.phone}</div>
              {c.notes && <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3">{c.notes}</div>}
              <div className="flex gap-2 pt-2 border-t border-border">
                <button onClick={() => openEdit(c)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                  <Pencil size={12} /> Edit
                </button>
                {canDelete && (
                  <button onClick={() => setConfirmId(c.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {clients.length > 0 && (
        <div className="hidden md:block bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-muted/50">
                {['#', 'Full Name', 'Client Code', 'Phone', 'Duration', 'Capital', 'Notes', 'Added By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.full_name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-foreground whitespace-nowrap">{c.client_code}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.duration}</td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{fmtMoney(c.capital)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] whitespace-nowrap">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{(c as any).added_by_profile?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs font-semibold text-foreground border border-border rounded-md hover:bg-muted transition-colors whitespace-nowrap">Edit</button>
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{editing ? 'Edit Client' : 'Add Portfolio Client'}</h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Full Name" required><input className={INPUT} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Client full name" required /></F>
              <F label="Client Code" required><input className={INPUT} value={form.client_code} onChange={e => set('client_code', e.target.value)} placeholder="e.g. PD-001" required /></F>
              <F label="Phone Number" required><input className={INPUT} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 XXXXXXXXXX" required /></F>
              <F label="Duration" required><input className={INPUT} value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 6 months" required /></F>
              <F label="Capital (Rs)" required><input className={INPUT} type="number" min="0" step="0.01" value={form.capital} onChange={e => set('capital', e.target.value)} placeholder="0.00" required /></F>
              <F label="Notes" className="sm:col-span-2"><textarea className={INPUT} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" /></F>
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

      {confirmId && (
        <ConfirmDialog
          title="Remove client?"
          message="This will permanently delete this portfolio client."
          onConfirm={() => { handleDelete(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
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
