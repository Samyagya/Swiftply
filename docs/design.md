# design.md — Swiftply Visual Design

Design principle: this is a **utility tool used in short bursts, dozens of times**, often side-by-side with a job application tab. It should feel fast, calm, and trustworthy — not flashy. Think "1Password popup" energy, not "consumer app onboarding" energy.

## 1. Color Palette

### Primary
- **Ink (text/base):** `#111827` (near-black, warm gray-900)
- **Background:** `#FFFFFF` (popup surface), `#F9FAFB` (subtle section backgrounds)
- **Brand accent (primary actions, links):** `#2563EB` (blue-600) — trustworthy, calm, not aggressive
- **Brand accent hover:** `#1D4ED8` (blue-700)

### Status colors (used for field highlighting on the page — must work against arbitrary host-site backgrounds)
- **Filled / success:** `#16A34A` (green-600) outline, `#F0FDF4` (green-50) subtle background tint
- **Unmatched / needs attention:** `#D97706` (amber-600) outline, `#FFFBEB` (amber-50) subtle background tint
- **Error:** `#DC2626` (red-600) — used sparingly, only for actual failures, not just "unmatched"

### Neutral scale (borders, dividers, secondary text)
- `#E5E7EB` (gray-200) — borders/dividers
- `#6B7280` (gray-500) — secondary/muted text
- `#9CA3AF` (gray-400) — placeholder text, disabled states

## 2. Typography
- **Font family:** System font stack for speed and native feel — `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Inter as the loaded webfont if bundling one; system stack as fallback.
- **Scale:**
  - Popup title: 16px / semibold (600) — e.g., "Swiftply"
  - Section headers: 13px / semibold, uppercase, letter-spacing 0.03em, gray-500 (e.g., "PROFILES", "FILL LOG")
  - Body text: 14px / regular (400)
  - Field labels (in forms): 12px / medium (500), gray-500
  - Buttons: 14px / medium (500)
  - Helper/caption text: 12px / regular, gray-400

## 3. Spacing & Layout
- Popup width: 380px fixed (Chrome extension popup standard-ish size; wide enough for form fields without feeling cramped).
- Base spacing unit: 4px grid (use Tailwind defaults: 4, 8, 12, 16, 24px).
- Card/section padding: 16px.
- Border radius: 8px on cards/inputs/buttons (soft but not overly rounded — professional, not playful).

## 4. Component Style Notes
- **Buttons:**
  - Primary ("Fill Application"): solid blue-600 background, white text, full-width in popup, 8px radius.
  - Secondary ("Undo", "Edit Profile"): white background, gray-200 border, ink text.
  - Destructive ("Delete Profile"): red-600 text on transparent/white, no solid fill unless confirmed via a second step.
- **Inputs:** 1px gray-200 border, 8px radius, blue-600 border + subtle blue ring on focus. No heavy drop shadows.
- **Cards (profile list items, log entries):** white background, 1px gray-200 border, 8px radius, 12-16px internal padding, subtle hover state (background shifts to gray-50).
- **Toggles (e.g., "Enable AI-assisted matching"):** standard iOS-style toggle, blue-600 when on, gray-300 when off. Always paired with a one-line gray-500 caption explaining what it does.

## 5. On-Page Highlighting (injected into host sites)
Since these elements live inside arbitrary third-party pages, keep them minimal and non-intrusive:
- Filled field: 2px solid green-600 outline (`outline`, not `border`, so it doesn't shift page layout), no background fill unless the site's own background is transparent.
- Unmatched field: 2px dashed amber-600 outline — dashed specifically to visually distinguish "needs your attention" from "done."
- No tooltips, badges, or floating icons on the page itself in v1 — keep the DOM footprint minimal to reduce breakage risk on complex ATS pages. All detail/log info lives in the popup, not injected into the host page.

## 6. Iconography
- Use a single consistent icon set — **Lucide icons** (matches shadcn/Tailwind ecosystem, easy for AI to import consistently).
- Extension toolbar icon: simple, recognizable at 16px/48px/128px — suggest a minimal document-with-checkmark or lightning-bolt-and-document mark. Avoid overly literal "resume" or "form" clipart; keep it geometric and flat, 2-color max (ink + blue accent).

## 7. Tone of Voice (UI copy)
- Direct, calm, no exclamation marks, no hype language.
- Examples:
  - ✅ "12 of 15 fields filled. 3 need your review."
  - ❌ "Awesome! We filled almost everything for you! 🎉"
  - ✅ "This will send field labels to Anthropic's API. No resume content is sent."
  - ❌ "AI magic is working its wonders ✨"
- Error messages state what happened and what to do next, never just "Something went wrong."
