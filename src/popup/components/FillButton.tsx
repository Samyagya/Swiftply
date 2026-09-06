/**
 * FillButton.tsx — Phase 5 note.
 *
 * The Fill button functionality was absorbed directly into MatchView inside
 * Popup.tsx rather than being a standalone component. The button is tightly
 * coupled to the match state (needs mappings, tabId, filling state) — a
 * separate component would require awkward prop-threading.
 *
 * This file is kept to satisfy import references but is a no-op.
 * See Popup.tsx > MatchView > handleFill for the implementation.
 */
export default function FillButton(): null {
  return null
}
