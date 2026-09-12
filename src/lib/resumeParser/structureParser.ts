/**
 * structureParser.ts — Map raw resume text → Partial<Profile>.
 *
 * Uses a single-pass line scanner with a simple state machine.
 * This is a best-effort heuristic parser — NOT LLM-based.
 * The output is always reviewed by the user before saving.
 *
 * State machine:
 *   'header'    — top of document (contact info, name, links)
 *   'work'      — inside a Work Experience section
 *   'education' — inside an Education section
 *   'skills'    — inside a Skills section
 *   'skip'      — inside a section we don't parse (Summary, Projects, etc.)
 *
 * Phase 2 implementation — see docs/features/03-resume-parsing.md
 */

import { EducationEntry, Profile, WorkEntry } from '../types'

type ParserState = 'header' | 'work' | 'education' | 'skills' | 'skip'

// ---------------------------------------------------------------------------
// Section heading detection patterns
// ---------------------------------------------------------------------------
const SECTION_PATTERNS: Array<[RegExp, ParserState]> = [
  [/^(work\s+experience|experience|employment|professional\s+(experience|background)|career\s+history)/i, 'work'],
  [/^(education|academic|schooling|qualifications|university|college)/i, 'education'],
  [/^(skills|technical\s+skills|core\s+competencies|technologies|expertise|proficiencies|tool)/i, 'skills'],
  [/^(summary|objective|profile|about|overview|highlights)/i, 'skip'],
  [/^(projects|certifications|awards|publications|languages|interests|activities|volunteer)/i, 'skip'],
]

// ---------------------------------------------------------------------------
// Extraction regexes
// ---------------------------------------------------------------------------
const RE_EMAIL = /[\w.+\-]+@[\w\-]+\.[a-z]{2,}/i
const RE_PHONE = /(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/
const RE_LINKEDIN = /linkedin\.com\/in\/([\w\-]+)/i
const RE_GITHUB = /github\.com\/([\w\-]+)/i
const RE_PORTFOLIO = /https?:\/\/(?!linkedin|github)[a-z0-9][\w.\-]+\.[a-z]{2,}(\/[\w.\-/]*)?/i

// Date range: "Jan 2020 – Present" / "2018–2021" / "01/2020 - 06/2022"
const RE_DATE_RANGE = /(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–—to]+\s*(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|now\b)/i
const RE_YEAR_ONLY = /\b(20\d{2}|19[6-9]\d)\b/
const RE_GPA = /\b([0-3]\.\d{1,2}|4\.0)\s*(\/\s*4\.0)?\b/
const RE_DEGREE = /\b(b\.?s\.?|b\.?a\.?|b\.?eng\.?|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|associate|doctorate)/i

// Lines that look like section headings: short, no lowercase start, no sentence punctuation
const RE_HEADING_LIKE = /^[A-Z][A-Za-z\s&/\-,]{0,50}$/

// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
}

function normaliseDate(raw: string): string {
  const s = raw.trim().toLowerCase()

  // "Jan 2020" / "January 2020"
  const monthYear = s.match(/^([a-z]+)\s+(\d{4})$/)
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1]] ?? '01'
    return `${monthYear[2]}-${month}`
  }

  // "01/2020"
  const mmYYYY = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmYYYY) {
    return `${mmYYYY[2]}-${mmYYYY[1].padStart(2, '0')}`
  }

  // Plain year "2020" → assume January
  const yearOnly = s.match(/^(\d{4})$/)
  if (yearOnly) return `${yearOnly[1]}-01`

  return ''
}

