'use client'

import { useState } from 'react'
import { Shield, Plus, Trash2, X, Eye, EyeOff } from 'lucide-react'
import type { Profile, Role } from '@/lib/types'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast, { useToast } from '@/components/Toast'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  finance: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  support: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
}
const ROLE_ACCESS: Record<string, string> = {
  admin:   'Full access — view, add, edit, delete, comments, team',
  finance: 'View, edit, comments — no delete',
  support: 'Add, view, edit — no delete, no comments',
}

export default function TeamClient({ team: initial, currentUserId }: { team: Profile[]; currentUserId: string }) {
  const router = useRouter()
  const { toast, showToast } = useToast()
  const [team, setTeam] = useState<Profile[]>(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)
  const [changingRole, setChangingRole] = useState<{ member: Profile; role: Role } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'support' as Role })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Failed to create user', 'error'); setSaving(false); return }
    setTeam(prev => [...prev, data])
    setAddOpen(false)
    setForm({ name: '', email: '', password: '', role: 'support' })
    showToast(`${data.name} added successfully`, 'success')
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(member: Profile) {
    const res = await fetch('/api/team', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: member.id }) })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Delete failed', 'error'); return }
    setTeam(prev => prev.filter(m => m.id !== member.id))
    showToast(`${member.name} removed`, 'success')
    router.refresh()
  }

  async function handleRoleChange(member: Profile, newRole: Role) {
    const res = await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: member.id, role: newRole }) })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Role update failed', 'error'); return }
    setTeam(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
    showToast(`${member.name}'s role updated to ${newRole}`, 'success')
  }

  return (
    <div>
      <Toast {...toast} />

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground">Manage members and access</p>
          </div>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0">
          <Plus size={15} /> <span className="hidden sm:inline">Add Member</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {(['admin', 'finance', 'support'] as Role[]).map(role => (
          <div key={role} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${ROLE_BADGE[role]}`}>{role}</span>
            <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{ROLE_ACCESS[role]}</p>
            <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
              {team.filter(m => m.role === role).length} member{team.filter(m => m.role === role).length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Team Members ({team.length})</span>
        </div>

        {/* ── MOBILE: member cards ── */}
        <div className="md:hidden divide-y divide-border">
          {team.map(member => (
            <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                  {member.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">
                    {member.name}
                    {member.id === currentUserId && <span className="text-primary text-xs font-normal ml-1">(you)</span>}
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[member.role]}`}>{member.role}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {member.id !== currentUserId && (
                  <>
                    <select
                      value={member.role}
                      onChange={e => setChangingRole({ member, role: e.target.value as Role })}
                      className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground outline-none"
                    >
                      <option value="admin">admin</option>
                      <option value="finance">finance</option>
                      <option value="support">support</option>
                    </select>
                    <button onClick={() => setConfirmDelete(member)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: table ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-muted/50">
                {['Member', 'Role', 'Access', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map(member => (
                <tr key={member.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {member.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">{member.name}</div>
                        {member.id === currentUserId && <div className="text-[11px] text-primary font-semibold">You</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {member.id === currentUserId ? (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[member.role]}`}>{member.role}</span>
                    ) : (
                      <select value={member.role} onChange={e => setChangingRole({ member, role: e.target.value as Role })}
                        className="text-[11px] font-semibold border-0 outline-none cursor-pointer bg-transparent text-foreground">
                        <option value="admin">admin</option>
                        <option value="finance">finance</option>
                        <option value="support">support</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ROLE_ACCESS[member.role]}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(member.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {member.id !== currentUserId && (
                      <button onClick={() => setConfirmDelete(member)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Add Team Member</h2>
              <button onClick={() => setAddOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <Field label="Full Name" required>
                <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Team member's name" required />
              </Field>
              <Field label="Email Address" required>
                <input className={INPUT} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" required />
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <input className={INPUT + ' pr-10'} type={showPass ? 'text' : 'password'}
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters" minLength={6} required />
                  <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <Field label="Role" required>
                <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} required>
                  <option value="support">Support — Add & edit customers</option>
                  <option value="finance">Finance — View, edit & comment</option>
                  <option value="admin">Admin — Full access</option>
                </select>
              </Field>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg transition-colors">
                  {saving ? 'Creating…' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {changingRole && (
        <ConfirmDialog
          title={`Change role to ${changingRole.role}?`}
          message={`${changingRole.member.name} will be updated to ${changingRole.role}. ${ROLE_ACCESS[changingRole.role]}`}
          onConfirm={() => { handleRoleChange(changingRole.member, changingRole.role); setChangingRole(null) }}
          onCancel={() => setChangingRole(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Remove ${confirmDelete.name}?`}
          message="This will delete their account and remove all access. This cannot be undone."
          onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground transition-colors'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
