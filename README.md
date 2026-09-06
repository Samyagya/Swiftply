# ⚡ Swiftply

> **Autofill job applications in one click — across any ATS, 100% locally on your machine.**

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](package.json)
[![Vite + CRXJS](https://img.shields.io/badge/Bundler-Vite_%2B_CRXJS-646CFF?logo=vite&logoColor=white)](vite.config.ts)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](tailwind.config.js)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Local_Storage-success)](#-privacy--security-first)

---

Swiftply is a fast, lightweight, and privacy-first Google Chrome extension that eliminates the pain of repeatedly filling out job applications across ATS platforms (Greenhouse, Lever, Ashby, BambooHR, Workday, iCIMS, Taleo, and custom company career pages).

Unlike other job-autofill tools, **Swiftply has no cloud backend, requires no account, and never sends your personal data to remote servers**. Everything lives in your browser's local storage.

---

## 📑 Table of Contents

- [Why Swiftply?](#-why-swiftply)
- [Key Features](#-key-features)
- [Installation Guide](#-installation-guide)
  - [Prerequisites](#prerequisites)
  - [1. Download & Build](#1-download--build)
  - [2. Load into Chrome](#2-load-into-chrome)
  - [3. Pin the Extension](#3-pin-the-extension)
- [How to Use Swiftply](#-how-to-use-swiftply)
  - [Step 1: Set Up Your Profile](#step-1-set-up-your-profile)
  - [Step 2: Navigate to Any Job Application](#step-2-navigate-to-any-job-application)
  - [Step 3: Preview and Fill](#step-3-preview-and-fill)
  - [Step 4: Revert Anytime (Undo Fill)](#step-4-revert-anytime-undo-fill)
- [AI-Assisted Matching (Optional)](#-ai-assisted-matching-optional)
- [Privacy & Security First](#-privacy--security-first)
- [Tech Stack](#-tech-stack)
- [Development & Testing](#-development--testing)
- [Project Documentation](#-project-documentation)
- [FAQ & Limitations](#-faq--limitations)
- [License](#-license)

---

## 💡 Why Swiftply?

Every job seeker knows the frustration: you upload your résumé, and then the site asks you to manually re-type your name, email, phone, location, work experience, education, LinkedIn profile, GitHub link, and portfolio link — over and over again.

- **Standard browser autofill** only understands basic street addresses and names. It fails on portfolios, work histories, graduation years, and custom screening questions.
- **Commercial autofill services** often require an account, store your sensitive personal history on their cloud databases, and sell your data or charge subscriptions.

**Swiftply solves this differently:**
- **Zero setup friction:** No accounts, no logins, no cloud.
- **Universal compatibility:** Uses DOM-agnostic heuristic scanning rather than site-specific fragile scrapers.
- **Full control:** You see a **Fill Preview** before any field is modified, and can undo with a single click.

---

## ✨ Key Features

- 📄 **Instant Résumé Parser:** Upload your existing PDF or Word (`.docx`) résumé. Swiftply automatically extracts your contact information, links, work history, and education directly in your browser.
- 🎯 **Universal ATS Matching:** Matches form inputs against your profile using smart keyword heuristics, handling varied naming conventions across ATS platforms.
- 👁️ **Pre-Fill Inspection:** Preview all matched fields in an intuitive checklist before touching the page. Unmatched fields are highlighted so you can quickly fill them manually.
- 🎨 **Visual On-Page Highlights:** Filled fields receive subtle green outlines, while unmatched fields receive dashed amber outlines so you never miss a required question.
- ↩️ **One-Click Undo:** Swiftply snapshots original input values before filling. Click **Undo fill** to instantly revert the form to its original state.
- 🤖 **Optional Claude AI Matching:** Bring your own Anthropic API key to boost match accuracy on ambiguous or complex custom questions (e.g. "Work authorization status", "Years of experience").
- 🕒 **Local Fill History:** Easily review recent applications you've filled (site, date, profile used, fields filled) stored strictly in `chrome.storage.local`.
- 🌙 **Modern & Clean UI:** Designed according to a calm, high-contrast, distraction-free aesthetic with system typography and accessible colors.

---

## 🚀 Installation Guide

Swiftply is currently distributed as an unpacked developer extension. Installing takes under two minutes.

### Prerequisites

- **[Node.js](https://nodejs.org/)** (v18.0.0 or higher)
- **Google Chrome** (or any Chromium browser: Brave, Edge, Arc, Opera, Vivaldi)

### 1. Download & Build

Open your terminal or command prompt and run:

```bash
# Clone the repository (or download and extract the ZIP)
git clone https://github.com/your-username/swiftply.git
cd swiftply

# Install dependencies
npm install

# Build the production extension bundle
npm run build
```

This generates a ready-to-use extension in the `dist/` directory.

### 2. Load into Chrome

1. Open Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Toggle **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the **`dist/`** folder located inside your Swiftply project directory.

### 3. Pin the Extension

Click the puzzle piece icon (🧩) in Chrome’s top-right toolbar, find **Swiftply**, and click the pin icon (📌). The Swiftply lightning bolt (⚡) will now always be easily accessible!

---

## 📖 How to Use Swiftply

### Step 1: Set Up Your Profile

1. Click the **Swiftply icon** (⚡) in your browser toolbar.
2. Click **New profile** (or edit the default profile).
3. Fill in your details:
   - **Personal Info:** First & last name, email, phone, city, state, country, postal code.
   - **Web Links:** LinkedIn, GitHub, Portfolio website, Twitter/X.
   - **Work Experience & Education:** Role, company, start/end dates, degree, school, field of study.
4. *Tip:* Have an existing résumé? Click **Upload résumé** to parse a `.pdf` or `.docx` file and let Swiftply fill out your profile automatically!
5. Click **Save profile**.

### Step 2: Navigate to Any Job Application

Go to any job posting page with an application form (e.g., on Greenhouse, Lever, Workday, Ashby, BambooHR, etc.).

### Step 3: Preview and Fill

1. Click the **Swiftply icon** (⚡).
2. Verify your desired profile is selected.
3. Click **Fill Application**.
4. Swiftply scans the page and displays a **Fill Preview**:
   - ✅ **Green rows:** Fields confidently matched to your profile.
   - ⚪ **Grey rows:** Unmatched fields on the page.
5. Click **Fill N matched fields**.
6. The extension populates the form inputs instantly. The web page will show:
   - 🟢 Green outline around successfully filled inputs.
   - 🟡 Amber dashed outline around any inputs that still need your attention.

### Step 4: Revert Anytime (Undo Fill)

Want to change profiles or revert?
- Simply click **Undo fill** in the Swiftply popup to instantly restore all form values back to their pre-filled states.

---

## 🤖 AI-Assisted Matching (Optional)

For niche screening questions or unorthodox form fields that heuristic matching might miss (e.g. *"Are you legally authorized to work in the US?"* or *"Preferred pronouns"*), you can optionally enable AI matching powered by Anthropic's Claude 3.5 Haiku model.

### Privacy Notice for AI Matching
> [!IMPORTANT]
> When AI matching is enabled, **only unmatched field labels and input types** are sent to Anthropic to determine the best profile key. **Your personal profile values, résumé text, and full page HTML are NEVER sent over the network.**

### How to Configure

1. Obtain an API key from the [Anthropic Console](https://console.anthropic.com/keys).
2. Open the Swiftply popup and click the ⚙️ **Settings** icon.
3. Paste your API key (`sk-ant-...`).
4. Toggle **Enable AI matching** ON.
5. Click **Save settings**.

Fields resolved via AI will display a distinctive purple `ai` badge in the Fill Preview.

---

## 🔒 Privacy & Security First

Your personal information should remain yours. Swiftply is engineered with zero compromise on privacy:

- **100% Client-Side:** Everything runs locally inside your browser sandbox.
- **Local Storage Only:** Data is stored exclusively in `chrome.storage.local`.
- **No Analytics / No Tracking:** Zero telemetry, tracking pixels, or third-party analytic scripts.
- **No Background Tampering:** Content scripts are only injected when you explicitly click "Fill Application" (using `chrome.scripting.executeScript`).
- **No Automatic Submissions:** Swiftply will **never** click "Submit" or "Apply" on a job application. You retain full control to review before submitting.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Platform** | Chrome Extensions (Manifest V3) | Modern extension platform standard |
| **Frontend** | React 18 + TypeScript | Type-safe, modular UI components |
| **Styling** | Tailwind CSS + Lucide Icons | Clean, utility-first design system |
| **Bundling** | Vite + `@crxjs/vite-plugin` 2.x | High-performance HMR development & build |
| **Data Storage** | `chrome.storage.local` | Device-only encrypted extension storage |
| **Schema Validation** | Zod | Runtime profile schema validation |
| **Document Parsing** | `pdfjs-dist` & `mammoth.js` | In-browser client-side PDF/DOCX parsing |
| **AI Matching** | Anthropic Claude API (`haiku-3.5`) | Opt-in, BYO API key for semantic matching |
| **Testing** | Vitest | Unit tests for matchers, parsers, and state |

---

## 💻 Development & Testing

If you'd like to modify or contribute to Swiftply:

```bash
# Start Vite development server with Hot Module Replacement (HMR)
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```

> **Tip:** When developing with `npm run dev`, make your edits, and then reload the extension on `chrome://extensions` using the refresh icon (🔄) on the Swiftply card.

---

## 📚 Project Documentation

For deeper architectural details and planning specifications, check out the `docs/` folder:

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements & feature roadmap
- [`docs/Architecture.md`](docs/Architecture.md) — Technical architecture & data flow diagrams
- [`docs/rules.md`](docs/rules.md) — Coding conventions & boundaries
- [`docs/Phases.md`](docs/Phases.md) — Implementation breakdown
- [`docs/design.md`](docs/design.md) — Visual styles, typography, and palette guidelines
- [`docs/memory.md`](docs/memory.md) — Project architecture log
- [`docs/tracker.md`](docs/tracker.md) — Milestone tracking

---

## ❓ FAQ & Limitations

#### Q: Can Swiftply attach my résumé file automatically?
**A:** No. Due to strict web browser security restrictions, JavaScript running inside a webpage is blocked from setting native `<input type="file">` elements programmatically. You must click and attach your résumé file manually.

#### Q: Will Swiftply automatically submit my job application?
**A:** No. Swiftply will **never** automatically submit an application. You should always review the filled fields, answer any company-specific questions, and click Submit yourself.

#### Q: Why didn't a particular custom dropdown get filled?
**A:** Standard HTML `<select>` elements and standard text/number inputs fill with 100% reliability. Some websites (or custom React/Vue libraries) implement non-standard dropdowns with unlabelled `<div>` click listeners. Swiftply simulates standard focus, change, and input events, but unsupported proprietary widgets may require a manual click.

#### Q: What if a job application is embedded in an iframe (e.g. Workday)?
**A:** Cross-origin iframes sandbox form fields from the parent webpage. Swiftply will detect and warn you if cross-origin frames are present. Comprehensive multi-step iframe traversal is scheduled for the upcoming v1.1 update.

---

## 📄 License

Swiftply is an open-source project distributed under the [MIT License](LICENSE).
Feel free to fork, customize, and make job hunting faster!
