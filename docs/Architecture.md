# Architecture.md — Swiftply

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Extension framework | Chrome Manifest V3 | Required for Chrome Web Store; MV2 is deprecated |
| UI framework | React + Vite (CRXJS plugin) | Fast HMR dev loop for extension popups; Antigravity handles React well |
| Styling | Tailwind CSS | Fast to vibe-code, consistent utility classes, easy for AI to generate |
| State/storage | `chrome.storage.local` (+ `chrome.storage.sync` for lightweight prefs) | Native, private, no backend needed for v1 |
| Resume parsing | `pdf.js` (PDF) + `mammoth.js` (DOCX) client-side | Keeps parsing local, no server round-trip |
| LLM-assisted field matching | Anthropic API (Claude Haiku or Sonnet) via background service worker fetch | Cheap, fast, good at structured JSON output |
| Build tooling | Vite + TypeScript | Type safety reduces AI-introduced bugs during vibe-coding |
| Testing | Vitest (unit) + manual QA checklist per ATS | No E2E framework in v1 — too heavy for solo vibe-coded project |

## 2. High-Level App Flow

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│   Popup (React)  │◄────►│ Background Worker │◄────►│  Content Script     │
│  - Profile setup │      │  - Message router │      │  - Field scanner    │
│  - Trigger fill  │      │  - LLM API calls  │      │  - Fill executor    │
│  - View log      │      │  - Storage access │      │  - Highlighter      │
└─────────────────┘      └──────────────────┘      └────────────────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  Job Application  │
                                                     │  Page DOM/iframes │
                                                     └──────────────────┘
```

### Flow: Filling an application
1. User opens job application page, clicks extension icon → Popup opens.
2. Popup sends `SCAN_PAGE` message to content script (via background worker).
3. Content script walks the DOM (incl. iframes), extracts all fillable fields into a normalized JSON list: `{ id, label, type, selector, frameId }`.
4. Content script returns field list to background worker.
5. Background worker runs heuristic matcher against the user's active profile.
6. Any unmatched fields (if LLM-assist is enabled) get sent to Claude API along with profile JSON → returns `{ selector: value }` mapping.
7. Combined mapping sent back to content script.
8. Content script fills fields using the React-safe native setter method (see Rules.md), dispatches `input`/`change`/`blur` events, and highlights each field (green = filled, yellow = unmatched).
9. Fill log written to `chrome.storage.local` and displayed in popup.
10. User reviews, edits as needed, and manually submits.

## 3. Folder & File Structure

```
Swiftply/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/
│   ├── popup/
│   │   ├── Popup.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── ProfileForm.tsx
│   │   │   ├── ProfileList.tsx
│   │   │   ├── FillButton.tsx
│   │   │   └── FillLog.tsx
│   │   └── index.html
│   ├── background/
│   │   ├── index.ts              # service worker entry
│   │   ├── messageRouter.ts
│   │   ├── llmMatcher.ts         # calls Anthropic API
│   │   └── heuristicMatcher.ts
│   ├── content/
│   │   ├── index.ts              # content script entry
│   │   ├── fieldScanner.ts       # DOM walking + field extraction
│   │   ├── fieldFiller.ts        # React-safe value setting
│   │   ├── highlighter.ts
│   │   └── iframeBridge.ts       # cross-frame messaging
│   ├── lib/
│   │   ├── resumeParser/
│   │   │   ├── parsePdf.ts
│   │   │   └── parseDocx.ts
│   │   ├── types.ts              # shared TS interfaces (Profile, Field, Mapping)
│   │   ├── storage.ts            # typed wrapper around chrome.storage
│   │   └── constants.ts
│   └── styles/
│       └── globals.css
├── tests/
│   └── heuristicMatcher.test.ts
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── rules.md
│   ├── Phases.md
│   ├── design.md
│   └── memory.md
└── README.md
```

## 4. Key Data Models (`lib/types.ts`)

```ts
interface Profile {
  id: string;
  name: string; // e.g. "Software Engineer resume"
  contact: { firstName: string; lastName: string; email: string; phone: string; address?: string };
  links: { linkedin?: string; github?: string; portfolio?: string };
  workHistory: WorkEntry[];
  education: EducationEntry[];
  skills: string[];
  eeo?: { gender?: string; race?: string; veteranStatus?: string; disabilityStatus?: string };
}

interface FormField {
  selector: string;
  frameId: number;
  label: string;
  inputType: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'custom-dropdown' | 'file';
  nearbyContext?: string;
}

interface FieldMapping {
  selector: string;
  frameId: number;
  value: string;
  source: 'heuristic' | 'llm' | 'unmatched';
}
```

## 5. Cross-Cutting Concerns
- **Messaging:** All popup ↔ content ↔ background communication goes through `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` with a typed message envelope (`{ type, payload }`) defined in `lib/types.ts`. No direct DOM access from popup or background.
- **Iframes:** Content script is injected with `all_frames: true` in manifest; `iframeBridge.ts` aggregates field lists from all frames before returning to background.
- **Security boundary:** Background worker is the only place that holds/calls the LLM API key. Content script never makes network calls.
