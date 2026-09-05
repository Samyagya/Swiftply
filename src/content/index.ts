/**
 * content/index.ts — Content script entry point.
 *
 * Injected on demand via chrome.scripting.executeScript() when the user
 * clicks "Fill Application" (NOT via a static content_scripts manifest entry).
 *
 * Listens for SCAN_PAGE messages from the background worker, runs the
 * field scanner, and responds with the results.
 *
 * Phase 3 implementation — see docs/features/04-field-scanner.md
 */

import { scanFields } from './fieldScanner'
import { detectCrossOriginIframes } from './iframeBridge'
import { MessageEnvelopeSchema } from '../lib/types'

// Prevent double-registration if the script is injected more than once
// into the same frame (e.g., user clicks Fill Application twice quickly).
if (!(window as Window & { __swiftplyLoaded?: boolean }).__swiftplyLoaded) {
  (window as Window & { __swiftplyLoaded?: boolean }).__swiftplyLoaded = true

  chrome.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
    const parsed = MessageEnvelopeSchema.safeParse(rawMsg)

    // Silently ignore messages not meant for us (e.g., from other extensions)
    if (!parsed.success) return false

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

      // Synchronous sendResponse — return false (no async needed)
      return false
    }

    return false
  })
}
