# Feature: Project Scaffolding

**Phase:** 0  
**Status:** ✅ Complete  
**Build result:** `npm run build` — 0 errors, 0 warnings, ~1.85s

---

## What this feature is

The foundational Chrome extension skeleton: a compilable, loadable, runnable extension with no business logic yet — just the right folder structure, toolchain config, and a placeholder popup that proves the pipeline works end-to-end.

This is the hardest phase to get right because the toolchain choices made here cascade through every other feature. A wrong decision in Phase 0 (e.g., Webpack instead of Vite, or a broken manifest) would require painful refactoring later.

---

## Files created / modified

| File | Role |
|---|---|
| `package.json` | Deps, scripts, `engines: {node: ">=18"}`, `"type": "module"` |
| `vite.config.ts` | CRXJS plugin + React plugin; reads `manifest.json` as build entry |
| `tsconfig.json` | Strict mode, bundler moduleResolution, chrome types |
| `tsconfig.node.json` | Separate tsconfig for `vite.config.ts` (needs `resolveJsonModule`) |
| `tailwind.config.js` | Design tokens from `design.md` baked in as Tailwind theme extensions |
| `postcss.config.js` | Tailwind + Autoprefixer |
| `manifest.json` | Manifest V3 — permissions: `storage`, `activeTab`, `scripting` |
| `src/styles/globals.css` | Tailwind directives + Inter font imports (400/500/600) |
| `src/popup/index.html` | Popup HTML shell |
| `src/popup/main.tsx` | React root mount |
| `src/popup/Popup.tsx` | Phase 0 placeholder: Zap icon + "Swiftply" title |
| `src/background/index.ts` | Service worker entry (stub) |
| `src/content/index.ts` | Content script entry (stub, on-demand injection) |
| `public/icons/icon{16,48,128}.png` | Extension icon (generated: blue bg + lightning/document) |
| `README.md` | Install/dev instructions |
| All `src/**/*.ts(x)` stubs | Empty stubs matching Architecture.md folder structure exactly |

---

## Tech stack used

| Layer | Choice | Version |
|---|---|---|
| Extension framework | Chrome Manifest V3 | — |
| Build tool | Vite | ^5.3.0 |
| Extension build bridge | `@crxjs/vite-plugin` | `^2.0.0` (stable) |
| UI framework | React | ^18.3.1 |
| Language | TypeScript | ^5.5.0 |
| Styling | Tailwind CSS | ^3.4.0 |
| Font | Inter via `@fontsource/inter` | ^5.0.0 |
| Icons | `lucide-react` | ^0.400.0 |
| Runtime validation | `zod` | ^3.23.0 |
| Testing | Vitest | ^2.0.0 |

---

## Key decisions & reasoning

### 1. CRXJS v2 stable (not `@beta`)
- **Decision:** Use `@crxjs/vite-plugin@^2.0.0` (stable release).
- **Why:** The `@beta` tag resolved to `2.0.0-beta.33` which had a deprecation warning at install time ("Beta versions are no longer maintained. Please upgrade to the stable 2.0.0 release"). Upgraded immediately to stable.
- **Impact:** Stable 2.0.0 is API-compatible with beta; no code changes needed.

### 2. No static `content_scripts` in manifest.json
- **Decision:** Removed the static `content_scripts` entry with `<all_urls>`. Instead, the content script is injected on demand via `chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: [...] })` when the user clicks "Fill Application".
- **Why:** The `<all_urls>` host-permission pattern triggers a scary browser warning ("This extension can read and change data on all websites"). Using `activeTab` + `scripting` is far less intrusive and aligns with Architecture.md's guidance to "prefer activeTab".
- **Impact (Phase 3+):** The background worker must call `scripting.executeScript()` before sending messages to the content script. Also affects how the content script bundle is included in the build (Phase 3 concern — needs a Rollup input entry or `web_accessible_resources` declaration).

### 3. `@fontsource/inter` (bundled, not Google Fonts CDN)
- **Decision:** Import Inter directly from the npm package rather than a Google Fonts `@import` URL.
- **Why:** Extension popups load from `chrome-extension://` URLs. A Google Fonts CDN request adds a network round-trip on every popup open and requires the extension to work online. Bundling Inter keeps the popup fast and fully offline.
- **Impact:** The `dist/assets/` directory contains ~50 font files (all Inter subsets). Total font asset footprint is ~400KB uncompressed. Acceptable for an extension.

### 4. `"type": "module"` in package.json
- **Decision:** Added after first `npm run build` produced a Node ESM detection warning about `postcss.config.js`.
- **Why:** All config files (`vite.config.ts`, `tailwind.config.js`, `postcss.config.js`) use ESM `export default` syntax. Without `"type": "module"`, Node tries to parse them as CommonJS first, detects ESM syntax, and re-parses — which is slow and noisy.
- **Impact:** None — all files already used ESM syntax.

### 5. Design tokens baked into Tailwind theme
- **Decision:** `tailwind.config.js` extends the theme with custom colors (`ink`, `brand`, `brand-hover`, `status-*`) sourced directly from `design.md`.
- **Why:** Avoids hardcoding hex values in components. Any future palette change is a single edit in `tailwind.config.js`.
- **Example:** `text-brand` = `#2563EB`, `text-status-error` = `#DC2626`.

### 6. TypeScript strict mode on
- **Decision:** `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true` in `tsconfig.json`.
- **Why:** rules.md §5 mandates this explicitly. Catches a class of AI-introduced bugs (dead imports, wrong parameter counts) at compile time.
- **Impact:** All stub files must export at least `export {}` to avoid TS errors.

---

## Known gotchas

- The `esbuild` npm package requires its install script to be approved manually (`npm approve-scripts esbuild@0.21.5`) when using npm's `allowScripts` security feature. This must be done once after a fresh `npm install`.
- Icon files are JPG-sourced (from the AI image generator) but stored with `.png` extension. Chrome loads them fine, but if a strict PNG validator is ever run, they'll fail. Replace with actual PNGs before Web Store submission (Phase 8).
