/**
 * storage.ts — Typed async wrapper around chrome.storage.local.
 *
 * Rules:
 *   - NEVER use localStorage (not reliably isolated in extension contexts — rules.md §1).
 *   - All data validated with Zod schemas on read; malformed entries are
 *     logged and skipped, never silently accepted.
 *   - API keys are stored here (encrypted by Chrome's profile), never hardcoded
 *     or logged (rules.md §3).
 */

import { Profile, ProfileSchema, Settings, SettingsSchema, DEFAULT_SETTINGS } from './types'
import { STORAGE_KEYS } from './constants'

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * Returns all saved profiles, validating each one against the schema.
 * Malformed profiles are logged to console.error and excluded from the result
 * rather than crashing (rules.md §2: a single failure must not abort everything).
 */
export async function getProfiles(): Promise<Profile[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILES)
  const raw: unknown = result[STORAGE_KEYS.PROFILES]
  if (!Array.isArray(raw)) return []

  const profiles: Profile[] = []
  for (const item of raw) {
    const parsed = ProfileSchema.safeParse(item)
    if (parsed.success) {
      profiles.push(parsed.data)
    } else {
      console.error('[Swiftply] Skipped malformed profile in storage:', parsed.error.flatten())
    }
  }
  return profiles
}

/**
 * Saves (or updates) a profile. Validates with Zod before writing.
 * Throws if the profile fails validation — caller is responsible for
 * showing the error to the user.
 */
export async function saveProfile(profile: Profile): Promise<void> {
  // Parse (throws ZodError if invalid — surfaces to caller, not silently swallowed)
  ProfileSchema.parse(profile)

  const profiles = await getProfiles()
  const idx = profiles.findIndex((p) => p.id === profile.id)

  if (idx >= 0) {
    profiles[idx] = profile
  } else {
    profiles.push(profile)
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles })
}

/**
 * Deletes a profile by ID. Also clears the active-profile pointer if it
 * was pointing at the deleted profile.
 */
export async function deleteProfile(id: string): Promise<void> {
  const profiles = await getProfiles()
  const filtered = profiles.filter((p) => p.id !== id)
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: filtered })

  const activeId = await getActiveProfileId()
  if (activeId === id) {
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_PROFILE_ID)
  }
}

// ---------------------------------------------------------------------------
// Active profile pointer
// ---------------------------------------------------------------------------

/** Returns the ID of the currently selected profile, or null if none. */
export async function getActiveProfileId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_PROFILE_ID)
  const val: unknown = result[STORAGE_KEYS.ACTIVE_PROFILE_ID]
  return typeof val === 'string' ? val : null
}

/** Persists the active profile ID. */
export async function setActiveProfileId(id: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PROFILE_ID]: id })
}

// ---------------------------------------------------------------------------
// Settings (Phase 6 — storage scaffolding ready now)
// ---------------------------------------------------------------------------

/**
 * Returns persisted settings, falling back to safe defaults if missing or
 * malformed. LLM is OFF by default (rules.md §3, privacy-first).
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const raw: unknown = result[STORAGE_KEYS.SETTINGS]
  const parsed = SettingsSchema.safeParse(raw)
  if (!parsed.success) return { ...DEFAULT_SETTINGS }
  return parsed.data
}

/**
 * Persists settings. Validates before writing.
 * Note: the API key is stored in chrome.storage.local (not .sync), so it
 * stays on this device only and is protected by the user's Chrome profile.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  SettingsSchema.parse(settings)
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings })
}
