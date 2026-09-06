/**
 * messageRouter.ts — Routes messages between the popup and content script.
 *
 * Handlers:
 *   SCAN_PAGE    — injects content script, scans fields, returns SCAN_RESULT
 *   MATCH_FIELDS — runs heuristic matcher, returns MATCH_RESULT
 *   EXECUTE_FILL — forwards FieldMapping[] to content script, returns FILL_RESULT
 *   UNDO_FILL    — tells content script to restore values + clear highlights
 *
 * All incoming messages are validated against MessageEnvelopeSchema before
 * processing — unknown or malformed messages are silently ignored (rules.md §2).
 *
 * Phase 3 + Phase 5 implementation.
 */

import { FieldMapping, FormFieldSchema, FormField, MessageEnvelopeSchema, Profile, ProfileSchema } from '../lib/types'
import { matchFields } from './heuristicMatcher'
import { llmMatch } from './llmMatcher'
import { getSettings } from '../lib/storage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanPagePayload {
  tabId: number
}

interface ScanResultPayload {
  fields: FormField[]
  crossOriginIframes: number
  warning: string | null
}

// ---------------------------------------------------------------------------
// Injection helper
// ---------------------------------------------------------------------------

/**
 * Injects the Swiftply content script into all frames of the given tab.
 * Safe to call even if already injected — the double-injection guard in
 * content/index.ts (window.__swiftplyLoaded flag) prevents duplicate listeners.
 */
async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    // CRXJS transforms this source path to the correct built asset path.
    files: ['src/content/index.ts'],
  })
}

// ---------------------------------------------------------------------------
// Handler: SCAN_PAGE
// ---------------------------------------------------------------------------

async function handleScanPage(
  payload: ScanPagePayload,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const { tabId } = payload

  // Step 1: inject content script (double-injection guard is in the script itself)
  try {
    await injectContentScript(tabId)
  } catch (err) {
    console.error('[Swiftply] Content script injection failed:', err)
    sendResponse({
      type: 'SCAN_RESULT',
      payload: {
        fields: [],
        crossOriginIframes: 0,
        warning:
          'Could not inject the scanner. This page may not support extensions (e.g. browser internal pages). Try a job application page.',
      } satisfies ScanResultPayload,
    })
    return
  }

  // Step 2: send SCAN_PAGE to the content script and await its response
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'SCAN_PAGE',
      payload: {},
    })
    // Forward the content script's SCAN_RESULT directly back to the popup
    sendResponse(result)
  } catch (err) {
    console.error('[Swiftply] Failed to communicate with content script:', err)
    sendResponse({
      type: 'SCAN_RESULT',
      payload: {
        fields: [],
        crossOriginIframes: 0,
        warning: 'Could not communicate with the page. Please reload the tab and try again.',
      } satisfies ScanResultPayload,
    })
  }
}

// ---------------------------------------------------------------------------
// Handler: MATCH_FIELDS
// ---------------------------------------------------------------------------

async function handleMatchFields(
  payload: { fields: FormField[]; profile: Profile },
  sendResponse: (response: unknown) => void,
): Promise<void> {
  // Validate both sides of the payload with Zod before acting (rules.md §2)
  const fieldsResult = FormFieldSchema.array().safeParse(payload.fields)
  const profileResult = ProfileSchema.safeParse(payload.profile)

  if (!fieldsResult.success || !profileResult.success) {
    console.error('[Swiftply] MATCH_FIELDS: invalid payload', {
      fields: fieldsResult.error?.issues,
      profile: profileResult.error?.issues,
    })
    sendResponse({
      type: 'MATCH_RESULT',
      payload: { mappings: [] as FieldMapping[], error: 'Invalid payload shape' },
    })
    return
  }

  const fields = fieldsResult.data
  const profile = profileResult.data

  // Step 1: heuristic matching (always runs, no API call)
  const heuristicMappings = matchFields(fields, profile)

  // Step 2: LLM matching on unmatched fields (only when user has enabled it)
  const settings = await getSettings()
  let finalMappings = heuristicMappings

  if (settings.llmEnabled && settings.llmApiKey.trim()) {
    // Collect only the FormFields whose heuristic result was 'unmatched'
    const unmatchedFields = fields.filter(
      (_, i) => heuristicMappings[i]?.source === 'unmatched',
    )

    if (unmatchedFields.length > 0) {
      try {
        const llmMappings = await llmMatch(unmatchedFields, profile, settings.llmApiKey)

        // Merge: replace 'unmatched' slots with LLM results where available
        const llmBySelector = new Map(llmMappings.map((m) => [m.selector, m]))
        finalMappings = heuristicMappings.map((m) => {
          if (m.source !== 'unmatched') return m
          return llmBySelector.get(m.selector) ?? m
        })
      } catch (err) {
        // LLM failure is non-fatal — heuristic results still returned (rules.md §2)
        console.error('[Swiftply] LLM match failed, falling back to heuristic only:', err)
      }
    }
  }

  sendResponse({ type: 'MATCH_RESULT', payload: { mappings: finalMappings } })
}

// ---------------------------------------------------------------------------
// Handler: EXECUTE_FILL
// ---------------------------------------------------------------------------

/**
 * Forwards FieldMapping[] to the content script for DOM writing.
 * The content script is already injected from the preceding SCAN_PAGE call.
 */
async function handleExecuteFill(
  payload: { tabId: number; mappings: FieldMapping[] },
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    const result = await chrome.tabs.sendMessage(payload.tabId, {
      type: 'EXECUTE_FILL',
      payload: { mappings: payload.mappings },
    })
    sendResponse(result)
  } catch (err) {
    console.error('[Swiftply] EXECUTE_FILL forward failed:', err)
    sendResponse({
      type: 'FILL_RESULT',
      payload: {
        results: [],
        error: 'Could not reach the page. Try reloading and filling again.',
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Handler: UNDO_FILL
// ---------------------------------------------------------------------------

async function handleUndoFill(
  payload: { tabId: number },
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    const result = await chrome.tabs.sendMessage(payload.tabId, {
      type: 'UNDO_FILL',
      payload: {},
    })
    sendResponse(result)
  } catch (err) {
    console.error('[Swiftply] UNDO_FILL forward failed:', err)
    sendResponse({ type: 'FILL_RESULT', payload: { results: [], undone: false } })
  }
}

// ---------------------------------------------------------------------------
// Router entry point
// ---------------------------------------------------------------------------

export function startMessageRouter(): void {
  chrome.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
    const parsed = MessageEnvelopeSchema.safeParse(rawMsg)

    // Silently ignore invalid or unknown messages
    if (!parsed.success) return false

    switch (parsed.data.type) {
      case 'SCAN_PAGE':
        void handleScanPage(parsed.data.payload as ScanPagePayload, sendResponse)
        return true // signal async response

      case 'MATCH_FIELDS':
        void handleMatchFields(
          parsed.data.payload as { fields: FormField[]; profile: Profile },
          sendResponse,
        )
        return true // signal async response

      case 'EXECUTE_FILL':
        void handleExecuteFill(
          parsed.data.payload as { tabId: number; mappings: FieldMapping[] },
          sendResponse,
        )
        return true // signal async response

      case 'UNDO_FILL':
        void handleUndoFill(
          parsed.data.payload as { tabId: number },
          sendResponse,
        )
        return true // signal async response

      default:
        return false
    }
  })
}
