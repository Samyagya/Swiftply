/**
 * heuristicMatcher.ts — Keyword/regex matcher: FormField[] + Profile → FieldMapping[].
 *
 * Algorithm:
 *   For each FormField, score every ProfileKey's keyword patterns against
 *   (field.label, field.nearbyContext). The best-scoring key above
 *   HEURISTIC_CONFIDENCE_THRESHOLD wins and its profile value is used.
 *   Fields below the threshold are marked source:'unmatched'.
 *
 * Confidence scores:
 *   0.85  — keyword found in the field label
 *   0.65  — keyword found in nearbyContext only (not the label itself)
 *   0.00  — no pattern matches
 *
 * Phase 4 implementation — see docs/features/05-field-matcher.md
 */

import type { FieldMapping, FormField, Profile } from '../lib/types'
import { HEURISTIC_CONFIDENCE_THRESHOLD } from '../lib/constants'

// ---------------------------------------------------------------------------
// ProfileKey — every fillable path in Profile
// ---------------------------------------------------------------------------

type ProfileKey =
  | 'contact.firstName'
  | 'contact.lastName'
  | 'contact.email'
  | 'contact.phone'
  | 'contact.address'
  | 'contact.city'
  | 'contact.state'
  | 'contact.zip'
  | 'contact.country'
  | 'links.linkedin'
  | 'links.github'
  | 'links.portfolio'
  | 'work.title'
  | 'work.company'
  | 'work.startDate'
  | 'work.endDate'
  | 'edu.institution'
  | 'edu.degree'
  | 'edu.field'
  | 'edu.gpa'
  | 'skills'
  | 'eeo.gender'
  | 'eeo.race'
  | 'eeo.veteranStatus'
  | 'eeo.disabilityStatus'

// ---------------------------------------------------------------------------
// Profile value resolver
// ---------------------------------------------------------------------------

/**
 * Returns the string value for a given ProfileKey from the active profile.
 * Returns '' if the value is not set.
 * For work.* / edu.* uses the most recent entry (index 0).
 * For skills, joins with ', '.
 *
 * Exported so llmMatcher.ts can re-derive values from Claude-returned profile
 * keys without duplicating resolution logic.
 */
export function resolveProfileValue(key: ProfileKey, profile: Profile): string {
  switch (key) {
    case 'contact.firstName': return profile.contact.firstName ?? ''
    case 'contact.lastName':  return profile.contact.lastName ?? ''
    case 'contact.email':     return profile.contact.email ?? ''
    case 'contact.phone':     return profile.contact.phone ?? ''
    case 'contact.address':   return profile.contact.address ?? ''
    case 'contact.city':      return profile.contact.city ?? ''
    case 'contact.state':     return profile.contact.state ?? ''
    case 'contact.zip':       return profile.contact.zip ?? ''
    case 'contact.country':   return profile.contact.country ?? ''
    case 'links.linkedin':    return profile.links.linkedin ?? ''
    case 'links.github':      return profile.links.github ?? ''
    case 'links.portfolio':   return profile.links.portfolio ?? ''
    case 'work.title':        return profile.workHistory[0]?.title ?? ''
    case 'work.company':      return profile.workHistory[0]?.company ?? ''
    case 'work.startDate':    return profile.workHistory[0]?.startDate ?? ''
    case 'work.endDate':      return profile.workHistory[0]?.endDate ?? ''
    case 'edu.institution':   return profile.education[0]?.institution ?? ''
    case 'edu.degree':        return profile.education[0]?.degree ?? ''
    case 'edu.field':         return profile.education[0]?.field ?? ''
    case 'edu.gpa':           return profile.education[0]?.gpa ?? ''
    case 'skills':            return profile.skills.join(', ')
    case 'eeo.gender':        return profile.eeo?.gender ?? ''
    case 'eeo.race':          return profile.eeo?.race ?? ''
    case 'eeo.veteranStatus': return profile.eeo?.veteranStatus ?? ''
    case 'eeo.disabilityStatus': return profile.eeo?.disabilityStatus ?? ''
    default:                  return ''
  }
}

