/**
 * ProfileForm.tsx — Manual profile entry / edit form.
 *
 * Handles both CREATE (no initialProfile) and EDIT (with initialProfile) modes.
 *
 * Sections (all scrollable within the popup max-height):
 *   1. Profile name
 *   2. Contact info (name, email, phone, address/city/state/zip/country)
 *   3. Links (LinkedIn, GitHub, Portfolio)
 *   4. Work history (dynamic list)
 *   5. Education (dynamic list)
 *   6. Skills (tag input)
 *   7. EEO / Demographic (collapsible, optional)
 *
 * Validation: Zod is run on Save only (not real-time — avoids annoying UX).
 * Errors are displayed inline below the relevant field.
 *
 * design.md §4: inputs → gray-200 border, blue-600 focus ring, 8px radius.
 */

import React, { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Upload, X } from 'lucide-react'
import {
  EducationEntry,
  Profile,
  ProfileSchema,
  WorkEntry,
} from '../../lib/types'
import { saveProfile, setActiveProfileId } from '../../lib/storage'
import { parsePdf } from '../../lib/resumeParser/parsePdf'
import { parseDocx } from '../../lib/resumeParser/parseDocx'
import { parseStructure } from '../../lib/resumeParser/structureParser'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** When present, form is in EDIT mode; otherwise CREATE mode. */
  initialProfile?: Profile
  onSave: () => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function newProfile(): Profile {
  return {
    id: crypto.randomUUID(),
    name: '',
    contact: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
    links: { linkedin: '', github: '', portfolio: '' },
    workHistory: [],
    education: [],
    skills: [],
  }
}

function newWork(): WorkEntry {
  return {
    id: crypto.randomUUID(),
    company: '',
    title: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  }
}

function newEducation(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    institution: '',
    degree: '',
    field: '',
    startDate: '',
    endDate: '',
    gpa: '',
  }
}

// ---------------------------------------------------------------------------
// Reusable sub-components (defined here, not in separate files, because they
// are tightly coupled to this form's internal logic and not reused elsewhere)
// ---------------------------------------------------------------------------

