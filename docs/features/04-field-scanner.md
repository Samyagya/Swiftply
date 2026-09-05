# Feature: Field Scanner (Content Script)

**Phase:** 3  
**Status:** 🔲 Not started  
**Depends on:** Phase 0 (manifest + injection setup), Phase 1 (Profile + FormField types)

---

## What this feature is

When the user clicks "Fill Application", the extension needs to know what input fields exist on the current page. The field scanner is a content script that walks the live DOM of a job application page and returns a structured list of detected form fields (`FormField[]`) — each with its selector, label, input type, and any contextual text nearby.

This is the "eyes" of the extension. Every later phase (matcher, filler, highlighter) operates on the list this scanner produces.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/content/fieldScanner.ts` | Implement | Core DOM-walking logic → `FormField[]` |
| `src/content/iframeBridge.ts` | Implement | Cross-frame scanning coordination |
| `src/content/index.ts` | Modify | Wire up `SCAN_PAGE` message listener; call scanner; post result |
| `src/background/messageRouter.ts` | Implement | Route `SCAN_PAGE` / `SCAN_RESULT` / `EXECUTE_FILL` / `FILL_RESULT` between popup ↔ content |
| `src/background/index.ts` | Modify | Import and start `messageRouter` |
| `src/popup/components/ProfileList.tsx` | Modify | "Fill Application" button → inject content script → trigger scan |

---

## Tech stack

| Concern | Approach | Why |
|---|---|---|
| Content script injection | `chrome.scripting.executeScript({ target: { tabId, allFrames: true } })` | Approved pattern (rules.md §1, user-approved in Phase 0). `allFrames: true` handles same-origin iframes without a separate iframe bridge. |
| Cross-origin iframes | Detect and skip (log warning) | Can't access cross-origin iframe DOMs — browser security boundary. See gotchas. |
| Message passing | `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` | Standard MV3 messaging. All messages validated with `MessageEnvelopeSchema` before acting (types.ts). |
| DOM querying | Plain DOM APIs (`querySelectorAll`, `getAttribute`, etc.) | No jQuery or third-party DOM helpers needed. |

---

## Planned implementation

### `fieldScanner.ts` — Core logic

```typescript
import { FormField } from '../lib/types'

export function scanFields(): FormField[]
```

**Scanning strategy:**

1. Query all `<input>`, `<select>`, `<textarea>` elements on the page.
2. Filter out:
   - `type="hidden"` (not user-facing)
   - `type="file"` (skip per rules.md §6 — cannot be autofilled)
   - `type="password"` (never fill — rules.md §1)
   - `type="submit"`, `type="reset"`, `type="button"`, `type="image"`, `type="checkbox"` (handled separately)
   - Any element with `aria-hidden="true"` or `display: none` (invisible)
3. For each remaining element, extract:
   - **`selector`:** A unique CSS selector (prefer `id`-based: `#element-id`. Fallback: positional nth-of-type path).
   - **`frameId`:** Always `0` for the main frame (iframeBridge handles other frames).
   - **`inputType`:** Map from `element.type` or tag name to the `FormField['inputType']` union.
   - **`label`:** See label extraction strategy below.
   - **`nearbyContext`:** Up to 120 chars of text from the nearest ancestor container that has only a few children.

**Label extraction (priority order):**
1. `<label>` with `for` attribute matching element's `id`
2. `aria-label` attribute on the element itself
3. `aria-labelledby` → resolve referenced element's `textContent`
4. `placeholder` attribute (fallback — often too generic, e.g. "Type here")
5. Previous sibling `textContent` if it's a `<label>`, `<span>`, or `<p>`
6. Nearest ancestor `<legend>` (for radio groups inside `<fieldset>`)
7. Closest `data-label` or `data-qa` attribute (seen on some custom ATS inputs)

**Custom dropdowns:**
- Some ATS platforms (Workday, Lever) use `<div role="combobox">` or `<div role="listbox">` instead of `<select>`. These should be detected as `inputType: 'custom-dropdown'` and included in the scan result — the filler will handle the click sequence in Phase 5.

### `iframeBridge.ts` — Cross-frame coordination

Same-origin iframes: `scripting.executeScript({ allFrames: true })` injects the scanner into all frames simultaneously. Each frame scans its own DOM and sends results back independently, tagged with the frame's `frameId`. The message router aggregates them.

Cross-origin iframes: Cannot be accessed. When a cross-origin iframe is detected, log a warning in the fill log: "⚠ Cross-origin iframe detected — fields inside may not be accessible." The user can fill those manually.

### `messageRouter.ts` — Background message routing

```typescript
// In background/messageRouter.ts
chrome.runtime.onMessage.addListener((rawMsg, sender, sendResponse) => {
  const result = MessageEnvelopeSchema.safeParse(rawMsg)
  if (!result.success) { ... return }
  
  switch (result.data.type) {
    case 'SCAN_RESULT': // aggregate frame results, forward to popup
    case 'EXECUTE_FILL': // forward fill command to active tab's content script
    case 'FILL_RESULT': // forward fill summary to popup
    ...
  }
})
```

All messages are validated with `MessageEnvelopeSchema` before the `switch`. Unknown message types are silently ignored (no crash).

---

## Key decisions to make before implementing

### D1: Unique selector strategy
How do you generate a stable, unique CSS selector for an element?
- **Option A:** `#id` if the element has an ID. Fragile if IDs are dynamic (React-generated IDs like `input-:r0:` change on re-render).
- **Option B:** Positional path: `form:nth-of-type(1) input:nth-of-type(3)`. Fragile if DOM mutates between scan and fill.
- **Option C:** Store a direct reference to the element (in content script memory, valid within the same script lifetime). Pass a numeric index into the scanned array. The filler uses the index to get the element reference directly — no re-querying needed.
- **Recommended: Option C** for Phase 3/5. Avoids the selector brittleness problem entirely. The `FormField.selector` field becomes an internal index (`"0"`, `"1"`, ...) interpreted by the filler, not a CSS selector.

### D2: When to re-scan vs. use cached results
If the user clicks "Fill Application" twice, should we re-scan? **Yes, always.** SPAs can mutate the DOM between fills. Caching scan results risks filling stale fields.

### D3: What to show in the popup while scanning?
The scan is synchronous within the content script but involves an async message round-trip. Show a loading spinner on the "Fill Application" button during the scan/match/fill pipeline. Duration should be < 500ms for most pages.

---

## Known gotchas

- **React-controlled inputs:** React intercepts native DOM events. Setting `element.value = 'x'` directly won't trigger React's `onChange` handler — the input appears filled visually but React's internal state is stale. Fix: use the `setNativeValue()` trick in Phase 5 (`Object.getOwnPropertyDescriptor` + `nativeInputValueSetter.call()`). The scanner doesn't need to worry about this — it's a filler concern.
- **Dynamic form generation:** Some ATS pages (especially Workday) generate form fields lazily as the user scrolls. A single scan at page load may miss fields that appear later. Phase 7 (multi-page) handles this with `MutationObserver`.
- **Shadow DOM:** Rare but possible. If a custom web component uses Shadow DOM, `querySelectorAll` won't find inputs inside it. For Phase 3, skip these and log a warning. Phase 7 can add `shadowRoot` traversal if needed.
- **Honeypot fields:** Some ATS forms include invisible/hidden fields to catch bots. These are caught by filtering for `display: none` and `visibility: hidden`. Always check `element.offsetParent !== null` as an additional visibility check.