// ---------------------------------------------------------------------------
// Keyword map
// Each entry: [ProfileKey, RegExp[]] — patterns ordered most-specific first.
// All patterns are case-insensitive (applied with .test() on lowercased input).
// ---------------------------------------------------------------------------

type KeywordEntry = [ProfileKey, RegExp[]]

const KEYWORD_MAP: KeywordEntry[] = [
  // ── Contact ──────────────────────────────────────────────────────────────
  ['contact.firstName', [
    /first[\s_-]*name/,
    /given[\s_-]*name/,
    /forename/,
    /\bfname\b/,
    /\bfirst\b/,
  ]],
  ['contact.lastName', [
    /last[\s_-]*name/,
    /family[\s_-]*name/,
    /sur[\s_-]*name/,
    /\blname\b/,
    /\blast\b/,
  ]],
  ['contact.email', [
    /e[\s-]?mail[\s_-]*(address)?/,
    /\bemail\b/,
  ]],
  ['contact.phone', [
    /phone[\s_-]*(number)?/,
    /tel(ephone)?[\s_-]*(number)?/,
    /mobile[\s_-]*(number)?/,
    /\bcell\b/,
  ]],
  ['contact.address', [
    /street[\s_-]*address/,
    /mailing[\s_-]*address/,
    /address[\s_-]*line[\s_-]*1/,
    /^address$/,
    /home[\s_-]*address/,
  ]],
  ['contact.city', [
    /\bcity\b/,
    /\btown\b/,
    /municipality/,
  ]],
  ['contact.state', [
    /\bstate\b/,
    /\bprovince\b/,
    /\bregion\b/,
    /state\s*\/\s*province/,
  ]],
  ['contact.zip', [
    /zip[\s_-]*(code)?/,
    /postal[\s_-]*code/,
    /post[\s_-]*code/,
    /\bpostcode\b/,
    /\bpincode\b/,
  ]],
  ['contact.country', [
    /\bcountry\b/,
    /\bnation\b/,
    /country[\s_-]*of[\s_-]*(residence|origin)/,
  ]],

  // ── Links ─────────────────────────────────────────────────────────────────
  ['links.linkedin', [
    /linked[\s_-]*in/,
    /linkedin[\s_-]*(url|profile|link)?/,
  ]],
  ['links.github', [
    /git[\s_-]*hub/,
    /github[\s_-]*(url|profile|link)?/,
  ]],
  ['links.portfolio', [
    /portfolio[\s_-]*(url|link|website)?/,
    /personal[\s_-]*website/,
    /personal[\s_-]*(url|link)/,
    /\bwebsite\b/,
    /\bportfolio\b/,
  ]],

  // ── Work history ──────────────────────────────────────────────────────────
  ['work.title', [
    /(current|most[\s_-]*recent|latest)[\s_-]*(job|position|role|title)/,
    /job[\s_-]*title/,
    /position[\s_-]*title/,
    /\btitle\b/,
    /\boccupation\b/,
    /\brole\b/,
  ]],
  ['work.company', [
    /(current|most[\s_-]*recent|latest)[\s_-]*(company|employer|organization)/,
    /\bemployer\b/,
    /\bcompany\b/,
    /\borganization\b/,
    /\bworkplace\b/,
  ]],
  ['work.startDate', [
    /start[\s_-]*date/,
    /from[\s_-]*date/,
    /employment[\s_-]*start/,
    /employment[\s_-]*from/,
  ]],
  ['work.endDate', [
    /end[\s_-]*date/,
    /to[\s_-]*date/,
    /employment[\s_-]*end/,
    /through[\s_-]*date/,
  ]],

  // ── Education ─────────────────────────────────────────────────────────────
  ['edu.institution', [
    /school[\s_-]*name/,
    /university[\s_-]*name/,
    /college[\s_-]*name/,
    /\binstitution\b/,
    /alma[\s_-]*mater/,
    /\buniversity\b/,
    /\bcollege\b/,
    /\bschool\b/,
  ]],
  ['edu.degree', [
    /degree[\s_-]*(earned|type|obtained)?/,
    /\bqualification\b/,
    /\bdiploma\b/,
    /\bcertificate\b/,
    /highest[\s_-]*(level|degree)/,
  ]],
  ['edu.field', [
    /field[\s_-]*of[\s_-]*study/,
    /major[\s_-]*(subject)?/,
    /area[\s_-]*of[\s_-]*study/,
    /\bconcentration\b/,
    /\bspecialization\b/,
  ]],
  ['edu.gpa', [
    /\bgpa\b/,
    /grade[\s_-]*point[\s_-]*(average)?/,
    /\bcgpa\b/,
    /grade[\s_-]*average/,
  ]],

  // ── Skills ────────────────────────────────────────────────────────────────
  ['skills', [
    /\bskills?\b/,
    /competenc(ies|y)/,
    /\btechnologies\b/,
    /\bexpertise\b/,
    /proficienc(ies|y)/,
    /technical[\s_-]*skills/,
  ]],

  // ── EEO ───────────────────────────────────────────────────────────────────
  ['eeo.gender', [
    /\bgender\b/,
    /gender[\s_-]*identity/,
    /\bsex\b/,
  ]],
  ['eeo.race', [
    /\brace\b/,
    /\bethnicity\b/,
    /ethnic[\s_-]*(background|origin|group)/,
    /racial[\s_-]*(background|identity)/,
  ]],
  ['eeo.veteranStatus', [
    /veteran[\s_-]*(status|classification)?/,
    /military[\s_-]*status/,
    /protected[\s_-]*veteran/,
  ]],
  ['eeo.disabilityStatus', [
    /disabilit(y|ies)[\s_-]*(status)?/,
    /\baccommodation\b/,
    /\bdisabled\b/,
  ]],
]

