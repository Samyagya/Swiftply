/**
 * content/index.ts — Content script entry point.
 *
 * Injected on demand via chrome.scripting.executeScript() when the user
 * clicks "Fill Application" (NOT via a static content_scripts manifest entry).
 *
 * Message handlers:
 *   SCAN_PAGE    → scan DOM fields, respond SCAN_RESULT
 *   EXECUTE_FILL → fill matched fields, apply highlights, respond FILL_RESULT
 *   UNDO_FILL    → restore pre-fill values, clear highlights, respond FILL_RESULT
 *
 * Phase 3 + Phase 5 implementation.
 */

import { scanFields, getRegisteredElement } from './fieldScanner'
import { detectCrossOriginIframes } from './iframeBridge'
import { fillFields, undoFill } from './fieldFiller'
import { highlightElement, clearHighlights } from './highlighter'
import { FieldMapping, MessageEnvelopeSchema } from '../lib/types'

// Prevent double-registration if the script is injected more than once
// into the same frame (e.g., user clicks Fill Application twice quickly).
if (!(window as Window & { __swiftplyLoaded?: boolean }).__swiftplyLoaded) {
  ;(window as Window & { __swiftplyLoaded?: boolean }).__swiftplyLoaded = true

  chrome.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
    const parsed = MessageEnvelopeSchema.safeParse(rawMsg)

    // Silently ignore messages not meant for us (e.g., from other extensions)
    if (!parsed.success) return false

    // ── SCAN_PAGE ──────────────────────────────────────────────────────────
    if (parsed.data.type === 'SCAN_PAGE') {
      try {
        const fields = scanFields()
        const iframeInfo = detectCrossOriginIframes()

        sendResponse({
          type: 'SCAN_RESULT',
          payload: {
            fields,
            crossOriginIframes: iframeInfo.crossOrigin,
            warning: iframeInfo.warning,
          },
        })
      } catch (err) {
        console.error('[Swiftply] Scan failed:', err)
        sendResponse({
          type: 'SCAN_RESULT',
          payload: {
            fields: [],
            crossOriginIframes: 0,
            warning: 'Scan encountered an error. Please try reloading the page.',
          },
        })
      }
      return false
    }

    // ── EXECUTE_FILL ───────────────────────────────────────────────────────
    if (parsed.data.type === 'EXECUTE_FILL') {
      const { mappings } = parsed.data.payload as { mappings: FieldMapping[] }

      // fillFields is async (custom dropdowns need a short timeout)
      // Return true to signal async sendResponse
      void (async () => {
        try {
          const results = await fillFields(mappings)

          // Apply highlights to every field based on outcome
          for (const result of results) {
            if (result.status === 'skipped') continue
            const el = getRegisteredElement(result.selector)
            if (!el) continue
            highlightElement(el, result.status === 'filled' ? 'filled' : 'failed')
          }

          // Highlight unmatched fields that were skipped (amber)
          for (const mapping of mappings) {
            if (mapping.source === 'unmatched') {
              const el = getRegisteredElement(mapping.selector)
              if (el) highlightElement(el, 'unmatched')
            }
          }

          sendResponse({ type: 'FILL_RESULT', payload: { results } })
        } catch (err) {
          console.error('[Swiftply] EXECUTE_FILL failed:', err)
          sendResponse({
            type: 'FILL_RESULT',
            payload: {
              results: [],
              error: 'Fill pipeline encountered an unexpected error.',
            },
          })
        }
      })()

      return true // async response
    }

    // ── UNDO_FILL ──────────────────────────────────────────────────────────
    if (parsed.data.type === 'UNDO_FILL') {
      try {
        undoFill()       // restore UNDO_SNAPSHOT values via setNativeValue
        clearHighlights() // remove all data-swiftply-highlight outlines
        sendResponse({ type: 'FILL_RESULT', payload: { results: [], undone: true } })
      } catch (err) {
        console.error('[Swiftply] UNDO_FILL failed:', err)
        sendResponse({ type: 'FILL_RESULT', payload: { results: [], undone: false } })
      }
      return false
    }

    return false
  })
}
