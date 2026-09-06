/**
 * fieldFiller.ts — Write profile values into detected form fields.
 *
 * CRITICAL: React-controlled inputs ignore plain `element.value = 'x'`.
 * setNativeValue() below bypasses React's synthetic event system by calling
 * the native value setter directly and then dispatching 'input' + 'change'
 * events. This is the only correct approach for React-based ATS platforms.
 * See rules.md §6.
 *
 * Fill strategies by element type:
 *   text / email / tel / url / number / search / textarea  → setNativeValue
 *   native <select>                                        → .value + change event
 *   custom dropdown ([role=combobox], [role=listbox], etc) → click-to-open + option click
 *
 * Every fill is wrapped in try/catch. A failed field logs its error but
 * never crashes the pipeline (rules.md §2).
 *
 * Undo: before overwriting each element, its current value is stored in
 * UNDO_SNAPSHOT. Call undoFill() to restore all values and clear the snapshot.
 *
 * Phase 5 implementation — see docs/features/06-field-filler.md
 */

import type { FieldMapping, FillResultEntry } from '../lib/types'
import { getRegisteredElement } from './fieldScanner'

// ---------------------------------------------------------------------------
// Module-level undo snapshot
// Keyed by selector; value is the element's value before we filled it.
// Cleared after undoFill() is called.
// ---------------------------------------------------------------------------
const UNDO_SNAPSHOT = new Map<string, string>()

// ---------------------------------------------------------------------------
// setNativeValue — rules.md §6
//
// Must be used for ALL text / textarea fills because React intercepts the
// standard value property setter and its synthetic event system won't fire
// unless we use the native prototype's setter.
// Calling the native setter then dispatching bubbling 'input' + 'change'
// events causes React / Vue / Angular to see the change as user-initiated.
// ---------------------------------------------------------------------------
function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto = Object.getPrototypeOf(el)
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ---------------------------------------------------------------------------
// snapshotElement — store original value for undo
// ---------------------------------------------------------------------------
function snapshotElement(selector: string, el: HTMLElement): void {
  if (UNDO_SNAPSHOT.has(selector)) return // already snapshotted from a previous fill

  if (el instanceof HTMLSelectElement) {
    UNDO_SNAPSHOT.set(selector, el.value)
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    UNDO_SNAPSHOT.set(selector, el.value)
  } else {
    // custom dropdown — snapshot its text content as a best-effort
    UNDO_SNAPSHOT.set(selector, el.textContent?.trim() ?? '')
  }
}

// ---------------------------------------------------------------------------
// Fill strategies
// ---------------------------------------------------------------------------

/** Fill a native <select> element. */
function fillSelect(el: HTMLSelectElement, value: string): void {
  // Try exact match first, then case-insensitive partial match
  const opts = Array.from(el.options)
  const exact = opts.find((o) => o.text.trim() === value || o.value === value)
  const fuzzy = opts.find((o) =>
    o.text.trim().toLowerCase().includes(value.toLowerCase()),
  )
  const target = exact ?? fuzzy

  if (!target) {
    throw new Error(`No matching option for value: "${value}"`)
  }

  el.value = target.value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Fill a custom dropdown (div/span styled as a select).
 * Strategy: click to open, wait for options to render, find by text, click it.
 * This is best-effort — some ATS-specific widgets may need siteOverrides.ts.
 */
async function fillCustomDropdown(el: HTMLElement, value: string): Promise<void> {
  // 1. Click to open
  el.click()
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

  // 2. Wait for dropdown panel to render
  await new Promise<void>((resolve) => setTimeout(resolve, 80))

  // 3. Find option by text match — look in common option roles/patterns
  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    'li[data-value]',
    'li',
  ]

  let matched: Element | null = null

  for (const sel of optionSelectors) {
    const candidates = Array.from(document.querySelectorAll(sel))
    const exact = candidates.find(
      (c) => c.textContent?.trim() === value,
    )
    const fuzzy = candidates.find((c) =>
      c.textContent?.trim().toLowerCase().includes(value.toLowerCase()),
    )
    matched = exact ?? fuzzy ?? null
    if (matched) break
  }

  if (!matched) {
    // Close the dropdown by pressing Escape, then throw
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    throw new Error(`No matching option for value: "${value}"`)
  }

  // 4. Click the matched option
  ;(matched as HTMLElement).click()
  matched.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

// ---------------------------------------------------------------------------
// fillField — per-element dispatcher
// ---------------------------------------------------------------------------

async function fillField(
  selector: string,
  el: HTMLElement,
  value: string,
): Promise<FillResultEntry> {
  try {
    snapshotElement(selector, el)

    if (el instanceof HTMLSelectElement) {
      fillSelect(el, value)
    } else if (
      el instanceof HTMLInputElement &&
      (el.type === 'checkbox' || el.type === 'radio')
    ) {
      // Checkbox: set checked if value is truthy ('true', 'yes', '1', 'on')
      const truthy = /^(true|yes|1|on)$/i.test(value.trim())
      if (el.checked !== truthy) {
        el.click()
      }
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setNativeValue(el, value)
    } else {
      // Custom dropdown or unknown element
      await fillCustomDropdown(el, value)
    }

    return { selector, status: 'filled' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Swiftply] Failed to fill "${selector}":`, err)
    return { selector, status: 'failed', error: message }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill all matched fields from the mapping list.
 *
 * Only attempts fields where source === 'heuristic' (or 'llm' in Phase 6)
 * and value is non-empty. Skips 'unmatched' fields and file inputs.
 *
 * @returns FillResultEntry[] — one entry per mapping, in order.
 */
export async function fillFields(mappings: FieldMapping[]): Promise<FillResultEntry[]> {
  const results: FillResultEntry[] = []

  for (const mapping of mappings) {
    // Never attempt unmatched fields or empty values
    if (mapping.source === 'unmatched' || !mapping.value.trim()) {
      results.push({ selector: mapping.selector, status: 'skipped' })
      continue
    }

    // Retrieve the live element from the Phase 3 registry
    const el = getRegisteredElement(mapping.selector)
    if (!el) {
      results.push({
        selector: mapping.selector,
        status: 'failed',
        error: 'Element no longer in DOM — page may have changed',
      })
      continue
    }

    // rules.md §3: never fill file inputs
    if (el instanceof HTMLInputElement && el.type === 'file') {
      results.push({ selector: mapping.selector, status: 'skipped' })
      continue
    }

    // rules.md §3: never fill password inputs
    if (el instanceof HTMLInputElement && el.type === 'password') {
      results.push({ selector: mapping.selector, status: 'skipped' })
      continue
    }

    const result = await fillField(mapping.selector, el, mapping.value)
    results.push(result)
  }

  return results
}

/**
 * Undo all fills performed since the last fillFields() call.
 * Restores original values from UNDO_SNAPSHOT and clears the snapshot.
 * Must be called before clearHighlights() in the UNDO_FILL handler.
 */
export function undoFill(): void {
  for (const [selector, originalValue] of UNDO_SNAPSHOT) {
    try {
      const el = getRegisteredElement(selector)
      if (!el) continue

      if (el instanceof HTMLSelectElement) {
        el.value = originalValue
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        setNativeValue(el, originalValue)
      }
      // custom dropdowns: best-effort — no reliable programmatic undo
    } catch (err) {
      console.error(`[Swiftply] Undo failed for "${selector}":`, err)
    }
  }
  UNDO_SNAPSHOT.clear()
}
