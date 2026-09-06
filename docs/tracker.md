# Swiftply — Project Tracker

> **How to use this file:** This is the at-a-glance status board for the Swiftply build.
> Update the status column and "Last updated" date at the end of each phase.
> For deep context on any feature (tech stack, decisions, gotchas), see `docs/features/`.

**Last updated:** 2026-09-06  
**Overall progress:** Phases 0–6 + Phase 8 complete. Phase 7 (multi-step) deferred to v1.1.

---

## Phase Status

| # | Phase | Status | Key files |
|---|---|---|---|
| 0 | Project Scaffolding | ✅ Complete | `manifest.json`, `vite.config.ts`, `src/popup/Popup.tsx` |
| 1 | Profile Data Model & Storage | ✅ Complete | `src/lib/types.ts`, `src/lib/storage.ts`, `src/popup/components/ProfileForm.tsx`, `ProfileList.tsx` |
| 2 | Resume Parsing (PDF/DOCX) | ✅ Complete | `src/lib/resumeParser/parsePdf.ts`, `parseDocx.ts`, `structureParser.ts` |
| 3 | Field Scanner (Content Script) | ✅ Complete | `src/content/fieldScanner.ts`, `iframeBridge.ts`, `messageRouter.ts` |
| 4 | Heuristic Field Matcher | ✅ Complete | `src/background/heuristicMatcher.ts`, `tests/heuristicMatcher.test.ts` |
| 5 | Field Filler + Highlighter | ✅ Complete | `src/content/fieldFiller.ts`, `highlighter.ts`, `src/popup/Popup.tsx` |
| 6 | LLM-Assisted Matching (Opt-In) | ✅ Complete | `src/background/llmMatcher.ts`, `manifest.json` (host_permissions) |
| 7 | Multi-Page / Multi-Step Apps | ⏭ Deferred (v1.1) | `src/content/index.ts` (MutationObserver), `src/popup/Popup.tsx` (step banner) |
| 8 | Polish, Logging & Packaging | ✅ Complete | `src/popup/components/FillLog.tsx`, `README.md` |

**Status key:** ✅ Complete · 🔄 In Progress · 🔲 Not started · ⛔ Blocked

---

## Feature Checklist (granular)

### ✅ Phase 0 — Project Scaffolding
- [x] Vite + React + TypeScript project initialized
- [x] CRXJS plugin (v2.0.0 stable) wired to `manifest.json`
- [x] Tailwind CSS with design-token theme (design.md colors, Inter font)
- [x] Manifest V3 — permissions: `storage`, `activeTab`, `scripting` (no `content_scripts`)
- [x] Popup renders with Swiftply header (Zap icon + Inter semibold)
- [x] Background service worker stub
- [x] Content script stub (on-demand injection, not static)
- [x] Full folder skeleton matching Architecture.md exactly
- [x] Extension icon (blue + lightning bolt)
- [x] `npm run build` → clean, 0 errors

### ✅ Phase 1 — Profile Data Model & Storage
- [x] `lib/types.ts` — Zod schemas (source of truth) for all data models
- [x] `lib/constants.ts` — storage keys, confidence threshold, LLM limits
- [x] `lib/storage.ts` — typed `chrome.storage.local` wrapper (validate on read + write)
- [x] Popup routing: list ↔ form views
- [x] `ProfileList` — card list, active-state, two-step delete confirm
- [x] `ProfileForm` — 7-section form (contact, links, work, education, skills, EEO)
- [x] Zod validation on Save; inline field errors; scroll-to-first-error
- [x] Auto-activates newly created profile
- [x] `npm run build` → clean, 0 errors

### ✅ Phase 2 — Resume Parsing
- [x] `pdfjs-dist` + `mammoth` installed
- [x] `parsePdf.ts` — extract raw text via pdfjs-dist (client-side, worker bundled)
- [x] `parseDocx.ts` — extract raw text via mammoth.js (fixed namespace import issue)
- [x] `structureParser.ts` — regex/heading heuristics → `Partial<Profile>`
- [x] "Upload Resume" button in ProfileForm → pre-fills form fields
- [x] User reviews pre-filled data before saving

