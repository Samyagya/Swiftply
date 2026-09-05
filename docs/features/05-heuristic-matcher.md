# Feature: Heuristic Field Matcher

**Phase:** 4  
**Status:** 🔲 Not started  
**Depends on:** Phase 1 (Profile, FormField, FieldMapping types), Phase 3 (fieldScanner output)

---

## What this feature is

Given a scanned list of `FormField[]` from a job application page and the active user `Profile`, the heuristic matcher produces a `FieldMapping[]` — a ranked list of `{ field, profileValue, confidence, source: 'heuristic' }` tuples that tell the filler what value to put in each field.

This runs entirely locally, requires no API key, and handles the majority of standard ATS fields. Phase 6 (LLM matcher) fills in the gaps for edge cases.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/background/heuristicMatcher.ts` | Implement | Core matching logic: `FormField[] + Profile → FieldMapping[]` |
| `tests/heuristicMatcher.test.ts` | Implement | Vitest unit tests: all profile fields + common label variants |
| `src/background/messageRouter.ts` | Modify | Add `EXECUTE_FILL` handler that calls matcher before forwarding fill command |

---

## Tech stack

| Concern | Approach | Why |
|---|---|---|
| Matching strategy | Keyword/regex map | Deterministic, fast, testable, zero cost, zero latency. Phase 6 adds LLM as a fallback for unmatched fields. |
| Confidence scoring | 0–1 float | Threshold = 0.6 (`constants.ts`). Above threshold → auto-fill. Below → mark as `unmatched` (user fills manually or LLM handles in Phase 6). |
| Testing | Vitest | Same runner configured in Phase 0. |

---

## Planned implementation

### Matching algorithm

```
for each FormField in scannedFields:
  1. Normalize label: lowercase, strip punctuation, trim
  2. Check label + nearbyContext against the keyword map
  3. Assign a (profileKey, confidence) pair
  4. If confidence >= HEURISTIC_CONFIDENCE_THRESHOLD:
       → FieldMapping { source: 'heuristic', value: profile[profileKey] }
     else:
       → FieldMapping { source: 'unmatched', value: '' }
```

### Keyword map structure

```typescript
type Rule = {
  profileKey: string   // dot-path into Profile, e.g. 'contact.firstName'
  keywords: string[]   // exact substrings to match in the normalized label
  patterns?: RegExp[]  // optional regex for more complex patterns
  confidence: number   // base confidence when matched (0.6–1.0)
}

