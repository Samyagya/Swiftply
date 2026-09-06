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
  - [⚡ Option 1: Quick Install for Friends (No Tech Skills Needed!)](#-option-1-quick-install-for-friends-no-tech-skills-needed)
  - [💻 Option 2: Developer Install (Building from Source)](#-option-2-developer-install-building-from-source)
- [How to Use Swiftply in Your Daily Job Hunt](#-how-to-use-swiftply-in-your-daily-job-hunt)
  - [Step 1: Set Up Your Profile (or Upload Résumé)](#step-1-set-up-your-profile-or-upload-rsum)
  - [Step 2: Go to Any Job Application](#step-2-go-to-any-job-application)
  - [Step 3: Preview and Fill](#step-3-preview-and-fill)
  - [Step 4: Revert Anytime (Undo Fill)](#step-4-revert-anytime-undo-fill)
- [Day-to-Day Pro Tips](#-day-to-day-pro-tips)
- [AI-Assisted Matching (Optional)](#-ai-assisted-matching-optional)
- [Privacy & Security First](#-privacy--security-first)
- [Tech Stack](#-tech-stack)
- [Development & Packaging](#-development--packaging)
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

Choose the option that fits you best:

### ⚡ Option 1: Quick Install for Friends (No Tech Skills Needed!)

> **Zero coding knowledge required!** You do **not** need Node.js, Git, or terminal commands.

1. **Download Swiftply:**
   - Go to the **[Releases](https://github.com/Samyagya/Swiftply/releases)** page.
   - Under the latest release, click to download **`swiftply.zip`**.
   *(Alternatively, if your friend sent you the project folder or ZIP directly, extract it to your computer).*
2. **Extract the ZIP file:**
   - Right-click `swiftply.zip` and select **Extract All...** (or Unzip).
   - Open the extracted folder (make sure you see files like `manifest.json` inside).
3. **Load it into Google Chrome:**
   - Open Chrome and type `chrome://extensions` in the address bar, then press **Enter**.
   - In the top-right corner, switch the **Developer mode** toggle to **ON**.
   - In the top-left corner, click **Load unpacked**.
   - Select the extracted folder containing `manifest.json`.
4. **Pin the Extension:**
   - Click the puzzle piece icon (🧩) in Chrome’s top-right toolbar.
   - Find **Swiftply** and click the **Pin** icon (📌).
   - The Swiftply lightning bolt (⚡) is now ready to use!

---

### 💻 Option 2: Developer Install (Building from Source)

For developers who want to inspect the source code or build the extension from scratch:

#### Prerequisites
- **[Node.js](https://nodejs.org/)** (v18.0.0 or higher)
- **Google Chrome** (or any Chromium browser: Brave, Edge, Arc, Opera, Vivaldi)

#### Build Steps
```bash
# 1. Clone the repository
git clone https://github.com/Samyagya/Swiftply.git
cd Swiftply

# 2. Install dependencies
npm install

# 3. Build the production extension bundle
npm run build
```

This generates a ready-to-use production extension in the `dist/` directory.

#### Load into Chrome
1. Open `chrome://extensions` in your browser.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the **`dist/`** folder located inside your Swiftply project directory.
5. Pin the extension to your toolbar.

---

## 📖 How to Use Swiftply in Your Daily Job Hunt

### Step 1: Set Up Your Profile (or Upload Résumé)

1. Click the **Swiftply icon** (⚡) in your browser toolbar.
2. Click **New profile** (or edit an existing one).
3. Choose how you want to fill your profile:
   - **Fastest:** Click **Upload résumé** and select your PDF or Word (`.docx`) résumé. Swiftply will instantly parse your contact information, URLs, work experiences, and degrees into the form!
   - **Manual:** Fill in your personal details, links (LinkedIn, GitHub, Portfolio), work history, and education directly.
4. Review your details and click **Save profile**.

### Step 2: Go to Any Job Application

Navigate to any job application page (e.g., Greenhouse, Lever, Workday, Ashby, BambooHR, or custom career sites).

### Step 3: Preview and Fill

1. Click the **Swiftply icon** (⚡) on the job page.
2. Ensure your active profile is selected.
3. Click **Fill Application**.
4. Swiftply scans the page form fields and displays a **Fill Preview**:
   - ✅ **Green rows:** Form fields confidently matched to your profile.
   - ⚪ **Grey rows:** Unmatched or custom fields on the page.
5. Click **Fill N matched fields**.
6. The web page updates immediately:
   - 🟢 **Green outline:** Fields filled with your profile data.
   - 🟡 **Dashed amber outline:** Fields that were skipped or need manual input.

### Step 4: Revert Anytime (Undo Fill)

Want to switch profiles or reset the form?
- Simply click **Undo fill** in the Swiftply popup to immediately restore all form values to their original state.

---

## 💡 Day-to-Day Pro Tips

* **Attaching your résumé file:** Modern browser security intentionally blocks extensions from programmatically uploading files to `<input type="file">`. Always click the "Attach Résumé" button on the job site yourself.
* **No Auto-Submit:** Swiftply will **never** click "Submit" or "Apply" on your behalf. You are always in full control to review every answer before submitting.
* **Multi-Step Applications (e.g. Workday):** On multi-step wizard applications, simply click the Swiftply icon and hit "Fill Application" on each page/step as you proceed through the wizard.
* **Multiple Profiles:** You can create different profiles for different types of roles (e.g. "Frontend Engineer", "Full Stack Developer") and switch between them with one click.

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

## 💻 Development & Packaging

If you'd like to develop, test, or package Swiftply:

```bash
# Start Vite development server with Hot Module Replacement (HMR)
npm run dev

# Run unit tests
npm test

# Build production bundle into dist/
npm run build

# Package into a ready-to-share swiftply.zip
npm run package
```

### 📦 How to create a release for friends:
1. Run `npm run package` in your terminal. This creates a fresh `swiftply.zip` in the root folder.
2. Go to your GitHub repository: [github.com/Samyagya/Swiftply/releases](https://github.com/Samyagya/Swiftply/releases)
3. Click **Draft a new release**, enter a tag (e.g. `v0.1.0`), and attach `swiftply.zip`.
4. Click **Publish release**. Now anyone can download and install it in 1 minute!

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