function isPresent(raw: string): boolean {
  return /present|current|now/i.test(raw.trim())
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function isSectionHeading(line: string, nextLine: string | undefined): boolean {
  // A section heading is a short, mostly-uppercase line that doesn't look like
  // a name or job title. We look for keyword patterns first, then fall back to
  // structure detection.
  if (line.length > 60) return false

  for (const [pattern] of SECTION_PATTERNS) {
    if (pattern.test(line.trim())) return true
  }

  // All-caps short line (e.g. "EDUCATION", "SKILLS") followed by a non-empty line
  if (/^[A-Z\s/&]{3,30}$/.test(line.trim()) && nextLine?.trim()) return true

  return false
}

function detectSectionState(line: string): ParserState | null {
  const trimmed = line.trim()
  for (const [pattern, state] of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return state
  }
  // All-caps lines that match heading structure but no keyword → skip
  if (/^[A-Z\s/&]{3,30}$/.test(trimmed)) return 'skip'
  return null
}

function extractEmail(line: string): string | null {
  return line.match(RE_EMAIL)?.[0] ?? null
}

function extractPhone(line: string): string | null {
  return line.match(RE_PHONE)?.[0]?.trim() ?? null
}

function extractLinkedIn(line: string): string | null {
  const m = line.match(RE_LINKEDIN)
  return m ? `https://linkedin.com/in/${m[1]}` : null
}

function extractGitHub(line: string): string | null {
  const m = line.match(RE_GITHUB)
  return m ? `https://github.com/${m[1]}` : null
}

function extractPortfolio(line: string): string | null {
  if (RE_LINKEDIN.test(line) || RE_GITHUB.test(line)) return null
  return line.match(RE_PORTFOLIO)?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Work entry builder
// ---------------------------------------------------------------------------

interface WorkDraft {
  company: string
  title: string
  startDate: string
  endDate: string
  current: boolean
  descLines: string[]
}

function flushWork(draft: WorkDraft): WorkEntry | null {
  if (!draft.company && !draft.title) return null
  return {
    id: crypto.randomUUID(),
    company: draft.company || 'Unknown company',
    title: draft.title || 'Unknown title',
    startDate: draft.startDate,
    endDate: draft.current ? undefined : (draft.endDate || undefined),
    current: draft.current,
    description: draft.descLines.filter(Boolean).join(' ').trim() || undefined,
  }
}

function emptyWorkDraft(): WorkDraft {
  return { company: '', title: '', startDate: '', endDate: '', current: false, descLines: [] }
}

// ---------------------------------------------------------------------------
// Education entry builder
// ---------------------------------------------------------------------------

interface EduDraft {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa: string
}

function flushEdu(draft: EduDraft): EducationEntry | null {
  if (!draft.institution) return null
  return {
    id: crypto.randomUUID(),
    institution: draft.institution,
    degree: draft.degree || undefined,
    field: draft.field || undefined,
    startDate: draft.startDate || undefined,
    endDate: draft.endDate || undefined,
    gpa: draft.gpa || undefined,
  }
}

function emptyEduDraft(): EduDraft {
  return { institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses raw resume text into a partial Profile object.
 *
 * Always returns an object (never throws). Missing fields are left undefined.
 * The caller should deep-merge the result with a blank profile before passing
 * to ProfileForm so the form has sensible defaults.
 */
export function parseStructure(rawText: string): Partial<Profile> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // ── Result accumulators ──────────────────────────────────────────────────
  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let linkedin = ''
  let github = ''
  let portfolio = ''
  const workHistory: WorkEntry[] = []
  const education: EducationEntry[] = []
  const skills: string[] = []

  // ── State ────────────────────────────────────────────────────────────────
  let state: ParserState = 'header'
  let workDraft = emptyWorkDraft()
  let eduDraft = emptyEduDraft()
  // Track whether the current work/edu draft has started accumulating content
  let workDraftActive = false
  let eduDraftActive = false

  // ── Header scanning (first pass, up to 15 lines) ─────────────────────────
  // We always try to extract contact info from the top of the document,
  // regardless of the current state, up to the first section heading.
  let headerScanLimit = Math.min(15, lines.length)

  for (let i = 0; i < headerScanLimit; i++) {
    const line = lines[i]

    // Stop header scanning when we hit the first section heading
    if (i > 0 && isSectionHeading(line, lines[i + 1])) {
      headerScanLimit = i
      break
    }

    if (!email) email = extractEmail(line) ?? ''
    if (!phone) phone = extractPhone(line) ?? ''
    if (!linkedin) linkedin = extractLinkedIn(line) ?? ''
    if (!github) github = extractGitHub(line) ?? ''
    if (!portfolio) portfolio = extractPortfolio(line) ?? ''

    // Name: first non-contact-info line under 40 chars, no digits, title-case-ish
    if (!firstName && !RE_EMAIL.test(line) && !RE_PHONE.test(line) && !RE_LINKEDIN.test(line) && !RE_GITHUB.test(line) && line.length < 40 && /^[A-Z][a-z]/.test(line) && !/\d/.test(line)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2 && parts.length <= 4) {
        firstName = parts[0]
        lastName = parts[parts.length - 1]
      }
    }
  }

  // ── Main pass ────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]

    // Always try to pick up contact info we might have missed in header scan
    if (!email) email = extractEmail(line) ?? ''
    if (!phone) phone = extractPhone(line) ?? ''
    if (!linkedin) linkedin = extractLinkedIn(line) ?? ''
    if (!github) github = extractGitHub(line) ?? ''
    if (!portfolio) portfolio = extractPortfolio(line) ?? ''

    // ── Section transition? ──────────────────────────────────────────────
    if (isSectionHeading(line, nextLine)) {
      // Flush current work/edu draft before changing state
      if (state === 'work' && workDraftActive) {
        const entry = flushWork(workDraft)
        if (entry) workHistory.push(entry)
        workDraft = emptyWorkDraft()
        workDraftActive = false
      } else if ((state as ParserState) === 'education' && eduDraftActive) {
        const entry = flushEdu(eduDraft)
        if (entry) education.push(entry)
        eduDraft = emptyEduDraft()
        eduDraftActive = false
      }

      const newState = detectSectionState(line)
      if (newState) { state = newState; continue }
    }

    // ── Work section ─────────────────────────────────────────────────────
    if (state === 'work') {
      const dateMatch = line.match(RE_DATE_RANGE)

      if (dateMatch) {
        // A date range line starts a new entry (flush previous if exists)
        if (workDraftActive) {
          const entry = flushWork(workDraft)
          if (entry) workHistory.push(entry)
          workDraft = emptyWorkDraft()
        }
        workDraftActive = true
        workDraft.startDate = normaliseDate(dateMatch[1])
        workDraft.current = isPresent(dateMatch[2])
        workDraft.endDate = workDraft.current ? '' : normaliseDate(dateMatch[2])
      } else if (workDraftActive) {
        // After date range: next short line = company (if not yet set), then title
        if (!workDraft.company && RE_HEADING_LIKE.test(line) && line.length < 60) {
          workDraft.company = line
        } else if (!workDraft.title && RE_HEADING_LIKE.test(line) && line.length < 60) {
          workDraft.title = line
        } else {
          // Longer lines after company/title = description
          workDraft.descLines.push(line)
        }
      } else {
        // Before the first date range: this is likely the first company name
        if (RE_HEADING_LIKE.test(line) && line.length < 60) {
          workDraftActive = true
          workDraft.company = line
        }
      }
    }

    // ── Education section ────────────────────────────────────────────────
    if (state === 'education') {
      const dateMatch = line.match(RE_DATE_RANGE)
      const yearMatch = !dateMatch && line.match(RE_YEAR_ONLY)
      const gpaMatch = line.match(RE_GPA)
      const degreeMatch = line.match(RE_DEGREE)

      if (gpaMatch && eduDraftActive) {
        eduDraft.gpa = gpaMatch[1]
        continue
      }

      if (dateMatch) {
        const current = isPresent(dateMatch[2])
        eduDraft.startDate = normaliseDate(dateMatch[1])
        eduDraft.endDate = current ? '' : normaliseDate(dateMatch[2])
      } else if (yearMatch && !dateMatch && eduDraftActive) {
        // Single year without range: treat as end date
        eduDraft.endDate = normaliseDate(yearMatch[0])
      }

      if (degreeMatch && !eduDraft.degree) {
        // Extract degree and field from the same line
        // e.g. "B.S. Computer Science" → degree="B.S.", field="Computer Science"
        const degreeIdx = line.toLowerCase().search(RE_DEGREE)
        const degreeToken = line.substring(degreeIdx).split(/[\s,]/)[0]
        eduDraft.degree = degreeToken

        const afterDegree = line.substring(degreeIdx + degreeToken.length).trim()
        const fieldCandidate = afterDegree.replace(/^(in|of)\s+/i, '').trim()
        if (fieldCandidate && fieldCandidate.length < 50) {
          eduDraft.field = fieldCandidate
        }
        continue
      }

      // Institution: first heading-like line per education block
      if (RE_HEADING_LIKE.test(line) && line.length < 80 && !dateMatch) {
        if (!eduDraftActive) {
          eduDraftActive = true
          eduDraft.institution = line
        } else if (!eduDraft.institution) {
          eduDraft.institution = line
        } else {
          // New institution = flush previous and start new entry
          const entry = flushEdu(eduDraft)
          if (entry) education.push(entry)
          eduDraft = emptyEduDraft()
          eduDraft.institution = line
        }
      }
    }

    // ── Skills section ───────────────────────────────────────────────────
    if (state === 'skills') {
      // Split on common skill delimiters
      const raw = line.split(/[,·•|\/]+/)
      for (const s of raw) {
        const trimmed = s.trim()
        // Skip very long tokens (likely a sentence, not a skill)
        // and short single-char tokens (stray delimiters)
        if (trimmed.length > 1 && trimmed.length < 40 && !skills.includes(trimmed)) {
          skills.push(trimmed)
        }
      }
    }
  }

  // Flush any open drafts at end of document
  if (state === 'work' && workDraftActive) {
    const entry = flushWork(workDraft)
    if (entry) workHistory.push(entry)
  }
  if (state === 'education' && eduDraftActive) {
    const entry = flushEdu(eduDraft)
    if (entry) education.push(entry)
  }

  // ── Assemble result ───────────────────────────────────────────────────────
  const result: Partial<Profile> = {}

  if (firstName || lastName) {
    result.contact = {
      firstName,
      lastName,
      email,
      phone,
      ...(linkedin ? {} : {}), // contact has no linkedin field — links are separate
    }
  } else if (email || phone) {
    result.contact = {
      firstName: '',
      lastName: '',
      email,
      phone,
    }
  }

  result.links = {
    ...(linkedin ? { linkedin } : {}),
    ...(github ? { github } : {}),
    ...(portfolio ? { portfolio } : {}),
  }

  if (workHistory.length > 0) result.workHistory = workHistory
  if (education.length > 0) result.education = education
  if (skills.length > 0) result.skills = skills

  return result
}
