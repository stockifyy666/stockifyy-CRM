'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, Image as ImageIcon, Eye, Pencil, Trash2, RefreshCw, Upload, X } from 'lucide-react'
import type { Customer, Profile } from '@/lib/types'
import { subStatus, SUB_TYPES } from '@/lib/types'
import DateRangeFilter, { type DateRange, isInRange } from '@/components/DateRangeFilter'
import { fmtMoney, fmt } from '@/lib/utils'
import CustomerModal from '@/components/CustomerModal'
import CustomerDetail from '@/components/CustomerDetail'
import ConfirmDialog from '@/components/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Toast, { useToast } from '@/components/Toast'

const TYPE_PILL: Record<string, string> = {
  'Swing with Stockifyy':      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Trade with Stockifyy':      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Invest with Stockifyy':     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Portfolio Designing':       'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'One on One Advisory':       'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'Technical Analysis Course': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}
const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  expiring: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  expired: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
}
const STATUS_LABEL: Record<string, string> = { active: 'Active', expiring: 'Expiring Soon', expired: 'Expired' }

export default function CustomersClient({ customers: initial, profile }: { customers: Customer[]; profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast, showToast } = useToast()

  const [customers, setCustomers] = useState<Customer[]>(initial)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(null)

  const months = Array.from({ length: 12 }, (_, i) => {
    const y = new Date().getFullYear()
    return `${y}-${String(i + 1).padStart(2, '0')}`
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [renewCustomer, setRenewCustomer] = useState<Customer | null>(null)
  const [renewForm, setRenewForm] = useState({ subscription_start: '', subscription_end: '', amount: '' })
  const [renewFile, setRenewFile] = useState<File | null>(null)
  const [renewPreview, setRenewPreview] = useState<string | null>(null)
  const [renewSaving, setRenewSaving] = useState(false)
  const [renewDragging, setRenewDragging] = useState(false)
  const renewFileRef = useRef<HTMLInputElement>(null)

  const canDelete = profile.role === 'admin'

  function openRenew(c: Customer) {
    const now = new Date()
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    const end1m = new Date(now); end1m.setMonth(end1m.getMonth() + 1)
    const localEnd = new Date(end1m.getTime() - end1m.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setRenewCustomer(c)
    setRenewForm({ subscription_start: localNow, subscription_end: localEnd, amount: String(c.amount) })
    setRenewFile(null); setRenewPreview(null)
  }

  function handleRenewFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return
    setRenewFile(f)
    const reader = new FileReader()
    reader.onload = e => setRenewPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault()
    if (!renewCustomer) return
    setRenewSaving(true)
    let screenshot_url = renewCustomer.screenshot_url ?? null
    if (renewFile) {
      const ext = renewFile.name.split('.').pop()
      const path = `renew-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, renewFile)
      if (upErr) { showToast('Screenshot upload failed', 'error'); setRenewSaving(false); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      screenshot_url = urlData.publicUrl
    }
    const payload = {
      subscription_start: new Date(renewForm.subscription_start).toISOString(),
      subscription_end: new Date(renewForm.subscription_end).toISOString(),
      amount: parseFloat(renewForm.amount),
      screenshot_url,
      is_renewed: true,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }
    const { data: updated, error } = await supabase.from('customers').update(payload).eq('id', renewCustomer.id).select('*').single()
    if (error) { showToast('Renewal failed', 'error'); setRenewSaving(false); return }
    const existing = customers.find(c => c.id === renewCustomer.id)
    setCustomers(prev => prev.map(c => c.id === renewCustomer.id ? { ...updated, added_by_profile: (existing as any)?.added_by_profile } : c))
    showToast('Subscription renewed!', 'success')
    setRenewSaving(false); setRenewCustomer(null); router.refresh()
  }

  function isRenewed(c: Customer) {
    return c.is_renewed === true
  }

  const filtered = useMemo(() => customers.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q) || (c.client_code ?? '').toLowerCase().includes(q)
    const matchT = !filterType || c.subscription_type === filterType
    const matchS = !filterStatus || subStatus(c.subscription_end) === filterStatus
    const dateField = c.subscription_start ?? c.created_at
    const matchM = !filterMonth || dateField?.slice(0, 7) === filterMonth
    const matchD = !filterMonth && isInRange(dateField, dateRange)
    return matchQ && matchT && matchS && (filterMonth ? matchM : matchD)
  }), [customers, search, filterType, filterStatus, filterMonth, dateRange])

  async function handleSave(data: Partial<Customer>, screenshotFile: File | null, invoiceFile: File | null) {
    let screenshot_url = data.screenshot_url ?? null
    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, screenshotFile)
      if (upErr) { showToast('Screenshot upload failed', 'error'); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      screenshot_url = urlData.publicUrl
    }
    let invoice_url = data.invoice_url ?? null
    if (invoiceFile) {
      const ext = invoiceFile.name.split('.').pop()
      const path = `invoice-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, invoiceFile)
      if (upErr) { showToast('Invoice upload failed', 'error'); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      invoice_url = urlData.publicUrl
    }
    if (editCustomer) {
      const { data: updated, error } = await supabase
        .from('customers')
        .update({ ...data, screenshot_url, invoice_url, updated_by: profile.id, updated_at: new Date().toISOString() })
        .eq('id', editCustomer.id).select('*').single()
      if (error) { showToast('Update failed', 'error'); return }
      const existing = customers.find(c => c.id === editCustomer.id)
      setCustomers(prev => prev.map(c => c.id === editCustomer.id ? { ...updated, added_by_profile: (existing as any)?.added_by_profile } : c))
      showToast('Customer updated', 'success')
    } else {
      const { data: created, error } = await supabase
        .from('customers').insert({ ...data, screenshot_url, invoice_url, added_by: profile.id }).select('*').single()
      if (error) { showToast('Failed to add customer', 'error'); return }
      setCustomers(prev => [{ ...created, added_by_profile: { name: profile.name, role: profile.role } }, ...prev])
      showToast('Customer added', 'success')
    }
    setModalOpen(false); setEditCustomer(null); router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { showToast('Delete failed', 'error'); return }
    setCustomers(prev => prev.filter(c => c.id !== id))
    setDetailCustomer(null)
    showToast('Customer deleted', 'success')
    router.refresh()
  }

  function openAdd() { setEditCustomer(null); setModalOpen(true) }
  function openEdit(c: Customer) { setEditCustomer(c); setModalOpen(true) }

  return (
    <div>
      <Toast {...toast} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} total records</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0">
          <Plus size={15} /> <span className="hidden sm:inline">Add Customer</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Filters */}
      <DateRangeFilter
        value={filterMonth ? null : dateRange}
        onChange={r => { setFilterMonth(''); setDateRange(r) }}
        label="Filter by subscription start:"
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

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Search by name, mobile or client code…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-2">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg outline-none bg-card text-foreground">
            <option value="">All Types</option>
            {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg outline-none bg-card text-foreground">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground shadow-sm">No customers found</div>
      )}

      {/* ── MOBILE: card list ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map(c => {
            const st = subStatus(c.subscription_end)
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-foreground">{c.name}</div>
                      {isRenewed(c) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">Renewed</span>}
                    </div>
                    {c.client_code && <div className="text-xs font-mono text-primary">{c.client_code}</div>}
                    <div className="text-sm text-muted-foreground">{c.mobile}</div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_PILL[st]}`}>{STATUS_LABEL[st]}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm">
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Type</div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Amount</div>
                    <div className="font-bold text-foreground tabular-nums">{fmtMoney(c.amount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Start</div>
                    <div className="text-xs text-foreground">{fmt(c.subscription_start)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">End</div>
                    <div className="text-xs text-foreground">{fmt(c.subscription_end)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  {c.screenshot_url && (
                    <button onClick={() => setLightbox(c.screenshot_url!)} className="flex-shrink-0" title="Payment screenshot">
                      <img src={c.screenshot_url} className="w-8 h-8 object-cover rounded-lg border border-border" alt="screenshot" />
                    </button>
                  )}
                  {c.invoice_url && (
                    <button onClick={() => setLightbox(c.invoice_url!)} className="flex-shrink-0" title="Invoice">
                      <img src={c.invoice_url} className="w-8 h-8 object-cover rounded-lg border border-indigo-300 dark:border-indigo-700" alt="invoice" />
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto flex-wrap">
                    {(st === 'expiring' || st === 'expired') && (
                      <button onClick={() => openRenew(c)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                        <RefreshCw size={12} /> Renew
                      </button>
                    )}
                    <button onClick={() => setDetailCustomer(c)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                      <Eye size={12} /> View
                    </button>
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
              </div>
            )
          })}
        </div>
      )}

      {/* ── DESKTOP: table ── */}
      {filtered.length > 0 && (
        <div className="hidden md:block bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-muted/50">
                {['#', 'Customer', 'Mobile', 'Type', 'Amount', 'Start', 'End', 'Status', 'Screenshot', 'Invoice', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const st = subStatus(c.subscription_end)
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="font-semibold text-foreground text-sm">{c.name}</div>
                        {isRenewed(c) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">Renewed</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.client_code ?? fmt(c.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.mobile}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">{fmtMoney(c.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(c.subscription_start)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(c.subscription_end)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_PILL[st]}`}>{STATUS_LABEL[st]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.screenshot_url
                        ? <button onClick={() => setLightbox(c.screenshot_url!)} className="hover:opacity-75 transition-opacity">
                            <img src={c.screenshot_url} className="w-9 h-9 object-cover rounded-lg border border-border" alt="screenshot" />
                          </button>
                        : <span className="text-muted-foreground/30"><ImageIcon size={18} /></span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.invoice_url
                        ? <button onClick={() => setLightbox(c.invoice_url!)} className="hover:opacity-75 transition-opacity">
                            <img src={c.invoice_url} className="w-9 h-9 object-cover rounded-lg border border-border" alt="invoice" />
                          </button>
                        : <span className="text-muted-foreground/30"><ImageIcon size={18} /></span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(st === 'expiring' || st === 'expired') && (
                          <button onClick={() => openRenew(c)} className="px-2 py-1 text-xs font-bold text-white bg-amber-500 rounded-md hover:bg-amber-600 transition-colors flex items-center gap-1"><RefreshCw size={11} />Renew</button>
                        )}
                        <button onClick={() => setDetailCustomer(c)} className="px-2 py-1 text-xs font-semibold text-foreground border border-border rounded-md hover:bg-muted transition-colors">View</button>
                        <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs font-semibold text-foreground border border-border rounded-md hover:bg-muted transition-colors">Edit</button>
                        {canDelete && <button onClick={() => setConfirmId(c.id)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors">Del</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <CustomerModal customer={editCustomer} customers={customers} onClose={() => { setModalOpen(false); setEditCustomer(null) }} onSave={handleSave} />}
      {detailCustomer && (
        <CustomerDetail
          customer={customers.find(c => c.id === detailCustomer.id) ?? detailCustomer}
          profile={profile}
          onClose={() => setDetailCustomer(null)}
          onEdit={(c) => { setDetailCustomer(null); openEdit(c) }}
          onDelete={(id) => { setDetailCustomer(null); setConfirmId(id) }}
          showToast={showToast}
        />
      )}
      {confirmId && (
        <ConfirmDialog
          title="Delete customer?"
          message="This will permanently remove the customer and all their data. This cannot be undone."
          onConfirm={() => { handleDelete(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl">✕</button>
          <img src={lightbox} className="max-w-full max-h-[90vh] rounded-lg" alt="screenshot" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Renew Modal ── */}
      {renewCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mt-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Renew Subscription</h2>
                <p className="text-sm text-muted-foreground">{renewCustomer.name}</p>
              </div>
              <button onClick={() => setRenewCustomer(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <form onSubmit={handleRenew} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">New Start Date <span className="text-destructive">*</span></label>
                  <input type="datetime-local" required
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground"
                    value={renewForm.subscription_start}
                    onChange={e => setRenewForm(f => ({ ...f, subscription_start: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">New End Date <span className="text-destructive">*</span></label>
                  <input type="datetime-local" required
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground"
                    value={renewForm.subscription_end}
                    onChange={e => setRenewForm(f => ({ ...f, subscription_end: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Amount (Rs) <span className="text-destructive">*</span></label>
                <input type="number" min="0" step="0.01" required
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground"
                  value={renewForm.amount}
                  onChange={e => setRenewForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Screenshot</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${renewDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => renewFileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setRenewDragging(true) }}
                  onDragLeave={() => setRenewDragging(false)}
                  onDrop={e => { e.preventDefault(); setRenewDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleRenewFile(f) }}
                >
                  {renewPreview
                    ? <img src={renewPreview} className="max-h-36 max-w-full mx-auto rounded-lg border border-border object-contain" alt="preview" />
                    : <><Upload size={22} className="mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Click or drag & drop screenshot<br /><span className="text-primary font-semibold">PNG, JPG, WEBP</span> up to 5MB</p></>}
                </div>
                <input ref={renewFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRenewFile(f) }} />
                {renewPreview && <button type="button" className="mt-1.5 text-xs text-destructive" onClick={() => { setRenewFile(null); setRenewPreview(null) }}>Remove screenshot</button>}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setRenewCustomer(null)} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={renewSaving} className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg transition-colors shadow-sm">
                  <RefreshCw size={14} /> {renewSaving ? 'Renewing…' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
