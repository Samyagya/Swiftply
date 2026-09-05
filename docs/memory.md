# memory.md — Swiftply Project Memory

> **Instructions for Antigravity:** Update this file at the end of every work session, and ideally after completing each individual file. This is the single source of truth for "what's done, what's in progress, and why decisions were made" — read it fully before starting any new session so context isn't lost between sessions.

---

## Status Summary
- **Current phase:** Phase 2 — Resume Parsing (not yet started)
- **Last updated:** 2026-09-05
- **Currently working on file:** _(Phase 1 complete — ready for Phase 2)_

---

## Completed

### Phase 0 — Project Scaffolding ✅
- [x] `package.json` — deps, `engines: {node: ">=18"}`, `"type": "module"`
- [x] `vite.config.ts` — CRXJS v2 stable + @vitejs/plugin-react
- [x] `tsconfig.json` — strict mode, bundler moduleResolution, chrome types
- [x] `tsconfig.node.json` — for vite.config.ts compilation
- [x] `tailwind.config.js` — design.md color tokens, Inter font, popup width 380px
- [x] `postcss.config.js` — tailwind + autoprefixer
- [x] `manifest.json` — MV3, permissions: storage/activeTab/scripting, NO content_scripts
- [x] `src/styles/globals.css` — Inter 400/500/600, Tailwind directives, base reset
- [x] `src/popup/index.html` — popup HTML shell
- [x] `src/popup/main.tsx` — React root mount
- [x] `src/popup/Popup.tsx` — placeholder UI (Zap icon + "Swiftply" title, 380px)
- [x] `src/background/index.ts` — stub service worker
- [x] `src/content/index.ts` — stub content script (on-demand injection)
- [x] All stub files for Phase 1–8 folder structure (17 files)
- [x] `public/icons/icon16.png`, `icon48.png`, `icon128.png` — generated icon
- [x] `README.md` — setup instructions, load-in-Chrome steps, tech stack
- [x] `npm run build` — ✅ clean, 0 errors, 0 warnings, 1.85s build time

---

## In Progress
_(Nothing — Phase 0 complete.)_

---

## Decisions Log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-09-05 | Chosen tech stack: React + TS + Vite (CRXJS) + Tailwind + chrome.storage.local | See Architecture.md — fast to vibe-code, minimal moving parts, no backend needed for v1 |
| 2026-09-05 | No auto-submit feature, ever, without explicit separate approval | Ethical/safety guardrail — see rules.md §1, §4 |
| 2026-09-05 | LLM-assisted field matching is opt-in, off by default | Privacy-first default; user must consciously enable sending any data externally |
| 2026-09-05 | File upload fields will not be auto-filled | Browser security blocks this at the platform level; not worth trying to hack around |
| 2026-09-05 | No static `content_scripts` in manifest.json | User-approved change: use `activeTab` + `chrome.scripting.executeScript()` on demand to avoid broad host-permission warning. Aligns with Architecture.md "prefer activeTab" guidance. |
| 2026-09-05 | Added `lucide-react` dep | design.md §6 explicitly calls for Lucide icons; not blocked by rules.md. Flagged and approved. |
| 2026-09-05 | Added `@fontsource/inter` dep | design.md §2 calls for Inter; bundled locally keeps it offline (no network call). Flagged and approved. |
| 2026-09-05 | Added `zod` dep | rules.md §2 mandates zod for all message/LLM validation. Not in Architecture.md stack table but not a conflict. |
| 2026-09-05 | Added `structureParser.ts` to resumeParser/ (not in Architecture.md) | `parsePdf.ts` extracts raw text; a separate module for structure heuristics keeps each file focused (rules.md §5: one module per file). Will be created in Phase 2. |
| 2026-09-05 | Upgraded `@crxjs/vite-plugin` from `@beta` to stable `^2.0.0` | npm install warned that beta is no longer maintained; stable 2.0.0 exists. Same major version, safe upgrade. No stack change flagged to user as this is a patch-level maintenance fix. |
| 2026-09-05 | Added `"type": "module"` to package.json | Silences Node ESM detection warning from postcss.config.js. Required since all config files use ESM syntax. |
| 2026-09-05 | BYO API key strategy for LLM-assisted matching | User confirmed: Anthropic API key stored in chrome.storage.local, never hardcoded. No backend required. |
| 2026-09-05 | Extended `Profile.contact` with city, state, zip, country | Architecture.md shows only address; these 4 fields are asked separately by most ATS platforms (Greenhouse, Workday, Lever). Having them as discrete fields enables individual heuristic matching in Phase 4. |
| 2026-09-05 | No react-hook-form; pure React state for ProfileForm | Avoids adding an unapproved library (rules.md §4). Form is complex but not so dynamic that hook-form is required; the `setTop/setContact/setLink/setEEO` pattern is readable and strict-mode-safe. |
| 2026-09-05 | Zod validation on Save only (not real-time) | Real-time validation on empty fields is annoying UX — fields get flagged before user has a chance to type. Validate on submit, then keep errors visible until corrected. |

---

## Known Issues / Blockers

| Issue | Status |
|---|---|
| 5 npm audit vulnerabilities (3 moderate, 1 high, 1 critical) | In dev deps (Vite/CRXJS ecosystem). Not user-facing. Will revisit before Phase 8 / Web Store submission. |

---

## Test Site Notes
Track ATS-specific quirks discovered during testing here, so heuristics/overrides can reference this instead of getting rediscovered each time.

| ATS | Notes |
|---|---|
| Greenhouse | _(not yet tested)_ |
| Lever | _(not yet tested)_ |
| Workday | _(not yet tested — expect iframe + custom dropdown complexity, see Phase 7)_ |
| iCIMS | _(not yet tested)_ |
| Taleo | _(not yet tested)_ |

---

## Open Questions Carried Forward
- Do we support Google Sheets/Notion as an alternate profile data source? (from PRD.md §10)
- Do we charge for LLM-assisted matching, or require BYO API key? → **Resolved: BYO API key**

---

## Session Log

**2026-09-05 (Session 1)** — Initial planning docs created (PRD, Architecture, rules, Phases, design, memory). No code written yet. Next session should start at Phase 0.

**2026-09-05 (Session 2)** — Phase 0 complete. Scaffolded full project: package.json, Vite+CRXJS config, Tailwind, Manifest V3 (no content_scripts), popup (Popup.tsx), background stub, content stub, all folder-structure stubs per Architecture.md, icon generated. `npm run build` passes clean with 0 errors, 0 warnings. Ready for Phase 1.

**2026-09-05 (Session 3)** — Phase 1 complete. Implemented: types.ts (Zod schemas + inferred types), constants.ts, storage.ts (typed chrome.storage.local wrapper), Popup.tsx (routing), ProfileList.tsx (card list, two-step delete), ProfileForm.tsx (7-section form, Zod validation, sticky footer, CREATE+EDIT modes). `npm run build` clean at 2.13s. Ready for Phase 2.
