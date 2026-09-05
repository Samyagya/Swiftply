# docs/features/ — Feature Context Files

Each file in this folder documents one Swiftply feature in full: what it is, which files it touches, the tech stack used, every significant decision made (and *why*), and known gotchas.

**Purpose:** Any engineer or AI assistant picking up this project cold should be able to read the relevant feature doc and immediately understand the context, constraints, and reasoning behind the implementation — without needing to read the entire codebase or ask clarifying questions.

---

## Index

| File | Feature | Phase | Status |
|---|---|---|---|
| [`01-project-scaffolding.md`](./01-project-scaffolding.md) | Project Scaffolding (Vite + CRXJS + Tailwind + MV3) | 0 | ✅ Complete |
| [`02-profile-data-model.md`](./02-profile-data-model.md) | Profile Data Model, Storage & Forms | 1 | ✅ Complete |
| [`03-resume-parsing.md`](./03-resume-parsing.md) | Resume Parsing (PDF/DOCX → Profile) | 2 | 🔲 Not started |
| [`04-field-scanner.md`](./04-field-scanner.md) | Field Scanner (Content Script + iframeBridge) | 3 | 🔲 Not started |
| [`05-heuristic-matcher.md`](./05-heuristic-matcher.md) | Heuristic Field Matcher (keyword/regex + confidence) | 4 | 🔲 Not started |
| [`06-field-filler-highlighter.md`](./06-field-filler-highlighter.md) | Field Filler + Highlighter (setNativeValue) | 5 | 🔲 Not started |
| [`07-llm-matcher.md`](./07-llm-matcher.md) | LLM-Assisted Matching (Claude API, opt-in, BYO key) | 6 | 🔲 Not started |
| [`08-multi-page-support.md`](./08-multi-page-support.md) | Multi-Page / Multi-Step Support (MutationObserver) | 7 | 🔲 Not started |
| [`09-polish-logging-packaging.md`](./09-polish-logging-packaging.md) | Polish, Fill Log, Error Toasts & Web Store Packaging | 8 | 🔲 Not started |

---

## How to use these docs

- **Starting a new phase?** Read the feature doc for that phase before writing a single line of code. It has the key decisions pre-thought-through and the gotchas pre-identified.
- **Debugging a weird bug?** Check the "Known gotchas" section of the relevant feature doc first.
- **Changing a library or approach?** Update the feature doc with the new decision + reasoning before committing. This doc is the audit trail.
- **Handing off to a new model/session?** Point the new context to the relevant feature doc(s) plus `docs/tracker.md` for status.
