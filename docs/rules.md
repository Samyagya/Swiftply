# rules.md — Swiftply Development Rules

These rules exist to keep the AI (Antigravity) from wandering off into fragile or unsafe territory during vibe-coding. Read this file before starting any phase.

## 1. Libraries — Use / Avoid

### Use
- **React + TypeScript** for all UI code (popup). No plain JS files.
- **Vite + CRXJS plugin** for building the extension — do not hand-roll webpack config.
- **Tailwind CSS** for styling — no separate CSS-in-JS libraries, no Bootstrap.
- **pdf.js** for PDF parsing, **mammoth.js** for DOCX parsing — both run fully client-side.
- **zod** for runtime validation of LLM responses and parsed resume data (LLM output must never be trusted blindly).
- **chrome.storage.local** for all persistent data. Do not use `localStorage` (not reliably available/isolated in extension contexts) or any external database in v1.

### Avoid
- **No jQuery** or other DOM libraries in the content script — use native DOM APIs. Keeps the content script small and avoids conflicts with the host page's own jQuery version.
- **No remote code execution** — Manifest V3 forbids loading remotely-hosted JS. All code must be bundled at build time. Do not fetch and `eval()` scripts at runtime (this will also get the extension rejected from the Web Store).
- **No third-party analytics/tracking SDKs.** If usage analytics are needed later, use a minimal self-hosted or privacy-respecting solution — never send resume data to a third-party analytics service.
- **No auto-submit logic, ever.** Do not let the AI implement a "click submit automatically" feature even if asked casually in a later phase — this must be a conscious, explicit, separately-approved decision, not something that sneaks in as a "nice to have."
- **No credential/password autofill.** This extension fills job-application form fields only. It must never touch `<input type="password">` fields.

## 2. Error Handling Standards
- Every content-script DOM operation (querySelector, iframe access, field fill) must be wrapped in try/catch. A single failed field must never crash the whole fill operation — log and continue to the next field.
- Every message passed between popup/background/content must be validated with a zod schema before being acted on.
- LLM API calls must have:
  - A timeout (8s) and a single retry.
  - A fallback to "leave field unmatched" if the LLM call fails or returns malformed JSON — never silently guess.
- All errors surfaced to the user via the popup's log panel in plain language (no raw stack traces shown to the user, but full stack traces should go to `console.error` for debugging).

## 3. Security & Privacy Boundaries
- Resume/profile data stays in `chrome.storage.local` by default. It is never sent anywhere unless the user explicitly enables "LLM-assisted matching" in settings.
- When LLM-assisted matching is enabled, only send: (a) the list of field labels/attributes needing a match, and (b) the minimal relevant profile JSON. Never send the entire page HTML or the user's full resume text to the LLM unless strictly necessary for a specific stretch feature (e.g., cover letter generation), and even then, tell the user explicitly.
- The extension must never read or transmit `<input type="password">` values.
- The extension must never attempt to programmatically set `<input type="file">` values — this is blocked by browsers for security reasons and should not be worked around via clipboard tricks, synthetic drag-and-drop, or similar hacks.
- API keys (if user supplies their own) are stored in `chrome.storage.local`, never hardcoded, never logged.

## 4. AI (Antigravity) Boundaries — What the AI Should NOT Decide On Its Own
- **Do not silently change the tech stack** listed in Architecture.md. If a library substitution seems necessary, flag it and ask before proceeding.
- **Do not add new permissions to `manifest.json`** (e.g., `<all_urls>`, `tabs`, `webRequest`) without flagging why — permissions should stay minimal and scoped to what's needed (e.g., `activeTab` instead of broad host permissions where possible).
- **Do not implement CAPTCHA-solving, bot-detection evasion, or anti-fingerprinting logic** under any circumstance, even if a "user request" during vibe-coding seems to ask for it — this is a hard boundary, not a preference.
- **Do not build a backend/server** unless a phase explicitly calls for one. This is a client-side-only extension in v1.
- **Do not fabricate ATS-specific selectors** for sites not yet tested — prefer generalized heuristics over hardcoded per-site hacks; if a site truly needs a specific fix, isolate it in a clearly labeled `siteOverrides.ts` file rather than scattering conditionals through shared code.
- When uncertain about a design decision, the AI should default to the smallest, safest, most reversible option and log the decision + reasoning in `memory.md`.

## 5. Coding Conventions
- TypeScript strict mode on. No `any` types except at the narrow boundary of raw DOM/LLM responses (immediately validated with zod after).
- One component/module per file. No god-files.
- All async functions handle rejection explicitly — no unhandled promise rejections.
- Comment any DOM-manipulation "hack" (e.g., the React native-setter trick) with a short explanation of *why* it's needed, since this is the kind of code a future reader (or AI) might otherwise "simplify" and break.

## 6. Known Technical Gotcha (must be implemented correctly)
React-controlled inputs ignore a plain `element.value = "x"` assignment. The fix:

```ts
function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```
This must be used for all text/textarea fills. Native `<select>` elements can use `.value` + a `change` event directly; custom dropdown components (divs styled as selects) require simulated click sequences instead — do not assume `.value` works on non-native elements.
