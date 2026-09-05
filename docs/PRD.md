# PRD.md — Swiftply (Job Application Autofill Extension)

## 1. Problem Statement
Job seekers spend enormous amounts of repetitive time re-entering the same personal, education, and work-history information into different Applicant Tracking Systems (ATS) — Workday, Greenhouse, Lever, iCIMS, Taleo, etc. — every time they apply to a job. This is tedious, error-prone, and discourages applying to more roles.

## 2. Product Vision
A Chrome extension that lets a user store their resume/profile data once, then click a single button on any job application page to have all matching fields auto-filled — across any ATS, without needing site-specific integrations.

## 3. Target Users
- **Primary:** Active job seekers applying to 10+ roles across different companies/ATS platforms.
- **Secondary:** Recruiters/career coaches testing or demoing application flows.
- **Not targeted (v1):** Users applying via mobile apps, or applications requiring proctored/identity-verification steps.

## 4. Goals
- Reduce time spent per application from ~10-15 minutes of data entry to under 1 minute.
- Support the most common ATS platforms without per-site custom code (generalized field detection).
- Keep all personal data local/private by default — no data leaves the user's machine unless they opt into LLM-assisted matching.

## 5. Non-Goals (v1)
- Auto-submitting applications (user must always review before submit).
- Answering free-form essay/behavioral questions ("Why do you want to work here?") — v1 only handles structured fields. (Stretch goal for v2.)
- Bypassing CAPTCHAs or any anti-bot mechanism.
- Uploading resume/cover letter files automatically (browser security blocks this — see Rules.md).
- Mobile browser support.

## 6. Core Features (v1)

### 6.1 Profile Setup
- User uploads a resume (PDF/DOCX) OR fills a structured form manually.
- Extension parses resume into structured JSON: contact info, work history, education, skills, links (LinkedIn/portfolio/GitHub), EEO/demographic info (optional, since many ATS ask these).
- User can review/edit the parsed profile before saving.
- Support for multiple saved profiles (e.g., "Software Engineer resume" vs "PM resume").

### 6.2 Field Detection & Mapping
- Content script scans the current page's form fields (inputs, selects, textareas, custom dropdowns).
- Matches each field to a profile attribute using:
  1. Heuristic matching (label text, name/id/placeholder/aria-label keyword matching) — fast, free, offline.
  2. LLM-assisted fallback for unmatched/ambiguous fields (opt-in, sends only field labels + profile JSON, not full page content).

### 6.3 Autofill Execution
- On "Fill Application" click, extension fills all matched fields.
- Fields are visually highlighted (e.g., light green outline) after filling so the user can quickly scan and correct.
- Unmatched fields are highlighted in a different color (e.g., yellow) so the user knows what still needs manual entry.
- User always manually reviews and clicks Submit — extension never submits on its own.

### 6.4 Multi-page / iframe Support
- Detect and fill fields inside iframes (common in Workday).
- Handle multi-step application wizards by re-running detection after each "Next" page load.

### 6.5 Review & Undo
- "Undo last fill" button to clear extension-filled values in one click.
- Log of what was filled/where, viewable in the popup, for transparency.

## 7. Stretch Features (v2+)
- Cover letter / free-text answer generation using LLM + job description context.
- Auto-detection of "Have you applied before" duplicate-application warnings.
- Application tracker (log of companies/roles applied to, with dates and status).
- Browser-agnostic support (Firefox/Edge).

## 8. Success Metrics
- Time-to-fill per application (target: <60 seconds of active user time).
- Field match rate (% of visible fields successfully auto-filled) — target 80%+ on top 5 ATS platforms.
- User retention (do they use it for more than one application session).

## 9. Key Risks
- **ATS DOM structure changes** break heuristics over time — needs low-maintenance, generalized detection rather than brittle per-site selectors.
- **Privacy concerns** with resume data — must default to fully local storage.
- **ToS risk**: some job sites may prohibit automated form-filling in their terms of service. User should be informed this is their own responsibility.
- **React-controlled inputs** silently failing to update (see Architecture.md/Rules.md for the fix).

## 10. Open Questions
- Do we support Google Sheets/Notion as an alternate profile data source instead of resume parsing?
- Do we charge for LLM-assisted matching (API cost) or require users to bring their own API key?
