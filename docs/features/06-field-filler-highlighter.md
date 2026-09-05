# Feature: Field Filler + Highlighter

**Phase:** 5  
**Status:** 🔲 Not started  
**Depends on:** Phase 3 (fieldScanner), Phase 4 (heuristicMatcher), Phase 1 (FieldMapping type)

---

## What this feature is

The filler takes the `FieldMapping[]` produced by the matcher and actually writes the values into the DOM — triggering the correct native events so that React/Vue/Angular-powered ATS forms accept the input. The highlighter then adds a visual overlay so the user can see at a glance what was filled, what was skipped, and what needs their attention.

After this phase, the core autofill loop is complete end-to-end.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/content/fieldFiller.ts` | Implement | Writes values to DOM; handles text/select/custom-dropdown; skips file |
| `src/content/highlighter.ts` | Implement | Adds visual highlight outline to filled/unmatched fields |
| `src/popup/components/FillButton.tsx` | Implement | "Fill Application" button + loading state + result summary |
| `src/popup/components/FillLog.tsx` | Stub (Phase 8) | Detailed log placeholder |
| `src/popup/Popup.tsx` | Modify | Wire FillButton → scan → match → fill pipeline |

---

## Tech stack

| Concern | Approach | Why |
|---|---|---|
| React-safe value setting | `setNativeValue()` — native setter via `Object.getOwnPropertyDescriptor` | React overrides `input.value` setter. Calling the native setter bypasses React's overrider and dispatches real `input`/`change` events that React's synthetic event system picks up. Standard approach in the automation community. |
| `<select>` filling | Set `.value` then dispatch `change` event | Native selects don't use React internals for value binding; a synthetic `change` event is sufficient. |
| Custom dropdowns | Click → wait for option list → click option | Custom dropdowns (`<div role="combobox">`) are triggered by click/keyboard events. The filler must simulate a click on the trigger, wait for the option list to appear (`MutationObserver` or fixed delay), then click the best-matching option. |
| Highlighting | CSS `outline` property (not `border`) | `outline` doesn't affect layout (doesn't push content around). `border` does. Use outline to avoid breaking the form's own visual layout. |
| Undo | Snapshot of `{ selector, previousValue }[]` before fill; stored in content script closure | Allows a single-step undo. Does not need to be persisted (extension memory only). |

---

## Planned implementation

### `setNativeValue()` — the React-safe setter

```typescript
// In fieldFiller.ts
function setNativeValue(element: HTMLInputElement, value: string): void {
  // Get the native (pre-React-override) value setter
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'value'
  )?.set

  if (!nativeSetter) {
    // Fallback: direct assignment (works for non-React forms)
    element.value = value
  } else {
    nativeSetter.call(element, value)
  }

  // Dispatch the events React's synthetic event system listens for
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}
```

> **Why `bubbles: true`:** React attaches event listeners at the document root (event delegation). Events must bubble up from the element to reach React's handler.

### `fillField()` — per-field dispatch

```typescript
export async function fillField(
  element: HTMLElement,
  inputType: FormField['inputType'],
  value: string
): Promise<'filled' | 'skipped' | 'error'>
```

- `text / email / tel / textarea` → `setNativeValue(el as HTMLInputElement, value)`
- `select` → find matching option, set `.value`, dispatch `change`
- `custom-dropdown` → click trigger element, wait 300ms for option list, click matching option
- `checkbox` → if value is truthy/`'true'`/`'yes'`, set `checked = true` + dispatch `change`
- `radio` → find the `<input type="radio">` in the group whose label matches value, check it
- `file` → **always skip** (rules.md §6 — no file upload automation)

### `highlighter.ts` — Visual feedback

After all fills complete, iterate over every mapped field:

- **Filled (source: heuristic | llm):** `outline: 2px solid #16a34a` (green-600) + `outline-offset: 2px`
- **Unmatched:** `outline: 2px dashed #d97706` (amber-600) + `outline-offset: 2px`

Also inject a small floating badge count: "✓ 12 filled · ⚠ 3 need review" (top-right of viewport, auto-dismiss after 5s).

### `FillButton.tsx` — Popup fill trigger

States:
1. **Idle:** "Fill Application" (blue, enabled if active profile exists and tab is a known job page)
2. **Scanning…:** Spinner + "Scanning page…"
3. **Filling…:** Spinner + "Filling fields…"
4. **Done:** "✓ 12 of 15 filled" (green text, no spinner)
5. **Error:** "Something went wrong" (red text, retry link)

---

## Fill pipeline (end-to-end)

```
User clicks "Fill Application" (FillButton)
  → background: chrome.scripting.executeScript({ files: ['content/index.js'], allFrames: true })
  → content script: scanFields() → FormField[]
  → content → background: SCAN_RESULT message
  → background: heuristicMatcher(fields, activeProfile) → FieldMapping[]
    → (if LLM enabled and Phase 6 complete): llmMatcher(unmatchedFields, profile) → FieldMapping[]
  → background → content: EXECUTE_FILL message with FieldMapping[]
  → content: fillField() for each mapping
  → content: highlighter.highlight(results)
  → content → background → popup: FILL_RESULT summary
  → FillButton shows "12 of 15 filled"
```

---

## Key decisions to make before implementing

### D1: Async timing for custom dropdowns
Custom dropdowns don't open synchronously. After clicking the trigger, we need to wait for the option list to appear. Two options:
- **Fixed delay:** `await sleep(300)` — simple but fragile (some dropdowns are slower).
- **MutationObserver:** Watch the DOM for the option list to appear, with a 2s timeout. More robust.
- **Recommendation:** Use MutationObserver with a 2s timeout fallback. Log a warning if timeout is hit.

### D2: Undo mechanism
The undo should be scoped to the last fill session only (not persistent). On "Undo last fill":
1. Content script replays the snapshot (set previous values).
2. Removes all highlight outlines.
3. Popup returns to "Fill Application" idle state.

### D3: What counts as a "filled" field for the summary?
- `filled` → the value was written and events dispatched without throwing
- `skipped` → `file` input or no value in profile for that field
- `error` → exception during fill (log to console.error, mark as unmatched in highlight)

---

## Known gotchas

- **Multi-select:** `<select multiple>` requires setting multiple options' `selected` property, not just `.value`. Detect via `element.multiple`. Profile `skills[]` is the likely source of values.
- **Autofill detection countermeasures:** Some sites (especially banking forms, not ATS typically) actively fight programmatic input. They listen for `isTrusted: false` on events. Our dispatched events have `isTrusted: false` (browser security — can't fake trusted events from extensions). This is a known limitation and acceptable per rules.md.
- **Tab order / focus:** Some React-heavy forms validate on blur. After `setNativeValue`, dispatch a `blur` event if the field has `onBlur` validation (detect by observing the form's behavior on first test run).
- **Number inputs:** `<input type="number">` for things like "Years of experience" — if the profile value is not a valid number string, the input will silently reject it. Sanitize before filling.
