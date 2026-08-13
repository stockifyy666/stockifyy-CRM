'use client'

import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import type { Customer, Profile, Comment } from '@/lib/types'
import { subStatus, SUB_TYPES } from '@/lib/types'
import { fmt, fmtMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

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

interface Props {
  customer: Customer
  profile: Profile
  onClose: () => void
  onEdit: (c: Customer) => void
  onDelete: (id: string) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export default function CustomerDetail({ customer: c, profile, onClose, onEdit, onDelete, showToast }: Props) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const st = subStatus(c.subscription_end)
  const canComment = profile.role === 'admin' || profile.role === 'finance'
  const canDelete = profile.role === 'admin'

  useEffect(() => {
    supabase
      .from('comments')
      .select('*, author:profiles(name, role)')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setComments(data ?? [])
      })
  }, [c.id])

  async function postComment() {
    if (!commentText.trim()) return
    setPosting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ customer_id: c.id, author_id: profile.id, text: commentText.trim() })
      .select('*, author:profiles(name, role)')
      .single()
    if (error) { showToast('Failed to add comment', 'error') }
    else { setComments(prev => [...prev, data]); setCommentText(''); showToast('Comment added', 'success') }
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl relative mt-4">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">{c.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">ID: {c.id}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors mt-0.5">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <DI label="Full Name"><span className="font-semibold text-foreground">{c.name}</span></DI>
            <DI label="Client Code"><span className="font-mono text-foreground">{c.client_code ?? '—'}</span></DI>
            <DI label="Mobile Number"><span className="text-foreground">{c.mobile}</span></DI>
            <DI label="Subscription Type">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
            </DI>
            <DI label="Payment Amount">
              <span className="text-xl font-bold text-primary tabular-nums">{fmtMoney(c.amount)}</span>
              {c.discount ? <span className="ml-2 text-xs text-emerald-600 font-semibold">-{fmtMoney(c.discount)} discount</span> : null}
            </DI>
            <DI label="Subscription Start"><span className="text-foreground">{fmt(c.subscription_start)}</span></DI>
            <DI label="Subscription End"><span className="text-foreground">{fmt(c.subscription_end)}</span></DI>
            <DI label="Status">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[st]}`}>
                {st === 'expiring' ? 'Expiring Soon' : st.charAt(0).toUpperCase() + st.slice(1)}
              </span>
            </DI>
            <DI label="Added By">
              {(c as any).added_by_profile ? (
                <span className="text-foreground font-medium">{(c as any).added_by_profile.name}</span>
              ) : '—'}
            </DI>
            {c.notes && <DI label="Notes" className="col-span-2"><span className="text-foreground">{c.notes}</span></DI>}
          </div>

          {/* Screenshot */}
          <div className="border-t border-border pt-5">
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Screenshot</label>
            {c.screenshot_url
              ? <img src={c.screenshot_url} className="max-h-48 rounded-xl border border-border object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightbox(true)} alt="Payment screenshot" />
              : <p className="text-sm text-muted-foreground">No screenshot uploaded</p>}
          </div>

          {/* Comments */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Comments</label>
              {!canComment && <span className="text-[11px] text-muted-foreground">(Admin & Finance only)</span>}
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              {comments.length === 0
                ? <p className="px-4 py-4 text-sm text-muted-foreground">No comments yet.</p>
                : comments.map(cm => (
                  <div key={cm.id} className="px-4 py-3 border-b border-border last:border-0 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">{(cm as any).author?.name ?? 'Unknown'}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted">
                        {(cm as any).author?.role}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">{fmt(cm.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground">{cm.text}</p>
                  </div>
                ))}
              {canComment && (
                <div className="flex gap-2 p-3 bg-muted/50 border-t border-border">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    rows={1}
                    onFocus={e => { e.target.rows = 2 }}
                    onBlur={e => { if (!commentText) e.target.rows = 1 }}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                  <button
                    onClick={postComment}
                    disabled={posting || !commentText.trim()}
                    className="px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg transition-colors self-end"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end bg-muted/20 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Close</button>
          <button onClick={() => onEdit(c)} className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">Edit</button>
          {canDelete && <button onClick={() => onDelete(c.id)} className="px-4 py-2 text-sm font-semibold text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors">Delete</button>}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && c.screenshot_url && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-5" onClick={() => setLightbox(false)}>
          <button className="absolute top-5 right-5 text-white/60 hover:text-white text-2xl font-light">✕</button>
          <img src={c.screenshot_url} className="max-w-full max-h-[90vh] rounded-lg" alt="Payment screenshot" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function DI({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}
