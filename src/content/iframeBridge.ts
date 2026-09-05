/**
 * iframeBridge.ts — Detect cross-origin iframes on the current page.
 *
 * Same-origin iframes are handled automatically by scripting.executeScript
 * with allFrames: true — the content script runs inside them and scans
 * their DOM independently.
 *
 * Cross-origin iframes CANNOT be accessed (browser security boundary).
 * This module detects them and returns a warning so the debug view and
 * fill log can inform the user that some fields may be unreachable.
 *
 * Phase 3 implementation — see docs/features/04-field-scanner.md
 */

export interface IframeInfo {
  total: number
  crossOrigin: number
  warning: string | null
}

/**
 * Inspects all <iframe> elements in the current frame.
 * Returns counts and a user-readable warning if cross-origin frames exist.
 */
export function detectCrossOriginIframes(): IframeInfo {
  const iframes = Array.from(document.querySelectorAll('iframe'))
  let crossOrigin = 0

  for (const iframe of iframes) {
    try {
      // Accessing contentDocument on a cross-origin iframe throws a SecurityError
      // or returns null. Both indicate cross-origin.
      const doc = iframe.contentDocument
      if (doc === null) crossOrigin++
    } catch {
      crossOrigin++
    }
  }

  const warning =
    crossOrigin > 0
      ? `⚠ ${crossOrigin} cross-origin iframe${crossOrigin > 1 ? 's' : ''} detected on this page. Fields inside ${crossOrigin > 1 ? 'them' : 'it'} cannot be accessed due to browser security restrictions — please fill those manually.`
      : null

  return {
    total: iframes.length,
    crossOrigin,
    warning,
  }
}
