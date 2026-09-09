'use client'

import { useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

export type DateRange = { from: string; to: string } | null

interface Preset { label: string; key: string }

const PRESETS: Preset[] = [
  { label: 'All Time',     key: 'all' },
  { label: 'This Month',   key: 'month' },
  { label: 'This Quarter', key: 'quarter' },
  { label: 'Last 6 Mo.',   key: 'half' },
  { label: 'This Year',    key: 'year' },
  { label: 'Custom',       key: 'custom' },
]

function getPresetRange(key: string): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const start = (d: Date) => fmt(d)
  const end = () => fmt(now)

  if (key === 'all') return null
  if (key === 'month') return { from: start(new Date(y, m, 1)), to: end() }
  if (key === 'quarter') {
    const q = Math.floor(m / 3)
    return { from: start(new Date(y, q * 3, 1)), to: end() }
  }
  if (key === 'half') {
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    return { from: start(sixMonthsAgo), to: end() }
  }
  if (key === 'year') return { from: start(new Date(y, 0, 1)), to: end() }
  return null
}

export function isInRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!range) return true
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= range.from && d <= range.to
}

interface Props {
  value: DateRange
  onChange: (r: DateRange) => void
  label?: string
}

export default function DateRangeFilter({ value, onChange, label }: Props) {
  const [activeKey, setActiveKey] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  function selectPreset(key: string) {
    setActiveKey(key)
    if (key === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    onChange(getPresetRange(key))
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    onChange({ from: customFrom, to: customTo })
  }

  function clear() {
    setActiveKey('all')
    setShowCustom(false)
    setCustomFrom('')
    setCustomTo('')
    onChange(null)
  }

  const INPUT = 'px-2 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring'
  const BTN = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
    }`

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
          <Calendar size={13} />
          {label ?? 'Filter by date:'}
        </div>
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => selectPreset(p.key)} className={BTN(activeKey === p.key)}>
            {p.label}
          </button>
        ))}
        {value && (
          <button onClick={clear} className="flex items-center gap-1 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-muted-foreground">From</span>
          <input type="date" className={INPUT} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">To</span>
          <input type="date" className={INPUT} value={customTo} onChange={e => setCustomTo(e.target.value)} />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {value && activeKey !== 'custom' && (
        <div className="mt-2 text-xs text-muted-foreground">
          Showing: <span className="font-semibold text-foreground">{value.from}</span> → <span className="font-semibold text-foreground">{value.to}</span>
        </div>
      )}
      {value && activeKey === 'custom' && customFrom && customTo && (
        <div className="mt-2 text-xs text-muted-foreground">
          Showing: <span className="font-semibold text-foreground">{customFrom}</span> → <span className="font-semibold text-foreground">{customTo}</span>
        </div>
      )}
    </div>
  )
}
