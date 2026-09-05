# Feature: LLM-Assisted Matching (Opt-In)

**Phase:** 6  
**Status:** 🔲 Not started  
**Depends on:** Phase 4 (heuristicMatcher produces `unmatched` fields), Phase 1 (Settings schema, storage)

---

## What this feature is

An optional, user-enabled enhancement to the matching pipeline. For fields the heuristic matcher marks as `unmatched` (confidence < 0.6), the LLM matcher sends the field label + a minimal profile subset to the Anthropic Claude API and asks it to return the best matching value from the profile.

**Off by default.** The user must explicitly toggle it on and enter their own API key.  
**No Swiftply backend.** The API key is stored in `chrome.storage.local` and requests are made directly from the extension background worker to the Anthropic API.

---

## Files to create / modify

| File | Action | Role |
|---|---|---|
| `src/background/llmMatcher.ts` | Implement | Sends unmatched fields to Claude; validates response; returns `FieldMapping[]` |
| `src/popup/Popup.tsx` | Modify | Add Settings view (API key input, LLM toggle) |
| `src/lib/storage.ts` | Done (scaffolded) | `getSettings()` / `saveSettings()` already implemented in Phase 1 |
| `src/lib/types.ts` | Done (scaffolded) | `Settings` schema already defined in Phase 1 |

---

## Tech stack

| Concern | Approach | Why |
|---|---|---|
| LLM provider | Anthropic Claude (claude-3-haiku or claude-3-5-sonnet) | Fast, cheap per-token, good at structured JSON output, widely available. User provides their own key. |
| API call | `fetch()` from background service worker | Background workers can make cross-origin requests without CORS issues (unlike content scripts). No SDK needed — just `fetch` to `https://api.anthropic.com/v1/messages`. |
| Response validation | `zod` — validate LLM JSON before use | LLMs can hallucinate or return malformed JSON. Validate every response; fall back to `unmatched` on failure. Never trust raw LLM output. |
| Timeout | 8s (`LLM_TIMEOUT_MS` from constants.ts) | Rules.md §2: must have a timeout. Use `AbortController`. |
| Retry | 1 retry on timeout / 5xx (`LLM_MAX_RETRIES` from constants.ts) | Single retry is enough. Don't spam the API. |
| Privacy | Send field labels + profile values only; NO page HTML; NO job description | Minimal data transmission. The user's profile data leaves their device only if they explicitly enabled LLM matching. |

---

## Planned implementation

### `llmMatcher.ts`

```typescript
import { FieldMapping, FormField, Profile } from '../lib/types'
import { getSettings } from '../lib/storage'
import { LLM_TIMEOUT_MS, LLM_MAX_RETRIES } from '../lib/constants'
import { z } from 'zod'

export async function llmMatch(
  unmatchedFields: FormField[],
  profile: Profile
): Promise<FieldMapping[]>
```

**What gets sent to Claude:**

```
System: You are a form-filling assistant. Given a list of form field labels
and a user profile, return a JSON array mapping each field label to the
best matching profile value. If there is no suitable value, use "".

User:
Profile:
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  ...
}

Fields:
[
  { "label": "Desired salary", "inputType": "text" },
  { "label": "How did you hear about us?", "inputType": "select" }
]

Return ONLY a JSON array:
[{ "label": "...", "value": "..." }, ...]
```

**What the profile subset includes:**
- All leaf values from `contact`, `links`, `skills` (as comma-separated string)
- First work entry's company, title, description
- First education entry's institution, degree, field
- EEO values (only if user filled them)

**What is NEVER sent:**
- The full `Profile.id`
- The API key itself (obviously)
- Any page content, page URL, job description, or employer name

**Response validation schema:**
```typescript
const LLMResponseSchema = z.array(z.object({
  label: z.string(),
  value: z.string(),
}))
```

If `LLMResponseSchema.safeParse()` fails, log the error and return all fields as `{ source: 'unmatched', value: '' }`. Never throw to the caller.

### Prompt design notes

- Ask for JSON explicitly and use Claude's ability to output structured data.
- Keep the prompt under 1000 tokens total to use claude-3-haiku cheaply.
- Do NOT include job description context — that would be a separate "Cover Letter" feature (v2 backlog).

---

## Key decisions & reasoning

### 1. BYO API key (no Swiftply backend)
- **Decision:** Users bring their own Anthropic API key. No Swiftply-managed API endpoint.
- **Why:** Building a backend requires hosting costs, auth, rate limiting, and privacy compliance (GDPR). For v1, zero backend is the right call. The user's API key is stored in `chrome.storage.local`, which is encrypted by Chrome and stays on their device.
- **UX concern:** Requiring an Anthropic account is a friction point. Mitigate by making LLM matching visibly opt-in and framing the heuristic matcher as "works great without it." Most users won't need LLM matching for standard fields.

### 2. Off by default
- **Decision:** `llmEnabled: false` in default settings. The user must toggle it on.
- **Why:** Privacy-first default (rules.md §3). Data should not leave the device unless the user explicitly opts in. Show a clear privacy caption in the settings: "When enabled, field labels and your profile values are sent to Anthropic's API. No page content is sent."

### 3. `fetch` from background worker (no SDK)
- **Decision:** Use plain `fetch()` rather than the `@anthropic-ai/sdk` npm package.
- **Why:** The Anthropic SDK adds ~50KB to the bundle. The v1 messages API is simple enough to call with plain `fetch`. No SDK needed, no extra dependency.

### 4. Model choice: claude-3-haiku
- **Decision:** Default to `claude-3-haiku-20240307` (fastest, cheapest model).
- **Why:** The task is simple: match labels to values. Haiku is more than capable. Users can optionally upgrade to sonnet in settings if they want higher accuracy.
- **Cost estimate:** A typical application has ~20 unmatched fields. At haiku prices (~$0.25 per 1M input tokens), 20 fields × ~200 tokens each = ~4000 tokens per application ≈ $0.001 per fill. Negligible.

### 5. Validate LLM JSON with Zod
- **Decision:** Always validate `LLMResponseSchema.safeParse()` before acting on the response.
- **Why:** LLMs can output malformed JSON (markdown code fence wrapping, trailing commas, hallucinated fields). Never trust raw LLM output in user-facing code (rules.md §2).
- **Parsing trick:** Strip markdown fences before parsing: `response.replace(/^```json\n?/, '').replace(/\n?```$/, '')`.

---

## Known gotchas

- **Claude API changes:** Anthropic occasionally changes model names (e.g., claude-3-opus → claude-3-5-sonnet). Hardcode model names in `constants.ts` so they're easy to update in one place.
- **Content policy:** If a field label contains something Claude's safety filters flag (unlikely for ATS fields but possible for sensitive form questions), the API will return an error. Handle gracefully → mark field as unmatched.
- **API key validation:** Don't try to validate the API key format at input time (Anthropic keys start with `sk-ant-` but this could change). Let the first API call fail with a 401 and surface the error as "Invalid API key — check your Anthropic settings."
- **Rate limits:** Anthropic's rate limits vary by tier. If the user triggers many fills rapidly, they may hit rate limits. Handle 429 responses: show "API rate limit hit — wait a moment and try again."
