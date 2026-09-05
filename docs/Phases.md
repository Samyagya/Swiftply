# Phases.md — Swiftply Build Plan

Each phase should be completed, tested, and committed before moving to the next. Antigravity should update `memory.md` at the end of every phase (and ideally after every file it completes).

---

## Phase 0 — Project Scaffolding
**Goal:** Empty but runnable extension.
- Initialize Vite + React + TypeScript + CRXJS project.
- Set up Tailwind.
- Create `manifest.json` with minimal permissions (`storage`, `activeTab`, `scripting`).
- Create placeholder popup that just says "Swiftply" and loads correctly in `chrome://extensions`.
- Set up folder structure exactly as in Architecture.md.
- Copy the six planning docs into `/docs`.

**Done when:** Extension loads unpacked in Chrome with no console errors, popup renders.

---

## Phase 1 — Profile Data Model & Storage
**Goal:** User can create/edit/save a profile manually (no resume parsing yet).
- Implement `lib/types.ts` data models.
- Implement `lib/storage.ts` typed wrapper around `chrome.storage.local`.
- Build `ProfileForm.tsx` — manual entry form for contact info, work history, education, skills, links.
- Build `ProfileList.tsx` — list/select/delete saved profiles.
- Validate all form input with zod before saving.

**Done when:** User can create a profile manually, close the popup, reopen it, and see the saved profile persisted.

---

## Phase 2 — Resume Parsing (PDF/DOCX → Profile)
**Goal:** User can upload a resume file instead of manual entry.
- Integrate `pdf.js` for PDF text extraction.
- Integrate `mammoth.js` for DOCX text extraction.
- Build a basic parser (regex/section-heading based, NOT LLM yet) that maps extracted text into the `Profile` shape as a best-effort draft.
- Pre-fill `ProfileForm.tsx` with parsed data so user can review/correct before saving.

**Done when:** Uploading a sample PDF resume produces a reasonably accurate pre-filled profile form.

---

## Phase 3 — Field Scanner (Content Script)
**Goal:** Extension can detect and list all fillable fields on a real job application page.
- Build `content/fieldScanner.ts`: walk DOM, find `input`/`select`/`textarea`/ARIA-labeled custom dropdowns.
- Extract label text via `<label for>`, aria-label, placeholder, and nearby text-node heuristics.
- Handle `iframe` traversal (`iframeBridge.ts`) — start with same-origin iframes; note cross-origin iframe limitations.
- Return a normalized `FormField[]` list to the background worker via messaging.
- Build a temporary debug view in the popup that just dumps the detected field list as JSON, for testing.

**Done when:** On 2-3 real test sites (e.g., a Greenhouse job posting, a Lever posting), the debug view shows a reasonably complete/accurate field list.

---

## Phase 4 — Heuristic Field Matcher
**Goal:** Map detected fields to profile attributes without any LLM call.
- Build `background/heuristicMatcher.ts`: keyword/regex matching against label/name/id/placeholder (e.g., "first name" / "fname" / "given name" → `contact.firstName`).
- Build a matching confidence score; only auto-fill above a threshold, otherwise mark "unmatched."
- Wire up popup "Fill Application" button → triggers scan → match → returns mapping (still just logged/displayed, not yet filled into the page).

**Done when:** On test sites, 60%+ of fields get a correct heuristic match, confirmed via the debug view.

---

## Phase 5 — Field Filler + Highlighter
**Goal:** Actually fill the fields on the page.
- Build `content/fieldFiller.ts` using the React-safe `setNativeValue` method from rules.md.
- Handle native `<select>` vs custom dropdown components differently.
- Build `content/highlighter.ts`: green outline for filled fields, yellow for unmatched.
- Wire the full pipeline end-to-end: click "Fill Application" in popup → scan → match → fill → highlight.
- Add "Undo last fill" button that reverts filled fields to their previous (empty) state.

**Done when:** Clicking "Fill Application" on a real test site visibly and correctly fills matched fields, highlights results, and undo works.

---

## Phase 6 — LLM-Assisted Matching (Opt-In)
**Goal:** Improve match rate for fields the heuristic matcher missed.
- Build `background/llmMatcher.ts`: sends only unmatched field labels + relevant profile subset to Claude API.
- Add zod validation of the LLM's JSON response before using it.
- Add a settings toggle in the popup: "Enable AI-assisted matching (sends field labels to Anthropic)" — off by default, with a clear privacy explanation.
- Merge LLM-matched fields into the same fill pipeline from Phase 5.

**Done when:** On a test site with heuristic match rate <70%, enabling LLM-assist raises match rate to 85%+, with no data sent unless the toggle is explicitly on.

---

## Phase 7 — Multi-Page / Multi-Step Applications
**Goal:** Handle ATS wizards that span multiple pages/steps.
- Detect page/step changes (URL change or DOM mutation observer on the main form container).
- Re-run scan → match → fill automatically on each new step (still requires user to click "Fill" per step, or add an optional "auto-fill each step" setting — user's choice).
- Test specifically against Workday (iframe-heavy, multi-step) as the hardest case.

**Done when:** A full multi-step Workday application can be filled step-by-step without the extension breaking or losing profile context.

---

## Phase 8 — Polish, Logging, and Packaging
**Goal:** Ready for personal daily use / Chrome Web Store submission.
- Build `FillLog.tsx`: shows a session history of what was filled where, with timestamps.
- Add error toasts for failed fills (never a silent failure).
- Finalize icons, extension name, description per design.md.
- Write README with install/setup instructions.
- Do a manual QA pass against the top 5 target ATS platforms (Greenhouse, Lever, Workday, iCIMS, Taleo) using the checklist in `memory.md`.
- Package as a zip for Chrome Web Store submission (or keep as "load unpacked" for personal use).

**Done when:** Extension works reliably on daily real-world use across your own applications for at least a week.

---

## Phase Backlog (v2, not started until v1 is stable)
- Cover letter / free-text answer generation.
- Application tracker/dashboard.
- Firefox/Edge port.