// ---------------------------------------------------------------------------
// Confidence scorer
// ---------------------------------------------------------------------------

function scoreMatch(
  label: string,
  nearbyContext: string | undefined,
  patterns: RegExp[],
): number {
  const labelLc = label.toLowerCase()
  const contextLc = nearbyContext?.toLowerCase() ?? ''
  let best = 0

  for (const pattern of patterns) {
    if (pattern.test(labelLc)) {
      best = Math.max(best, 0.85)
      break // can't score higher — short-circuit
    }
    if (contextLc && pattern.test(contextLc)) {
      best = Math.max(best, 0.65)
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps a list of detected form fields to profile values using keyword heuristics.
 *
 * @param fields  - FormField[] from the page scanner (Phase 3)
 * @param profile - The active Profile from storage
 * @returns       FieldMapping[] — one entry per field, with value and source.
 */
export function matchFields(fields: FormField[], profile: Profile): FieldMapping[] {
  return fields.map((field): FieldMapping => {
    // rules.md §6: never attempt to fill file inputs
    if (field.inputType === 'file') {
      return { selector: field.selector, frameId: field.frameId, value: '', source: 'unmatched' }
    }

    let bestKey: ProfileKey | null = null
    let bestScore = 0

    for (const [key, patterns] of KEYWORD_MAP) {
      const score = scoreMatch(field.label, field.nearbyContext, patterns)
      if (score > bestScore) {
        bestScore = score
        bestKey = key
      }
    }

    if (bestKey !== null && bestScore >= HEURISTIC_CONFIDENCE_THRESHOLD) {
      const value = resolveProfileValue(bestKey, profile)
      return {
        selector: field.selector,
        frameId: field.frameId,
        value,
        // If the key matched but the profile has no value for it, mark unmatched
        source: value.trim() ? 'heuristic' : 'unmatched',
      }
    }

    return { selector: field.selector, frameId: field.frameId, value: '', source: 'unmatched' }
  })
}
