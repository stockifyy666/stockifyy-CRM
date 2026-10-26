'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, X, BookOpen, Trash2, Pencil, Search, Upload, Eye, Image as ImageIcon, XCircle, CreditCard, Download } from 'lucide-react'
import DateRangeFilter, { type DateRange, isInRange } from '@/components/DateRangeFilter'
import type { Profile, TechnicalCourseClient as TC, TechnicalInstallment } from '@/lib/types'
import { fmtMoney, fmtDate, parseScreenshots } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Toast, { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const INPUT = 'w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground transition-colors'

const todayDate = new Date().toISOString().slice(0, 10)
const EMPTY = { name: '', client_code: '', mobile: '', amount: '', installments: '', adding_date: todayDate, notes: '' }

export default function TechnicalCourseClient({ clients: initial, profile }: { clients: TC[]; profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast, showToast } = useToast()
  const [clients, setClients] = useState<TC[]>(initial)
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(null)

  const months = Array.from({ length: 12 }, (_, i) => {
    const y = new Date().getFullYear()
    return `${y}-${String(i + 1).padStart(2, '0')}`
  })

  // ── Add/Edit modal ──
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TC | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [keptUrls, setKeptUrls]       = useState<string[]>([])
  const [newFiles, setNewFiles]       = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── View detail modal ──
  const [viewClient, setViewClient] = useState<TC | null>(null)
  const [installments, setInstallments] = useState<TechnicalInstallment[]>([])
  const [loadingInst, setLoadingInst] = useState(false)

  // ── Add installment payment modal ──
  const [instModal, setInstModal] = useState<TC | null>(null)
  const [instForm, setInstForm] = useState({ installment_no: '', amount: '', paid_date: todayDate, notes: '' })
  const [instFile, setInstFile] = useState<File | null>(null)
  const [instPreview, setInstPreview] = useState<string | null>(null)
  const [instDragging, setInstDragging] = useState(false)
  const [instSaving, setInstSaving] = useState(false)
  const instFileRef = useRef<HTMLInputElement>(null)

  async function exportExcel(data: TC[], label: string) {
    const { utils, writeFile } = await import('xlsx')
    const rows = [...data].reverse().map((c, i) => ({
      '#': i + 1,
      'Name': c.name,
      'Client Code': c.client_code ?? '—',
      'Mobile': c.mobile,
      'Subscription Type': c.subscription_type,
      'Amount (Rs)': c.amount,
      'Installments': c.installments ?? 0,
      'Payment Date': c.adding_date ?? c.created_at?.slice(0, 10) ?? '—',
      'Notes': c.notes ?? '',
    }))
    const ws = utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
      { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, label.slice(0, 31))
    writeFile(wb, `technical-course-${label.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
  }

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const canDelete = profile.role === 'admin'

  // ── Filter: use adding_date if set, else created_at ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients.filter(c => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q) || (c.client_code ?? '').toLowerCase().includes(q)
      const dateField = c.adding_date ?? c.created_at
      const matchD = filterMonth ? dateField?.slice(0, 7) === filterMonth : isInRange(dateField, dateRange)
      return matchQ && matchD
    })
  }, [clients, search, filterMonth, dateRange])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function handleScreenshotFiles(fileList: FileList | null) {
    if (!fileList) return
    Array.from(fileList).forEach(f => {
      if (!f.type.startsWith('image/') || f.size > 5 * 1024 * 1024) return
      setNewFiles(prev => [...prev, f])
      const reader = new FileReader()
      reader.onload = e => setNewPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }
  function removeKept(url: string) { setKeptUrls(prev => prev.filter(u => u !== url)) }
  function removeNew(idx: number) {
    setNewFiles(prev => prev.filter((_, i) => i !== idx))
    setNewPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY, adding_date: new Date().toISOString().slice(0, 10) })
    setKeptUrls([]); setNewFiles([]); setNewPreviews([])
    setOpen(true)
  }
  function openEdit(c: TC) {
    setEditing(c)
    setForm({
      name: c.name, client_code: c.client_code ?? '', mobile: c.mobile,
      amount: String(c.amount),
      installments: c.installments != null ? String(c.installments) : '',
      adding_date: c.adding_date ?? c.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      notes: c.notes ?? '',
    })
    setKeptUrls(parseScreenshots(c.screenshot_url)); setNewFiles([]); setNewPreviews([])
    setOpen(true)
  }

  async function openView(c: TC) {
    setViewClient(c)
    setLoadingInst(true)
    const { data } = await supabase
      .from('technical_installments')
      .select('*')
      .eq('client_id', c.id)
      .order('installment_no')
    setInstallments(data ?? [])
    setLoadingInst(false)
  }

  function openInstModal(c: TC) {
    setInstModal(c)
    const nextNo = (c.installments ?? 1)
    setInstForm({ installment_no: String(nextNo), amount: '', paid_date: new Date().toISOString().slice(0, 10), notes: '' })
    setInstFile(null); setInstPreview(null)
  }

  function handleInstFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return
    setInstFile(f)
    const reader = new FileReader()
    reader.onload = e => setInstPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleInstSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!instModal) return
    setInstSaving(true)
    let screenshot_url: string | null = null
    if (instFile) {
      const ext = instFile.name.split('.').pop()
      const path = `inst-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, instFile)
      if (upErr) { showToast('Screenshot upload failed', 'error'); setInstSaving(false); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      screenshot_url = urlData.publicUrl
    }
    const { data, error } = await supabase.from('technical_installments').insert({
      client_id: instModal.id,
      installment_no: parseInt(instForm.installment_no),
      amount: parseFloat(instForm.amount),
      paid_date: instForm.paid_date,
      notes: instForm.notes.trim() || null,
      screenshot_url,
      added_by: profile.id,
    }).select('*').single()
    if (error) { showToast('Failed to save installment', 'error'); setInstSaving(false); return }
    showToast('Installment payment recorded', 'success')
    setInstSaving(false)
    setInstModal(null)
    // refresh installments if view modal is open for same client
    if (viewClient?.id === instModal.id) {
      setInstallments(prev => [...prev, data].sort((a, b) => a.installment_no - b.installment_no))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const newUrls: string[] = []
    for (const f of newFiles) {
      const ext = f.name.split('.').pop()
      const path = `tc-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, f)
      if (upErr) { showToast('Screenshot upload failed', 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      newUrls.push(urlData.publicUrl)
    }
    const allUrls = [...keptUrls, ...newUrls]
    const screenshot_url = allUrls.length === 0 ? null
      : allUrls.length === 1 ? allUrls[0]
      : JSON.stringify(allUrls)
    const payload = {
      name: form.name.trim(),
      client_code: form.client_code.trim() || null,
      mobile: form.mobile.trim(),
      amount: parseFloat(form.amount),
      installments: form.installments !== '' ? parseInt(form.installments) : null,
      adding_date: form.adding_date || null,
      notes: form.notes.trim() || null,
      screenshot_url,
    }
    if (editing) {
      const { data, error } = await supabase.from('technical_course_clients').update(payload).eq('id', editing.id).select('*').single()
      if (error) { showToast('Update failed', 'error'); setSaving(false); return }
      setClients(prev => prev.map(c => c.id === editing.id ? { ...data, added_by_profile: (c as any).added_by_profile } : c))
      showToast('Client updated', 'success')
    } else {
      const { data, error } = await supabase.from('technical_course_clients').insert({ ...payload, added_by: profile.id }).select('*').single()
      if (error) { showToast('Failed to add client', 'error'); setSaving(false); return }
      setClients(prev => [{ ...data, added_by_profile: { name: profile.name, role: profile.role } }, ...prev])
      showToast('Client added', 'success')
    }
    setSaving(false); setOpen(false); router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('technical_course_clients').delete().eq('id', id)
    if (error) { showToast('Delete failed', 'error'); return }
    setClients(prev => prev.filter(c => c.id !== id))
    showToast('Client removed', 'success')
  }

  return (
    <div>
      <Toast {...toast} />

      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Technical Course</h1>
            <p className="text-sm text-muted-foreground">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => exportExcel(filtered, filtered.length === clients.length ? 'All Clients' : 'Filtered')}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
            <Download size={15} /> <span className="hidden sm:inline">Download</span>
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors shadow-sm">
            <Plus size={15} /> <span className="hidden sm:inline">Add Client</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <DateRangeFilter
        value={filterMonth ? null : dateRange}
        onChange={r => { setFilterMonth(''); setDateRange(r) }}
        label="Filter by payment date:"
      />
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
          {search ? 'No clients match your search.' : 'No technical course clients yet.'}
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-foreground">{c.name}</div>
                  {c.client_code && <div className="text-xs font-mono text-primary">{c.client_code}</div>}
                  <div className="text-sm text-muted-foreground">{c.mobile}</div>
                  {c.adding_date && <div className="text-xs text-muted-foreground">{fmtDate(c.adding_date)}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-foreground tabular-nums">{fmtMoney(c.amount)}</div>
                  {c.installments != null && <div className="text-xs text-muted-foreground">{c.installments} installments</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {(() => {
                  const urls = parseScreenshots(c.screenshot_url)
                  return urls.length > 0
                    ? <button onClick={() => setLightbox(urls[0])} className="relative flex-shrink-0">
                        <img src={urls[0]} className="w-8 h-8 object-cover rounded-lg border border-border" alt="screenshot" />
                        {urls.length > 1 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">+{urls.length - 1}</span>}
                      </button>
                    : null
                })()}
                <div className="flex gap-1.5 ml-auto flex-wrap justify-end">
                  <button onClick={() => openView(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors"><Eye size={12} /> View</button>
                  {c.installments != null && c.installments > 0 && (
                    <button onClick={() => openInstModal(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg hover:bg-amber-100 transition-colors"><CreditCard size={12} /> Pay</button>
                  )}
                  <button onClick={() => openEdit(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors"><Pencil size={12} /> Edit</button>
                  {canDelete && <button onClick={() => setConfirmId(c.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"><Trash2 size={12} /></button>}
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
                {['#', 'Name', 'Client Code', 'Mobile', 'Payment Date', 'Amount', 'Installments', 'Screenshot', 'Added By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{i + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-semibold text-foreground text-sm">{c.name}</div>
                    {c.notes && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{c.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-foreground whitespace-nowrap">{c.client_code ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.adding_date ? fmtDate(c.adding_date) : fmtDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{fmtMoney(c.amount)}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.installments != null ? c.installments : '—'}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const urls = parseScreenshots(c.screenshot_url)
                      return urls.length > 0
                        ? <button onClick={() => setLightbox(urls[0])} className="hover:opacity-75 transition-opacity relative">
                            <img src={urls[0]} className="w-9 h-9 object-cover rounded-lg border border-border" alt="screenshot" />
                            {urls.length > 1 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">+{urls.length - 1}</span>}
                          </button>
                        : <span className="text-muted-foreground/30"><ImageIcon size={18} /></span>
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{(c as any).added_by_profile?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(c)} className="px-2 py-1 text-xs font-semibold text-foreground border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1"><Eye size={11} /> View</button>
                      {c.installments != null && c.installments > 0 && (
                        <button onClick={() => openInstModal(c)} className="px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-md hover:bg-amber-100 transition-colors flex items-center gap-1"><CreditCard size={11} /> Pay</button>
                      )}
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

      {/* Add/Edit Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mt-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{editing ? 'Edit Client' : 'Add Technical Course Client'}</h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Full Name" required><input className={INPUT} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Client full name" required /></F>
              <F label="Client Code"><input className={INPUT} value={form.client_code} onChange={e => set('client_code', e.target.value)} placeholder="e.g. TC-001 (optional)" /></F>
              <F label="Mobile Number" required><input className={INPUT} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+92 XXXXXXXXXX" required /></F>
              <F label="Payment Date" required>
                <input className={INPUT} type="date" value={form.adding_date} onChange={e => set('adding_date', e.target.value)} required />
              </F>
              <F label="Payment Amount (Rs)" required><input className={INPUT} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required /></F>
              <F label="No. of Installments">
                <select className={INPUT} value={form.installments} onChange={e => set('installments', e.target.value)}>
                  <option value="">None / Full payment</option>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} installment{n > 1 ? 's' : ''}</option>)}
                </select>
              </F>
              <F label="Notes" className="sm:col-span-2"><textarea className={INPUT} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" /></F>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Payment Screenshots
                  {(keptUrls.length + newPreviews.length) > 0 && (
                    <span className="ml-2 text-primary normal-case font-normal">{keptUrls.length + newPreviews.length} attached</span>
                  )}
                </label>
                {(keptUrls.length > 0 || newPreviews.length > 0) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {keptUrls.map((url, i) => (
                      <div key={`kept-${i}`} className="relative group aspect-square">
                        <img src={url} className="w-full h-full object-cover rounded-lg border border-border" alt={`screenshot ${i + 1}`} />
                        <button type="button" onClick={() => removeKept(url)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><XCircle size={14} /></button>
                      </div>
                    ))}
                    {newPreviews.map((src, i) => (
                      <div key={`new-${i}`} className="relative group aspect-square">
                        <img src={src} className="w-full h-full object-cover rounded-lg border border-primary/40" alt={`new ${i + 1}`} />
                        <div className="absolute inset-0 flex items-end p-1 pointer-events-none"><span className="text-[9px] bg-primary/80 text-white px-1 py-0.5 rounded">New</span></div>
                        <button type="button" onClick={() => removeNew(i)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><XCircle size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleScreenshotFiles(e.dataTransfer.files) }}
                >
                  <Upload size={20} className="mx-auto text-muted-foreground/40 mb-1.5" />
                  <p className="text-sm text-muted-foreground">
                    {keptUrls.length + newPreviews.length > 0 ? 'Add more screenshots' : 'Click to upload or drag & drop'}
                    <br /><span className="text-primary font-semibold">PNG, JPG, WEBP</span> · up to 5 MB each · multiple allowed
                  </p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { handleScreenshotFiles(e.target.files); e.target.value = '' }} />
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

      {/* Add Installment Payment Modal */}
      {instModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mt-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Record Installment Payment</h2>
                <p className="text-sm text-muted-foreground">{instModal.name}</p>
              </div>
              <button onClick={() => setInstModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <form onSubmit={handleInstSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Installment #" required>
                <select className={INPUT} value={instForm.installment_no} onChange={e => setInstForm(f => ({ ...f, installment_no: e.target.value }))} required>
                  <option value="">Select…</option>
                  {Array.from({ length: instModal.installments ?? 1 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Installment {n}</option>
                  ))}
                </select>
              </F>
              <F label="Payment Date" required>
                <input className={INPUT} type="date" value={instForm.paid_date} onChange={e => setInstForm(f => ({ ...f, paid_date: e.target.value }))} required />
              </F>
              <F label="Amount (Rs)" required>
                <input className={INPUT} type="number" min="0" step="0.01" value={instForm.amount} onChange={e => setInstForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
              </F>
              <F label="Notes">
                <input className={INPUT} value={instForm.notes} onChange={e => setInstForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </F>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Screenshot</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${instDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => instFileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setInstDragging(true) }}
                  onDragLeave={() => setInstDragging(false)}
                  onDrop={e => { e.preventDefault(); setInstDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleInstFile(f) }}
                >
                  {instPreview
                    ? <img src={instPreview} className="max-h-32 max-w-full mx-auto rounded-lg border border-border object-contain" alt="preview" />
                    : <><Upload size={20} className="mx-auto text-muted-foreground/40 mb-1.5" /><p className="text-sm text-muted-foreground">Click or drag & drop<br /><span className="text-primary font-semibold">PNG, JPG, WEBP</span> up to 5MB</p></>}
                </div>
                <input ref={instFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleInstFile(f) }} />
                {instPreview && <button type="button" className="mt-1 text-xs text-destructive" onClick={() => { setInstFile(null); setInstPreview(null) }}>Remove</button>}
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setInstModal(null)} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={instSaving} className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                  {instSaving ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmId && <ConfirmDialog title="Remove client?" message="This will permanently delete this client." onConfirm={() => { handleDelete(confirmId); setConfirmId(null) }} onCancel={() => setConfirmId(null)} />}

      {/* View Detail Modal */}
      {viewClient && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto" onClick={() => setViewClient(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mt-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground tracking-tight">Client Details</h2>
              <button onClick={() => setViewClient(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"><X size={15} /></button>
            </div>
            <div className="p-6 space-y-4">
              <Row label="Full Name" value={viewClient.name} />
              <Row label="Client Code" value={viewClient.client_code ?? '—'} />
              <Row label="Mobile" value={viewClient.mobile} />
              <Row label="Payment Date" value={viewClient.adding_date ? fmtDate(viewClient.adding_date) : fmtDate(viewClient.created_at)} />
              <Row label="Amount" value={fmtMoney(viewClient.amount)} />
              <Row label="Installments" value={viewClient.installments != null ? String(viewClient.installments) : '—'} />
              {viewClient.notes && <Row label="Notes" value={viewClient.notes} />}

              {/* Installment payment history */}
              {viewClient.installments != null && viewClient.installments > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Installment Payments</p>
                    <button onClick={() => { setViewClient(null); openInstModal(viewClient) }} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg hover:bg-amber-100 transition-colors">
                      <Plus size={11} /> Add Payment
                    </button>
                  </div>
                  {loadingInst ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : installments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No installment payments recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {installments.map(inst => (
                        <div key={inst.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400">{inst.installment_no}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground">{fmtMoney(inst.amount)}</div>
                            <div className="text-xs text-muted-foreground">{fmtDate(inst.paid_date)}{inst.notes ? ` · ${inst.notes}` : ''}</div>
                          </div>
                          {inst.screenshot_url && (
                            <button onClick={() => setLightbox(inst.screenshot_url!)} className="flex-shrink-0">
                              <img src={inst.screenshot_url} className="w-8 h-8 object-cover rounded-lg border border-border" alt="receipt" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const urls = parseScreenshots(viewClient.screenshot_url)
                return urls.length > 0 ? (
                  <div className="border-t border-border pt-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Screenshots</p>
                    <div className="grid grid-cols-3 gap-2">
                      {urls.map((url, i) => (
                        <img key={i} src={url} className="aspect-square w-full object-cover rounded-lg border border-border cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightbox(url)} alt={`screenshot ${i + 1}`} />
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/20 rounded-b-xl">
              <button onClick={() => { setViewClient(null); openEdit(viewClient) }} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"><Pencil size={13} /> Edit</button>
              <button onClick={() => setViewClient(null)} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl">✕</button>
          <img src={lightbox} className="max-w-full max-h-[90vh] rounded-lg" alt="screenshot" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
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
