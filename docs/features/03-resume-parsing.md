# Feature: Resume Parsing (PDF / DOCX → Profile)

**Phase:** 2  
**Status:** 🔲 Not started  
**Depends on:** Phase 1 (Profile schema, ProfileForm pre-fill API)

---

## What this feature is

Allows the user to upload their existing resume file (PDF or DOCX) instead of typing their information manually. The extension parses the file client-side, extracts text, runs structural heuristics to map sections to the `Profile` shape, and pre-fills the `ProfileForm` for the user to review and correct before saving.

**Key constraint:** This is a best-effort draft — NOT a perfect parse. The user always reviews and saves manually. The parser never auto-saves.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/lib/resumeParser/parsePdf.ts` | Implement | PDF → raw text string (via `pdfjs-dist`) |
| `src/lib/resumeParser/parseDocx.ts` | Implement | DOCX → raw text string (via `mammoth.js`) |
| `src/lib/resumeParser/structureParser.ts` | **NEW** (not in Architecture.md) | Raw text → `Partial<Profile>` via section-heading heuristics |
| `src/popup/components/ProfileForm.tsx` | Modify | Add "Upload Resume" button; pre-fill form on parse result |
| `package.json` | Modify | Add `pdfjs-dist` and `mammoth` dependencies |

> **Why `structureParser.ts` is new:** Architecture.md groups all resume parsing under `parsePdf.ts` / `parseDocx.ts`, but mixing text-extraction logic (library-specific) with structural-parsing logic (heuristic regex) in the same file would violate rules.md §5 ("one module per file, no god-files"). Keeping them separate makes each file testable and swappable independently.

---

## Tech stack

| Concern | Library | Why |
|---|---|---|
| PDF text extraction | `pdfjs-dist` | Mozilla's pdf.js — runs fully client-side (WASM), no server needed; the standard choice for in-browser PDF parsing |
| DOCX text extraction | `mammoth` | Produces clean plain text or markdown from DOCX; lightweight; widely used; runs client-side |
| Structure parsing | Custom regex + section-heading heuristics | NO LLM in Phase 2 — keeps the feature free, offline, and fast. LLM-assisted parsing is a Phase 6+ stretch goal |

---

## Planned implementation

### `parsePdf.ts`
```typescript
// Accepts a File object from the browser file picker.
// Returns raw text string (all pages concatenated).
// Uses pdfjs-dist with the bundled worker.
export async function parsePdf(file: File): Promise<string>
```

Key notes:
- The pdf.js worker must be configured to point at the bundled worker file. CRXJS/Vite handles bundling, but the worker URL needs to be set explicitly via `GlobalWorkerOptions.workerSrc`.
- Returns raw text only — page layout is lost. That's fine; structureParser works on linear text.

### `parseDocx.ts`
```typescript
// Accepts a File object.
// Returns raw text (mammoth's extractRawText mode).
export async function parseDocx(file: File): Promise<string>
```

### `structureParser.ts`
```typescript
// Accepts raw text from either parser.
// Returns Partial<Profile> — never throws, always returns something (even if empty).
export function parseStructure(rawText: string): Partial<Profile>
```

**Approach:** Detect section headings by regex (case-insensitive, allows for common variations):
- `/(experience|work history|employment)/i` → workHistory section
- `/(education|academic)/i` → education section
- `/(skills|technical skills|technologies)/i` → skills section
- `/(contact|personal info)/i` or top of document → contact info

Within each section, parse entries with line-based heuristics:
- Email: `/[\w.+-]+@[\w-]+\.[a-z]{2,}/i`
- Phone: `/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4}/`
- LinkedIn/GitHub: URL patterns
- Company/Title: First two bold/capitalized lines of each work block
- Dates: `/(Jan|Feb|...|Dec)\s+\d{4}|(\d{4})/i` → normalized to `YYYY-MM`

### ProfileForm.tsx changes
- Add a `<input type="file" accept=".pdf,.docx">` trigger button at the top of the form ("Upload Resume").
- On file select: call `parsePdf` or `parseDocx` based on extension, then `parseStructure`, then update the `draft` state with the result.
- The user sees the form pre-filled and can edit before saving.
- **No auto-save.** The "Save profile" button is still the only save trigger.

---

## Key decisions to make before implementing

### D1: How to handle multi-column PDF layouts?
pdf.js extracts text in reading order, but multi-column layouts (common in modern resumes) may produce interleaved text. The structureParser should be forgiving about this. Consider concatenating all text in DOM order rather than trying to detect columns.

### D2: What to do with dates in various formats?
Resumes use many date formats: "Jan 2022", "01/2022", "2022-01", "2022". The structureParser should normalize all of these to `YYYY-MM` (the format `<input type="month">` expects). Handle "Present" / "Current" → set `current: true`.

### D3: Multiple work entries — how to split them?
Work entries are typically separated by company name (bold/all-caps line) followed by title line and date range. The heuristic should treat each "company + title + date" block as one `WorkEntry`. This is fragile — flag to user that the work history section needs careful review.

### D4: Should structureParser be LLM-assisted in a later phase?
Not in Phase 2. If Phase 6 goes well, upgrading structureParser to send the raw resume text to Claude for structured extraction is a natural v2 improvement. For now, keep it fully local.

---

## Known risks / limitations

- **PDF layout variance:** Some PDFs have machine-readable text layers; others are scanned images with no text. Image-only PDFs will produce empty text — the parser should detect this and show a clear message: "This PDF appears to be a scanned image and cannot be read. Please fill your profile manually."
- **DOCX template variety:** Some DOCX files use text boxes or embedded tables for layout. mammoth's raw text extraction may miss these. The user should be told to review carefully.
- **Parser accuracy:** The heuristic approach is best-effort. Target: 70–80% of fields pre-filled correctly for a standard linear resume. Users with unusual formats will need to correct more fields. This is acceptable — the form is always editable.
- **File input security:** `<input type="file">` is the only way to let the user pick a file. The extension must NOT try to programmatically access the file system or use `chrome.fileSystem` APIs — just handle the file the user explicitly chose via the picker.
