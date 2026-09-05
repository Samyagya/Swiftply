# Feature: Multi-Page / Multi-Step Application Support

**Phase:** 7  
**Status:** 🔲 Not started  
**Depends on:** Phase 5 (end-to-end fill pipeline working)

---

## What this feature is

Many ATS platforms (especially Workday) break a job application into multiple pages or steps. After the user fills step 1 and clicks "Next," the URL may or may not change, but the DOM definitely changes. This feature ensures Swiftply's scan/match/fill pipeline can handle these transitions without losing context.

**What "support" means:**
- Detect when the page transitions to a new step (DOM change or URL change).
- Show a "New step detected" banner in the popup.
- Allow the user to click "Fill this step" again (or optionally enable auto-fill-each-step).

**What it does NOT mean:**
- Automatic form submission (never — rules.md §1).
- Reading data from previous steps to inform current step filling.
- Tracking application progress across sessions.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/content/index.ts` | Modify | Add `MutationObserver` + `popstate`/`hashchange` listeners for step detection |
| `src/popup/Popup.tsx` | Modify | Show "New step detected" banner; optional auto-fill toggle |
| `src/lib/constants.ts` | Modify | Add `MUTATION_DEBOUNCE_MS = 500` |
| `src/lib/types.ts` | Modify (maybe) | Add `PAGE_CHANGED` to `MessageTypeSchema` (already done in Phase 1 planning) |

---

## Tech stack

| Concern | Approach | Why |
|---|---|---|
| Step change detection | `MutationObserver` on `document.body` | Catches SPA-style DOM mutations that don't change the URL |
| URL change detection | `window.addEventListener('popstate')` + `hashchange` | Catches real navigation events in SPAs (React Router, etc.) |
| Debouncing | 500ms debounce on mutation handler | Avoid flooding the background with `PAGE_CHANGED` messages during a rapid series of DOM updates (e.g. a form animating in) |
| Popup notification | `PAGE_CHANGED` message → popup banner | Non-intrusive; doesn't auto-fill; just informs the user |

---

## Planned implementation

### `content/index.ts` additions

```typescript
// After initial script injection, start watching for page changes.
let lastFormSignature = computeFormSignature()  // hash of visible form field IDs

const observer = new MutationObserver(
  debounce(() => {
    const newSig = computeFormSignature()
    if (newSig !== lastFormSignature) {
      lastFormSignature = newSig
      chrome.runtime.sendMessage({
        type: 'PAGE_CHANGED',
        payload: { reason: 'dom-mutation' }
      })
    }
  }, MUTATION_DEBOUNCE_MS)
)

observer.observe(document.body, { childList: true, subtree: true })

// Also watch for URL changes (SPA navigation)
window.addEventListener('popstate', () => {
  chrome.runtime.sendMessage({ type: 'PAGE_CHANGED', payload: { reason: 'url-change' } })
})
```

**`computeFormSignature()`:** Hash of all visible `input[name]` and `select[name]` values currently in the DOM. A change in this signature = new step. No need for a real cryptographic hash — a simple string concatenation of all name attributes, sorted, works.

### Popup banner

When the popup receives `PAGE_CHANGED`:
- Display a yellow banner below the header: "📄 New step detected — click Fill to continue"
- The banner is dismissable (×) and auto-clears after filling
- Does NOT auto-fill (the user must click "Fill Application" again)

### Optional "auto-fill each step" toggle (advanced setting)

If enabled, `PAGE_CHANGED` → automatically trigger the scan/match/fill pipeline without user action. This is an advanced mode:
- Off by default
- Shows clear warning: "Auto-fill will run on every detected step change on this tab"
- Does NOT submit forms (the "Next" / "Submit" button is never clicked programmatically — rules.md §1)

---

## Primary test target: Workday

Workday is the most complex multi-step ATS and the most common complaint in autofill extension reviews. Key characteristics:
- 4–6 application steps (basic info → work history → education → documents → questionnaire → review)
- URL changes between major steps
- Some steps use client-side routing (URL does NOT change)
- Heavy use of React + custom web components
- Custom dropdowns (`<div role="combobox">`) for almost all select-type fields
- Phone country code is a separate custom dropdown before the phone number field

**Workday-specific handling to research in this phase:**
- How does Workday's "Work History" step present — one entry at a time or all at once?
- Does Workday's "Address" step use a Google Maps autocomplete? (If so, requires click simulation, not just value setting)
- What's the MutationObserver signature that reliably detects step changes vs. simple UI animations?

---

## Key decisions to make before implementing

### D1: Should `PAGE_CHANGED` be observable from the popup while it's closed?
No. The popup is not always open. `PAGE_CHANGED` messages sent while the popup is closed are simply dropped (Chrome doesn't queue messages to closed popups). The content script doesn't need to know if the popup is open — it just sends the message and moves on.

The user will notice the new step when they re-open the popup (it will re-scan on open, or show the banner if a `PAGE_CHANGED` was recently received).

### D2: Should work history entries be carried across steps?
**Not in Phase 7.** Profile → work history is matched one entry at a time (whichever entry is currently visible). There's no "session context" between fills. If the user needs to fill three work history entries across three steps, they click "Fill" three times. This is the safest approach.

### D3: How to prevent infinite loops with MutationObserver?
When `fieldFiller.ts` writes values to inputs, it triggers `input` and `change` events. These events can cause React to re-render, which mutates the DOM, which fires the MutationObserver, which might falsely trigger a `PAGE_CHANGED` message.

**Fix:** Pause the MutationObserver during fill operations. Disconnect before fill → reconnect after fill complete.

---

## Known gotchas

- **Workday's custom phone field:** Workday's phone input is split into a country code custom dropdown and a number text input. The scanner needs to detect this pattern and handle the two fields as a pair.
- **Google Places autocomplete:** Some ATS forms use Google Places for address autocomplete. Programmatic value-setting on a Places input doesn't trigger the autocomplete selection — the field may appear filled but the form's hidden location data isn't set. The filler should detect Places inputs (look for `autocomplete="off"` + `goo-autocomplete` class or similar) and mark them as partially-fillable, prompting the user to select from the dropdown manually.
- **Captcha between steps:** Some ATS platforms (rare) show a CAPTCHA between application steps. The extension must never attempt to solve or bypass CAPTCHAs (rules.md §1). If a CAPTCHA is detected (by looking for known CAPTCHA iframe src patterns), show a banner: "CAPTCHA detected — please solve it manually before filling the next step."