### ✅ Phase 3 — Field Scanner
- [x] `fieldScanner.ts` — walks DOM, builds `FormField[]`, skips password + file inputs
- [x] Label extraction: `<label for>`, `aria-label`, `aria-labelledby`, placeholder, nearby text
- [x] `iframeBridge.ts` — same-origin iframe traversal; cross-origin detection + warning
- [x] `FIELD_REGISTRY` — index-based Map for live element references (used by Phase 5 filler)
- [x] `messageRouter.ts` — typed SCAN_PAGE / SCAN_RESULT routing
- [x] Debug view in popup (later replaced by Match Preview)

### ✅ Phase 4 — Heuristic Field Matcher
- [x] `heuristicMatcher.ts` — 24 ProfileKeys, 60+ keyword/regex patterns, confidence scoring
- [x] Confidence threshold 0.85 (label match) / 0.65 (context match); skips below 0.6
- [x] `resolveProfileValue()` exported for re-use by llmMatcher (Phase 6)
- [x] `tests/heuristicMatcher.test.ts` — 33 Vitest tests, all passing
- [x] File input fields explicitly excluded (`unmatched` — rules.md §3)
- [x] Match Preview in popup (green ✓ / grey ✗ rows, value preview, heuristic badge)

### ✅ Phase 5 — Field Filler + Highlighter
- [x] `fieldFiller.ts` — `setNativeValue()` (rules.md §6), native select, checkbox, custom dropdown
- [x] `UNDO_SNAPSHOT` — pre-fill values stored for `undoFill()`
- [x] `highlighter.ts` — 2px solid green outline (filled); 2px **dashed** amber-600 (unmatched); 2px solid red (failed)
- [x] `EXECUTE_FILL` / `UNDO_FILL` messages wired end-to-end (popup → background → content)
- [x] Fill Complete view: filled/skipped/failed counts, failure detail, Undo + Done buttons
- [x] File input + password input explicitly skipped

### ✅ Phase 6 — LLM-Assisted Matching
- [x] `llmMatcher.ts` — Claude haiku-3-5, 8s timeout, 1 retry, Zod response validation
- [x] Only unmatched field **labels** sent — no profile values, no page HTML
- [x] Value re-derived from local profile (Claude returns key, not value — hallucination-safe)
- [x] `manifest.json` — `host_permissions: ["https://api.anthropic.com/*"]`
- [x] Settings view: LLM toggle (off by default), API key with show/hide, privacy disclosure
- [x] Purple `ai` badge in Match Preview for LLM-matched fields
- [x] LLM failure non-fatal — graceful fallback to heuristic-only results

### ⏭ Phase 7 — Multi-Page / Multi-Step (DEFERRED to v1.1)
- [ ] MutationObserver on form container for step changes
- [ ] URL change detection (popstate / hashchange)
- [ ] PAGE_CHANGED message → popup banner
- [ ] Workday full multi-step flow tested

### ✅ Phase 8 — Polish, Logging & Packaging
- [x] `FillLogEntrySchema` in `types.ts`
- [x] `getFillLog()` / `saveFillLogEntry()` / `clearFillLog()` in `storage.ts` (FIFO 50-entry cap)
- [x] `FillLog.tsx` — day-grouped history, expandable failure detail, clear-with-confirm
- [x] Toast system in `Popup.tsx` for out-of-band errors (storage write fail, undo fail)
- [x] `highlighter.ts` — unmatched outline corrected to `dashed` per design.md §5
- [x] Clock (🕐) + Gear (⚙) icons in popup header → History + Settings views
- [x] `saveFillLogEntry` called on ResultView mount; errors surfaced via toast
- [x] `profileName` threaded through match → result flow for log entries
- [x] `README.md` — full rewrite: install, quick start, AI setup, limitations
- [x] `npm run build` → ✅ clean, 0 errors, 0 warnings

---

## Backlog (v2, not started until v1 ships)

- [ ] Cover letter / free-text answer generation (LLM + job description)
- [ ] Application tracker dashboard (company, role, date, status)
- [ ] Firefox / Edge port
- [ ] Duplicate-application detection ("Have you applied before?")

---

## ATS Test Coverage

| ATS | Phase tested | Result |
|---|---|---|
| Greenhouse | 3, 4 | Scan + match confirmed working during development |
| Lever | — | Not yet tested manually post-Phase 5 |
| Workday | — | Deferred — multi-step / iframe complexity is Phase 7 |
| iCIMS | — | Not yet tested |
| Taleo | — | Not yet tested |