/** Field wrapper: label + error message. */
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      {/* design.md §2: 12px medium gray-500 */}
      <label className="block text-[12px] font-medium text-gray-500 mb-1">{label}</label>
      {children}
      {error && (
        <p className="text-[11px] text-status-error mt-0.5" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Shared input class — design.md §4: gray-200 border, blue-600 focus, 8px radius */
const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink placeholder-gray-400 ' +
  'focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-colors bg-white'

/** Section heading — design.md §2: 11px semibold uppercase tracking */
function SectionHead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProfileForm({
  initialProfile,
  onSave,
  onCancel,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<Profile>(() =>
    initialProfile ? { ...initialProfile } : newProfile(),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [eeoOpen, setEeoOpen] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  // Resume upload state
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedBanner, setParsedBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Draft updaters
  // ---------------------------------------------------------------------------

  function setTop<K extends keyof Profile>(key: K, val: Profile[K]): void {
    setDraft((d) => ({ ...d, [key]: val }))
  }

  function setContact(key: keyof Profile['contact'], val: string): void {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [key]: val } }))
  }

  function setLink(key: keyof Profile['links'], val: string): void {
    setDraft((d) => ({ ...d, links: { ...d.links, [key]: val } }))
  }

  function setEEO(key: keyof NonNullable<Profile['eeo']>, val: string): void {
    setDraft((d) => ({ ...d, eeo: { ...d.eeo, [key]: val } }))
  }

  // Work history
  function addWork(): void {
    setTop('workHistory', [...draft.workHistory, newWork()])
  }
  function removeWork(i: number): void {
    setTop('workHistory', draft.workHistory.filter((_, idx) => idx !== i))
  }
  function updateWorkStr(
    i: number,
    key: Exclude<keyof WorkEntry, 'current'>,
    val: string,
  ): void {
    setTop(
      'workHistory',
      draft.workHistory.map((w, idx) => (idx === i ? { ...w, [key]: val } : w)),
    )
  }
  function updateWorkCurrent(i: number, val: boolean): void {
    setTop(
      'workHistory',
      draft.workHistory.map((w, idx) =>
        idx === i ? { ...w, current: val, endDate: val ? '' : w.endDate } : w,
      ),
    )
  }

  // Education
  function addEdu(): void {
    setTop('education', [...draft.education, newEducation()])
  }
  function removeEdu(i: number): void {
    setTop('education', draft.education.filter((_, idx) => idx !== i))
  }
  function updateEdu(i: number, key: keyof EducationEntry, val: string): void {
    setTop(
      'education',
      draft.education.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)),
    )
  }

  // Skills
  function commitSkill(raw: string): void {
    const trimmed = raw.trim()
    if (trimmed && !draft.skills.includes(trimmed)) {
      setTop('skills', [...draft.skills, trimmed])
    }
    setSkillInput('')
  }
  function removeSkill(i: number): void {
    setTop('skills', draft.skills.filter((_, idx) => idx !== i))
  }

  // ---------------------------------------------------------------------------
  // Resume upload + parse
  // ---------------------------------------------------------------------------

  async function handleUpload(file: File): Promise<void> {
    setParsing(true)
    setParseError(null)
    setParsedBanner(false)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let rawText: string

      if (ext === 'pdf') {
        rawText = await parsePdf(file)
      } else if (ext === 'docx') {
        rawText = await parseDocx(file)
      } else {
        throw new Error('Unsupported file type. Please upload a .pdf or .docx file.')
      }

      const parsed = parseStructure(rawText)

      // Deep-merge parsed result into current draft — never clobber existing data
      setDraft((d) => ({
        ...d,
        name: parsed.contact?.firstName
          ? `${parsed.contact.firstName} ${parsed.contact.lastName}`.trim()
          : d.name,
        contact: {
          ...d.contact,
          ...parsed.contact,
        },
        links: {
          ...d.links,
          ...parsed.links,
        },
        workHistory: parsed.workHistory?.length ? parsed.workHistory : d.workHistory,
        education: parsed.education?.length ? parsed.education : d.education,
        skills: parsed.skills?.length ? parsed.skills : d.skills,
      }))

      setParsedBanner(true)
      // Scroll to top so user sees the success banner and pre-filled data
      document.getElementById('profile-form-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse resume.'
      console.error('[Swiftply] Resume parse error:', err)
      setParseError(msg)
    } finally {
      setParsing(false)
      // Reset the file input so the same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave(): Promise<void> {
    setSaving(true)
    setErrors({})

    const result = ProfileSchema.safeParse(draft)

    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path.join('.')
        // Keep the first error per field
        if (!errs[key]) errs[key] = issue.message
      })
      setErrors(errs)
      setSaving(false)
      // Scroll to top so user sees first error
      document.getElementById('profile-form-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      await saveProfile(result.data)
      // Auto-activate newly created profiles
      if (!initialProfile) {
        await setActiveProfileId(result.data.id)
      }
      onSave()
    } catch (err) {
      console.error('[Swiftply] Failed to save profile:', err)
      setErrors({ _form: 'Failed to save profile. Please try again.' })
      setSaving(false)
    }
  }

  const e = (path: string) => errors[path]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* ── Scrollable form body ── */}
      <div
        id="profile-form-scroll"
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 min-h-0"
      >
        {/* Form-level error */}
        {errors._form && (
          <p
            className="text-sm text-status-error bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            role="alert"
          >
            {errors._form}
          </p>
        )}

        {/* ── Upload Resume shortcut ── */}
        <div className="flex flex-col gap-2">
          {/* Hidden native file input */}
          <input
            ref={fileInputRef}
            id="resume-file-input"
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(ev) => {
              const file = ev.target.files?.[0]
              if (file) void handleUpload(file)
            }}
          />

          {/* Upload button */}
          <button
            id="btn-upload-resume"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-brand transition-colors px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-brand disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {parsing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            {parsing ? 'Parsing resume…' : 'Upload Resume'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            .pdf or .docx — pre-fills the form, you review before saving
          </p>

          {/* Parse error */}
          {parseError && (
            <div
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2"
              role="alert"
            >
              <X className="w-3.5 h-3.5 text-status-error shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[12px] text-status-error flex-1">{parseError}</p>
              <button
                onClick={() => setParseError(null)}
                className="text-status-error hover:opacity-70"
                aria-label="Dismiss error"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Success banner */}
          {parsedBanner && (
            <div
              className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2"
              role="status"
            >
              <span className="text-green-600 text-sm shrink-0" aria-hidden="true">✓</span>
              <p className="text-[12px] text-green-700 flex-1">
                Resume parsed — review all fields carefully before saving.
              </p>
              <button
                onClick={() => setParsedBanner(false)}
                className="text-green-600 hover:opacity-70"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* ── Profile name ── */}
        <Field label="Profile name *" error={e('name')}>
          <input
            id="profile-name"
            type="text"
            className={inputCls}
            placeholder='e.g. "Software Engineer — FAANG"'
            value={draft.name}
            onChange={(ev) => setTop('name', ev.target.value)}
          />
        </Field>

        {/* ── Contact ── */}
        <section aria-label="Contact info">
          <SectionHead>Contact</SectionHead>
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name *" error={e('contact.firstName')}>
                <input
                  id="contact-firstName"
                  type="text"
                  className={inputCls}
                  placeholder="Jane"
                  value={draft.contact.firstName}
                  onChange={(ev) => setContact('firstName', ev.target.value)}
                />
              </Field>
              <Field label="Last name *" error={e('contact.lastName')}>
                <input
                  id="contact-lastName"
                  type="text"
                  className={inputCls}
                  placeholder="Smith"
                  value={draft.contact.lastName}
                  onChange={(ev) => setContact('lastName', ev.target.value)}
                />
              </Field>
            </div>

            <Field label="Email *" error={e('contact.email')}>
              <input
                id="contact-email"
                type="email"
                className={inputCls}
                placeholder="jane@example.com"
                value={draft.contact.email}
                onChange={(ev) => setContact('email', ev.target.value)}
              />
            </Field>

            <Field label="Phone" error={e('contact.phone')}>
              <input
                id="contact-phone"
                type="tel"
                className={inputCls}
                placeholder="+1 555 000 0000"
                value={draft.contact.phone}
                onChange={(ev) => setContact('phone', ev.target.value)}
              />
            </Field>

            <Field label="Street address" error={e('contact.address')}>
              <input
                id="contact-address"
                type="text"
                className={inputCls}
                placeholder="123 Main St"
                value={draft.contact.address ?? ''}
                onChange={(ev) => setContact('address', ev.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City" error={e('contact.city')}>
                <input
                  id="contact-city"
                  type="text"
                  className={inputCls}
                  placeholder="San Francisco"
                  value={draft.contact.city ?? ''}
                  onChange={(ev) => setContact('city', ev.target.value)}
                />
              </Field>
              <Field label="State / Province" error={e('contact.state')}>
                <input
                  id="contact-state"
                  type="text"
                  className={inputCls}
                  placeholder="CA"
                  value={draft.contact.state ?? ''}
                  onChange={(ev) => setContact('state', ev.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ZIP / Postal" error={e('contact.zip')}>
                <input
                  id="contact-zip"
                  type="text"
                  className={inputCls}
                  placeholder="94103"
                  value={draft.contact.zip ?? ''}
                  onChange={(ev) => setContact('zip', ev.target.value)}
                />
              </Field>
              <Field label="Country" error={e('contact.country')}>
                <input
                  id="contact-country"
                  type="text"
                  className={inputCls}
                  placeholder="United States"
                  value={draft.contact.country ?? ''}
                  onChange={(ev) => setContact('country', ev.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ── Links ── */}
        <section aria-label="Links">
          <SectionHead>Links</SectionHead>
          <div className="mt-3 flex flex-col gap-3">
            <Field label="LinkedIn" error={e('links.linkedin')}>
              <input
                id="links-linkedin"
                type="url"
                className={inputCls}
                placeholder="https://linkedin.com/in/username"
                value={draft.links.linkedin ?? ''}
                onChange={(ev) => setLink('linkedin', ev.target.value)}
              />
            </Field>
            <Field label="GitHub" error={e('links.github')}>
              <input
                id="links-github"
                type="url"
                className={inputCls}
                placeholder="https://github.com/username"
                value={draft.links.github ?? ''}
                onChange={(ev) => setLink('github', ev.target.value)}
              />
            </Field>
            <Field label="Portfolio / Website" error={e('links.portfolio')}>
              <input
                id="links-portfolio"
                type="url"
                className={inputCls}
                placeholder="https://yoursite.com"
                value={draft.links.portfolio ?? ''}
                onChange={(ev) => setLink('portfolio', ev.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* ── Work history ── */}
        <section aria-label="Work history">
          <div className="flex items-center justify-between">
            <SectionHead>Work history</SectionHead>
            <button
              id="btn-add-work"
              onClick={addWork}
              className="flex items-center gap-1 text-[12px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              Add
            </button>
          </div>

          {draft.workHistory.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">No entries yet.</p>
          )}

          <div className="mt-3 flex flex-col gap-3">
            {draft.workHistory.map((work, i) => (
              <div
                key={work.id}
                className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Entry {i + 1}</span>
                  <button
                    onClick={() => removeWork(i)}
                    className="p-1 rounded text-gray-400 hover:text-status-error hover:bg-red-50 transition-colors"
                    aria-label={`Remove work entry ${i + 1}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>

                <Field label="Company *" error={e(`workHistory.${i}.company`)}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Acme Corp"
                    value={work.company}
                    onChange={(ev) => updateWorkStr(i, 'company', ev.target.value)}
                  />
                </Field>

                <Field label="Title *" error={e(`workHistory.${i}.title`)}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Software Engineer"
                    value={work.title}
                    onChange={(ev) => updateWorkStr(i, 'title', ev.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" error={e(`workHistory.${i}.startDate`)}>
                    <input
                      type="month"
                      className={inputCls}
                      value={work.startDate}
                      onChange={(ev) => updateWorkStr(i, 'startDate', ev.target.value)}
                    />
                  </Field>
                  <Field label="End" error={e(`workHistory.${i}.endDate`)}>
                    <input
                      type="month"
                      className={`${inputCls} ${work.current ? 'opacity-40' : ''}`}
                      value={work.endDate ?? ''}
                      disabled={work.current}
                      onChange={(ev) => updateWorkStr(i, 'endDate', ev.target.value)}
                    />
                  </Field>
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={work.current}
                    className="accent-brand"
                    onChange={(ev) => updateWorkCurrent(i, ev.target.checked)}
                  />
                  Currently working here
                </label>

                <Field label="Description" error={e(`workHistory.${i}.description`)}>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="Key responsibilities and achievements"
                    value={work.description ?? ''}
                    onChange={(ev) => updateWorkStr(i, 'description', ev.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>
        </section>

        {/* ── Education ── */}
        <section aria-label="Education">
          <div className="flex items-center justify-between">
            <SectionHead>Education</SectionHead>
            <button
              id="btn-add-edu"
              onClick={addEdu}
              className="flex items-center gap-1 text-[12px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              Add
            </button>
          </div>

          {draft.education.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">No entries yet.</p>
          )}

          <div className="mt-3 flex flex-col gap-3">
            {draft.education.map((edu, i) => (
              <div
                key={edu.id}
                className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Entry {i + 1}</span>
                  <button
                    onClick={() => removeEdu(i)}
                    className="p-1 rounded text-gray-400 hover:text-status-error hover:bg-red-50 transition-colors"
                    aria-label={`Remove education entry ${i + 1}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>

                <Field label="Institution *" error={e(`education.${i}.institution`)}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="University of California, Berkeley"
                    value={edu.institution}
                    onChange={(ev) => updateEdu(i, 'institution', ev.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Degree" error={e(`education.${i}.degree`)}>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="B.S."
                      value={edu.degree ?? ''}
                      onChange={(ev) => updateEdu(i, 'degree', ev.target.value)}
                    />
                  </Field>
                  <Field label="Field of study" error={e(`education.${i}.field`)}>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Computer Science"
                      value={edu.field ?? ''}
                      onChange={(ev) => updateEdu(i, 'field', ev.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" error={e(`education.${i}.startDate`)}>
                    <input
                      type="month"
                      className={inputCls}
                      value={edu.startDate ?? ''}
                      onChange={(ev) => updateEdu(i, 'startDate', ev.target.value)}
                    />
                  </Field>
                  <Field label="End / Expected" error={e(`education.${i}.endDate`)}>
                    <input
                      type="month"
                      className={inputCls}
                      value={edu.endDate ?? ''}
                      onChange={(ev) => updateEdu(i, 'endDate', ev.target.value)}
                    />
                  </Field>
                </div>

                <Field label="GPA" error={e(`education.${i}.gpa`)}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="3.8"
                    value={edu.gpa ?? ''}
                    onChange={(ev) => updateEdu(i, 'gpa', ev.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>
        </section>

        {/* ── Skills ── */}
        <section aria-label="Skills">
          <SectionHead>Skills</SectionHead>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                id="skills-input"
                type="text"
                className={`${inputCls} flex-1`}
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(ev) => setSkillInput(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ',') {
                    ev.preventDefault()
                    commitSkill(skillInput)
                  }
                }}
              />
              <button
                id="btn-add-skill"
                onClick={() => commitSkill(skillInput)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              >
                Add
              </button>
            </div>

            {draft.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1" role="list" aria-label="Skills">
                {draft.skills.map((skill, i) => (
                  <span
                    key={i}
                    role="listitem"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-brand text-xs font-medium"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(i)}
                      className="hover:text-brand-hover transition-colors"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="w-2.5 h-2.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── EEO / Demographic (optional, collapsible) ── */}
        <section aria-label="EEO and demographic information">
          <button
            id="btn-toggle-eeo"
            onClick={() => setEeoOpen((o) => !o)}
            className="flex items-center gap-2 w-full text-left"
            aria-expanded={eeoOpen}
          >
            <SectionHead>EEO / Demographic</SectionHead>
            <span className="text-[11px] text-gray-400 font-normal normal-case tracking-normal ml-1">
              optional
            </span>
            {eeoOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" aria-hidden="true" />
            )}
          </button>

          {eeoOpen && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Many ATS platforms ask these during an application. This data stays on your device and is only used when you trigger autofill.
              </p>

              <Field label="Gender">
                <select
                  id="eeo-gender"
                  className={inputCls}
                  value={draft.eeo?.gender ?? ''}
                  onChange={(ev) => setEEO('gender', ev.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other / Self-describe">Other / Self-describe</option>
                </select>
              </Field>

              <Field label="Race / Ethnicity">
                <select
                  id="eeo-race"
                  className={inputCls}
                  value={draft.eeo?.race ?? ''}
                  onChange={(ev) => setEEO('race', ev.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                  <option value="Asian">Asian</option>
                  <option value="Black or African American">Black or African American</option>
                  <option value="Hispanic or Latino">Hispanic or Latino</option>
                  <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                  <option value="White">White</option>
                  <option value="Two or More Races">Two or More Races</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Veteran status">
                <select
                  id="eeo-veteran"
                  className={inputCls}
                  value={draft.eeo?.veteranStatus ?? ''}
                  onChange={(ev) => setEEO('veteranStatus', ev.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="I am not a protected veteran">I am not a protected veteran</option>
                  <option value="I am a protected veteran">I am a protected veteran</option>
                </select>
              </Field>

              <Field label="Disability status">
                <select
                  id="eeo-disability"
                  className={inputCls}
                  value={draft.eeo?.disabilityStatus ?? ''}
                  onChange={(ev) => setEEO('disabilityStatus', ev.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="No, I don't have a disability">No, I don't have a disability</option>
                  <option value="Yes, I have a disability">Yes, I have a disability</option>
                </select>
              </Field>
            </div>
          )}
        </section>

        {/* Bottom padding so last section isn't hidden behind sticky footer */}
        <div className="h-2" aria-hidden="true" />
      </div>

      {/* ── Sticky footer ── */}
      <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-gray-200 bg-white">
        {/* Secondary — design.md §4: white bg, gray-200 border */}
        <button
          id="btn-cancel-profile"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-200 bg-white text-sm font-medium text-ink py-2.5 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>

        {/* Primary — design.md §4: blue-600 solid */}
        <button
          id="btn-save-profile"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand text-white text-sm font-medium py-2.5 hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : initialProfile ? 'Save changes' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}
