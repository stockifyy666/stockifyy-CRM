'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Image as ImageIcon, Eye, Pencil, Trash2 } from 'lucide-react'
import type { Customer, Profile } from '@/lib/types'
import { subStatus, SUB_TYPES } from '@/lib/types'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const canDelete = profile.role === 'admin'

  const filtered = useMemo(() => customers.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q)
    const matchT = !filterType || c.subscription_type === filterType
    const matchS = !filterStatus || subStatus(c.subscription_end) === filterStatus
    return matchQ && matchT && matchS
  }), [customers, search, filterType, filterStatus])

  async function handleSave(data: Partial<Customer>, screenshotFile: File | null) {
    let screenshot_url = data.screenshot_url ?? null
    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-screenshots').upload(path, screenshotFile)
      if (upErr) { showToast('Screenshot upload failed', 'error'); return }
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path)
      screenshot_url = urlData.publicUrl
    }
    if (editCustomer) {
      const { data: updated, error } = await supabase
        .from('customers')
        .update({ ...data, screenshot_url, updated_by: profile.id, updated_at: new Date().toISOString() })
        .eq('id', editCustomer.id).select('*').single()
      if (error) { showToast('Update failed', 'error'); return }
      const existing = customers.find(c => c.id === editCustomer.id)
      setCustomers(prev => prev.map(c => c.id === editCustomer.id ? { ...updated, added_by_profile: (existing as any)?.added_by_profile } : c))
      showToast('Customer updated', 'success')
    } else {
      const { data: created, error } = await supabase
        .from('customers').insert({ ...data, screenshot_url, added_by: profile.id }).select('*').single()
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
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Search by name or mobile…" value={search} onChange={e => setSearch(e.target.value)}
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
                    <div className="font-semibold text-foreground">{c.name}</div>
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
                    <button onClick={() => setLightbox(c.screenshot_url!)} className="flex-shrink-0">
                      <img src={c.screenshot_url} className="w-8 h-8 object-cover rounded-lg border border-border" alt="screenshot" />
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
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
                {['#', 'Customer', 'Mobile', 'Type', 'Amount', 'Start', 'End', 'Status', 'Screenshot', 'Actions'].map(h => (
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
                      <div className="font-semibold text-foreground text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{fmt(c.created_at)}</div>
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
                      <div className="flex items-center gap-1">
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

      {modalOpen && <CustomerModal customer={editCustomer} onClose={() => { setModalOpen(false); setEditCustomer(null) }} onSave={handleSave} />}
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
    </div>
  )
}
