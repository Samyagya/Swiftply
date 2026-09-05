# Swiftply — Project Tracker

> **How to use this file:** This is the at-a-glance status board for the Swiftply build.
> Update the status column and "Last updated" date at the end of each phase.
> For deep context on any feature (tech stack, decisions, gotchas), see `docs/features/`.

**Last updated:** 2026-09-05  
**Overall progress:** Phase 2 of 8 (Phases 0–1 complete)

---

## Phase Status

| # | Phase | Status | Key files |
|---|---|---|---|
| 0 | Project Scaffolding | ✅ Complete | `manifest.json`, `vite.config.ts`, `src/popup/Popup.tsx` |
| 1 | Profile Data Model & Storage | ✅ Complete | `src/lib/types.ts`, `src/lib/storage.ts`, `src/popup/components/ProfileForm.tsx`, `ProfileList.tsx` |
| 2 | Resume Parsing (PDF/DOCX) | 🔲 Not started | `src/lib/resumeParser/parsePdf.ts`, `parseDocx.ts`, `structureParser.ts` |
| 3 | Field Scanner (Content Script) | 🔲 Not started | `src/content/fieldScanner.ts`, `iframeBridge.ts`, `messageRouter.ts` |
| 4 | Heuristic Field Matcher | 🔲 Not started | `src/background/heuristicMatcher.ts`, `tests/heuristicMatcher.test.ts` |
| 5 | Field Filler + Highlighter | 🔲 Not started | `src/content/fieldFiller.ts`, `highlighter.ts`, `src/popup/components/FillButton.tsx` |
| 6 | LLM-Assisted Matching (Opt-In) | 🔲 Not started | `src/background/llmMatcher.ts` |
| 7 | Multi-Page / Multi-Step Apps | 🔲 Not started | `src/content/index.ts` (MutationObserver), `src/popup/Popup.tsx` (step banner) |
| 8 | Polish, Logging & Packaging | 🔲 Not started | `src/popup/components/FillLog.tsx`, icons, README, QA checklist |

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

### 🔲 Phase 2 — Resume Parsing
- [ ] Install `pdfjs-dist` and `mammoth`
- [ ] `parsePdf.ts` — extract raw text from PDF (pdfjs-dist, client-side)
- [ ] `parseDocx.ts` — extract raw text from DOCX (mammoth.js, client-side)
- [ ] `structureParser.ts` — regex/heading heuristics → `Partial<Profile>`
- [ ] "Upload Resume" button in ProfileForm → pre-fills form fields
- [ ] User reviews pre-filled data before saving

### 🔲 Phase 3 — Field Scanner
- [ ] `fieldScanner.ts` — walk DOM, extract `FormField[]` (skip password + file inputs)
- [ ] Label extraction: `<label for>`, `aria-label`, `aria-labelledby`, placeholder, nearby text
- [ ] `iframeBridge.ts` — same-origin iframe traversal; cross-origin via `allFrames`
- [ ] `messageRouter.ts` — typed message routing (popup ↔ background ↔ content)
- [ ] Background wires up `SCAN_PAGE` message handler
- [ ] Debug view in popup: raw `FormField[]` JSON dump
- [ ] Tested on Greenhouse + Lever — ≥ reasonable field coverage

### 🔲 Phase 4 — Heuristic Field Matcher
- [ ] `heuristicMatcher.ts` — keyword/regex map covering all `Profile` leaf fields
- [ ] Confidence scoring (0–1); auto-fill threshold = 0.6 (`constants.ts`)
- [ ] `heuristicMatcher.test.ts` — Vitest unit tests for all fields + edge cases
- [ ] Popup "Fill Application" → scan → match → display mapping in debug view
- [ ] ≥ 60% correct match rate on test sites (confirmed via debug view)

### 🔲 Phase 5 — Field Filler + Highlighter
- [ ] `fieldFiller.ts` — `setNativeValue()` (React-safe native setter, rules.md §6)
- [ ] Handles: text/email/tel/textarea → setNativeValue; native select → `.value + change`; custom dropdown → click sequence; file → skip + log
- [ ] `highlighter.ts` — 2px solid green-600 outline (filled); 2px dashed amber-600 (unmatched)
- [ ] Undo last fill — reverts all filled fields to pre-fill state
- [ ] Full pipeline wired end-to-end: click → scan → match → fill → highlight
- [ ] Fill summary in popup: "12 of 15 fields filled. 3 need your review."

### 🔲 Phase 6 — LLM-Assisted Matching
- [ ] `llmMatcher.ts` — sends field labels + minimal profile subset to Anthropic Claude
- [ ] BYO API key stored in `chrome.storage.local` (never hardcoded)
- [ ] Zod-validates LLM JSON response before use; falls back to "unmatched" on failure
- [ ] 8s timeout, 1 retry (constants.ts)
- [ ] Settings toggle in popup: off by default; privacy caption shown
- [ ] No data sent unless toggle is explicitly on
- [ ] ≥ 85% match rate on sites where heuristic < 70%

### 🔲 Phase 7 — Multi-Page / Multi-Step
- [ ] `MutationObserver` on main form container for step changes
- [ ] URL change detection (popstate / hashchange)
- [ ] `PAGE_CHANGED` message sent to popup → "New step detected" banner
- [ ] Optional "auto-fill each step" setting (off by default)
- [ ] Full Workday multi-step flow tested without context loss

### 🔲 Phase 8 — Polish, Logging & Packaging
- [ ] `FillLog.tsx` — session history, timestamps, what was filled where
- [ ] Error toasts for failed fills (no silent failures — rules.md §2)
- [ ] Final icons (proper design, not Phase 0 placeholder)
- [ ] README — complete install + BYO API key instructions
- [ ] Manual QA pass: Greenhouse, Lever, Workday, iCIMS, Taleo
- [ ] `npm run build` → package as zip for Chrome Web Store

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
| Greenhouse | — | Not yet |
| Lever | — | Not yet |
| Workday | — | Not yet (priority for Phase 7) |
| iCIMS | — | Not yet |
| Taleo | — | Not yet |
