# Feature: Profile Data Model & Storage

**Phase:** 1  
**Status:** ✅ Complete  
**Build result:** `npm run build` — 0 errors, 0 warnings, ~2.13s

---

## What this feature is

The core data layer: the Profile schema (what a user's resume data looks like as structured JSON), the typed wrapper around Chrome's local storage, and the popup UI for creating and managing profiles manually.

This is the foundation every other phase builds on. The field scanner (Phase 3) produces `FormField[]`. The matchers (Phases 4–6) produce `FieldMapping[]`. The filler (Phase 5) consumes those mappings. All of those types are defined and validated here.

No resume parsing yet (that's Phase 2). No autofill yet. Just: "I can store my info and get it back."

---

## Files created / modified

| File | Role |
|---|---|
| `src/lib/types.ts` | Zod schemas + inferred TS types for all data models |
| `src/lib/constants.ts` | App-wide constants: storage keys, thresholds, limits |
| `src/lib/storage.ts` | Typed async wrapper around `chrome.storage.local` |
| `src/popup/Popup.tsx` | Updated: state-based routing between list ↔ form views |
| `src/popup/components/ProfileList.tsx` | Lists profiles, handles activate/delete |
| `src/popup/components/ProfileForm.tsx` | 7-section form for manual profile entry |

---

## Tech stack used

| Concern | Tool | Why |
|---|---|---|
| Schema definition | `zod` | Runtime validation on all data in/out of storage and all inter-process messages (rules.md §2) |
| Storage | `chrome.storage.local` | Native to extensions; isolated; survives profile restarts; async. Never `localStorage` (unreliable in extension contexts — rules.md §1) |
| UI | React + Tailwind | Consistent with overall stack (Architecture.md) |
| Icons | `lucide-react` | `design.md §6` specifies Lucide |
| ID generation | `crypto.randomUUID()` | Available in Chrome extension contexts; no dependency needed |

---

## Data model

### Profile (root entity)
```typescript
{
  id: string                 // crypto.randomUUID()
  name: string               // e.g. "Software Engineer — FAANG"
  contact: {
    firstName: string        // required
    lastName: string         // required
    email: string            // required, validated as email
    phone: string
    address?: string
    city?: string            // ⚠ extension beyond Architecture.md — see decisions
    state?: string           // ⚠ extension beyond Architecture.md
    zip?: string             // ⚠ extension beyond Architecture.md
    country?: string         // ⚠ extension beyond Architecture.md
  }
  links: {
    linkedin?: string
    github?: string
    portfolio?: string
  }
  workHistory: WorkEntry[]
  education: EducationEntry[]
  skills: string[]
  eeo?: {                    // optional — collapsible in form
    gender?: string
    race?: string
    veteranStatus?: string
    disabilityStatus?: string
  }
}
```

### WorkEntry
```typescript
{
  id: string
  company: string            // required
  title: string              // required
  startDate: string          // YYYY-MM (HTML month input format)
  endDate?: string           // YYYY-MM, absent if current = true
  current: boolean
  description?: string
}
```

### EducationEntry
```typescript
{
  id: string
  institution: string        // required
  degree?: string
  field?: string
  startDate?: string
  endDate?: string
  gpa?: string
}
```

---

## Key decisions & reasoning

### 1. Zod schemas as the source of truth (not TypeScript interfaces)
- **Decision:** Define Zod schemas first; derive TypeScript types from them via `z.infer<>`.
- **Why:** TypeScript types are erased at runtime. If data coming out of `chrome.storage.local` or from the LLM doesn't match what the type says, TypeScript won't catch it. Zod validates the actual values at the actual boundary. This is the rules.md §2 mandate: "Every message passed between popup/background/content must be validated with a zod schema before being acted on."
- **Impact:** Slightly more verbose than plain `interface` declarations, but provides a guarantee that storage-read data is actually the right shape before it reaches any component.

### 2. Validate on read AND write
- **Decision:** `saveProfile()` runs `ProfileSchema.parse()` before writing. `getProfiles()` runs `ProfileSchema.safeParse()` on each item before including it in the return value.
- **Why on write:** Prevents bad data from ever entering storage. If the form produces malformed data, it fails here before persisting.
- **Why on read:** Guards against storage data that was written by a previous version of the app with a different schema. Malformed entries are logged and skipped rather than crashing the whole profile list.
- **Impact:** If a future schema migration changes a field name, old profiles will be skipped (logged to `console.error`) until migrated. A migration utility can be added in Phase 8.

### 3. Extended `Profile.contact` with city, state, zip, country
- **Decision:** Added 4 fields beyond what Architecture.md's `Profile` interface specifies (`address?: string` was the only optional field there).
- **Why:** Greenhouse, Lever, Workday, iCIMS all ask for city, state/province, ZIP, and country as *separate* form fields — not as one combined address string. If the profile only stores one `address` string, the heuristic matcher (Phase 4) has nothing to fill those individual fields with. Storing them as separate leaf fields means the matcher can map `contact.city → "city" label`, `contact.state → "state/province" label`, etc.
- **Impact on Architecture.md:** This is a deliberate, minor extension. Architecture.md is treated as a minimum spec, not a strict ceiling.

### 4. Zod validation on Save only (not real-time per-keystroke)
- **Decision:** Validation runs when the user clicks "Save profile", not as they type.
- **Why:** Real-time validation on a form this large is annoying. If the user clicks into "First name" and immediately tabs away without typing, showing "First name is required" before they've had a chance to fill anything is bad UX. Validate once on save; keep errors visible until corrected.
- **Trade-off:** The user doesn't get instant feedback. Acceptable for a form with low submission frequency (not a search box).

### 5. No react-hook-form
- **Decision:** Pure React `useState` for all form state. Custom `setContact()`, `setLink()`, `setEEO()`, `updateWorkStr()`, `updateWorkCurrent()`, `updateEdu()` updater functions.
- **Why:** `react-hook-form` is not in the approved stack (Architecture.md / rules.md). Adding it requires flagging to the user per rules.md §4. For a form of this complexity (nested objects, dynamic arrays), the custom updater pattern is readable, strictly typed, and doesn't require an extra dependency.
- **Impact:** `ProfileForm.tsx` is longer than it would be with a form library (~300 lines vs ~150), but each updater function is a simple one-liner and all types are inferred correctly under `strict: true`.

### 6. Auto-activate newly created profile
- **Decision:** After creating a new profile (not editing), `saveProfile()` immediately calls `setActiveProfileId(profile.id)`.
- **Why:** The most common flow is "I just set up my info → I want to fill an application." Making the user click the new profile card to activate it is an unnecessary extra step. The active profile is what the Fill pipeline uses (Phase 5+), so activating on create is the right default.
- **Impact:** Editing an existing profile does NOT change the active profile — only creation does.

### 7. State-based routing (no React Router)
- **Decision:** Popup routing is handled with a single `view` state: `{ name: 'list' } | { name: 'form', editingProfile?: Profile }`.
- **Why:** The popup has exactly 2 views in Phase 1 (will gain 1–2 more in later phases). React Router adds significant bundle size and complexity for what amounts to 3 possible states. A union type is self-documenting and zero-cost.
- **Impact:** Adding new views is trivial — add a new union member and a new branch in the JSX.

### 8. Two-step delete confirm (no modal)
- **Decision:** Clicking the trash icon doesn't immediately delete. It replaces the card content with "Delete [name]? Cancel / Delete" inline text.
- **Why:** design.md §4 specifies this pattern. Avoids overlay modals (heavy) and browser `confirm()` dialogs (ugly, blocks the thread). The inline confirm is visually obvious and dismissable.

### 9. EEO section is collapsible
- **Decision:** The EEO/Demographic section is hidden behind a `<button>` toggle.
- **Why:** EEO questions are optional and sensitive. Many users won't fill them. Hiding them by default reduces visual noise and signals clearly that this section is optional — while still making it accessible.

---

## Storage layout

All data lives in `chrome.storage.local` under these keys (from `constants.ts`):

| Key | Value |
|---|---|
| `swiftply_profiles` | `Profile[]` — full array of all profiles |
| `swiftply_active_profile_id` | `string` — ID of the currently selected profile |
| `swiftply_settings` | `Settings` — `{ llmEnabled, llmApiKey }` |
| `swiftply_fill_log` | `FillLogEntry[]` — Phase 8 |

---

## Known gotchas

- **`chrome.storage.local` quota:** Chrome allows 10MB by default. A profile with many work entries + descriptions is unlikely to hit this, but it's worth noting for users with extremely large profiles.
- **Date format:** Work and education dates use the `YYYY-MM` format produced by `<input type="month">`. If the heuristic matcher (Phase 4) needs to fill a date field that expects a different format (e.g., `MM/YYYY` or `Jan 2020`), the value will need to be transformed before fill. Flag this in Phase 4.
- **EEO option values:** The dropdown options (e.g., "I am not a protected veteran") are hardcoded to the most common US ATS phrasing. Non-US ATS platforms or future ATS updates may use different strings. Phase 6 LLM matching should handle the fuzzy mapping.
