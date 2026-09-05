/**
 * fieldScanner.ts — Walk the DOM and extract all fillable form fields.
 *
 * Returns a FormField[] array describing every input the filler should consider.
 * Also maintains a module-level FIELD_REGISTRY mapping selector strings
 * ("field-0", "field-1", ...) to live HTMLElement references, so the filler
 * (Phase 5) can retrieve the element directly without re-querying the DOM.
 *
 * Selector strategy: index-based ("field-N") not CSS selectors. This avoids
 * brittleness with React-generated IDs (e.g. "input-:r0:") that change on
 * re-render. The filler calls getRegisteredElement(selector) to get the live ref.
 *
 * Phase 3 implementation — see docs/features/04-field-scanner.md
 */

import type { FormField } from '../lib/types'

// ---------------------------------------------------------------------------
// Module-level element registry
// Lives as long as the content script is alive (i.e. per page load).
// Re-populated on every call to scanFields().
// ---------------------------------------------------------------------------
const FIELD_REGISTRY = new Map<string, HTMLElement>()

/**
 * Retrieve a previously scanned element by its selector key.
 * Used by the filler (Phase 5) to get a live element reference.
 */
export function getRegisteredElement(selector: string): HTMLElement | null {
  return FIELD_REGISTRY.get(selector) ?? null
}

// ---------------------------------------------------------------------------
// Input type mapping
// ---------------------------------------------------------------------------

type InputType = FormField['inputType']

function resolveInputType(el: HTMLElement): InputType | null {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role')?.toLowerCase()

  // Custom dropdown (ARIA)
  if (role === 'combobox' || role === 'listbox') return 'custom-dropdown'

  if (tag === 'textarea') return 'textarea'
  if (tag === 'select') return 'select'

  if (tag === 'input') {
    const type = (el as HTMLInputElement).type.toLowerCase()
    switch (type) {
      case 'email': return 'email'
      case 'tel': return 'tel'
      case 'checkbox': return 'checkbox'
      case 'radio': return 'radio'
      case 'file': return 'file'
      // Skip entirely — not fillable
      case 'hidden':
      case 'password':
      case 'submit':
      case 'reset':
      case 'button':
      case 'image':
        return null
      default:
        return 'text' // text, number, url, search, date, month, etc.
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Visibility check
// ---------------------------------------------------------------------------

function isVisible(el: HTMLElement): boolean {
  // offsetParent is null for elements with display:none or inside a hidden ancestor
  if (el.offsetParent === null) {
    // Exception: fixed/sticky elements also have offsetParent=null but are visible
    const style = window.getComputedStyle(el)
    if (style.position !== 'fixed' && style.position !== 'sticky') return false
  }
  const style = window.getComputedStyle(el)
  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (style.opacity === '0') return false
  return true
}

// ---------------------------------------------------------------------------
// Label extraction — priority order (see docs/features/04-field-scanner.md)
// ---------------------------------------------------------------------------

function extractLabel(el: HTMLElement): string {
  const id = el.id

  // 1. <label for="id">
  if (id) {
    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`)
    if (labelEl) {
      const text = labelEl.textContent?.trim()
      if (text) return text
    }
  }

  // 2. aria-label
  const ariaLabel = el.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  // 3. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const refs = labelledBy
      .split(/\s+/)
      .map((refId) => document.getElementById(refId)?.textContent?.trim())
      .filter(Boolean)
    if (refs.length > 0) return refs.join(' ')
  }

  // 4. Previous sibling that looks like a label
  const prev = el.previousElementSibling
  if (prev) {
    const tag = prev.tagName.toLowerCase()
    if (['label', 'span', 'p', 'div', 'legend'].includes(tag)) {
      const text = prev.textContent?.trim()
      if (text && text.length < 80) return text
    }
  }

  // 5. Nearest ancestor <legend> (for fieldsets)
  const fieldset = el.closest('fieldset')
  if (fieldset) {
    const legend = fieldset.querySelector('legend')
    const text = legend?.textContent?.trim()
    if (text) return text
  }

  // 6. Nearest wrapping element that has a short text node before the input
  //    Walk up to 3 ancestors, look for a child text node before the input
  let ancestor = el.parentElement
  for (let depth = 0; depth < 3 && ancestor; depth++) {
    for (const child of ancestor.childNodes) {
      if (child === el || child.contains(el)) break
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim()
        if (text && text.length > 1 && text.length < 80) return text
      }
    }
    ancestor = ancestor.parentElement
  }

  // 7. placeholder as last resort
  const placeholder = el.getAttribute('placeholder')?.trim()
  if (placeholder) return placeholder

  // 8. data-label / data-qa attributes
  const dataLabel = el.getAttribute('data-label')?.trim() ?? el.getAttribute('data-qa')?.trim()
  if (dataLabel) return dataLabel

  return ''
}

// ---------------------------------------------------------------------------
// Nearby context extraction (up to 120 chars from nearest small container)
// ---------------------------------------------------------------------------

function extractNearbyContext(el: HTMLElement): string {
  // Walk up ancestors looking for a small container (< 5 children)
  let ancestor = el.parentElement
  for (let depth = 0; depth < 5 && ancestor; depth++) {
    if (ancestor.children.length <= 5) {
      const text = ancestor.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (text.length > 0 && text.length <= 200) {
        return text.slice(0, 120)
      }
    }
    ancestor = ancestor.parentElement
  }
  return ''
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scans the current document for fillable form fields.
 * Populates FIELD_REGISTRY with live element references.
 * Returns a FormField[] suitable for transmission to the background worker.
 */
export function scanFields(): FormField[] {
  // Clear previous scan's registry
  FIELD_REGISTRY.clear()

  // Query all candidate elements (includes custom ARIA dropdowns)
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'input, select, textarea, [role="combobox"], [role="listbox"]',
    ),
  )

  const fields: FormField[] = []
  let index = 0

  for (const el of candidates) {
    // Skip invisible elements
    if (!isVisible(el)) continue

    // Determine input type (returns null for types we skip entirely)
    const inputType = resolveInputType(el)
    if (inputType === null) continue

    const selector = `field-${index}`
    index++

    FIELD_REGISTRY.set(selector, el)

    const label = extractLabel(el)
    const nearbyContext = extractNearbyContext(el)

    fields.push({
      selector,
      frameId: 0, // main frame; allFrames injection gives each frame its own script
      label,
      inputType,
      nearbyContext: nearbyContext || undefined,
    })
  }

  return fields
}
