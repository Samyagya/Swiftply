/**
 * types.ts — Shared TypeScript interfaces and Zod schemas for Swiftply.
 *
 * Convention: Zod schemas are the source of truth.
 * TypeScript types are derived from them via `z.infer<>`.
 * All inter-process messages and LLM responses must be validated
 * against these schemas before use (rules.md §2).
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const WorkEntrySchema = z.object({
  id: z.string(),
  company: z.string().min(1, 'Company is required'),
  title: z.string().min(1, 'Job title is required'),
  startDate: z.string(), // YYYY-MM (HTML month input format)
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  description: z.string().optional(),
})
export type WorkEntry = z.infer<typeof WorkEntrySchema>

export const EducationEntrySchema = z.object({
  id: z.string(),
  institution: z.string().min(1, 'Institution is required'),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
})
export type EducationEntry = z.infer<typeof EducationEntrySchema>

// ---------------------------------------------------------------------------
// Profile — the primary data model (Architecture.md §4)
//
// Extensions beyond Architecture.md spec:
//   - contact: added city, state, zip, country (separately matched by heuristics)
//   - Decision logged in memory.md 2026-09-05
// ---------------------------------------------------------------------------

export const ProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Profile name is required'),
  contact: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }),
  links: z.object({
    linkedin: z.string().optional(),
    github: z.string().optional(),
    portfolio: z.string().optional(),
  }),
  workHistory: z.array(WorkEntrySchema),
  education: z.array(EducationEntrySchema),
  skills: z.array(z.string()),
  eeo: z
    .object({
      gender: z.string().optional(),
      race: z.string().optional(),
      veteranStatus: z.string().optional(),
      disabilityStatus: z.string().optional(),
    })
    .optional(),
})
export type Profile = z.infer<typeof ProfileSchema>

// ---------------------------------------------------------------------------
// FormField — detected by content/fieldScanner.ts (Phase 3)
// ---------------------------------------------------------------------------

export const FormFieldSchema = z.object({
  selector: z.string(),
  frameId: z.number(),
  label: z.string(),
  inputType: z.enum([
    'text',
    'email',
    'tel',
    'select',
    'radio',
    'checkbox',
    'textarea',
    'custom-dropdown',
    'file',
  ]),
  nearbyContext: z.string().optional(),
})
export type FormField = z.infer<typeof FormFieldSchema>

// ---------------------------------------------------------------------------
// FieldMapping — produced by matchers (Phase 4+)
// ---------------------------------------------------------------------------

export const FieldMappingSchema = z.object({
  selector: z.string(),
  frameId: z.number(),
  value: z.string(),
  source: z.enum(['heuristic', 'llm', 'unmatched']),
})
export type FieldMapping = z.infer<typeof FieldMappingSchema>

// ---------------------------------------------------------------------------
// FillResultEntry — per-field outcome from fieldFiller (Phase 5)
// ---------------------------------------------------------------------------

export const FillResultEntrySchema = z.object({
  selector: z.string(),
  status: z.enum(['filled', 'skipped', 'failed']),
  /** User-readable reason for failure; only present when status === 'failed'. */
  error: z.string().optional(),
})
export type FillResultEntry = z.infer<typeof FillResultEntrySchema>

// ---------------------------------------------------------------------------
// FillLogEntry — one record per fill session, persisted in chrome.storage.local
// Used by FillLog.tsx to show session history (Phase 8)
// ---------------------------------------------------------------------------

export const FillLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),       // Date.now()
  siteUrl: z.string(),         // URL of the tab at fill time
  siteTitle: z.string(),       // document.title at fill time
  profileName: z.string(),     // name of the profile used
  filled: z.number(),
  skipped: z.number(),
  failed: z.number(),
  failures: z.array(
    z.object({
      selector: z.string(),
      error: z.string().optional(),
    }),
  ),
})
export type FillLogEntry = z.infer<typeof FillLogEntrySchema>


// ---------------------------------------------------------------------------
// LLM matcher response schemas (Phase 6)
// Claude must return JSON matching this shape; Zod validates before use.
// ---------------------------------------------------------------------------

/** One entry in Claude's response: a field label mapped to a profile key. */
export const LlmFieldMatchSchema = z.object({
  /** The field label exactly as sent to Claude. */
  label: z.string(),
  /** Profile key path, e.g. "contact.firstName", "eeo.gender". */
  profileKey: z.string().min(1),
})
export type LlmFieldMatch = z.infer<typeof LlmFieldMatchSchema>

/** Top-level shape of Claude's JSON response. */
export const LlmMatchResponseSchema = z.object({
  matches: z.array(LlmFieldMatchSchema),
})
export type LlmMatchResponse = z.infer<typeof LlmMatchResponseSchema>


// ---------------------------------------------------------------------------
// Message envelope — typed messages between popup / background / content
// All messages must be validated against this schema before acting (rules.md §2).
// ---------------------------------------------------------------------------

export const MessageTypeSchema = z.enum([
  'SCAN_PAGE',
  'SCAN_RESULT',
  'MATCH_FIELDS',   // Phase 4: popup → background, sends FormField[] + Profile
  'MATCH_RESULT',   // Phase 4: background → popup, sends FieldMapping[]
  'EXECUTE_FILL',
  'FILL_RESULT',
  'UNDO_FILL',      // Phase 5: popup → background → content, reverts fill + clears highlights
  'PAGE_CHANGED',
])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const MessageEnvelopeSchema = z.object({
  type: MessageTypeSchema,
  // payload is validated per-message-type after the envelope check
  payload: z.unknown(),
})
export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>

// ---------------------------------------------------------------------------
// Settings (Phase 6 — defined here so storage.ts can type it in Phase 1)
// ---------------------------------------------------------------------------

export const SettingsSchema = z.object({
  llmEnabled: z.boolean(),
  llmApiKey: z.string(),
})
export type Settings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  llmEnabled: false,
  llmApiKey: '',
}
