/**
 * llmMatcher.ts — LLM-assisted field matching via Anthropic Claude API.
 *
 * Called ONLY when the user has:
 *   1. Explicitly enabled "AI-assisted matching" in Settings
 *   2. Provided their own Anthropic API key (BYO key model)
 *
 * Privacy rules (rules.md §3):
 *   - Only unmatched field LABELS are sent — not values, not full profile
 *   - Profile subset sent: contact, links, skills, eeo (no work descriptions)
 *   - API key appears in the Authorization header only — never logged
 *   - On any failure the function returns [] — heuristic results are used
 *
 * Value derivation (safety):
 *   Claude returns a profileKey (e.g. "contact.firstName"), NOT a value.
 *   The actual value is re-derived from the profile locally using the same
 *   resolveProfileValue() from heuristicMatcher.ts. This prevents Claude
 *   from hallucinating or fabricating field values.
 *
 * Timeout + retry: 8s timeout, 1 retry on network error or 5xx (rules.md §2).
 *
 * Phase 6 implementation.
 */

import type { FieldMapping, FormField, Profile } from '../lib/types'
import { LlmMatchResponseSchema } from '../lib/types'
import { LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from '../lib/constants'
import { resolveProfileValue } from './heuristicMatcher'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const CLAUDE_MODEL = 'claude-haiku-3-5'
const MAX_TOKENS = 512

// ---------------------------------------------------------------------------
// Minimal profile subset — what we actually send to Claude
// Deliberately excludes workHistory descriptions (too much text / too personal)
// ---------------------------------------------------------------------------

type MinimalProfile = Pick<Profile, 'contact' | 'links' | 'skills' | 'eeo'>

function buildMinimalProfile(profile: Profile): MinimalProfile {
  return {
    contact: profile.contact,
    links: profile.links,
    skills: profile.skills,
    eeo: profile.eeo,
  }
}

// ---------------------------------------------------------------------------
// System prompt — static, no user data
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a form-filling assistant for job applications.

Given a list of form field labels and a user profile, identify which profile key best matches each label.

Rules:
- Only return fields you are confident about. Omit ambiguous or irrelevant ones.
- Use exact profile key paths like "contact.firstName", "contact.email", "eeo.gender", "links.linkedin", "skills".
- Return ONLY valid JSON in this exact shape: { "matches": [{ "label": "...", "profileKey": "..." }] }
- Never invent profile keys that don't exist in the profile.
- Never attempt to match password, payment, SSN, or CAPTCHA fields.
- If no fields can be confidently matched, return { "matches": [] }`

// ---------------------------------------------------------------------------
// Fetch with timeout (AbortController)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Single attempt
// ---------------------------------------------------------------------------

async function attemptLlmMatch(
  labels: string[],
  minimalProfile: MinimalProfile,
  apiKey: string,
): Promise<Response> {
  const userMessage = `Form field labels to match:\n${JSON.stringify(labels)}\n\nUser profile:\n${JSON.stringify(minimalProfile, null, 2)}`

  return fetchWithTimeout(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,           // API key in header only — never logged
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    },
    LLM_TIMEOUT_MS,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Uses Claude to map unmatched form fields to profile keys.
 *
 * Returns FieldMapping[] with source: 'llm' for successfully matched fields.
 * Returns [] on any error — callers must handle the empty-array fallback.
 *
 * Values are re-derived from the local profile (not trusted from Claude)
 * to prevent hallucination.
 *
 * @param unmatchedFields - FormField[] where heuristic returned 'unmatched'
 * @param profile         - Active user profile
 * @param apiKey          - User's Anthropic API key from settings
 */
export async function llmMatch(
  unmatchedFields: FormField[],
  profile: Profile,
  apiKey: string,
): Promise<FieldMapping[]> {
  if (unmatchedFields.length === 0) return []

  const labels = unmatchedFields.map((f) => f.label).filter(Boolean)
  if (labels.length === 0) return []

  const minimalProfile = buildMinimalProfile(profile)

  // Attempt with one retry on failure (rules.md §2)
  let response: Response | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      response = await attemptLlmMatch(labels, minimalProfile, apiKey)
      if (response.ok || response.status < 500) break  // don't retry 4xx
    } catch (err) {
      lastError = err
      console.warn(`[Swiftply] LLM attempt ${attempt + 1} failed:`, err)
      if (attempt === LLM_MAX_RETRIES) {
        console.error('[Swiftply] LLM match exhausted retries:', lastError)
        return []
      }
    }
  }

  if (!response) return []

  if (!response.ok) {
    console.error(`[Swiftply] LLM API returned ${response.status}`)
    return []
  }

  // Parse response body
  let rawText: string
  try {
    const body = await response.json() as { content?: { text?: string }[] }
    rawText = body?.content?.[0]?.text ?? ''
  } catch (err) {
    console.error('[Swiftply] Failed to parse LLM response body:', err)
    return []
  }

  // Extract JSON from Claude's reply (it may wrap it in markdown code fences)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[Swiftply] No JSON found in LLM response:', rawText)
    return []
  }

  // Zod-validate the parsed JSON (rules.md §2 — never trust LLM output blindly)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('[Swiftply] LLM response JSON parse error:', err, rawText)
    return []
  }

  const validated = LlmMatchResponseSchema.safeParse(parsed)
  if (!validated.success) {
    console.error('[Swiftply] LLM response failed Zod validation:', validated.error.issues)
    return []
  }

  // Build FieldMapping[] — re-derive values from local profile (safety)
  const results: FieldMapping[] = []

  for (const match of validated.data.matches) {
    // Find the original FormField by label
    const field = unmatchedFields.find((f) => f.label === match.label)
    if (!field) continue

    // Re-derive the actual value from the profile (never trust Claude's value)
    const value = resolveProfileValue(match.profileKey as Parameters<typeof resolveProfileValue>[0], profile)
    if (!value.trim()) continue  // no value → leave unmatched

    results.push({
      selector: field.selector,
      frameId: field.frameId,
      value,
      source: 'llm',
    })
  }

  return results
}
