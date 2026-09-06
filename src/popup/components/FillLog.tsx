/**
 * FillLog.tsx — Session history of fill operations.
 *
 * Shows the last 50 fill sessions from chrome.storage.local, grouped by day.
 * Each entry displays: site URL, time, profile used, filled/skipped/failed counts.
 * Failed entries are expandable to show the selector + error message.
 *
 * "Clear all" button with a confirmation step (rules.md §2: no silent destructive ops).
 *
 * Phase 8 implementation.
 */

import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { FillLogEntry } from '../../lib/types'
import { clearFillLog, getFillLog } from '../../lib/storage'

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function groupByDay(entries: FillLogEntry[]): { label: string; entries: FillLogEntry[] }[] {
  const groups = new Map<string, FillLogEntry[]>()
  for (const entry of entries) {
    const label = dayLabel(entry.timestamp)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }
  return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }))
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 27) + '…' : u.pathname
    return u.hostname + path
  } catch {
    return url.slice(0, 40)
  }
}

// ---------------------------------------------------------------------------
// Entry card
// ---------------------------------------------------------------------------

function LogEntryCard({ entry }: { entry: FillLogEntry }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const hasFailures = entry.failures.length > 0

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 flex flex-col gap-2">
      {/* Top row: site + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-ink truncate" title={entry.siteUrl}>
            {shortUrl(entry.siteUrl)}
          </p>
          <p className="text-[11px] text-gray-400">{entry.profileName}</p>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400">{timeLabel(entry.timestamp)}</span>
      </div>

      {/* Counts row */}
      <div className="flex items-center gap-3">
        {entry.filled > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-green-600">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            {entry.filled} filled
          </span>
        )}
        {entry.skipped > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <XCircle className="w-3 h-3" aria-hidden="true" />
            {entry.skipped} skipped
          </span>
        )}
        {entry.failed > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 transition-colors"
          >
            <XCircle className="w-3 h-3" aria-hidden="true" />
            {entry.failed} failed
            {hasFailures && (
              expanded
                ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                : <ChevronDown className="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Failure detail (expandable) */}
      {expanded && hasFailures && (
        <div className="rounded bg-red-50 border border-red-100 px-2.5 py-2 flex flex-col gap-1">
          {entry.failures.map((f, i) => (
            <p key={i} className="text-[10px] text-red-700">
              <span className="font-mono">{f.selector}</span>
              {f.error ? ` — ${f.error}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FillLog component
// ---------------------------------------------------------------------------

export default function FillLog(): React.JSX.Element {
  const [entries, setEntries] = useState<FillLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    void getFillLog().then((log) => {
      setEntries(log)
      setLoading(false)
    })
  }, [])

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setClearing(true)
    try {
      await clearFillLog()
      setEntries([])
      setConfirmClear(false)
    } catch (err) {
      console.error('[Swiftply] clearFillLog failed:', err)
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
      </div>
    )
  }

  const groups = groupByDay(entries)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {entries.length > 0 && (
        <div className="shrink-0 flex items-center justify-end px-4 pt-3 pb-1">
          <button
            id="btn-clear-log"
            onClick={handleClear}
            disabled={clearing}
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
              confirmClear
                ? 'text-red-600 hover:text-red-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {clearing ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-3 h-3" aria-hidden="true" />
            )}
            {confirmClear ? 'Confirm clear' : 'Clear all'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="ml-3 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4 min-h-0">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Clock className="w-8 h-8 text-gray-200" aria-hidden="true" />
            <p className="text-sm text-gray-500">No fill history yet.</p>
            <p className="text-[11px] text-gray-400">
              Each time you fill a form, an entry will appear here.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </span>
              {group.entries.map((entry) => (
                <LogEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
