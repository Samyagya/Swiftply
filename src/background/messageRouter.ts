/**
 * messageRouter.ts — Routes messages between the popup and content script.
 *
 * Phase 3 responsibilities:
 *   SCAN_PAGE (popup → background):
 *     1. Inject the content script into the active tab (if not already injected)
 *     2. Forward SCAN_PAGE to the content script
 *     3. Return SCAN_RESULT back to the popup as the sendResponse value
 *
 * Phase 5 will extend this with EXECUTE_FILL / FILL_RESULT routing.
 *
 * All incoming messages are validated against MessageEnvelopeSchema before
 * processing — unknown or malformed messages are silently ignored (rules.md §2).
 *
 * Phase 3 implementation — see docs/features/04-field-scanner.md
 */

import { MessageEnvelopeSchema, FormField } from '../lib/types'

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

      default:
        return false
    }
  })
}
