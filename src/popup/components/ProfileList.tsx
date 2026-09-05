/**
 * ProfileList.tsx — Lists saved profiles; handles select/delete/navigate.
 *
 * design.md §4:
 *   - Cards: white bg, gray-200 border, 8px radius, hover → gray-50
 *   - Active profile: blue-600 border
 *   - Delete: two-step confirm (first click reveals "Cancel / Delete" inline)
 *   - Primary button: blue-600 solid; secondary: white with gray-200 border
 */

import React, { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { FormField, Profile } from '../../lib/types'
import {
  deleteProfile,
  getActiveProfileId,
  getProfiles,
  setActiveProfileId,
} from '../../lib/storage'

interface Props {
  onNewProfile: () => void
  onEditProfile: (profile: Profile) => void
  /** Called when a scan completes — transitions popup to the debug view. */
  onScanResult: (fields: FormField[], warning: string | null) => void
}

export default function ProfileList({ onNewProfile, onEditProfile, onScanResult }: Props): React.JSX.Element {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [ps, aid] = await Promise.all([getProfiles(), getActiveProfileId()])
      setProfiles(ps)
      setActiveId(aid)
    } catch (err) {
      console.error('[Swiftply] Failed to load profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleActivate = async (id: string) => {
    try {
      await setActiveProfileId(id)
      setActiveId(id)
    } catch (err) {
      console.error('[Swiftply] Failed to set active profile:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProfile(id)
      setPendingDeleteId(null)
      await reload()
    } catch (err) {
      console.error('[Swiftply] Failed to delete profile:', err)
    }
  }

  const handleFill = async () => {
    setScanError(null)
    setScanning(true)

    try {
      // Get the active tab in the current window
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab?.id) {
        setScanError('No active tab found. Click on a job application page first.')
        return
      }

      // Send SCAN_PAGE to the background worker, which injects + queries content script
      const response = await chrome.runtime.sendMessage({
        type: 'SCAN_PAGE',
        payload: { tabId: tab.id },
      })

      // Background always responds with a SCAN_RESULT envelope
      if (response?.type === 'SCAN_RESULT') {
        const { fields, warning } = response.payload as {
          fields: FormField[]
          warning: string | null
        }
        onScanResult(fields, warning)
      } else {
        setScanError('Unexpected response from scanner. Please try again.')
      }
    } catch (err) {
      console.error('[Swiftply] Fill pipeline error:', err)
      setScanError('Could not scan the page. Make sure you are on a job application.')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Section header row */}
      <div className="flex items-center justify-between">
        {/* design.md §2: 13px semibold uppercase */}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Profiles
        </span>
        <button
          id="btn-new-profile"
          onClick={onNewProfile}
          className="flex items-center gap-1 text-[13px] font-medium text-brand hover:text-brand-hover transition-colors"
          aria-label="Create new profile"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New
        </button>
      </div>

      {/* Empty state */}
      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-gray-500">No profiles yet.</p>
          <button
            id="btn-create-first-profile"
            onClick={onNewProfile}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Create your first profile
          </button>
        </div>
      ) : (
        /* Profile card list */
        <ul className="flex flex-col gap-2" role="list">
          {profiles.map((profile) => {
            const isActive = profile.id === activeId
            const awaitingConfirm = pendingDeleteId === profile.id

            return (
              <li
                key={profile.id}
                className={`rounded-lg border px-3 py-3 transition-colors ${
                  isActive
                    ? 'border-brand bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                {awaitingConfirm ? (
                  /* Two-step delete confirm — design.md §4 */
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 truncate">
                      Delete &ldquo;{profile.name}&rdquo;?
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="text-xs text-gray-500 hover:text-ink font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        id={`btn-confirm-delete-${profile.id}`}
                        onClick={() => void handleDelete(profile.id)}
                        className="text-xs font-medium text-status-error hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Click card body to activate */}
                    <button
                      id={`btn-activate-${profile.id}`}
                      onClick={() => void handleActivate(profile.id)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                      aria-pressed={isActive}
                      aria-label={`${isActive ? 'Active — ' : 'Activate: '}${profile.name}`}
                    >
                      {isActive && (
                        <CheckCircle2
                          className="w-4 h-4 text-brand shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <div className={`min-w-0 ${!isActive ? 'pl-6' : ''}`}>
                        <p className="text-sm font-medium text-ink truncate">{profile.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {profile.contact.firstName} {profile.contact.lastName}
                          {profile.contact.email ? ` · ${profile.contact.email}` : ''}
                        </p>
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`btn-edit-${profile.id}`}
                        onClick={() => onEditProfile(profile)}
                        className="p-1.5 rounded text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors"
                        aria-label={`Edit ${profile.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        id={`btn-delete-${profile.id}`}
                        onClick={() => setPendingDeleteId(profile.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-status-error hover:bg-red-50 transition-colors"
                        aria-label={`Delete ${profile.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Fill Application */}
      {profiles.length > 0 && (
        <div className="mt-1 pt-4 border-t border-gray-100">
          {/* Scan error banner */}
          {scanError && (
            <p className="text-[11px] text-status-error text-center mb-2 px-2">{scanError}</p>
          )}

          <button
            id="btn-fill-application"
            onClick={() => void handleFill()}
            disabled={scanning || !activeId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand text-white text-sm font-medium py-2.5 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover"
            title={!activeId ? 'Select a profile first' : 'Scan and fill this page'}
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="w-4 h-4" aria-hidden="true" />
            )}
            {scanning ? 'Scanning page…' : 'Fill Application'}
          </button>
          {!scanning && (
            <p className="text-[11px] text-gray-400 text-center mt-1.5">
              {activeId ? 'Scans the active tab for form fields.' : 'Select a profile above first.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
