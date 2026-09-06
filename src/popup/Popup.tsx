/**
 * Popup.tsx — Root popup component.
 *
 * Views:
 *   'list'     → ProfileList (default)
 *   'form'     → ProfileForm (create or edit)
 *   'match'    → Fill preview — matched/unmatched fields, Fill button
 *   'result'   → Fill outcome — filled/failed counts, Undo button
 *   'settings' → LLM toggle, API key input, privacy disclosure
 *   'log'      → FillLog — session history with timestamps (Phase 8)
 *
 * Toast system: a single lightweight toast at the bottom of the popup
 * for out-of-band errors (LLM key invalid, storage write failures).
 * View-specific errors remain as inline messages inside each view.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Settings,
  XCircle,
  Zap,
} from 'lucide-react'
import ProfileList from './components/ProfileList'
import ProfileForm from './components/ProfileForm'
import FillLog from './components/FillLog'
import {
  FieldMapping,
  FillLogEntry,
  FillResultEntry,
  FormField,
  Profile,
  Settings as SettingsType,
} from '../lib/types'
import { getSettings, saveSettings, saveFillLogEntry } from '../lib/storage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View =
  | { name: 'list' }
  | { name: 'form'; editingProfile?: Profile }
  | {
      name: 'match'
      fields: FormField[]
      mappings: FieldMapping[]
      warning: string | null
      tabId: number
      profileName: string
    }
  | { name: 'result'; results: FillResultEntry[]; tabId: number; profileName: string; siteUrl: string; siteTitle: string }
  | { name: 'settings' }
  | { name: 'log' }

type ToastType = 'error' | 'warning' | 'info'
interface Toast { id: string; message: string; type: ToastType }

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function Popup(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const id = crypto.randomUUID()
    setToast({ id, message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }, [])

  // Clean up toast timer on unmount
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const goList = () => setView({ name: 'list' })

  const headerTitle =
    view.name === 'match' ? 'Fill Preview'
    : view.name === 'result' ? 'Fill Complete'
    : view.name === 'settings' ? 'Settings'
    : view.name === 'log' ? 'Fill History'
    : 'Swiftply'

  const showBackButton = view.name !== 'list'
  const showIcons = view.name === 'list'

  return (
    <div className="w-[380px] bg-white flex flex-col" style={{ maxHeight: 600 }}>
      {/* Header */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        {showBackButton && (
          <button
            onClick={goList}
            className="p-1 -ml-1 rounded text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors"
            aria-label="Back to profiles"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <Zap className="w-[18px] h-[18px] text-brand" strokeWidth={2.5} aria-hidden="true" />

        <span className="text-base font-semibold text-ink tracking-tight flex-1">
          {headerTitle}
        </span>

        {showIcons && (
          <div className="flex items-center gap-0.5">
            <button
              id="btn-open-log"
              onClick={() => setView({ name: 'log' })}
              className="p-1 rounded text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors"
              aria-label="Open fill history"
            >
              <Clock className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              id="btn-open-settings"
              onClick={() => setView({ name: 'settings' })}
              className="p-1 rounded text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors"
              aria-label="Open settings"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto relative">
        {view.name === 'list' && (
          <ProfileList
            onNewProfile={() => setView({ name: 'form' })}
            onEditProfile={(p) => setView({ name: 'form', editingProfile: p })}
            onFillReady={async (fields, mappings, warning, profileName) => {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
              setView({
                name: 'match',
                fields,
                mappings,
                warning,
                tabId: tab?.id ?? 0,
                profileName: profileName ?? 'Unknown profile',
              })
            }}
          />
        )}

        {view.name === 'form' && (
          <ProfileForm
            initialProfile={view.editingProfile}
            onSave={goList}
            onCancel={goList}
          />
        )}

        {view.name === 'match' && (
          <MatchView
            fields={view.fields}
            mappings={view.mappings}
            warning={view.warning}
            tabId={view.tabId}
            profileName={view.profileName}
            onFillComplete={(results, siteUrl, siteTitle) =>
              setView({
                name: 'result',
                results,
                tabId: view.tabId,
                profileName: view.profileName,
                siteUrl,
                siteTitle,
              })
            }
            showToast={showToast}
          />
        )}

        {view.name === 'result' && (
          <ResultView
            results={view.results}
            tabId={view.tabId}
            profileName={view.profileName}
            siteUrl={view.siteUrl}
            siteTitle={view.siteTitle}
            onUndo={goList}
            onClose={goList}
            showToast={showToast}
          />
        )}

        {view.name === 'settings' && <SettingsView showToast={showToast} />}
        {view.name === 'log' && <FillLog />}
      </main>

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`shrink-0 mx-3 mb-3 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MatchView
// ---------------------------------------------------------------------------

function MatchView({
  fields,
  mappings,
  warning,
  tabId,
  profileName,
  onFillComplete,
  showToast,
}: {
  fields: FormField[]
  mappings: FieldMapping[]
  warning: string | null
  tabId: number
  profileName: string
  onFillComplete: (results: FillResultEntry[], siteUrl: string, siteTitle: string) => void
  showToast: (msg: string, type?: ToastType) => void
}): React.JSX.Element {
  const [filling, setFilling] = useState(false)
  const [fillError, setFillError] = useState<string | null>(null)

  const matched = mappings.filter((m) => m.source !== 'unmatched').length
  const llmCount = mappings.filter((m) => m.source === 'llm').length
  const total = mappings.length

  const handleFill = async () => {
    setFillError(null)
    setFilling(true)
    try {
      // Get tab info for the fill log entry
      const tab = await chrome.tabs.get(tabId)
      const siteUrl = tab.url ?? ''
      const siteTitle = tab.title ?? ''

      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_FILL',
        payload: { tabId, mappings },
      })

      if (response?.type === 'FILL_RESULT') {
        const { results, error } = response.payload as {
          results: FillResultEntry[]
          error?: string
        }
        if (error) {
          setFillError(error)
        } else {
          onFillComplete(results, siteUrl, siteTitle)
        }
      } else {
        setFillError('Unexpected response from fill engine.')
      }
    } catch (err) {
      console.error('[Swiftply] EXECUTE_FILL error:', err)
      setFillError('Could not fill the page. Reload the tab and try again.')
    } finally {
      setFilling(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Fill Preview
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-brand bg-blue-50 rounded-full px-2 py-0.5">
              {matched}/{total} matched
            </span>
            {llmCount > 0 && (
              <span className="text-xs font-medium text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
                {llmCount} AI
              </span>
            )}
          </div>
        </div>

        {warning && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-[11px] text-amber-700">{warning}</p>
          </div>
        )}
        {fillError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-[11px] text-red-700">{fillError}</p>
          </div>
        )}
        {total === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-gray-500">No fillable fields found on this page.</p>
            <p className="text-[11px] text-gray-400">Navigate to a job application form.</p>
          </div>
        )}

        {total > 0 && (
          <ul className="flex flex-col gap-1.5">
            {mappings.map((mapping) => {
              const isMatched = mapping.source !== 'unmatched'
              const isLlm = mapping.source === 'llm'
              const idx = parseInt(mapping.selector.replace('field-', ''), 10)
              const label = isNaN(idx)
                ? mapping.selector
                : fields[idx]?.label || `Field ${idx + 1}`

              return (
                <li
                  key={mapping.selector}
                  className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 ${
                    isLlm
                      ? 'border-purple-100 bg-purple-50'
                      : isMatched
                        ? 'border-green-100 bg-green-50'
                        : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {isMatched ? (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isLlm ? 'text-purple-500' : 'text-green-500'}`}
                      aria-label="Matched"
                    />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" aria-label="Unmatched" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink truncate">
                      {label || <span className="italic text-gray-400">No label</span>}
                    </p>
                    {isMatched ? (
                      <p className="text-[11px] text-gray-500 truncate">
                        {mapping.value || <span className="italic text-gray-400">empty value</span>}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">No match found</p>
                    )}
                  </div>
                  {isMatched && (
                    <span
                      className={`shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5 ${
                        isLlm ? 'text-purple-600 bg-purple-100' : 'text-green-600 bg-green-100'
                      }`}
                    >
                      {isLlm ? 'ai' : 'heuristic'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {llmCount > 0 && (
          <p className="text-[10px] text-purple-500 text-center mt-1">
            {llmCount} field{llmCount !== 1 ? 's' : ''} matched via AI assist (Anthropic Claude)
          </p>
        )}
      </div>

      {total > 0 && (
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 flex flex-col gap-1.5">
          <button
            id="btn-execute-fill"
            onClick={handleFill}
            disabled={filling || matched === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand text-white text-sm font-medium py-2.5 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-brand-hover"
          >
            {filling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {filling ? 'Filling…' : `Fill ${matched} matched field${matched !== 1 ? 's' : ''}`}
          </button>
          {matched === 0 && (
            <p className="text-[10px] text-gray-400 text-center">
              No fields matched — enable AI assist in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ResultView
// ---------------------------------------------------------------------------

function ResultView({
  results,
  tabId,
  profileName,
  siteUrl,
  siteTitle,
  onUndo,
  onClose,
  showToast,
}: {
  results: FillResultEntry[]
  tabId: number
  profileName: string
  siteUrl: string
  siteTitle: string
  onUndo: () => void
  onClose: () => void
  showToast: (msg: string, type?: ToastType) => void
}): React.JSX.Element {
  const [undoing, setUndoing] = useState(false)
  const [logSaved, setLogSaved] = useState(false)

  const filled = results.filter((r) => r.status === 'filled').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failed = results.filter((r) => r.status === 'failed')

  // Save fill log entry as soon as ResultView mounts
  useEffect(() => {
    if (logSaved) return
    setLogSaved(true)

    const entry: FillLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      siteUrl,
      siteTitle,
      profileName,
      filled,
      skipped,
      failed: failed.length,
      failures: failed.map((f) => ({ selector: f.selector, error: f.error })),
    }

    saveFillLogEntry(entry).catch((err) => {
      console.error('[Swiftply] saveFillLogEntry failed:', err)
      showToast("Couldn't save fill history.", 'warning')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = async () => {
    setUndoing(true)
    try {
      await chrome.runtime.sendMessage({ type: 'UNDO_FILL', payload: { tabId } })
      onUndo()
    } catch (err) {
      console.error('[Swiftply] UNDO_FILL error:', err)
      showToast('Undo failed. The page may have reloaded.', 'error')
    } finally {
      setUndoing(false)
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-ink">
            {filled} field{filled !== 1 ? 's' : ''} filled
          </span>
        </div>
        {skipped > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-gray-300" />
            <span className="text-sm text-gray-500">{skipped} unmatched (skipped)</span>
          </div>
        )}
        {failed.length > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-600">
              {failed.length} field{failed.length !== 1 ? 's' : ''} failed
            </span>
          </div>
        )}
      </div>

      {failed.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 flex flex-col gap-1">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">
            Failed fields
          </p>
          {failed.map((f) => (
            <p key={f.selector} className="text-[11px] text-red-700">
              <span className="font-mono">{f.selector}</span>
              {f.error ? ` — ${f.error}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          id="btn-undo-fill"
          onClick={handleUndo}
          disabled={undoing}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-ink py-2 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {undoing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          {undoing ? 'Undoing…' : 'Undo fill'}
        </button>
        <button
          id="btn-close-result"
          onClick={onClose}
          className="flex-1 flex items-center justify-center rounded-lg bg-brand text-white text-sm font-medium py-2 hover:bg-brand-hover transition-colors"
        >
          Done
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Filled fields are highlighted green on the page.
        Undo reverts all values and removes highlights.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsView
// ---------------------------------------------------------------------------

function SettingsView({ showToast }: { showToast: (msg: string, type?: ToastType) => void }): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsType>({ llmEnabled: false, llmApiKey: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const handleToggle = () => {
    const next = !settings.llmEnabled
    if (next && !settings.llmApiKey.trim()) {
      setValidationError('Enter your Anthropic API key before enabling AI assist.')
      return
    }
    setValidationError(null)
    setSettings((s) => ({ ...s, llmEnabled: next }))
  }

  const handleSave = async () => {
    if (settings.llmEnabled && !settings.llmApiKey.trim()) {
      setValidationError('An API key is required when AI assist is enabled.')
      return
    }
    setValidationError(null)
    setSaving(true)
    try {
      await saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[Swiftply] Failed to save settings:', err)
      showToast("Couldn't save settings. Try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          AI-Assisted Matching
        </span>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Enable AI matching</span>
          <button
            id="toggle-llm-enabled"
            role="switch"
            aria-checked={settings.llmEnabled}
            onClick={handleToggle}
            className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
              settings.llmEnabled ? 'bg-brand' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                settings.llmEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
          <p className="text-[11px] text-blue-700 leading-relaxed">
            When enabled, <strong>unmatched field label names</strong> are sent to{' '}
            <strong>Anthropic (Claude)</strong> to improve match accuracy.
            Your profile values are <strong>not sent</strong> — only the field label names.
            Your API key stays on your device in local storage.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="input-api-key" className="text-[12px] font-medium text-gray-600">
            Anthropic API Key
          </label>
          <div className="flex gap-1.5">
            <input
              id="input-api-key"
              type={showKey ? 'text' : 'password'}
              value={settings.llmApiKey}
              onChange={(e) => {
                setSettings((s) => ({ ...s, llmApiKey: e.target.value }))
                setValidationError(null)
              }}
              placeholder="sk-ant-..."
              autoComplete="off"
              spellCheck={false}
              className="flex-1 text-[12px] font-mono px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand text-ink placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-ink hover:bg-gray-50 transition-colors"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">
            Get your key at{' '}
            <a
              href="https://console.anthropic.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              console.anthropic.com/keys
            </a>
          </p>
        </div>

        {validationError && (
          <p className="text-[11px] text-red-600">{validationError}</p>
        )}
      </section>

      <div className="h-px bg-gray-100" />

      <button
        id="btn-save-settings"
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand text-white text-sm font-medium py-2.5 transition-opacity disabled:opacity-40 hover:enabled:bg-brand-hover"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
      </button>

      <div className="h-px bg-gray-100" />
      <p className="text-[10px] text-gray-400 text-center">
        Swiftply v0.1.0 · Profile data stays on your device · No telemetry
      </p>
    </div>
  )
}
