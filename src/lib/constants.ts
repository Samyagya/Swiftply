/**
 * constants.ts — App-wide constants for Swiftply.
 *
 * Keep tuneable values here so they can be changed in one place
 * without hunting through the codebase.
 */

// ---------------------------------------------------------------------------
// chrome.storage.local keys
// Using namespaced strings to avoid collisions with the host page or other extensions.
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  PROFILES: 'swiftply_profiles',
  ACTIVE_PROFILE_ID: 'swiftply_active_profile_id',
  SETTINGS: 'swiftply_settings',
  FILL_LOG: 'swiftply_fill_log',
} as const

// ---------------------------------------------------------------------------
// Heuristic matcher (Phase 4)
// ---------------------------------------------------------------------------
/** Minimum confidence score (0–1) required to auto-fill a field. */
export const HEURISTIC_CONFIDENCE_THRESHOLD = 0.6

// ---------------------------------------------------------------------------
// LLM matcher (Phase 6)
// ---------------------------------------------------------------------------
/** Abort LLM API requests after this many milliseconds (rules.md §2). */
export const LLM_TIMEOUT_MS = 8_000

/** Number of times to retry a failed LLM API call (rules.md §2). */
export const LLM_MAX_RETRIES = 1

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
/** Fixed popup width in px — design.md §3. */
export const POPUP_WIDTH_PX = 380
