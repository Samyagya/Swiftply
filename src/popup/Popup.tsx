/**
 * Popup.tsx — Root popup component.
 *
 * Owns the view-routing state for the entire popup. No React Router needed —
 * this is a single-page popup, not a multi-route app.
 *
 * Views:
 *   'list'  → ProfileList (default)
 *   'form'  → ProfileForm (create or edit)
 *   'debug' → Phase 3 QA: raw FormField[] scan result (temporary, replaced in Phase 5)
 *
 * Future views (Phase 5+):
 *   'fill'  → FillButton / FillLog
 */

import React, { useState } from 'react'
import { ArrowLeft, Zap } from 'lucide-react'
import ProfileList from './components/ProfileList'
import ProfileForm from './components/ProfileForm'
import { FormField, Profile } from '../lib/types'

type View =
  | { name: 'list' }
  | { name: 'form'; editingProfile?: Profile }
  | { name: 'debug'; fields: FormField[]; warning: string | null }

export default function Popup(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

  const goList = () => setView({ name: 'list' })

  return (
    /**
     * design.md §3: popup width = 380px fixed.
     * max-h-[600px] + overflow on main keeps the popup from growing
     * unboundedly when the profile form has many sections.
     * min-h-0 on main is required for flex children to honour overflow-y-auto.
     */
    <div className="w-[380px] bg-white flex flex-col" style={{ maxHeight: 600 }}>
      {/* Header — design.md §2: 16px / semibold */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        {/* Back button — shown on non-list views */}
        {view.name !== 'list' && (
          <button
            onClick={goList}
            className="p-1 -ml-1 rounded text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors"
            aria-label="Back to profiles"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <Zap
          className="w-[18px] h-[18px] text-brand"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="text-base font-semibold text-ink tracking-tight">
          {view.name === 'debug' ? 'Field Scanner' : 'Swiftply'}
        </span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        {view.name === 'list' && (
          <ProfileList
            onNewProfile={() => setView({ name: 'form' })}
            onEditProfile={(p) => setView({ name: 'form', editingProfile: p })}
            onScanResult={(fields, warning) => setView({ name: 'debug', fields, warning })}
          />
        )}

        {view.name === 'form' && (
          <ProfileForm
            initialProfile={view.editingProfile}
            onSave={goList}
            onCancel={goList}
          />
        )}

        {view.name === 'debug' && (
          <DebugView fields={view.fields} warning={view.warning} />
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Debug view — Phase 3 QA only, replaced by the fill pipeline in Phase 5
// ---------------------------------------------------------------------------

function DebugView({
  fields,
  warning,
}: {
  fields: FormField[]
  warning: string | null
}): React.JSX.Element {
  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Detected Fields
        </span>
        <span className="text-xs font-medium text-brand bg-blue-50 rounded-full px-2 py-0.5">
          {fields.length} found
        </span>
      </div>

      {/* Cross-origin iframe warning */}
      {warning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[11px] text-amber-700">{warning}</p>
        </div>
      )}

      {/* No fields state */}
      {fields.length === 0 && !warning && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-gray-500">No fillable fields found on this page.</p>
          <p className="text-[11px] text-gray-400">
            Try navigating to a job application form.
          </p>
        </div>
      )}

      {/* Field list */}
      {fields.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {fields.map((field) => (
            <li
              key={field.selector}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-start gap-3"
            >
              {/* Type badge */}
              <span className="shrink-0 mt-0.5 text-[10px] font-mono font-medium text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 uppercase">
                {field.inputType}
              </span>
              {/* Label */}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-ink truncate">
                  {field.label || (
                    <span className="text-gray-400 italic">No label detected</span>
                  )}
                </p>
                {field.nearbyContext && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">
                    {field.nearbyContext}
                  </p>
                )}
              </div>
              {/* Selector key */}
              <span className="shrink-0 text-[10px] font-mono text-gray-300">
                {field.selector}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Phase label */}
      <p className="text-[10px] text-gray-300 text-center mt-2">
        Phase 3 debug view · matching &amp; filling in Phase 4–5
      </p>
    </div>
  )
}
