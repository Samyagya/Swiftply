# Swiftply

A Chrome extension that autofills job applications from your saved profile — across any ATS (Workday, Greenhouse, Lever, iCIMS, Taleo) without site-specific integrations.

## Status

🔧 **Phase 0 — Project Scaffolding** (in progress)

See `docs/Phases.md` for the full build plan and `docs/memory.md` for current status.

## Setup (development)

> Requires Node ≥ 18

```bash
npm install
npm run dev     # Vite dev build with HMR
npm run build   # Production extension bundle → dist/
npm test        # Vitest unit tests
```

## Load in Chrome

1. Run `npm run build` (or `npm run dev` and leave it running).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** → select the `dist/` folder.

## Tech stack

- React + TypeScript + Vite
- CRXJS vite-plugin (Manifest V3)
- Tailwind CSS
- `chrome.storage.local` (all data stays on device by default)
- Anthropic Claude API (opt-in, BYO API key, Phase 6+)

## Docs

- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/Architecture.md`](docs/Architecture.md) — tech stack & app flow
- [`docs/rules.md`](docs/rules.md) — development rules & AI boundaries
- [`docs/Phases.md`](docs/Phases.md) — phase-by-phase build plan
- [`docs/design.md`](docs/design.md) — visual design spec
- [`docs/memory.md`](docs/memory.md) — project memory & decisions log
