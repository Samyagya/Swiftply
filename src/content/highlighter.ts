/**
 * highlighter.ts — Visual feedback for filled / unmatched / failed fields.
 *
 * Uses CSS `outline` (NOT `border`) to avoid shifting host page layout.
 * design.md §5: outlines must not displace adjacent elements.
 *
 * Each highlighted element gets a `data-swiftply-highlight` attribute so
 * clearHighlights() can find and remove all of them without needing a
 * registry. This also survives cases where the FIELD_REGISTRY is stale.
 *
 * Highlight colors (design.md §4):
 *   filled    → green-500  (#22c55e)  — matched & written
 *   unmatched → amber-500  (#f59e0b)  — no profile value found
 *   failed    → red-500    (#ef4444)  — fill attempted but threw
 *
 * Phase 5 implementation.
 */

const HIGHLIGHT_ATTR = 'data-swiftply-highlight'

const OUTLINE: Record<'filled' | 'unmatched' | 'failed', string> = {
  filled:    '2px solid #22c55e',   // green-500 — matched & written
  unmatched: '2px dashed #d97706',  // amber-600 DASHED — design.md §5: dashed distinguishes "needs attention" from "done"
  failed:    '2px solid #ef4444',   // red-500 — fill attempted but threw
}

/**
 * Apply a coloured outline to a form field element.
 *
 * Stores the previous outline value in a data attribute so it can be
 * restored by clearHighlights() rather than hard-reset to 'none'
 * (in case the host page had its own outline style).
 */
export function highlightElement(
  el: HTMLElement,
  status: 'filled' | 'unmatched' | 'failed',
): void {
  try {
    // Preserve the element's original outline so we can restore it on undo
    if (!el.dataset.swiftplyPrevOutline) {
      el.dataset.swiftplyPrevOutline = el.style.outline
    }
    el.style.outline = OUTLINE[status]
    el.style.outlineOffset = '2px'
    el.setAttribute(HIGHLIGHT_ATTR, status)
  } catch (err) {
    // Never throw from a highlighter — cosmetic failures are not fatal
    console.warn('[Swiftply] highlightElement failed:', err)
  }
}

/**
 * Remove all Swiftply highlights from the page and restore original outlines.
 * Called on UNDO_FILL and on page navigation (PAGE_CHANGED).
 */
export function clearHighlights(): void {
  try {
    const highlighted = document.querySelectorAll<HTMLElement>(
      `[${HIGHLIGHT_ATTR}]`,
    )
    for (const el of highlighted) {
      el.style.outline = el.dataset.swiftplyPrevOutline ?? ''
      el.style.outlineOffset = ''
      el.removeAttribute(HIGHLIGHT_ATTR)
      delete el.dataset.swiftplyPrevOutline
    }
  } catch (err) {
    console.warn('[Swiftply] clearHighlights failed:', err)
  }
}