const RULES: Rule[] = [
  { profileKey: 'contact.firstName', keywords: ['first name', 'first', 'given name', 'forename'], confidence: 0.95 },
  { profileKey: 'contact.lastName',  keywords: ['last name', 'last', 'surname', 'family name'],   confidence: 0.95 },
  { profileKey: 'contact.email',     keywords: ['email', 'e-mail'],                               confidence: 0.99 },
  { profileKey: 'contact.phone',     keywords: ['phone', 'mobile', 'telephone', 'cell'],          confidence: 0.90 },
  { profileKey: 'contact.address',   keywords: ['address', 'street'],                             confidence: 0.85 },
  { profileKey: 'contact.city',      keywords: ['city', 'town', 'municipality'],                  confidence: 0.90 },
  { profileKey: 'contact.state',     keywords: ['state', 'province', 'region'],                   confidence: 0.85 },
  { profileKey: 'contact.zip',       keywords: ['zip', 'postal code', 'postcode'],                confidence: 0.90 },
  { profileKey: 'contact.country',   keywords: ['country', 'nation'],                             confidence: 0.85 },
  { profileKey: 'links.linkedin',    keywords: ['linkedin'],                                       confidence: 0.99 },
  { profileKey: 'links.github',      keywords: ['github', 'git hub'],                             confidence: 0.99 },
  { profileKey: 'links.portfolio',   keywords: ['portfolio', 'website', 'personal site'],         confidence: 0.80 },
  // EEO
  { profileKey: 'eeo.gender',        keywords: ['gender'],                                         confidence: 0.95 },
  { profileKey: 'eeo.race',          keywords: ['race', 'ethnicity', 'racial'],                   confidence: 0.95 },
  { profileKey: 'eeo.veteranStatus', keywords: ['veteran', 'military'],                           confidence: 0.90 },
  { profileKey: 'eeo.disabilityStatus', keywords: ['disability', 'disabled'],                     confidence: 0.90 },
  // Work history — these are multi-value and context-dependent
  // Phase 4 handles them as "first work entry" only; Phase 7 handles pagination
  { profileKey: 'workHistory.0.company', keywords: ['company', 'employer', 'organization'],       confidence: 0.75 },
  { profileKey: 'workHistory.0.title',   keywords: ['job title', 'position', 'role'],             confidence: 0.80 },
  ...
]
```

### Value resolution from profileKey
Use a simple recursive object path resolver:
```typescript
function resolve(profile: Profile, dotPath: string): string | undefined {
  // e.g. 'contact.city' → profile.contact.city
  return dotPath.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key]
    return undefined
  }, profile) as string | undefined
}
```

### Confidence adjustment heuristics
- **Boost:** If `inputType === 'email'` and the rule is for `contact.email` → confidence += 0.05 (type agrees with profile key type).
- **Reduce:** If the label is very short (< 4 chars) and matched only by a single keyword → confidence -= 0.10 (ambiguous label).
- **Cap:** Confidence is clamped to [0.0, 1.0].

---

## Key decisions to make before implementing

### D1: How to handle work history with multiple entries?
Most ATS platforms ask for work history one entry at a time in a sequence of steps (e.g., Workday), or show only the most recent entry as a single-field set. The matcher can't know which entry number applies to which form.

**Plan for Phase 4:** Match work history fields to `workHistory[0]` (most recent entry) only. Document this limitation in the fill log. Phase 7 (multi-page support) will handle the full sequence.

### D2: How to handle `select` inputs (dropdowns)?
Native `<select>` elements have an option list that doesn't always match the profile value exactly. For example:
- Profile: `eeo.gender = "Female"`
- Select options: `["", "Prefer not to say", "Woman", "Man", "Non-binary"]`

The matched profile value needs to be fuzzy-matched against the available options. Strategy:
1. Get `Array.from(select.options).map(o => o.text)` in the content script (add to FormField as `options?: string[]`).
2. In the matcher, find the best option match (lowercase equality, then includes, then fuzzy).
3. Use the matched option's `value` attribute for the fill command.

This requires adding `options?: string[]` to `FormField` in `types.ts` (minor schema extension).

### D3: Work history vs. "current job" single field
Some forms have a single "Current employer" text field (not a multi-step sequence). This should map to `workHistory[0].company` with high confidence if the label contains "current".

---

## Testing plan (`heuristicMatcher.test.ts`)

```typescript
// Example test cases:
test('matches first name', () => {
  const fields = [{ label: 'First Name', inputType: 'text', ... }]
  const result = match(fields, profile)
  expect(result[0].value).toBe('Jane')
  expect(result[0].source).toBe('heuristic')
})

test('handles label variation: "Given Name"', () => { ... })
test('skips file inputs', () => { ... })
test('marks "cover letter" field as unmatched', () => { ... })
test('handles email input type boost', () => { ... })
test('confidence below threshold → unmatched', () => { ... })
```

Target: ≥ 80% test coverage, all `Profile` leaf fields have at least one passing test case.

---

## Known gotchas

- **"Name" ambiguity:** Some forms have a single "Full name" field instead of separate first/last. The matcher should map this to `${firstName} ${lastName}` combined. Detect by: label contains "full name" or "name" without "first" or "last" qualifier.
- **Nationality vs. Country:** "Nationality" ≠ "Country of residence". Don't map both to `contact.country`. "Nationality" should be `unmatched` unless we add a `contact.nationality` field to the schema.
- **Salary fields:** Many applications ask "What is your desired salary?" or "What is your current salary?". Do NOT attempt to autofill salary fields (no salary in the Profile schema — this is intentional). Mark as `unmatched`.
- **"Years of experience" dropdowns:** Common on many ATS forms. Not in the Profile schema (computing it from work history would require date math and is fragile). Mark as `unmatched`.
